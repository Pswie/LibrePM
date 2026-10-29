package com.lorenzodm.librepm.repository;

import com.lorenzodm.librepm.core.entity.Note;
import com.lorenzodm.librepm.core.entity.NoteLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteRepository extends JpaRepository<Note, String> {
    
    // Standard Parent/Child retrieval
    List<Note> findByOwnerIdAndParentTypeAndParentIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerId, Note.ParentType parentType, String parentId);
    
    // Direct ownership retrieval
    List<Note> findByOwnerIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerId);
    
    // Simple text search
    @Query("SELECT n FROM Note n WHERE n.owner.id = :ownerId AND n.deletedAt IS NULL AND " +
           "(LOWER(n.title) LIKE LOWER(CONCAT('%', :title, '%')) OR " +
           "LOWER(n.content) LIKE LOWER(CONCAT('%', :content, '%'))) ORDER BY n.updatedAt DESC")
    List<Note> findByOwnerIdAndDeletedAtIsNullAndTitleContainingIgnoreCaseOrContentContainingIgnoreCase(
            @Param("ownerId") String ownerId, @Param("title") String title, @Param("content") String content);
    
    // Contextual retrieval (Task/Project specific via direct parent)
    List<Note> findByParentTypeAndParentIdAndDeletedAtIsNullOrderByCreatedAtAsc(Note.ParentType parentType, String parentId);

    // Feed queries (Project scope)
    List<Note> findByProjectIdInAndDeletedAtIsNullOrderByUpdatedAtDesc(List<String> projectIds);
    List<Note> findByProjectIdInAndOwnerIdNotAndDeletedAtIsNullOrderByUpdatedAtDesc(List<String> projectIds, String ownerId);

    // --- PRD-02-FR-003: Typed notes queries ---
    List<Note> findByOwnerIdAndNoteTypeAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerId, Note.NoteType noteType);
    List<Note> findByProjectIdInAndNoteTypeAndDeletedAtIsNullOrderByUpdatedAtDesc(List<String> projectIds, Note.NoteType noteType);

    @Query("SELECT n FROM Note n WHERE n.owner.id = :ownerId AND n.evidence = true AND n.deletedAt IS NULL ORDER BY n.updatedAt DESC")
    List<Note> findEvidenceNotes(@Param("ownerId") String ownerId);

    // --- PRD-02: Contextual Knowledge Retrieval via Polymorphic Links ---

    /**
     * Finds notes linked to a specific entity via NoteLink.
     * This allows retrieving notes that are "related" to an entity even if they are not directly parented by it.
     */
    @Query("SELECT DISTINCT n FROM Note n JOIN n.links l WHERE l.linkedEntityType = :type AND l.linkedEntityId = :entityId AND n.deletedAt IS NULL ORDER BY n.updatedAt DESC")
    List<Note> findByLinkedEntity(@Param("type") NoteLink.LinkedEntityType type, @Param("entityId") String entityId);

    /**
     * Finds notes that match a search term either in title, content, or tags.
     */
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN n.tags t WHERE " +
           "n.owner.id = :ownerId AND n.deletedAt IS NULL AND " +
           "(LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(t.name) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Note> searchFullText(@Param("ownerId") String ownerId, @Param("query") String query);
}
