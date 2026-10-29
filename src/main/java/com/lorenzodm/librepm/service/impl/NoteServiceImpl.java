package com.lorenzodm.librepm.service.impl;

import com.lorenzodm.librepm.api.dto.request.CreateNoteRequest;
import com.lorenzodm.librepm.api.dto.request.UpdateNoteRequest;
import com.lorenzodm.librepm.api.exception.ForbiddenException;
import com.lorenzodm.librepm.api.exception.OwnershipViolationException;
import com.lorenzodm.librepm.api.exception.ResourceNotFoundException;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.core.entity.NoteLink;
import com.lorenzodm.librepm.core.entity.NoteRevision;
import com.lorenzodm.librepm.repository.*;
import com.lorenzodm.librepm.service.NoteService;
import com.lorenzodm.librepm.service.NoteAccessPolicy;
import com.lorenzodm.librepm.service.NotificationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
public class NoteServiceImpl implements NoteService {

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;
    private final TagRepository tagRepository;
    private final TaskRepository taskRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final NotificationService notificationService;
    private final NoteRevisionRepository noteRevisionRepository;
    private final NoteAccessPolicy noteAccess;

    public NoteServiceImpl(NoteRepository noteRepository, UserRepository userRepository, TagRepository tagRepository,
                           TaskRepository taskRepository, ProjectMemberRepository projectMemberRepository,
                           NotificationService notificationService, NoteRevisionRepository noteRevisionRepository,
                           NoteAccessPolicy noteAccess) {
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
        this.tagRepository = tagRepository;
        this.taskRepository = taskRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.notificationService = notificationService;
        this.noteRevisionRepository = noteRevisionRepository;
        this.noteAccess = noteAccess;
    }

    // =================================================================================
    // METODI CONTESTUALI (TASK / PROJECT)
    // =================================================================================

    @Override
    public Note createForTask(String userId, String taskId, CreateNoteRequest request) {
        return createInternal(userId, Note.ParentType.TASK, taskId, request);
    }

