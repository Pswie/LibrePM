package com.lorenzodm.librepm.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

/**
 * Configurazione Spring Security per LibrePM
 *
 * <p>Vale per desktop e sviluppo. Il profilo {@code cloud} è escluso e usa
 * {@link CloudSecurityConfig}: con {@code librepm.auth.enabled=false} questa
 * catena apre ogni endpoint, che è comodo in locale e inaccettabile su un URL
 * pubblico. L'esclusione è esplicita perché, senza, sarebbero due catene in
 * concorrenza e vincerebbe la più permissiva.
 *
 * @author Lorenzo DM
 * @since 1.0.0
 * @updated 0.3.0 - Aggiunti endpoint bootstrap accessibili senza auth
 * @updated 0.2.0 (fork Angeli del Futuro) - Limitata ai profili non cloud
 */
@Configuration
@EnableWebSecurity
@Profile("!cloud")
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            OAuth2UserProvisioningService oauth2UserProvisioningService,
            AuthProperties authProperties
    ) throws Exception {

        http.cors(Customizer.withDefaults());

        // Se auth disabilitata (desktop/dev) -> permetti tutto per non bloccare lo sviluppo,
        // ma manteniamo CSRF off perché non ha senso senza sessione.
        if (!authProperties.isEnabled()) {
            http.csrf(csrf -> csrf.disable());
            http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
            http.httpBasic(basic -> basic.disable());
            return http.build();
        }

        // Auth abilitata -> session-based con CSRF cookie (XSRF-TOKEN)
        http.csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
        );

        http.authorizeHttpRequests(auth -> auth
                // Endpoint pubblici (sempre accessibili)
                .requestMatchers(
                        "/error",
                        "/actuator/health",
                        "/actuator/info",
                        "/api/auth/login-url",
                        "/api/auth/csrf",
                        "/api/health"
                ).permitAll()
                // Endpoint bootstrap (accessibili senza autenticazione per onboarding)
                .requestMatchers(
                        "/api/bootstrap",
                        "/api/bootstrap/**"
                ).permitAll()
                // Endpoint users base (per lista profili)
                .requestMatchers(
                        "/api/users"
                ).permitAll()
                // OAuth2 e login
                .requestMatchers("/oauth2/**", "/login/**").permitAll()
                // Tutti gli altri endpoint API richiedono autenticazione
                .requestMatchers("/api/**").authenticated()
                // Richieste statiche (frontend) sempre permesse
                .anyRequest().permitAll()
        );

        http.oauth2Login(oauth2 -> oauth2
                .userInfoEndpoint(userInfo -> userInfo.userService(oauth2UserProvisioningService))
                .successHandler(new OAuth2LoginSuccessHandler(authProperties))
        );

        http.logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .deleteCookies("JSESSIONID", "XSRF-TOKEN")
                .invalidateHttpSession(true)
        );

        http.httpBasic(basic -> basic.disable());

        return http.build();
    }
}