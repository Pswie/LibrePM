import { useCallback, useEffect, useRef, useState } from "react";
import {
    RedirectToSignIn,
    SignIn,
    useAuth,
    useOrganization,
    useOrganizationList,
} from "@clerk/clerk-react";
import librepm from "./api/librepm";
import App from "./App.jsx";
import { ORGANISATION_NAME, SECTION_NAME, SOURCE_CODE_URL } from "./branding";

/**
 * Guscio di autenticazione del profilo web (sezione bandi).
 *
 * Sul desktop non esiste: là l'utente si scegie da un elenco locale di profili,
 * perché l'unica persona in gioco è chi ha aperto il programma. Online quella
 * sequenza è chiusa in `CloudSecurityConfig` — elencherebbe tutti i profili
 * dell'associazione senza autenticazione — e l'identità la stabilisce Clerk,
 * la stessa istanza che autentica il gestionale. Un solo accesso per le due
 * sezioni.
 *
 * Il flusso è:
 * 1. nessuna sessione Clerk → schermata di accesso;
 * 2. sessione presente → si registra il fornitore del token e si chiede al
 *    backend «chi sono io» ({@code GET /api/me});
 * 3. il backend risponde con l'utente interno e i ruoli, e si entra
 *    nell'applicazione senza passare dall'onboarding.
 *
 * L'identificativo dell'utente non viene mai scelto dal client: arriva dal
 * token, e il backend lo verifica di nuovo a ogni richiesta.
 *
 * @author Angeli del Futuro (fork di LibrePM)
 * @since 0.2.0
 *
 * @param {boolean} [props.isSatellite] Vero quando questa applicazione è un
 *   satellite di Clerk, cioè quando la sessione è tenuta dal sito e non da qui
 *   (configurazione in {@code main.web.jsx}). In quel caso chi non è
 *   autenticato non deve vedere un secondo modulo di accesso: verrebbe chiesta
 *   una seconda volta la stessa credenziale, che è il difetto che i satelliti
 *   eliminano. Si va invece al primario, che riconosce la sessione già aperta e
 *   rimanda indietro senza mostrare nulla.
 */