    @Override
    public Note createForProject(String userId, String projectId, CreateNoteRequest request) {
        return createInternal(userId, Note.ParentType.PROJECT, projectId, request);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Note> listForTask(String userId, String taskId) {
        verifyContextAccess(userId, Note.ParentType.TASK, taskId);
        return noteAccess.visibleTo(userId, noteRepository.findByParentTypeAndParentIdAndDeletedAtIsNullOrderByCreatedAtAsc(Note.ParentType.TASK, taskId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Note> listForProject(String userId, String projectId) {
        verifyContextAccess(userId, Note.ParentType.PROJECT, projectId);
        return noteAccess.visibleTo(userId, noteRepository.findByParentTypeAndParentIdAndDeletedAtIsNullOrderByCreatedAtAsc(Note.ParentType.PROJECT, projectId));
    }

    // =================================================================================
    // METODI CRUD SU SINGOLA NOTA (CON SICUREZZA RAFFORZATA)
    // =================================================================================

    @Override
    @Transactional(readOnly = true)
    public Note get(String userId, String noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Nota non trovata: " + noteId));
        
        if (note.getDeletedAt() != null) {
            throw new ResourceNotFoundException("Nota non trovata (eliminata)");
        }

        // ANTI-IDOR: Verifica accesso al contesto
        verifyContextAccess(userId, note.getParentType(), note.getParentId());
        if (!noteAccess.readerFor(userId).test(note)) {
            throw new ForbiddenException("Non hai accesso a questa nota");
        }

        return note;
    }

    @Override
    @Transactional(readOnly = true)
    public Note requireWrite(String userId, String noteId) {
        Note note = get(userId, noteId);
        verifyContextWrite(userId, note.getParentType(), note.getParentId());
        if (note.getOwner() == null || !userId.equals(note.getOwner().getId())) {
            throw new OwnershipViolationException("Non puoi modificare i collegamenti di una nota di un altro utente");
        }
        if (note.isFrozen()) {
            throw new ForbiddenException("Non puoi modificare i collegamenti di una nota congelata");
        }
        return note;
    }

    @Override
    public Note update(String userId, String noteId, UpdateNoteRequest request) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Nota non trovata: " + noteId));

        if (note.getDeletedAt() != null) {
            throw new ResourceNotFoundException("Nota non trovata (eliminata)");
        }

        // ANTI-IDOR: Verifica accesso al contesto (anche se sei owner, devi avere ancora accesso)
        verifyContextWrite(userId, note.getParentType(), note.getParentId());

        // OWNERSHIP: Solo owner può modificare
        if (!note.getOwner().getId().equals(userId)) {
            throw new OwnershipViolationException("Non puoi modificare una nota di un altro utente");
        }

        // REVISION: Save current state before modifying (PRD-02-FR-006)
        boolean contentChanging = (request.title() != null && !request.title().equals(note.getTitle()))
                || (request.content() != null && !request.content().equals(note.getContent()));
        if (contentChanging && !note.isFrozen()) {
            saveRevision(note, userId);
        }

        // FROZEN CHECK: frozen notes cannot be edited (except to unfreeze)
        if (note.isFrozen()) {
            // Only allow unfreezing via the frozen field
            if (request.frozen() != null && !request.frozen()) {
                note.setFrozen(false);
                note.setFrozenAt(null);
                return noteRepository.save(note);
            }
            throw new ForbiddenException("Cannot edit a frozen note. Unfreeze it first.");
        }

        // WHITELIST UPDATE: title, content, and typed note fields
        if (request.title() != null) note.setTitle(request.title());
        if (request.content() != null) note.setContent(request.content());

        // Note type fields (PRD-02-FR-003)
        if (request.noteType() != null) {
            note.setNoteType(Note.NoteType.valueOf(request.noteType()));
        }
        if (request.evidence() != null) {
            note.setEvidence(request.evidence());
        }
        if (request.frozen() != null && request.frozen()) {
            note.setFrozen(true);
            note.setFrozenAt(Instant.now());
        }
        if (request.visibility() != null) {
            note.setVisibility(Note.Visibility.valueOf(request.visibility()));
        }
        if (request.restrictedRoles() != null) {
            note.setRestrictedRoles(request.restrictedRoles());
        }

        if (request.tagIds() != null) {
            Set<Tag> tags = loadTagsForUser(userId, request.tagIds());
            note.setTags(tags);
        }

        return noteRepository.save(note);
    }

    @Override
    public void delete(String userId, String noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new ResourceNotFoundException("Nota non trovata: " + noteId));

        if (note.getDeletedAt() != null) {
            return; // Already deleted
        }

        // ANTI-IDOR: Verifica accesso al contesto
        verifyContextWrite(userId, note.getParentType(), note.getParentId());

        // OWNERSHIP: Solo owner può eliminare
        if (!note.getOwner().getId().equals(userId)) {
            throw new OwnershipViolationException("Non puoi eliminare una nota di un altro utente");
        }
        
        // Soft delete
        note.setDeletedAt(Instant.now());
        noteRepository.save(note);
    }

    // =================================================================================
    // FEED E RICERCA
    // =================================================================================

    @Override
    @Transactional(readOnly = true)
    public List<Note> search(String userId, String query) {
        if (query == null || query.isBlank()) {
            return noteAccess.visibleTo(userId, noteRepository.findByOwnerIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId));
        }
        return noteAccess.visibleTo(userId, noteRepository.searchFullText(userId, query));
    }
    
    @Override
    @Transactional(readOnly = true)
    public List<Note> getFeed(String userId, String scope, String parentType, String parentId) {
        List<String> projectIds = projectMemberRepository.findByUserId(userId).stream()
                .map(pm -> pm.getProject().getId())
                .collect(Collectors.toList());
        
        if (projectIds.isEmpty()) {
            return new ArrayList<>();
        }

        if ((parentType == null) != (parentId == null)) {
            throw new IllegalArgumentException("parentType e parentId devono essere specificati insieme");
        }
        List<Note> notes = noteRepository.findByProjectIdInAndDeletedAtIsNullOrderByUpdatedAtDesc(projectIds);
        if (parentType != null && parentId != null) {
            Note.ParentType type = Note.ParentType.valueOf(parentType.toUpperCase(java.util.Locale.ROOT));
            verifyContextAccess(userId, type, parentId);
            notes = notes.stream().filter(n -> n.getParentType() == type && parentId.equals(n.getParentId())).toList();
        }
        if ("INBOX".equalsIgnoreCase(scope)) {
            notes = notes.stream().filter(n -> !n.getOwner().getId().equals(userId)).toList();
        } else if ("SENT".equalsIgnoreCase(scope)) {
            notes = notes.stream().filter(n -> n.getOwner().getId().equals(userId)).toList();
        }
        return noteAccess.visibleTo(userId, notes);
    }

    // =================================================================================
    // REVISIONS (PRD-02-FR-006)
    // =================================================================================

    @Override
    @Transactional(readOnly = true)
    public List<NoteRevision> getRevisions(String userId, String noteId) {
        // Verify access
        get(userId, noteId);
        return noteRevisionRepository.findByNoteIdOrderByRevisionNumberDesc(noteId);
    }

    // =================================================================================
    // BACKLINKS (PRD-02-FR-005)
    // =================================================================================

    @Override
    @Transactional(readOnly = true)
    public List<Note> getBacklinks(String userId, String entityType, String entityId) {
        NoteLink.LinkedEntityType type = NoteLink.LinkedEntityType.valueOf(entityType.toUpperCase());
        return noteAccess.visibleTo(userId, noteRepository.findByLinkedEntity(type, entityId));
    }

    // =================================================================================
    // METODI DEPRECATI / COMPATIBILITÀ
    // =================================================================================

    @Override
    public Note create(String userId, String parentTypeStr, String parentId, CreateNoteRequest request) {
        Note.ParentType parentType = Note.ParentType.valueOf(parentTypeStr);
        return createInternal(userId, parentType, parentId, request);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Note> list(String userId, String parentType, String parentId) {
        if (parentType != null && parentId != null) {
            Note.ParentType type = Note.ParentType.valueOf(parentType);
            verifyContextAccess(userId, type, parentId);
            return noteAccess.visibleTo(userId, noteRepository.findByParentTypeAndParentIdAndDeletedAtIsNullOrderByCreatedAtAsc(type, parentId));
        }
        // Fallback legacy
        return noteAccess.visibleTo(userId, noteRepository.findByOwnerIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId));
    }

    // =================================================================================
    // HELPER PRIVATI
    // =================================================================================

    private Note createInternal(String userId, Note.ParentType parentType, String parentId, CreateNoteRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User non trovato: " + userId));

        // 1. Verifica accesso e risoluzione Project ID
        String projectId = resolveProjectIdAndVerifyAccess(userId, parentType, parentId);
        verifyContextWrite(userId, parentType, parentId);

        // 2. Creazione Nota
        Note note = new Note();
        note.setTitle(request.title());
        note.setContent(request.content());
        note.setParentType(parentType);
        note.setParentId(parentId);
        note.setOwner(user);
        note.setProjectId(projectId); // Denormalized field

        // Note type fields (PRD-02-FR-003)
        if (request.noteType() != null) {
            note.setNoteType(Note.NoteType.valueOf(request.noteType()));
        }
        if (request.evidence() != null) {
            note.setEvidence(request.evidence());
        }
        if (request.visibility() != null) {
            note.setVisibility(Note.Visibility.valueOf(request.visibility()));
        }
        if (request.restrictedRoles() != null) {
            note.setRestrictedRoles(request.restrictedRoles());
        }

        if (request.tagIds() != null && !request.tagIds().isEmpty()) {
            Set<Tag> tags = loadTagsForUser(userId, request.tagIds());
            note.setTags(tags);
        }

        Note savedNote = noteRepository.save(note);
        
        // 3. Notifiche
        triggerNotifications(savedNote, user, projectId);
        
        return savedNote;
    }

    private String resolveProjectIdAndVerifyAccess(String userId, Note.ParentType parentType, String parentId) {
        String projectId = null;
        if (parentType == Note.ParentType.TASK) {
            Task task = taskRepository.findById(parentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Task non trovato: " + parentId));
            projectId = task.getProject().getId();
        } else if (parentType == Note.ParentType.PROJECT) {
            projectId = parentId;
        }

        if (projectId == null) {
            throw new IllegalArgumentException("Impossibile determinare il progetto per il contesto: " + parentType);
        }

        // Check membership
        if (projectMemberRepository.findByProjectIdAndUserId(projectId, userId).isEmpty()) {
            throw new ForbiddenException("Non hai accesso al contesto (Progetto/Task)");
        }
        
        return projectId;
    }

    private void verifyContextAccess(String userId, Note.ParentType parentType, String parentId) {
        resolveProjectIdAndVerifyAccess(userId, parentType, parentId);
    }

    private void verifyContextWrite(String userId, Note.ParentType parentType, String parentId) {
        String projectId = resolveProjectIdAndVerifyAccess(userId, parentType, parentId);
        ProjectMember member = projectMemberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new ForbiddenException("Non hai accesso al progetto"));
        if (member.getRole() == ProjectMember.Role.VIEWER) {
            throw new ForbiddenException("Il ruolo Viewer consente soltanto la lettura delle note");
        }
    }

    private void triggerNotifications(Note note, User author, String projectId) {
        if (projectId == null) return;

        List<ProjectMember> members = projectMemberRepository.findByProjectId(projectId);
        
        String contextName = (note.getParentType() == Note.ParentType.TASK) ? "un task" : "un progetto";
        
        for (ProjectMember member : members) {
            if (!member.getUser().getId().equals(author.getId())) {
                notificationService.create(
                    member.getUser(),
                    author,
                    Notification.NotificationType.NEW_NOTE,
                    author.getDisplayName() + " ha commentato su " + contextName,
                    note.getParentType().name(),
                    note.getParentId()
                );
            }
        }
    }

    private void saveRevision(Note note, String authorId) {
        int nextRev = noteRevisionRepository.findMaxRevisionNumber(note.getId()).orElse(0) + 1;
        NoteRevision rev = new NoteRevision();
        rev.setNoteId(note.getId());
        rev.setRevisionNumber(nextRev);
        rev.setTitle(note.getTitle());
        rev.setContent(note.getContent());
        rev.setAuthorId(authorId);
        noteRevisionRepository.save(rev);
    }

    private Set<Tag> loadTagsForUser(String userId, List<String> tagIds) {
        Set<Tag> tags = new HashSet<>();
        for (String tagId : tagIds) {
            Tag tag = tagRepository.findById(tagId)
                    .orElseThrow(() -> new ResourceNotFoundException("Tag non trovato: " + tagId));
            if (!tag.getOwner().getId().equals(userId)) {
                throw new OwnershipViolationException("Tag non appartiene all'utente: " + tagId);
            }
            tags.add(tag);
        }
        return tags;
    }
}
