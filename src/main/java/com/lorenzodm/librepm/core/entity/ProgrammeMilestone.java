package com.lorenzodm.librepm.core.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "programme_milestones")
public class ProgrammeMilestone {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "programme_id")
    private String programmeId;

    @Column(name = "name", nullable = false)
    private String name;

    // Keep the same textual representation on SQLite, MySQL and PostgreSQL.
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "status")
    private String status = "PENDING";

    @Column(name = "linked_project_id")
    private String linkedProjectId;

    public ProgrammeMilestone() {
        this.id = UUID.randomUUID().toString();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getProgrammeId() {
        return programmeId;
    }

    public void setProgrammeId(String programmeId) {
        this.programmeId = programmeId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDate getTargetDate() {
        return targetDate;
    }

    public void setTargetDate(LocalDate targetDate) {
        this.targetDate = targetDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getLinkedProjectId() {
        return linkedProjectId;
    }

    public void setLinkedProjectId(String linkedProjectId) {
        this.linkedProjectId = linkedProjectId;
    }
}
