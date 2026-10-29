package com.lorenzodm.librepm.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.lorenzodm.librepm.api.exception.ResourceNotFoundException;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.repository.*;
import com.lorenzodm.librepm.service.ProjectExportService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * PRD-14-FR-003/005/006/009: Project export (CSV, JSON, charter JSON).
 * PRD-14-BR-003: export does NOT alter source data.
 */
@Service
@Transactional(readOnly = true)
public class ProjectExportServiceImpl implements ProjectExportService {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final DeliverableRepository deliverableRepository;
    private final OkrRepository okrRepository;
    private final ProjectCharterRepository charterRepository;
    private final ImportExportJobRepository jobRepository;
    private final ObjectMapper objectMapper;

    public ProjectExportServiceImpl(ProjectRepository projectRepository,
                                     TaskRepository taskRepository,
                                     DeliverableRepository deliverableRepository,
                                     OkrRepository okrRepository,
                                     ProjectCharterRepository charterRepository,
                                     ImportExportJobRepository jobRepository) {
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.deliverableRepository = deliverableRepository;
        this.okrRepository = okrRepository;
        this.charterRepository = charterRepository;
        this.jobRepository = jobRepository;
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @Override
    @Transactional
    public ImportExportJob exportProjectCsv(String userId, String projectId) {
        ImportExportJob job = initJob(userId, projectId, ImportExportJob.JobType.EXPORT_CSV);
        try {
            Project project = getProject(projectId);
            List<Task> tasks = taskRepository.findByProjectId(projectId);

            StringBuilder csv = new StringBuilder();
            csv.append("id,title,description,status,priority,deadline,plannedStart,plannedFinish,estimatedEffort,actualEffort,archived\n");

            for (Task t : tasks) {
                csv.append(escapeCsv(t.getId())).append(",");
                csv.append(escapeCsv(t.getTitle())).append(",");
                csv.append(escapeCsv(t.getDescription())).append(",");
                csv.append(escapeCsv(t.getStatus() != null ? t.getStatus().getName() : "")).append(",");
                csv.append(escapeCsv(t.getPriority() != null ? t.getPriority().getName() : "")).append(",");
                csv.append(escapeCsv(t.getDeadline() != null ? t.getDeadline().toString() : "")).append(",");
                csv.append(escapeCsv(t.getPlannedStart() != null ? t.getPlannedStart().toString() : "")).append(",");
                csv.append(escapeCsv(t.getPlannedFinish() != null ? t.getPlannedFinish().toString() : "")).append(",");
                csv.append(t.getEstimatedEffort() != null ? t.getEstimatedEffort() : "").append(",");
                csv.append(t.getActualEffort() != null ? t.getActualEffort() : "").append(",");
                csv.append(t.isArchived()).append("\n");
            }

            return completeJob(job, csv.toString(), tasks.size());
        } catch (Exception e) {
            return failJob(job, e.getMessage());
        }
    }

    @Override
    @Transactional
    public ImportExportJob exportProjectJson(String userId, String projectId) {
        ImportExportJob job = initJob(userId, projectId, ImportExportJob.JobType.EXPORT_JSON);
        try {
            Project project = getProject(projectId);
            List<Task> tasks = taskRepository.findByProjectId(projectId);
            List<Deliverable> deliverables = deliverableRepository.findByProjectId(projectId);
            List<Okr> okrs = okrRepository.findByProjectId(projectId);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("projectId", project.getId());
            payload.put("projectName", project.getName());
            payload.put("exportedAt", Instant.now().toString());

            List<Map<String, Object>> taskList = tasks.stream().map(t -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", t.getId());
                m.put("title", t.getTitle());
                m.put("description", t.getDescription());
                m.put("status", t.getStatus() != null ? t.getStatus().getName() : null);
                m.put("priority", t.getPriority() != null ? t.getPriority().getName() : null);
                m.put("type", t.getType() != null ? t.getType().name() : null);
                m.put("deadline", t.getDeadline());
                m.put("plannedStart", t.getPlannedStart());
                m.put("plannedFinish", t.getPlannedFinish());
                m.put("estimatedEffort", t.getEstimatedEffort());
                m.put("actualEffort", t.getActualEffort());
                m.put("archived", t.isArchived());
                m.put("parentTaskId", t.getParentTask() != null ? t.getParentTask().getId() : null);
                return m;
            }).toList();
            payload.put("tasks", taskList);

            List<Map<String, Object>> delivList = deliverables.stream().map(d -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", d.getId());
                m.put("name", d.getName());
                m.put("description", d.getDescription());
                m.put("dueDate", d.getDueDate());
                m.put("progress", d.getProgress());
                m.put("riskStatus", d.getRiskStatus() != null ? d.getRiskStatus().name() : null);
                return m;
            }).toList();
            payload.put("deliverables", delivList);

            payload.put("okrCount", okrs.size());

            String json = objectMapper.writeValueAsString(payload);
            return completeJob(job, json, tasks.size());
        } catch (Exception e) {
            return failJob(job, e.getMessage());
        }
    }

    @Override
    @Transactional
    public ImportExportJob exportCharterJson(String userId, String projectId) {
        ImportExportJob job = initJob(userId, projectId, ImportExportJob.JobType.EXPORT_CHARTER_JSON);
        try {
            Project project = getProject(projectId);
            Optional<ProjectCharter> charter = charterRepository.findByProjectId(projectId);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("projectId", project.getId());
            payload.put("projectName", project.getName());
            payload.put("exportedAt", Instant.now().toString());

            charter.ifPresent(c -> {
                Map<String, Object> ch = new LinkedHashMap<>();
                ch.put("sponsor", c.getSponsor());
                ch.put("projectManager", c.getProjectManager());
                ch.put("objectives", c.getObjectives());
                ch.put("problemStatement", c.getProblemStatement());
                ch.put("businessCase", c.getBusinessCase());
                payload.put("charter", ch);
            });

            if (charter.isEmpty()) payload.put("charter", null);

            String json = objectMapper.writeValueAsString(payload);
            return completeJob(job, json, 1);
        } catch (Exception e) {
            return failJob(job, e.getMessage());
        }
    }

    @Override
    public List<ImportExportJob> listJobs(String userId, String projectId) {
        if (projectId != null) {
            return jobRepository.findByUserIdAndProjectIdOrderByCreatedAtDesc(userId, projectId);
        }
        return jobRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Override
    public ImportExportJob getJob(String userId, String projectId, String jobId) {
        return jobRepository.findByIdAndUserIdAndProjectId(jobId, userId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Job non trovato: " + jobId));
    }

    // --- Private helpers ---

    private Project getProject(String projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Progetto non trovato: " + projectId));
    }

    @Transactional
    private ImportExportJob initJob(String userId, String projectId, ImportExportJob.JobType type) {
        ImportExportJob job = new ImportExportJob();
        job.setUserId(userId);
        job.setProjectId(projectId);
        job.setJobType(type);
        job.setStatus(ImportExportJob.JobStatus.PROCESSING);
        return jobRepository.save(job);
    }

    @Transactional
    private ImportExportJob completeJob(ImportExportJob job, String payload, int count) {
        job.setStatus(ImportExportJob.JobStatus.COMPLETED);
        job.setResultPayload(payload);
        job.setRecordCount(count);
        job.setCompletedAt(Instant.now());
        return jobRepository.save(job);
    }

    @Transactional
    private ImportExportJob failJob(ImportExportJob job, String error) {
        job.setStatus(ImportExportJob.JobStatus.FAILED);
        job.setErrorMessage(error);
        job.setCompletedAt(Instant.now());
        return jobRepository.save(job);
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
