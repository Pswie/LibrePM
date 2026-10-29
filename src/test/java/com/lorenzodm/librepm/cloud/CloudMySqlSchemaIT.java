package com.lorenzodm.librepm.cloud;

import com.lorenzodm.librepm.core.entity.Note;
import com.lorenzodm.librepm.core.entity.Project;
import com.lorenzodm.librepm.core.entity.ProjectMember;
import com.lorenzodm.librepm.core.entity.Task;
import com.lorenzodm.librepm.core.entity.TaskPriority;
import com.lorenzodm.librepm.core.entity.TaskStatus;
import com.lorenzodm.librepm.core.entity.User;
import com.lorenzodm.librepm.service.SearchService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.MySQLContainer;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Collaudo del profilo {@code cloud} contro un MySQL vero.
 *
 * <p>Verifica le due cose che LibrePM non aveva mai provato, essendo nato su
 * SQLite: che le migrazioni in {@code db/migration_mysql} vengano applicate da
 * Flyway su MySQL 8, e che le 91 entity JPA combacino con lo schema che ne
 * risulta — quest'ultima grazie a {@code ddl-auto=validate}, che in esercizio
 * resta spento perché lo schema è di proprietà di Flyway.
 *
 * <p>È il test che protegge la baseline: se qualcuno modifica una entity senza
 * aggiungere la migrazione corrispondente, qui si accorge subito invece di
 * scoprirlo all'avvio su Cloud Run.
 *
 * <p>Il {@link JwtDecoder} è sostituito da un mock: senza, il contesto proverebbe
 * a raggiungere il JWKS di Clerk in rete solo per collaudare il database.
 */
@SpringBootTest
@ActiveProfiles("cloud")
@EnabledIf("databaseAvailable")
@DisplayName("Profilo cloud: baseline MySQL e mappatura delle entity")
class CloudMySqlSchemaIT {

    @SuppressWarnings("resource")
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0")
            .withDatabaseName("librepm")
            .withUsername("librepm")
            .withPassword("librepm");

    /** Falso quando non c'è né un MySQL esterno né un Docker utilizzabile. */
    private static final boolean DATABASE_AVAILABLE;

    static {
        boolean available = true;
        if (System.getenv("MYSQL_TEST_URL") == null) {
            // Ciclo di vita gestito a mano invece che con @Container: il
            // container va avviato solo se non puntiamo a un database esterno.
            try {
                MYSQL.start();
            } catch (RuntimeException | LinkageError e) {
                // Tipico di Docker Desktop su Windows, dove Testcontainers non
                // individua il daemon. Il test si salta, non fallisce: è un
                // limite dell'ambiente, non un difetto del codice.
                //
                // Il motivo va però stampato. Un test che si salta in silenzio
                // sembra un test che passa, e questo è il collaudo che protegge
                // la baseline MySQL: vale la pena sapere che non è stato fatto.
                available = false;
                System.err.println("[CloudMySqlSchemaIT] SALTATO, nessun MySQL disponibile: "
                        + e.getClass().getSimpleName() + ": " + e.getMessage());
                System.err.println("[CloudMySqlSchemaIT] Con Docker Desktop su Windows può servire "
                        + "~/.testcontainers.properties con docker.host, oppure si punta a un "
                        + "database esterno con MYSQL_TEST_URL.");
            }
        }
        DATABASE_AVAILABLE = available;
    }

    @SuppressWarnings("unused")
    static boolean databaseAvailable() {
        return DATABASE_AVAILABLE;
    }

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Autowired
    DataSource dataSource;

    @Autowired
    EntityManager entityManager;

    @Autowired
    SearchService searchService;

    /**
     * Via di fuga per gli ambienti dove Testcontainers non individua il daemon
     * Docker. Se {@code MYSQL_TEST_URL} è valorizzata, il test usa quel database
     * invece di avviare un container — è così che si collauda la baseline
     * direttamente contro Aiven.
     */
    private static boolean useExternalDatabase() {
        return System.getenv("MYSQL_TEST_URL") != null;
    }

