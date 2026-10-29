package com.lorenzodm.librepm.service.impl;

import com.lorenzodm.librepm.core.entity.Note;
import com.lorenzodm.librepm.core.entity.Task;
import com.lorenzodm.librepm.repository.ProjectMemberRepository;
import com.lorenzodm.librepm.service.NoteAccessPolicy;
import com.lorenzodm.librepm.service.SearchService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Predicate;

@Service
@Transactional(readOnly = true)
public class SearchServiceImpl implements SearchService {
    private final EntityManager em;
    private final ProjectMemberRepository memberships;
    private final NoteAccessPolicy noteAccess;

    public SearchServiceImpl(EntityManager em, ProjectMemberRepository memberships, NoteAccessPolicy noteAccess) {
        this.em = em;
        this.memberships = memberships;
        this.noteAccess = noteAccess;
    }

    @Override
    public Map<String, List<Map<String, Object>>> search(String userId, String query,
            List<String> entityTypes, String projectId, int limit) {
        if (query == null || query.isBlank()) return Map.of();
        if (limit < 1 || limit > 100) throw new IllegalArgumentException("Search limit must be between 1 and 100");
        if (query.length() > 500) throw new IllegalArgumentException("Search query must not exceed 500 characters");
        List<String> projects = memberships.findByUserId(userId).stream()
                .filter(m -> m.getProject().getDeletedAt() == null)
                .map(m -> m.getProject().getId()).distinct().toList();
        if (projects.isEmpty()) return Map.of();
        if (projectId != null && !projectId.isBlank()) {
            if (!projects.contains(projectId)) return Map.of();
            projects = List.of(projectId);
        }

        // JPQL works on SQLite and MySQL without failing an SQLite-only FTS query first.
        // Bind the original text; FTS quoting previously leaked into the LIKE fallback.
        String pattern = "%" + query.trim().toLowerCase(Locale.ROOT)
                .replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        if (entityTypes == null || entityTypes.isEmpty() || entityTypes.contains("notes")) {
            TypedQuery<Note> notes = em.createQuery("SELECT n FROM Note n WHERE n.deletedAt IS NULL "
                    + "AND n.projectId IN :projects AND (LOWER(n.title) LIKE :text ESCAPE '!' "
                    + "OR LOWER(n.content) LIKE :text ESCAPE '!') ORDER BY n.updatedAt DESC, n.id", Note.class)
                    .setParameter("projects", projects).setParameter("text", pattern);
            Predicate<Note> visible = noteAccess.readerFor(userId);
            List<Map<String, Object>> matches = new ArrayList<>();
            int offset = 0;
            while (matches.size() < limit) {
                List<Note> page = notes.setFirstResult(offset).setMaxResults(100).getResultList();
                for (Note note : page) {
                    if (visible.test(note)) matches.add(noteResult(note));
                    if (matches.size() == limit) break;
                }
                if (page.size() < 100) break;
                offset += page.size();
            }
            result.put("notes", matches);
        }
        if (entityTypes == null || entityTypes.isEmpty() || entityTypes.contains("tasks")) {
            List<Task> tasks = em.createQuery("SELECT t FROM Task t WHERE t.deletedAt IS NULL "
                    + "AND t.project.id IN :projects AND (LOWER(t.title) LIKE :text ESCAPE '!' "
                    + "OR LOWER(t.description) LIKE :text ESCAPE '!') ORDER BY t.updatedAt DESC, t.id", Task.class)
                    .setParameter("projects", projects).setParameter("text", pattern).setMaxResults(limit).getResultList();
            result.put("tasks", tasks.stream().map(this::taskResult).toList());
        }
        return result;
    }

    private Map<String, Object> noteResult(Note note) {
        Map<String, Object> result = base(note.getId(), note.getTitle(), note.getContent());
        result.put("noteType", note.getNoteType());
        result.put("projectId", note.getProjectId());
        result.put("parentType", note.getParentType());
        result.put("updatedAt", note.getUpdatedAt());
        result.put("entityType", "NOTE");
        return result;
    }

    private Map<String, Object> taskResult(Task task) {
        Map<String, Object> result = base(task.getId(), task.getTitle(), task.getDescription());
        result.put("status", task.getStatus() == null ? null : task.getStatus().getName());
        result.put("priority", task.getPriority() == null ? null : task.getPriority().getName());
        result.put("projectId", task.getProject().getId());
        result.put("updatedAt", task.getUpdatedAt());
        result.put("entityType", "TASK");
        return result;
    }

    private Map<String, Object> base(String id, String title, String content) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("title", title);
        result.put("snippet", content == null ? "" : content.substring(0, Math.min(content.length(), 100)));
        return result;
    }
}
