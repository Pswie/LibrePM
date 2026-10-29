package com.lorenzodm.librepm.repository;

import com.lorenzodm.librepm.core.entity.TimeEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface TimeEntryRepository extends JpaRepository<TimeEntry, String> {

    List<TimeEntry> findByTaskIdOrderByEntryDateDesc(String taskId);

    List<TimeEntry> findByUserIdOrderByEntryDateDesc(String userId);

    @Query("SELECT te FROM TimeEntry te WHERE te.task.id = :taskId AND te.deletedAt IS NULL ORDER BY te.entryDate DESC")
    List<TimeEntry> findActiveByTaskId(@Param("taskId") String taskId);

    @Query("SELECT te FROM TimeEntry te WHERE te.user.id = :userId AND te.deletedAt IS NULL ORDER BY te.entryDate DESC")
    List<TimeEntry> findActiveByUserId(@Param("userId") String userId);

    @Query("SELECT te FROM TimeEntry te WHERE te.user.id = :userId AND te.entryDate BETWEEN :start AND :end AND te.deletedAt IS NULL ORDER BY te.entryDate DESC")
    List<TimeEntry> findByUserIdAndDateRange(
            @Param("userId") String userId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT te FROM TimeEntry te WHERE te.task.project.id = :projectId AND te.deletedAt IS NULL ORDER BY te.entryDate DESC")
    List<TimeEntry> findByProjectId(@Param("projectId") String projectId);

    @Query("SELECT COALESCE(SUM(te.durationMinutes), 0) FROM TimeEntry te WHERE te.task.id = :taskId AND te.deletedAt IS NULL")
    int sumDurationByTaskId(@Param("taskId") String taskId);

    @Query("SELECT COALESCE(SUM(te.durationMinutes), 0) FROM TimeEntry te WHERE te.user.id = :userId AND te.deletedAt IS NULL")
    int sumDurationByUserId(@Param("userId") String userId);

    @Query("SELECT COALESCE(SUM(te.durationMinutes), 0) FROM TimeEntry te WHERE te.task.project.id = :projectId AND te.deletedAt IS NULL")
    int sumDurationByProjectId(@Param("projectId") String projectId);

    @Query("SELECT COALESCE(SUM(te.durationMinutes), 0) FROM TimeEntry te WHERE te.task.project.id = :projectId AND te.entryDate <= :date AND te.deletedAt IS NULL")
    int sumDurationByProjectIdThroughDate(@Param("projectId") String projectId, @Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(te.durationMinutes), 0) FROM TimeEntry te WHERE te.user.id = :userId AND te.entryDate BETWEEN :start AND :end AND te.deletedAt IS NULL")
    int sumDurationByUserIdAndDateRange(
            @Param("userId") String userId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);
}
