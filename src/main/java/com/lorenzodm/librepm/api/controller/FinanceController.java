package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.api.exception.ResourceNotFoundException;
import com.lorenzodm.librepm.api.exception.BadRequestException;
import com.lorenzodm.librepm.api.exception.ConflictException;
import com.lorenzodm.librepm.api.validation.RequestValues;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.repository.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Finance REST controller (Phase 18 / PRD-18).
 * Manages budgets, budget lines, funding sources, fund allocations,
 * actual costs, financial baselines, and analytics.
 */
@RestController
@RequestMapping("/api/projects/{projectId}/finance")
@Transactional
public class FinanceController {

    private final ProjectBudgetRepository budgetRepo;
    private final BudgetLineRepository lineRepo;
    private final FundingSourceRepository fundingRepo;
    private final FundAllocationRepository allocationRepo;
    private final ActualCostRecordRepository costRepo;
    private final FinancialBaselineRepository baselineRepo;

    public FinanceController(ProjectBudgetRepository budgetRepo,
                             BudgetLineRepository lineRepo,
                             FundingSourceRepository fundingRepo,
                             FundAllocationRepository allocationRepo,
                             ActualCostRecordRepository costRepo,
                             FinancialBaselineRepository baselineRepo) {
        this.budgetRepo = budgetRepo;
        this.lineRepo = lineRepo;
        this.fundingRepo = fundingRepo;
        this.allocationRepo = allocationRepo;
        this.costRepo = costRepo;
        this.baselineRepo = baselineRepo;
    }

    // =========== BUDGETS ===========

    @GetMapping("/budgets")
    public ResponseEntity<List<Map<String, Object>>> listBudgets(@PathVariable String projectId) {
        return ResponseEntity.ok(budgetRepo.findByProjectIdOrderByVersionDesc(projectId)
                .stream().map(this::budgetToMap).toList());
    }

    @PostMapping("/budgets")
    public ResponseEntity<Map<String, Object>> createBudget(
            @PathVariable String projectId, @RequestBody Map<String, Object> body) {
        ProjectBudget b = new ProjectBudget();
        b.setProjectId(projectId);
        b.setName((String) body.getOrDefault("name", "Budget v1"));
        b.setCurrency((String) body.getOrDefault("currency", "EUR"));
        if (body.get("totalAmount") != null) b.setTotalAmount(RequestValues.amount(body, "totalAmount"));
        return ResponseEntity.ok(budgetToMap(budgetRepo.save(b)));
    }

    @PutMapping("/budgets/{budgetId}")
    public ResponseEntity<Map<String, Object>> updateBudget(
            @PathVariable String projectId, @PathVariable String budgetId, @RequestBody Map<String, Object> body) {
        ProjectBudget b = requireBudget(projectId, budgetId);
        if (body.containsKey("name")) b.setName((String) body.get("name"));
        if (body.containsKey("totalAmount") && body.get("totalAmount") != null)
            b.setTotalAmount(RequestValues.amount(body, "totalAmount"));
        if (body.containsKey("currency")) b.setCurrency((String) body.get("currency"));
        return ResponseEntity.ok(budgetToMap(budgetRepo.save(b)));
    }

    @PostMapping("/budgets/{budgetId}/approve")
    public ResponseEntity<Map<String, Object>> approveBudget(
            @PathVariable String projectId, @PathVariable String budgetId, @RequestBody Map<String, String> body) {
        ProjectBudget b = requireBudget(projectId, budgetId);
        b.setStatus("APPROVED");
        b.setApprovedBy(body.get("approvedBy"));
        b.setApprovedAt(Instant.now());
        return ResponseEntity.ok(budgetToMap(budgetRepo.save(b)));
    }

