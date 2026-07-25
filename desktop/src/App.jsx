import { useState, useEffect, useCallback, useRef } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { librepm } from "@api/librepm.js";
import AppShell from "./layout/AppShell.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import SplashScreen from "@pages/SplashScreen.jsx";
import DebugLogger from "./components/DebugLogger.jsx"; // Re-import DebugLogger PERMANENTE
import "./styles/index.css";
import "./styles/librepm-shell.css";
import "./i18n"; // Import i18n configuration
import { useTranslation } from 'react-i18next';

// Import Chart.js registration
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';

// Register Chart.js components globally
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

/**
 * Application States
 * @enum {string}
 */
const AppState = {
    APP_START: "APP_START",
    BOOTSTRAP_LOADING: "BOOTSTRAP_LOADING",
    ONBOARDING: "ONBOARDING",
    ENTER_APP: "ENTER_APP",
    BOOTSTRAP_ERROR: "BOOTSTRAP_ERROR",
    LOGGING_OUT: "LOGGING_OUT",
};

/**
 * App - Root Component of LibrePM Application.
 *
 * Orchestrates the application lifecycle:
 * 1. Initialization (API, Backend connection)
 * 2. Bootstrap (Loading user profiles and preferences)
 * 3. Routing (Onboarding vs Main App)
 * 4. Global Context Providers (Toast, FocusManager)
 *
 * @component
 * @author Lorenzo DM
 * @since 0.5.2
 * @updated 0.7.0 - Hard Reload on Logout
 */
