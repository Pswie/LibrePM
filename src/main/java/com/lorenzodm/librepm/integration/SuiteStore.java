package com.lorenzodm.librepm.integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import static com.lorenzodm.librepm.integration.SuiteModels.*;

/** Small, portable registry. Operational project tables remain owned by LibrePM. */
@Repository
class SuiteStore {
    record Entry(String org, String projectId, long version, String fingerprint, String seedBudget, String deadline) {}
    private final JdbcTemplate db;
    private final ObjectMapper json;
    SuiteStore(JdbcTemplate db, ObjectMapper json) { this.db = db; this.json = json; }
    Optional<Entry> find(String org, String id) {
        return db.query("SELECT * FROM suite_projects WHERE organization_id=? AND project_id=?", (r, n) ->
                new Entry(r.getString("organization_id"), r.getString("project_id"), r.getLong("source_version"),
                        r.getString("fingerprint"), r.getString("seed_budget"), r.getString("project_deadline")), org, id).stream().findFirst();
    }
    List<String> projects(String org) {
        return db.query("SELECT project_id FROM suite_projects WHERE organization_id=? ORDER BY project_id", (r,n) -> r.getString(1), org);
    }
    void register(String org, String id, Money budget, String deadline) {
        db.update("INSERT INTO suite_projects (organization_id,project_id,source_version,fingerprint,seed_budget,project_deadline,sync_lock_until) VALUES (?,?,1,'',?,?,0)",
                org, id, budget == null ? null : encode(budget), deadline);
        link(org, id, new Source("librepm", "project", id, null));
        for (String peer : SuiteConfig.PEERS)
            db.update("INSERT INTO suite_peer_state (organization_id,project_id,system_name,status) VALUES (?,?,?,'unlinked')", org, id, peer);
    }
    boolean refreshVersion(Entry e, String fingerprint) {
        if (e.fingerprint().equals(fingerprint)) return true;
        if (e.version()<0 || e.version()>Integer.MAX_VALUE || e.version()==Integer.MAX_VALUE && !e.fingerprint().isEmpty())
            throw new SuiteException(409,"SUITE_VERSION_LIMIT","Il registro ha raggiunto il limite di versione del contratto.");
        return db.update("UPDATE suite_projects SET fingerprint=?,source_version=? WHERE organization_id=? AND project_id=? AND source_version=? AND fingerprint=?",
                fingerprint, e.fingerprint().isEmpty() ? e.version() : e.version()+1, e.org(), e.projectId(), e.version(), e.fingerprint()) == 1;
    }
    Optional<String> imported(String org, Source source) {
        return db.query("SELECT project_id FROM suite_instances WHERE organization_id=? AND system_name=? AND entity_name=? AND local_id=?",
                (r,n) -> r.getString(1), org, source.system(), source.entity(), source.localId()).stream().findFirst();
    }
    void link(String org, String id, Source source) {
        Optional<String> existing = imported(org, source);
        if (existing.isPresent()) {
            if (!existing.get().equals(id)) throw new SuiteException(409, "SUITE_ALREADY_LINKED", "Questo record appartiene a un altro progetto comune.");
            recordRevision(org,id,source);
            return;
        }
        if (instances(org,id).stream().anyMatch(i -> i.system().equals(source.system())))
            throw new SuiteException(409, "SUITE_ALREADY_LINKED", "Il progetto ha già un collegamento con questa applicazione.");
        db.update("INSERT INTO suite_instances (organization_id,project_id,system_name,entity_name,local_id,source_revision) VALUES (?,?,?,?,?,?)",
                org,id,source.system(),source.entity(),source.localId(),source.revision());
        recordRevision(org,id,source);
    }
    private void recordRevision(String org,String id,Source source) {
        if (source.revision()==null) return;
        // Revisions are opaque, so retain the initial provenance plus an append-only set
        // of observed revisions. Never guess chronology or replace a newer operational plan.
        Integer seen=db.queryForObject("SELECT COUNT(*) FROM suite_instance_revisions WHERE organization_id=? AND system_name=? AND entity_name=? AND local_id=? AND source_revision=?",
                Integer.class,org,source.system(),source.entity(),source.localId(),source.revision());
        if (seen==null || seen==0) db.update("INSERT INTO suite_instance_revisions (organization_id,project_id,system_name,entity_name,local_id,source_revision,observed_at) VALUES (?,?,?,?,?,?,?)",
                org,id,source.system(),source.entity(),source.localId(),source.revision(),Instant.now().toString());
    }
    List<Instance> instances(String org, String id) {
        return db.query("SELECT system_name,entity_name,local_id FROM suite_instances WHERE organization_id=? AND project_id=? ORDER BY system_name",
                (r,n) -> new Instance(r.getString(1),r.getString(2),r.getString(3)),org,id);
    }
    List<PeerState> states(String org, String id) {
        return db.query("SELECT * FROM suite_peer_state WHERE organization_id=? AND project_id=? ORDER BY system_name", (r,n) ->
                new PeerState(r.getString("system_name"),r.getString("status"),r.getString("last_success_at"),r.getString("error_code"),r.getString("error_message")),org,id);
    }
    Optional<Snapshot> snapshot(String org, String id, String peer) {
        return db.query("SELECT snapshot_json FROM suite_peer_state WHERE organization_id=? AND project_id=? AND system_name=?",
                (r,n) -> r.getString(1),org,id,peer).stream().filter(s -> s != null).findFirst().map(s -> decode(s,Snapshot.class));
    }
    void pending(String org, String id, String peer) {
        db.update("UPDATE suite_peer_state SET status='pending',error_code=NULL,error_message=NULL WHERE organization_id=? AND project_id=? AND system_name=?",org,id,peer);
    }
    void success(String org, String id, String peer, Snapshot snapshot) {
        db.update("UPDATE suite_peer_state SET status='synced',last_success_at=?,error_code=NULL,error_message=NULL,snapshot_json=? WHERE organization_id=? AND project_id=? AND system_name=?",
                Instant.now().toString(),encode(snapshot),org,id,peer);
    }
    void failure(String org, String id, String peer, String code, String message) {
        db.update("UPDATE suite_peer_state SET status='error',error_code=?,error_message=? WHERE organization_id=? AND project_id=? AND system_name=?", code,message,org,id,peer);
    }
    boolean acquire(String org, String id, String token) {
        return db.update("UPDATE suite_projects SET sync_lock_token=?,sync_lock_until=? WHERE organization_id=? AND project_id=? AND sync_lock_until<=?", token,Instant.now().getEpochSecond()+120,org,id,Instant.now().getEpochSecond())==1;
    }
    void release(String org, String id, String token) {
        db.update("UPDATE suite_projects SET sync_lock_token=NULL,sync_lock_until=0 WHERE organization_id=? AND project_id=? AND sync_lock_token=?",org,id,token);
    }
    Optional<String> selection(String org, String userId) {
        return db.query("SELECT project_id FROM suite_selections WHERE organization_id=? AND user_id=?", (r,n) -> r.getString(1),org,userId).stream().findFirst();
    }
    void select(String org, String userId, String id) {
        db.update("DELETE FROM suite_selections WHERE organization_id=? AND user_id=?",org,userId);
        db.update("INSERT INTO suite_selections (organization_id,user_id,project_id) VALUES (?,?,?)",org,userId,id);
    }
    String encode(Object value) {
        try { return json.writeValueAsString(value); } catch (JsonProcessingException e) { throw new IllegalStateException("Suite serialization failed",e); }
    }
    <T> T decode(String value, Class<T> type) {
        try { return json.readValue(value,type); } catch (JsonProcessingException e) { throw new IllegalStateException("Suite stored payload invalid",e); }
    }
}