    @PostMapping("/budgets/{budgetId}/new-version")
    public ResponseEntity<Map<String, Object>> newBudgetVersion(
            @PathVariable String projectId, @PathVariable String budgetId) {
        ProjectBudget source = requireBudget(projectId, budgetId);
        source.setStatus("SUPERSEDED");
        budgetRepo.save(source);

        ProjectBudget nv = new ProjectBudget();
        nv.setProjectId(projectId);
        nv.setName(source.getName());
        nv.setCurrency(source.getCurrency());
        nv.setTotalAmount(source.getTotalAmount());
        nv.setVersion(source.getVersion() + 1);
        nv.setPreviousVersionId(source.getId());
        nv = budgetRepo.save(nv);

        // Copy budget lines
        for (BudgetLine sl : lineRepo.findByBudgetIdOrderBySortOrderAsc(source.getId())) {
            BudgetLine nl = new BudgetLine();
            nl.setBudgetId(nv.getId());
            nl.setName(sl.getName());
            nl.setDescription(sl.getDescription());
            nl.setCategory(sl.getCategory());
            nl.setPhaseId(sl.getPhaseId());
            nl.setDeliverableId(sl.getDeliverableId());
            nl.setPlannedAmount(sl.getPlannedAmount());
            nl.setCommittedAmount(sl.getCommittedAmount());
            nl.setReservedAmount(sl.getReservedAmount());
            nl.setActualAmount(sl.getActualAmount());
            nl.setForecastAmount(sl.getForecastAmount());
            nl.setCurrency(sl.getCurrency());
            nl.setSortOrder(sl.getSortOrder());
            lineRepo.save(nl);
        }

        return ResponseEntity.ok(budgetToMap(nv));
    }

    @DeleteMapping("/budgets/{budgetId}")
    public ResponseEntity<Void> deleteBudget(@PathVariable String projectId, @PathVariable String budgetId) {
        budgetRepo.delete(requireBudget(projectId, budgetId));
        return ResponseEntity.noContent().build();
    }

    // =========== BUDGET LINES ===========

    @GetMapping("/budgets/{budgetId}/lines")
    public ResponseEntity<List<Map<String, Object>>> listLines(
            @PathVariable String projectId, @PathVariable String budgetId) {
        requireBudget(projectId, budgetId);
        return ResponseEntity.ok(lineRepo.findByBudgetIdOrderBySortOrderAsc(budgetId)
                .stream().map(this::lineToMap).toList());
    }

    @PostMapping("/budgets/{budgetId}/lines")
    public ResponseEntity<Map<String, Object>> createLine(
            @PathVariable String projectId, @PathVariable String budgetId, @RequestBody Map<String, Object> body) {
        ProjectBudget budget = requireBudget(projectId, budgetId);
        BudgetLine l = new BudgetLine();
        l.setCurrency(budget.getCurrency());
        l.setBudgetId(budgetId);
        l.setName((String) body.getOrDefault("name", "New Line"));
        l.setCategory((String) body.getOrDefault("category", "MISC"));
        if (body.get("plannedAmount") != null) l.setPlannedAmount(RequestValues.amount(body, "plannedAmount"));
        if (body.get("description") != null) l.setDescription((String) body.get("description"));
        if (body.get("phaseId") != null) l.setPhaseId((String) body.get("phaseId"));
        if (body.get("deliverableId") != null) l.setDeliverableId((String) body.get("deliverableId"));
        if (body.get("sortOrder") != null) l.setSortOrder(((Number) body.get("sortOrder")).intValue());
        return ResponseEntity.ok(lineToMap(lineRepo.save(l)));
    }

    @PutMapping("/lines/{lineId}")
    public ResponseEntity<Map<String, Object>> updateLine(
            @PathVariable String projectId, @PathVariable String lineId, @RequestBody Map<String, Object> body) {
        BudgetLine l = requireLine(projectId, lineId);
        if (body.containsKey("name")) l.setName((String) body.get("name"));
        if (body.containsKey("description")) l.setDescription((String) body.get("description"));
        if (body.containsKey("category")) l.setCategory((String) body.get("category"));
        if (body.containsKey("plannedAmount")) l.setPlannedAmount(RequestValues.amount(body, "plannedAmount"));
        if (body.containsKey("committedAmount")) l.setCommittedAmount(RequestValues.amount(body, "committedAmount"));
        if (body.containsKey("actualAmount")) {
            double actual = RequestValues.amount(body, "actualAmount");
            if (actual < costRepo.sumAmountByBudgetLineId(lineId)) {
                throw new BadRequestException("Il totale effettivo non può essere inferiore ai costi registrati");
            }
            l.setActualAmount(actual);
        }
        if (body.containsKey("forecastAmount")) l.setForecastAmount(RequestValues.amount(body, "forecastAmount"));
        return ResponseEntity.ok(lineToMap(lineRepo.save(l)));
    }

    @DeleteMapping("/lines/{lineId}")
    public ResponseEntity<Void> deleteLine(@PathVariable String projectId, @PathVariable String lineId) {
        lineRepo.delete(requireLine(projectId, lineId));
        return ResponseEntity.noContent().build();
    }

    // =========== FUNDING SOURCES ===========

