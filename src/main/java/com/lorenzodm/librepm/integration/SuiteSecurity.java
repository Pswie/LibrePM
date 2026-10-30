package com.lorenzodm.librepm.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lorenzodm.librepm.core.entity.User;
import com.lorenzodm.librepm.repository.UserRepository;
import com.lorenzodm.librepm.security.AuthProperties;
import com.lorenzodm.librepm.security.CurrentUserUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@Configuration
@EnableScheduling
class SuiteSecurity {
    @Bean @Order(1)
    SecurityFilterChain suitePeerSecurity(HttpSecurity http, SuiteConfig config, ObjectMapper mapper) throws Exception {
        http.securityMatcher("/api/integrations/v1/peer/**")
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .addFilterBefore(new PeerFilter(config, mapper), AnonymousAuthenticationFilter.class);
        return http.build();
    }
    static final class PeerFilter extends OncePerRequestFilter {
        private final SuiteConfig config;
        private final ObjectMapper mapper;
        PeerFilter(SuiteConfig config, ObjectMapper mapper) { this.config = config; this.mapper = mapper; }
        @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                throws ServletException, IOException {
            try {
                String org;
                try { org = config.organization(); }
                catch (SuiteException ex) { throw SuiteException.unavailable("Organizzazione di integrazione non configurata."); }
                String peer = req.getHeader("X-Suite-Peer");
                String expected = config.key(peer);
                String supplied = req.getHeader("X-Suite-Key");
                if (supplied == null || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8)))
                    throw new SuiteException(401, "SUITE_PEER_AUTH", "Credenziali di integrazione non valide.");
                if (!org.equals(req.getHeader("X-Suite-Organization")))
                    throw new SuiteException(403, "SUITE_ORGANIZATION", "Organizzazione non autorizzata.");
                req.setAttribute("suite.peer", peer);
                chain.doFilter(req, res);
            } catch (SuiteException e) {
                res.setStatus(e.status()); res.setContentType("application/json");
                mapper.writeValue(res.getOutputStream(), Map.of("code", e.code(), "message", e.getMessage()));
            }
        }
    }
}

@Component
class SuiteActorResolver {
    record Actor(String userId, boolean finance) {}
    private final UserRepository users;
    private final Environment env;
    private final AuthProperties auth;
    SuiteActorResolver(UserRepository users, Environment env, AuthProperties auth) { this.users = users; this.env = env; this.auth = auth; }
    Actor resolve(HttpServletRequest req) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean cloud = env.matchesProfiles("cloud");
        String id;
        boolean finance;
        if (cloud) {
            if (!(authentication instanceof JwtAuthenticationToken jwt)) throw new SuiteException(401, "SUITE_AUTH", "Accesso richiesto.");
            User user = users.findByClerkUserId(jwt.getToken().getSubject())
                    .orElseThrow(() -> new SuiteException(403, "SUITE_AUTH", "Profilo utente non collegato."));
            id = user.getId();
            finance = authentication.getAuthorities().stream().anyMatch(a -> java.util.Set.of("ROLE_PRESIDENTE", "ROLE_RESPONSABILE_AMMINISTRATIVO").contains(a.getAuthority()));
        } else if (auth.isEnabled()) {
            id = CurrentUserUtils.getUserIdOrNull().orElseThrow(() -> new SuiteException(401, "SUITE_AUTH", "Accesso richiesto."));
            finance = true;
        } else {
            // Desktop profile picker is only trusted on the local embedded backend.
            if (!java.util.Set.of("127.0.0.1", "0:0:0:0:0:0:0:1", "::1").contains(req.getRemoteAddr()))
                throw new SuiteException(403, "SUITE_AUTH", "Il profilo locale richiede una connessione locale.");
            id = req.getHeader("X-User-Id"); finance = true;
        }
        User user = id == null ? null : users.findById(id).orElse(null);
        if (user == null || !user.isActive() || user.isGhost()) throw new SuiteException(403, "SUITE_AUTH", "Profilo utente non valido.");
        return new Actor(id, finance);
    }
}
