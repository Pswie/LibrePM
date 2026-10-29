package com.lorenzodm.librepm.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lorenzodm.librepm.core.entity.Note;
import com.lorenzodm.librepm.core.entity.ProjectMember;
import com.lorenzodm.librepm.repository.ProjectMemberRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/** Shared visibility rule for individual notes, feeds, backlinks and search. */
@Component
public class NoteAccessPolicy {
    private final ProjectMemberRepository memberships;
    private final ObjectMapper mapper;

    public NoteAccessPolicy(ProjectMemberRepository memberships, ObjectMapper mapper) {
        this.memberships = memberships;
        this.mapper = mapper;
    }

    public Predicate<Note> readerFor(String userId) {
        Map<String, ProjectMember> projects = memberships.findByUserId(userId).stream()
                .filter(m -> m.getProject().getDeletedAt() == null)
                .collect(Collectors.toMap(m -> m.getProject().getId(), m -> m, (first, second) -> first));
        return note -> canRead(userId, note, projects.get(note.getProjectId()));
    }

    public List<Note> visibleTo(String userId, List<Note> notes) {
        return notes.stream().filter(readerFor(userId)).toList();
    }

    private boolean canRead(String userId, Note note, ProjectMember membership) {
        if (membership == null || note.getDeletedAt() != null) return false;
        if (note.getVisibility() != Note.Visibility.ROLE_RESTRICTED) return true;
        if (note.getOwner() != null && userId.equals(note.getOwner().getId())) return true;
        try {
            JsonNode roles = mapper.readTree(note.getRestrictedRoles() == null ? "[]" : note.getRestrictedRoles());
            if (!roles.isArray()) return false;
            for (JsonNode role : roles) {
                if (!role.isTextual()) continue;
                if (role.asText().equals(membership.getSystemRoleId())
                        || (membership.getRole() != null && role.asText().equals(membership.getRole().name()))) {
                    return true;
                }
            }
        } catch (Exception ignored) {
            // Malformed restrictions must never make a confidential note public.
        }
        return false;
    }
}