export default function App({ webSession = null }) {
    const { t, i18n } = useTranslation();

    // ========================================
    // State
    // ========================================

    const [appState, setAppState] = useState(AppState.APP_START);
    const [bootstrapData, setBootstrapData] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [error, setError] = useState(null);
    const bootstrapRunning = useRef(false);

    // ========================================
    // Bootstrap Logic
    // ========================================

    /**
     * Executes the bootstrap sequence.
     * - Initializes API client
     * - Checks backend health
     * - Loads bootstrap data (profiles, prefs)
     * - Handles auto-login logic
     */
    const runBootstrap = useCallback(async () => {
        // Profilo web: l'identità è già stata risolta da WebAuthGate tramite
        // Clerk. Qui non c'è niente da avviare — la sequenza di bootstrap
        // chiamerebbe /api/bootstrap, che nel profilo cloud è negato, e
        // l'applicazione si fermerebbe su una schermata di errore.
        if (webSession) {
            setCurrentUser(webSession.user);
            setAppState(AppState.ENTER_APP);
            return;
        }

        // Guard: prevent concurrent executions (React StrictMode double-invoke)
        if (bootstrapRunning.current) {
            console.log("[App] Bootstrap già in corso, skip");
            return;
        }
        bootstrapRunning.current = true;

        console.log("[App] Avvio bootstrap...");
        setAppState(AppState.BOOTSTRAP_LOADING);
        setError(null);

        try {
            // 1. Initialize API client
            await librepm.init();
            console.log("[App] API inizializzata");

            // 2. Health check
            const health = await librepm.healthCheck();
            if (!health.ok) {
                throw new Error("Backend non raggiungibile: " + health.error);
            }
            console.log("[App] Backend OK");

            // 3. Load bootstrap data
            const bootstrap = await librepm.bootstrapGet();
            setBootstrapData(bootstrap);
            console.log("[App] Bootstrap data:", bootstrap);

            // 4. Check autologin and language preferences
            const { autologinEnabled, lastUserId } = bootstrap.preferences;
            const localPrefs = librepm.getLocalPreferences();

            // Apply language preference ONLY if different
            if (localPrefs.language && i18n.language !== localPrefs.language) {
                await i18n.changeLanguage(localPrefs.language);
            }

            // Use local preferences as fallback for autologin
            const shouldAutologin = autologinEnabled || localPrefs.autologinEnabled;
            const userIdToUse = lastUserId || localPrefs.lastUserId;

            if (shouldAutologin && userIdToUse) {
                console.log("[App] Tentativo autologin con:", userIdToUse);

                // Validate user existence
                const validation = await librepm.bootstrapValidateUser(userIdToUse);
                if (validation.valid) {
                    // Autologin successful!
                    const user = await librepm.bootstrapSelectProfile(userIdToUse);
                    setCurrentUser(user);
                    setAppState(AppState.ENTER_APP);
                    console.log("[App] Autologin riuscito:", user.displayName);
                    toast.success(`${t("Welcome back")}, ${user.displayName || user.username}!`);
                    return;
                } else {
                    console.warn("[App] Autologin fallito: utente non valido");
                    // Reset local prefs to avoid loops
                    librepm.setLocalPreferences({ lastUserId: null });
                }
            }

            // 5. Show onboarding (profile selection or creation)
            setAppState(AppState.ONBOARDING);

        } catch (e) {
            console.error("[App] Errore bootstrap:", e);
            setError(e.message || "Errore durante l'avvio dell'applicazione");
            setAppState(AppState.BOOTSTRAP_ERROR);
        } finally {
            bootstrapRunning.current = false;
        }
    }, [webSession]); // Removed i18n and t from dependencies to avoid loop

    // ========================================
    // Effects
    // ========================================

    useEffect(() => {
        runBootstrap();
    }, [runBootstrap]);

    /**
     * Theme Management Effect.
     * Forces light theme during onboarding for consistency.
     */
    useEffect(() => {
        if (appState === AppState.ONBOARDING) {
            document.documentElement.setAttribute("data-theme", "light");
            document.body.setAttribute("data-theme", "light");
            document.documentElement.removeAttribute("data-bs-theme");
            
            // Extra cleanup for modal/body styles
            document.body.classList.remove("modal-open");
            document.body.style.overflow = "";
            document.body.style.paddingRight = "";
        }
    }, [appState]);

    // ========================================
    // Handlers
    // ========================================

    /**
     * Callback when a profile is selected or created.
     * Transitions state to ENTER_APP.
     * @param {Object} user - The selected user profile.
     */
    const handleProfileSelected = (user) => {
        console.log("[App] Profilo selezionato:", user.displayName || user.username);
        setCurrentUser(user);
        setAppState(AppState.ENTER_APP);
        toast.success(`${t("Welcome")}, ${user.displayName || user.username}!`);
    };

    /**
     * Retries the bootstrap process after an error.
     */
    const handleRetry = () => {
        runBootstrap();
    };

    /**
     * Handles user logout.
     * Implements a "Hard Reload" strategy to ensure clean state.
     */
    const handleLogout = useCallback(async () => {
        console.log("[App] Logout avviato...");

        // 1. Show transition screen
        setAppState(AppState.LOGGING_OUT);

        // Profilo web: la sessione è di Clerk e va chiusa là. Le preferenze di
        // autologin non c'entrano — non esiste autologin quando l'accesso passa
        // da un identity provider — e /api/bootstrap è comunque negato.
        if (webSession) {
            try {
                await webSession.signOut();
            } catch (e) {
                console.error("[App] Errore durante il logout Clerk:", e);
                window.location.reload();
            }
            return;
        }

        try {
            // 2. Reset autologin preferences
            librepm.setLocalPreferences({ autologinEnabled: false, lastUserId: null });

            try {
                await librepm.bootstrapUpdatePreferences({ autologinEnabled: false });
            } catch (e) {
                console.warn("[App] Errore reset preferenze backend (ignorato):", e);
            }

            // 3. Reset current user state
            librepm.setCurrentUser(null);

            // 4. Wait for visual feedback
            await new Promise(resolve => setTimeout(resolve, 800));

            // 5. HARD RELOAD
            console.log("[App] Eseguo Hard Reload...");
            window.location.reload();

        } catch (e) {
            console.error("[App] Errore critico durante logout:", e);
            window.location.reload();
        }
    }, []);

    // ========================================
    // Render - Loading / Logout
    // ========================================

    if (appState === AppState.LOGGING_OUT) {
        return <SplashScreen />;
    }

    if (appState === AppState.APP_START || appState === AppState.BOOTSTRAP_LOADING) {
        return (
            <div className="jl-root">
                <div className="jl-loading d-flex flex-column align-items-center justify-content-center vh-100">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Caricamento...</span>
                    </div>
                    <h5 className="text-muted">
                        {appState === AppState.APP_START
                            ? "Avvio LibrePM..."
                            : "Preparazione in corso..."}
                    </h5>
                    <p className="small text-muted">
                        Connessione al backend in corso
                    </p>
                </div>
            </div>
        );
    }

    // ========================================
    // Render - Error
    // ========================================

    if (appState === AppState.BOOTSTRAP_ERROR) {
        return (
            <div className="jl-root">
                <div className="jl-error d-flex flex-column align-items-center justify-content-center vh-100">
                    <div className="alert alert-danger text-center" style={{ maxWidth: 500 }}>
                        <h5 className="alert-heading">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            Errore di Connessione
                        </h5>
                        <p className="mb-2">{error}</p>
                        <hr />
                        <p className="small mb-3">
                            Qualcosa è andato storto. Riprova.
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={handleRetry}
                        >
                            <i className="bi bi-arrow-clockwise me-2"></i>
                            Riprova
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================
    // Render - Onboarding
    // ========================================

    if (appState === AppState.ONBOARDING) {
        return (
            <>
                <DebugLogger contextName="Onboarding" />
                <OnboardingPage
                    bootstrapData={bootstrapData}
                    onProfileSelected={handleProfileSelected}
                    onRetry={handleRetry}
                />
                <ToastContainer
                    position="bottom-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="colored"
                />
            </>
        );
    }

    // ========================================
    // Render - Main App
    // ========================================

    return (
        <>
            <DebugLogger contextName="AppShell" />
            <AppShell
                initialUser={currentUser}
                onLogout={handleLogout}
            />
            <ToastContainer
                position="bottom-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="colored"
            />
        </>
    );
}
