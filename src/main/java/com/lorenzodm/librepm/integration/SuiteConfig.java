package com.lorenzodm.librepm.integration;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.util.List;
import java.util.UUID;

@Component
public class SuiteConfig {
    public static final List<String> PEERS = List.of("associago", "bandi");
    private final Environment env;
    public SuiteConfig(Environment env) { this.env = env; }
    public boolean enabled() { return Boolean.parseBoolean(env.getProperty("SUITE_ENABLED", "false")); }
    public String organization() {
        if (!enabled()) throw SuiteException.unavailable("Integrazione tra applicazioni non attiva.");
        try { return uuid(env.getProperty("SUITE_ORGANIZATION_ID"), "SUITE_ORGANIZATION_ID non configurato."); }
        catch (SuiteException e) { throw SuiteException.unavailable("SUITE_ORGANIZATION_ID non configurato o non valido."); }
    }
    public static String uuid(String value, String message) {
        try {
            if (value == null || !UUID.fromString(value).toString().equalsIgnoreCase(value)) throw new IllegalArgumentException();
            return value.toLowerCase(java.util.Locale.ROOT);
        } catch (IllegalArgumentException e) { throw SuiteException.invalid(message); }
    }
    public String key(String peer) {
        if (peer == null || !PEERS.contains(peer)) throw new SuiteException(401, "SUITE_PEER_AUTH", "Applicazione non riconosciuta.");
        String key = env.getProperty("SUITE_" + peer.toUpperCase(java.util.Locale.ROOT) + "_KEY", "");
        if (key.length() < 32) throw SuiteException.unavailable("Chiave di integrazione non configurata per " + peer + ".");
        return key;
    }
    public URI api(String peer) {
        key(peer);
        return safeOrigin(env.getProperty("SUITE_" + peer.toUpperCase(java.util.Locale.ROOT) + "_API_URL"));
    }
    public boolean configured(String peer) {
        try { organization(); api(peer); return true; } catch (SuiteException e) { return false; }
    }
    public String ownerId() { return env.getProperty("SUITE_IMPORT_OWNER_ID", ""); }
    public String publicLink(String system, String projectId) {
        String value = env.getProperty("SUITE_" + system.toUpperCase(java.util.Locale.ROOT) + "_PUBLIC_URL", "");
        if (value.isBlank()) return null;
        URI origin = safeOrigin(value);
        return origin + ("bandi".equals(system) ? "/suite/projects/" : "/?suiteProject=") + projectId;
    }
    /** Only explicit server configuration can choose a destination. No redirects are followed. */
    public static URI safeOrigin(String value) {
        try {
            URI uri = URI.create(value == null ? "" : value);
            String host = uri.getHost();
            boolean loopback = List.of("localhost", "127.0.0.1", "[::1]", "::1").contains(host == null ? "" : host.toLowerCase(java.util.Locale.ROOT));
            if (host == null || uri.getPort() > 65535 || uri.getPort() == 0 || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || !(uri.getPath().isEmpty() || "/".equals(uri.getPath()))
                    || !("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme()) && loopback)))
                throw new IllegalArgumentException();
            return URI.create(uri.toString().replaceAll("/$", ""));
        } catch (IllegalArgumentException e) { throw SuiteException.unavailable("URL di integrazione non valido: usare un'origine HTTPS senza percorsi o credenziali."); }
    }
}
