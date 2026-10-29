package com.lorenzodm.librepm.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lorenzodm.librepm.api.exception.ForbiddenException;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.repository.NoteRepository;
import com.lorenzodm.librepm.service.NoteAccessPolicy;
import com.lorenzodm.librepm.service.NoteService;
import com.lorenzodm.librepm.service.NotificationService;
import com.lorenzodm.librepm.service.SearchService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@Transactional
@ActiveProfiles("test")
class NotesSearchIntegrationTest {
    @Autowired EntityManager em;
    @Autowired NoteRepository repository;
    @Autowired NoteService notes;
    @Autowired SearchService search;
    @MockitoBean NotificationService notifications;
    private User alice;
    private User bob;
    private Project shared;
    private Project privateProject;

    @BeforeEach
    void setUp() {
        alice = user("search-alice");
        bob = user("search-bob");
        shared = project("Shared", bob);
        privateProject = project("Private", bob);
        em.persist(new ProjectMember(shared, alice, ProjectMember.Role.VIEWER));
        em.persist(new ProjectMember(shared, bob, ProjectMember.Role.OWNER));
        em.persist(new ProjectMember(privateProject, bob, ProjectMember.Role.OWNER));
    }

    @Test
    void repositoryContentSearchNeverBypassesOwnerOrDeletedFilter() {
        Note own = note(shared, alice, "Own", "needle");
        note(privateProject, bob, "Foreign", "needle");
        Note deleted = note(shared, alice, "Deleted", "needle");
        deleted.setDeletedAt(Instant.now());
        em.flush();
        assertThat(repository.findByOwnerIdAndDeletedAtIsNullAndTitleContainingIgnoreCaseOrContentContainingIgnoreCase(
                alice.getId(), "needle", "needle")).extracting(Note::getId).containsExactly(own.getId());
    }

    @Test
    void globalSearchUsesCurrentTaskRelationsAndLiteralTextOnNonSqliteDatabase() {
        TaskStatus status = new TaskStatus();
        status.setName("CUSTOM-DONE");
        status.setCategory(TaskStatus.Category.DONE);
        em.persist(status);
        Task task = new Task();
        task.setTitle("Budget 50%_approved");
        task.setDescription("Grant task");
        task.setProject(shared);
        task.setStatus(status);
        em.persist(task);
        Note visible = note(shared, bob, "Budget 50%_approved", "Searchable grant");
        note(privateProject, bob, "Budget 50%_approved", "Hidden grant");
        em.flush();
        var result = search.search(alice.getId(), "50%_", null, null, 20);
        assertThat(result.get("tasks")).hasSize(1);
        assertThat(result.get("tasks").getFirst()).containsEntry("status", "CUSTOM-DONE");
        assertThat(result.get("notes")).extracting(n -> n.get("id")).containsExactly(visible.getId());
        assertThat(search.search(alice.getId(), "grant", null, privateProject.getId(), 20)).isEmpty();
    }

    @Test
    void restrictedNotesAreHiddenAcrossEveryReadPathUntilRoleIsAllowed() {
        Note restricted = note(shared, bob, "Confidential needle", "needle");
        restricted.setVisibility(Note.Visibility.ROLE_RESTRICTED);
        restricted.setRestrictedRoles("[\"EDITOR\"]");
        NoteLink link = new NoteLink();
        link.setLinkedEntityType(NoteLink.LinkedEntityType.PROJECT);
        link.setLinkedEntityId(shared.getId());
        restricted.addLink(link);
        em.persist(link);
        em.flush();
        assertThatThrownBy(() -> notes.get(alice.getId(), restricted.getId())).isInstanceOf(ForbiddenException.class);
        assertThat(notes.listForProject(alice.getId(), shared.getId())).isEmpty();
        assertThat(notes.getFeed(alice.getId(), "ALL", null, null)).isEmpty();
        assertThat(notes.getBacklinks(alice.getId(), "PROJECT", shared.getId())).isEmpty();
        assertThat(search.search(alice.getId(), "needle", List.of("notes"), null, 1).get("notes")).isEmpty();
        restricted.setRestrictedRoles("[\"VIEWER\"]");
        em.flush();
        assertThat(notes.get(alice.getId(), restricted.getId())).isSameAs(restricted);
        assertThat(search.search(alice.getId(), "needle", List.of("notes"), null, 1).get("notes")).hasSize(1);
    }

    @Test
    void formerMembersCannotReadTheirOwnNotesAndFeedHonorsContext() {
        note(privateProject, alice, "Former member", "needle");
        Note sharedNote = note(shared, alice, "Current member", "needle");
        em.flush();
        assertThat(notes.search(alice.getId(), "needle")).extracting(Note::getId).containsExactly(sharedNote.getId());
        assertThat(notes.getFeed(alice.getId(), "ALL", "PROJECT", shared.getId())).hasSize(1);
        assertThatThrownBy(() -> notes.getFeed(alice.getId(), "ALL", "PROJECT", privateProject.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void deletedProjectsAreExcludedEvenWhenTheirMembershipsRemain() {
        note(shared, alice, "needle", "needle");
        shared.setDeletedAt(Instant.now());
        em.flush();
        em.clear();
        assertThat(search.search(alice.getId(), "needle", null, null, 20)).isEmpty();
        assertThat(notes.getFeed(alice.getId(), "ALL", null, null)).isEmpty();
    }

    @Test
    void viewerCannotCreateOrChangeEvenTheirOwnNotes() {
        Note own = note(shared, alice, "Read only", "needle");
        em.flush();
        assertThatThrownBy(() -> notes.delete(alice.getId(), own.getId())).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> notes.createForProject(alice.getId(), shared.getId(),
                new com.lorenzodm.librepm.api.dto.request.CreateNoteRequest("New", "Text", null, null, null, null, null)))
                .isInstanceOf(ForbiddenException.class);
        assertThat(repository.findById(own.getId())).isPresent();
    }

    @Test
    void malformedRoleRestrictionsFailClosedAndInvalidLimitsAreRejected() {
        Note restricted = note(shared, bob, "needle", "needle");
        restricted.setVisibility(Note.Visibility.ROLE_RESTRICTED);
        restricted.setRestrictedRoles("invalid-json");
        em.flush();
        assertThat(notes.listForProject(alice.getId(), shared.getId())).isEmpty();
        assertThatThrownBy(() -> search.search(alice.getId(), "needle", null, null, 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> search.search(alice.getId(), "needle", null, null, 101))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private User user(String name) {
        User user = new User();
        user.setUsername(name);
        user.setPasswordHash("test-only-hash");
        em.persist(user);
        return user;
    }

    private Project project(String name, User owner) {
        Project project = new Project();
        project.setName(name);
        project.setOwner(owner);
        em.persist(project);
        return project;
    }

    private Note note(Project project, User owner, String title, String content) {
        Note note = new Note();
        note.setOwner(owner);
        note.setTitle(title);
        note.setContent(content);
        note.setProjectId(project.getId());
        note.setParentType(Note.ParentType.PROJECT);
        note.setParentId(project.getId());
        em.persist(note);
        return note;
    }
}
