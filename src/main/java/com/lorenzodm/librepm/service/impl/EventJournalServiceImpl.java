package com.lorenzodm.librepm.service.impl;

import com.lorenzodm.librepm.core.entity.EventJournalEntry;
import com.lorenzodm.librepm.repository.EventJournalRepository;
import com.lorenzodm.librepm.service.EventJournalService;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@Transactional
public class EventJournalServiceImpl implements EventJournalService {

    private static final Logger log = LoggerFactory.getLogger(EventJournalServiceImpl.class);
    private static final int DEFAULT_RETENTION_DAYS = 90;

    private final EventJournalRepository repository;

    public EventJournalServiceImpl(EventJournalRepository repository) {
        this.repository = repository;
    }

    @Override
    public void record(String eventType, String entityType, String entityId, String payload, String userId) {
        EventJournalEntry entry = new EventJournalEntry();
        entry.setEventType(eventType);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setPayload(payload);
        entry.setUserId(userId);
        entry.setTimestamp(Instant.now());
        repository.save(entry);
    }

    @Override
    public List<EventJournalEntry> query(Instant from, Instant to, List<String> eventTypes, int limit) {
        List<EventJournalEntry> results;
        if (eventTypes != null && !eventTypes.isEmpty()) {
            results = repository.findByEventTypeInAndTimestampBetweenOrderByTimestampDesc(eventTypes, from, to);
        } else {
            results = repository.findByTimestampBetweenOrderByTimestampDesc(from, to);
        }
        if (limit > 0 && results.size() > limit) {
            return results.subList(0, limit);
        }
        return results;
    }

    @Override
    public List<EventJournalEntry> recent(int limit) {
        Instant from = Instant.now().minus(30, ChronoUnit.DAYS);
        List<EventJournalEntry> results = repository.findByTimestampBetweenOrderByTimestampDesc(from, Instant.now());
        if (limit > 0 && results.size() > limit) {
            return results.subList(0, limit);
        }
        return results;
    }

    @Override
    public int cleanup(int retentionDays) {
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        int deleted = repository.deleteOlderThan(cutoff);
        if (deleted > 0) {
            log.info("Event journal cleanup: removed {} entries older than {} days", deleted, retentionDays);
        }
        return deleted;
    }

    /**
     * La pulizia automatica del giornale eventi.
     *
     * <p><strong>Spenta per impostazione predefinita.</strong> Girava ogni notte
     * alle tre e cancellava tutto quello che aveva più di
     * {@value #DEFAULT_RETENTION_DAYS} giorni — una scelta di conservazione
     * scritta nel codice da chi ha realizzato il programma, non dall'ente che lo
     * usa. Qui i dati si tengono finché una persona non decide di toglierli,
     * quindi una cancellazione che avviene da sola alle tre di notte è
     * esattamente ciò che non deve succedere.
     *
     * <p>Il metodo {@link #cleanup(int)} resta e funziona: si chiama quando lo
     * si vuole, con il numero di giorni che si vuole. È la differenza fra una
     * cancellazione decisa e una che capita.
     *
     * <p>Per riaccenderla basta {@code librepm.event-journal.cleanup-cron} nella
     * configurazione. Il valore predefinito {@code -} è la disattivazione
     * prevista da Spring, non un espediente.
     */
    @Scheduled(cron = "${librepm.event-journal.cleanup-cron:-}")
    public void scheduledCleanup() {
        cleanup(DEFAULT_RETENTION_DAYS);
    }
}
