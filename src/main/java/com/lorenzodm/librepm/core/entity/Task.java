package com.lorenzodm.librepm.core.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Represents a unit of work or activity within the system.
 * <p>
 * A Task is the core entity of LibrePM. It belongs to a {@link Project} and can be
 * assigned to a {@link User}. It supports various features like time tracking,
 * checklists, dependencies, and tagging.
 * </p>
 *
 * @author Lorenzo DM
 * @since 1.0.0
 * @version 0.6.1
 */
@Entity
@Table(name = "tasks", indexes = {
        @Index(name = "idx_task_project", columnList = "project_id"),
        @Index(name = "idx_task_assigned", columnList = "assigned_to_id"),
        @Index(name = "idx_task_status", columnList = "status_id"),
        @Index(name = "idx_task_priority", columnList = "priority_id"),
        @Index(name = "idx_task_deadline", columnList = "deadline"),
        @Index(name = "idx_task_created", columnList = "created_at"),
        @Index(name = "idx_task_parent", columnList = "parent_task_id")
})
@SQLDelete(sql = "UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP, version = version + 1 WHERE id = ? AND version = ?",
        verify = org.hibernate.jdbc.Expectation.RowCount.class)
@Where(clause = "deleted_at IS NULL")
public class Task extends BaseSyncEntity {

    /**
     * Defines the nature of the task.
     * Used for UI rendering and specific behavior (e.g., calendar rendering).
     */
    public enum Type {
        TASK,
        MEETING,
        CALL,
        APPOINTMENT,
        DEADLINE,
        REMINDER,
        TASK_BLOCK,
        SUMMARY_TASK,
        MILESTONE,
        DELIVERABLE_TASK,  // PRD-01-FR-003: task linked to a contractual deliverable
        REVIEW_TASK,       // PRD-01-FR-003: review/approval task
        FINANCE_TASK       // PRD-01-FR-003: task with financial impact
    }

    /**
     * Unit of measurement for time estimation and tracking.
     */
    public enum DurationUnit {
        MINUTES,
        HOURS,
        DAYS,
        WEEKS,
        MONTHS
    }

    /* Core task information */

    @NotBlank(message = "Titolo task obbligatorio")
    @Size(min = 1, max = 500, message = "Titolo deve essere tra 1 e 500 caratteri")
    @Column(nullable = false, length = 500)
    private String title;

