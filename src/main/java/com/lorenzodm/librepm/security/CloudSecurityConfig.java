package com.lorenzodm.librepm.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpMethod;
import org.springframework.security.authorization.AuthorityAuthorizationManager;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.authorization.AuthorizationManagers;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Sicurezza del profilo {@code cloud}: LibrePM è esposto in rete come sezione
 * bandi di Angeli del Futuro.
 *
 * <p>Differenze sostanziali rispetto a {@link SecurityConfig}, che vale solo per
 * desktop e sviluppo:
 *
 * <ul>
 *   <li>l'identità arriva da Clerk come JWT Bearer, verificato via JWKS, dalla
 *       stessa istanza che autentica il gestionale: un solo accesso per le due
 *       sezioni;
 *   <li>nessuna sessione, quindi nessun CSRF da difendere;
 *   <li>{@code /api/auth/**} è chiuso: un login con password parallelo a Clerk
 *       sarebbe una seconda porta d'ingresso da presidiare;
 *   <li>{@code /api/bootstrap/**} e {@code /api/db/**} sono chiusi: servono
 *       all'onboarding e all'import del database di un'installazione desktop, e
 *       su un servizio online sarebbero rispettivamente un modo per creare
 *       utenti senza autenticazione e per sovrascrivere i dati di tutti;
 *   <li>CORS su origini esplicite, mai {@code *}.
 * </ul>
 *
 * <p>La configurazione rifiuta di avviarsi se manca l'issuer o se le origini sono
 * lasciate aperte: su un URL pubblico un default permissivo non è un
 * inconveniente, è una fuga di dati.
 *
 * <p><strong>Limite noto.</strong> Le API {@code /api/projects/{projectId}/**}
 * non contengono l'identificativo dell'utente e qui sono protette dai soli
 * ruoli: un ruolo di governance può quindi leggere qualunque progetto, anche
 * quelli di cui non è membro. Per l'uso previsto — i bandi dell'associazione,
 * governati dal presidente e da chi lo affianca — è accettabile; se in futuro
 * LibrePM ospitasse progetti riservati fra loro, servirà un controllo di
 * appartenenza al progetto analogo a {@link OwnUserAuthorizationManager}.
 *
 * @since 0.2.0
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@Profile("cloud")
public class CloudSecurityConfig {

    /**
     * Ruoli che possono entrare nella sezione bandi.
     *
     * <p>Sono i ruoli operativi del sito ({@code sito/src/data/admin.ts}), gli
     * stessi che il gestionale ammette. Fuori dall'elenco restano di proposito
     * {@code socio} e {@code volontario}: la governance dei bandi non li
     * riguarda, e il loro token resta valido senza però aprire nulla.
     *
     * <p>Senza prefisso {@code ROLE_}, che {@code hasAnyRole} aggiunge da sé.
     */
    private static final String[] OPERATIONAL_ROLES = {
        "PRESIDENTE",
        "COORDINATORE_SERVIZI",
        "RESPONSABILE_AMMINISTRATIVO",
        "REFERENTE_VOLONTARI",
        "PSICOLOGO",
        "OPERATORE_ALIMENTARE",
        "ORIENTATORE_SERVIZI",
        "FACILITATORE_DIGITALE"
    };

    /** Chi governa progetti e candidature: bandi, fasi, revisioni, portafoglio. */
    private static final String[] GOVERNANCE_ROLES = {
        "PRESIDENTE",
        "COORDINATORE_SERVIZI",
        "RESPONSABILE_AMMINISTRATIVO"
    };

    /** Chi vede i soldi: budget, costi, rendicontazione, donatori, sponsor. */
    private static final String[] FINANCE_ROLES = {
        "PRESIDENTE",
        "RESPONSABILE_AMMINISTRATIVO"
    };

    private final ClerkProperties clerkProperties;
    private final ClerkIdentityService identityService;
    private final List<String> allowedOrigins;

    public CloudSecurityConfig(
            ClerkProperties clerkProperties,
            ClerkIdentityService identityService,
            @Value("${librepm.cors.allowed-origins:}") List<String> allowedOrigins) {
        this.clerkProperties = clerkProperties;
        this.identityService = identityService;
        this.allowedOrigins = allowedOrigins.stream().filter(origin -> !origin.isBlank()).toList();

        if (clerkProperties.getIssuerUri() == null || clerkProperties.getIssuerUri().isBlank()) {
            throw new IllegalStateException(
                    "librepm.clerk.issuer-uri non configurato: senza issuer i token non sono "
                            + "verificabili e il profilo cloud non può partire.");
        }
        if (this.allowedOrigins.isEmpty() || this.allowedOrigins.contains("*")) {
            throw new IllegalStateException(
                    "librepm.cors.allowed-origins deve elencare le origini esatte della sezione "
                            + "bandi: '*' su un backend pubblico espone l'API a qualsiasi sito.");
        }
    }

    @Bean
    SecurityFilterChain cloudSecurityFilterChain(HttpSecurity http) throws Exception {
        http.cors(cors -> cors.configurationSource(cloudCorsConfigurationSource()));
        http.csrf(AbstractHttpConfigurer::disable);
        http.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/error", "/actuator/health", "/actuator/info").permitAll()

                // Vie d'ingresso alternative a Clerk, o operazioni che hanno senso
                // solo su un'installazione personale.
                .requestMatchers("/api/auth/**", "/oauth2/**", "/login/**").denyAll()
                .requestMatchers("/api/bootstrap/**").denyAll()
                .requestMatchers("/api/db/**").denyAll()
                .requestMatchers("/api/sync/**").denyAll()
                .requestMatchers("/api/diagnostics/**").denyAll()
                // La descrizione completa delle API su un backend pubblico è una
                // mappa per chi cerca una porta aperta: resta nel profilo desktop.
                .requestMatchers("/api/docs/**", "/v3/api-docs/**", "/swagger-ui/**").denyAll()

                // Chi sono io. Aperto a qualunque ruolo autenticato perché non
                // espone dati di terzi: il soggetto lo decide il token, mai un
                // parametro della richiesta. È il primo endpoint che la SPA
                // chiama, per sapere quale userId usare nei percorsi seguenti.
                .requestMatchers(HttpMethod.GET, "/api/me").authenticated()

                // L'elenco di tutti i profili è la rubrica dell'associazione.
                // Va prima della regola per utente, che altrimenti lo intercetta.
                .requestMatchers(HttpMethod.GET, "/api/users").hasRole("PRESIDENTE")

                /*
                 * Il cuore della protezione. Non basta il ruolo: queste API
                 * prendono il soggetto dall'URL, quindi va verificato che
                 * l'identificativo richiesto sia quello di chi chiama. Il
                 * presidente è l'eccezione, come nel gestionale.
                 */
                .requestMatchers("/api/users/{userId}/**").access(ownUserAccess())

                // API di progetto senza identificativo dell'utente: qui la
                // barriera è il ruolo. Vedi il limite noto in testa alla classe.
                .requestMatchers("/api/projects/{projectId}/finance/**",
                        "/api/projects/{projectId}/grants/**")
                    .hasAnyRole(FINANCE_ROLES)
                .requestMatchers("/api/projects/**").hasAnyRole(GOVERNANCE_ROLES)
                .requestMatchers("/api/programmes/**").hasAnyRole(GOVERNANCE_ROLES)
                .requestMatchers("/api/rate-cards/**").hasAnyRole(FINANCE_ROLES)

                // Anagrafiche condivise del workspace: chi lavora ai bandi le
                // legge e le scrive, gli altri no.
                .requestMatchers("/api/tags/**", "/api/task-statuses/**",
                        "/api/task-priorities/**", "/api/notes/**", "/api/note-links/**",
                        "/api/asset-links/**", "/api/assignments/**", "/api/time-entries/**",
                        "/api/effort-estimates/**", "/api/events/**", "/api/search/**",
                        "/api/calendar/**", "/api/calendars/**", "/api/teams/**",
                        "/api/connections/**", "/api/notifications/**")
                    .hasAnyRole(GOVERNANCE_ROLES)

                // Registro dei trattamenti, audit, criteri di importazione,
                // impostazioni del workspace: governo dell'installazione.
                .requestMatchers("/api/audit/**", "/api/compliance/**",
                        "/api/settings/**", "/api/roles/**",
                        "/api/workspace-profiles/**", "/api/import-mapping-profiles/**")
                    .hasRole("PRESIDENTE")

                // Un endpoint nuovo non diventa accessibile per errore: finché
                // non gli si assegna un reparto, è del solo presidente.
                .requestMatchers("/api/**").hasRole("PRESIDENTE")
                .anyRequest().denyAll()
        );

        http.oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(new ClerkRoleConverter(clerkProperties)))
        );
        http.addFilterAfter(new CloudUserIdentityFilter(identityService), BearerTokenAuthenticationFilter.class);

        http.httpBasic(AbstractHttpConfigurer::disable);
        http.formLogin(AbstractHttpConfigurer::disable);
        http.logout(AbstractHttpConfigurer::disable);

        return http.build();
    }

    /**
     * Ruolo operativo <em>e</em> proprietà del percorso: le due condizioni
     * insieme, perché da sole non bastano. Il ruolo non dice su chi si opera, e
     * la proprietà del percorso non dice se quella persona ha titolo per entrare
     * nella sezione bandi.
     */
    private AuthorizationManager<RequestAuthorizationContext> ownUserAccess() {
        return AuthorizationManagers.allOf(
                AuthorityAuthorizationManager.hasAnyRole(OPERATIONAL_ROLES),
                new OwnUserAuthorizationManager(identityService));
    }

    @Bean
    JwtDecoder cloudJwtDecoder() {
        NimbusJwtDecoder decoder = (NimbusJwtDecoder) JwtDecoders
                .fromIssuerLocation(clerkProperties.getIssuerUri());
        decoder.setJwtValidator(cloudJwtValidator());
        return decoder;
    }

    OAuth2TokenValidator<Jwt> cloudJwtValidator() {
        String audience = clerkProperties.getAudience();
        if (audience != null && !audience.isBlank()) {
            return JwtValidators.createDefaultWithValidators(
                    new JwtIssuerValidator(clerkProperties.getIssuerUri()), new AudienceValidator(audience));
        }
        return JwtValidators.createDefaultWithIssuer(clerkProperties.getIssuerUri());
    }

    @Bean
    CorsConfigurationSource cloudCorsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        // X-User-Id lo manda il client storico di LibrePM. Non è una credenziale
        // e il backend non lo usa per autorizzare — chi sei lo dice il token —
        // ma se non è dichiarato qui il browser blocca la richiesta in preflight.
        configuration.setAllowedHeaders(List.of(
                "Authorization", "Content-Type", "Accept", "X-User-Id"));
        configuration.setExposedHeaders(List.of("Content-Disposition"));
        // Con i Bearer token non servono cookie: tenere false evita di dover
        // scegliere fra credenziali e origini larghe.
        configuration.setAllowCredentials(false);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