    @GetMapping("/funding")
    public ResponseEntity<List<Map<String, Object>>> listFunding(@PathVariable String projectId) {
        return ResponseEntity.ok(fundingRepo.findByProjectIdOrderByNameAsc(projectId)
                .stream().map(this::fundingToMap).toList());
    }

    @PostMapping("/funding")
    public ResponseEntity<Map<String, Object>> createFunding(
            @PathVariable String projectId, @RequestBody Map<String, Object> body) {
        FundingSource f = new FundingSource();
        f.setProjectId(projectId);
        f.setName((String) body.getOrDefault("name", "New Fund"));
        f.setType((String) body.getOrDefault("type", "INTERNAL"));
        if (body.get("totalAmount") != null) f.setTotalAmount(RequestValues.amount(body, "totalAmount"));
        if (body.get("restricted") != null) f.setRestricted((Boolean) body.get("restricted"));
        if (body.get("restrictionDescription") != null) f.setRestrictionDescription((String) body.get("restrictionDescription"));
        if (body.get("contactName") != null) f.setContactName((String) body.get("contactName"));
        if (body.get("contactEmail") != null) f.setContactEmail((String) body.get("contactEmail"));
        return ResponseEntity.ok(fundingToMap(fundingRepo.save(f)));
    }

    @PutMapping("/funding/{fundId}")
    public ResponseEntity<Map<String, Object>> updateFunding(
            @PathVariable String projectId, @PathVariable String fundId, @RequestBody Map<String, Object> body) {
        FundingSource f = requireFunding(projectId, fundId);
        if (body.containsKey("name")) f.setName((String) body.get("name"));
        if (body.containsKey("type")) f.setType((String) body.get("type"));
        if (body.containsKey("totalAmount") && body.get("totalAmount") != null)
            f.setTotalAmount(RequestValues.amount(body, "totalAmount"));
        if (body.containsKey("status")) f.setStatus((String) body.get("status"));
        if (body.containsKey("contactName")) f.setContactName((String) body.get("contactName"));
        if (body.containsKey("contactEmail")) f.setContactEmail((String) body.get("contactEmail"));
        if (body.containsKey("currency")) f.setCurrency((String) body.get("currency"));
        if (body.containsKey("restricted")) f.setRestricted(body.get("restricted") != null && (Boolean) body.get("restricted"));
        if (body.containsKey("restrictionDescription")) f.setRestrictionDescription((String) body.get("restrictionDescription"));
        return ResponseEntity.ok(fundingToMap(fundingRepo.save(f)));
    }

    @DeleteMapping("/funding/{fundId}")
    public ResponseEntity<Void> deleteFunding(@PathVariable String projectId, @PathVariable String fundId) {
        fundingRepo.delete(requireFunding(projectId, fundId));
        return ResponseEntity.noContent().build();
    }

    // =========== FUND ALLOCATIONS ===========

    @GetMapping("/funding/{fundId}/allocations")
    public ResponseEntity<List<Map<String, Object>>> listAllocations(
            @PathVariable String projectId, @PathVariable String fundId) {
        requireFunding(projectId, fundId);
        return ResponseEntity.ok(allocationRepo.findByFundingSourceId(fundId)
                .stream().map(this::allocationToMap).toList());
    }

    @PostMapping("/allocations")
    public ResponseEntity<Map<String, Object>> createAllocation(
            @PathVariable String projectId, @RequestBody Map<String, Object> body) {
        FundAllocation a = new FundAllocation();
        FundingSource funding = requireFunding(projectId, RequestValues.requiredText(body, "fundingSourceId"));
        BudgetLine line = requireLine(projectId, RequestValues.requiredText(body, "budgetLineId"));
        if (!Objects.equals(funding.getCurrency(), line.getCurrency())) {
            throw new BadRequestException("Fondo e voce di budget devono usare la stessa valuta");
        }
        a.setFundingSourceId(funding.getId());
        a.setBudgetLineId(line.getId());
        a.setAllocatedAmount(RequestValues.amount(body, "allocatedAmount"));
        if (body.get("notes") != null) a.setNotes((String) body.get("notes"));
        if (body.get("allocationDate") != null) a.setAllocationDate(RequestValues.date(body, "allocationDate"));
        return ResponseEntity.ok(allocationToMap(allocationRepo.save(a)));
    }

