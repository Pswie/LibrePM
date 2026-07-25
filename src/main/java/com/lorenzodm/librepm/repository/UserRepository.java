package com.lorenzodm.librepm.repository;

import com.lorenzodm.librepm.core.entity.SyncStatus;
import com.lorenzodm.librepm.core.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Repository per User
 *
 * Query custom per:
 * - Ricerca per username/email
 * - Filtro utenti attivi
 * - Sync operations (preparazione cloud)
 *
 * @author Lorenzo DM
 * @since 1.0.0
 */
@Repository
public interface UserRepository extends JpaRepository<User, String> {

    /**
     * Trova user per username (case-insensitive)
     */
    Optional<User> findByUsernameIgnoreCase(String username);

    /**
     * Trova user per email (case-insensitive)
     */
    Optional<User> findByEmailIgnoreCase(String email);

    /**
     * Trova user per identità Clerk (claim {@code sub} del JWT).
     * <p>
     * Usata solo dal profilo {@code cloud}: è il legame esplicito e stabile fra
     * la persona che Clerk autentica e la riga interna. Sul desktop non trova
     * mai nulla, perché la colonna resta vuota.
     * </p>
     */
    Optional<User> findByClerkUserId(String clerkUserId);

    /**
     * Verifica se username esiste già
     */
    boolean existsByUsernameIgnoreCase(String username);

    /**
     * Verifica se email esiste già
     */
    boolean existsByEmailIgnoreCase(String email);

    /**
     * Trova tutti gli utenti attivi
     */
    List<User> findByActiveTrue();

    /**
     * Trova tutti gli utenti attivi non-ghost (per bootstrap profile picker)
     */
    List<User> findByActiveTrueAndIsGhostFalse();

    /**
     * Trova utenti creati dopo una certa data
     */
    List<User> findByCreatedAtAfter(Instant date);

    /**
     * Trova utenti che necessitano sync (cloud ready)
     */
    @Query("SELECT u FROM User u WHERE u.syncStatus = :status OR u.lastSyncedAt < :threshold")
    List<User> findNeedingSync(@Param("status") SyncStatus status, @Param("threshold") Instant threshold);

    /**
     * Conta utenti attivi
     */
    long countByActiveTrue();

    /**
     * Trova user con numero progetti > threshold
     */
    @Query("SELECT u FROM User u WHERE SIZE(u.projects) > :minProjects")
    List<User> findUsersWithMinProjects(@Param("minProjects") int minProjects);

    /**
     * Cerca utenti per nome, username o email (case-insensitive)
     * Esclude gli utenti Ghost (solo utenti reali)
     */
    @Query("SELECT u FROM User u WHERE u.active = true AND u.isGhost = false AND " +
           "(LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.displayName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<User> searchRealUsers(@Param("query") String query);

    /**
     * Trova tutti i ghost users creati da un utente specifico
     */
    @Query("SELECT u FROM User u WHERE u.isGhost = true AND u.createdBy.id = :ownerId AND u.active = true")
    List<User> findGhostsByCreator(@Param("ownerId") String ownerId);
}
