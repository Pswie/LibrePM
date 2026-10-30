package com.lorenzodm.librepm.cloud;

import com.lorenzodm.librepm.core.converter.InstantAttributeConverter;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.repository.BudgetLineRepository;
import com.lorenzodm.librepm.service.FileStorageService;
import com.lorenzodm.librepm.service.SearchService;
import jakarta.persistence.EntityManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real PostgreSQL integration, never pointed at a remote/production database. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("cloud-postgres")
@EnabledIf(value = "databaseConfigured", disabledReason = "Requires isolated loopback POSTGRES_TEST_URL")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CloudPostgresSchemaIT {
    @MockitoBean JwtDecoder jwtDecoder;
    @Autowired Environment environment;
    @Autowired DataSource dataSource;
    @Autowired Flyway flyway;
    @Autowired JdbcTemplate db;
    @Autowired EntityManager em;
    @Autowired SearchService search;
    @Autowired FileStorageService storage;
    @Autowired BudgetLineRepository budgetLines;
    @Autowired MockMvc mvc;
    private static final String ORG = "11111111-1111-4111-8111-111111111111";
    private static final String KEY = "postgres-test-only-peer-key-at-least-32-characters";

    @BeforeAll
    void finalizeRuntimeHistoryPrivilegesInTheIsolatedTestDatabase() throws Exception {
        String runtimeUser;
        try (var runtime = dataSource.getConnection()) { runtimeUser = runtime.getMetaData().getUserName(); }
        try (var owner = flyway.getConfiguration().getDataSource().getConnection(); var statement = owner.createStatement()) {
            statement.execute("REVOKE ALL ON TABLE librepm.flyway_schema_history FROM \"" + runtimeUser.replace("\"", "\"\"") + "\"");
        }
    }

    static boolean databaseConfigured() { return System.getenv("POSTGRES_TEST_URL") != null; }

    private static String testUrl() {
        String url = System.getenv("POSTGRES_TEST_URL");
        if (url == null || !(url.startsWith("jdbc:postgresql://127.0.0.1:")
                || url.startsWith("jdbc:postgresql://localhost:"))) {
            throw new IllegalStateException("PostgreSQL integration tests require an isolated loopback database.");
        }
        return url;
    }

    private static String password(String variable) {
        String file = System.getenv(variable + "_FILE");
        if (file != null && !file.isBlank()) {
            try { return Files.readString(Path.of(file)).trim(); }
            catch (java.io.IOException e) { throw new IllegalStateException("Unreadable PostgreSQL test password file", e); }
        }
        return System.getenv().getOrDefault(variable, "");
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", CloudPostgresSchemaIT::testUrl);
        properties.add("spring.datasource.username", () -> System.getenv().getOrDefault("POSTGRES_TEST_USER", "librepm_app"));
        properties.add("spring.datasource.password", () -> password("POSTGRES_TEST_PASSWORD"));
        properties.add("spring.flyway.url", CloudPostgresSchemaIT::testUrl);
        properties.add("spring.flyway.user", () -> System.getenv().getOrDefault("POSTGRES_TEST_MIGRATION_USER", "librepm_owner"));
        properties.add("spring.flyway.password", () -> password("POSTGRES_TEST_MIGRATION_PASSWORD"));
        properties.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        properties.add("librepm.clerk.issuer-uri", () -> "https://fixture.clerk.accounts.dev");
        properties.add("librepm.cors.allowed-origins", () -> "https://fixture.example.org");
        properties.add("SUITE_ENABLED", () -> "true");
        properties.add("SUITE_ORGANIZATION_ID", () -> ORG);
        properties.add("SUITE_BANDI_KEY", () -> KEY);
        properties.add("SUITE_ASSOCIAGO_KEY", () -> KEY);
        properties.add("SUITE_SYNC_INITIAL_DELAY_MS", () -> "3600000");
    }

    @Test @Transactional
    void postgresProfileRetainsClerkAndIsolatesVendorMigrationHistory() throws Exception {
        assertThat(environment.getActiveProfiles()).contains("cloud", "cloud-postgres");
        assertThat(db.queryForObject("SELECT current_schema()", String.class)).isEqualTo("librepm");
        assertThat(flyway.getConfiguration().getLocations()).extracting(Object::toString)
                .containsExactly("classpath:db/migration_postgresql");
        assertThat(flyway.getConfiguration().isCleanDisabled()).isTrue();
        try (var owner = flyway.getConfiguration().getDataSource().getConnection(); var statement = owner.createStatement();
             var rows = statement.executeQuery("SELECT COUNT(*) FROM librepm.flyway_schema_history WHERE success")) {
            assertThat(rows.next()).isTrue(); assertThat(rows.getInt(1)).isEqualTo(4);
        }
        flyway.validate();
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/bootstrap").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_PRESIDENTE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void everyCurrentApplicationTableExistsOnlyInThePrivateSchema() throws Exception {
        Set<String> expected = new TreeSet<>();
        Pattern table = Pattern.compile("CREATE TABLE [`\"]?([a-z_]+)", Pattern.CASE_INSENSITIVE);
        for (String path : List.of("V1__baseline_schema.sql", "V2__allegati_nel_database.sql", "V3__suite_project_registry.sql")) {
            String sql = new String(new ClassPathResource("db/migration_mysql/" + path).getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            table.matcher(sql).results().forEach(match -> expected.add(match.group(1)));
        }
        assertThat(expected).hasSize(100);
        assertThat(db.queryForList("SELECT table_name FROM information_schema.tables WHERE table_schema='librepm' AND table_name<>'flyway_schema_history'", String.class))
                .containsExactlyInAnyOrderElementsOf(expected);
        assertThat(db.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','projects','asset_blobs','suite_projects')", Integer.class)).isZero();
        assertThat(db.queryForObject("SELECT COUNT(*) FROM pg_namespace n, LATERAL aclexplode(n.nspacl) acl WHERE n.nspname='librepm' AND acl.grantee=0 AND acl.privilege_type IN ('USAGE','CREATE')", Integer.class)).isZero();
    }

    @Test @Transactional
    void runtimeRoleCanUseDataButCannotCreateTables() throws Exception {
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (var statement = connection.createStatement()) {
                assertThatThrownBy(() -> statement.execute("CREATE TABLE librepm.runtime_must_not_create (id integer)"))
                        .isInstanceOf(SQLException.class);
            } finally { connection.rollback(); }
        }
        assertThat(db.queryForList("SELECT name FROM task_statuses", String.class)).contains("TODO", "DONE", "BLOCKED");
        assertThat(db.queryForList("SELECT id FROM workspace_profiles", String.class)).contains("wp-personal", "wp-grant");
        assertThat(db.queryForObject("SELECT COUNT(*) FROM work_day_rules WHERE calendar_id='cal-standard'", Integer.class)).isEqualTo(7);
        assertThat(db.queryForObject("SELECT has_table_privilege(current_user,'librepm.flyway_schema_history','SELECT')", Boolean.class)).isFalse();
        mvc.perform(get("/api/health/detailed").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_PRESIDENTE"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.database.status").value("OK"))
                .andExpect(jsonPath("$.database.engine").value("PostgreSQL"));
    }

    @Test @Transactional
    void textAndBinaryStorageDoNotUsePostgresLargeObjectOids() throws Exception {
        User user = user();
        String text = "Progetto associativo – testo €\n".repeat(4000);
        Programme programme = new Programme();
        programme.setName("PostgreSQL text fixture");
        programme.setOwnerId(user.getId());
        programme.setDescription(text);
        em.persist(programme);
        ProgrammeMilestone milestone = new ProgrammeMilestone();
        milestone.setProgrammeId(programme.getId());
        milestone.setName("Milestone");
        milestone.setDescription(text);
        em.persist(milestone);
        em.flush(); em.clear();
        assertThat(em.find(Programme.class, programme.getId()).getDescription()).isEqualTo(text);
        assertThat(em.find(ProgrammeMilestone.class, milestone.getId()).getDescription()).isEqualTo(text);
        byte[] content = new byte[180000];
        for (int i = 0; i < content.length; i++) content[i] = (byte) (i % 251);
        var file = storage.store(new MockMultipartFile("file", "documento.pdf", "application/pdf", content));
        assertThat(storage.loadAsResource(file.relativePath()).getContentAsByteArray()).isEqualTo(content);
        assertThat(db.queryForObject("SELECT data_type FROM information_schema.columns WHERE table_schema='librepm' AND table_name='asset_blobs' AND column_name='content'", String.class)).isEqualTo("bytea");
    }

    @Test @Transactional
    void searchAndSoftDeletesRespectMembershipAndLegacyStringDates() {
        User author = user(), reader = user();
        Project project = project(author);
        em.persist(new ProjectMember(project, reader, ProjectMember.Role.VIEWER));
        String token = "needle_%" + UUID.randomUUID();
        Note visible = note(author, project, token);
        Note restricted = note(author, project, token + " restricted");
        restricted.setVisibility(Note.Visibility.ROLE_RESTRICTED);
        restricted.setRestrictedRoles("[\"ADMIN\"]");
        Note deleted = note(author, project, token + " deleted");
        em.flush();
        em.remove(deleted); em.flush(); em.clear();
        String stored = db.queryForObject("SELECT deleted_at FROM notes WHERE id=?", String.class, deleted.getId());
        assertThat(new InstantAttributeConverter().convertToEntityAttribute(stored)).isNotNull();
        assertThat(search.search(reader.getId(), token, List.of("notes"), null, 20).get("notes"))
                .extracting(row -> row.get("id")).containsExactly(visible.getId());
    }

    @Test @Transactional
    void suiteRegistryAndSelectionUseTheRuntimePrivateSearchPath() throws Exception {
        User owner = user(); Project project = project(owner); em.flush();
        var identity = jwt().jwt(token -> token.subject(owner.getClerkUserId()))
                .authorities(new SimpleGrantedAuthority("ROLE_PRESIDENTE"));
        mvc.perform(post("/api/integrations/v1/projects").with(identity).contentType("application/json")
                        .content("{\"librepmProjectId\":\"" + project.getId() + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.suiteProjectId").value(project.getId()));
        mvc.perform(put("/api/integrations/v1/selection").with(identity).contentType("application/json")
                        .content("{\"suiteProjectId\":\"" + project.getId() + "\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/integrations/v1/selection").with(identity))
                .andExpect(status().isOk()).andExpect(jsonPath("$.suiteProjectId").value(project.getId()));
        mvc.perform(get("/api/integrations/v1/peer/projects").header("X-Suite-Peer", "bandi")
                        .header("X-Suite-Key", KEY).header("X-Suite-Organization", ORG))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].suiteProjectId").value(project.getId()));
    }

    @Test @Transactional
    void budgetArithmeticAndCaseInsensitiveIdentityConstraintsRemainValid() {
        User owner = user();
        BudgetLine line = new BudgetLine(); line.setBudgetId("postgres-fixture-budget");
        line.setName("Real planned line"); line.setCategory("MISC"); line.setActualAmount(10);
        budgetLines.saveAndFlush(line);
        assertThat(budgetLines.adjustActualAmount(line.getId(), 2.5)).isEqualTo(1);
        assertThat(budgetLines.findById(line.getId()).orElseThrow().getActualAmount()).isEqualTo(12.5);
        User duplicate = new User(); duplicate.setUsername(owner.getUsername().toUpperCase(Locale.ROOT));
        duplicate.setPasswordHash("test-only-unusable-password");
        assertThatThrownBy(() -> { em.persist(duplicate); em.flush(); }).isInstanceOf(RuntimeException.class);
    }

    private User user() {
        User user = new User();
        user.setUsername("pg-" + UUID.randomUUID());
        user.setClerkUserId("pg-subject-" + UUID.randomUUID());
        user.setPasswordHash("test-only-unusable-password");
        em.persist(user); return user;
    }
    private Project project(User owner) {
        Project project = new Project(); project.setOwner(owner); project.setName("Isolated PostgreSQL project");
        em.persist(project); em.persist(new ProjectMember(project, owner, ProjectMember.Role.OWNER)); return project;
    }
    private Note note(User owner, Project project, String title) {
        Note note = new Note(); note.setOwner(owner); note.setProjectId(project.getId());
        note.setParentType(Note.ParentType.PROJECT); note.setParentId(project.getId());
        note.setTitle(title); note.setContent("PostgreSQL isolation fixture"); em.persist(note); return note;
    }
}
