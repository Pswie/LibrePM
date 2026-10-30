package com.lorenzodm.librepm.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.repository.*;
import com.lorenzodm.librepm.security.AuthProperties;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static com.lorenzodm.librepm.integration.SuiteModels.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
@TestPropertySource(properties={"spring.datasource.url=jdbc:h2:mem:suite;DB_CLOSE_DELAY=-1;MODE=LEGACY",
        "SUITE_ENABLED=true","SUITE_ORGANIZATION_ID=11111111-1111-1111-1111-111111111111",
        "SUITE_ASSOCIAGO_KEY=test-associago-key-at-least-32-characters", "SUITE_BANDI_KEY=test-bandi-key-at-least-32-characters",
        "SUITE_ASSOCIAGO_API_URL=http://127.0.0.1:19991","SUITE_BANDI_API_URL=http://127.0.0.1:19992",
        "SUITE_LIBREPM_PUBLIC_URL=https://librepm.example", "SUITE_ASSOCIAGO_PUBLIC_URL=https://associago.example", "SUITE_BANDI_PUBLIC_URL=https://bandi.example",
        "SUITE_SYNC_INITIAL_DELAY_MS=3600000"})
@Sql(scripts="/db/migration/V901__suite_project_registry.sql",executionPhase=Sql.ExecutionPhase.BEFORE_TEST_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SuiteIntegrationTest {
    static final String ORG="11111111-1111-1111-1111-111111111111";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SuiteService service;
    @Autowired JdbcTemplate db;
    @Autowired UserRepository users;
    @Autowired ProjectRepository projects;
    @Autowired ProjectMemberRepository members;
    @Autowired ProjectBudgetRepository budgets;
    @Autowired BudgetLineRepository budgetLines;
    @Autowired SuiteStore store;
    @MockitoBean SuitePeerClient peer;
    User owner;
    Project project;
    final List<Map<String,Object>> captures=new ArrayList<>();

    @BeforeEach void setup() throws Exception {
        db.update("DELETE FROM suite_selections"); db.update("DELETE FROM suite_peer_state");
        db.update("DELETE FROM suite_instance_revisions");
        db.update("DELETE FROM suite_instances"); db.update("DELETE FROM suite_projects");
        owner=user(); owner.setClerkUserId("actor-"+owner.getId()); users.saveAndFlush(owner);
        project=new Project(); project.setName("Progetto operativo"); project.setOwner(owner); projects.saveAndFlush(project);
        members.saveAndFlush(new ProjectMember(project,owner,ProjectMember.Role.OWNER));
        doAnswer(call -> {
            String system=call.getArgument(0); Projection p=call.getArgument(1);
            String local=p.targetLocalId();
            JsonNode finance=null,workforce=null,preparation=null;
            if (system.equals("associago")) {
                local=local==null?"42":local;
                finance=json.readTree("{\"currency\":\"EUR\",\"income\":\"100.00\",\"expense\":\"25.00\",\"balance\":\"75.00\",\"privatePerson\":\"must not escape\"}");
                workforce=json.readTree("{\"assignedCount\":2,\"completedHours\":\"12.5\"}");
            } else if (local!=null) preparation=json.valueToTree(Map.of("localId",local,"version",1,"title","Candidatura reale","status","draft","reviewDecision","pending","requestedGrant",Map.of("amount","123.45","currency","EUR")));
            return new Snapshot(1,ORG,p.suiteProjectId(),system,local,p.sourceVersion(),finance,workforce,preparation);
        }).when(peer).publish(anyString(),any());
    }
    User user() {
        User user=new User(); user.setUsername("suite-"+UUID.randomUUID()); user.setPasswordHash("test-only-no-login"); user.setActive(true);
        return users.saveAndFlush(user);
    }
    Seed seed(String localId) { return new Seed(1,ORG,new Source("bandi","preparation",localId,"rev-1"),"Progetto da candidatura","Descrizione",new Money("123.45","EUR"),null,owner.getClerkUserId()); }
    String register() throws Exception {
        MvcResult result=mvc.perform(post("/api/integrations/v1/projects").header("X-User-Id",owner.getId()).contentType("application/json")
                .content(json.writeValueAsString(new Registration(project.getId())))).andExpect(status().isOk()).andReturn();
        capture("POST","/api/integrations/v1/projects",result); return project.getId();
    }
    @Test void peerAuthenticationAndOrganizationAreSeparateFromBrowserLogin() throws Exception {
        mvc.perform(get("/api/integrations/v1/peer/projects")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("SUITE_PEER_AUTH"));
        mvc.perform(get("/api/integrations/v1/peer/projects").header("X-Suite-Peer","bandi").header("X-Suite-Key","wrong"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/integrations/v1/peer/projects").header("X-Suite-Peer","bandi").header("X-Suite-Key","test-bandi-key-at-least-32-characters").header("X-Suite-Organization",UUID.randomUUID()))
                .andExpect(status().isForbidden());
        MvcResult result=mvc.perform(get("/api/integrations/v1/peer/projects").header("X-Suite-Peer","bandi").header("X-Suite-Key","test-bandi-key-at-least-32-characters").header("X-Suite-Organization",ORG))
                .andExpect(status().isOk()).andReturn();
        capture("GET","/api/integrations/v1/peer/projects",result);
    }
    @Test void registrationChecksMembershipAndReadOnlyMembersCannotPublish() throws Exception {
        User outsider=user();
        mvc.perform(post("/api/integrations/v1/projects").header("X-User-Id",outsider.getId()).contentType("application/json").content(json.writeValueAsString(new Registration(project.getId()))))
                .andExpect(status().isForbidden());
        register();
        members.saveAndFlush(new ProjectMember(project,outsider,ProjectMember.Role.VIEWER));
        mvc.perform(get("/api/integrations/v1/projects/"+project.getId()).header("X-User-Id",outsider.getId())).andExpect(status().isOk());
        mvc.perform(post("/api/integrations/v1/projects/"+project.getId()+"/sync").header("X-User-Id",outsider.getId())).andExpect(status().isForbidden());
    }
    @Test void verifiedClerkSubjectWinsOverForgedLocalHeader() {
        MockEnvironment cloud=new MockEnvironment(); cloud.setActiveProfiles("cloud");
        SuiteActorResolver resolver=new SuiteActorResolver(users,cloud,new AuthProperties());
        Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject(owner.getClerkUserId()).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
        MockHttpServletRequest req=new MockHttpServletRequest(); req.addHeader("X-User-Id",user().getId());
        try { assertEquals(owner.getId(),resolver.resolve(req).userId()); assertFalse(resolver.resolve(req).finance()); }
        finally { SecurityContextHolder.clearContext(); }
    }
    @Test void seedImportIsPersistentIdempotentAndNeverOverwritesTheOperationalPlan() throws Exception {
        long before=projects.count(); String localId=UUID.randomUUID().toString();
        Context imported=service.importSeed(seed(localId),"bandi");
        Seed newer=new Seed(1,ORG,new Source("bandi","preparation",localId,"rev-2"),"Titolo sorgente modificato",null,null,null,owner.getClerkUserId());
        Context again=service.importSeed(newer,"bandi");
        assertEquals(imported.suiteProjectId(),again.suiteProjectId()); assertEquals(before+1,projects.count());
        assertEquals("Progetto da candidatura",again.title());
        assertEquals("rev-1",db.queryForObject("SELECT source_revision FROM suite_instances WHERE system_name='bandi'",String.class));
        assertEquals(2,db.queryForObject("SELECT COUNT(*) FROM suite_instance_revisions WHERE system_name='bandi'",Integer.class));
        assertEquals(123.45,db.queryForObject("SELECT total_amount FROM project_budgets WHERE project_id=?",Double.class,imported.suiteProjectId()));
        captureValue("POST","/api/integrations/v1/peer/projects",json.valueToTree(imported));
        SuiteException mismatch=assertThrows(SuiteException.class,() -> service.importSeed(seed(localId),"associago")); assertEquals(403,mismatch.status());
        Seed unknown=new Seed(1,ORG,new Source("bandi","preparation",UUID.randomUUID().toString(),"r"),"Unknown owner",null,null,null,"unmapped-clerk-subject");
        assertEquals(503,assertThrows(SuiteException.class,() -> service.importSeed(unknown,"bandi")).status());
    }
    @Test void linkingAnExistingPreparationCannotRebindItToAnotherProject() throws Exception {
        String id=register(), local=UUID.randomUUID().toString();
        Context linked=service.link(id,new Source("bandi","preparation",local,"v1"),"bandi");
        assertTrue(linked.instances().stream().anyMatch(i -> local.equals(i.localId())));
        Project other=new Project(); other.setOwner(owner); other.setName("Altro"); projects.saveAndFlush(other); service.register(other.getId(),new SuiteActorResolver.Actor(owner.getId(),true));
        assertEquals(409,assertThrows(SuiteException.class,() -> service.link(other.getId(),new Source("bandi","preparation",local,"v2"),"bandi")).status());
        captureValue("POST","/api/integrations/v1/peer/projects/{suiteProjectId}/instances",json.valueToTree(linked));
    }
    @Test void failedPeerPersistsErrorAndRetryRecoversWithoutDuplicatesOrWrongFinancialAuthority() throws Exception {
        String id=register();
        doThrow(new SuiteException(503,"SUITE_PEER_UNREACHABLE","Bandi temporaneamente offline.")).when(peer).publish(eq("bandi"),any());
        Context first=service.sync(id,new SuiteActorResolver.Actor(owner.getId(),true));
        assertEquals("synced",first.sync().stream().filter(p -> p.system().equals("associago")).findFirst().orElseThrow().status());
        assertEquals("error",first.sync().stream().filter(p -> p.system().equals("bandi")).findFirst().orElseThrow().status());
        assertEquals("75.00",first.financial().path("balance").asText()); assertFalse(first.financial().has("privatePerson"));
        assertNull(service.get(id,new SuiteActorResolver.Actor(owner.getId(),false)).financial());
        doAnswer(call -> { Projection p=call.getArgument(1); return new Snapshot(1,ORG,id,"bandi",null,p.sourceVersion(),null,null,null); }).when(peer).publish(eq("bandi"),any());
        Context retry=service.sync(id,new SuiteActorResolver.Actor(owner.getId(),true));
        assertTrue(retry.sync().stream().allMatch(p -> p.status().equals("synced"))); assertEquals(first.version(),retry.version());
        assertEquals(2,store.instances(ORG,id).size());
        assertEquals(409,assertThrows(SuiteException.class,() -> { store.acquire(ORG,id,"other-writer"); service.sync(id,null); }).status());
        store.release(ORG,id,"other-writer");
        captureValue("POST","/api/integrations/v1/projects/{suiteProjectId}/sync",json.valueToTree(retry));
    }
    @Test void projectionsAdvanceVersionAfterLocalEditsAndSelectionSurvivesReload() throws Exception {
        String id=register(); Context first=service.get(id,null);
        project.setName("Piano aggiornato localmente"); projects.saveAndFlush(project);
        assertTrue(service.get(id,null).version()>first.version());
        mvc.perform(put("/api/integrations/v1/selection").header("X-User-Id",owner.getId()).contentType("application/json").content(json.writeValueAsString(new Selection(id))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.suiteProjectId").value(id));
        MvcResult result=mvc.perform(get("/api/integrations/v1/selection").header("X-User-Id",owner.getId())).andExpect(status().isOk()).andReturn();
        capture("GET","/api/integrations/v1/selection",result);
        capture("GET","/api/integrations/v1/projects",mvc.perform(get("/api/integrations/v1/projects").header("X-User-Id",owner.getId())).andExpect(status().isOk()).andReturn());
    }
    @Test void unsafeConfigurationAndStaleSnapshotAreRejected() throws Exception {
        for (String url:List.of("http://example.org","https://user:pass@example.org","https://example.org/api","https://example.org?key=x","https://example.org#token"))
            assertEquals(503,assertThrows(SuiteException.class,() -> SuiteConfig.safeOrigin(url)).status());
        assertEquals("http://127.0.0.1:9000",SuiteConfig.safeOrigin("http://127.0.0.1:9000/").toString());
        register(); doAnswer(call -> { Projection p=call.getArgument(1); return new Snapshot(1,ORG,p.suiteProjectId(),call.getArgument(0),null,p.sourceVersion()-1,null,null,null); }).when(peer).publish(anyString(),any());
        Context result=service.sync(project.getId(),null); assertTrue(result.sync().stream().allMatch(p -> p.status().equals("error")));
    }
    @Test void exactDecimalBudgetIsRequiredBeforeImportWritesAnything() {
        long before=projects.count(); Seed base=seed(UUID.randomUUID().toString());
        Seed precise=new Seed(1,ORG,base.source(),base.title(),null,new Money("123.4567890123456789","EUR"),null,owner.getClerkUserId());
        SuiteException rejected=assertThrows(SuiteException.class,() -> service.importSeed(precise,"bandi"));
        assertEquals(409,rejected.status()); assertEquals("SUITE_AMOUNT_PRECISION",rejected.code()); assertEquals(before,projects.count());
    }
    @Test void projectionUsesActualPlannedLinesAndAdvancesWhenTheyChange() throws Exception {
        String id=register();
        ProjectBudget budget=new ProjectBudget(); budget.setProjectId(id); budget.setName("Piano"); budget.setTotalAmount(999d); budgets.saveAndFlush(budget);
        for (double value:List.of(0.1,0.2)) {
            BudgetLine line=new BudgetLine(); line.setBudgetId(budget.getId()); line.setName("Riga"); line.setCategory("MISC"); line.setPlannedAmount(value); budgetLines.saveAndFlush(line);
        }
        Context initial=service.sync(id,null);
        org.mockito.ArgumentCaptor<Projection> sent=org.mockito.ArgumentCaptor.forClass(Projection.class);
        verify(peer).publish(eq("associago"),sent.capture()); assertEquals("0.3",sent.getValue().plannedBudget().amount());
        BudgetLine line=budgetLines.findByBudgetIdOrderBySortOrderAsc(budget.getId()).getFirst(); line.setPlannedAmount(100d); budgetLines.saveAndFlush(line);
        assertTrue(service.get(id,null).version()>initial.version());
    }
    @Test void untitledExistingDraftIsAcceptedAndFinancialFieldsAreRedacted() throws Exception {
        String id=register(),local=UUID.randomUUID().toString(); service.link(id,new Source("bandi","preparation",local,"draft-1"),"bandi");
        JsonNode draft=json.readTree("{\"localId\":\""+local+"\",\"version\":1,\"title\":null,\"status\":\"draft\",\"reviewDecision\":\"pending\",\"requestedGrant\":{\"amount\":\"1.00\",\"currency\":\"EUR\"}}");
        doAnswer(call -> { Projection p=call.getArgument(1); return new Snapshot(1,ORG,id,"bandi",local,p.sourceVersion(),null,null,draft); }).when(peer).publish(eq("bandi"),any());
        Context synced=service.sync(id,null); assertTrue(synced.sync().stream().allMatch(p -> p.status().equals("synced")));
        Context redacted=service.get(id,new SuiteActorResolver.Actor(owner.getId(),false));
        assertNull(redacted.financial()); assertTrue(redacted.preparation().path("requestedGrant").isNull());
    }
    void capture(String method,String path,MvcResult result) throws Exception { captureValue(method,path,json.readTree(result.getResponse().getContentAsString())); }
    void captureValue(String method,String path,JsonNode payload) { captures.add(Map.of("system","librepm","method",method,"path",path,"status",200,"payload",payload)); }
    @AfterAll void writeCaptures() throws Exception { Files.createDirectories(Path.of("build")); json.writerWithDefaultPrettyPrinter().writeValue(Path.of("build/suite-contract-captures.json").toFile(),captures); }
}
