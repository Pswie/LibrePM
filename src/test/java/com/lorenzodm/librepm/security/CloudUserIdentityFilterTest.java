package com.lorenzodm.librepm.security;

import com.lorenzodm.librepm.core.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CloudUserIdentityFilterTest {
    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void forgedHeaderIsReplacedForControllersAndArgumentResolversIncludingPresident() throws Exception {
        ClerkIdentityService identities = mock(ClerkIdentityService.class);
        var token = new JwtAuthenticationToken(jwt("https://issuer.example"),
                List.of(new SimpleGrantedAuthority("ROLE_PRESIDENTE")));
        SecurityContextHolder.getContext().setAuthentication(token);
        User user = new User();
        user.setId("verified-user");
        when(identities.resolve(token)).thenReturn(Optional.of(user));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/notes");
        request.addHeader("X-User-Id", "victim");
        request.addHeader("Accept", "application/json");
        AtomicBoolean invoked = new AtomicBoolean();

        new CloudUserIdentityFilter(identities).doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            HttpServletRequest wrapped = (HttpServletRequest) req;
            assertEquals("verified-user", wrapped.getHeader("x-user-id"));
            assertEquals(List.of("verified-user"), Collections.list(wrapped.getHeaders("X-User-Id")));
            assertEquals("application/json", wrapped.getHeader("Accept"));
            assertTrue(Collections.list(wrapped.getHeaderNames()).contains("X-User-Id"));
            invoked.set(true);
        });
        assertTrue(invoked.get());
    }

    @Test
    void unresolvedAuthenticatedIdentityCannotUseClientHeader() throws Exception {
        ClerkIdentityService identities = mock(ClerkIdentityService.class);
        var token = new JwtAuthenticationToken(jwt("https://issuer.example"));
        SecurityContextHolder.getContext().setAuthentication(token);
        when(identities.resolve(token)).thenReturn(Optional.empty());
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean invoked = new AtomicBoolean();
        new CloudUserIdentityFilter(identities).doFilter(new MockHttpServletRequest("GET", "/api/search"),
                response, (req, res) -> invoked.set(true));
        assertEquals(403, response.getStatus());
        assertFalse(invoked.get());
    }

    @Test
    void audienceValidationStillRejectsATokenFromAnotherIssuer() {
        ClerkProperties properties = new ClerkProperties();
        properties.setIssuerUri("https://issuer.example");
        properties.setAudience("librepm");
        CloudSecurityConfig config = new CloudSecurityConfig(properties, mock(ClerkIdentityService.class),
                mock(SuiteAccessService.class), new com.fasterxml.jackson.databind.ObjectMapper(),
                mock(com.lorenzodm.librepm.repository.ProjectRepository.class), mock(com.lorenzodm.librepm.repository.ProjectMemberRepository.class),
                List.of("https://app.example"));
        assertFalse(config.cloudJwtValidator().validate(jwt("https://issuer.example")).hasErrors());
        assertTrue(config.cloudJwtValidator().validate(jwt("https://attacker.example")).hasErrors());
    }

    private Jwt jwt(String issuer) {
        return Jwt.withTokenValue("signed-token").header("alg", "RS256").subject("clerk-user")
                .issuer(issuer).audience(List.of("librepm")).build();
    }
}
