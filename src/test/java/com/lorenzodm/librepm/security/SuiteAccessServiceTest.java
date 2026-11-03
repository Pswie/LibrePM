package com.lorenzodm.librepm.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.oauth2.jwt.Jwt;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class SuiteAccessServiceTest {
    final ObjectMapper mapper = new ObjectMapper();
    final AtomicReference<ObjectNode> response = new AtomicReference<>();
    final AtomicInteger status = new AtomicInteger(200), calls = new AtomicInteger();
    HttpServer server;
    SuiteAccessService service;
    @BeforeEach void setup() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/access/v1/me", exchange -> {
            calls.incrementAndGet();
            assertEquals("Bearer fixture.token", exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] raw = mapper.writeValueAsBytes(response.get());
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status.get(), raw.length);
            try (var output = exchange.getResponseBody()) { output.write(raw); }
        });
        server.start();
        service = new SuiteAccessService(new MockEnvironment().withProperty("SUITE_ACCESS_ENABLED", "true")
                .withProperty("SUITE_ACCESS_API_URL", "http://127.0.0.1:" + server.getAddress().getPort())
                .withProperty("SUITE_ACCESS_OWNER_SUBJECT", "user_ownerFixture"), mapper);
        response.set(view("active", List.of("librepm.projects.read")));
    }
    @AfterEach void close() { server.stop(0); }
    ObjectNode view(String state, List<String> permissions) {
        ObjectNode body = mapper.createObjectNode();
        body.put("schemaVersion", 1).put("subject", "user_viewerFixture").put("status", state).put("owner", false).put("canManageAccess", false).put("version", 1);
        var apps = body.putObject("applications");
        for (String app : List.of("associago", "librepm", "bandi")) {
            boolean active = app.equals("librepm") && state.equals("active") && !permissions.isEmpty();
            var assignment = apps.putObject(app).put("enabled", active).put("role", active ? "viewer" : "none");
            var list = assignment.putArray("permissions");
            if (active) permissions.forEach(list::add);
        }
        var list = body.putArray("permissions");
        if (state.equals("active")) permissions.forEach(list::add);
        return body;
    }
    Jwt jwt() { return Jwt.withTokenValue("fixture.token").header("alg", "RS256").subject("user_viewerFixture").claim("role", "org:admin").build(); }
    @Test void revocationIsObservedWithTheSameJwtAndNoCrossRequestCache() {
        assertTrue(service.fetch(jwt()).allows("projects", false));
        response.set(view("suspended", List.of()));
        var revoked = service.fetch(jwt());
        assertFalse(revoked.appEnabled());
        assertFalse(revoked.owner());
        assertEquals(2, calls.get());
    }
    @Test void authorityFailureNeverFallsBackToTheAdminJwt() {
        status.set(503);
        assertEquals(503, assertThrows(SuiteAccessService.AccessFailure.class, () -> service.fetch(jwt())).status);
    }
    @Test void redirectIsNotFollowed() {
        status.set(302);
        assertThrows(SuiteAccessService.AccessFailure.class, () -> service.fetch(jwt()));
        assertEquals(1, calls.get());
    }
    @Test void mismatchedSubjectAndForgedOwnerAreRejected() {
        response.get().put("subject", "user_someoneElse");
        assertThrows(SuiteAccessService.AccessFailure.class, () -> service.fetch(jwt()));
        response.set(view("active", List.of("librepm.projects.read")));
        response.get().put("owner", true).put("canManageAccess", true);
        assertThrows(SuiteAccessService.AccessFailure.class, () -> service.fetch(jwt()));
    }
    @Test void unknownPermissionsAndWriteWithoutReadAreRejected() {
        response.set(view("active", List.of("librepm.secret.read")));
        assertThrows(SuiteAccessService.AccessFailure.class, () -> service.fetch(jwt()));
        response.set(view("active", List.of("librepm.finance.write")));
        assertThrows(SuiteAccessService.AccessFailure.class, () -> service.fetch(jwt()));
    }
    @Test void originCannotContainCredentialsPathsOrRemotePlainHttp() {
        for (String origin : List.of("http://example.com", "https://user:password@example.com", "https://example.com/path", "https://example.com?key=value"))
            assertThrows(IllegalStateException.class, () -> SuiteAccessService.validOrigin(origin));
        assertEquals("https://example.com", SuiteAccessService.validOrigin("https://example.com/"));
    }
}
