/**
 * Verifica del comportamento della sezione bandi su schermo stretto.
 *
 * Chrome headless guidato dal protocollo DevTools, nessuna dipendenza aggiunta.
 * Il bersaglio è `/mobile-harness.html`, che monta i componenti veri del guscio
 * senza backend né accesso Clerk (vedi src/mobile-harness.jsx).
 *
 * Uso:
 *   npm run dev:renderer       (in un terminale)
 *   npm run test:mobile        (in un altro)
 *
 * Cosa fa fallire il test:
 *   - scorrimento orizzontale a una qualsiasi delle larghezze provate;
 *   - un comando raggiungibile più basso della soglia (44px dove si tocca,
 *     24px col mouse — WCAG 2.2, 2.5.8);
 *   - un campo con testo sotto i 16px, che su iOS fa ingrandire la pagina al
 *     primo tocco e non la riporta più indietro;
 *   - il binario laterale che occupa spazio invece di farsi cassetto;
 *   - il cassetto che non si apre, non si chiude, o resta tabulabile da chiuso;
 *   - il pannello di contesto aperto all'avvio su telefono, o che da chiuso
 *     resta raggiungibile da tastiera;
 *   - le tabelle che restano tabelle invece di diventare schede.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";

// Le opzioni vanno scartate prima di cercare l'indirizzo, altrimenti
// `node scripts/mobile-smoke.mjs --screenshots` prova ad aprire "--screenshots"
// come se fosse un URL.
const positional = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const baseUrl = new URL(positional[0] ?? "http://localhost:5173");
const shouldCaptureScreenshots = process.argv.includes("--screenshots");
const targetUrl = new URL("/mobile-harness.html", baseUrl).toString();

const browserCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const browserPath = browserCandidates.find((candidate) => existsSync(candidate));

if (!browserPath) {
  throw new Error("Chrome/Edge non trovato. Imposta CHROME_PATH e riprova.");
}

const port = 9500 + (process.pid % 400);
const artifactsDir = resolve(".mobile-smoke");
mkdirSync(artifactsDir, { recursive: true });
const profileDir = mkdtempSync(join(artifactsDir, "chrome-profile-"));
const screenshots = {
  list: join(artifactsDir, "bandi-390.png"),
  drawer: join(artifactsDir, "cassetto-390.png"),
  panel: join(artifactsDir, "pannello-390.png"),
};

const browser = spawn(
  browserPath,
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-crash-reporter",
    "--disable-extensions",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ],
  { stdio: "ignore", windowsHide: true },
);

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const waitForBrowser = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) return response.json();
    } catch {
      // Il processo headless può impiegare qualche istante ad aprire la porta.
    }
    await sleep(250);
  }
  throw new Error("Il browser headless non ha aperto il protocollo di debug.");
};

const connect = async (webSocketDebuggerUrl) => {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", rejectPromise, { once: true });
  });

  let requestId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  const send = (method, params = {}) =>
    new Promise((resolvePromise, rejectPromise) => {
      requestId += 1;
      const currentId = requestId;
      const timer = setTimeout(() => {
        pending.delete(currentId);
        rejectPromise(new Error(`Timeout DevTools durante ${method}`));
      }, 10000);
      pending.set(currentId, { resolve: resolvePromise, reject: rejectPromise, timer });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });

  return { socket, send };
};

/**
 * Misura la pagina così com'è, senza toccarla.
 *
 * Un comando conta come raggiungibile solo se è davvero visibile: cassetto e
 * pannello chiusi vivono fuori schermo con `visibility: hidden`, e misurarne i
 * bottoni darebbe false violazioni su cose che nessuno può premere.
 */
