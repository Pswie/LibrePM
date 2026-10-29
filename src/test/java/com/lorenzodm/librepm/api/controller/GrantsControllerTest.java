package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.api.exception.BadRequestException;
import com.lorenzodm.librepm.api.exception.ResourceNotFoundException;
import com.lorenzodm.librepm.core.entity.*;
import com.lorenzodm.librepm.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GrantsControllerTest {
    GrantCallRepository calls;
    CallRequirementRepository requirements;
    SubmissionPackageRepository submissions;
    ObligationRecordRepository obligations;
    ReportingPeriodRepository periods;
    GrantsController controller;

    @BeforeEach
    void setup() {
        calls = mock(GrantCallRepository.class);
        requirements = mock(CallRequirementRepository.class);
        submissions = mock(SubmissionPackageRepository.class);
        obligations = mock(ObligationRecordRepository.class);
        periods = mock(ReportingPeriodRepository.class);
        controller = new GrantsController(calls, requirements, submissions, obligations, periods);
        GrantCall call = new GrantCall();
        call.setId("call-a");
        call.setProjectId("project-a");
        when(calls.findById("call-a")).thenReturn(Optional.of(call));
    }

    @Test
    void aCallCannotBeModifiedThroughAnotherProjectOrUsedToCreateRequirements() {
        assertThrows(ResourceNotFoundException.class,
                () -> controller.updateCall("project-b", "call-a", Map.of("title", "Wrong project")));
        assertThrows(ResourceNotFoundException.class,
                () -> controller.createRequirement("project-b", "call-a", Map.of("description", "Wrong project")));
        verify(calls, never()).save(any());
        verify(requirements, never()).save(any());
    }

    @Test
    void requirementsAndSubmissionsMustBelongToTheCallInTheUrl() {
        CallRequirement requirement = new CallRequirement();
        requirement.setCallId("call-b");
        when(requirements.findById("req-b")).thenReturn(Optional.of(requirement));
        SubmissionPackage submission = new SubmissionPackage();
        submission.setCallId("call-b");
        when(submissions.findById("sub-b")).thenReturn(Optional.of(submission));
        assertThrows(ResourceNotFoundException.class,
                () -> controller.deleteRequirement("project-a", "call-a", "req-b"));
        assertThrows(ResourceNotFoundException.class,
                () -> controller.updateSubmission("project-a", "call-a", "sub-b", Map.of("status", "SUBMITTED")));
        verify(requirements, never()).delete(any());
        verify(submissions, never()).save(any());
    }

    @Test
    void reportingPeriodRejectsReversedDatesAndMalformedDates() {
        assertThrows(BadRequestException.class, () -> controller.createReportingPeriod("project-a",
                Map.of("periodStart", "2026-11-01", "periodEnd", "2026-10-01")));
        assertThrows(BadRequestException.class, () -> controller.createReportingPeriod("project-a",
                Map.of("periodStart", "not-a-date", "periodEnd", "2026-11-01")));
        verify(periods, never()).save(any());
    }

    @Test
    void reportingPeriodAcceptsSameDayDatesAndOptionalDueDate() {
        when(periods.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var result = controller.createReportingPeriod("project-a",
                Map.of("periodStart", "2026-10-29", "periodEnd", "2026-10-29"));
        assertEquals(200, result.getStatusCode().value());
        assertNull(result.getBody().get("dueDate"));
    }
}
