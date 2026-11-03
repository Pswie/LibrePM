package com.lorenzodm.librepm.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Map;

/** Only installed in the JWT cloud chain: service peer authentication is unchanged. */
final class SuiteAccessFilter extends OncePerRequestFilter {
    private final SuiteAccessService service;
    private final ObjectMapper mapper;
    SuiteAccessFilter(SuiteAccessService service, ObjectMapper mapper) { this.service = service; this.mapper = mapper; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (!service.enabled() || !(SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken jwt)
                || !path.startsWith("/api/")) { chain.doFilter(request, response); return; }
        try {
            var view = service.fetch(jwt.getToken());
            request.setAttribute(SuiteAccessService.ATTRIBUTE, view);
            var authorities = new ArrayList<SimpleGrantedAuthority>();
            view.permissions().forEach(permission -> authorities.add(new SimpleGrantedAuthority("SCOPE_" + permission)));
            if (view.owner()) authorities.add(new SimpleGrantedAuthority("ROLE_PRESIDENTE"));
            SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt.getToken(), authorities, jwt.getName()));
            if (!("GET".equals(request.getMethod()) && path.equals("/api/me")) && (!"active".equals(view.status()) || !view.appEnabled())) {
                response.setStatus(403); response.setContentType("application/json");
                mapper.writeValue(response.getOutputStream(), Map.of("code", "ACCESS_NOT_ENABLED", "message", "Accesso non abilitato per Progetti.")); return;
            }
            chain.doFilter(request, response);
        } catch (SuiteAccessService.AccessFailure failure) {
            response.setStatus(failure.status); response.setContentType("application/json");
            mapper.writeValue(response.getOutputStream(), Map.of("code", failure.code, "message", "Non è stato possibile verificare gli accessi. Riprova tra poco."));
        }
    }
}
