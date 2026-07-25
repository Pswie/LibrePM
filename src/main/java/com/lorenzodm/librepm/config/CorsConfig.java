package com.lorenzodm.librepm.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.List;

/**
 * CORS di desktop e sviluppo, dove sono ammessi anche {@code localhost} con
 * porta qualsiasi e {@code file://}.
 *
 * <p>Escluso dal profilo {@code cloud}: là le origini le decide
 * {@code CloudSecurityConfig} a partire da un elenco esatto. I pattern con
 * wildcard sono comodi in locale e su un backend pubblico aprirebbero l'API a
 * qualsiasi sito.
 */
@Configuration
@Profile("!cloud")
@EnableConfigurationProperties(LibrePMCorsProperties.class)
public class CorsConfig implements WebMvcConfigurer {

    private final LibrePMCorsProperties cors;

    public CorsConfig(LibrePMCorsProperties cors) {
        this.cors = cors;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        List<String> exactOrigins = new ArrayList<>();
        List<String> originPatterns = new ArrayList<>();

        for (String origin : cors.getAllowedOrigins()) {
            if (origin == null) continue;
            String o = origin.trim();
            if (o.isEmpty()) continue;

            // Se contiene wildcard, trattala come "pattern"
            if (o.contains("*") || o.contains("?")) {
                originPatterns.add(o);
            } else {
                exactOrigins.add(o);
            }
        }

        var reg = registry.addMapping("/api/**")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(cors.isAllowCredentials())
                .maxAge(cors.getMaxAgeSeconds());

        // Importante: non usare allowedOrigins con wildcard, altrimenti problemi con credenziali
        if (!exactOrigins.isEmpty()) {
            reg.allowedOrigins(exactOrigins.toArray(new String[0]));
        }
        if (!originPatterns.isEmpty()) {
            reg.allowedOriginPatterns(originPatterns.toArray(new String[0]));
        }
    }
}