const measureExpression = `(() => {
  const reachable = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (rect.width === 0 || rect.height === 0) return false;
    if (style.visibility === "hidden" || style.display === "none") return false;
    if (rect.right <= 0 || rect.left >= innerWidth) return false;
    let node = element;
    while (node) {
      if (getComputedStyle(node).visibility === "hidden") return false;
      node = node.parentElement;
    }
    return true;
  };

  const controls = [...document.querySelectorAll(
    "button, a.btn, [role='button'], input:not([type='hidden']):not([type='checkbox']):not([type='radio']), select, textarea"
  )].filter(reachable);

  const fields = [...document.querySelectorAll("input:not([type='hidden']), select, textarea")]
    .filter(reachable);

  const smallest = controls
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      label: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 40),
      height: Math.round(element.getBoundingClientRect().height),
    }))
    .sort((a, b) => a.height - b.height)[0] ?? null;

  const smallestFont = fields
    .map((element) => ({
      name: element.getAttribute("placeholder") || element.tagName.toLowerCase(),
      size: Math.round(parseFloat(getComputedStyle(element).fontSize)),
    }))
    .sort((a, b) => a.size - b.size)[0] ?? null;

  const sidebar = document.querySelector(".jl-sidebar");
  const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;

  const panel = document.querySelector(".jl-rightpanel");
  const panelStyle = panel ? getComputedStyle(panel) : null;

  const table = document.querySelector(".jl-content table");
  const firstCell = document.querySelector(".jl-content tbody td");

  const overflowing = [...document.querySelectorAll(".jl-root *")]
    .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
    .slice(0, 5)
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      cls: (element.getAttribute("class") || "").slice(0, 60),
      right: Math.round(element.getBoundingClientRect().right),
    }));

  return {
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    controlCount: controls.length,
    smallestControl: smallest,
    smallestFieldFont: smallestFont,
    sidebar: sidebar ? {
      position: sidebarStyle.position,
      visibility: sidebarStyle.visibility,
      width: Math.round(sidebar.getBoundingClientRect().width),
    } : null,
    panel: panel ? {
      position: panelStyle.position,
      visibility: panelStyle.visibility,
      closed: panel.classList.contains("closed"),
    } : null,
    tableIsCards: Boolean(table?.classList.contains("jl-cards-sm")),
    tableDisplay: table ? getComputedStyle(table).display : null,
    firstCellLabel: firstCell?.getAttribute("data-label") ?? null,
    overflowing,
  };
})()`;

const drawerExpression = `(() => {
  const burger = document.querySelector(".jl-header-burger");
  const sidebar = document.querySelector(".jl-sidebar");
  const backdrop = document.querySelector(".jl-sidebar-backdrop");
  const burgerVisible = burger ? getComputedStyle(burger).display !== "none" : false;

  burger?.click();
  return new Promise((done) => setTimeout(() => {
    const style = getComputedStyle(sidebar);
    const rect = sidebar.getBoundingClientRect();
    const link = sidebar.querySelector(".jl-nav-link");
    done({
      burgerVisible,
      burgerExpanded: burger?.getAttribute("aria-expanded"),
      openVisibility: style.visibility,
      openLeft: Math.round(rect.left),
      openWidth: Math.round(rect.width),
      fitsViewport: Math.round(rect.width) <= innerWidth,
      backdropVisible: backdrop ? getComputedStyle(backdrop).visibility : null,
      navLinkHeight: link ? Math.round(link.getBoundingClientRect().height) : 0,
      focusInsideDrawer: sidebar.contains(document.activeElement),
    });
  }, 420));
})()`;

const closeExpression = `(() => {
  const sidebar = document.querySelector(".jl-sidebar");
  document.querySelector(".jl-sidebar-backdrop")?.click();
  return new Promise((done) => setTimeout(() => {
    done({
      closedVisibility: getComputedStyle(sidebar).visibility,
      closedLeft: Math.round(sidebar.getBoundingClientRect().left),
      bodyOverflow: document.body.style.overflow || "(vuoto)",
    });
  }, 450));
})()`;

const panelExpression = `(() => {
  const panel = document.querySelector(".jl-rightpanel");
  const toggle = [...document.querySelectorAll("button")]
    .find((b) => b.textContent.trim() === "Pannello");
  toggle?.click();
  return new Promise((done) => setTimeout(() => {
    const rect = panel.getBoundingClientRect();
    const backdrop = document.querySelector(".jl-rightpanel-backdrop");
    done({
      openVisibility: getComputedStyle(panel).visibility,
      openRight: Math.round(rect.right),
      openWidth: Math.round(rect.width),
      fitsViewport: Math.round(rect.width) <= innerWidth && Math.round(rect.right) <= innerWidth + 1,
      backdropVisible: backdrop ? getComputedStyle(backdrop).display !== "none" : false,
    });
  }, 420));
})()`;

