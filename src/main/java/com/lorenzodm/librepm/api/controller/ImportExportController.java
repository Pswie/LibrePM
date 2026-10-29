package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.api.dto.response.ImportExportJobResponse;
import com.lorenzodm.librepm.api.mapper.ImportExportJobMapper;
import com.lorenzodm.librepm.service.CsvImportService;
import com.lorenzodm.librepm.service.ProjectExportService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Import/Export endpoints (PRD-14-FR-003, FR-004, FR-005, FR-006, FR-009).
 * PRD-14-BR-003: exports MUST NOT alter source data.
 * PRD-14-BR-002: imports use staging/validation before commit.
 */
@RestController
@RequestMapping("/api/users/{userId}/projects/{projectId}")
public class ImportExportController {

    private final ProjectExportService exportService;
    private final CsvImportService csvImportService;
    private final ImportExportJobMapper jobMapper;

    public ImportExportController(ProjectExportService exportService,
                                   CsvImportService csvImportService,
                                   ImportExportJobMapper jobMapper) {
        this.exportService = exportService;
        this.csvImportService = csvImportService;
        this.jobMapper = jobMapper;
    }

    // --- Export endpoints ---

    /**
     * Exports all project tasks as CSV (PRD-14-FR-003, PRD-14-AC-002).
     * Returns an ImportExportJob; resultPayload contains the CSV content.
     */
    @PostMapping("/export/csv")
    public ResponseEntity<ImportExportJobResponse> exportCsv(
            @PathVariable String userId,
            @PathVariable String projectId) {
        return ResponseEntity.ok(jobMapper.toResponse(exportService.exportProjectCsv(userId, projectId)));
    }

    /**
     * Exports the full project as JSON (tasks, deliverables, OKRs, charter).
     * PRD-14-FR-003.
     */
    @PostMapping("/export/json")
    public ResponseEntity<ImportExportJobResponse> exportJson(
            @PathVariable String userId,
            @PathVariable String projectId) {
        return ResponseEntity.ok(jobMapper.toResponse(exportService.exportProjectJson(userId, projectId)));
    }

    /**
     * Exports the project charter and executive summary as JSON.
     * PRD-14-FR-006, PRD-14-AC-004.
     */
    @PostMapping("/export/charter")
    public ResponseEntity<ImportExportJobResponse> exportCharter(
            @PathVariable String userId,
            @PathVariable String projectId) {
        return ResponseEntity.ok(jobMapper.toResponse(exportService.exportCharterJson(userId, projectId)));
    }

    // --- Import endpoints ---

    /**
     * Imports tasks from a CSV body (PRD-14-FR-004, PRD-14-AC-003).
     * Pipeline: parse → validate → stage → commit valid rows.
     * PRD-14-BR-002: invalid rows are reported; valid rows are committed.
     */
    @PostMapping(value = "/import/csv", consumes = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<ImportExportJobResponse> importCsv(
            @PathVariable String userId,
            @PathVariable String projectId,
            @RequestBody String csvContent) {
        return ResponseEntity.ok(jobMapper.toResponse(
                csvImportService.importTasksCsv(userId, projectId, csvContent)));
    }

    // --- Job tracking ---

    /**
     * Lists all import/export jobs for this project (PRD-14-FR-009).
     */
    @GetMapping("/jobs")
    public ResponseEntity<List<ImportExportJobResponse>> listJobs(
            @PathVariable String userId,
            @PathVariable String projectId) {
        return ResponseEntity.ok(exportService.listJobs(userId, projectId)
                .stream().map(jobMapper::toResponse).toList());
    }

    /**
     * Gets a specific job by ID (PRD-14-FR-009).
     */
    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<ImportExportJobResponse> getJob(
            @PathVariable String userId,
            @PathVariable String projectId,
            @PathVariable String jobId) {
        return ResponseEntity.ok(jobMapper.toResponse(exportService.getJob(userId, projectId, jobId)));
    }

    /**
     * Returns the raw result payload of a completed export job (e.g. inline CSV/JSON).
     * PRD-14-AC-002: export content accessible via job result.
     */
    @GetMapping(value = "/jobs/{jobId}/download", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<String> downloadJobResult(
            @PathVariable String userId,
            @PathVariable String projectId,
            @PathVariable String jobId) {
        var job = exportService.getJob(userId, projectId, jobId);
        if (job.getResultPayload() == null) {
            return ResponseEntity.noContent().build();
        }
        String filename = job.getJobType() != null
                ? job.getJobType().name().toLowerCase() + "_" + jobId + ".txt"
                : "export_" + jobId + ".txt";
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
                .body(job.getResultPayload());
    }
}
