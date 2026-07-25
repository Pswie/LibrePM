package com.lorenzodm.librepm.security;

import com.lorenzodm.librepm.core.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le regole di accesso del profilo {@code cloud}.
 *
 * <p>Presidia due difetti distinti, entrambi conseguenza del passaggio da
 * applicazione desktop a servizio condiviso.
 *
 * <p>Il primo: nella configurazione originale, con
 * {@code librepm.auth.enabled=false}, ogni endpoint era {@code permitAll()}. Su
 * un URL pubblico significa progetti, budget e anagrafiche leggibili da chiunque
 * conosca l'indirizzo.
 *
 * <p>Il secondo, più insidioso: quasi tutte le API hanno la forma
 * {@code /api/users/{userId}/...} e prendono il soggetto dall'URL. Un token
 * valido con un ruolo legittimo, ma con l'identificativo di un'altra persona nel
 * percorso, deve essere rifiutato. È il caso che nessuna regola basata sui soli
 * ruoli intercetta, ed è quello che verifica {@link #otherUsersDataIsDenied()}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("cloud")
@TestPropertySource(properties = {
    "librepm.clerk.issuer-uri=https://esempio.clerk.accounts.dev",
    "librepm.cors.allowed-origins=https://esempio.org",
    "spring.datasource.url=jdbc:h2:mem:auth-rules;DB_CLOSE_DELAY=-1;MODE=MySQL",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.flyway.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=true",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect"
})
@DisplayName("Profilo cloud: regole di accesso")
class CloudSecurityRulesTest {

    private static final String PROPRIETARIO = "11111111-1111-1111-1111-111111111111";
    private static final String ESTRANEO = "22222222-2222-2222-2222-222222222222";

    /**
     * Sostituisce il decoder reale, che all'avvio contatterebbe il JWKS di
     * Clerk. I test usano {@code .with(jwt())}, che inietta l'autenticazione
     * senza passare dalla verifica della firma: qui interessano le regole di
     * accesso, non la crittografia.
     */
    @MockitoBean
    JwtDecoder jwtDecoder;

    /**
     * Sostituisce la risoluzione dell'identità, che altrimenti cercherebbe — e
     * creerebbe — righe nel database. Chi chiama è sempre {@link #PROPRIETARIO}.
     */
    @MockitoBean
    ClerkIdentityService identityService;

    @Autowired
    MockMvc mockMvc;

    private void callerIsOwner() {
        User caller = new User();
        caller.setId(PROPRIETARIO);
        caller.setUsername("proprietario");
        given(identityService.resolve(any(Authentication.class))).willReturn(Optional.of(caller));
    }

    /** Token con un solo ruolo applicativo, senza passare dal convertitore. */
    private static RequestPostProcessor comeRuolo(String ruolo) {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_" + ruolo));
    }

    /**
     * «Qualunque cosa tranne 403»: interessa che la barriera di autorizzazione
     * lasci passare, non che l'endpoint dietro funzioni — con lo schema H2 vuoto
     * può rispondere 404 o 500, e sarebbe comunque la risposta di qualcosa che è
     * stato raggiunto.
     */
    private static ResultMatcher nonVietato() {
        return result -> {
            int actual = result.getResponse().getStatus();
            if (actual == 403) {
                throw new AssertionError("La richiesta è stata vietata, ma doveva passare la barriera.");
            }
        };
    }

    @Test
    @DisplayName("senza token le API rispondono 401, non 200")
    void apiRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/users/" + PROPRIETARIO + "/projects"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("il controllo di salute resta pubblico")
    void healthStaysPublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("i propri dati sono accessibili con un ruolo operativo")
    void ownDataIsAllowed() throws Exception {
        callerIsOwner();
        mockMvc.perform(get("/api/users/" + PROPRIETARIO + "/projects")
                        .with(comeRuolo("COORDINATORE_SERVIZI")))
                .andExpect(nonVietato());
    }

    @Test
    @DisplayName("i dati di un altro utente sono negati, anche con un ruolo valido")
    void otherUsersDataIsDenied() throws Exception {
        callerIsOwner();
        mockMvc.perform(get("/api/users/" + ESTRANEO + "/projects")
                        .with(comeRuolo("COORDINATORE_SERVIZI")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("il presidente puo' operare anche sui dati altrui")
    void presidentReachesEveryone() throws Exception {
        callerIsOwner();
        mockMvc.perform(get("/api/users/" + ESTRANEO + "/projects")
                        .with(comeRuolo("PRESIDENTE")))
                .andExpect(nonVietato());
    }

    @Test
    @DisplayName("un socio non entra nella sezione bandi")
    void memberIsNotAdmitted() throws Exception {
        callerIsOwner();
        mockMvc.perform(get("/api/users/" + PROPRIETARIO + "/projects")
                        .with(comeRuolo("SOCIO")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("l'onboarding senza autenticazione resta chiuso anche al presidente")
    void bootstrapIsClosed() throws Exception {
        mockMvc.perform(post("/api/bootstrap/create-user").with(comeRuolo("PRESIDENTE")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("l'import del database resta chiuso anche al presidente")
    void databaseImportIsClosed() throws Exception {
        mockMvc.perform(post("/api/db/import").with(comeRuolo("PRESIDENTE")))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("l'elenco di tutti i profili e' del solo presidente")
    void userDirectoryIsPresidentOnly() throws Exception {
        mockMvc.perform(get("/api/users").with(comeRuolo("COORDINATORE_SERVIZI")))
                .andExpect(status().isForbidden());
    }
}
