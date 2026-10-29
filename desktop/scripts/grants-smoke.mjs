import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer } from 'vite';

// Exercise the real React pages and their handlers without credentials or
// changing production data. Vite serves this harness only for this test run.
const html = `<!doctype html><html><body><div id="root"></div>
<script>window.librepm = {getBackendPort: async () => 8080};</script>
<script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import GrantsPage from '/src/pages/GrantsPage.jsx';
import FinancePage from '/src/pages/FinancePage.jsx';
import {ModalProvider} from '/src/context/ModalContext.jsx';
import {ToastContainer} from 'react-toastify';
import {librepm} from '/src/api/librepm.js';
import i18n from '/src/i18n.js';
import '/node_modules/bootstrap/dist/css/bootstrap.min.css';
await i18n.changeLanguage('en');
const calls = [{id:'c1',title:'Call Alpha',status:'IDENTIFIED',currency:'EUR'}, {id:'c2',title:'Call Beta',status:'IDENTIFIED',currency:'EUR'}];
let requirements = [];
let period = {id:'rp1',name:'Quarter 1',status:'UPCOMING',periodStart:'2026-01-01',periodEnd:'2026-03-31',dueDate:null};
window.audit = {updates:[],fail:false};
librepm.grantCallsList = async p => p === 'p1' ? calls : [];
librepm.grantObligationsList = async () => [];
librepm.grantReportingPeriodsList = async p => p === 'p1' ? [period] : [];
librepm.grantRequirementsList = async (_p,c) => c === 'c1' ? requirements.map(r=>({...r})) : [];
librepm.grantRequirementCreate = async (_p,c,data) => {const r={...data,id:'r1',callId:c}; requirements.push(r); return r;};
librepm.grantRequirementUpdate = async (_p,_c,id,data) => {if(window.audit.fail) throw Error('Save rejected'); requirements=requirements.map(r=>r.id===id?{...r,...data}:r); window.audit.updates.push(data); return requirements.find(r=>r.id===id);};
librepm.grantRequirementDelete = async () => {requirements=[];};
librepm.grantReportingPeriodUpdate = async (_p,_id,data) => {period={...period,...data}; window.audit.period=period; return period;};
librepm.financeBudgetsList = async p => p==='p1' ? [{id:'b1',name:'Budget One',status:'DRAFT'},{id:'b2',name:'Budget Two',status:'DRAFT'}] : [];
librepm.financeLinesList = async (_p,b) => {await new Promise(r=>setTimeout(r,b==='b2'?250:20)); return [{id:b,name:'Line '+b,category:'MISC',plannedAmount:20}];};
function Harness() {
 const [project,setProject]=React.useState('p1'); const [page,setPage]=React.useState('grants');
 window.setProject=setProject; window.setPage=setPage;
 const shell=React.useMemo(()=>({currentProject:{id:project}}),[project]);
 return React.createElement(ModalProvider,null,React.createElement(page==='grants'?GrantsPage:FinancePage,{shell}),React.createElement(ToastContainer));
}
createRoot(document.getElementById('root')).render(React.createElement(Harness));
window.audit.ready=true;
</script></body></html>`;

