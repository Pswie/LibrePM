package com.lorenzodm.librepm.security;

import com.lorenzodm.librepm.core.entity.User;
import com.lorenzodm.librepm.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;

/**
 * Risolve l'utente interno di LibrePM a partire dall'identità Clerk.
 *
 * <p>È il perno delle autorizzazioni del profilo {@code cloud}: quasi tutte le
 * API di LibrePM hanno la forma {@code /api/users/{userId}/...}, cioè prendono il
 * soggetto dall'URL. Su un backend pubblico questo non basta — chiunque potrebbe
 * scrivere l'identificativo di un altro — e serve un modo affidabile per sapere
 * chi sta chiamando davvero. Vedi {@link OwnUserAuthorizationManager}.
 *
 * <p>La ricerca procede in tre tempi:
 * <ol>
 *   <li>per {@code clerk_user_id}, il legame esplicito e stabile;
 *   <li>per email verificata, e in quel caso il legame viene scritto: la volta
 *       dopo si passa dalla strada buona;
 *   <li>se non esiste nessuna riga, l'utente viene creato.
 * </ol>
 *
 * <p>Il terzo passo è una differenza voluta rispetto al gestionale, dove le
 * anagrafiche esistono già e un accesso senza corrispondenza va negato. Qui il
 * database cloud nasce vuoto e non c'è nessun onboarding da desktop: senza
 * creazione al primo accesso nemmeno il presidente potrebbe iniziare a lavorare.
 * Non è un'apertura, perché a questo punto la richiesta ha già superato il
 * filtro dei ruoli: chi arriva qui è membro dell'organizzazione Clerk con un
 * ruolo operativo, cioè è stato invitato dal presidente. Le registrazioni libere
 * vanno tenute chiuse su Clerk — è la premessa su cui si regge questa scelta.
 *
 * <p>L'abbinamento per email è un ripiego per il primo accesso, non un criterio
 * di sicurezza: in Clerk l'email si cambia, e due persone possono condividerne
 * una. Per questo viene usato una volta sola e solo se l'email risulta verificata
 * lato Clerk.
 *
 * @since 0.2.0
 */
@Service
@Profile("cloud")
public class ClerkIdentityService {

    private static final Logger log = LoggerFactory.getLogger(ClerkIdentityService.class);

    private static final String EMAIL_CLAIM = "email";
    private static final String EMAIL_VERIFIED_CLAIM = "email_verified";
    private static final String NAME_CLAIM = "name";
    private static final String USERNAME_CLAIM = "preferred_username";

    private final UserRepository userRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public ClerkIdentityService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * @return l'utente interno di chi sta chiamando, vuoto se la richiesta non
     *         porta un JWT utilizzabile.
     */
    @Transactional
    public Optional<User> resolve(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken token)) {
            return Optional.empty();
        }
        Jwt jwt = token.getToken();
        String clerkUserId = jwt.getSubject();
        if (clerkUserId == null || clerkUserId.isBlank()) {
            return Optional.empty();
        }

        Optional<User> linked = userRepository.findByClerkUserId(clerkUserId);
        if (linked.isPresent()) {
            return linked;
        }

        Optional<User> byEmail = linkByVerifiedEmail(jwt, clerkUserId);
        if (byEmail.isPresent()) {
            return byEmail;
        }

        return Optional.of(create(jwt, clerkUserId));
    }

    private Optional<User> linkByVerifiedEmail(Jwt jwt, String clerkUserId) {
        String email = verifiedEmail(jwt);
        if (email == null) {
            return Optional.empty();
        }

        Optional<User> byEmail = userRepository.findByEmailIgnoreCase(email);
        if (byEmail.isEmpty()) {
            return Optional.empty();
        }

        User user = byEmail.get();
        if (user.getClerkUserId() != null) {
            // Già legato a un'altra identità Clerk: non si sovrascrive, si nega.
            log.warn("Utente {} già collegato a un'altra identità Clerk", user.getId());
            return Optional.empty();
        }

        user.setClerkUserId(clerkUserId);
        userRepository.save(user);
        log.info("Utente {} collegato all'identità Clerk al primo accesso", user.getId());
        return Optional.of(user);
    }

    private User create(Jwt jwt, String clerkUserId) {
        String email = verifiedEmail(jwt);
        String username = uniqueUsername(jwt, clerkUserId, email);

        User created = new User();
        created.setUsername(username);
        created.setEmail(email);
        created.setDisplayName(firstNonBlank(
                jwt.getClaimAsString(NAME_CLAIM), email, username));
        created.setClerkUserId(clerkUserId);
        created.setActive(true);
        // La entity pretende un hash non vuoto, ma nel profilo cloud non esiste
        // login con password: /api/auth/** è negato. Un valore casuale che non
        // corrisponde a nessuna password è il modo di dirlo senza toccare lo
        // schema condiviso col desktop.
        created.setPasswordHash(unusablePassword());

        User saved = userRepository.save(created);
        log.info("Creato utente LibrePM per l'identità Clerk {}: username={}", clerkUserId, username);
        return saved;
    }

    /**
     * Un'email non verificata è una dichiarazione, non una prova: chiunque può
     * registrarsi su Clerk dichiarando l'indirizzo di un altro.
     */
    private String verifiedEmail(Jwt jwt) {
        String email = jwt.getClaimAsString(EMAIL_CLAIM);
        if (email == null || email.isBlank()) {
            return null;
        }
        Boolean verified = jwt.getClaim(EMAIL_VERIFIED_CLAIM);
        if (!Boolean.TRUE.equals(verified)) {
            log.warn("Accesso con email non verificata: nessun abbinamento per {}", jwt.getSubject());
            return null;
        }
        return email;
    }

    /**
     * {@code username} ha un indice univoco e una lunghezza massima di 50: uno
     * scontro fra due persone con lo stesso nome preferito farebbe fallire
     * l'inserimento invece di creare l'utente.
     */
    private String uniqueUsername(Jwt jwt, String clerkUserId, String email) {
        String preferred = firstNonBlank(
                jwt.getClaimAsString(USERNAME_CLAIM),
                email == null ? null : email.split("@")[0],
                clerkUserId);

        String base = preferred.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "-");
        if (base.length() > 40) {
            base = base.substring(0, 40);
        }
        if (base.length() < 3) {
            base = "utente-" + base;
        }

        if (!userRepository.existsByUsernameIgnoreCase(base)) {
            return base;
        }
        for (int suffix = 2; suffix < 100; suffix++) {
            String candidate = base + "-" + suffix;
            if (!userRepository.existsByUsernameIgnoreCase(candidate)) {
                return candidate;
            }
        }
        // Ultima spiaggia: l'identificativo Clerk è univoco per costruzione.
        return clerkUserId.length() > 50 ? clerkUserId.substring(0, 50) : clerkUserId;
    }

    private String unusablePassword() {
        byte[] buffer = new byte[32];
        secureRandom.nextBytes(buffer);
        return "CLERK_" + Base64.getUrlEncoder().withoutPadding().encodeToString(buffer);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
