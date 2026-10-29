package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.api.exception.BadRequestException;
import com.lorenzodm.librepm.api.exception.ConflictException;
import com.lorenzodm.librepm.api.exception.ResourceNotFoundException;
import com.lorenzodm.librepm.core.entity.ActualCostRecord;
import com.lorenzodm.librepm.core.entity.BudgetLine;
import com.lorenzodm.librepm.core.entity.FundingSource;
import com.lorenzodm.librepm.core.entity.ProjectBudget;
import com.lorenzodm.librepm.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.lorenzodm.librepm.util.PortManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = "spring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=true", showSql = false)
@ActiveProfiles("test")
@Import(FinanceController.class)
class FinanceControllerDataTest {
    @MockitoBean PortManager portManager;
    @Autowired ProjectBudgetRepository budgets;
    @Autowired BudgetLineRepository lines;
    @Autowired FundingSourceRepository funds;
    @Autowired FundAllocationRepository allocations;
    @Autowired ActualCostRecordRepository costs;
    @Autowired FinancialBaselineRepository baselines;
    @Autowired FinanceController controller;
    ProjectBudget budget;
    BudgetLine line;

    @BeforeEach
    void setup() {
        budget = new ProjectBudget();
        budget.setProjectId("project-a");
        budget.setName("Operating budget");
        budgets.saveAndFlush(budget);
        line = new BudgetLine();
        line.setBudgetId(budget.getId());
        line.setName("Equipment");
        line.setCategory("EQUIPMENT");
        line.setPlannedAmount(200);
        line.setActualAmount(75);
        lines.saveAndFlush(line);
    }

    @Test
    void recordedCostsUpdateAnalyticsAndDeletionPreservesExistingManualActuals() {
        var recorded = controller.recordCost("project-a", cost(25)).getBody();
        assertNotNull(recorded);
        assertEquals(100d, lines.findById(line.getId()).orElseThrow().getActualAmount());
        assertEquals(100d, controller.analytics("project-a").getBody().get("totalActual"));
        controller.deleteCost("project-a", (String) recorded.get("id"));
        assertEquals(75d, lines.findById(line.getId()).orElseThrow().getActualAmount());
        assertEquals(0, costs.count());
    }

    @Test
    void anotherProjectCannotReadOrModifyBudgetChildren() {
        assertThrows(ResourceNotFoundException.class, () -> controller.listLines("project-b", budget.getId()));
        assertThrows(ResourceNotFoundException.class, () -> controller.deleteLine("project-b", line.getId()));
        assertThrows(ResourceNotFoundException.class, () -> controller.recordCost("project-b", cost(20)));
        assertEquals(0, costs.count());
        assertTrue(lines.existsById(line.getId()));
    }

    @Test
    void allocationCannotJoinFundingFromOneProjectToAnotherProjectsBudget() {
        FundingSource funding = new FundingSource();
        funding.setProjectId("project-b");
        funding.setName("Restricted grant");
        funding.setType("GRANT");
        funds.saveAndFlush(funding);
        assertThrows(ResourceNotFoundException.class, () -> controller.createAllocation("project-b",
                Map.of("fundingSourceId", funding.getId(), "budgetLineId", line.getId(), "allocatedAmount", 50)));
        assertEquals(0, allocations.count());
    }

    @Test
    void invalidCostsAreRejectedBeforeTheyChangeTotals() {
        assertThrows(BadRequestException.class, () -> controller.recordCost("project-a", cost(-10)));
        assertThrows(BadRequestException.class, () -> controller.recordCost("project-a", cost(Double.NaN)));
        assertEquals(75d, lines.findById(line.getId()).orElseThrow().getActualAmount());
        assertEquals(0, costs.count());
    }

    @Test
    void manualActualCannotBeLoweredBelowRecordedInvoices() {
        controller.recordCost("project-a", cost(25));
        assertThrows(BadRequestException.class,
                () -> controller.updateLine("project-a", line.getId(), Map.of("actualAmount", 10)));
        assertEquals(100d, lines.findById(line.getId()).orElseThrow().getActualAmount());
        assertEquals(25d, costs.sumAmountByBudgetLineId(line.getId()));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void inconsistentLegacyCostDeletionRollsBackWithoutLosingInvoiceOrGoingNegative() {
        // Reproduce a pre-fix invoice not reflected in the manually entered total.
        ActualCostRecord legacy = new ActualCostRecord();
        legacy.setBudgetLineId(line.getId());
        legacy.setDescription("Legacy invoice requiring reconciliation");
        legacy.setAmount(100);
        legacy.setCostDate(LocalDate.of(2026, 10, 29));
        costs.saveAndFlush(legacy);
        try {
            ConflictException conflict = assertThrows(ConflictException.class,
                    () -> controller.deleteCost("project-a", legacy.getId()));
            assertTrue(conflict.getMessage().contains("Riconcilia"));
            assertTrue(costs.existsById(legacy.getId()), "Deleting the invoice must roll back with the failed total update");
            assertEquals(75d, lines.findById(line.getId()).orElseThrow().getActualAmount());
        } finally {
            costs.deleteById(legacy.getId());
            lines.deleteById(line.getId());
            budgets.deleteById(budget.getId());
        }
    }

    private Map<String, Object> cost(double amount) {
        return Map.of("budgetLineId", line.getId(), "description", "Invoice", "amount", amount,
                "costDate", "2026-10-29");
    }
}
