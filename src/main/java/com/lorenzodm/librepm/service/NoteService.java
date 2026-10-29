package com.lorenzodm.librepm.service;

import com.lorenzodm.librepm.api.dto.request.CreateNoteRequest;
import com.lorenzodm.librepm.api.dto.request.UpdateNoteRequest;
import com.lorenzodm.librepm.core.entity.Note;

import java.util.List;

public interface NoteService {
    // Metodi contestuali specifici (Task/Project)
    Note createForTask(String userId, String taskId, CreateNoteRequest request);
    Note createForProject(String userId, String projectId, CreateNoteRequest request);
    
    List<Note> listForTask(String userId, String taskId);
    List<Note> listForProject(String userId, String projectId);

    // Metodi CRUD su singola nota (con verifica contesto)
    Note get(String userId, String noteId);
    /** Validates note ownership and current write access before changing related data. */
    Note requireWrite(String userId, String noteId);
    Note update(String userId, String noteId, UpdateNoteRequest request);
    void delete(String userId, String noteId);

    // Metodi Feed e Ricerca
    List<Note> search(String userId, String query);
    List<Note> getFeed(String userId, String scope, String parentType, String parentId);

    // Revisions (PRD-02-FR-006)
    List<com.lorenzodm.librepm.core.entity.NoteRevision> getRevisions(String userId, String noteId);

    // Backlinks (PRD-02-FR-005)
    List<Note> getBacklinks(String userId, String entityType, String entityId);

    // Deprecati (da rimuovere dopo refactoring completo)
    Note create(String userId, String parentType, String parentId, CreateNoteRequest request);
    List<Note> list(String userId, String parentType, String parentId);
}
