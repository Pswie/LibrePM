package com.lorenzodm.librepm.service.impl;

import com.lorenzodm.librepm.api.exception.BadRequestException;
import com.lorenzodm.librepm.core.entity.ResourceAllocation;
import com.lorenzodm.librepm.core.entity.Task;

import com.lorenzodm.librepm.repository.ResourceAllocationRepository;
import com.lorenzodm.librepm.repository.TaskRepository;
import com.lorenzodm.librepm.repository.TimeEntryRepository;
import com.lorenzodm.librepm.service.CapacityService;
import com.lorenzodm.librepm.service.ForecastService;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class ForecastServiceImpl implements ForecastService {

    private final TaskRepository taskRepo;
    private final TimeEntryRepository timeEntryRepo;
    private final ResourceAllocationRepository allocationRepo;
    private final CapacityService capacityService;

    public ForecastServiceImpl(TaskRepository taskRepo,
                               TimeEntryRepository timeEntryRepo,
                               ResourceAllocationRepository allocationRepo,
                               CapacityService capacityService) {
        this.taskRepo = taskRepo;
        this.timeEntryRepo = timeEntryRepo;
        this.allocationRepo = allocationRepo;
        this.capacityService = capacityService;
    }

    @Override
    public Map<String, Object> computeEarnedValueMetrics(String projectId, LocalDate asOfDate) {
        LocalDate today = LocalDate.now();
        LocalDate date = asOfDate != null ? asOfDate : today;
        if (!today.equals(date)) {
            throw new BadRequestException("Le metriche sono disponibili solo alla data corrente: "
                    + "non sono ancora disponibili snapshot storici di stato e pianificazione.");
        }
        List<Task> tasks = taskRepo.findByProjectId(projectId);
        Map<String, Object> metrics = new LinkedHashMap<>();
        double totalPlannedEffort = 0;
        double earnedEffort = 0;
        double plannedValue = 0;
        boolean scheduleAvailable = true;

        for (Task task : tasks) {
            // Summary tasks roll up their children; including both counts the
            // same work twice. The current model has no partial progress field,
            // so earned value uses the explicit 0/100 completion rule.
            if (task.getType() == Task.Type.SUMMARY_TASK) continue;
            double planned = task.getEstimatedEffortHours() != null
                    ? task.getEstimatedEffortHours()
                    : task.getEstimatedEffort() != null ? task.getEstimatedEffort() / 60.0 : 0;
            planned = Math.max(0, planned);
            totalPlannedEffort += planned;
            if (task.getStatus() != null && task.getStatus().isCompleted()) {
                earnedEffort += planned;
            }
            if (planned == 0) continue;
            if (task.getPlannedStart() == null || task.getPlannedFinish() == null
                    || task.getPlannedFinish().isBefore(task.getPlannedStart())) {
                scheduleAvailable = false;
                continue;
            }
            LocalDate start = task.getPlannedStart().toLocalDate();
            LocalDate finish = task.getPlannedFinish().toLocalDate();
            long durationDays = ChronoUnit.DAYS.between(start, finish) + 1;
            long elapsedDays = Math.max(0, Math.min(durationDays, ChronoUnit.DAYS.between(start, date) + 1));
            plannedValue += planned * elapsedDays / durationDays;
        }

        // Future-dated time entries cannot count as cost already incurred.
        int totalMinutes = timeEntryRepo.sumDurationByProjectIdThroughDate(projectId, date);
        double actualEffort = totalMinutes / 60.0;

        // Budget At Completion
        double bac = totalPlannedEffort;

        // Schedule Performance Index
        Double spi = scheduleAvailable && plannedValue > 0 ? earnedEffort / plannedValue : null;

        // Cost Performance Index
        double cpi = actualEffort > 0 ? earnedEffort / actualEffort : 0;

        // Estimate At Completion
        Double eac = null;
        if (cpi > 0) eac = bac / cpi;
        else if (actualEffort == 0) eac = bac;

        // Estimate To Complete
        Double etc = eac != null ? Math.max(0, eac - actualEffort) : null;

        // Variance At Completion
        Double vac = eac != null ? bac - eac : null;

        metrics.put("asOfDate", date.toString());
        metrics.put("earnedValueMethod", "COMPLETED_TASKS_0_100");
        metrics.put("scheduleAvailable", scheduleAvailable);
        metrics.put("bac", Math.round(bac * 100.0) / 100.0);
        metrics.put("plannedValue", scheduleAvailable ? rounded(plannedValue) : null);
        metrics.put("earnedValue", Math.round(earnedEffort * 100.0) / 100.0);
        metrics.put("actualCost", Math.round(actualEffort * 100.0) / 100.0);
        metrics.put("spi", rounded(spi));
        metrics.put("cpi", Math.round(cpi * 100.0) / 100.0);
        metrics.put("eac", rounded(eac));
        metrics.put("etc", rounded(etc));
        metrics.put("vac", rounded(vac));

        return metrics;
    }

    private Double rounded(Double value) {
        return value != null ? Math.round(value * 100.0) / 100.0 : null;
    }

    @Override
    public Map<String, Object> detectResourceIssues(String projectId, LocalDate from, LocalDate to) {
        List<ResourceAllocation> allocations = allocationRepo.findByProjectIdAndPeriodOverlap(projectId, from, to);

        // Group allocations by userId
        Map<String, List<ResourceAllocation>> byUser = allocations.stream()
                .collect(Collectors.groupingBy(a -> a.getUser().getId()));

        List<Map<String, Object>> overbooked = new ArrayList<>();
        List<Map<String, Object>> underutilized = new ArrayList<>();

        for (var entry : byUser.entrySet()) {
            String userId = entry.getKey();
            List<ResourceAllocation> userAllocations = entry.getValue();

            // Check each day in the range
            for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
                double capacity = capacityService.getAvailableHours(userId, date);
                if (capacity <= 0) continue;

                // Sum allocation percentages for this day
                final LocalDate checkDate = date;
                int totalPct = userAllocations.stream()
                        .filter(a -> !a.getStartDate().isAfter(checkDate) && !a.getEndDate().isBefore(checkDate))
                        .mapToInt(ResourceAllocation::getPercentage)
                        .sum();

                if (totalPct > 100) {
                    Map<String, Object> issue = new LinkedHashMap<>();
                    issue.put("userId", userId);
                    issue.put("date", date.toString());
                    issue.put("allocationPct", totalPct);
                    issue.put("type", "OVERBOOKED");
                    overbooked.add(issue);
                } else if (totalPct < 50 && totalPct > 0) {
                    Map<String, Object> issue = new LinkedHashMap<>();
                    issue.put("userId", userId);
                    issue.put("date", date.toString());
                    issue.put("allocationPct", totalPct);
                    issue.put("type", "UNDERUTILIZED");
                    underutilized.add(issue);
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("overbooked", overbooked);
        result.put("underutilized", underutilized);
        result.put("overbookedCount", overbooked.size());
        result.put("underutilizedCount", underutilized.size());
        return result;
    }
}
