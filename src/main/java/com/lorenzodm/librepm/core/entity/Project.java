package com.lorenzodm.librepm.core.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.util.HashSet;
import java.util.Set;

/**
 * Represents a container for tasks and related resources.
 * <p>
 * A Project is the main organizational unit in LibrePM. It belongs to a specific {@link User} (owner)
 * but can be shared with a {@link Team}. It aggregates tasks, tracks overall progress,
 * and provides context for work.
 * </p>
 *
 * @author Lorenzo DM
 * @since 1.0.0
 * @version 0.5.2
 */
@Entity
@Table(name = "projects", indexes = {
        @Index(name = "idx_project_owner", columnList = "owner_id"),
        @Index(name = "idx_project_team", columnList = "team_id"),
        @Index(name = "idx_project_archived", columnList = "archived"),
        @Index(name = "idx_project_created", columnList = "created_at")
})
@SQLDelete(sql = "UPDATE projects SET deleted_at = CURRENT_TIMESTAMP, version = version + 1 WHERE id = ? AND version = ?",
        verify = org.hibernate.jdbc.Expectation.RowCount.class)
@Where(clause = "deleted_at IS NULL")
public class Project extends BaseSyncEntity {

    /**
     * Defines who can see and access the project.
     */
    public enum Visibility {
        PERSONAL,
        TEAM,
        SHARED
    }

    /**
     * Represents the overall health status of the project based on overdue tasks.
     */
    public enum Health {
        OK,
        WARNING,
        CRITICAL
    }

    /* Core Project Information */

    @NotBlank(message = "Nome progetto obbligatorio")
    @Size(min = 1, max = 200, message = "Nome deve essere tra 1 e 200 caratteri")
    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 2000)
    private String description;

    /* Visual Customization */

    @Column(length = 7)
    private String color; // Hex color: #RRGGBB

    @Column(length = 50)
    private String icon; // Icon name or emoji

    /* Configuration & Status */

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Visibility visibility = Visibility.PERSONAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "health_status", nullable = false, length = 20)
    private Health health = Health.OK;

    @Column(nullable = false)
    private int overdueWarningThreshold = 3; // Default 3 days

    @Column(nullable = false)
    private int overdueCount = 0;

    @Column(nullable = false)
    private boolean archived = false;

    @Column(nullable = false)
    private boolean favorite = false;

    /* Module Toggles (PRD-03-FR-005) */

    @Column(name = "time_tracking_enabled", nullable = false)
    private boolean timeTrackingEnabled = true;

    @Column(name = "planning_enabled", nullable = false)
    private boolean planningEnabled = false;

    @Column(name = "finance_enabled", nullable = false)
    private boolean financeEnabled = false;

    @Column(name = "grants_enabled", nullable = false)
    private boolean grantsEnabled = false;

    /* Concurrency Control */
    @Version
    private Long version;

    /* Relationships */

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    private Team team;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Task> tasks = new HashSet<>();

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<ProjectMember> members = new HashSet<>();

    /**
     * Default constructor.
     * Sets default color and initializes ID via superclass.
     */
    public Project() {
        super();
        this.color = "#3cb6ff"; // Default LibrePM blue
    }

    /**
     * Convenience constructor for creating a new project.
     *
     * @param name  The name of the project.
     * @param owner The user who owns the project.
     */
    public Project(String name, User owner) {
        this();
        this.name = name;
        this.owner = owner;
    }

    // Getters & Setters

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public Visibility getVisibility() { return visibility; }
    public void setVisibility(Visibility visibility) { this.visibility = visibility; }
    public Health getHealth() { return health; }
    public void setHealth(Health health) { this.health = health; }
    public int getOverdueWarningThreshold() { return overdueWarningThreshold; }
    public void setOverdueWarningThreshold(int overdueWarningThreshold) { this.overdueWarningThreshold = overdueWarningThreshold; }
    public int getOverdueCount() { return overdueCount; }
    public void setOverdueCount(int overdueCount) { this.overdueCount = overdueCount; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
    public boolean isFavorite() { return favorite; }
    public void setFavorite(boolean favorite) { this.favorite = favorite; }
    public boolean isTimeTrackingEnabled() { return timeTrackingEnabled; }
    public void setTimeTrackingEnabled(boolean timeTrackingEnabled) { this.timeTrackingEnabled = timeTrackingEnabled; }
    public boolean isPlanningEnabled() { return planningEnabled; }
    public void setPlanningEnabled(boolean planningEnabled) { this.planningEnabled = planningEnabled; }
    public boolean isFinanceEnabled() { return financeEnabled; }
    public void setFinanceEnabled(boolean financeEnabled) { this.financeEnabled = financeEnabled; }
    public boolean isGrantsEnabled() { return grantsEnabled; }
    public void setGrantsEnabled(boolean grantsEnabled) { this.grantsEnabled = grantsEnabled; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
    
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
    public Team getTeam() { return team; }
    public void setTeam(Team team) { this.team = team; }
    public Set<Task> getTasks() { return tasks; }
    public void setTasks(Set<Task> tasks) { this.tasks = tasks; }
    public Set<ProjectMember> getMembers() { return members; }
    public void setMembers(Set<ProjectMember> members) { this.members = members; }

    // Helper methods

    /**
     * Adds a task to the project and maintains the bidirectional relationship.
     * @param task The task to add.
     */
    public void addTask(Task task) {
        tasks.add(task);
        task.setProject(this);
    }

    /**
     * Removes a task from the project.
     * @param task The task to remove.
     */
    public void removeTask(Task task) {
        tasks.remove(task);
        task.setProject(null);
    }

    /**
     * Adds a member to the project team.
     * @param member The member to add.
     */
    public void addMember(ProjectMember member) {
        members.add(member);
        member.setProject(this);
    }

    /**
     * Removes a member from the project team.
     * @param member The member to remove.
     */
    public void removeMember(ProjectMember member) {
        members.remove(member);
        member.setProject(null);
    }

    /**
     * Counts the number of tasks in this project with a specific status.
     *
     * @param status The status to filter by (e.g., "DONE", "TODO").
     * @return The count of tasks.
     */
    public long countTasksByStatus(String status) {
        return tasks.stream()
                .filter(t -> status.equals(t.getStatus()))
                .count();
    }

    /**
     * Calculates the completion percentage of the project based on tasks marked as "DONE".
     *
     * @return A percentage value between 0.0 and 100.0.
     */
    public double getCompletionPercentage() {
        if (tasks.isEmpty()) return 0.0;

        long completed = countTasksByStatus("DONE");
        return (completed * 100.0) / tasks.size();
    }

    @Override
    public String toString() {
        return "Project{" +
                "id='" + getId() + '\'' +
                ", name='" + name + '\'' +
                ", archived=" + archived +
                ", tasksCount=" + tasks.size() +
                '}';
    }
}
