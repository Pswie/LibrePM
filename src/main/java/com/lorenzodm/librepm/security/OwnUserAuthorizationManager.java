package com.lorenzodm.librepm.security;

import com.lorenzodm.librepm.core.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

import java.util.Optional;
import java.util.function.Supplier;

/**
 * Verifica che {@code /api/users/{userId}/...} riguardi davvero chi sta chiamando.
 *
 * <p>Serve a chiudere il problema più grosso che LibrePM porta con sé quando
 * passa da applicazione desktop a servizio condiviso. Quasi tutte le sue API
 * hanno la forma {@code /api/users/{userId}/projects/...}: sul desktop
 * l'identificativo nell'URL è innocuo, perché l'unico utente è chi ha aperto il
 * programma. Su un backend pubblico con un database condiviso, invece, è
 * sufficiente cambiare quel valore per leggere e scrivere i progetti di un'altra
 * persona. Nessuna regola basata sui soli ruoli lo impedisce: il ruolo dice
 * <em>che cosa</em> si può fare, non <em>su chi</em>.
 *
 * <p>Il confronto è fra l'identificativo scritto nell'URL e quello dell'utente
 * risolto dal token Clerk. Il presidente è l'unica eccezione: la governance dei
 * progetti dell'associazione è sua, quindi può operare anche sulle cartelle
 * altrui. È la stessa asimmetria che ha nel gestionale.
 *
 * <p>In caso di dubbio nega. Un utente non risolvibile, un percorso senza
 * variabile o un'autenticazione assente producono tutti un rifiuto: su una
 * barriera di autorizzazione il comportamento predefinito non può essere
 * «passa».
 *
 * @since 0.2.0
 */
public class OwnUserAuthorizationManager implements AuthorizationManager<RequestAuthorizationContext> {

    private static final Logger log = LoggerFactory.getLogger(OwnUserAuthorizationManager.class);

    /** Nome della variabile nel pattern registrato in {@link CloudSecurityConfig}. */
    private static final String USER_ID_VARIABLE = "userId";

    private static final String PRESIDENT_AUTHORITY = "ROLE_PRESIDENTE";

    private final ClerkIdentityService identityService;

    public OwnUserAuthorizationManager(ClerkIdentityService identityService) {
        this.identityService = identityService;
    }

    @Override
    public AuthorizationDecision check(
            Supplier<Authentication> authentication,
            RequestAuthorizationContext context) {

        Authentication current = authentication.get();
        if (current == null || !current.isAuthenticated()) {
            return new AuthorizationDecision(false);
        }

        if (hasPresidentAuthority(current)) {
            return new AuthorizationDecision(true);
        }

        String requestedUserId = context.getVariables().get(USER_ID_VARIABLE);
        if (requestedUserId == null || requestedUserId.isBlank()) {
            // Il pattern è registrato con la variabile: se manca, la richiesta
            // non è quella che credevamo di stare autorizzando.
            log.warn("Percorso per utente senza variabile {}: accesso negato", USER_ID_VARIABLE);
            return new AuthorizationDecision(false);
        }

        Optional<User> caller = identityService.resolve(current);
        if (caller.isEmpty()) {
            return new AuthorizationDecision(false);
        }

        boolean own = requestedUserId.equals(caller.get().getId());
        if (!own) {
            log.warn("Accesso negato: l'identità {} ha chiesto i dati dell'utente {}",
                    current.getName(), requestedUserId);
        }
        return new AuthorizationDecision(own);
    }

    private boolean hasPresidentAuthority(Authentication authentication) {
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (PRESIDENT_AUTHORITY.equals(authority.getAuthority())) {
                return true;
            }
        }
        return false;
    }
}
