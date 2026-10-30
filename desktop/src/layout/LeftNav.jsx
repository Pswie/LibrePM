import { useState, useMemo, useEffect, useRef } from "react";
import { BRAND_LOGO_URL, ORGANISATION_NAME, SECTION_NAME, SOURCE_CODE_URL } from '../branding';
import { useTranslation } from 'react-i18next';

/**
 * LeftNav - Barra di navigazione laterale
 *
 * Features:
 * - Navigazione tra pagine
 * - Icone Bootstrap Icons
 * - Indicatore pagina attiva
 * - Collapsibile
 *
 * Sopra i 992px è la colonna fissa di sempre, con il suo pulsante per
 * restringerla a sole icone. Sotto, esce dal flusso e diventa un cassetto che
 * scorre sopra il contenuto: 220px fissi su un telefono da 390 sono più di
 * metà schermo occupata da un menu, e le voci qui sono ventitré.
 *
 * Apertura e chiusura le governa `AppShell`, non questo componente: il pulsante
 * che apre sta nella barra in alto, e due stati separati per la stessa cosa si
 * disallineano al primo caso limite.
 *
 * @author Lorenzo DM
 * @since 0.2.0
 * @updated 0.8.5 - Sidebar collapsibile
 * @updated Angeli del Futuro - cassetto sotto i 992px
 *
 * @param {boolean}  props.open Cassetto aperto (ha effetto solo sotto i 992px).
 * @param {function} props.onClose Richiesta di chiusura (scelta, sfondo, Esc).
 */
