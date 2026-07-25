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
import "@fontsource-variable/plus-jakarta-sans";

// Comportamento del layout su finestra stretta. Non è estetica e non va tenuto
// separato come il tema: lo stesso foglio lo carica anche main.jsx (Electron).
import "./styles/mobile.css";

// Ultimo: il tema di Angeli del Futuro sovrascrive Bootstrap e gli stili
// storici. Caricato solo qui, cioè solo dalla build web — l'applicazione
// Electron mantiene il suo aspetto.
import "./styles/adf-theme.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Configurazione da applicazione satellite di Clerk.
 *
 * Il problema che risolve: le tre applicazioni dell'associazione stanno su tre
 * domini registrabili diversi (`terzo-settore.vercel.app`,
 * `adf-bandi-collaudo.vercel.app`, `adf-gestionale-collaudo.vercel.app`). La
 * sessione di Clerk vive in un cookie, e `vercel.app` è nella Public Suffix
 * List: il browser **rifiuta** di impostare un cookie valido per `.vercel.app`.
 * Condividere la stessa istanza Clerk non basta quindi a condividere la
 * sessione — chi entrava dal sito doveva riautenticarsi qui, che è esattamente
 * ciò che l'architettura a "una sola identità" prometteva di evitare.
 *
 * Le satellite domains sono il meccanismo che Clerk ha progettato per questo
 * caso: un dominio primario tiene la sessione, i satelliti la leggono con uno
 * scambio via redirect, senza cookie di terze parti — che i browser bloccano.
 *
 * Vale solo con `VITE_CLERK_PRIMARY_URL` impostata. Senza quella variabile
 * l'applicazione resta autonoma con la sua schermata di accesso: è così che
 * continua a funzionare lo sviluppo locale, dove un satellite puntato a un
 * primario inesistente non riuscirebbe ad autenticare nessuno. Il desktop non
 * passa da qui.
 *
 * Da fare fuori dal codice, una volta sola: nel pannello Clerk questo dominio
 * va dichiarato satellite accanto al primario, altrimenti lo scambio viene
 * rifiutato. In modalità sviluppo la funzione è gratuita.
 */
const primaryUrl = import.meta.env.VITE_CLERK_PRIMARY_URL?.replace(/\/$/, "");
const satelliteProps = primaryUrl
    ? {
        isSatellite: true,
        // Il proprio dominio, non quello del primario: la chiave pubblica è la
        // stessa per tutte e tre le applicazioni, e questo è il modo in cui
        // Clerk distingue chi sta chiedendo.
        domain: window.location.host,
        // La schermata di accesso è quella del sito: /admin monta <SignIn />.
        signInUrl: `${primaryUrl}/admin`,
        signUpUrl: `${primaryUrl}/admin`,
    }
    : {};

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
            <ClerkProvider publishableKey={publishableKey} localization={itIT} {...satelliteProps}>
                <ModalProvider>
                    <WebAuthGate isSatellite={Boolean(primaryUrl)} />
                </ModalProvider>
            </ClerkProvider>
        </StrictMode>
    );
}
