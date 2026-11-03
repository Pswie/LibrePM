package com.lorenzodm.librepm.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SuiteAccessFilterTest {
    final SuiteAccessService service = mock(SuiteAccessService.class);
    final Jwt jwt = Jwt.withTokenValue("fixture.token").header("alg", "RS256").subject("user_fixture").claim("role", "org:admin").build();
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    MockHttpServletResponse call(String path, SuiteAccessService.AccessView view, AtomicBoolean invoked) throws Exception {
        when(service.enabled()).thenReturn(true);
        when(service.fetch(jwt)).thenReturn(view);
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_PRESIDENTE"))));
        var response = new MockHttpServletResponse();
        new SuiteAccessFilter(service, new ObjectMapper()).doFilter(new MockHttpServletRequest("GET", path), response, (req, res) -> invoked.set(true));
        return response;
    }
    @Test void previousJwtAdminAuthoritiesAreReplacedRatherThanMerged() throws Exception {
        var invoked = new AtomicBoolean();
        call("/api/users/self/projects", new SuiteAccessService.AccessView(null, "user_fixture", "active", false, true, "viewer", Set.of("librepm.projects.read")), invoked);
        assertTrue(invoked.get());
        assertEquals(List.of("SCOPE_librepm.projects.read"), SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream().map(Object::toString).toList());
    }
    @Test void pendingRegistrationCanOnlyReachMe() throws Exception {
        var view = new SuiteAccessService.AccessView(null, "user_fixture", "pending", false, false, "none", Set.of());
        var me = new AtomicBoolean();
        call("/api/me", view, me);
        assertTrue(me.get());
        var data = new AtomicBoolean();
        assertEquals(403, call("/api/users/self/projects", view, data).getStatus());
        assertFalse(data.get());
    }
    @Test void authorityFailureDoesNotReachApplicationData() throws Exception {
        when(service.enabled()).thenReturn(true);
        when(service.fetch(jwt)).thenThrow(new SuiteAccessService.AccessFailure(503, "ACCESS_AUTHORITY_UNAVAILABLE"));
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
        var response = new MockHttpServletResponse(); var invoked = new AtomicBoolean();
        new SuiteAccessFilter(service, new ObjectMapper()).doFilter(new MockHttpServletRequest("GET", "/api/me"), response, (req, res) -> invoked.set(true));
        assertFalse(invoked.get()); assertEquals(503, response.getStatus());
        assertFalse(response.getContentAsString().contains("fixture.token"));
    }
}