export default function LeftNav({ items, activeId, onSelect, open = false, onClose }) {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);
    const panelRef = useRef(null);

    // Filtra items visibili (nasconde settings dalla nav principale)
    const visibleItems = useMemo(() => {
        return items.filter(item => item.id !== "settings");
    }, [items]);
    const groups = useMemo(() => {
        const definitions = [
            { label: t('Overview'), ids: ['dashboard', 'menu', 'portfolio'] },
            { label: t('Work'), ids: ['inbox', 'planner', 'kanban', 'calendar', 'notes', 'time-tracking'] },
            { label: t('Planning'), ids: ['charter', 'gantt', 'resources', 'analytics', 'change-control'] },
            { label: t('People'), ids: ['team', 'connections', 'stakeholders'] },
            { label: t('Funding'), ids: ['finance', 'grants'] },
            { label: t('Tools'), ids: ['templates', 'guides', 'integrations', 'sync-conflicts'] },
        ];
        const knownIds = new Set(definitions.flatMap(group => group.ids));
        return [...definitions.map(group => ({
            label: group.label,
            items: group.ids.map(id => visibleItems.find(item => item.id === id)).filter(Boolean)
        })), { label: t('Other'), items: visibleItems.filter(item => !knownIds.has(item.id)) }]
            .filter(group => group.items.length);
    }, [visibleItems, t]);

    // Esc chiude il cassetto: è la scorciatoia che si prova per prima quando un
    // pannello copre la pagina. AppShell usa Esc anche per il pannello destro,
    // ma là l'ascoltatore è sul window e questo si ferma prima solo se il
    // cassetto è aperto.
    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose?.();
            }
            if (event.key === 'Tab') {
                const controls = [...panelRef.current.querySelectorAll('button:not([disabled]), a[href]')]
                    .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    // Con il cassetto aperto la pagina sotto non deve scorrere: su iOS, senza
    // questo, il dito che scorre sul menu trascina il contenuto retrostante.
    useEffect(() => {
        if (!open) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [open]);

    // All'apertura il fuoco entra nel cassetto, altrimenti chi naviga da
    // tastiera continuerebbe a tabulare nella pagina che il menu sta coprendo.
    //
    // Il pannello deve essere visibile prima di spostare il focus.
    useEffect(() => {
        if (!open) return undefined;
        const previousFocus = document.activeElement;
        const panel = panelRef.current;
        const focusMenu = () => {
            // Force style resolution after .open changes before moving keyboard focus.
            if (getComputedStyle(panel).visibility === 'visible') {
                panel.querySelector('.jl-nav-link')?.focus({ preventScroll: true });
            }
        };
        focusMenu();
        const frame = requestAnimationFrame(focusMenu);
        return () => {
            cancelAnimationFrame(frame);
            if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        };
    }, [open]);

    const handleSelect = (id) => {
        onSelect(id);
        // Sul telefono il cassetto copre la pagina: lasciarlo aperto dopo la
        // scelta significa nascondere proprio ciò che si è appena aperto.
        onClose?.();
    };

    return (
        <>
            {/* Lo sfondo esiste solo da cassetto aperto: sopra i 992px il CSS lo
                tiene comunque fuori gioco. */}
            <div
                className={`jl-sidebar-backdrop ${open ? "show" : ""}`}
                onClick={onClose}
                aria-hidden="true"
            />

            <nav
                id="jl-primary-nav"
                ref={panelRef}
                className={`jl-sidebar ${collapsed ? "collapsed" : ""} ${open ? "open" : ""}`}
                aria-label={t("Navigation")}
                onTransitionEnd={(event) => {
                    if (open && event.target === event.currentTarget && event.propertyName === 'transform') {
                        panelRef.current?.querySelector('.jl-nav-link')?.focus({ preventScroll: true });
                    }
                }}
            >
            {/* Logo Header */}
            <div className="jl-sidebar-header">
                <div className="jl-logo">
                    <img
                        src={BRAND_LOGO_URL}
                        alt={ORGANISATION_NAME}
                        className="jl-logo-img"
                        style={{
                            width: collapsed ? "44px" : "56px",
                            height: collapsed ? "44px" : "56px",
                            backgroundColor: "#fff",
                            borderRadius: "10px",
                            padding: "4px",
                            objectFit: "contain",
                            flexShrink: 0
                        }}
                    />
                    {!collapsed && <span className="jl-logo-text"><strong>{ORGANISATION_NAME}</strong><small>{SECTION_NAME}</small></span>}
                </div>

                {/* Chiusura esplicita: sul telefono il gesto di trascinamento non
                    è ovvio e toccare fuori non lo scopre nessuno. */}
                <button
                    type="button"
                    className="jl-drawer-close"
                    onClick={onClose}
                    aria-label={t("Close")}
                >
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            {/* Navigation Items (scrollable) */}
            <div className="jl-nav-scroll">
                <ul className="jl-nav-list">
                    {groups.map((group) => <li className="jl-nav-group" key={group.label}>
                        {!collapsed && <p className="jl-nav-group-title">{group.label}</p>}
                        <ul className="jl-nav-list-group">
                        {group.items.map((item) => (
                        <li key={item.id} className="jl-nav-item">
                            <button
                                className={`jl-nav-link ${activeId === item.id ? "active" : ""}`}
                                onClick={() => handleSelect(item.id)}
                                title={collapsed ? item.label : undefined}
                                aria-current={activeId === item.id ? "page" : undefined}
                            >
                                <i className={`bi ${item.icon || "bi-circle"} jl-nav-icon`}></i>
                                {!collapsed && <span className="jl-nav-label">{item.label}</span>}
                            </button>
                        </li>
                        ))}
                        </ul>
                    </li>)}
                </ul>
            </div>

            {/* Footer / Collapse Toggle */}
            <div className="jl-sidebar-footer">
                <button
                    className="jl-collapse-btn"
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? t("More") : t("Less")}
                >
                    <i className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`}></i>
                </button>

                {!collapsed && (
                    <div className="jl-sidebar-branding">
                        <a href={SOURCE_CODE_URL} target="_blank" rel="noopener noreferrer">LibrePM · AGPLv3</a>
                    </div>
                )}
            </div>

            {/* Styles */}
            <style>{`
                .jl-sidebar {
                    display: flex;
                    flex-direction: column;
                    width: 248px;
                    min-width: 248px;
                    /* Il valore dentro var() è il ripiego, cioè il colore
                       storico: sul desktop --adf-rail-bg non è definita, vince
                       quello, e l'aspetto dell'applicazione Electron non cambia.
                       Sul web la definisce il tema (styles/adf-theme.css) e la
                       barra diventa verde bosco come nel sito. */
                    background: var(--adf-rail-bg, linear-gradient(180deg, #1a1a2e 0%, #16213e 100%));
                    color: var(--adf-rail-text-strong, white);
                    transition: width 0.2s ease, min-width 0.2s ease;
                }
                
                .jl-sidebar.collapsed {
                    width: 68px;
                    min-width: 68px;
                }
                
                .jl-sidebar-header {
                    padding: 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                
                .jl-logo {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                
                .jl-logo-text {
                    min-width: 0;
                    line-height: 1.35;
                    font-size: 0.88rem;
                    letter-spacing: -0.015em;
                }
                .jl-logo-text strong { display: block; font-weight: 700; }
                .jl-logo-text small { display: block; margin-top: 0.25rem; color: rgba(255,255,255,0.7); }
                .jl-nav-list-group { list-style: none; padding: 0; margin: 0; }
                .jl-nav-group + .jl-nav-group { margin-top: 0.75rem; }
                .jl-nav-group-title { margin: 0 0 0.25rem; padding: 0.5rem 1rem 0.25rem; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
                .jl-sidebar.collapsed .jl-nav-group + .jl-nav-group { margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px solid rgba(255,255,255,0.12); }
                .jl-sidebar-branding a { color: rgba(255,255,255,0.65); text-decoration: none; }
                .jl-sidebar-branding a:hover { color: #fff; text-decoration: underline; }
                
                .jl-nav-scroll {
                    flex: 1 1 0;
                    overflow-y: auto;
                    overflow-x: hidden;
                    min-height: 0;
                }

                .jl-nav-scroll::-webkit-scrollbar {
                    width: 4px;
                }

                .jl-nav-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }

                .jl-nav-scroll::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.15);
                    border-radius: 2px;
                }

                .jl-nav-scroll::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.3);
                }

                .jl-nav-list {
                    list-style: none;
                    padding: 0.5rem;
                    margin: 0;
                }
                
                .jl-nav-item {
                    margin-bottom: 0.25rem;
                }
                
                .jl-nav-link {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border: none;
                    border-radius: 8px;
                    background: transparent;
                    color: rgba(255,255,255,0.7);
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    text-align: left;
                }
                
                .jl-nav-link:hover {
                    background: rgba(255,255,255,0.1);
                    color: white;
                }
                
                .jl-nav-link.active {
                    background: var(--adf-rail-active-bg, rgba(79, 195, 247, 0.2));
                    color: var(--adf-rail-text-strong, #4fc3f7);
                    box-shadow: var(--adf-rail-active-bar, none);
                }
                
                .jl-nav-icon {
                    font-size: 1.1rem;
                    width: 20px;
                    text-align: center;
                }
                
                .jl-sidebar-footer {
                    padding: 0.75rem;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                
                .jl-collapse-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    padding: 0.5rem;
                    border: none;
                    border-radius: 6px;
                    background: rgba(255,255,255,0.05);
                    color: rgba(255,255,255,0.5);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                
                .jl-collapse-btn:hover {
                    background: rgba(255,255,255,0.1);
                    color: white;
                }
                
                .jl-sidebar-branding {
                    text-align: center;
                    margin-top: 0.5rem;
                    font-size: 0.75rem;
                }
                
                .jl-sidebar.collapsed .jl-nav-link {
                    justify-content: center;
                    padding: 0.75rem;
                }
                
                .jl-sidebar.collapsed .jl-sidebar-header {
                    padding: 1rem 0.5rem;
                }
                
                .jl-sidebar.collapsed .jl-logo {
                    justify-content: center;
                }

                /* Sopra i 992px il cassetto non esiste. */
                .jl-sidebar-backdrop,
                .jl-drawer-close {
                    display: none;
                }

                /* -----------------------------------------------------------
                   Sotto i 992px: cassetto sovrapposto
                   ----------------------------------------------------------- */
                @media (max-width: 991.98px) {
                    .jl-sidebar {
                        position: fixed;
                        top: 0;
                        left: 0;
                        bottom: 0;
                        /* Un margine di schermo sulla destra fa capire che sotto
                           c'è ancora la pagina, e dà dove toccare per chiudere. */
                        width: min(86vw, 300px);
                        min-width: 0;
                        max-width: 300px;
                        padding-left: env(safe-area-inset-left);
                        transform: translateX(-100%);
                        /* Nascondere davvero, non solo spostare: un pannello
                           fuori schermo ma visibile resta nell'ordine di
                           tabulazione e il fuoco ci finisce alla cieca. */
                        visibility: hidden;
                        box-shadow: 0 0 60px rgba(0, 0, 0, 0.35);
                        transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1),
                                    visibility 0s linear 0.28s;
                        z-index: 1045;
                    }

                    .jl-sidebar.open {
                        transform: translateX(0);
                        visibility: visible;
                        transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1),
                                    visibility 0s;
                    }

                    /* Restringere a icone è un'idea da schermo largo: qui il
                       cassetto o c'è o non c'è. */
                    .jl-sidebar.collapsed {
                        width: min(86vw, 300px);
                        min-width: 0;
                    }

                    .jl-sidebar .jl-collapse-btn {
                        display: none;
                    }

                    .jl-sidebar-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 0.5rem;
                        padding-top: max(1rem, env(safe-area-inset-top));
                    }

                    .jl-sidebar-footer {
                        padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
                    }

                    /* Ventitré voci: 44px l'una sono il minimo sotto cui il dito
                       manca il bersaglio (WCAG 2.2, 2.5.8). */
                    .jl-nav-link {
                        min-height: 48px;
                        padding: 0.85rem 1rem;
                        font-size: 1rem;
                    }

                    .jl-nav-icon {
                        font-size: 1.25rem;
                    }

                    .jl-drawer-close {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                        width: 44px;
                        height: 44px;
                        border: 0;
                        border-radius: 8px;
                        background: rgba(255, 255, 255, 0.08);
                        color: var(--adf-rail-text-strong, #fff);
                        font-size: 1.1rem;
                        cursor: pointer;
                    }

                    .jl-sidebar-backdrop {
                        display: block;
                        position: fixed;
                        inset: 0;
                        background: rgba(10, 16, 12, 0.5);
                        opacity: 0;
                        visibility: hidden;
                        transition: opacity 0.28s ease, visibility 0s linear 0.28s;
                        z-index: 1040;
                    }

                    .jl-sidebar-backdrop.show {
                        opacity: 1;
                        visibility: visible;
                        transition: opacity 0.28s ease, visibility 0s;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .jl-sidebar,
                    .jl-sidebar-backdrop {
                        transition: none;
                    }
                }
            `}</style>
            </nav>
        </>
    );
}
