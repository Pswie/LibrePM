import { useState, useMemo } from "react";
import Logo from "../assets/Logo.svg";
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
 * @author Lorenzo DM
 * @since 0.2.0
 * @updated 0.8.5 - Sidebar collapsibile
 */
export default function LeftNav({ items, activeId, onSelect }) {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);

    // Filtra items visibili (nasconde settings dalla nav principale)
    const visibleItems = useMemo(() => {
        return items.filter(item => item.id !== "settings");
    }, [items]);

    return (
        <nav className={`jl-sidebar ${collapsed ? "collapsed" : ""}`}>
            {/* Logo Header */}
            <div className="jl-sidebar-header">
                <div className="jl-logo">
                    <img
                        src={Logo}
                        alt="LibrePM Logo"
                        className="jl-logo-img"
                        style={{
                            width: collapsed ? "32px" : "40px",
                            height: collapsed ? "32px" : "40px",
                            borderRadius: "8px", // Smussamento angoli
                            transition: "all 0.2s ease"
                        }}
                    />
                    {!collapsed && <span className="jl-logo-text">LibrePM</span>}
                </div>
            </div>

            {/* Navigation Items (scrollable) */}
            <div className="jl-nav-scroll">
                <ul className="jl-nav-list">
                    {visibleItems.map((item) => (
                        <li key={item.id} className="jl-nav-item">
                            <button
                                className={`jl-nav-link ${activeId === item.id ? "active" : ""}`}
                                onClick={() => onSelect(item.id)}
                                title={collapsed ? item.label : undefined}
                            >
                                <i className={`bi ${item.icon || "bi-circle"} jl-nav-icon`}></i>
                                {!collapsed && <span className="jl-nav-label">{item.label}</span>}
                            </button>
                        </li>
                    ))}
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
                        <small className="text-muted">LibrePM • UI Shell</small>
                    </div>
                )}
            </div>

            {/* Styles */}
            <style>{`
                .jl-sidebar {
                    display: flex;
                    flex-direction: column;
                    width: 220px;
                    min-width: 220px;
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
                    width: 60px;
                    min-width: 60px;
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
                    font-weight: 600;
                    font-size: 1.1rem;
                    letter-spacing: 0.5px;
                }
                
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
            `}</style>
        </nav>
    );
}
