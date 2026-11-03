package com.lorenzodm.librepm.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.env.Environment;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;

/** Authoritative access is fetched for each request; JWT roles are not a fallback. */
@Service
public class SuiteAccessService {
    public static final String ATTRIBUTE = SuiteAccessService.class.getName() + ".view";
    public static final Set<String> PROJECT_MODULES = Set.of("dashboard", "inbox", "charter", "projects", "templates", "team", "resources", "connections", "calendar", "planner", "gantt", "kanban", "notes", "time-tracking", "finance", "grants", "stakeholders", "change-control", "portfolio", "guides", "analytics", "integrations", "sync-conflicts", "settings");
    private static final Map<String, Set<String>> MODULES = Map.of(
            "associago", Set.of("dashboard", "finance", "members", "activities", "events", "attendance", "volunteers", "projects", "inventory", "communications", "certificates", "assemblies", "personal", "settings"),
            "librepm", PROJECT_MODULES,
            "bandi", Set.of("catalog", "sources", "drafts", "projects", "settings"));
    private static final Set<String> ROLES = Set.of("none", "viewer", "editor", "manager", "custom");
    private final boolean enabled;
    private final String origin;
    private final String ownerSubject;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build();

    public SuiteAccessService(Environment environment, ObjectMapper mapper) {
        this.enabled = Boolean.parseBoolean(environment.getProperty("SUITE_ACCESS_ENABLED", "false"));
        this.origin = enabled ? validOrigin(environment.getProperty("SUITE_ACCESS_API_URL", "")) : "";
        this.ownerSubject = environment.getProperty("SUITE_ACCESS_OWNER_SUBJECT", "");
        if (enabled && !ownerSubject.matches("user_[A-Za-z0-9_-]{3,200}")) throw new IllegalStateException("SUITE_ACCESS_OWNER_SUBJECT non configurato.");
        this.mapper = mapper;
    }

    public boolean enabled() { return enabled; }
    public String origin() { return origin; }

    public static String validOrigin(String value) {
        try {
            URI uri = URI.create(value);
            boolean local = Set.of("localhost", "127.0.0.1", "[::1]", "::1").contains(uri.getHost() == null ? "" : uri.getHost());
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || !(uri.getPath().isEmpty() || uri.getPath().equals("/")) || uri.getPort() == 0 || uri.getPort() > 65535
                    || !("https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme())))) throw new IllegalArgumentException();
            return value.replaceAll("/$", "");
        } catch (IllegalArgumentException error) { throw new IllegalStateException("SUITE_ACCESS_API_URL deve essere un'origine HTTPS esplicita."); }
    }

    public AccessView fetch(Jwt jwt) {
        if (!enabled || jwt == null || jwt.getSubject() == null || !jwt.getSubject().matches("user_[A-Za-z0-9_-]{3,200}")) throw new AccessFailure(401, "ACCESS_AUTH");
        String bearer = jwt.getTokenValue();
        if (bearer == null || bearer.length() > 65536 || !bearer.matches("[A-Za-z0-9._-]+")) throw new AccessFailure(401, "ACCESS_AUTH");
        HttpRequest request = HttpRequest.newBuilder(URI.create(origin + "/api/access/v1/me"))
                .timeout(Duration.ofSeconds(8)).header("Authorization", "Bearer " + bearer).header("Accept", "application/json").GET().build();
        CompletableFuture<HttpResponse<byte[]>> pending = http.sendAsync(request, info -> new LimitedBody());
        try {
            HttpResponse<byte[]> response = pending.get(10, TimeUnit.SECONDS);
            if (response.statusCode() != 200) throw new AccessFailure(response.statusCode() == 401 ? 401 : 503, "ACCESS_AUTHORITY_UNAVAILABLE");
            return validate(mapper.readTree(response.body()), jwt.getSubject());
        } catch (InterruptedException error) {
            pending.cancel(true);
            Thread.currentThread().interrupt();
            throw new AccessFailure(503, "ACCESS_AUTHORITY_UNAVAILABLE");
        } catch (AccessFailure error) { throw error;
        } catch (Exception error) { pending.cancel(true); throw new AccessFailure(503, "ACCESS_AUTHORITY_UNAVAILABLE"); }
    }

    private static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
        private final HttpResponse.BodySubscriber<byte[]> delegate = HttpResponse.BodySubscribers.ofByteArray();
        private Flow.Subscription subscription;
        private int bytes;
        @Override public CompletionStage<byte[]> getBody() { return delegate.getBody(); }
        @Override public void onSubscribe(Flow.Subscription subscription) { this.subscription = subscription; delegate.onSubscribe(subscription); }
        @Override public void onNext(List<ByteBuffer> buffers) {
            for (ByteBuffer buffer : buffers) {
                bytes += buffer.remaining();
                if (bytes > 262144) { subscription.cancel(); delegate.onError(new IOException("ACCESS_RESPONSE_TOO_LARGE")); return; }
            }
            delegate.onNext(buffers);
        }
        @Override public void onError(Throwable error) { delegate.onError(error); }
        @Override public void onComplete() { delegate.onComplete(); }
    }

