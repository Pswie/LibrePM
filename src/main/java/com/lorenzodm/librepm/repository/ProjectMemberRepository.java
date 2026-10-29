package com.lorenzodm.librepm.repository;

import com.lorenzodm.librepm.core.entity.ProjectMember;
import com.lorenzodm.librepm.core.entity.ProjectMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, ProjectMemberId> {
    List<ProjectMember> findByProjectId(String projectId);
    @Query("SELECT m FROM ProjectMember m JOIN FETCH m.project p WHERE m.user.id = :userId AND p.deletedAt IS NULL")
    List<ProjectMember> findByUserId(@Param("userId") String userId);
    @Query("SELECT m FROM ProjectMember m JOIN FETCH m.project p WHERE p.id = :projectId AND m.user.id = :userId AND p.deletedAt IS NULL")
    Optional<ProjectMember> findByProjectIdAndUserId(@Param("projectId") String projectId, @Param("userId") String userId);
    
    /**
     * Verifica efficiente se un utente è membro di un progetto.
     */
    boolean existsByProjectIdAndUserId(String projectId, String userId);
}