    /**
     * Legge la password da {@code MYSQL_TEST_PASSWORD_FILE}, se indicato, e
     * altrimenti da {@code MYSQL_TEST_PASSWORD}.
     *
     * <p>La variante con file serve per collaudare contro un database gestito
     * senza scrivere la password dentro la riga di comando, dove finirebbe nella
     * cronologia della shell e nell'elenco dei processi. È la stessa convenzione
     * dei secret di Docker e Kubernetes.
     */
    private static String externalPassword() {
        String file = System.getenv("MYSQL_TEST_PASSWORD_FILE");
        if (file != null && !file.isBlank()) {
            try {
                return Files.readString(Path.of(file)).trim();
            } catch (IOException e) {
                throw new IllegalStateException(
                        "MYSQL_TEST_PASSWORD_FILE indicato ma illeggibile: " + file, e);
            }
        }
        return System.getenv().getOrDefault("MYSQL_TEST_PASSWORD", "");
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        if (useExternalDatabase()) {
            registry.add("spring.datasource.url", () -> System.getenv("MYSQL_TEST_URL"));
            registry.add("spring.datasource.username",
                    () -> System.getenv().getOrDefault("MYSQL_TEST_USER", "root"));
            registry.add("spring.datasource.password", CloudMySqlSchemaIT::externalPassword);
        } else {
            registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
            registry.add("spring.datasource.username", MYSQL::getUsername);
            registry.add("spring.datasource.password", MYSQL::getPassword);
        }

        // Hibernate normalmente non tocca lo schema. Qui lo mettiamo a validare:
        // è l'unico modo per accorgersi se una entity e la sua tabella hanno
        // smesso di combaciare.
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access", () -> "true");

        // Valori fittizi ma non vuoti: CloudSecurityConfig rifiuta di partire se
        // mancano, ed è esattamente il comportamento che vogliamo mantenere.
        registry.add("librepm.clerk.issuer-uri", () -> "https://esempio.clerk.accounts.dev");
        registry.add("librepm.cors.allowed-origins", () -> "https://esempio.org");
    }

