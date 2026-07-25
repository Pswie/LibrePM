package com.lorenzodm.librepm.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * Secondo registro CORS di desktop e sviluppo: mappa {@code /**} con
 * {@code allowCredentials=true}.
 *
 * <p>Escluso dal profilo {@code cloud} per lo stesso motivo di
 * {@link CorsConfig}, e con una ragione in più: qui le credenziali sono attive
 * su origini con wildcard, che è la combinazione da cui i browser proteggono
 * proprio perché permette a un sito qualunque di agire a nome dell'utente.
 */
@Configuration
@Profile("!cloud")
public class WebCorsConfig implements WebMvcConfigurer {

    private final CorsProperties corsProperties;

    public WebCorsConfig(CorsProperties corsProperties) {
        this.corsProperties = corsProperties;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        List<String> patterns = corsProperties.getAllowedOrigins();
        String[] patternsArray = patterns.toArray(new String[0]);

        registry.addMapping("/**")
                .allowedOriginPatterns(patternsArray)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Content-Disposition")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
