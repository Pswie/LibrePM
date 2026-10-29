package com.lorenzodm.librepm.service;

import com.lorenzodm.librepm.core.entity.ImportExportJob;

/**
 * Export service for projects (PRD-14-FR-003, FR-005, FR-006, FR-009).
 * PRD-14-BR-003: export MUST NOT alter source data.
 * Jobs are persisted for traceability (PRD-14-FR-009).
 */
public interface ProjectExportService {

    /**
     * Exports all tasks of a project as CSV (PRD-14-FR-003, PRD-14-AC-002).
     * Creates a completed ImportExportJob with the CSV content in resultPayload.
     */
    ImportExportJob exportProjectCsv(String userId, String projectId);

    /**
     * Exports the full project (tasks, deliverables, OKRs, charter) as JSON (PRD-14-FR-003).
     */
    ImportExportJob exportProjectJson(String userId, String projectId);

    /**
     * Exports the project charter and executive dashboard as JSON (PRD-14-FR-006, PRD-14-AC-004).
     */
    ImportExportJob exportCharterJson(String userId, String projectId);

    /**
     * Returns all jobs for a user/project.
     */
    java.util.List<ImportExportJob> listJobs(String userId, String projectId);

    /** Returns a job only within the requested user and project scope. */
    ImportExportJob getJob(String userId, String projectId, String jobId);
}