export default function WebAuthGate({ isSatellite = false }) {
    const { isLoaded: authLoaded, isSignedIn, getToken, signOut } = useAuth();
    const { organization } = useOrganization();
    const { isLoaded: orgsLoaded, setActive, userMemberships } = useOrganizationList({
        userMemberships: { infinite: true },
    });

    const [session, setSession] = useState(null);
    const [error, setError] = useState(null);
    const resolving = useRef(false);

    /**
     * Attiva un'organizzazione se non ce n'è già una attiva.
     *
     * Serve perché nei session token Clerk v2 il ruolo arriva come `o.rol`, cioè
     * il ruolo nell'organizzazione <em>attiva</em>: senza organizzazione attiva il
     * token non porta nessun ruolo e il backend vede un utente senza permessi,
     * pur avendo la persona un ruolo assegnato. Se una è già attiva non si tocca,
     * altrimenti a ogni ricarica si tornerebbe alla prima dell'elenco.
     */
    const ensureActiveOrganization = useCallback(async () => {
        if (organization) return;
        if (!orgsLoaded || !setActive) return;

        const memberships = userMemberships?.data ?? [];
        if (memberships.length === 0) return;

        try {
            await setActive({ organization: memberships[0].organization.id });
        } catch (e) {
            console.warn("[WebAuthGate] Impossibile attivare l'organizzazione:", e);
        }
    }, [organization, orgsLoaded, setActive, userMemberships]);

    useEffect(() => {
        if (!authLoaded || !isSignedIn || session || resolving.current) return;
        resolving.current = true;

        (async () => {
            try {
                // Il token si chiede a ogni richiesta e non si conserva: Clerk lo
                // ruota, e una copia tenuta da parte scadrebbe in silenzio.
                librepm.setTokenProvider(() => getToken());

                await ensureActiveOrganization();
                await librepm.init();

                const me = await librepm.me();
                librepm.setCurrentUser(me.id);
                setSession({ user: me, roles: me.roles ?? [] });
            } catch (e) {
                console.error("[WebAuthGate] Risoluzione identità fallita:", e);
                setError(e);
            } finally {
                resolving.current = false;
            }
        })();
    }, [authLoaded, isSignedIn, session, getToken, ensureActiveOrganization]);

    const handleSignOut = useCallback(async () => {
        librepm.setTokenProvider(null);
        librepm.setCurrentUser(null);
        await signOut();
    }, [signOut]);

    if (!authLoaded) {
        return <Centered title="Avvio della sezione bandi…" />;
    }

    if (!isSignedIn) {
        // Da satellite l'accesso è del primario. RedirectToSignIn e non un
        // window.location scritto a mano: costruisce l'indirizzo passando dallo
        // scambio di Clerk, che è ciò che trasferisce la sessione e riporta qui.
        // Un redirect artigianale arriverebbe alla schermata di accesso del
        // sito senza portarsi dietro il punto di ritorno.
        //
        // L'offerta del sorgente resta anche qui: l'articolo 13 dell'AGPL la
        // vuole raggiungibile da chi interagisce col programma, e questa pagina
        // compare per un istante prima del rimando.
        if (isSatellite) {
            return (
                <Centered title="Riconoscimento dell’accesso…">
                    <SourceOffer />
                    <RedirectToSignIn />
                </Centered>
            );
        }

        return (
            <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 p-3">
                <SignIn routing="hash" />
                <SourceOffer />
            </div>
        );
    }

    if (error) {
        // 403 con ruoli vuoti è il caso normale di chi non è stato ancora
        // abilitato: distinguerlo da un guasto evita una segnalazione inutile.
        const forbidden = error?.status === 403;
        return (
            <Centered title={forbidden ? "Accesso non abilitato" : "Errore di connessione"}>
                <p className="mb-3">
                    {forbidden
                        ? "Il tuo account esiste ma non ha ancora un ruolo abilitato alla sezione bandi. "
                          + "Chiedi al presidente di assegnartelo nell'organizzazione."
                        : error?.message || "Il backend della sezione bandi non risponde."}
                </p>
                <button type="button" className="btn btn-outline-secondary" onClick={handleSignOut}>
                    Esci
                </button>
            </Centered>
        );
    }

    if (!session) {
        return <Centered title="Riconoscimento in corso…" />;
    }

    if (session.roles.length === 0) {
        return (
            <Centered title="Nessun ruolo assegnato">
                <p className="mb-3">
                    L'accesso è riuscito, ma il token non porta nessun ruolo valido per la sezione
                    bandi. Va assegnato in Clerk, nell'organizzazione dell'associazione.
                </p>
                <button type="button" className="btn btn-outline-secondary" onClick={handleSignOut}>
                    Esci
                </button>
            </Centered>
        );
    }

    return <App webSession={{ ...session, signOut: handleSignOut }} />;
}

/** Schermata di servizio, senza dipendenze dal resto dell'applicazione. */
function Centered({ title, children }) {
    return (
        <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 text-center p-4">
            <h5 className="text-muted mb-2">{title}</h5>
            <div style={{ maxWidth: 460 }}>{children}</div>
        </div>
    );
}

/**
 * Offerta del sorgente richiesta dall'articolo 13 dell'AGPL.
 *
 * Sta sulla schermata di accesso perché deve essere raggiungibile senza
 * autenticarsi: chi apre la pagina interagisce già col programma, e a quel punto
 * il diritto di avere il sorgente della versione in esercizio esiste. Vedi
 * branding.js.
 */
function SourceOffer() {
    return (
        <p className="small text-muted mt-4 mb-0 text-center">
            {SECTION_NAME} di {ORGANISATION_NAME} — LibrePM, GNU AGPL v3.{" "}
            <a href={SOURCE_CODE_URL} target="_blank" rel="noreferrer noopener">
                Codice sorgente di questa versione
            </a>
            .
        </p>
    );
}
