package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.api.exception.ResourceNotFoundException;
import com.lorenzodm.librepm.api.exception.BadRequestException;
import com.lorenzodm.librepm.api.exception.ConflictException;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

/**
 * Change Control REST controller (Phase 20 / PRD-20).
 * Manages change requests, project branches, branch modifications, and decision log.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/changes")
public class ChangeControlController {

    private final ChangeRequestRepository crRepo;
    private final ProjectBranchRepository branchRepo;
    private final BranchModificationRepository modRepo;
    private final DecisionLogRepository decisionRepo;

    public ChangeControlController(ChangeRequestRepository crRepo,
                                   ProjectBranchRepository branchRepo,
                                   BranchModificationRepository modRepo,
                                   DecisionLogRepository decisionRepo) {
        this.crRepo = crRepo;
        this.branchRepo = branchRepo;
        this.modRepo = modRepo;
        this.decisionRepo = decisionRepo;
    }

    // =========== CHANGE REQUESTS ===========

    @GetMapping("/requests")
    public ResponseEntity<List<Map<String, Object>>> listRequests(@PathVariable String projectId) {
        return ResponseEntity.ok(crRepo.findByProjectIdOrderByRequestedAtDesc(projectId)
                .stream().map(this::crToMap).toList());
    }

    @PostMapping("/requests")
    public ResponseEntity<Map<String, Object>> createRequest(
            @PathVariable String projectId, @RequestBody Map<String, Object> body) {
        ChangeRequest cr = new ChangeRequest();
        cr.setProjectId(projectId);
        cr.setTitle((String) body.getOrDefault("title", "New Change Request"));
        cr.setDescription((String) body.get("description"));
        cr.setMotivation((String) body.get("motivation"));
        cr.setScope((String) body.get("scope"));
        cr.setPriority((String) body.getOrDefault("priority", "MEDIUM"));
        cr.setExpectedImpact((String) body.get("expectedImpact"));
        cr.setStatus((String) body.getOrDefault("status", "DRAFT"));
        cr.setRequestedBy((String) body.get("requestedBy"));
        return ResponseEntity.ok(crToMap(crRepo.save(cr)));
    }

    @PutMapping("/requests/{crId}")
    public ResponseEntity<Map<String, Object>> updateRequest(
            @PathVariable String projectId, @PathVariable String crId,
            @RequestBody Map<String, Object> body) {
        ChangeRequest cr = getRequest(projectId, crId);
        if (body.containsKey("title")) cr.setTitle((String) body.get("title"));
        if (body.containsKey("description")) cr.setDescription((String) body.get("description"));
        if (body.containsKey("motivation")) cr.setMotivation((String) body.get("motivation"));
        if (body.containsKey("scope")) cr.setScope((String) body.get("scope"));
        if (body.containsKey("priority")) cr.setPriority((String) body.get("priority"));
        if (body.containsKey("expectedImpact")) cr.setExpectedImpact((String) body.get("expectedImpact"));
        if (body.containsKey("status")) {
            String newStatus = (String) body.get("status");
            cr.setStatus(newStatus);
            if (("APPROVED".equals(newStatus) || "REJECTED".equals(newStatus)) && cr.getResolvedAt() == null) {
                cr.setResolvedAt(Instant.now());
            }
            if ("APPROVED".equals(newStatus) && body.containsKey("approvedBy")) {
                cr.setApprovedBy((String) body.get("approvedBy"));
            }
        }
        return ResponseEntity.ok(crToMap(crRepo.save(cr)));
    }

    @DeleteMapping("/requests/{crId}")
    public ResponseEntity<Void> deleteRequest(@PathVariable String projectId, @PathVariable String crId) {
        crRepo.delete(getRequest(projectId, crId));
        return ResponseEntity.noContent().build();
    }

    // =========== PROJECT BRANCHES ===========

    @GetMapping("/branches")
    public ResponseEntity<List<Map<String, Object>>> listBranches(@PathVariable String projectId) {
        return ResponseEntity.ok(branchRepo.findBySourceProjectIdOrderByCreatedAtDesc(projectId)
                .stream().map(this::branchToMap).toList());
    }

    @PostMapping("/branches")
    public ResponseEntity<Map<String, Object>> createBranch(
            @PathVariable String projectId, @RequestBody Map<String, Object> body) {
        ProjectBranch b = new ProjectBranch();
        b.setSourceProjectId(projectId);
        b.setName((String) body.getOrDefault("name", "New Branch"));
        b.setDescription((String) body.get("description"));
        b.setBranchType((String) body.getOrDefault("branchType", "SCENARIO"));
        b.setStatus("ACTIVE");
        String changeRequestId = (String) body.get("changeRequestId");
        if (changeRequestId != null) getRequest(projectId, changeRequestId);
        b.setChangeRequestId(changeRequestId);
        b.setCreatedBy((String) body.get("createdBy"));
        b.setSnapshotJson((String) body.get("snapshotJson"));
        return ResponseEntity.ok(branchToMap(branchRepo.save(b)));
    }

    @PutMapping("/branches/{branchId}")
    public ResponseEntity<Map<String, Object>> updateBranch(
            @PathVariable String projectId, @PathVariable String branchId,
            @RequestBody Map<String, Object> body) {
        ProjectBranch b = getBranch(projectId, branchId);
        if (body.containsKey("status")) {
            String status = (String) body.get("status");
            if ("MERGED".equals(status)) {
                throw new ConflictException("L'unione delle modifiche nel progetto non è ancora disponibile. "
                        + "Nessuna modifica è stata applicata; il ramo conserva lo stato precedente.");
            }
            if (status == null || !Set.of("ACTIVE", "APPROVED", "REJECTED", "ARCHIVED").contains(status)) {
                throw new BadRequestException("Stato del ramo non valido.");
            }
        }
        if (body.containsKey("name")) b.setName((String) body.get("name"));
        if (body.containsKey("description")) b.setDescription((String) body.get("description"));
        if (body.containsKey("status")) {
            String newStatus = (String) body.get("status");
            b.setStatus(newStatus);
        }
        return ResponseEntity.ok(branchToMap(branchRepo.save(b)));
    }

    @DeleteMapping("/branches/{branchId}")
    public ResponseEntity<Void> deleteBranch(@PathVariable String projectId, @PathVariable String branchId) {
        branchRepo.delete(getBranch(projectId, branchId));
        return ResponseEntity.noContent().build();
    }

    // =========== BRANCH MODIFICATIONS ===========

    @GetMapping("/branches/{branchId}/modifications")
    public ResponseEntity<List<Map<String, Object>>> listModifications(
            @PathVariable String projectId, @PathVariable String branchId) {
        getBranch(projectId, branchId);
        return ResponseEntity.ok(modRepo.findByBranchIdOrderByModifiedAtDesc(branchId)
                .stream().map(this::modToMap).toList());
    }

    @PostMapping("/branches/{branchId}/modifications")
    public ResponseEntity<Map<String, Object>> addModification(
            @PathVariable String projectId, @PathVariable String branchId, @RequestBody Map<String, Object> body) {
        getBranch(projectId, branchId);
        BranchModification m = new BranchModification();
        m.setBranchId(branchId);
        m.setEntityType((String) body.get("entityType"));
        m.setEntityId((String) body.get("entityId"));
        m.setModificationType((String) body.getOrDefault("modificationType", "MODIFY"));
        m.setOldValueJson((String) body.get("oldValueJson"));
        m.setNewValueJson((String) body.get("newValueJson"));
        return ResponseEntity.ok(modToMap(modRepo.save(m)));
    }

    @DeleteMapping("/branches/{branchId}/modifications/{modId}")
    public ResponseEntity<Void> deleteModification(
            @PathVariable String projectId, @PathVariable String branchId, @PathVariable String modId) {
        getBranch(projectId, branchId);
        BranchModification modification = modRepo.findById(modId)
                .filter(m -> Objects.equals(m.getBranchId(), branchId))
                .orElseThrow(() -> new ResourceNotFoundException("BranchModification not found: " + modId));
        modRepo.delete(modification);
        return ResponseEntity.noContent().build();
    }

    // =========== DECISION LOG ===========

    @GetMapping("/decisions")
    public ResponseEntity<List<Map<String, Object>>> listDecisions(@PathVariable String projectId) {
        return ResponseEntity.ok(decisionRepo.findByProjectIdOrderByDecidedAtDesc(projectId)
                .stream().map(this::decisionToMap).toList());
    }

    @PostMapping("/decisions")
    public ResponseEntity<Map<String, Object>> createDecision(
            @PathVariable String projectId, @RequestBody Map<String, Object> body) {
        DecisionLog d = new DecisionLog();
        d.setProjectId(projectId);
        d.setTitle((String) body.getOrDefault("title", "New Decision"));
        d.setDecision((String) body.getOrDefault("decision", ""));
        d.setRationale((String) body.get("rationale"));
        d.setDecidedBy((String) body.get("decidedBy"));
        String branchId = (String) body.get("branchId");
        if (branchId != null) getBranch(projectId, branchId);
        d.setBranchId(branchId);
        String changeRequestId = (String) body.get("changeRequestId");
        if (changeRequestId != null) getRequest(projectId, changeRequestId);
        d.setChangeRequestId(changeRequestId);
        d.setImpactSummary((String) body.get("impactSummary"));
        return ResponseEntity.ok(decisionToMap(decisionRepo.save(d)));
    }

    @PutMapping("/decisions/{decisionId}")
    public ResponseEntity<Map<String, Object>> updateDecision(
            @PathVariable String projectId, @PathVariable String decisionId,
            @RequestBody Map<String, Object> body) {
        DecisionLog d = getDecision(projectId, decisionId);
        if (body.containsKey("title")) d.setTitle((String) body.get("title"));
        if (body.containsKey("decision")) d.setDecision((String) body.get("decision"));
        if (body.containsKey("rationale")) d.setRationale((String) body.get("rationale"));
        if (body.containsKey("impactSummary")) d.setImpactSummary((String) body.get("impactSummary"));
        return ResponseEntity.ok(decisionToMap(decisionRepo.save(d)));
    }

    @DeleteMapping("/decisions/{decisionId}")
    public ResponseEntity<Void> deleteDecision(@PathVariable String projectId, @PathVariable String decisionId) {
        decisionRepo.delete(getDecision(projectId, decisionId));
        return ResponseEntity.noContent().build();
    }

    // =========== MAPPERS ===========

    private ChangeRequest getRequest(String projectId, String id) {
        return crRepo.findById(id).filter(cr -> Objects.equals(cr.getProjectId(), projectId))
                .orElseThrow(() -> new ResourceNotFoundException("ChangeRequest not found: " + id));
    }

    private ProjectBranch getBranch(String projectId, String id) {
        return branchRepo.findById(id).filter(b -> Objects.equals(b.getSourceProjectId(), projectId))
                .orElseThrow(() -> new ResourceNotFoundException("ProjectBranch not found: " + id));
    }

    private DecisionLog getDecision(String projectId, String id) {
        return decisionRepo.findById(id).filter(d -> Objects.equals(d.getProjectId(), projectId))
                .orElseThrow(() -> new ResourceNotFoundException("DecisionLog not found: " + id));
    }

    private Map<String, Object> crToMap(ChangeRequest cr) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", cr.getId());
        m.put("projectId", cr.getProjectId());
        m.put("title", cr.getTitle());
        m.put("description", cr.getDescription());
        m.put("motivation", cr.getMotivation());
        m.put("scope", cr.getScope());
        m.put("priority", cr.getPriority());
        m.put("expectedImpact", cr.getExpectedImpact());
        m.put("status", cr.getStatus());
        m.put("requestedBy", cr.getRequestedBy());
        m.put("approvedBy", cr.getApprovedBy());
        m.put("requestedAt", cr.getRequestedAt());
        m.put("resolvedAt", cr.getResolvedAt());
        return m;
    }

    private Map<String, Object> branchToMap(ProjectBranch b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId());
        m.put("sourceProjectId", b.getSourceProjectId());
        m.put("name", b.getName());
        m.put("description", b.getDescription());
        m.put("branchType", b.getBranchType());
        m.put("status", b.getStatus());
        m.put("changeRequestId", b.getChangeRequestId());
        m.put("createdBy", b.getCreatedBy());
        m.put("createdAt", b.getCreatedAt());
        m.put("mergedAt", b.getMergedAt());
        return m;
    }

    private Map<String, Object> modToMap(BranchModification mod) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", mod.getId());
        m.put("branchId", mod.getBranchId());
        m.put("entityType", mod.getEntityType());
        m.put("entityId", mod.getEntityId());
        m.put("modificationType", mod.getModificationType());
        m.put("oldValueJson", mod.getOldValueJson());
        m.put("newValueJson", mod.getNewValueJson());
        m.put("modifiedAt", mod.getModifiedAt());
        return m;
    }

    private Map<String, Object> decisionToMap(DecisionLog d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.getId());
        m.put("projectId", d.getProjectId());
        m.put("branchId", d.getBranchId());
        m.put("changeRequestId", d.getChangeRequestId());
        m.put("title", d.getTitle());
        m.put("decision", d.getDecision());
        m.put("rationale", d.getRationale());
        m.put("decidedBy", d.getDecidedBy());
        m.put("decidedAt", d.getDecidedAt());
        m.put("impactSummary", d.getImpactSummary());
        return m;
    }
}
