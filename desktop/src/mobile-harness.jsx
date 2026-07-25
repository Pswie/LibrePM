/**
 * Banco di prova del comportamento su schermo stretto.
 *
 * Le schermate vere stanno dietro l'accesso Clerk e un backend con base dati:
 * un test automatico non le raggiunge senza montare mezzo sistema. Qui vengono
 * invece montati i componenti veri del guscio — quelli che non parlano con il
 * backend — dentro la stessa impalcatura di `layout/AppShell.jsx` e con gli
 * stessi fogli di stile.
 *
 * Quello che questa pagina misura davvero:
 *
 *   - il guscio (`jl-root` → `jl-page`) e i suoi margini;
 *   - `LeftNav` come cassetto, con sfondo, chiusura e bersagli touch;
 *   - `TopHeader` e il suo pulsante hamburger;
 *   - il pannello di contesto come cassetto da destra, chiuso di partenza;
 *   - `ResponsiveTables` più le regole "tabella → schede".
 *
 * La tabella riproduce il markup delle pagine di elenco (StakeholderPage,
 * TeamPage, GrantsPage): se le schede funzionano qui funzionano lì.
 *
 * Non è compresa nella build di produzione: `vite.web.config.mjs` dichiara un
 * solo ingresso, `index.web.html`. Vive nel server di sviluppo, dove
 * `scripts/mobile-smoke.mjs` la interroga.
 */

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/librepm-shell.css";
import "./styles/mobile.css";
import "./styles/adf-theme.css";
import "./i18n";

import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import LeftNav from "./layout/LeftNav.jsx";
import TopHeader from "./layout/TopHeader.jsx";
import ResponsiveTables from "./components/ResponsiveTables.jsx";

const PAGES = [
    { id: "dashboard", label: "Cruscotto", icon: "bi-speedometer2" },
    { id: "inbox", label: "In arrivo", icon: "bi-inbox" },
    { id: "menu", label: "Progetti", icon: "bi-folder2-open" },
    { id: "grants", label: "Bandi", icon: "bi-megaphone" },
    { id: "team", label: "Gruppo", icon: "bi-people" },
    { id: "calendar", label: "Calendario", icon: "bi-calendar3" },
    { id: "planner", label: "Pianificatore", icon: "bi-card-checklist" },
    { id: "kanban", label: "Kanban", icon: "bi-kanban" },
    { id: "finance", label: "Contabilità", icon: "bi-calculator" },
    { id: "stakeholders", label: "Portatori di interesse", icon: "bi-diagram-3" },
    { id: "portfolio", label: "Portafoglio", icon: "bi-collection" },
    { id: "settings", label: "Impostazioni", icon: "bi-gear" },
];

// Righe verosimili, non "Progetto 1" ripetuto: una riga finta e regolare
// nasconde proprio i casi che rompono il layout, cioè i titoli lunghi e gli
// indirizzi di posta che non stanno in colonna.
const BANDI = [
    {
        id: 1,
        titolo: "Radici in Comune — rigenerazione di spazi di quartiere",
        ente: "Regione Campania",
        referente: "annunziata.espositoferraiuolo@example.it",
        scadenza: "14/03/2027",
        stato: "In preparazione",
        importo: "€ 48.500,00",
    },
    {
        id: 2,
        titolo: "Fondo per il contrasto alla povertà educativa minorile",
        ente: "Impresa sociale Con i Bambini",
        referente: "g.improta@example.it",
        scadenza: "02/11/2026",
        stato: "Presentato",
        importo: "€ 122.000,00",
    },
    {
        id: 3,
        titolo: "Bando volontariato 2027",
        ente: "CSV Napoli",
        referente: "luigia.delprete@example.it",
        scadenza: "30/09/2026",
        stato: "Da valutare",
        importo: "€ 9.800,00",
    },
];