    AccessView validate(JsonNode body, String subject) {
        try {
            require(body != null && body.isObject() && body.path("schemaVersion").isIntegralNumber() && body.path("schemaVersion").asInt() == 1);
            require(body.path("subject").isTextual() && subject.equals(body.path("subject").textValue()));
            String status = body.path("status").textValue();
            require(Set.of("pending", "active", "suspended").contains(status));
            require(body.path("version").isIntegralNumber() && body.path("version").asLong() >= 0);
            require(body.path("owner").isBoolean() && body.path("canManageAccess").isBoolean());
            boolean owner = subject.equals(ownerSubject);
            require(body.path("owner").booleanValue() == owner && body.path("canManageAccess").booleanValue() == owner);
            require(!owner || "active".equals(status));
            JsonNode applications = body.path("applications");
            require(applications.isObject() && applications.size() == MODULES.size());
            Set<String> union = new HashSet<>();
            boolean appEnabled = false;
            String appRole = "none";
            for (var application : MODULES.entrySet()) {
                JsonNode entry = applications.path(application.getKey());
                require(entry.isObject() && entry.path("enabled").isBoolean() && entry.path("role").isTextual() && ROLES.contains(entry.path("role").textValue()));
                Set<String> permissions = permissions(entry.path("permissions"), application.getKey());
                require(entry.path("enabled").booleanValue() == ("active".equals(status) && !permissions.isEmpty()));
                require("active".equals(status) || permissions.isEmpty());
                require(!"none".equals(entry.path("role").textValue()) || permissions.isEmpty());
                union.addAll(permissions);
                if (application.getKey().equals("librepm")) { appEnabled = entry.path("enabled").booleanValue(); appRole = entry.path("role").textValue(); }
            }
            require(union.equals(permissions(body.path("permissions"), null)));
            return new AccessView(body.deepCopy(), subject, status, owner, appEnabled, appRole, Set.copyOf(union));
        } catch (AccessFailure error) { throw error;
        } catch (RuntimeException error) { throw new AccessFailure(503, "ACCESS_RESPONSE_INVALID"); }
    }

    private static Set<String> permissions(JsonNode node, String onlyApplication) {
        require(node.isArray() && node.size() <= 128);
        Set<String> result = new HashSet<>();
        for (JsonNode permission : node) {
            require(permission.isTextual());
            String value = permission.textValue();
            String[] parts = value.split("\\.", -1);
            require(parts.length == 3 && MODULES.containsKey(parts[0]) && MODULES.get(parts[0]).contains(parts[1]) && Set.of("read", "write").contains(parts[2]));
            require(onlyApplication == null || onlyApplication.equals(parts[0]));
            require(result.add(value));
        }
        for (String value : result) if (value.endsWith(".write")) require(result.contains(value.substring(0, value.length() - 5) + "read"));
        return result;
    }

    private static void require(boolean value) { if (!value) throw new AccessFailure(503, "ACCESS_RESPONSE_INVALID"); }

    public record AccessView(JsonNode json, String subject, String status, boolean owner, boolean appEnabled, String role, Set<String> permissions) {
        public boolean allows(String module, boolean write) { return "active".equals(status) && appEnabled && permissions.contains("librepm." + module + (write ? ".write" : ".read")); }
    }
    public static final class AccessFailure extends RuntimeException {
        final int status; final String code;
        AccessFailure(int status, String code) { super(code); this.status = status; this.code = code; }
    }
}