    @DeleteMapping("/allocations/{allocId}")
    public ResponseEntity<Void> deleteAllocation(@PathVariable String projectId, @PathVariable String allocId) {
        FundAllocation allocation = allocationRepo.findById(allocId)
                .orElseThrow(() -> new ResourceNotFoundException("Allocation not found: " + allocId));
        requireFunding(projectId, allocation.getFundingSourceId());
        requireLine(projectId, allocation.getBudgetLineId());
        allocationRepo.delete(allocation);
        return ResponseEntity.noContent().build();
    }

    // =========== ACTUAL COSTS ===========

    @GetMapping("/costs")
    public ResponseEntity<List<Map<String, Object>>> listCostsByLine(
            @PathVariable String projectId, @RequestParam String budgetLineId) {
        requireLine(projectId, budgetLineId);
        return ResponseEntity.ok(costRepo.findByBudgetLineIdOrderByCostDateDesc(budgetLineId)
                .stream().map(this::costToMap).toList());
    }

    @PostMapping("/costs")
    public ResponseEntity<Map<String, Object>> recordCost(
            @PathVariable String projectId, @RequestBody Map<String, Object> body) {
        BudgetLine line = requireLine(projectId, RequestValues.requiredText(body, "budgetLineId"));
        ActualCostRecord c = new ActualCostRecord();
        c.setBudgetLineId(line.getId());
        c.setCurrency(line.getCurrency());
        c.setDescription(RequestValues.requiredText(body, "description"));
        c.setAmount(RequestValues.amount(body, "amount"));
        c.setCostDate(RequestValues.date(body, "costDate"));
        if (body.get("recordedBy") != null) c.setRecordedBy((String) body.get("recordedBy"));
        if (body.get("evidenceAssetId") != null) c.setEvidenceAssetId((String) body.get("evidenceAssetId"));
        ActualCostRecord saved = costRepo.save(c);
        adjustActualAmount(line.getId(), c.getAmount());
        return ResponseEntity.ok(costToMap(saved));
    }

    @DeleteMapping("/costs/{costId}")
    public ResponseEntity<Void> deleteCost(@PathVariable String projectId, @PathVariable String costId) {
        ActualCostRecord cost = costRepo.findById(costId)
                .orElseThrow(() -> new ResourceNotFoundException("Cost not found: " + costId));
        BudgetLine line = requireLine(projectId, cost.getBudgetLineId());
        costRepo.delete(cost);
        adjustActualAmount(line.getId(), -cost.getAmount());
        return ResponseEntity.noContent().build();
    }

    // =========== ANALYTICS ===========

    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> analytics(@PathVariable String projectId) {
        Map<String, Object> result = new LinkedHashMap<>();

        // Get latest approved budget or fallback to latest draft
        List<ProjectBudget> approved = budgetRepo.findByProjectIdAndStatus(projectId, "APPROVED");
        ProjectBudget budget = approved.isEmpty()
                ? budgetRepo.findByProjectIdOrderByVersionDesc(projectId).stream().findFirst().orElse(null)
                : approved.get(0);

        if (budget == null) {
            result.put("hasBudget", false);
            return ResponseEntity.ok(result);
        }

        result.put("hasBudget", true);
        result.put("budgetName", budget.getName());
        result.put("budgetStatus", budget.getStatus());

        List<BudgetLine> lines = lineRepo.findByBudgetIdOrderBySortOrderAsc(budget.getId());
        double totalPlanned = lines.stream().mapToDouble(BudgetLine::getPlannedAmount).sum();
        double totalActual = lines.stream().mapToDouble(BudgetLine::getActualAmount).sum();
        double totalCommitted = lines.stream().mapToDouble(BudgetLine::getCommittedAmount).sum();
        double totalForecast = lines.stream().mapToDouble(BudgetLine::getForecastAmount).sum();

        result.put("totalPlanned", totalPlanned);
        result.put("totalActual", totalActual);
        result.put("totalCommitted", totalCommitted);
        result.put("totalForecast", totalForecast);
        result.put("variance", totalPlanned - totalActual);
        result.put("variancePercentage", totalPlanned > 0 ? ((totalPlanned - totalActual) / totalPlanned) * 100 : 0);
        result.put("burnRate", totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0);

        // By category breakdown
        Map<String, Double> byCategory = lines.stream()
                .collect(Collectors.groupingBy(BudgetLine::getCategory, Collectors.summingDouble(BudgetLine::getActualAmount)));
        result.put("actualByCategory", byCategory);

        // Funding coverage
        List<FundingSource> sources = fundingRepo.findByProjectIdOrderByNameAsc(projectId);
        double totalFunding = sources.stream()
                .filter(s -> s.getTotalAmount() != null)
                .mapToDouble(FundingSource::getTotalAmount).sum();
        result.put("totalFunding", totalFunding);
        result.put("fundingCoverage", totalPlanned > 0 ? (totalFunding / totalPlanned) * 100 : 0);
        result.put("fundingGap", Math.max(0, totalPlanned - totalFunding));

        return ResponseEntity.ok(result);
    }

