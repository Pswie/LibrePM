package com.lorenzodm.librepm.api.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.io.File;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Health check endpoints for local observability (PRD-06-FR-006).
 * <p>
 * Provides both a simple UP/DOWN check and a detailed health report
 * covering database, filesystem, assets, and sync status.
 * </p>
 *
 * @author Lorenzo DM
 * @since 0.3.0
 */
@RestController
@RequestMapping("/api")
public class HealthController {

    private static final Instant STARTED_AT = Instant.now();

    @Autowired
    private DataSource dataSource;

    @Value("${librepm.data.path:#{null}}")
    private String dataPath;

    @Autowired(required = false)
    private BuildProperties buildProperties;

    /**
     * Simple health check — always returns UP if the API is reachable.
     */
    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }

    /**
     * Detailed health report for local diagnostics.
     * Includes database size, migration version, filesystem stats, and uptime.
     */
    @GetMapping("/health/detailed")
    public Map<String, Object> detailedHealth() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "UP");
        result.put("timestamp", Instant.now().toString());

        // Version
        String version = (buildProperties != null) ? buildProperties.getVersion() : "dev";
        result.put("version", version);

        // Uptime
        long uptimeSeconds = Instant.now().getEpochSecond() - STARTED_AT.getEpochSecond();
        result.put("uptimeSeconds", uptimeSeconds);

        // Database health
        result.put("database", getDatabaseHealth());

        // Filesystem health
        result.put("filesystem", getFilesystemHealth());

        return result;
    }

    private Map<String, Object> getDatabaseHealth() {
        Map<String, Object> db = new LinkedHashMap<>();
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            db.put("status", "OK");

            // Only SQLite has PRAGMA/file pages. Managed database profiles use
            // their own metadata without turning a healthy connection into ERROR.
            String product = conn.getMetaData().getDatabaseProductName();
            db.put("engine", product);
            if ("PostgreSQL".equals(product)) {
                try (ResultSet rs = stmt.executeQuery("SELECT pg_database_size(current_database())")) {
                    if (rs.next()) {
                        db.put("sizeBytes", rs.getLong(1));
                    }
                }
            } else if ("MySQL".equals(product)) {
                try (ResultSet rs = stmt.executeQuery("SELECT COALESCE(SUM(data_length+index_length),0) FROM information_schema.tables WHERE table_schema=DATABASE()")) {
                    if (rs.next()) {
                        db.put("sizeBytes", rs.getLong(1));
                    }
                }
            } else if ("SQLite".equals(product)) {
                try (ResultSet rs = stmt.executeQuery("PRAGMA page_count")) {
                    if (rs.next()) {
                        long pageCount = rs.getLong(1);
                        try (Statement stmt2 = conn.createStatement();
                             ResultSet rs2 = stmt2.executeQuery("PRAGMA page_size")) {
                            if (rs2.next()) {
                                long pageSize = rs2.getLong(1);
                                db.put("sizeBytes", pageCount * pageSize);
                            }
                        }
                    }
                }
            }

            // Flyway migration version
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1")) {
                if (rs.next()) {
                    db.put("migrationVersion", rs.getString(1));
                }
            } catch (java.sql.SQLException restrictedMetadata) {
                // A runtime-only role intentionally has no access to migration history.
                db.put("migrationVersion", "managed separately");
            }

            // Entity counts
            Map<String, Long> counts = new LinkedHashMap<>();
            counts.put("projects", countTable(conn, "projects"));
            counts.put("tasks", countTable(conn, "tasks"));
            counts.put("notes", countTable(conn, "notes"));
            counts.put("users", countTable(conn, "users"));
            counts.put("assets", countTable(conn, "assets"));
            counts.put("auditEvents", countTable(conn, "audit_events"));
            db.put("entityCounts", counts);

        } catch (Exception e) {
            db.put("status", "ERROR");
            db.put("error", e.getMessage());
        }
        return db;
    }

    private Map<String, Object> getFilesystemHealth() {
        Map<String, Object> fs = new LinkedHashMap<>();
        if (dataPath != null) {
            File dataDir = new File(dataPath);
            fs.put("dataDir", dataDir.getAbsolutePath());
            fs.put("exists", dataDir.exists());
            fs.put("freeSpaceBytes", dataDir.getFreeSpace());
            fs.put("totalSpaceBytes", dataDir.getTotalSpace());

            // Assets directory
            File assetsDir = new File(dataDir, "assets");
            if (assetsDir.exists() && assetsDir.isDirectory()) {
                File[] assetFiles = assetsDir.listFiles();
                int fileCount = assetFiles != null ? assetFiles.length : 0;
                long totalSize = 0;
                if (assetFiles != null) {
                    for (File f : assetFiles) {
                        if (f.isFile()) totalSize += f.length();
                    }
                }
                fs.put("assetsFileCount", fileCount);
                fs.put("assetsTotalSizeBytes", totalSize);
            }
            fs.put("status", "OK");
        } else {
            fs.put("status", "NOT_CONFIGURED");
        }
        return fs;
    }

    private long countTable(Connection conn, String tableName) {
        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM " + tableName + " WHERE deleted_at IS NULL")) {
            return rs.next() ? rs.getLong(1) : 0;
        } catch (Exception e) {
            return -1;
        }
    }
}
