package com.lorenzodm.librepm.repository;

import com.lorenzodm.librepm.core.entity.BudgetLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BudgetLineRepository extends JpaRepository<BudgetLine, String> {
    List<BudgetLine> findByBudgetIdOrderBySortOrderAsc(String budgetId);
    List<BudgetLine> findByBudgetIdAndCategory(String budgetId, String category);

    // Atomic arithmetic keeps concurrent cost entries from losing each other's totals.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE BudgetLine l SET l.actualAmount = l.actualAmount + :delta "
            + "WHERE l.id = :lineId AND l.actualAmount + :delta >= 0")
    int adjustActualAmount(@Param("lineId") String lineId, @Param("delta") double delta);
}
