package com.lorenzodm.librepm.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.repository.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.*;
import static com.lorenzodm.librepm.integration.SuiteModels.*;
import static com.lorenzodm.librepm.integration.SuiteActorResolver.Actor;

/** Common project coordination, independent from the legacy device SyncService. */
@Service
public class SuiteService {
    private final SuiteConfig config;
    private final SuiteStore store;
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final UserRepository users;
    private final ProjectBudgetRepository budgets;
    private final BudgetLineRepository budgetLines;
    private final SuitePeerClient client;
    private final TransactionTemplate tx;
    SuiteService(SuiteConfig config, SuiteStore store, ProjectRepository projects, ProjectMemberRepository members,
                 UserRepository users, ProjectBudgetRepository budgets, BudgetLineRepository budgetLines, SuitePeerClient client, PlatformTransactionManager manager) {
        this.config=config; this.store=store; this.projects=projects; this.members=members;
        this.users=users; this.budgets=budgets; this.budgetLines=budgetLines; this.client=client; this.tx=new TransactionTemplate(manager);
    }
    public List<Context> list(Actor actor) {
        String org=config.organization();
        return tx.execute(s -> store.projects(org).stream().filter(id -> projects.findById(id).isPresent())
                .filter(id -> actor==null || allowed(actor,id,false)).map(id -> context(org,id,actor)).toList());
    }
    public Context get(String id, Actor actor) {
        String org=config.organization(); validateId(id);
        return tx.execute(s -> { access(actor,id,false); return context(org,id,actor); });
    }
    public synchronized Context register(String id, Actor actor) {
        String org=config.organization(); validateId(id);
        try {
            return tx.execute(s -> {
                access(actor,id,true);
                if (store.find(org,id).isEmpty()) store.register(org,id,null,null);
                return context(org,id,actor);
            });
        } catch (DataIntegrityViolationException e) {
            // A competing instance may have registered the same project first.
            return get(id,actor);
        }
    }
    public Context importSeed(Seed seed, String peer) {
        validateSeed(seed,peer); String org=config.organization();
        try {
            return tx.execute(s -> {
                Optional<String> prior=store.imported(org,seed.source());
                if (prior.isPresent()) { store.link(org,prior.get(),seed.source()); return context(org,prior.get(),null); }
                User owner=Optional.ofNullable(seed.actorSubject()).filter(v -> !v.isBlank()).flatMap(users::findByClerkUserId)
                        .or(() -> config.ownerId().isBlank() ? Optional.empty() : users.findById(config.ownerId()))
                        .filter(u -> u.isActive() && !u.isGhost())
                        .orElseThrow(() -> SuiteException.unavailable("Nessun proprietario reale configurato per i progetti importati."));
                Project project=new Project(); project.setOwner(owner); project.setName(seed.title().trim()); project.setDescription(seed.description());
                project.setFinanceEnabled(seed.plannedBudget()!=null);
                projects.saveAndFlush(project);
                members.save(new ProjectMember(project,owner,ProjectMember.Role.OWNER));
                if (seed.plannedBudget()!=null) {
                    ProjectBudget budget=new ProjectBudget(); budget.setProjectId(project.getId());
                    budget.setName("Budget preventivo iniziale"); budget.setCurrency(seed.plannedBudget().currency());
                    budget.setTotalAmount(new BigDecimal(seed.plannedBudget().amount()).doubleValue()); budgets.save(budget);
                    BudgetLine line=new BudgetLine(); line.setBudgetId(budget.getId()); line.setName("Preventivo iniziale dalla sorgente");
                    line.setCategory("MISC"); line.setCurrency(seed.plannedBudget().currency());
                    line.setPlannedAmount(budget.getTotalAmount()); budgetLines.save(line);
                }
                store.register(org,project.getId(),seed.plannedBudget(),seed.projectDeadline());
                store.link(org,project.getId(),seed.source());
                return context(org,project.getId(),null);
            });
        } catch (DataIntegrityViolationException race) {
            Optional<String> id=store.imported(org,seed.source());
            if (id.isPresent()) return get(id.get(),null);
            throw new SuiteException(409,"SUITE_IMPORT_CONFLICT","Il progetto è stato modificato da un'altra richiesta. Riprova.");
        }
    }
    public synchronized Context link(String id, Source source, String peer) {
        String org=config.organization(); validateId(id); validateSource(source,peer);
        try {
            return tx.execute(s -> { requireEntry(org,id); requireProject(id); store.link(org,id,source); return context(org,id,null); });
        } catch (DataIntegrityViolationException e) { throw new SuiteException(409,"SUITE_ALREADY_LINKED","Il record è già collegato a un progetto."); }
    }
    public Selection selection(Actor actor) {
        String org=config.organization();
        return tx.execute(s -> new Selection(store.selection(org,actor.userId()).filter(id -> store.find(org,id).isPresent())
                .filter(id -> projects.findById(id).isPresent() && allowed(actor,id,false)).orElse(null)));
    }
    public Selection select(String id, Actor actor) {
        String org=config.organization(); validateId(id);
        return tx.execute(s -> { access(actor,id,false); requireEntry(org,id); store.select(org,actor.userId(),id); return new Selection(id); });
    }
    public Context sync(String id, Actor actor) {
        String org=config.organization(); validateId(id);
        tx.executeWithoutResult(s -> { access(actor,id,true); requireEntry(org,id); });
        String token=UUID.randomUUID().toString();
        if (!store.acquire(org,id,token)) throw new SuiteException(409,"SUITE_SYNC_BUSY","Un allineamento di questo progetto è già in corso.");
        try {
            for (String peer:SuiteConfig.PEERS) {
                if (!config.configured(peer)) {
                    store.failure(org,id,peer,"SUITE_PEER_NOT_CONFIGURED","Collegamento con " + peer + " non configurato.");
                    continue;
                }
                try {
                    Projection projection=tx.execute(s -> projection(org,id,peer));
                    store.pending(org,id,peer);
                    Snapshot response=client.publish(peer,projection);
                    validateSnapshot(response,projection,peer);
                    Snapshot snapshot=sanitized(response);
                    tx.executeWithoutResult(s -> {
                        if (snapshot.localId()!=null) store.link(org,id,new Source(peer,"bandi".equals(peer)?"preparation":"project",snapshot.localId(),null));
                        store.success(org,id,peer,snapshot);
                    });
                } catch (SuiteException e) { store.failure(org,id,peer,e.code(),e.getMessage());
                } catch (DataIntegrityViolationException e) { store.failure(org,id,peer,"SUITE_ALREADY_LINKED","Il record remoto è già associato a un altro progetto.");
                } catch (Exception e) { store.failure(org,id,peer,"SUITE_SYNC_FAILED","Allineamento non riuscito. Riprova più tardi."); }
            }
            return get(id,actor);
        } finally { store.release(org,id,token); }
    }
    @Scheduled(fixedDelayString="${SUITE_SYNC_INTERVAL_MS:300000}", initialDelayString="${SUITE_SYNC_INITIAL_DELAY_MS:60000}")
    void scheduledSync() {
        if (!config.enabled()) return;
        try {
            for (String id:store.projects(config.organization())) {
                try { sync(id,null); } catch (SuiteException ignored) { /* Per-peer failures are persisted; next run retries. */ }
            }
        } catch (SuiteException ignored) { /* Disabled/incomplete setup must not prevent local work. */ }
    }
    private Context context(String org, String id, Actor actor) {
        Project project=requireProject(id); SuiteStore.Entry entry=refresh(org,id);
        List<PeerState> states=store.states(org,id).stream().map(state -> config.configured(state.system()) ? state
                : new PeerState(state.system(),"disabled",state.lastSuccessAt(),"SUITE_PEER_NOT_CONFIGURED","Collegamento non configurato.")).toList();
        Snapshot accounting=store.snapshot(org,id,"associago").orElse(null);
        Snapshot preparation=store.snapshot(org,id,"bandi").orElse(null);
        boolean finance=actor==null || actor.finance();
        JsonNode candidature=preparation==null ? null : preparation.preparation();
        if (!finance && candidature!=null && candidature.isObject()) {
            ObjectNode copy=candidature.deepCopy(); copy.putNull("requestedGrant"); candidature=copy;
        }
        return new Context(1,org,id,project.getName(),project.getDescription(),entry.version(),store.instances(org,id),links(id),states,
                finance && accounting!=null ? accounting.financial() : null,accounting==null?null:accounting.workforce(),candidature);
    }
    private Projection projection(String org, String id, String peer) {
        SuiteStore.Entry entry=refresh(org,id); Project project=requireProject(id);
        String localId=store.instances(org,id).stream().filter(i -> i.system().equals(peer)).map(Instance::localId).findFirst().orElse(null);
        return new Projection(1,org,id,entry.version(),project.getName(),project.getDescription(),plannedBudget(entry),entry.deadline(),localId,links(id));
    }
    private SuiteStore.Entry refresh(String org,String id) {
        for (int attempt=0;attempt<3;attempt++) {
            SuiteStore.Entry entry=requireEntry(org,id); Project project=requireProject(id);
            String payload=store.encode(Arrays.asList(project.getName(),project.getDescription(),plannedBudget(entry),entry.deadline()));
            try {
                String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8)));
                if (store.refreshVersion(entry,hash)) return requireEntry(org,id);
            } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
        }
        throw new SuiteException(409,"SUITE_VERSION_CONFLICT","Il progetto è stato aggiornato. Riprova.");
    }
    private Money plannedBudget(SuiteStore.Entry entry) {
        List<ProjectBudget> local=budgets.findByProjectIdOrderByVersionDesc(entry.projectId());
        if (!local.isEmpty()) {
            ProjectBudget budget=local.getFirst();
            List<BudgetLine> lines=budgetLines.findByBudgetIdOrderBySortOrderAsc(budget.getId());
            BigDecimal planned;
            if (!lines.isEmpty()) {
                planned=BigDecimal.ZERO;
                for (BudgetLine line:lines) {
                    if (!Objects.equals(budget.getCurrency(),line.getCurrency())) throw new SuiteException(409,"SUITE_BUDGET_CURRENCY","Il budget contiene righe in valute diverse: non è possibile sommarle automaticamente.");
                    if (!Double.isFinite(line.getPlannedAmount())) throw new SuiteException(409,"SUITE_INVALID_BUDGET","Il preventivo contiene un importo non valido.");
                    planned=planned.add(BigDecimal.valueOf(line.getPlannedAmount()));
                }
            } else {
                if (budget.getTotalAmount()==null) return null;
                if (!Double.isFinite(budget.getTotalAmount())) throw new SuiteException(409,"SUITE_INVALID_BUDGET","Il preventivo contiene un importo non valido.");
                planned=BigDecimal.valueOf(budget.getTotalAmount());
            }
            Money amount=new Money(planned.toPlainString(),budget.getCurrency());
            validateMoney(amount); return amount;
        }
        return entry.seedBudget()==null?null:store.decode(entry.seedBudget(),Money.class);
    }
    private Links links(String id) { return new Links(config.publicLink("librepm",id),config.publicLink("associago",id),config.publicLink("bandi",id)); }
    private SuiteStore.Entry requireEntry(String org,String id) { return store.find(org,id).orElseThrow(() -> new SuiteException(404,"SUITE_NOT_FOUND","Progetto non registrato tra le applicazioni.")); }
    private Project requireProject(String id) { return projects.findById(id).orElseThrow(() -> new SuiteException(404,"SUITE_NOT_FOUND","Progetto non disponibile.")); }
    private void access(Actor actor,String id,boolean write) {
        requireProject(id);
        if (actor!=null && !allowed(actor,id,write)) throw new SuiteException(403,"SUITE_FORBIDDEN","Non hai i permessi per questo progetto.");
    }
    private boolean allowed(Actor actor,String id,boolean write) {
        Project project=requireProject(id);
        if (project.getOwner().getId().equals(actor.userId())) return true;
        return members.findByProjectIdAndUserId(id,actor.userId()).filter(m -> !write || m.getRole()!=ProjectMember.Role.VIEWER).isPresent();
    }
    private static void validateId(String id) { SuiteConfig.uuid(id,"Identificativo progetto non valido."); }
    private void validateSeed(Seed seed,String peer) {
        if (seed==null || !Objects.equals(seed.schemaVersion(),1)) throw SuiteException.invalid("Versione del contratto non valida.");
        if (!config.organization().equals(seed.organizationId())) throw new SuiteException(403,"SUITE_ORGANIZATION","Organizzazione non autorizzata.");
        validateSource(seed.source(),peer);
        text(seed.title(),200,"Nome progetto");
        if (seed.description()!=null && seed.description().length()>2000) throw SuiteException.invalid("Descrizione troppo lunga (massimo 2000 caratteri).");
        validateMoney(seed.plannedBudget());
        if (seed.plannedBudget()!=null) {
            BigDecimal exact=new BigDecimal(seed.plannedBudget().amount());
            if (!Double.isFinite(exact.doubleValue()) || BigDecimal.valueOf(exact.doubleValue()).compareTo(exact)!=0)
                throw new SuiteException(409,"SUITE_AMOUNT_PRECISION","Il budget supera la precisione del piano LibrePM. Usa un importo rappresentabile senza arrotondamento.");
        }
        if (seed.projectDeadline()!=null) try {
            if (!seed.projectDeadline().matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw new IllegalArgumentException();
            LocalDate.parse(seed.projectDeadline());
        } catch (Exception e) { throw SuiteException.invalid("Data progetto non valida."); }
        if (seed.actorSubject()!=null) text(seed.actorSubject(),255,"Identità sorgente");
    }
    private static void validateSource(Source source,String peer) {
        if (source==null || peer==null || !SuiteConfig.PEERS.contains(peer) || !peer.equals(source.system())) throw new SuiteException(403,"SUITE_SOURCE_MISMATCH","La sorgente non corrisponde all'applicazione autenticata.");
        if (!("bandi".equals(peer)?"preparation":"project").equals(source.entity())) throw SuiteException.invalid("Tipo di record sorgente non valido.");
        text(source.localId(),128,"Identificativo locale"); text(source.revision(),255,"Revisione sorgente");
    }
    private static void text(String value,int max,String label) {
        if (value==null || value.isBlank() || value.length()>max || value.chars().anyMatch(Character::isISOControl)) throw SuiteException.invalid(label + " non valido.");
    }
    private static void validateMoney(Money money) {
        if (money==null) return;
        if (money.currency()==null || !money.currency().matches("[A-Z]{3}")) throw SuiteException.invalid("Valuta non valida.");
        decimal(money.amount(),false);
    }
    private static void decimal(String amount,boolean negative) {
        if (amount==null || !amount.matches(negative?"-?[0-9]+(?:\\.[0-9]+)?":"[0-9]+(?:\\.[0-9]+)?") || amount.length()>128)
            throw SuiteException.invalid("Importo decimale non valido.");
    }
    private static void validateSnapshot(Snapshot snapshot,Projection projection,String peer) {
        if (snapshot==null || !Objects.equals(snapshot.schemaVersion(),1) || !projection.organizationId().equals(snapshot.organizationId())
                || !projection.suiteProjectId().equals(snapshot.suiteProjectId()) || !peer.equals(snapshot.system())
                || snapshot.sourceVersion()==null || snapshot.sourceVersion()!=projection.sourceVersion())
            throw new SuiteException(503,"SUITE_PEER_PAYLOAD","Identità o versione della risposta remota non valida.");
        if (snapshot.localId()!=null) text(snapshot.localId(),128,"Identificativo remoto");
        if (projection.targetLocalId()!=null && !projection.targetLocalId().equals(snapshot.localId()))
            throw new SuiteException(409,"SUITE_PEER_REBIND","La risposta remota indica un collegamento diverso da quello registrato.");
        if ("bandi".equals(peer) && (present(snapshot.financial()) || present(snapshot.workforce()))
                || "associago".equals(peer) && present(snapshot.preparation()))
            throw new SuiteException(503,"SUITE_PEER_PAYLOAD","Riepilogo restituito dall'applicazione non competente.");
        if (present(snapshot.financial())) {
            JsonNode f=snapshot.financial();
            if (!f.isObject() || !"EUR".equals(f.path("currency").asText())) throw SuiteException.invalid("Rendiconto remoto con valuta non valida.");
            decimal(f.path("income").asText(null),false); decimal(f.path("expense").asText(null),false); decimal(f.path("balance").asText(null),true);
        }
        if (present(snapshot.workforce())) {
            JsonNode w=snapshot.workforce();
            if (!w.path("assignedCount").isIntegralNumber() || !w.path("assignedCount").canConvertToInt() || w.path("assignedCount").asInt()<0) throw SuiteException.invalid("Conteggio presenze remoto non valido.");
            decimal(w.path("completedHours").asText(null),false);
        }
        if (present(snapshot.preparation())) {
            JsonNode p=snapshot.preparation();
            if (!p.isObject() || !p.path("version").isIntegralNumber() || !p.path("version").canConvertToInt() || p.path("version").asLong()<1
                    || !Objects.equals(snapshot.localId(),p.path("localId").asText(null))) throw SuiteException.invalid("Candidatura remota non valida.");
            SuiteConfig.uuid(p.path("localId").asText(),"Identificativo candidatura non valido.");
            if (present(p.get("title"))) text(p.path("title").asText(null),2000,"Titolo candidatura");
            if (present(p.get("requestedGrant"))) validateMoney(new Money(p.path("requestedGrant").path("amount").asText(null),p.path("requestedGrant").path("currency").asText(null)));
        }
    }
    private static boolean present(JsonNode node) { return node!=null && !node.isNull(); }
    private static Snapshot sanitized(Snapshot snapshot) {
        // A peer can send only aggregates. Unknown fields never become a back door for personal data.
        JsonNode financial=only(snapshot.financial(),"currency","income","expense","balance");
        JsonNode workforce=only(snapshot.workforce(),"assignedCount","completedHours");
        JsonNode preparation=only(snapshot.preparation(),"localId","version","title","status","reviewDecision","requestedGrant");
        if (preparation instanceof ObjectNode object && present(object.get("requestedGrant")))
            object.set("requestedGrant",only(object.get("requestedGrant"),"amount","currency"));
        return new Snapshot(snapshot.schemaVersion(),snapshot.organizationId(),snapshot.suiteProjectId(),snapshot.system(),snapshot.localId(),snapshot.sourceVersion(),financial,workforce,preparation);
    }
    private static JsonNode only(JsonNode value,String... keys) {
        if (!present(value)) return null;
        ObjectNode copy=com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        for (String key:keys) { if (value.has(key)) copy.set(key,value.get(key)); else copy.putNull(key); }
        return copy;
    }
}
