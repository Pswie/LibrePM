package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.api.exception.GlobalExceptionHandler;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class ChangeControlControllerTest {
    private ProjectBranchRepository branches;
    private BranchModificationRepository modifications;
    private ChangeRequestRepository requests;
    private DecisionLogRepository decisions;
    private ProjectBranch branch;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        branches = mock(ProjectBranchRepository.class);
        modifications = mock(BranchModificationRepository.class);
        requests = mock(ChangeRequestRepository.class);
        decisions = mock(DecisionLogRepository.class);
        branch = new ProjectBranch();
        branch.setId("branch");
        branch.setSourceProjectId("p");
        branch.setName("Scenario");
        when(branches.findById("branch")).thenReturn(Optional.of(branch));
        when(branches.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        mvc = standaloneSetup(new ChangeControlController(requests, branches, modifications, decisions))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void mergeCannotReportSuccessWithoutApplyingModifications() throws Exception {
        mvc.perform(put("/api/projects/p/changes/branches/branch").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"MERGED\",\"name\":\"Changed\"}"))
                .andExpect(status().isConflict());

        assertThat(branch.getStatus()).isEqualTo("ACTIVE");
        assertThat(branch.getName()).isEqualTo("Scenario");
        assertThat(branch.getMergedAt()).isNull();
        verify(branches, never()).save(any());
        verifyNoInteractions(modifications);
    }

    @Test
    void regularStatusChangesStillWork() throws Exception {
        mvc.perform(put("/api/projects/p/changes/branches/branch").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
    }

    @Test
    void unknownStatusIsRejectedBeforeSaving() throws Exception {
        mvc.perform(put("/api/projects/p/changes/branches/branch").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"TYPO\"}"))
                .andExpect(status().isBadRequest());
        verify(branches, never()).save(any());
    }

    @Test
    void branchCannotBeUpdatedThroughAnotherProject() throws Exception {
        mvc.perform(put("/api/projects/other/changes/branches/branch").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Changed\"}"))
                .andExpect(status().isNotFound());
        assertThat(branch.getName()).isEqualTo("Scenario");
        verify(branches, never()).save(any());
    }

    @Test
    void branchCannotBeDeletedThroughAnotherProject() throws Exception {
        mvc.perform(delete("/api/projects/other/changes/branches/branch"))
                .andExpect(status().isNotFound());
        verify(branches, never()).delete(any(ProjectBranch.class));
    }

    @Test
    void modificationsCannotBeReadThroughAnotherProject() throws Exception {
        mvc.perform(get("/api/projects/other/changes/branches/branch/modifications"))
                .andExpect(status().isNotFound());
        verifyNoInteractions(modifications);
    }

    @Test
    void modificationCannotBeDeletedThroughAnotherBranch() throws Exception {
        BranchModification modification = new BranchModification();
        modification.setBranchId("different-branch");
        when(modifications.findById("mod")).thenReturn(Optional.of(modification));

        mvc.perform(delete("/api/projects/p/changes/branches/branch/modifications/mod"))
                .andExpect(status().isNotFound());
        verify(modifications, never()).delete(any(BranchModification.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"requests", "decisions"})
    void otherProjectRecordsCannotBeDeleted(String recordType) throws Exception {
        ChangeRequest request = new ChangeRequest();
        request.setProjectId("other");
        when(requests.findById("record")).thenReturn(Optional.of(request));
        DecisionLog decision = new DecisionLog();
        decision.setProjectId("other");
        when(decisions.findById("record")).thenReturn(Optional.of(decision));

        mvc.perform(delete("/api/projects/p/changes/{type}/record", recordType))
                .andExpect(status().isNotFound());
        verify(requests, never()).delete(any(ChangeRequest.class));
        verify(decisions, never()).delete(any(DecisionLog.class));
    }
}
