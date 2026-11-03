import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { librepm } from "@api/librepm.js";
import { canUseModule, canUsePage, needsProjectContext } from '../suite-access.js';

/**
 * Tema iniziale dell'applicazione.
 *
 * Il desktop nasce scuro e resta scuro: la variabile non è definita là. La build
 * web la imposta a "light" (vite.web.config.mjs), perché nella sezione bandi il
 * contenuto deve stare su carta chiara come nell'area amministrativa del sito,
 * con l'unico elemento scuro nel binario laterale.
 *
 * Non è solo una questione estetica: `loadTheme()` legge il tema salvato da
 * /api/settings, che nel profilo cloud è riservato al presidente. Per tutti gli
 * altri ruoli quella chiamata risponde 403 e si finisce nel ramo di ripiego,
 * quindi il valore iniziale è anche quello definitivo.
 */
const DEFAULT_THEME = import.meta.env?.VITE_DEFAULT_THEME || "dark";
import { toast } from "react-toastify";
import { useTranslation } from 'react-i18next';
import { useModal } from "../hooks/useModal.js";

// Layout components
import LeftNav from "./LeftNav.jsx";
import TopHeader from "./TopHeader.jsx";
import ProfileMenu from "./ProfileMenu.jsx";
import CommandPalette from "../components/CommandPalette.jsx";
import NotificationBell from "../components/NotificationBell.jsx";
import PortalModal from "../components/PortalModal.jsx";
import ResponsiveTables from "../components/ResponsiveTables.jsx";
import ProjectContextBar from '../components/ProjectContextBar.jsx';
import PageErrorBoundary from '../components/PageErrorBoundary.jsx';
import { BRAND_LOGO_URL, ORGANISATION_NAME, SECTION_NAME, SOURCE_CODE_URL, UPSTREAM_URL } from '../branding';

// Pages
import MenuPage from "../pages/MenuPage.jsx";
import CalendarPage from "../pages/CalendarPage.jsx";
import PlannerPage from "../pages/PlannerPage.jsx";
import KanbanPage from "../pages/KanbanPage.jsx";
import NotesPage from "../pages/NotesPage.jsx";
import SettingsPage from "../pages/SettingsPage.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import AnalyticsPage from "../pages/AnalyticsPage.jsx";
import TeamPage from "../pages/TeamPage.jsx";
import ResourcePage from "../pages/ResourcePage.jsx";
import ConnectionsPage from "../pages/ConnectionsPage.jsx";
import GanttPage from "../pages/GanttPage.jsx";
import ChartPage from "../pages/ChartPage.jsx";
import TemplatesPage from "../pages/TemplatesPage.jsx";
import IntegrationsPage from "../pages/IntegrationsPage.jsx";
import { initialSuiteProject } from "../utils/suiteProjects.js";
import GuidesPage from "../pages/GuidesPage.jsx";
import InboxPage from "../pages/InboxPage.jsx";
import TimeTrackingPage from "../pages/TimeTrackingPage.jsx";
import ConflictReviewPage from "../pages/ConflictReviewPage.jsx";
import FinancePage from "../pages/FinancePage.jsx";
import GrantsPage from "../pages/GrantsPage.jsx";
import StakeholderPage from "../pages/StakeholderPage.jsx";
import ChangeControlPage from "../pages/ChangeControlPage.jsx";
import PortfolioPage from "../pages/PortfolioPage.jsx";

