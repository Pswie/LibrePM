package com.lorenzodm.librepm.security;

import com.lorenzodm.librepm.core.entity.User;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

/** Bridges legacy identity headers to the verified cloud identity, never client input. */
final class CloudUserIdentityFilter extends OncePerRequestFilter {
    private static final String HEADER = CurrentUserArgumentResolver.USER_ID_HEADER;
    private final ClerkIdentityService identityService;

    CloudUserIdentityFilter(ClerkIdentityService identityService) {
        this.identityService = identityService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (!(authentication instanceof JwtAuthenticationToken) || !path.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }
        Optional<User> caller = identityService.resolve(authentication);
        if (caller.isEmpty()) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Identità utente non risolvibile");
            return;
        }
        String callerId = caller.get().getId();
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override
            public String getHeader(String name) {
                return HEADER.equalsIgnoreCase(name) ? callerId : super.getHeader(name);
            }

            @Override
            public Enumeration<String> getHeaders(String name) {
                return HEADER.equalsIgnoreCase(name)
                        ? Collections.enumeration(Collections.singleton(callerId)) : super.getHeaders(name);
            }

            @Override
            public Enumeration<String> getHeaderNames() {
                Set<String> names = new LinkedHashSet<>(Collections.list(super.getHeaderNames()));
                names.removeIf(HEADER::equalsIgnoreCase);
                names.add(HEADER);
                return Collections.enumeration(names);
            }
        }, response);
    }
}
