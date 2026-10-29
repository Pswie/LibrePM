package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.api.dto.request.CreateNoteLinkRequest;
import com.lorenzodm.librepm.api.dto.response.NoteLinkResponse;
import com.lorenzodm.librepm.api.mapper.NoteLinkMapper;
import com.lorenzodm.librepm.core.entity.NoteLink;
import com.lorenzodm.librepm.service.NoteLinkService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/note-links")
public class NoteLinkController {

    private final NoteLinkService service;
    private final NoteLinkMapper mapper;

    public NoteLinkController(NoteLinkService service, NoteLinkMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @PostMapping
    public ResponseEntity<NoteLinkResponse> create(
            @RequestHeader("X-User-Id") String userId,
            @Valid @RequestBody CreateNoteLinkRequest request) {
        NoteLink link = service.create(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(link));
    }

    @GetMapping("/note/{noteId}")
    public ResponseEntity<List<NoteLinkResponse>> findByNoteId(
            @RequestHeader("X-User-Id") String userId, @PathVariable String noteId) {
        List<NoteLinkResponse> response = service.findByNoteId(userId, noteId).stream()
                .map(mapper::toResponse).toList();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/entity/{entityType}/{entityId}")
    public ResponseEntity<List<NoteLinkResponse>> findByLinkedEntity(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String entityType,
            @PathVariable String entityId) {
        List<NoteLinkResponse> response = service.findByLinkedEntity(userId, entityType, entityId).stream()
                .map(mapper::toResponse).toList();
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@RequestHeader("X-User-Id") String userId, @PathVariable String id) {
        service.delete(userId, id);
        return ResponseEntity.noContent().build();
    }
}