function AboutLibrePMModal({ onClose, t }) {
    return (
        <PortalModal className="modal-dialog-centered modal-md" onClick={onClose}>
            <div className="modal-header border-0 pb-0">
                <div>
                    <h5 className="modal-title d-flex align-items-center gap-2 mb-1">
                        <img src={BRAND_LOGO_URL} alt="" width={56} height={56} style={{ objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 4 }} />
                        {SECTION_NAME}
                    </h5>
                    <div className="text-muted small">{ORGANISATION_NAME}</div>
                </div>
                <button type="button" className="btn-close" aria-label={t("Close")} onClick={onClose}></button>
            </div>
            <div className="modal-body pt-3">
                <div className="border rounded-2 p-3 mb-3">
                    <div className="d-flex justify-content-between gap-3 mb-2">
                        <span className="text-muted">{t("Version")}</span>
                        <span className="fw-semibold">LibrePM v{__APP_VERSION__}</span>
                    </div>
                    <div className="d-flex justify-content-between gap-3 mb-2">
                        <span className="text-muted">{t("Software")}</span>
                        <a href={UPSTREAM_URL} target="_blank" rel="noopener noreferrer">LibrePM</a>
                    </div>
                    <div className="d-flex justify-content-between gap-3 mb-2">
                        <span className="text-muted">{t("Copyright")}</span>
                        <span className="text-end">© Lorenzo DM 2026 - All Rights Reserved</span>
                    </div>
                    <div className="d-flex justify-content-between gap-3">
                        <span className="text-muted">{t("License")}</span>
                        <span className="text-end">Distributed under the LICENSE AGPLv3</span>
                    </div>
                </div>
                <a
                    className="btn btn-outline-primary w-100"
                    href={SOURCE_CODE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <i className="bi bi-code-slash me-2"></i>
                    {t("Source code")}
                </a>
            </div>
        </PortalModal>
    );
}

// Context
import { WorkflowProvider } from "../context/WorkflowContext.jsx";

// Assets

/**
 * AppShell - Main Layout Component for LibrePM.
 *
 * Provides the structural skeleton for the authenticated application:
 * - Sidebar Navigation (LeftNav)
 * - Top Header with dynamic title and actions
 * - Collapsible Right Panel for context details
 * - Main Content Area for pages
 * - Global features like Command Palette and Notifications
 *
 * It also manages global state like the current project, theme, and user session.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.initialUser - The currently logged-in user.
 * @param {Function} props.onLogout - Callback function to handle logout.
 *
 * @author Lorenzo DM
 * @since 0.2.0
 * @updated 0.10.0 - Added Integrations Page
 */
export default function AppShell({ initialUser, onLogout }) {
    const { t } = useTranslation();
    const modal = useModal();

    // ========================================
    // State - Backend Data
    // ========================================

    const [currentUser, setCurrentUser] = useState(initialUser);
    const [currentProject, setCurrentProject] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [workspaceModules, setWorkspaceModules] = useState({});
    useEffect(() => {
        setCurrentUser(initialUser);
        setCurrentProject(null);
        setProjects([]);
        setLoading(true);
        librepm.setCurrentProject(null);
    }, [initialUser]);

    // ========================================
    // State - Pages and Navigation
    // ========================================

    const PAGES = useMemo(() => [
        { id: "dashboard", label: t("Dashboard"), icon: "bi-speedometer2", component: Dashboard },
        { id: "inbox", label: t("Inbox"), icon: "bi-inbox", component: InboxPage },
        { id: "charter", label: t("Charter"), icon: "bi-file-earmark-text", component: ChartPage },
        { id: "menu", label: t("Projects"), icon: "bi-folder2-open", component: MenuPage },
        { id: "templates", label: t("Gallery"), icon: "bi-grid-3x3-gap", component: TemplatesPage },
        { id: "team", label: t("Team"), icon: "bi-people", component: TeamPage },
        { id: "resources", label: t("Resources"), icon: "bi-bar-chart-steps", component: ResourcePage, module: "planning" },
        { id: "connections", label: t("Contacts"), icon: "bi-person-lines-fill", component: ConnectionsPage },
        { id: "calendar", label: t("Calendar"), icon: "bi-calendar3", component: CalendarPage },
        { id: "planner", label: t("Planner"), icon: "bi-card-checklist", component: PlannerPage },
        { id: "gantt", label: t("Gantt"), icon: "bi-bar-chart-steps", component: GanttPage, module: "planning" },
        { id: "kanban", label: t("Kanban"), icon: "bi-kanban", component: KanbanPage },
        { id: "notes", label: t("Notes"), icon: "bi-journal-text", component: NotesPage },
        { id: "time-tracking", label: t("Time Tracking"), icon: "bi-clock", component: TimeTrackingPage },
        { id: "finance", label: t("Finance"), icon: "bi-calculator", component: FinancePage },
        { id: "grants", label: t("Grants"), icon: "bi-megaphone", component: GrantsPage },
        { id: "stakeholders", label: t("Stakeholders"), icon: "bi-diagram-3", component: StakeholderPage },
        { id: "change-control", label: t("Change Control"), icon: "bi-signpost-split", component: ChangeControlPage },
        { id: "portfolio", label: t("Portfolio"), icon: "bi-collection", component: PortfolioPage },
        { id: "guides", label: t("Guides"), icon: "bi-book", component: GuidesPage },
        { id: "analytics", label: t("Analytics"), icon: "bi-graph-up", component: AnalyticsPage },
        { id: "integrations", label: t("Integrations"), icon: "bi-plug", component: IntegrationsPage },
        { id: "sync-conflicts", label: t("Sync Conflicts"), icon: "bi-arrow-left-right", component: ConflictReviewPage },
        { id: "settings", label: t("Settings"), icon: "bi-gear", component: SettingsPage },
    ], [t]);

    const [activeId, setActiveId] = useState(() => {
        try { return localStorage.getItem('librepm_lastPage') || 'dashboard'; } catch { return 'dashboard'; }
    });
    const [navContext, setNavContext] = useState(null);
    const [navAction, setNavAction] = useState(null);

    // Filter pages based on workspace profile modules
    const filteredPages = useMemo(() => {
        if (loading) return []; // Return empty array while loading
        const hasModuleConfig = Object.keys(workspaceModules).length > 0;
        return PAGES.filter(p => canUsePage(currentUser, p.id) && (!hasModuleConfig || !p.module || workspaceModules[p.module] !== false));
    }, [PAGES, workspaceModules, loading, currentUser]);

    const activePage = useMemo(() => filteredPages.find((p) => p.id === activeId) ?? filteredPages[0], [filteredPages, activeId]);
    useEffect(() => {
        if (!loading && filteredPages.length && !filteredPages.some(page => page.id === activeId)) {
            setActiveId(filteredPages[0].id);
            setNavContext(null);
            setNavAction(null);
        }
    }, [loading, filteredPages, activeId]);

    // ========================================
    // State - UI Components
    // ========================================

    const [title, setTitle] = useState(activePage?.label || "Loading...");
    const [headerActions, setHeaderActions] = useState(null);
    const [rightPanel, setRightPanel] = useState(null);

    /**
     * Pannello di contesto aperto.
     *
     * Su schermo largo è una colonna accanto al contenuto e conviene averla
     * subito: è lo stato storico. Sotto i 992px diventa un cassetto sovrapposto
     * (styles/mobile.css) e partire aperto significherebbe presentare
     * l'applicazione con un pannello informativo che copre la pagina prima
     * ancora che si sia visto di che pagina si tratta.
     *
     * `matchMedia` e non un controllo sulla larghezza: è la stessa soglia del
     * foglio di stile, scritta una volta e senza il rischio che le due si
     * separino.
     */
    const [rightPanelOpen, setRightPanelOpen] = useState(
        () => typeof window === "undefined"
            || typeof window.matchMedia !== "function"
            || !window.matchMedia("(max-width: 991.98px)").matches
    );

    // Sotto i 992px il binario di navigazione è un cassetto sovrapposto. Lo
    // stato sta qui e non dentro LeftNav perché il pulsante che lo apre vive
    // nella barra in alto: due componenti sullo stesso interruttore.
    const [navOpen, setNavOpen] = useState(false);

    // Sorvegliato da ResponsiveTables per etichettare le celle delle tabelle.
    const contentRef = useRef(null);

    // ========================================
    // State - Theme
    // ========================================

    const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);

    // ========================================
    // State - Profile Menu
    // ========================================

    const [profileItems, setProfileItems] = useState([]);

    // Update profile items when language changes
    useEffect(() => {
        setProfileItems([
            {
                id: "settings",
                label: t("Settings"),
                icon: "bi-gear",
                onClick: () => setActiveId("settings"),
            },
            {
                id: "about",
                label: t("About the application"),
                icon: "bi-info-circle",
                onClick: () => {
                    modal.showModal(AboutLibrePMModal, {
                        t,
                        onClose: modal.hideModal,
                    });
                },
            },
            { type: "sep" },
            {
                id: "openData",
                label: t("Open Data Folder"),
                icon: "bi-folder2-open",
                onClick: async () => {
                    const path = await librepm.getLocalDataPath();
                    if (path) {
                        toast.info(`${t("Data folder")}: ${path}`);
                    } else {
                        toast.warning(t("Data path not available"));
                    }
                },
            },
            {
                id: "export",
                label: t("Export Database"),
                icon: "bi-box-arrow-up",
                onClick: async () => {
                    try {
                        if (librepm.isElectron()) {
                            await librepm.exportJsonDialog();
                        } else {
                            const blob = await librepm.exportDatabase();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `librepm-backup-${new Date().toISOString().split('T')[0]}.zip`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }
                    } catch (e) {
                        console.error('Export error:', e);
                        toast.error(t("Export error") + ': ' + e.message);
                    }
                },
            },
            { type: "sep" },
            {
                id: "switchProfile",
                label: t("Change Profile"),
                icon: "bi-person-badge",
                onClick: async () => {
                    if (onLogout) {
                        const confirmed = await modal.confirm({
                            title: t("Change Profile"),
                            message: t("Change profile? You will return to the selection screen.")
                        });
                        if (confirmed) {
                            onLogout();
                        }
                    }
                },
            },
            {
                id: "logout",
                label: t("Exit"),
                icon: "bi-box-arrow-right",
                danger: true,
                onClick: async () => {
                    if (onLogout) {
                        const confirmed = await modal.confirm({
                            title: t("Exit"),
                            message: t("Exit? Autologin will be disabled.")
                        });
                        if (confirmed) {
                            onLogout();
                        }
                    }
                },
            },
        ].filter(item => item.id !== 'settings' || canUsePage(currentUser, 'settings'))
          .filter(item => !currentUser?.access || !['openData', 'export', 'switchProfile'].includes(item.id)));

    }, [t, onLogout, currentUser]);

    // ========================================
    // Effect - Lock session shortcut (Ctrl+L)
    // ========================================

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl+L — Lock session
            if ((e.ctrlKey || e.metaKey) && e.key === "l") {
                e.preventDefault();
                if (onLogout) onLogout();
            }
            // Ctrl+N — New task (navigate to planner)
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "n") {
                e.preventDefault();
                setActiveId("planner");
                setNavAction("newTask");
            }
            // Ctrl+Shift+N — New note
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "N") {
                e.preventDefault();
                setActiveId("notes");
                setNavAction("newNote");
            }
            // Esc — Close modals/panels
            if (e.key === "Escape") {
                if (rightPanelOpen) {
                    setRightPanelOpen(false);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onLogout, rightPanelOpen]);

    // ========================================
    // Effect - Load theme from settings
    // ========================================

    useEffect(() => {
        async function loadTheme() {
            try {
                const settings = await librepm.settingsGet();
                if (settings?.theme) {
                    setCurrentTheme(settings.theme);
                }
            } catch (e) {
                console.warn("[AppShell] Impossibile caricare tema, uso default:", e.message);
                setCurrentTheme(DEFAULT_THEME);
            }
        }

        if (currentUser && canUseModule(currentUser, 'settings')) {
            loadTheme();
        }
    }, [currentUser]);

    // ========================================
    // Effect - Apply theme to DOM
    // ========================================

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', currentTheme);
        document.body.setAttribute('data-theme', currentTheme);

        if (currentTheme === 'dark') {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-bs-theme');
        }
    }, [currentTheme]);

    // ========================================
    // Initialization - Load projects
    // ========================================

    useEffect(() => {
        let current = true;
        async function loadData() {
            try {
                setLoading(true);
                setError(null);

                const projectsList = canUseModule(currentUser, 'projects') ? await librepm.projectsList() : needsProjectContext(currentUser) ? await librepm.projectContext() : [];
                if (!current) return;
                setProjects(projectsList);

                const selectedProject = canUseModule(currentUser, 'integrations') && canUseModule(currentUser, 'projects') ? await initialSuiteProject({
                    search: window.location.search,
                    projects: projectsList,
                    loadContext: librepm.suiteProject,
                    loadSelection: librepm.suiteSelection,
                    loadProject: librepm.projectsGet,
                }) : projectsList[0] ?? null;
                if (!current) return;
                setCurrentProject(selectedProject);
                librepm.setCurrentProject(selectedProject?.id);
                if (canUsePage(currentUser, 'integrations') && new URLSearchParams(window.location.search).has('suiteProject')) setActiveId('integrations');

                // Load workspace profile modules
                try {
                    if (currentUser.access && !currentUser.access.owner) { setWorkspaceModules({}); setLoading(false); return; }
                    const profileId = currentUser.workspaceProfileId || 'wp-personal';
                    const profile = await librepm.workspaceProfileGet(profileId);
                    if (!current) return;
                    if (profile?.modulesJson) {
                        const modules = typeof profile.modulesJson === 'string'
                            ? JSON.parse(profile.modulesJson)
                            : profile.modulesJson;
                        setWorkspaceModules(modules);
                    }
                } catch (wpErr) {
                    console.warn('[AppShell] Could not load workspace profile, all modules enabled:', wpErr.message);
                    setWorkspaceModules({});
                }

                setLoading(false);
            } catch (e) {
                if (!current) return;
                console.error('[AppShell] Errore caricamento dati:', e);
                setError(e.message);
                setLoading(false);
            }
        }

        if (currentUser) {
            loadData();
        }
        return () => { current = false; };
    }, [currentUser]);

    // ========================================
    // Shell API exposed to pages (stable refs)
    // ========================================

    // Keep stable refs for functions to avoid shell object recreation
    const setTitleRef = useRef(setTitle);
    const setHeaderActionsRef = useRef(setHeaderActions);
    const setRightPanelRef = useRef(setRightPanel);
    const setRightPanelOpenRef = useRef(setRightPanelOpen);
    const setProfileItemsRef = useRef(setProfileItems);

    // Update refs on each render (cheap, no re-render triggered)
    setTitleRef.current = setTitle;
    setHeaderActionsRef.current = setHeaderActions;
    setRightPanelRef.current = setRightPanel;
    setRightPanelOpenRef.current = setRightPanelOpen;
    setProfileItemsRef.current = setProfileItems;

    const navigateFn = useCallback((pageId, context = null, action = null) => {
        if (!canUsePage(currentUser, pageId) || !filteredPages.some(page => page.id === pageId)) return;
        if (action && !canUsePage(currentUser, pageId, 'write')) return;
        setActiveId(pageId);
        setNavContext(context);
        setNavAction(action);
    }, [currentUser, filteredPages]);

    const clearNavActionFn = useCallback(() => setNavAction(null), []);

    const setCurrentProjectFn = useCallback((project) => {
        setCurrentProject(project);
        librepm.setCurrentProject(project?.id);
    }, []);

    const refreshProjectsFn = useCallback(async () => {
        if (!canUseModule(currentUser, 'projects')) return needsProjectContext(currentUser) ? librepm.projectContext() : [];
        const projectsList = await librepm.projectsList();
        setProjects(projectsList);
        return projectsList;
    }, [currentUser]);

    const createProjectFn = useCallback(async (name, description) => {
        if (!canUseModule(currentUser, 'projects', 'write')) throw new Error('Non hai il permesso di creare progetti.');
        const newProject = await librepm.projectsCreate(name, description);
        const projectsList = await librepm.projectsList();
        setProjects(projectsList);
        setCurrentProject(newProject);
        librepm.setCurrentProject(newProject.id);
        return newProject;
    }, [currentUser]);

    const deleteProjectFn = useCallback(async (projectId) => {
        if (!canUseModule(currentUser, 'projects', 'write')) throw new Error('Non hai il permesso di modificare progetti.');
        await librepm.projectsDelete(projectId);
        const remaining = await librepm.projectsList();
        setProjects(remaining);
        setCurrentProject(prev => {
            if (prev?.id === projectId) {
                const newCurrent = remaining.length > 0 ? remaining[0] : null;
                librepm.setCurrentProject(newCurrent?.id);
                return newCurrent;
            }
            return prev;
        });
    }, [currentUser]);

    const shell = useMemo(() => ({
        // UI Controls (stable via ref wrappers)
        setTitle: (...args) => setTitleRef.current(...args),
        setHeaderActions: (...args) => setHeaderActionsRef.current(...args),
        setRightPanel: (...args) => setRightPanelRef.current(...args),
        setRightPanelOpen: (...args) => setRightPanelOpenRef.current(...args),
        setProfileMenuItems: (...args) => setProfileItemsRef.current(...args),
        navigate: navigateFn,
        canNavigate: (id, action = 'read') => canUsePage(currentUser, id, action),
        canRead: (module) => canUseModule(currentUser, module),
        canWrite: (module) => canUseModule(currentUser, module, 'write'),
        clearNavAction: clearNavActionFn,

        // Reactive data (these change, triggering shell recreation only when needed)
        navContext,
        navAction,
        currentTheme,
        setTheme: setCurrentTheme,
        currentUser,
        currentProject,
        projects,

        // Workspace profile
        workspaceModules,
        setWorkspaceModules,

        // Stable action callbacks
        setCurrentProject: setCurrentProjectFn,
        refreshProjects: refreshProjectsFn,
        createProject: createProjectFn,
        deleteProject: deleteProjectFn,
        logout: onLogout,
    }), [currentUser, currentProject, projects, currentTheme, onLogout, navContext, navAction, workspaceModules,
         navigateFn, clearNavActionFn, setCurrentProjectFn, refreshProjectsFn, createProjectFn, deleteProjectFn]);

    // ========================================
    // Effect - Reset slots on page change ONLY
    // ========================================

    useEffect(() => {
        if (activePage) {
            setTitle(activePage.label);
        }
        setRightPanel(null);
        try { localStorage.setItem('librepm_lastPage', activeId); } catch { /* ignore */ }
    }, [activeId, activePage]);

    // ========================================
    // Effect - Chiudi il cassetto cambiando pagina
    // ========================================

    // Il cassetto copre la pagina: lasciarlo aperto passando da una voce
    // all'altra nasconderebbe proprio la schermata appena scelta.
    useEffect(() => {
        setNavOpen(false);
    }, [activeId]);

    // ========================================
    // Render - Loading State
    // ========================================

    if (loading || !activePage) {
        return (
            <div className={`jl-root ${currentTheme === 'dark' ? 'dark-theme' : ''}`}>
                <div className="jl-loading d-flex flex-column align-items-center justify-content-center vh-100">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">{t("Loading...")}</span>
                    </div>
                    <h5 className="text-muted">{t("Loading projects...")}</h5>
                    <p className="small text-muted">
                        {currentUser?.displayName || currentUser?.username || t("User")}
                    </p>
                </div>
            </div>
        );
    }

    // ========================================
    // Render - Error State
    // ========================================

    if (error) {
        return (
            <div className={`jl-root ${currentTheme === 'dark' ? 'dark-theme' : ''}`}>
                <div className="jl-error d-flex flex-column align-items-center justify-content-center vh-100">
                    <div className="alert alert-danger text-center" style={{ maxWidth: 500 }}>
                        <h5 className="alert-heading">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            {t("Loading Error")}
                        </h5>
                        <p className="mb-2">{error}</p>
                        <hr />
                        <p className="small mb-3">
                            {t("An error occurred while loading data.")}
                        </p>
                        <div className="d-flex gap-2 justify-content-center">
                            <button
                                className="btn btn-primary"
                                onClick={() => window.location.reload()}
                            >
                                <i className="bi bi-arrow-clockwise me-2"></i>
                                {t("Retry")}
                            </button>
                            {new URLSearchParams(window.location.search).has('suiteProject') && <button
                                className="btn btn-outline-secondary"
                                onClick={() => {
                                    const url = new URL(window.location.href);
                                    url.searchParams.delete('suiteProject');
                                    window.location.assign(url.href);
                                }}
                            >Apri elenco progetti</button>}
                            {onLogout && (
                                <button
                                    className="btn btn-outline-secondary"
                                    onClick={onLogout}
                                >
                                    <i className="bi bi-person-badge me-2"></i>
                                    {t("Change Profile")}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================
    // Render - Main App
    // ========================================

    const PageComponent = activePage.component;

    const panelToggleBtn = (
        <button
            className="btn btn-sm btn-light"
            type="button"
            title={rightPanelOpen ? t("Hide right panel") : t("Show right panel")}
            onClick={() => setRightPanelOpen((v) => !v)}
        >
            {rightPanelOpen ? `${t("Panel")} ▸` : `${t("Panel")} ◂`}
        </button>
    );

    return (
        <WorkflowProvider>
        <div className={`jl-root ${currentTheme === 'dark' ? 'dark-theme' : ''}`}>
            <div className="jl-appframe">
                <div className="jl-shell">
                    {/* Command Palette */}
                    <CommandPalette shell={shell} />

                    {/* Sidebar Navigation */}
                    <LeftNav
                        items={filteredPages}
                        activeId={activeId}
                        onSelect={(id) => {
                            setActiveId(id);
                            setNavContext(null); // Reset context on manual nav
                            setNavAction(null); // Reset action on manual nav
                        }}
                        open={navOpen}
                        onClose={() => setNavOpen(false)}
                    />

                    {/* Main Content Area */}
                    <main className="jl-main">
                        {/* Top Header */}
                        <TopHeader
                            title={title}
                            navOpen={navOpen}
                            onMenuToggle={() => setNavOpen((open) => !open)}
                            actions={
                                <>
                                    {canUsePage(currentUser, activePage.id, 'write') && headerActions}
                                    {canUseModule(currentUser, 'inbox') && <NotificationBell />}
                                    {panelToggleBtn}
                                    <ProfileMenu
                                        initials={currentUser?.displayName?.substring(0, 2)?.toUpperCase() || "JL"}
                                        title={currentUser?.displayName || t("User")}
                                        subtitle={`@${currentUser?.username || "librepm"}`}
                                        items={profileItems}
                                    />
                                </>
                            }
                        />

                        {/* Content Section */}
                        {needsProjectContext(currentUser) && <ProjectContextBar shell={shell} />}
                        <section className="jl-content" ref={contentRef}>
                            {/* Page Content */}
                            <div className="jl-page" id="main-content">
                                <PageErrorBoundary key={activeId}><PageComponent shell={shell} /></PageErrorBoundary>
                            </div>

                            <ResponsiveTables rootRef={contentRef} />

                            {/* Sfondo del pannello di contesto: esiste solo
                                sotto i 992px, dove il pannello si sovrappone al
                                contenuto invece di affiancarlo. Senza, l'unico
                                modo di chiuderlo sarebbe ritrovare il suo
                                pulsante nella barra in alto, che il pannello
                                stesso copre a metà. */}
                            <div
                                className={"jl-rightpanel-backdrop " + (rightPanelOpen ? "show" : "")}
                                onClick={() => setRightPanelOpen(false)}
                                aria-hidden="true"
                            />

                            {/* Right Panel */}
                            <aside className={"jl-rightpanel " + (rightPanelOpen ? "" : "closed")}>
                                {rightPanel ?? (
                                    <div className="d-flex flex-column gap-2">
                                        <div className="d-flex align-items-start justify-content-between gap-2">
                                            <div>
                                                <div className="fw-bold">{SECTION_NAME}</div>
                                                <div className="jl-muted small">
                                                    {t('Project information and useful links.')}
                                                </div>
                                            </div>
                                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                v{__APP_VERSION__}
                                            </span>
                                        </div>
                                        {currentProject && (
                                            <div className="p-2 border rounded-3">
                                                <div className="small fw-bold">{t("Active Project")}</div>
                                                <div className="text-primary">{currentProject.name}</div>
                                            </div>
                                        )}

                                        {currentUser && (
                                            <div className="p-2 border rounded-3">
                                                <div className="small fw-bold">{t("User")}</div>
                                                <div className="jl-muted small">
                                                    {currentUser.displayName || currentUser.username}
                                                </div>
                                                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                                    @{currentUser.username}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </aside>
                        </section>
                    </main>
                </div>
            </div>
        </div>
        </WorkflowProvider>
    );
}
