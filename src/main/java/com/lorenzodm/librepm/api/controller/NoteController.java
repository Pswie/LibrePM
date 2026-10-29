package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.api.dto.request.CreateNoteRequest;
import com.lorenzodm.librepm.api.dto.request.UpdateNoteRequest;
import com.lorenzodm.librepm.api.dto.response.NoteResponse;
import com.lorenzodm.librepm.api.mapper.NoteMapper;
import com.lorenzodm.librepm.core.entity.Note;
import com.lorenzodm.librepm.core.entity.NoteRevision;
import com.lorenzodm.librepm.service.NoteService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteService noteService;
    private final NoteMapper noteMapper;

    public NoteController(NoteService noteService, NoteMapper noteMapper) {
        this.noteService = noteService;
        this.noteMapper = noteMapper;
    }

    // DEPRECATED: Use /api/tasks/{id}/notes or /api/projects/{id}/notes
    @PostMapping
    public ResponseEntity<NoteResponse> create(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam String parentType,
            @RequestParam String parentId,
            @Valid @RequestBody CreateNoteRequest request) {
        
        Note created = noteService.create(userId, parentType, parentId, request);
        return ResponseEntity.created(URI.create("/api/notes/" + created.getId()))
                .body(noteMapper.toResponse(created));
    }

    // DEPRECATED: Use specific endpoints or /feed
    @GetMapping
    public ResponseEntity<List<NoteResponse>> list(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam(required = false) String parentType,
            @RequestParam(required = false) String parentId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String noteType) {

        List<Note> notes;
        if (search != null && !search.isBlank()) {
            notes = noteService.search(userId, search);
        } else {
            notes = noteService.list(userId, parentType, parentId);
        }

        // Client-side filter by noteType if specified
        if (noteType != null && !noteType.isBlank()) {
            notes = notes.stream()
                    .filter(n -> n.getNoteType() != null && n.getNoteType().name().equals(noteType))
                    .collect(Collectors.toList());
        }

        return ResponseEntity.ok(notes.stream().map(noteMapper::toResponse).collect(Collectors.toList()));
    }
    
    @GetMapping("/feed")
    public ResponseEntity<List<NoteResponse>> getFeed(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam(defaultValue = "ALL") String scope,
            @RequestParam(required = false) String parentType,
            @RequestParam(required = false) String parentId) {
            
        List<Note> notes = noteService.getFeed(userId, scope, parentType, parentId);
        return ResponseEntity.ok(notes.stream().map(noteMapper::toResponse).collect(Collectors.toList()));
    }

    @GetMapping("/{noteId}")
    public ResponseEntity<NoteResponse> get(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String noteId) {
        return ResponseEntity.ok(noteMapper.toResponse(noteService.get(userId, noteId)));
    }

    @PutMapping("/{noteId}")
    public ResponseEntity<NoteResponse> update(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String noteId,
            @Valid @RequestBody UpdateNoteRequest request) {
        return ResponseEntity.ok(noteMapper.toResponse(noteService.update(userId, noteId, request)));
    }

    /**
     * Returns notes that link to a given entity (backlinks, PRD-02-FR-005).
     */
    @GetMapping("/backlinks")
    public ResponseEntity<List<NoteResponse>> getBacklinks(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam String entityType,
            @RequestParam String entityId) {
        List<Note> notes = noteService.getBacklinks(userId, entityType, entityId);
        return ResponseEntity.ok(notes.stream().map(noteMapper::toResponse).collect(Collectors.toList()));
    }

    @GetMapping("/{noteId}/revisions")
    public ResponseEntity<List<NoteRevision>> getRevisions(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String noteId) {
        return ResponseEntity.ok(noteService.getRevisions(userId, noteId));
    }

    @DeleteMapping("/{noteId}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String noteId) {
        noteService.delete(userId, noteId);
        return ResponseEntity.noContent().build();
    }
}
