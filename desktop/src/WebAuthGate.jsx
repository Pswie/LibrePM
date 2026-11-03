import { useCallback, useEffect, useState } from "react";
import {
    RedirectToSignIn,
    SignIn,
    useAuth,
    useOrganizationList,
} from "@clerk/clerk-react";
import librepm from "./api/librepm";
import App from "./App.jsx";
import { BRAND_LOGO_URL, ORGANISATION_NAME, SECTION_NAME, SOURCE_CODE_URL } from "./branding";
import { clerkSignInReturnOptions } from "./clerk-sso.js";
import { boundedTokenProvider, resolveWebAccess, WebAccessError } from "./web-access.js";

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
    const { isLoaded: authLoaded, isSignedIn, getToken, signOut, userId, sessionId, orgId } = useAuth();
    const { isLoaded: orgsLoaded, setActive, userMemberships } = useOrganizationList({
        userMemberships: { infinite: true },
    });

    const [session, setSession] = useState(null);
    const [error, setError] = useState(null);
    const [retryAttempt, setRetryAttempt] = useState(0);
    // Membership resources are objects recreated by the SDK. Depend on the
    // selected ID, so a render cannot restart a failed request and erase it.
    const organizationToActivate = !orgId && orgsLoaded && setActive
        ? userMemberships?.data?.[0]?.organization?.id ?? null
        : null;

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        setSession(null);
        setError(null);
        librepm.setCurrentUser(null);
        if (!authLoaded || !isSignedIn) {
            librepm.setTokenProvider(null);
            return () => controller.abort();
        }
        librepm.setTokenProvider(boundedTokenProvider(getToken, controller.signal));
        const overall = setTimeout(() => controller.abort(new WebAccessError('access', 'timeout')), 90000);
        resolveWebAccess({ api: librepm, signal: controller.signal, activateOrganization: setActive, organizationId: organizationToActivate })
            .then((resolved) => {
                if (!active || controller.signal.aborted) return;
                librepm.setCurrentUser(resolved.user.access && !resolved.user.access.applications?.librepm?.enabled ? null : resolved.user.id);
                setSession(resolved);
            })
            .catch((failure) => {
                if (!active || (controller.signal.aborted && !(controller.signal.reason instanceof WebAccessError))) return;
                const problem = controller.signal.reason instanceof WebAccessError ? controller.signal.reason : failure;
                // Phase/code only: no SDK errors, credentials, request or response payloads.
                console.warn('[Accesso progetti]', { phase: problem.phase, code: problem.code, status: problem.status });
                setError(problem);
            })
            .finally(() => clearTimeout(overall));
        return () => {
            active = false;
            clearTimeout(overall);
            controller.abort();
            librepm.setTokenProvider(null);
            librepm.setCurrentUser(null);
        };
    }, [authLoaded, isSignedIn, userId, sessionId, orgId, getToken, setActive, organizationToActivate, retryAttempt]);

    const handleSignOut = useCallback(async () => {
        librepm.setTokenProvider(null);
        librepm.setCurrentUser(null);
        await signOut();
    }, [signOut]);

    useEffect(() => {
        if (!session?.user?.access) return;
        const controller = new AbortController();
        let checking = false;
        const refresh = async () => {
            if (checking || document.visibilityState === 'hidden') return;
            checking = true;
            try {
                const me = await librepm.me({ signal: controller.signal });
                if (!controller.signal.aborted && me.access && (me.access.version !== session.user.access.version
                    || me.access.status !== session.user.access.status || JSON.stringify(me.access.permissions) !== JSON.stringify(session.user.access.permissions))) {
                    librepm.setAccessApiUrl(me.accessApiUrl);
                    librepm.setCurrentUser(me.access.applications?.librepm?.enabled ? me.id : null);
                    setSession({ user: me, roles: me.roles });
                }
            } catch { /* API requests still fail closed; a focus refresh never grants stale access. */ }
            finally { checking = false; }
        };
        window.addEventListener('focus', refresh);
        window.addEventListener('librepm-access-recheck', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => { controller.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('librepm-access-recheck', refresh); document.removeEventListener('visibilitychange', refresh); };
    }, [session]);

    if (!authLoaded) {
        return <Centered title="Avvio di Progetti…" />;
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
                    <RedirectToSignIn {...clerkSignInReturnOptions(window.location)} />
                </Centered>
            );
        }

        return (
            <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 p-3">
                <SignIn routing="hash" fallbackRedirectUrl={clerkSignInReturnOptions(window.location).redirectUrl} />
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
                        ? "Il tuo account non è ancora abilitato. Contatta chi gestisce gli accessi."
                        : "Non è stato possibile completare l’accesso. Riprova tra poco."}
                </p>
                <button type="button" className="btn btn-primary me-2" onClick={() => setRetryAttempt((attempt) => attempt + 1)}>
                    Riprova
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={handleSignOut}>
                    Esci
                </button>
            </Centered>
        );
    }

    if (!session) {
        return <Centered title="Riconoscimento in corso…" />;
    }

    if (session.user.access && (session.user.access.status !== 'active' || !session.user.access.applications?.librepm?.enabled)) {
        const pending = session.user.access.status === 'pending';
        return <Centered title={pending ? 'In attesa di approvazione' : 'Accesso a Progetti non abilitato'}>
            <p>{pending ? 'La registrazione è completata. L’amministratore deve ancora assegnarti gli accessi.' : 'Il tuo account non è abilitato a questa applicazione. Contatta l’amministratore.'}</p>
            <button type="button" className="btn btn-primary me-2" onClick={() => setRetryAttempt(attempt => attempt + 1)}>Controlla accesso</button>
            <button type="button" className="btn btn-outline-secondary" onClick={handleSignOut}>Esci</button>
        </Centered>;
    }

    if (!session.user.access && session.roles.length === 0) {
        return (
            <Centered title="Nessun ruolo assegnato">
                <p className="mb-3">
                    Il tuo account non è ancora abilitato. Contatta chi gestisce gli accessi.
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
        <div className="mt-4 text-center">
            <img src={BRAND_LOGO_URL} alt="" width={80} height={80} style={{ objectFit: 'contain', background: '#fff', borderRadius: 12, padding: 6 }} />
            <p className="fw-semibold mt-2 mb-0">{SECTION_NAME}</p>
            <p className="small text-muted mb-2">{ORGANISATION_NAME}</p>
            <p className="small text-muted mb-0">LibrePM, GNU AGPL v3. <a href={SOURCE_CODE_URL} target="_blank" rel="noreferrer noopener">Codice sorgente di questa versione</a>.</p>
        </div>
    );
}
