package com.lorenzodm.librepm.service.impl;

import com.lorenzodm.librepm.api.exception.BadRequestException;
import com.lorenzodm.librepm.core.entity.Task;
import com.lorenzodm.librepm.core.entity.TaskStatus;
import com.lorenzodm.librepm.repository.ResourceAllocationRepository;
import com.lorenzodm.librepm.repository.TaskRepository;
import com.lorenzodm.librepm.repository.TimeEntryRepository;
import com.lorenzodm.librepm.service.CapacityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class ForecastServiceImplTest {
    private TaskRepository tasks;
    private TimeEntryRepository entries;
    private ForecastServiceImpl service;

    @BeforeEach
    void setUp() {
        tasks = mock(TaskRepository.class);
        entries = mock(TimeEntryRepository.class);
        service = new ForecastServiceImpl(tasks, entries,
                mock(ResourceAllocationRepository.class), mock(CapacityService.class));
    }

    @Test
    void consumingTheEstimateDoesNotEarnValueForUnfinishedWork() {
        Task task = task(10.0, TaskStatus.Category.IN_PROGRESS);
        task.setActualEffortHours(10.0);
        when(tasks.findByProjectId("p")).thenReturn(List.of(task));
        when(entries.sumDurationByProjectIdThroughDate("p", LocalDate.now())).thenReturn(600);

        Map<String, Object> metrics = service.computeEarnedValueMetrics("p", LocalDate.now());

        assertThat(metrics).containsEntry("earnedValue", 0.0).containsEntry("actualCost", 10.0)
                .containsEntry("cpi", 0.0).containsEntry("eac", null);
        verify(entries).sumDurationByProjectIdThroughDate("p", LocalDate.now());
        verify(entries, never()).sumDurationByProjectId(anyString());
    }

    @Test
    void completedWorkEarnsItsEstimateWithoutRequiringHoursToBeSpent() {
        when(tasks.findByProjectId("p")).thenReturn(List.of(task(8.0, TaskStatus.Category.DONE)));

        Map<String, Object> metrics = service.computeEarnedValueMetrics("p", null);

        assertThat(metrics).containsEntry("earnedValue", 8.0).containsEntry("actualCost", 0.0)
                .containsEntry("earnedValueMethod", "COMPLETED_TASKS_0_100");
    }

    @Test
    void scheduleIndexUsesWorkPlannedByTodayRatherThanTheWholeBudget() {
        Task task = task(8.0, TaskStatus.Category.DONE);
        task.setPlannedStart(LocalDate.now().minusDays(3).atStartOfDay());
        task.setPlannedFinish(LocalDate.now().plusDays(4).atStartOfDay());
        when(tasks.findByProjectId("p")).thenReturn(List.of(task));

        Map<String, Object> metrics = service.computeEarnedValueMetrics("p", LocalDate.now());

        assertThat(metrics).containsEntry("bac", 8.0).containsEntry("plannedValue", 4.0)
                .containsEntry("spi", 2.0);
    }

    @Test
    void missingScheduleDoesNotProduceAnInventedScheduleIndex() {
        Task task = task(8.0, TaskStatus.Category.DONE);
        task.setPlannedStart(null);
        when(tasks.findByProjectId("p")).thenReturn(List.of(task));

        assertThat(service.computeEarnedValueMetrics("p", LocalDate.now()))
                .containsEntry("scheduleAvailable", false).containsEntry("plannedValue", null)
                .containsEntry("spi", null);
    }

    @Test
    void summaryRollupsDoNotCountTheSameBudgetTwiceAndLegacyMinutesAreSupported() {
        Task summary = task(100.0, TaskStatus.Category.DONE);
        summary.setType(Task.Type.SUMMARY_TASK);
        Task child = task(null, TaskStatus.Category.DONE);
        child.setEstimatedEffort(120);
        when(tasks.findByProjectId("p")).thenReturn(List.of(summary, child));

        assertThat(service.computeEarnedValueMetrics("p", LocalDate.now()))
                .containsEntry("bac", 2.0).containsEntry("earnedValue", 2.0);
    }

    @Test
    void emptyProjectReturnsTheSameMetricFields() {
        when(tasks.findByProjectId("p")).thenReturn(List.of());

        assertThat(service.computeEarnedValueMetrics("p", LocalDate.now()))
                .containsEntry("bac", 0.0).containsEntry("earnedValue", 0.0)
                .containsEntry("actualCost", 0.0).containsEntry("etc", 0.0).containsEntry("vac", 0.0);
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 1})
    void nonCurrentDateCannotBeSilentlyCalculatedWithCurrentState(int offset) {
        assertThrows(BadRequestException.class,
                () -> service.computeEarnedValueMetrics("p", LocalDate.now().plusDays(offset)));
        verifyNoInteractions(tasks, entries);
    }

    private Task task(Double plannedHours, TaskStatus.Category category) {
        Task task = new Task();
        task.setEstimatedEffortHours(plannedHours);
        task.setStatus(new TaskStatus("Custom status", category));
        task.setPlannedStart(LocalDate.now().minusDays(1).atStartOfDay());
        task.setPlannedFinish(LocalDate.now().atStartOfDay());
        return task;
    }
}
