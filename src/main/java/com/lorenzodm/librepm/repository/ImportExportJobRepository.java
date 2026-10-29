package com.lorenzodm.librepm.repository;

import com.lorenzodm.librepm.core.entity.ImportExportJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ImportExportJobRepository extends JpaRepository<ImportExportJob, String> {

    Optional<ImportExportJob> findByIdAndUserIdAndProjectId(String id, String userId, String projectId);

    List<ImportExportJob> findByUserIdOrderByCreatedAtDesc(String userId);

    List<ImportExportJob> findByUserIdAndProjectIdOrderByCreatedAtDesc(String userId, String projectId);

    List<ImportExportJob> findByStatusOrderByCreatedAtDesc(ImportExportJob.JobStatus status);
}
