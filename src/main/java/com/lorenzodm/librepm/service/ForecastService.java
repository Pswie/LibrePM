package com.lorenzodm.librepm.service;

import java.time.LocalDate;
import java.util.Map;

public interface ForecastService {

    /**
     * Computes current effort-based forecast metrics: SPI, CPI, EAC, ETC, VAC.
     * Earned value follows the 0/100 completed-task rule, not hours consumed.
     * Historical/future dates are rejected until status/planning snapshots exist.
     * Indices without sufficient planning/progress data are returned as null.
     */
    Map<String, Object> computeEarnedValueMetrics(String projectId, LocalDate asOfDate);

    /**
     * Detects overbooking (allocation > capacity) and underutilization.
     */
    Map<String, Object> detectResourceIssues(String projectId, LocalDate from, LocalDate to);
}
