package com.lorenzodm.librepm.repository;

import com.lorenzodm.librepm.core.entity.ActualCostRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActualCostRecordRepository extends JpaRepository<ActualCostRecord, String> {
    List<ActualCostRecord> findByBudgetLineIdOrderByCostDateDesc(String budgetLineId);

    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM ActualCostRecord c WHERE c.budgetLineId = :lineId")
    double sumAmountByBudgetLineId(@Param("lineId") String lineId);
}
