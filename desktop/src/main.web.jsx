import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { itIT } from "@clerk/localizations";
import WebAuthGate from "./WebAuthGate.jsx";
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

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const container = document.getElementById("root");
const root = createRoot(container);

if (!publishableKey) {
    // Fallire a voce alta: senza chiave Clerk la pagina si caricherebbe e
    // resterebbe muta, e il motivo non sarebbe visibile da nessuna parte.
    root.render(
        <div style={{ padding: "2rem", fontFamily: "system-ui", maxWidth: "40rem" }}>
            <h3>Configurazione incompleta</h3>
            <p>
                Manca <code>VITE_CLERK_PUBLISHABLE_KEY</code>: senza la chiave pubblica di Clerk la
                sezione bandi non può autenticare nessuno. Va impostata fra le variabili d'ambiente
                del progetto.
            </p>
        </div>
    );
} else {
    root.render(
        <StrictMode>
            <ClerkProvider publishableKey={publishableKey} localization={itIT}>
                <ModalProvider>
                    <WebAuthGate />
                </ModalProvider>
            </ClerkProvider>
        </StrictMode>
    );
}
