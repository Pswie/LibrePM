import { useState, useEffect, useRef, useCallback } from "react";
import { librepm } from "@api/librepm.js";
import { useTranslation } from 'react-i18next';

/**
 * CommandPalette - Global command bar (Ctrl+K)
 *
 * Features:
 * - Quick navigation
 * - Task search
 * - Quick creation
 *
 * @author Lorenzo DM
 * @since 0.4.5
 */
export default function CommandPalette({ shell }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [results, setResults] = useState([]);
    const inputRef = useRef(null);
    const permitted = (item) => !item.page || (shell.canNavigate?.(item.page, item.write ? 'write' : 'read') ?? true);

    // Toggle with Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    // Focus input on open
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setQuery("");
            setSelectedIndex(0);
        }
    }, [isOpen]);

    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimerRef = useRef(null);

    // Search logic
    useEffect(() => {
        if (!query) {
            // Default: Navigation
            setResults([
                { type: "nav", page: "dashboard", label: t("Go to Dashboard"), icon: "bi-speedometer2", action: () => shell.navigate("dashboard") },
                { type: "nav", page: "menu", label: t("Go to Projects"), icon: "bi-folder2-open", action: () => shell.navigate("menu") },
                { type: "nav", page: "planner", label: t("Go to Planner"), icon: "bi-table", action: () => shell.navigate("planner") },
                { type: "nav", page: "kanban", label: t("Go to Kanban"), icon: "bi-kanban", action: () => shell.navigate("kanban") },
                { type: "nav", page: "calendar", label: t("Go to Calendar"), icon: "bi-calendar3", action: () => shell.navigate("calendar") },
                { type: "nav", page: "notes", label: t("Go to Notes"), icon: "bi-journal-text", action: () => shell.navigate("notes") },
                { type: "nav", page: "settings", label: t("Go to Settings"), icon: "bi-gear", action: () => shell.navigate("settings") },
                {
                    type: "action",
                    page: "menu", write: true,
                    label: t("New Project"),
                    icon: "bi-plus-circle",
                    action: () => shell.navigate("menu", null, "openNewProjectModal")
                },
            ].filter(permitted));
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = [];

        // 1. Navigation commands
        const navs = [
            { type: "nav", page: "dashboard", label: t("Go to Dashboard"), icon: "bi-speedometer2", action: () => shell.navigate("dashboard") },
            { type: "nav", page: "planner", label: t("Go to Planner"), icon: "bi-table", action: () => shell.navigate("planner") },
            { type: "nav", page: "kanban", label: t("Go to Kanban"), icon: "bi-kanban", action: () => shell.navigate("kanban") },
            { type: "nav", page: "notes", label: t("Go to Notes"), icon: "bi-journal-text", action: () => shell.navigate("notes") },
        ];
        filtered.push(...navs.filter(n => permitted(n) && n.label.toLowerCase().includes(lowerQuery)));
        setResults(filtered);
        setSelectedIndex(0);

        // 2. Debounced full-text search (PRD-02-FR-004)
        if (query.length >= 2 && (shell.canRead?.('notes') ?? true) && (shell.canRead?.('planner') ?? true)) {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
            searchTimerRef.current = setTimeout(async () => {
                try {
                    setSearchLoading(true);
                    const data = await librepm.globalSearch(query, null, null, 10);
                    const ftsResults = [];

                    // Notes results
                    if (data.notes) {
                        data.notes.forEach(n => {
                            ftsResults.push({
                                type: "note",
                                label: n.title || t("Untitled"),
                                sublabel: n.noteType ? t(`noteType.${n.noteType}`) : "",
                                icon: "bi-journal-text",
                                action: () => shell.navigate("notes", { noteId: n.id })
                            });
                        });
                    }

                    // Tasks results
                    if (data.tasks) {
                        data.tasks.forEach(task => {
                            ftsResults.push({
                                type: "task",
                                label: task.title || t("Untitled"),
                                sublabel: task.status || "",
                                icon: "bi-check2-square",
                                action: () => shell.navigate("planner", { taskId: task.id })
                            });
                        });
                    }

                    setResults(prev => {
                        // Keep nav results, add FTS results
                        const navOnly = prev.filter(r => r.type === "nav");
                        return [...navOnly, ...ftsResults];
                    });
                } catch (e) {
                    console.error("Search error:", e);
                } finally {
                    setSearchLoading(false);
                }
            }, 300);
        }

        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [query, shell, t]);

    // Keyboard navigation in the list
    const handleInputKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % results.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[selectedIndex]) {
                results[selectedIndex].action();
                setIsOpen(false);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="cmd-overlay" onClick={() => setIsOpen(false)}>
            <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
                <div className="cmd-header">
                    <i className="bi bi-search text-muted me-2"></i>
                    <input
                        ref={inputRef}
                        type="text"
                        className="cmd-input"
                        placeholder={t("Search or type a command...")}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                    />
                    <span className="badge bg-light text-muted border">ESC</span>
                </div>
                <div className="cmd-body">
                    {results.length === 0 ? (
                        <div className="p-3 text-center text-muted small">{t("No results")}</div>
                    ) : (
                        <ul className="list-group list-group-flush">
                            {results.map((item, index) => {
                                // Group headers
                                const prevType = index > 0 ? results[index - 1].type : null;
                                const showHeader = item.type !== prevType && (item.type === "note" || item.type === "task");
                                return (
                                    <li key={index} className="list-group-item p-0 border-0" style={{background: "transparent"}}>
                                        {showHeader && (
                                            <div className="px-3 py-1 small fw-bold text-muted text-uppercase" style={{fontSize: '0.7rem', letterSpacing: '0.05em'}}>
                                                {item.type === "note" ? t("Notes") : t("Tasks")}
                                            </div>
                                        )}
                                        <div
                                            className={`list-group-item list-group-item-action d-flex align-items-center ${index === selectedIndex ? "active" : ""}`}
                                            onClick={() => { item.action(); setIsOpen(false); }}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            style={{ cursor: "pointer" }}
                                        >
                                            <i className={`bi ${item.icon} me-3`}></i>
                                            <div className="d-flex flex-column flex-grow-1">
                                                <span>{item.label}</span>
                                                {item.sublabel && <small className="text-muted" style={{fontSize: '0.75rem'}}>{item.sublabel}</small>}
                                            </div>
                                            {item.type === "nav" && <span className="ms-auto small text-muted">{t("Go")}</span>}
                                        </div>
                                    </li>
                                );
                            })}
                            {searchLoading && (
                                <li className="list-group-item text-center py-2">
                                    <div className="spinner-border spinner-border-sm text-primary"></div>
                                </li>
                            )}
                        </ul>
                    )}
                </div>
            </div>
            <style>{`
                .cmd-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 9999;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    padding-top: 15vh;
                    backdrop-filter: blur(2px);
                }
                .cmd-modal {
                    width: 600px;
                    max-width: 90%;
                    background: var(--jl-bg-card, white);
                    border-radius: 12px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                    overflow: hidden;
                    border: 1px solid var(--jl-border-color, #e9ecef);
                    color: var(--jl-text-primary, #212529);
                }
                .cmd-header {
                    padding: 16px;
                    border-bottom: 1px solid var(--jl-border-color, #e9ecef);
                    display: flex;
                    align-items: center;
                }
                .cmd-input {
                    border: none;
                    outline: none;
                    font-size: 1.1rem;
                    flex-grow: 1;
                    background: transparent;
                    color: var(--jl-text-primary, #212529);
                }
                .cmd-body {
                    max-height: 400px;
                    overflow-y: auto;
                }
                .list-group-item {
                    background-color: var(--jl-bg-card, white);
                    color: var(--jl-text-primary, #212529);
                    border-color: var(--jl-border-color, #e9ecef);
                }
                .list-group-item.active {
                    background-color: var(--jl-primary, var(--adf-accent, #0d6efd));
                    color: white;
                    border-color: var(--jl-primary, var(--adf-accent, #0d6efd));
                }
                .list-group-item.active .text-muted {
                    color: rgba(255,255,255,0.8) !important;
                }
                
                /* Dark mode specific overrides */
                [data-theme="dark"] .cmd-modal {
                    background-color: #252525;
                    border-color: #333;
                }
                [data-theme="dark"] .list-group-item {
                    background-color: #252525;
                    color: #fff;
                    border-color: #333;
                }
                [data-theme="dark"] .list-group-item:hover {
                    background-color: #333;
                }
                [data-theme="dark"] .badge.bg-light {
                    background-color: #333 !important;
                    color: #ccc !important;
                    border-color: #444 !important;
                }
            `}</style>
        </div>
    );
}
