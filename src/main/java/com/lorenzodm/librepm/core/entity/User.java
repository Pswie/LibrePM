package com.lorenzodm.librepm.core.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * Represents a user of the LibrePM application.
 * <p>
 * A User can be a local profile (created during onboarding) or a cloud-synced account.
 * It serves as the root owner for {@link Project}s and other resources.
 * Supports "Ghost Users" for team members who don't have a full account yet.
 * </p>
 *
 * @author Lorenzo DM
 * @since 1.0.0
 * @version 0.5.2
 */
@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_username", columnList = "username", unique = true),
        @Index(name = "idx_email", columnList = "email", unique = true)
})
@SQLDelete(sql = "UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@Where(clause = "deleted_at IS NULL")
public class User extends BaseSyncEntity {

    /* Identity & Authentication */

    @NotBlank(message = "Username obbligatorio")
    @Size(min = 3, max = 50, message = "Username deve essere tra 3 e 50 caratteri")
    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Email(message = "Email non valida")
    @Column(unique = true, length = 100)
    private String email;

    @Column(nullable = false, length = 255)
    private String passwordHash;

    /**
     * Identità Clerk corrispondente, cioè il claim {@code sub} del suo JWT.
     * <p>
     * Valorizzata solo nel profilo {@code cloud}: è il ponte fra la persona che
     * Clerk autentica e la riga che possiede i progetti. Sul desktop resta nulla,
     * perché non c'è nessun identity provider da cui farsi riconoscere.
     * </p>
     */
    @Column(name = "clerk_user_id", length = 255, unique = true)
    private String clerkUserId;

    /* Profile Information */

    @Column(length = 100)
    private String displayName;

    @Column(length = 255)
    private String avatarPath;

    @Column(name = "workspace_profile_id", length = 36)
    private String workspaceProfileId = "wp-personal";

    /* Status & Flags */

    @Column(nullable = false)
    private boolean active = true;

    /**
     * If true, this user is a placeholder created by another user (e.g., for team assignment)
     * and does not have login credentials.
     */
    @Column(nullable = false)
    private boolean isGhost = false;

    /* Audit */

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @Column
    private Instant lastLoginAt;

    /* Relationships */

    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Project> projects = new HashSet<>();

    @OneToMany(mappedBy = "assignedTo", cascade = CascadeType.ALL)
    private Set<Task> tasks = new HashSet<>();

    /**
     * Default constructor.
     * Initializes ID via superclass.
     */
    public User() {
        super();
    }

    /**
     * Constructor for creating a standard user.
     *
     * @param username     Unique username.
     * @param email        Optional email address.
     * @param passwordHash Hashed password.
     */
    public User(String username, String email, String passwordHash) {
        this();
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
    }

    /**
     * Constructor for creating a Ghost user or simple profile.
     *
     * @param username    Unique username.
     * @param displayName Display name.
     */
    public User(String username, String displayName) {
        this();
        this.username = username;
        this.displayName = displayName;
        this.passwordHash = "";
    }

    // Getters & Setters

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getClerkUserId() { return clerkUserId; }
    public void setClerkUserId(String clerkUserId) { this.clerkUserId = clerkUserId; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getAvatarPath() { return avatarPath; }
    public void setAvatarPath(String avatarPath) { this.avatarPath = avatarPath; }
    public String getWorkspaceProfileId() { return workspaceProfileId; }
    public void setWorkspaceProfileId(String workspaceProfileId) { this.workspaceProfileId = workspaceProfileId; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isGhost() { return isGhost; }
    public void setGhost(boolean ghost) { isGhost = ghost; }
    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }
    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(Instant lastLoginAt) { this.lastLoginAt = lastLoginAt; }
    
    public Set<Project> getProjects() { return projects; }
    public void setProjects(Set<Project> projects) { this.projects = projects; }
    public Set<Task> getTasks() { return tasks; }
    public void setTasks(Set<Task> tasks) { this.tasks = tasks; }

    // Helper methods

    /**
     * Adds a project to the user's portfolio.
     * @param project The project to add.
     */
    public void addProject(Project project) {
        projects.add(project);
        project.setOwner(this);
    }

    /**
     * Removes a project from the user's portfolio.
     * @param project The project to remove.
     */
    public void removeProject(Project project) {
        projects.remove(project);
        project.setOwner(null);
    }

    /**
     * Updates the last login timestamp to the current time.
     */
    public void updateLastLogin() {
        this.lastLoginAt = Instant.now();
    }
}
