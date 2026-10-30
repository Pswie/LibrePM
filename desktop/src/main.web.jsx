import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { itIT } from "@clerk/localizations";
import WebAuthGate from "./WebAuthGate.jsx";
import { clerkReturnUrl, clerkSatelliteOptions } from "./clerk-sso.js";
import "./i18n";
import { ModalProvider } from "./context/ModalContext";

/**
 * Entry point della build web (sezione bandi di Angeli del Futuro).
 *
 * Separato da main.jsx, che resta quello di Electron: là non c'è nessun identity
 * provider e l'applicazione parte dall'elenco locale dei profili. Tenere due
 * entry point evita di infilare condizioni su `window.electron` dentro il
 * percorso di avvio, dove un ramo sbagliato non dà un errore ma una schermata
 * bianca.
 *
 * @author Angeli del Futuro (fork di LibrePM)
 * @since 0.2.0
 */

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@fontsource-variable/plus-jakarta-sans";

// Comportamento del layout su finestra stretta. Non è estetica e non va tenuto
// separato come il tema: lo stesso foglio lo carica anche main.jsx (Electron).
import "./styles/mobile.css";

// Ultimo: il tema di Angeli del Futuro sovrascrive Bootstrap e gli stili
// storici. Caricato solo qui, cioè solo dalla build web — l'applicazione
// Electron mantiene il suo aspetto.
import "./styles/adf-theme.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// DEV instances synchronize browser state through Clerk's own navigation;
// production cookie sharing is not assumed for the existing test instance.
const primaryUrl = import.meta.env.VITE_CLERK_PRIMARY_URL;
let satelliteProps = {};
let configurationError = false;
try {
    satelliteProps = clerkSatelliteOptions(primaryUrl, window.location);
} catch {
    configurationError = true;
}
const returnUrl = clerkReturnUrl(window.location);

const container = document.getElementById("root");
const root = createRoot(container);

if (!publishableKey || configurationError) {
    // Fallire a voce alta: senza chiave Clerk la pagina si caricherebbe e
    // resterebbe muta, e il motivo non sarebbe visibile da nessuna parte.
    root.render(
        <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: "40rem" }}>
            <h3>Accesso non disponibile</h3>
            <p>Riprova tra poco o contatta chi gestisce il servizio.</p>
        </div>
    );
} else {
    root.render(
        <StrictMode>
            <ClerkProvider publishableKey={publishableKey} localization={itIT} signInFallbackRedirectUrl={returnUrl} signUpFallbackRedirectUrl={returnUrl} {...satelliteProps}>
                <ModalProvider>
                    <WebAuthGate isSatellite={satelliteProps.isSatellite === true} />
                </ModalProvider>
            </ClerkProvider>
        </StrictMode>
    );
}