    @Test
    @DisplayName("le migrazioni MySQL vengono applicate tutte con successo")
    void migrationsAreApplied() throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {

            try (ResultSet rs = statement.executeQuery(
                    "SELECT COUNT(*) FROM information_schema.tables "
                            + "WHERE table_schema = DATABASE()")) {
                assertThat(rs.next()).isTrue();
                // 92 tabelle di dominio più flyway_schema_history.
                assertThat(rs.getInt(1)).isGreaterThanOrEqualTo(92);
            }

            try (ResultSet rs = statement.executeQuery(
                    "SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0")) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getInt(1)).as("migrazioni fallite").isZero();
            }
        }
    }

    @Test
    @DisplayName("il ponte con l'identità Clerk esiste e non ammette duplicati")
    void clerkLinkIsUnique() throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {

            try (ResultSet rs = statement.executeQuery(
                    "SELECT COUNT(*) FROM information_schema.columns "
                            + "WHERE table_schema = DATABASE() AND table_name = 'users' "
                            + "AND column_name = 'clerk_user_id'")) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getInt(1)).isEqualTo(1);
            }

            // Senza l'indice univoco due persone potrebbero finire legate alla
            // stessa identità Clerk, e l'una vedrebbe i progetti dell'altra.
            try (ResultSet rs = statement.executeQuery(
                    "SELECT non_unique FROM information_schema.statistics "
                            + "WHERE table_schema = DATABASE() AND table_name = 'users' "
                            + "AND index_name = 'ux_users_clerk_user_id'")) {
                assertThat(rs.next()).as("indice ux_users_clerk_user_id").isTrue();
                assertThat(rs.getInt("non_unique")).isZero();
            }
        }
    }

    @Test
    @DisplayName("le tabelle su cui si regge la sezione bandi esistono")
    void tablesForGrantsExist() throws Exception {
        String[] expected = {
            "users", "projects", "project_members", "tasks",
            "grant_calls", "submission_packages", "call_requirements",
            "obligation_records", "budget_lines", "project_budgets",
            "funding_sources", "fund_allocations", "actual_cost_records",
            "donors", "donations", "sponsors", "sponsor_commitments",
            "stakeholders", "evidence_packs", "programmes"
        };

        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            for (String table : expected) {
                try (ResultSet rs = statement.executeQuery(
                        "SELECT COUNT(*) FROM information_schema.tables "
                                + "WHERE table_schema = DATABASE() AND table_name = '" + table + "'")) {
                    assertThat(rs.next()).isTrue();
                    assertThat(rs.getInt(1)).as("tabella %s", table).isEqualTo(1);
                }
            }
        }
    }

    @Test
    @Transactional // All fixtures roll back, including against an external test database.
    @DisplayName("la ricerca reale MySQL rispetta appartenenza, visibilità e caratteri letterali")
    void searchUsesMappedTaskFieldsAndRespectsNoteVisibility() {
        String token = "needle_%" + UUID.randomUUID();
        User author = searchUser();
        User reader = searchUser();
        Project accessible = searchProject(author);
        Project inaccessible = searchProject(author);
        entityManager.persist(new ProjectMember(accessible, reader, ProjectMember.Role.VIEWER));

        Note visible = searchNote(author, accessible, token + " visible");
        Note restricted = searchNote(author, accessible, token + " restricted");
        restricted.setVisibility(Note.Visibility.ROLE_RESTRICTED);
        restricted.setRestrictedRoles("[\"ADMIN\"]");
        Note deleted = searchNote(author, accessible, token + " deleted");
        deleted.setDeletedAt(Instant.now());
        searchNote(author, inaccessible, token + " another project");
        // Must not match: SQL LIKE wildcards in the input must be treated literally.
        searchNote(author, accessible, token.replace("_%", "XY") + " wildcard decoy");

        TaskStatus status = new TaskStatus("audit-status-" + UUID.randomUUID(), TaskStatus.Category.IN_PROGRESS);
        TaskPriority priority = new TaskPriority("audit-prio-" + UUID.randomUUID(), 2);
        entityManager.persist(status);
        entityManager.persist(priority);
        Task task = new Task();
        task.setProject(accessible);
        task.setTitle(token + " task");
        task.setDescription("Mapped status_id and priority_id associations");
        task.setStatus(status);
        task.setPriority(priority);
        entityManager.persist(task);
        entityManager.flush();
        entityManager.clear();

        var results = searchService.search(reader.getId(), token, null, null, 20);
        assertThat(results.get("notes")).extracting(row -> row.get("id")).containsExactly(visible.getId());
        assertThat(results.get("tasks")).hasSize(1);
        assertThat(results.get("tasks").get(0)).containsEntry("id", task.getId())
                .containsEntry("status", status.getName()).containsEntry("priority", priority.getName());
        assertThat(searchService.search(reader.getId(), token, List.of("notes"), inaccessible.getId(), 20)).isEmpty();

        entityManager.createQuery("DELETE FROM ProjectMember m WHERE m.user.id = :reader")
                .setParameter("reader", reader.getId()).executeUpdate();
        entityManager.clear();
        assertThat(searchService.search(reader.getId(), token, null, null, 20)).isEmpty();
    }

    private User searchUser() {
        User user = new User();
        user.setUsername("audit-" + UUID.randomUUID());
        user.setPasswordHash("test-only-unusable-password");
        entityManager.persist(user);
        return user;
    }

    private Project searchProject(User owner) {
        Project project = new Project();
        project.setOwner(owner);
        project.setName("Isolated search fixture " + UUID.randomUUID());
        entityManager.persist(project);
        return project;
    }

    private Note searchNote(User author, Project project, String title) {
        Note note = new Note();
        note.setOwner(author);
        note.setProjectId(project.getId());
        note.setParentType(Note.ParentType.PROJECT);
        note.setParentId(project.getId());
        note.setTitle(title);
        note.setContent("Search regression fixture");
        entityManager.persist(note);
        return note;
    }
}
