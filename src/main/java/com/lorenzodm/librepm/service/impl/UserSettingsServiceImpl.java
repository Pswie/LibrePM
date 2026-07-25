package com.lorenzodm.librepm.service.impl;

import com.lorenzodm.librepm.api.dto.request.UpdateUserSettingsRequest;
import com.lorenzodm.librepm.api.exception.ResourceNotFoundException;
import com.lorenzodm.librepm.core.entity.User;
import com.lorenzodm.librepm.core.entity.UserSettings;
import com.lorenzodm.librepm.repository.UserRepository;
import com.lorenzodm.librepm.repository.UserSettingsRepository;
import com.lorenzodm.librepm.service.UserSettingsService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Implementazione UserSettingsService con gestione concorrenza robusta.
 *
 * PROBLEMA RISOLTO: Race condition con @MapsId
 *
 * Quando UserSettings usa @MapsId, l'ID è derivato dalla relazione User e viene
 * impostato nel costruttore. Questo causa:
 * 1. JPA considera l'entità "detached" (ha già un ID)
 * 2. repository.save() chiama merge() invece di persist()
 * 3. merge() su un'entità inesistente causa StaleObjectStateException
 *
 * SOLUZIONE: Usare EntityManager.persist() direttamente per forzare un INSERT,
 * e gestire i conflitti con DataIntegrityViolationException.
 *
 * @author Lorenzo DM
 * @since 0.3.1
 */
@Service
@Transactional
public class UserSettingsServiceImpl implements UserSettingsService {

    private static final Logger log = LoggerFactory.getLogger(UserSettingsServiceImpl.class);

    private final UserSettingsRepository settingsRepository;
    private final UserRepository userRepository;

    /**
     * Tema assegnato a chi non ne ha ancora scelto uno.
     *
     * <p>È configurabile perché le due distribuzioni sono due prodotti diversi:
     * LibrePM da scrivania nasce scuro, mentre in cloud è la sezione bandi di
     * Angeli del Futuro, dove il contenuto sta su carta chiara e l'unico elemento
     * scuro è il binario laterale. Il valore predefinito resta {@code dark}, così
     * il desktop non cambia; il profilo {@code cloud} lo porta a {@code light}.
     *
     * <p>Deciderlo nel frontend non basta: il tema arriva da qui, e il valore
     * salvato vince su qualunque impostazione iniziale del client.
     */
    private final String defaultTheme;

    @PersistenceContext
    private EntityManager entityManager;

    public UserSettingsServiceImpl(
            UserSettingsRepository settingsRepository,
            UserRepository userRepository,
            @Value("${librepm.ui.default-theme:dark}") String defaultTheme) {
        this.settingsRepository = settingsRepository;
        this.userRepository = userRepository;
        this.defaultTheme = defaultTheme;
    }

    /**
     * Ottiene o crea settings per un utente con gestione concorrenza.
     *
     * Strategia:
     * 1. Prima lettura: tenta di trovare settings esistenti
     * 2. Se non esistono: tenta di crearli con persist()
     * 3. Se conflitto (altro thread ha creato): recupera quelli esistenti
     */
    @Override
    @Transactional
    public UserSettings getOrCreateSettings(String userId) {
        // Prima prova: lettura semplice (caso comune, settings già esistono)
        Optional<UserSettings> existing = settingsRepository.findByUserId(userId);
        if (existing.isPresent()) {
            log.debug("Settings esistenti trovati per utente: {}", userId);
            return existing.get();
        }

        // Settings non esistono, tenta creazione
        log.info("Creazione settings di default per utente: {}", userId);
        return createOrFetchSettings(userId);
    }

