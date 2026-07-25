package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.core.entity.User;
import com.lorenzodm.librepm.security.ClerkIdentityService;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Dice alla SPA chi è chi sta chiamando, nel profilo {@code cloud}.
 *
 * <p>Serve perché sul web la sequenza di avvio del desktop non è praticabile:
 * {@code /api/bootstrap/**} è negato, e con ragione — è l'onboarding di
 * un'installazione personale, che elenca tutti i profili e ne fa scegliere uno
 * senza autenticazione. Online la persona la decide Clerk, non un menù.
 *
 * <p>L'identificativo dell'utente <strong>non</strong> viene accettato dalla
 * richiesta: si ricava dal token. È il punto in cui la SPA scopre il proprio
 * {@code userId} da usare nei percorsi {@code /api/users/{userId}/...}, che
 * {@code OwnUserAuthorizationManager} poi verifica a ogni chiamata.
 *
 * @since 0.2.0
 */
@RestController
@RequestMapping("/api/me")
@Profile("cloud")
public class MeController {

    private final ClerkIdentityService identityService;

    public MeController(ClerkIdentityService identityService) {
        this.identityService = identityService;
    }

    /**
     * @return l'utente interno corrispondente all'identità Clerk e i ruoli
     *         applicativi che il token porta con sé.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> me(Authentication authentication) {
        Optional<User> resolved = identityService.resolve(authentication);
        if (resolved.isEmpty()) {
            // Nessun utente ricavabile dal token: non è un errore del client, ma
            // non c'è niente da restituire. La SPA mostra «identità non
            // collegata» invece di procedere con un id inventato.
            return ResponseEntity.status(403).body(Map.of(
                    "message", "Identità non collegata a nessun utente di LibrePM."));
        }

        User user = resolved.get();
        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "displayName", user.getDisplayName() == null ? user.getUsername() : user.getDisplayName(),
                "email", user.getEmail() == null ? "" : user.getEmail(),
                "workspaceProfileId", user.getWorkspaceProfileId() == null
                        ? "wp-personal" : user.getWorkspaceProfileId(),
                "roles", applicationRoles(authentication)));
    }

    /** Da {@code ROLE_COORDINATORE_SERVIZI} a {@code coordinatore-servizi}. */
    private List<String> applicationRoles(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length())
                        .toLowerCase(Locale.ROOT).replace('_', '-'))
                .toList();
    }
}