let connection;
try {
  const tabs = await waitForBrowser();
  // Mai tabs[0]: con estensioni installate via policy il primo target può
  // essere una background_page e la navigazione finirebbe nel vuoto.
  const pageTab = tabs.find((tab) => tab.type === "page");
  if (!pageTab) throw new Error("Nessun target di tipo page nel browser headless.");
  connection = await connect(pageTab.webSocketDebuggerUrl);
  const { send } = connection;
  await send("Page.enable");
  await send("Runtime.enable");

  const results = [];
  for (const width of [320, 375, 390, 768, 1280]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width < 640 ? 844 : 1024,
      deviceScaleFactor: 1,
      mobile: width < 640,
      screenWidth: width,
      screenHeight: width < 640 ? 844 : 1024,
    });
    await send("Page.navigate", { url: targetUrl });
    await sleep(1100);
    const evaluation = await send("Runtime.evaluate", {
      expression: measureExpression,
      returnByValue: true,
    });
    results.push({ viewport: width, ...evaluation.result.value });

    if (shouldCaptureScreenshots && width === 390) {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
      writeFileSync(screenshots.list, Buffer.from(shot.data, "base64"));
    }
  }

  // --- Cassetto e pannello, a 390px ---
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
    screenWidth: 390, screenHeight: 844,
  });
  await send("Page.navigate", { url: targetUrl });
  await sleep(1100);

  const openEvaluation = await send("Runtime.evaluate", {
    expression: drawerExpression, returnByValue: true, awaitPromise: true,
  });
  const drawer = openEvaluation.result.value;

  if (shouldCaptureScreenshots) {
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    writeFileSync(screenshots.drawer, Buffer.from(shot.data, "base64"));
  }

  const closeEvaluation = await send("Runtime.evaluate", {
    expression: closeExpression, returnByValue: true, awaitPromise: true,
  });
  const drawerClosed = closeEvaluation.result.value;

  const panelEvaluation = await send("Runtime.evaluate", {
    expression: panelExpression, returnByValue: true, awaitPromise: true,
  });
  const panel = panelEvaluation.result.value;

  if (shouldCaptureScreenshots) {
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    writeFileSync(screenshots.panel, Buffer.from(shot.data, "base64"));
  }

  // ------------------------------------------------------------------ verdetto
  const failures = [];

  for (const result of results) {
    const label = `${result.viewport}px`;

    if (result.scrollWidth > result.clientWidth || result.bodyScrollWidth > result.clientWidth) {
      const culprits = result.overflowing.map((o) => `${o.tag}.${o.cls}`).join(" | ") || "?";
      failures.push(`${label}: scorrimento orizzontale (${result.scrollWidth} > ${result.clientWidth}) — ${culprits}`);
    }

    // 44px è la soglia del dito, e vale dove si tocca. Sopra i 768px si punta
    // con il mouse e il minimo è quello delle WCAG 2.2 (2.5.8): 24px. Alzare
    // anche il desktop vorrebbe dire ridisegnare l'applicazione Electron, che
    // non ha questo problema.
    const minimumTarget = result.viewport < 768 ? 44 : 24;
    if (result.smallestControl && result.smallestControl.height < minimumTarget) {
      failures.push(
        `${label}: comando alto ${result.smallestControl.height}px `
        + `("${result.smallestControl.label}" <${result.smallestControl.tag}>), minimo ${minimumTarget}`
      );
    }

    if (result.smallestFieldFont && result.viewport < 768 && result.smallestFieldFont.size < 16) {
      failures.push(
        `${label}: campo "${result.smallestFieldFont.name}" a ${result.smallestFieldFont.size}px — iOS ingrandisce sotto i 16`
      );
    }

    if (result.sidebar) {
      const shouldBeDrawer = result.viewport < 992;
      const isDrawer = result.sidebar.position === "fixed";
      if (shouldBeDrawer && !isDrawer) {
        failures.push(`${label}: il binario laterale occupa ancora spazio invece di farsi cassetto`);
      }
      if (!shouldBeDrawer && isDrawer) {
        failures.push(`${label}: il binario laterale è un cassetto anche su schermo largo`);
      }
      if (shouldBeDrawer && result.sidebar.visibility !== "hidden") {
        failures.push(`${label}: il cassetto chiuso resta visibile e tabulabile`);
      }
    } else {
      failures.push(`${label}: binario laterale non trovato`);
    }

    if (result.panel) {
      const narrow = result.viewport < 992;
      // Su telefono il pannello di contesto non deve presentarsi aperto: coprirebbe
      // la pagina prima ancora che si sia visto di che pagina si tratta.
      if (narrow && !result.panel.closed) {
        failures.push(`${label}: il pannello di contesto si apre da solo all'avvio`);
      }
      if (!narrow && result.panel.closed) {
        failures.push(`${label}: il pannello di contesto parte chiuso anche su schermo largo`);
      }
      if (result.viewport < 768 && result.panel.closed && result.panel.visibility !== "hidden") {
        failures.push(`${label}: il pannello chiuso resta tabulabile`);
      }
    } else {
      failures.push(`${label}: pannello di contesto non trovato`);
    }

    const shouldBeCards = result.viewport < 768;
    if (shouldBeCards && result.tableDisplay !== "block") {
      failures.push(`${label}: la tabella è ancora una tabella (display: ${result.tableDisplay})`);
    }
    if (!shouldBeCards && result.tableDisplay === "block") {
      failures.push(`${label}: la tabella è a schede anche su schermo largo`);
    }
    if (!result.tableIsCards) {
      failures.push(`${label}: ResponsiveTables non ha etichettato la tabella`);
    }
    if (result.firstCellLabel !== "Titolo") {
      failures.push(`${label}: prima cella etichettata "${result.firstCellLabel}" invece di "Titolo"`);
    }
  }

  if (!drawer.burgerVisible) failures.push("il pulsante del menu non compare a 390px");
  if (drawer.burgerExpanded !== "true") failures.push("aria-expanded non passa a true all'apertura");
  if (drawer.openVisibility !== "visible") failures.push("il cassetto aperto non è visibile");
  if (drawer.openLeft !== 0) failures.push(`il cassetto aperto parte da ${drawer.openLeft}px invece che da 0`);
  if (!drawer.fitsViewport) failures.push(`il cassetto è largo ${drawer.openWidth}px su 390 di schermo`);
  if (drawer.backdropVisible !== "visible") failures.push("lo sfondo del cassetto non compare");
  if (drawer.navLinkHeight < 44) failures.push(`voci del menu alte ${drawer.navLinkHeight}px, minimo 44`);
  if (!drawer.focusInsideDrawer) failures.push("all'apertura il fuoco non entra nel cassetto");

  if (drawerClosed.closedVisibility !== "hidden") failures.push("il cassetto non si chiude toccando lo sfondo");
  if (drawerClosed.bodyOverflow === "hidden") failures.push("dopo la chiusura la pagina resta bloccata");

  if (panel.openVisibility !== "visible") failures.push("il pannello di contesto non si apre");
  if (!panel.fitsViewport) failures.push(`il pannello sfora il viewport (largo ${panel.openWidth}, bordo destro ${panel.openRight})`);
  if (!panel.backdropVisible) failures.push("lo sfondo del pannello non compare: non c'è modo di chiuderlo toccando fuori");

  console.log(JSON.stringify({
    ok: failures.length === 0,
    results,
    drawer: { ...drawer, ...drawerClosed },
    panel,
    screenshots: shouldCaptureScreenshots ? screenshots : "disattivati (usa --screenshots)",
    failures,
  }, null, 2));

  if (failures.length) process.exitCode = 1;
  await Promise.race([
    send("Browser.close").catch(() => undefined),
    sleep(500),
  ]);
} finally {
  connection?.socket.close();
  if (!browser.killed) browser.kill();
  const temporaryRoot = `${artifactsDir}${sep}`;
  const resolvedProfile = resolve(profileDir);
  if (resolvedProfile.startsWith(temporaryRoot) && basename(resolvedProfile).startsWith("chrome-profile-")) {
    await sleep(250);
    try {
      rmSync(resolvedProfile, { recursive: true, force: true });
    } catch {
      // Chrome può trattenere un file per pochi istanti: il profilo resta in .mobile-smoke.
    }
  }
}