    private void adjustActualAmount(String lineId, double delta) {
        if (lineRepo.adjustActualAmount(lineId, delta) != 1) {
            throw new ConflictException("I costi registrati e il totale effettivo non sono allineati. "
                    + "Riconcilia il totale della voce di budget prima di modificare i costi; nessun dato è stato cancellato.");
        }
    }

    private ProjectBudget requireBudget(String projectId, String budgetId) {
        return budgetRepo.findById(budgetId)
                .filter(b -> Objects.equals(projectId, b.getProjectId()))
                .orElseThrow(() -> new ResourceNotFoundException("Budget not found in project: " + budgetId));
    }

    private BudgetLine requireLine(String projectId, String lineId) {
        BudgetLine line = lineRepo.findById(lineId)
                .orElseThrow(() -> new ResourceNotFoundException("Budget line not found: " + lineId));
        requireBudget(projectId, line.getBudgetId());
        return line;
    }

    private FundingSource requireFunding(String projectId, String fundId) {
        return fundingRepo.findById(fundId)
                .filter(f -> Objects.equals(projectId, f.getProjectId()))
                .orElseThrow(() -> new ResourceNotFoundException("Funding source not found in project: " + fundId));
    }

    // =========== MAPPERS ===========

    private Map<String, Object> budgetToMap(ProjectBudget b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.getId());
        m.put("projectId", b.getProjectId());
        m.put("name", b.getName());
        m.put("version", b.getVersion());
        m.put("status", b.getStatus());
        m.put("currency", b.getCurrency());
        m.put("totalAmount", b.getTotalAmount());
        m.put("approvedBy", b.getApprovedBy());
        m.put("approvedAt", b.getApprovedAt());
        m.put("previousVersionId", b.getPreviousVersionId());
        m.put("createdAt", b.getCreatedAt());
        m.put("updatedAt", b.getUpdatedAt());
        return m;
    }

    private Map<String, Object> lineToMap(BudgetLine l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("budgetId", l.getBudgetId());
        m.put("name", l.getName());
        m.put("description", l.getDescription());
        m.put("category", l.getCategory());
        m.put("phaseId", l.getPhaseId());
        m.put("deliverableId", l.getDeliverableId());
        m.put("plannedAmount", l.getPlannedAmount());
        m.put("committedAmount", l.getCommittedAmount());
        m.put("reservedAmount", l.getReservedAmount());
        m.put("actualAmount", l.getActualAmount());
        m.put("forecastAmount", l.getForecastAmount());
        m.put("currency", l.getCurrency());
        m.put("sortOrder", l.getSortOrder());
        return m;
    }

    private Map<String, Object> fundingToMap(FundingSource f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", f.getId());
        m.put("projectId", f.getProjectId());
        m.put("name", f.getName());
        m.put("type", f.getType());
        m.put("totalAmount", f.getTotalAmount());
        m.put("currency", f.getCurrency());
        m.put("restricted", f.isRestricted());
        m.put("restrictionDescription", f.getRestrictionDescription());
        m.put("contactName", f.getContactName());
        m.put("contactEmail", f.getContactEmail());
        m.put("status", f.getStatus());
        m.put("createdAt", f.getCreatedAt());
        return m;
    }

    private Map<String, Object> allocationToMap(FundAllocation a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("fundingSourceId", a.getFundingSourceId());
        m.put("budgetLineId", a.getBudgetLineId());
        m.put("allocatedAmount", a.getAllocatedAmount());
        m.put("allocationDate", a.getAllocationDate());
        m.put("notes", a.getNotes());
        return m;
    }

    private Map<String, Object> costToMap(ActualCostRecord c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("budgetLineId", c.getBudgetLineId());
        m.put("description", c.getDescription());
        m.put("amount", c.getAmount());
        m.put("currency", c.getCurrency());
        m.put("costDate", c.getCostDate());
        m.put("evidenceAssetId", c.getEvidenceAssetId());
        m.put("recordedBy", c.getRecordedBy());
        m.put("createdAt", c.getCreatedAt());
        return m;
    }
}