    /**
     * Crea settings o recupera quelli esistenti in caso di conflitto.
     *
     * Usa EntityManager.persist() per forzare INSERT invece di merge().
     * Se un altro thread ha già creato i settings (DataIntegrityViolationException),
     * pulisce la cache e recupera quelli esistenti.
     */
    private UserSettings createOrFetchSettings(String userId) {
        try {
            return createDefaultSettings(userId);
        } catch (DataIntegrityViolationException e) {
            // Un altro thread ha creato i settings - recuperali
            log.debug("Conflitto creazione settings per utente {} - recupero esistenti: {}",
                    userId, e.getMessage());

            // Pulisce la cache dell'EntityManager per evitare dati stale
            entityManager.flush();
            entityManager.clear();

            return settingsRepository.findByUserId(userId)
                    .orElseThrow(() -> new IllegalStateException(
                            "Settings non trovati dopo conflitto per utente: " + userId));
        }
    }

    /**
     * Crea settings di default per un utente.
     *
     * IMPORTANTE: Usa entityManager.persist() invece di repository.save()
     * perché con @MapsId l'entità ha già l'ID impostato e save() userebbe
     * merge() causando StaleObjectStateException.
     */
    private UserSettings createDefaultSettings(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User non trovato: " + userId));

        UserSettings settings = new UserSettings(user);
        settings.setTheme(defaultTheme);
        settings.setLanguage("it");
        settings.setNotificationsEnabled(true);
        settings.setFocusTimerDefaultMinutes(25);
        settings.setAutoBackupEnabled(true);
        settings.setDailyWorkCapacityMinutes(480); // 8 ore

        // CRITICO: persist() forza INSERT, non merge()
        entityManager.persist(settings);
        entityManager.flush();

        log.info("Settings di default creati per utente: {} -> tema={}, lingua={}",
                userId, settings.getTheme(), settings.getLanguage());
        return settings;
    }

    @Override
    @Transactional
    public UserSettings updateSettings(String userId, UpdateUserSettingsRequest request) {
        log.debug("Aggiornamento settings per utente: {}", userId);

        UserSettings settings = getOrCreateSettings(userId);

        boolean changed = false;

        if (request.theme() != null && !request.theme().isBlank()) {
            settings.setTheme(request.theme());
            changed = true;
        }

        if (request.language() != null && !request.language().isBlank()) {
            settings.setLanguage(request.language());
            changed = true;
        }

        if (request.notificationsEnabled() != null) {
            settings.setNotificationsEnabled(request.notificationsEnabled());
            changed = true;
        }

        if (request.focusTimerDefaultMinutes() != null) {
            settings.setFocusTimerDefaultMinutes(request.focusTimerDefaultMinutes());
            changed = true;
        }

        if (request.autoBackupEnabled() != null) {
            settings.setAutoBackupEnabled(request.autoBackupEnabled());
            changed = true;
        }

        if (request.dailyWorkCapacityMinutes() != null) {
            settings.setDailyWorkCapacityMinutes(request.dailyWorkCapacityMinutes());
            changed = true;
        }

        if (changed) {
            settings = settingsRepository.save(settings);
            log.info("Settings aggiornati per utente: {} -> tema={}, lingua={}",
                    userId, settings.getTheme(), settings.getLanguage());
        }

        return settings;
    }

    @Override
    @Transactional
    public UserSettings resetToDefaults(String userId) {
        log.info("Reset settings ai default per utente: {}", userId);

        UserSettings settings = getOrCreateSettings(userId);

        settings.setTheme(defaultTheme);
        settings.setLanguage("it");
        settings.setNotificationsEnabled(true);
        settings.setFocusTimerDefaultMinutes(25);
        settings.setAutoBackupEnabled(true);
        settings.setDailyWorkCapacityMinutes(480);

        return settingsRepository.save(settings);
    }

    @Override
    @Transactional
    public void updateLastBackup(String userId) {
        UserSettings settings = getOrCreateSettings(userId);
        settings.setLastBackupAt(Instant.now());
        settingsRepository.save(settings);
        log.debug("Last backup aggiornato per utente: {}", userId);
    }
}