    @Column(length = 5000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Type type = Type.TASK;

    /* Workflow status and priority */

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "status_id")
    private TaskStatus status;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "priority_id")
    private TaskPriority priority;

    /* Scheduling and Deadlines */

    @Column
    private LocalDate deadline;

    @Column
    private LocalDateTime plannedStart; 

    @Column
    private LocalDateTime plannedFinish;

    /* Actual dates (PRD-01-FR-006) */
    @Column
    private LocalDate actualStart;

    @Column
    private LocalDate actualEnd;

    /* Extended planning fields (PRD-01-FR-004/006) */

    /** Phase/WBS node linkage */
    @Column(name = "phase_id", length = 36)
    private String phaseId;

    /** Deliverable linkage (FK added when deliverables table is created) */
    @Column(name = "deliverable_id", length = 36)
    private String deliverableId;

    /** Stakeholder linkage */
    @Column(name = "stakeholder_id", length = 36)
    private String stakeholderId;

    /** Free-text funding context (structured in PRD-18) */
    @Column(columnDefinition = "TEXT")
    private String fundingContext;

    /** Progressive disclosure: show planning fields */
    @Column(nullable = false)
    private boolean planningEnabled = false;

    /** Progressive disclosure: show finance fields */
    @Column(nullable = false)
    private boolean financeEnabled = false;

    /* Planning constraints and critical path (Phase 8.2) */

    @Column(name = "constraint_type", length = 32)
    private String constraintType;

    @Column(name = "constraint_date")
    private LocalDate constraintDate;

    @Column(name = "early_start")
    private LocalDate earlyStart;

    @Column(name = "early_finish")
    private LocalDate earlyFinish;

    @Column(name = "late_start")
    private LocalDate lateStart;

    @Column(name = "late_finish")
    private LocalDate lateFinish;

    @Column(name = "total_float")
    private Integer totalFloat;

    @Column(name = "is_critical")
    private boolean critical = false;

    /** Effort tracking in hours (separate from legacy minutes) */
    @Column
    private Double estimatedEffortHours;

    @Column
    private Double actualEffortHours;

    /* Legacy fields (to be refactored) */
    @Column(length = 200)
    private String owner; // Legacy string owner (deprecated)

    /* Content and Notes */

    @Column(length = 2000)
    private String notes;

    @Column(columnDefinition = "TEXT")
    private String markdownNotes;

    /* Reminders */

    @Column
    private LocalDateTime reminderDate;

    @Column(nullable = false)
    private boolean reminderEnabled = false;

    @Column(nullable = false)
    private boolean notificationSent = false;

    /* Time Tracking */

    @Column
    private Integer estimatedEffort; // In minutes

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private DurationUnit durationUnit = DurationUnit.MINUTES; // Default

    @Column(nullable = false)
    private Integer actualEffort = 0; // In minutes

    /* Attachments (Simple storage) */

    @Column(length = 500)
    private String assetPath;

    @Column(length = 100)
    private String assetFileName;

    @Column(length = 50)
    private String assetMimeType;

    @Column
    private Long assetSizeBytes;

    /* Organization */

    @Column(nullable = false)
    private boolean archived = false;

    /** PRD-01-FR-004: true if this is an inbox task (no real project assignment) */
    @Column(nullable = false)
    private boolean inbox = false;

    @Column(nullable = false)
    private int sortOrder = 0;

    /* Concurrency Control */
    @Version
    private Long version;

    /* Relationships */

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_id")
    private User assignedTo;

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<FocusSession> focusSessions = new HashSet<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Asset> assets = new HashSet<>();

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
            name = "task_tags",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("sortOrder ASC")
    private List<TaskChecklistItem> checklistItems = new ArrayList<>();

    /* Parent-Child Hierarchy (SUMMARY_TASK support - PRD-08) */

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_task_id")
    private Task parentTask;

    @OneToMany(mappedBy = "parentTask", fetch = FetchType.LAZY)
    @OrderBy("sortOrder ASC")
    private List<Task> childTasks = new ArrayList<>();

    /* Dependencies (Self-referencing ManyToMany) */

    @ManyToMany
    @JoinTable(
            name = "task_dependencies",
            joinColumns = @JoinColumn(name = "blocked_task_id"),
            inverseJoinColumns = @JoinColumn(name = "blocker_task_id")
    )
    private Set<Task> blockers = new HashSet<>();

    @ManyToMany(mappedBy = "blockers")
    private Set<Task> blockedTasks = new HashSet<>();

    /**
     * Default constructor.
     * Initializes the ID via superclass.
     */
    public Task() {
        super();
    }

    /**
     * Convenience constructor for creating a new task.
     *
     * @param title   The title of the task.
     * @param project The project this task belongs to.
     */
    public Task(String title, Project project) {
        this();
        this.title = title;
        this.project = project;
    }

    // Getters & Setters

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }
    
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    
    public TaskPriority getPriority() { return priority; }
    public void setPriority(TaskPriority priority) { this.priority = priority; }
    
    public LocalDate getDeadline() { return deadline; }
    public void setDeadline(LocalDate deadline) { this.deadline = deadline; }
    
    public LocalDateTime getPlannedStart() { return plannedStart; }
    public void setPlannedStart(LocalDateTime plannedStart) { this.plannedStart = plannedStart; }
    
    public LocalDateTime getPlannedFinish() { return plannedFinish; }
    public void setPlannedFinish(LocalDateTime plannedFinish) { this.plannedFinish = plannedFinish; }

    public LocalDate getActualStart() { return actualStart; }
    public void setActualStart(LocalDate actualStart) { this.actualStart = actualStart; }
    public LocalDate getActualEnd() { return actualEnd; }
    public void setActualEnd(LocalDate actualEnd) { this.actualEnd = actualEnd; }

    public String getPhaseId() { return phaseId; }
    public void setPhaseId(String phaseId) { this.phaseId = phaseId; }
    public String getDeliverableId() { return deliverableId; }
    public void setDeliverableId(String deliverableId) { this.deliverableId = deliverableId; }
    public String getStakeholderId() { return stakeholderId; }
    public void setStakeholderId(String stakeholderId) { this.stakeholderId = stakeholderId; }
    public String getFundingContext() { return fundingContext; }
    public void setFundingContext(String fundingContext) { this.fundingContext = fundingContext; }
    public boolean isPlanningEnabled() { return planningEnabled; }
    public void setPlanningEnabled(boolean planningEnabled) { this.planningEnabled = planningEnabled; }
    public boolean isFinanceEnabled() { return financeEnabled; }
    public void setFinanceEnabled(boolean financeEnabled) { this.financeEnabled = financeEnabled; }
    public Double getEstimatedEffortHours() { return estimatedEffortHours; }
    public void setEstimatedEffortHours(Double estimatedEffortHours) { this.estimatedEffortHours = estimatedEffortHours; }
    public Double getActualEffortHours() { return actualEffortHours; }
    public void setActualEffortHours(Double actualEffortHours) { this.actualEffortHours = actualEffortHours; }

    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getMarkdownNotes() { return markdownNotes; }
    public void setMarkdownNotes(String markdownNotes) { this.markdownNotes = markdownNotes; }
    public LocalDateTime getReminderDate() { return reminderDate; }
    public void setReminderDate(LocalDateTime reminderDate) { this.reminderDate = reminderDate; }
    public boolean isReminderEnabled() { return reminderEnabled; }
    public void setReminderEnabled(boolean reminderEnabled) { this.reminderEnabled = reminderEnabled; }
    public boolean isNotificationSent() { return notificationSent; }
    public void setNotificationSent(boolean notificationSent) { this.notificationSent = notificationSent; }
    
    public Integer getEstimatedEffort() { return estimatedEffort; }
    public void setEstimatedEffort(Integer estimatedEffort) { this.estimatedEffort = estimatedEffort; }
    
    public DurationUnit getDurationUnit() { return durationUnit; }
    public void setDurationUnit(DurationUnit durationUnit) { this.durationUnit = durationUnit; }
    
    public Integer getActualEffort() { return actualEffort; }
    public void setActualEffort(Integer actualEffort) { this.actualEffort = actualEffort; }
    
    public String getAssetPath() { return assetPath; }
    public void setAssetPath(String assetPath) { this.assetPath = assetPath; }
    public String getAssetFileName() { return assetFileName; }
    public void setAssetFileName(String assetFileName) { this.assetFileName = assetFileName; }
    public String getAssetMimeType() { return assetMimeType; }
    public void setAssetMimeType(String assetMimeType) { this.assetMimeType = assetMimeType; }
    public Long getAssetSizeBytes() { return assetSizeBytes; }
    public void setAssetSizeBytes(Long assetSizeBytes) { this.assetSizeBytes = assetSizeBytes; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
    public boolean isInbox() { return inbox; }
    public void setInbox(boolean inbox) { this.inbox = inbox; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public String getConstraintType() { return constraintType; }
    public void setConstraintType(String constraintType) { this.constraintType = constraintType; }
    public LocalDate getConstraintDate() { return constraintDate; }
    public void setConstraintDate(LocalDate constraintDate) { this.constraintDate = constraintDate; }
    public LocalDate getEarlyStart() { return earlyStart; }
    public void setEarlyStart(LocalDate earlyStart) { this.earlyStart = earlyStart; }
    public LocalDate getEarlyFinish() { return earlyFinish; }
    public void setEarlyFinish(LocalDate earlyFinish) { this.earlyFinish = earlyFinish; }
    public LocalDate getLateStart() { return lateStart; }
    public void setLateStart(LocalDate lateStart) { this.lateStart = lateStart; }
    public LocalDate getLateFinish() { return lateFinish; }
    public void setLateFinish(LocalDate lateFinish) { this.lateFinish = lateFinish; }
    public Integer getTotalFloat() { return totalFloat; }
    public void setTotalFloat(Integer totalFloat) { this.totalFloat = totalFloat; }
    public boolean isCritical() { return critical; }
    public void setCritical(boolean critical) { this.critical = critical; }

    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public User getAssignedTo() { return assignedTo; }
    public void setAssignedTo(User assignedTo) { this.assignedTo = assignedTo; }
    public Set<FocusSession> getFocusSessions() { return focusSessions; }
    public void setFocusSessions(Set<FocusSession> focusSessions) { this.focusSessions = focusSessions; }
    public Set<Asset> getAssets() { return assets; }
    public void setAssets(Set<Asset> assets) { this.assets = assets; }
    public Set<Tag> getTags() { return tags; }
    public void setTags(Set<Tag> tags) { this.tags = tags; }
    public List<TaskChecklistItem> getChecklistItems() { return checklistItems; }
    public void setChecklistItems(List<TaskChecklistItem> checklistItems) { this.checklistItems = checklistItems; }
    public Task getParentTask() { return parentTask; }
    public void setParentTask(Task parentTask) { this.parentTask = parentTask; }
    public List<Task> getChildTasks() { return childTasks; }
    public void setChildTasks(List<Task> childTasks) { this.childTasks = childTasks; }
    public Set<Task> getBlockers() { return blockers; }
    public void setBlockers(Set<Task> blockers) { this.blockers = blockers; }
    public Set<Task> getBlockedTasks() { return blockedTasks; }
    public void setBlockedTasks(Set<Task> blockedTasks) { this.blockedTasks = blockedTasks; }

    // Helper methods

    /**
     * Adds an item to the checklist and maintains the bidirectional relationship.
     * @param item The checklist item to add.
     */
    public void addChecklistItem(TaskChecklistItem item) {
        checklistItems.add(item);
        item.setTask(this);
    }

    /**
     * Removes an item from the checklist.
     * @param item The checklist item to remove.
     */
    public void removeChecklistItem(TaskChecklistItem item) {
        checklistItems.remove(item);
        item.setTask(null);
    }

    /**
     * Adds a dependency where the given task blocks this task.
     * @param blocker The task that must be completed before this one.
     */
    public void addBlocker(Task blocker) {
        this.blockers.add(blocker);
        blocker.getBlockedTasks().add(this);
    }

    /**
     * Removes a dependency.
     * @param blocker The task that no longer blocks this one.
     */
    public void removeBlocker(Task blocker) {
        this.blockers.remove(blocker);
        blocker.getBlockedTasks().remove(this);
    }

    /**
     * Checks if the task is currently blocked by any incomplete dependencies.
     * @return true if there are active blockers, false otherwise.
     */
    public boolean isBlocked() {
        if (blockers.isEmpty()) return false;
        
        // Updated to use semantic category on TaskStatus
        return blockers.stream().anyMatch(t -> {
            if (t.getStatus() == null) return true; // No status is considered not done
            return !t.getStatus().isCompleted();
        });
    }

    /**
     * Calculates the total time spent on this task across all focus sessions.
     * @return Total duration in milliseconds.
     */
    public long getTotalFocusTimeMs() {
        return focusSessions.stream().mapToLong(FocusSession::getDurationMs).sum();
    }

    /**
     * Checks if the task is overdue based on its deadline.
     * @return true if the deadline has passed and the task is not done.
     */
    public boolean isOverdue() {
        if (deadline == null) return false;
        if (status != null && status.isCompleted()) return false;
        return LocalDate.now().isAfter(deadline);
    }

    public void addTag(Tag tag) {
        this.tags.add(tag);
        tag.getTasks().add(this);
    }

    public void removeTag(Tag tag) {
        this.tags.remove(tag);
        tag.getTasks().remove(this);
    }
}
