package com.lorenzodm.librepm.core.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * Represents a structured note within the system.
 * <p>
 * Notes are used for logging updates, comments, or structured information.
 * They support Markdown for rich text formatting and can be linked to multiple
 * domain entities (like Tasks, Projects, etc.) via the {@link NoteLink} entity,
 * making them a core part of the contextual knowledge layer.
 * </p>
 *
 * @author Lorenzo DM
 * @since 0.5.0
 * @version 1.0.0
 */
@Entity
@Table(name = "notes", indexes = {
        @Index(name = "idx_note_owner", columnList = "owner_id"),
        @Index(name = "idx_note_project_updated", columnList = "project_id, updated_at"),
        @Index(name = "idx_note_parent", columnList = "parent_type, parent_id")
})
@SQLDelete(sql = "UPDATE notes SET deleted_at = CURRENT_TIMESTAMP, version = version + 1 WHERE id = ? AND version = ?",
        verify = org.hibernate.jdbc.Expectation.RowCount.class)
@Where(clause = "deleted_at IS NULL")
public class Note extends BaseSyncEntity {

    /**
     * Defines the type of entity this note is directly attached to.
     * This is the primary (single-parent) context for a note.
     * For polymorphic links to multiple entities, use {@link NoteLink}.
     */
    public enum ParentType {
        TASK,
        PROJECT
    }

    public enum NoteType {
        MEMO, RATIONALE, MEETING_NOTE, RISK_NOTE, GRANT_NOTE,
        SPONSOR_NOTE, AUDIT_NOTE, DECISION, BRIEF
    }

    public enum Visibility {
        ALL, PROJECT_MEMBERS, ROLE_RESTRICTED
    }

    @Column(length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content; // Markdown content

    @Enumerated(EnumType.STRING)
    @Column(name = "parent_type", length = 20)
    private ParentType parentType;

    @Column(name = "parent_id", length = 36)
    private String parentId;

    @Column(name = "project_id", length = 36)
    private String projectId; // Denormalized for feed queries

    @Enumerated(EnumType.STRING)
    @Column(name = "note_type", length = 32)
    private NoteType noteType = NoteType.MEMO;

    @Column(name = "is_evidence")
    private boolean evidence = false;

    @Column(name = "is_frozen")
    private boolean frozen = false;

    @Column(name = "frozen_at")
    private Instant frozenAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", length = 32)
    private Visibility visibility = Visibility.ALL;

    @Column(name = "restricted_roles", columnDefinition = "TEXT")
    private String restrictedRoles; // JSON array of role IDs

    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
            name = "note_tags",
            joinColumns = @JoinColumn(name = "note_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();

    @OneToMany(mappedBy = "note", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Set<NoteLink> links = new HashSet<>();

    public Note() {
        super();
    }

    // Getters & Setters

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public ParentType getParentType() {
        return parentType;
    }

    public void setParentType(ParentType parentType) {
        this.parentType = parentType;
    }

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public Set<Tag> getTags() {
        return tags;
    }

    public void setTags(Set<Tag> tags) {
        this.tags = tags;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public Set<NoteLink> getLinks() {
        return links;
    }

    public void setLinks(Set<NoteLink> links) {
        this.links = links;
    }

    public NoteType getNoteType() {
        return noteType;
    }

    public void setNoteType(NoteType noteType) {
        this.noteType = noteType;
    }

    public boolean isEvidence() {
        return evidence;
    }

    public void setEvidence(boolean evidence) {
        this.evidence = evidence;
    }

    public boolean isFrozen() {
        return frozen;
    }

    public void setFrozen(boolean frozen) {
        this.frozen = frozen;
    }

    public Instant getFrozenAt() {
        return frozenAt;
    }

    public void setFrozenAt(Instant frozenAt) {
        this.frozenAt = frozenAt;
    }

    public Visibility getVisibility() {
        return visibility;
    }

    public void setVisibility(Visibility visibility) {
        this.visibility = visibility;
    }

    public String getRestrictedRoles() {
        return restrictedRoles;
    }

    public void setRestrictedRoles(String restrictedRoles) {
        this.restrictedRoles = restrictedRoles;
    }

    // Helper methods
    
    /**
     * Adds a link to another entity and maintains the bidirectional relationship.
     * @param link The NoteLink to add.
     */
    public void addLink(NoteLink link) {
        links.add(link);
        link.setNote(this);
    }

    /**
     * Removes a link to another entity.
     * @param link The NoteLink to remove.
     */
    public void removeLink(NoteLink link) {
        links.remove(link);
        link.setNote(null);
    }
}
