package com.lorenzodm.librepm.api.controller;

import com.lorenzodm.librepm.api.exception.GlobalExceptionHandler;
import com.lorenzodm.librepm.api.mapper.ImportExportJobMapper;
import com.lorenzodm.librepm.core.entity.ImportExportJob;
import com.lorenzodm.librepm.repository.*;
import com.lorenzodm.librepm.service.CsvImportService;
import com.lorenzodm.librepm.service.impl.ProjectExportServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class ImportExportControllerTest {

    private static final String PAYLOAD = "Risultato riservato del progetto";
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        ImportExportJobRepository jobs = mock(ImportExportJobRepository.class);
        ImportExportJob job = new ImportExportJob();
        job.setId("job-1");
        job.setUserId("owner");
        job.setProjectId("project-1");
        job.setJobType(ImportExportJob.JobType.EXPORT_JSON);
        job.setStatus(ImportExportJob.JobStatus.COMPLETED);
        job.setResultPayload(PAYLOAD);
        when(jobs.findByIdAndUserIdAndProjectId("job-1", "owner", "project-1"))
                .thenReturn(Optional.of(job));

        ProjectExportServiceImpl service = new ProjectExportServiceImpl(
                mock(ProjectRepository.class), mock(TaskRepository.class),
                mock(DeliverableRepository.class), mock(OkrRepository.class),
                mock(ProjectCharterRepository.class), jobs);
        ImportExportController controller = new ImportExportController(
                service, mock(CsvImportService.class), new ImportExportJobMapper());
        mvc = standaloneSetup(controller).setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void ownerCanReadJobInItsProject() throws Exception {
        mvc.perform(get("/api/users/owner/projects/project-1/jobs/job-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultPayload").value(PAYLOAD));
    }

    @Test
    void ownerCanDownloadJobInItsProject() throws Exception {
        mvc.perform(get("/api/users/owner/projects/project-1/jobs/job-1/download"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"export_json_job-1.txt\""))
                .andExpect(content().string(PAYLOAD));
    }

    @ParameterizedTest
    @CsvSource({
            "other-user,project-1,job-1",
            "owner,other-project,job-1",
            "owner,project-1,missing-job"
    })
    void jobDetailsCannotEscapeUserOrProjectScope(String user, String project, String job) throws Exception {
        mvc.perform(get("/api/users/{user}/projects/{project}/jobs/{job}", user, project, job))
                .andExpect(status().isNotFound())
                .andExpect(content().string(not(containsString(PAYLOAD))));
    }

    @ParameterizedTest
    @CsvSource({
            "other-user,project-1,job-1",
            "owner,other-project,job-1",
            "owner,project-1,missing-job"
    })
    void downloadCannotEscapeUserOrProjectScope(String user, String project, String job) throws Exception {
        mvc.perform(get("/api/users/{user}/projects/{project}/jobs/{job}/download", user, project, job))
                .andExpect(status().isNotFound())
                .andExpect(content().string(not(containsString(PAYLOAD))));
    }
}
