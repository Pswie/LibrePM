package com.lorenzodm.librepm.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lorenzodm.librepm.api.exception.GlobalExceptionHandler;
import com.lorenzodm.librepm.api.mapper.NoteLinkMapper;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.repository.*;
import com.lorenzodm.librepm.service.NoteAccessPolicy;
import com.lorenzodm.librepm.service.NotificationService;
import com.lorenzodm.librepm.service.impl.NoteLinkServiceImpl;
import com.lorenzodm.librepm.service.impl.NoteServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

/** Exercises controller identity propagation with the real note and link policies. */
class NoteLinkControllerTest {
    private NoteLinkRepository links;
    private NoteRepository notes;
    private ProjectMemberRepository memberships;
    private Note note;
    private ProjectMember authorMembership;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        links = mock(NoteLinkRepository.class);
        notes = mock(NoteRepository.class);
        memberships = mock(ProjectMemberRepository.class);
        User author = new User();
        author.setId("author");
        User reader = new User();
        reader.setId("reader");
        Project project = new Project();
        project.setId("project");
        authorMembership = new ProjectMember(project, author, ProjectMember.Role.EDITOR);
        ProjectMember readerMembership = new ProjectMember(project, reader, ProjectMember.Role.EDITOR);
        when(memberships.findByUserId("author")).thenReturn(List.of(authorMembership));
        when(memberships.findByUserId("reader")).thenReturn(List.of(readerMembership));
        when(memberships.findByProjectIdAndUserId("project", "author"))
                .thenReturn(Optional.of(authorMembership));
        when(memberships.findByProjectIdAndUserId("project", "reader"))
                .thenReturn(Optional.of(readerMembership));

        note = new Note();
        note.setId("note");
        note.setOwner(author);
        note.setParentType(Note.ParentType.PROJECT);
        note.setParentId("project");
        note.setProjectId("project");
        when(notes.findById("note")).thenReturn(Optional.of(note));
        NoteLink link = link("link", note);
        when(links.findById("link")).thenReturn(Optional.of(link));
        when(links.findByNoteId("note")).thenReturn(List.of(link));
        when(links.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        NoteAccessPolicy policy = new NoteAccessPolicy(memberships, new ObjectMapper());
        NoteServiceImpl noteService = new NoteServiceImpl(notes, mock(UserRepository.class),
                mock(TagRepository.class), mock(TaskRepository.class), memberships,
                mock(NotificationService.class), mock(NoteRevisionRepository.class), policy);
        NoteLinkServiceImpl linkService = new NoteLinkServiceImpl(links, noteService, policy);
        mvc = standaloneSetup(new NoteLinkController(linkService, new NoteLinkMapper()))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void authorWithWriteAccessCanCreateAndDeleteLinks() throws Exception {
        mvc.perform(post("/api/note-links").header("X-User-Id", "author")
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.noteId").value("note"));
        mvc.perform(delete("/api/note-links/link").header("X-User-Id", "author"))
                .andExpect(status().isNoContent());
        verify(links).save(any(NoteLink.class));
        verify(links).delete(any(NoteLink.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"reader", "outsider"})
    void otherUsersCannotCreateOrDeleteLinks(String caller) throws Exception {
        mvc.perform(post("/api/note-links").header("X-User-Id", caller)
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/note-links/link").header("X-User-Id", caller))
                .andExpect(status().isForbidden());
        verify(links, never()).save(any());
        verify(links, never()).delete(any(NoteLink.class));
    }

    @Test
    void authorDemotedToViewerCannotChangeLinks() throws Exception {
        authorMembership.setRole(ProjectMember.Role.VIEWER);
        mvc.perform(post("/api/note-links").header("X-User-Id", "author")
                        .contentType(MediaType.APPLICATION_JSON).content(createBody()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/note-links/link").header("X-User-Id", "author"))
                .andExpect(status().isForbidden());
        verify(links, never()).save(any());
        verify(links, never()).delete(any(NoteLink.class));
    }

    @Test
    void frozenNoteLinksCannotBeChanged() throws Exception {
        note.setFrozen(true);
        mvc.perform(delete("/api/note-links/link").header("X-User-Id", "author"))
                .andExpect(status().isForbidden());
        verify(links, never()).delete(any(NoteLink.class));
    }

    @Test
    void outsiderCannotReadNoteRelationships() throws Exception {
        mvc.perform(get("/api/note-links/note/note").header("X-User-Id", "outsider"))
                .andExpect(status().isForbidden());
        verify(links, never()).findByNoteId(anyString());
    }

    @Test
    void memberCanReadVisibleNoteRelationships() throws Exception {
        mvc.perform(get("/api/note-links/note/note").header("X-User-Id", "reader"))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void roleRestrictedNoteRelationshipsCannotBeReadByOtherMembers() throws Exception {
        note.setVisibility(Note.Visibility.ROLE_RESTRICTED);
        note.setRestrictedRoles("[\"ADMIN\"]");
        mvc.perform(get("/api/note-links/note/note").header("X-User-Id", "reader"))
                .andExpect(status().isForbidden());
        verify(links, never()).findByNoteId(anyString());
    }

    @Test
    void entityBacklinksHideRestrictedForeignAndDeletedNotes() throws Exception {
        Note restricted = new Note();
        restricted.setId("restricted");
        restricted.setProjectId("project");
        restricted.setVisibility(Note.Visibility.ROLE_RESTRICTED);
        restricted.setRestrictedRoles("[\"ADMIN\"]");
        Note foreign = new Note();
        foreign.setId("foreign");
        foreign.setProjectId("other-project");
        Note deleted = new Note();
        deleted.setId("deleted");
        deleted.setProjectId("project");
        deleted.setDeletedAt(Instant.now());
        when(links.findByLinkedEntity(NoteLink.LinkedEntityType.TASK, "task"))
                .thenReturn(List.of(link("visible", note), link("restricted", restricted),
                        link("foreign", foreign), link("deleted", deleted)));

        mvc.perform(get("/api/note-links/entity/TASK/task").header("X-User-Id", "reader"))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value("visible"));
    }

    @Test
    void unsupportedEntityTypeReturnsBadRequest() throws Exception {
        mvc.perform(get("/api/note-links/entity/INVALID/task").header("X-User-Id", "reader"))
                .andExpect(status().isBadRequest());
    }

    private String createBody() {
        return "{\"noteId\":\"note\",\"linkedEntityType\":\"TASK\",\"linkedEntityId\":\"task\"}";
    }

    private NoteLink link(String id, Note linkedNote) {
        NoteLink link = new NoteLink();
        link.setId(id);
        link.setNote(linkedNote);
        link.setLinkedEntityType(NoteLink.LinkedEntityType.TASK);
        link.setLinkedEntityId("task");
        return link;
    }
}