// Il componente sta nel punto d'ingresso invece che in un file suo: è una
// pagina di prova sola, e separarla in due file per compiacere il ricaricamento
// a caldo — che qui non serve — sarebbe rumore.
// eslint-disable-next-line react-refresh/only-export-components
function Harness() {
    const [navOpen, setNavOpen] = useState(false);
    const [activeId, setActiveId] = useState("grants");
    const [rightPanelOpen, setRightPanelOpen] = useState(
        () => !window.matchMedia("(max-width: 991.98px)").matches
    );
    const [query, setQuery] = useState("");
    const contentRef = useRef(null);

    return (
        <div className="jl-root">
            <div className="jl-appframe">
                <div className="jl-shell">
                    <LeftNav
                        items={PAGES}
                        activeId={activeId}
                        onSelect={setActiveId}
                        open={navOpen}
                        onClose={() => setNavOpen(false)}
                    />

                    <main className="jl-main">
                        <TopHeader
                            title="Bandi"
                            navOpen={navOpen}
                            onMenuToggle={() => setNavOpen((open) => !open)}
                            actions={
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-light"
                                        onClick={() => setRightPanelOpen((v) => !v)}
                                    >
                                        Pannello
                                    </button>
                                    <button type="button" className="btn btn-sm btn-light" aria-label="Profilo">
                                        AF
                                    </button>
                                </>
                            }
                        />

                        <section className="jl-content" ref={contentRef}>
                            <div className="jl-page" id="main-content">
                                <div className="p-3">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <div>
                                            <h2 className="h4 mb-1">Bandi</h2>
                                            <p className="text-muted mb-0">Candidature e scadenze</p>
                                        </div>
                                        <button type="button" className="btn btn-primary">
                                            <i className="bi bi-plus-lg me-2"></i>
                                            Nuovo bando
                                        </button>
                                    </div>

                                    {/* La barra dei filtri esiste perché il campo
                                        di testo sia misurabile: sotto i 16px iOS
                                        ingrandisce la pagina al primo tocco, ed è
                                        un difetto che si vede solo provandolo. */}
                                    <div className="d-flex gap-2 mb-3">
                                        <input
                                            type="search"
                                            className="form-control form-control-sm"
                                            placeholder="Cerca fra i bandi…"
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                        />
                                        <select className="form-select form-select-sm" defaultValue="">
                                            <option value="">Tutti gli stati</option>
                                            <option value="prep">In preparazione</option>
                                            <option value="sent">Presentato</option>
                                        </select>
                                    </div>

                                    <div className="card">
                                        <div className="card-body p-0">
                                            <div className="table-responsive">
                                                <table className="table table-hover align-middle mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th>Titolo</th>
                                                            <th>Ente</th>
                                                            <th>Referente</th>
                                                            <th>Scadenza</th>
                                                            <th>Stato</th>
                                                            <th className="text-end">Importo</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {BANDI.map((bando) => (
                                                            <tr key={bando.id}>
                                                                <td className="fw-semibold">{bando.titolo}</td>
                                                                <td>{bando.ente}</td>
                                                                <td className="text-muted">{bando.referente}</td>
                                                                <td>{bando.scadenza}</td>
                                                                <td>
                                                                    <span className="badge bg-secondary">{bando.stato}</span>
                                                                </td>
                                                                <td className="text-end">{bando.importo}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <ResponsiveTables rootRef={contentRef} />

                            <div
                                className={"jl-rightpanel-backdrop " + (rightPanelOpen ? "show" : "")}
                                onClick={() => setRightPanelOpen(false)}
                                aria-hidden="true"
                            />

                            <aside className={"jl-rightpanel " + (rightPanelOpen ? "" : "closed")}>
                                <div className="d-flex flex-column gap-2">
                                    <div className="fw-bold">Pannello di contesto</div>
                                    <div className="jl-muted small">
                                        Le pagine possono personalizzare questo spazio.
                                    </div>
                                    <button type="button" className="btn btn-sm btn-light" onClick={() => setRightPanelOpen(false)}>
                                        Chiudi
                                    </button>
                                </div>
                            </aside>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    );
}

createRoot(document.getElementById("root")).render(<Harness />);
