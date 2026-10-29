package com.lorenzodm.librepm.service;

import com.lorenzodm.librepm.api.dto.request.CreateNoteLinkRequest;
import com.lorenzodm.librepm.core.entity.NoteLink;

import java.util.List;

public interface NoteLinkService {
    NoteLink create(String userId, CreateNoteLinkRequest request);
    List<NoteLink> findByNoteId(String userId, String noteId);
    List<NoteLink> findByLinkedEntity(String userId, String entityType, String entityId);
    void delete(String userId, String id);
}