const server = await createServer({
    configFile: resolve('vite.config.js'),
    server: { host: '127.0.0.1', port: 5188, strictPort: false },
    plugins: [{ name: 'audit-harness', configureServer(vite) {
        vite.middlewares.use('/audit-harness.html', async (_request, response) => {
            response.setHeader('Content-Type', 'text/html');
            response.end(await vite.transformIndexHtml('/audit-harness.html', html));
        });
    } }],
});
const root = resolve(tmpdir());
const profile = mkdtempSync(join(root, 'librepm-grants-smoke-'));
const chrome = [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && existsSync(p));
let browser;
let socket;
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
    assert.ok(chrome, 'Chrome/Edge required; set CHROME_PATH');
    await server.listen();
    const port = 9800 + process.pid % 100;
    browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
    let tabs;
    for (let i = 0; i < 50 && !tabs; i++) {
        try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(100); }
    }
    assert.ok(tabs, 'Browser did not start');
    socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((done, reject) => { socket.onopen = done; socket.onerror = reject; });
    let id = 0;
    const pending = new Map();
    const pageErrors = [];
    socket.onmessage = e => {
        const message = JSON.parse(e.data);
        if (message.method === 'Runtime.exceptionThrown') pageErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
        if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    };
    const send = (method, params) => new Promise((done, reject) => {
        const key = ++id;
        const timer = setTimeout(() => reject(Error(`Timeout: ${method}`)), 15000);
        pending.set(key, response => { clearTimeout(timer); response.error ? reject(Error(response.error.message)) : done(response.result); });
        socket.send(JSON.stringify({ id: key, method, params }));
    });
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
        return result.result.value;
    };
    const waitFor = async expression => {
        for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(100); }
        throw Error('Condition not met: ' + expression + '\n' + await evaluate('document.body.innerText') + '\n' + pageErrors.join('\n'));
    };
    const click = text => evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}); if(!b)throw Error('Button absent'); b.click(); })()`);
    const fill = (label, value, index = 0) => evaluate(`(() => {
        const field=[...document.querySelectorAll('label')].filter(l=>l.querySelector('span')?.textContent===${JSON.stringify(label)})[${index}]?.querySelector('input,select,textarea');
        if(!field)throw Error('Field absent: '+${JSON.stringify(label)});
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field),'value').set.call(field,${JSON.stringify(value)});
        field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));
    })()`);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: server.resolvedUrls.local[0] + 'audit-harness.html' });
    await waitFor(`document.body.innerText.includes('Call Alpha') && document.querySelectorAll('form').length===2`);
    await fill('Description', 'Registration certificate', 1);
    await click('Add');
    await waitFor(`document.querySelectorAll('form').length===3`);
    await fill('Description', 'Updated certificate', 2);
    await fill('Evidence note', 'Uploaded signed document');
    await evaluate(`document.querySelector('input[type=checkbox]').click()`);
    await evaluate(`document.querySelectorAll('form')[2].requestSubmit()`);
    await waitFor(`window.audit.updates.length===1`);
    assert.equal(await evaluate(`window.audit.updates[0].description`), 'Updated certificate');
    assert.equal(await evaluate(`window.audit.updates[0].isMet`), true);
    await evaluate(`window.audit.fail=true`);
    await fill('Description', 'Unsaved draft', 2);
    await evaluate(`document.querySelectorAll('form')[2].requestSubmit()`);
    await waitFor(`document.body.innerText.includes('Save rejected')`);
    assert.equal(await evaluate(`document.querySelectorAll('form')[2].querySelector('input').value`), 'Unsaved draft');
    await evaluate(`document.querySelectorAll('form')[2].querySelector('button[type=button]').click()`);
    await waitFor(`document.body.innerText.includes('Delete this item?')`);
    await click('Confirm');
    await waitFor(`document.querySelectorAll('form').length===2`);
    await click('Reporting');
    await fill('Start Date', '2026-02-01');
    await fill('End Date', '2026-04-30');
    await fill('Due', '2026-05-15');
    await click('Save');
    await waitFor(`window.audit.period?.dueDate==='2026-05-15'`);
    await fill('End Date', '2025-01-01');
    assert.equal(await evaluate(`document.querySelector('form').checkValidity()`), false);
    await evaluate(`window.setProject('p2')`);
    await waitFor(`document.body.innerText.includes('No grant calls yet')`);
    assert.equal(await evaluate(`document.body.innerText.includes('Call Alpha')`), false);
    await evaluate(`window.setProject('p1'); window.setPage('finance')`);
    await waitFor(`document.querySelector('input')?.value==='Line b1'`);
    await evaluate(`(() => {const select=document.querySelector('select');select.value='b2';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await sleep(30);
    await evaluate(`(() => {const select=document.querySelector('select');select.value='b1';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await sleep(350);
    assert.equal(await evaluate(`document.querySelector('input').value`), 'Line b1');
    await evaluate(`window.setProject('p2')`);
    await sleep(200);
    assert.equal(await evaluate(`document.querySelectorAll('input').length`), 0);
    console.log('PASS: requirements create/update/evidence, rejected save draft, reporting dates/validation, project isolation, budget response race');
    await send('Browser.close').catch(() => {});
} finally {
    socket?.close();
    browser?.kill();
    await server.close();
    // Delete only the unique browser profile created under the known temp root.
    if (resolve(profile).startsWith(root + sep)) {
        await sleep(250);
        try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock. */ }
    }
}
