package com.lorenzodm.librepm.service.impl;

import com.lorenzodm.librepm.api.dto.request.CreateNoteLinkRequest;
import com.lorenzodm.librepm.api.exception.ConflictException;
import com.lorenzodm.librepm.api.exception.BadRequestException;
import com.lorenzodm.librepm.api.exception.ResourceNotFoundException;
import com.lorenzodm.librepm.core.entity.Note;
import com.lorenzodm.librepm.core.entity.NoteLink;
import com.lorenzodm.librepm.repository.NoteLinkRepository;
import com.lorenzodm.librepm.service.NoteLinkService;
import com.lorenzodm.librepm.service.NoteService;
import com.lorenzodm.librepm.service.NoteAccessPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.function.Predicate;

@Service
@Transactional
public class NoteLinkServiceImpl implements NoteLinkService {

    private static final Logger log = LoggerFactory.getLogger(NoteLinkServiceImpl.class);
    private final NoteLinkRepository noteLinkRepository;
    private final NoteService noteService;
    private final NoteAccessPolicy noteAccess;

    public NoteLinkServiceImpl(NoteLinkRepository noteLinkRepository, NoteService noteService,
                               NoteAccessPolicy noteAccess) {
        this.noteLinkRepository = noteLinkRepository;
        this.noteService = noteService;
        this.noteAccess = noteAccess;
    }

    @Override
    public NoteLink create(String userId, CreateNoteLinkRequest request) {
        log.debug("Creazione link nota: note={}, type={}, entity={}", 
                request.noteId(), request.linkedEntityType(), request.linkedEntityId());

        Note note = noteService.requireWrite(userId, request.noteId());
        NoteLink.LinkedEntityType entityType = parseEntityType(request.linkedEntityType());

        if (noteLinkRepository.existsByNoteIdAndLinkedEntityTypeAndLinkedEntityId(
                request.noteId(), entityType, request.linkedEntityId())) {
            throw new ConflictException("Link già esistente");
        }

        NoteLink link = new NoteLink();
        link.setNote(note);
        link.setLinkedEntityType(entityType);
        link.setLinkedEntityId(request.linkedEntityId());
        return noteLinkRepository.save(link);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteLink> findByNoteId(String userId, String noteId) {
        noteService.get(userId, noteId);
        return noteLinkRepository.findByNoteId(noteId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NoteLink> findByLinkedEntity(String userId, String entityType, String entityId) {
        NoteLink.LinkedEntityType type = parseEntityType(entityType);
        Predicate<Note> canRead = noteAccess.readerFor(userId);
        return noteLinkRepository.findByLinkedEntity(type, entityId).stream()
                .filter(link -> link.getDeletedAt() == null && link.getNote() != null && canRead.test(link.getNote()))
                .toList();
    }

    @Override
    public void delete(String userId, String id) {
        log.debug("Eliminazione link nota: {}", id);
        NoteLink link = noteLinkRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Link nota non trovato: " + id));
        noteService.requireWrite(userId, link.getNote().getId());
        noteLinkRepository.delete(link);
    }

    private NoteLink.LinkedEntityType parseEntityType(String type) {
        try {
            return NoteLink.LinkedEntityType.valueOf(type.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new BadRequestException("Tipo entità non valido: " + type);
        }
    }
}
