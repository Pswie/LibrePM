package com.lorenzodm.librepm.core.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * JPA Attribute Converter per Instant <-> String (SQLite TEXT)
 *
 * SQLite non ha un tipo TIMESTAMP/DATETIME nativo, salva tutto come TEXT.
 * Hibernate con @UpdateTimestamp/@CreationTimestamp usa Instant, che di default
 * viene salvato come epoch milliseconds causando errori di parsing.
 *
 * Questo converter gestisce la conversione bidirezionale.
 *
 * Formati supportati in lettura:
 * - yyyy-MM-dd'T'HH:mm:ss'Z' (ISO 8601 UTC)
 * - yyyy-MM-dd'T'HH:mm:ss.SSS'Z' (ISO 8601 UTC con millisecondi)
 * - yyyy-MM-dd HH:mm:ss (SQLite standard)
 * - yyyy-MM-dd HH:mm:ss.SSS (SQLite con millisecondi)
 * - Epoch milliseconds (es. "1769607872740")
 *
 * Formato scrittura: yyyy-MM-dd HH:mm:ss (compatibile SQLite)
 *
 * @author Lorenzo DM
 * @since 0.3.1
 */
@Converter(autoApply = true)
public class InstantAttributeConverter implements AttributeConverter<Instant, String> {

    private static final DateTimeFormatter SQLITE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter SQLITE_FORMAT_MS =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");
    private static final DateTimeFormatter ISO_UTC_FORMAT =
            DateTimeFormatter.ISO_INSTANT;

    @Override
    public String convertToDatabaseColumn(Instant attribute) {
        if (attribute == null) {
            return null;
        }
        // Salva in formato SQLite standard: yyyy-MM-dd HH:mm:ss
        LocalDateTime ldt = LocalDateTime.ofInstant(attribute, ZoneOffset.UTC);
        return ldt.format(SQLITE_FORMAT);
    }

    @Override
    public Instant convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }

        String trimmed = dbData.trim();

        // 1. Prova epoch milliseconds (solo numeri)
        if (trimmed.matches("^\\d+$")) {
            try {
                long epoch = Long.parseLong(trimmed);
                return Instant.ofEpochMilli(epoch);
            } catch (NumberFormatException e) {
                // Continua con altri formati
            }
        }

        // 2. Prova formato ISO 8601 UTC (yyyy-MM-dd'T'HH:mm:ss'Z' o con millisecondi)
        try {
            return Instant.parse(trimmed);
        } catch (DateTimeParseException e) {
            // Continua con altri formati
        }

        // PostgreSQL CURRENT_TIMESTAMP cast to a text column may include a
        // numeric offset (including the short +00 form). Preserve its instant.
        try {
            String offsetTimestamp = trimmed.replace(' ', 'T').replaceFirst("([+-]\\d{2})$", "$1:00");
            return OffsetDateTime.parse(offsetTimestamp, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toInstant();
        } catch (DateTimeParseException e) {
            // Continue with legacy SQLite/MySQL representations.
        }

        // 3. Prova formato SQLite standard (yyyy-MM-dd HH:mm:ss)
        try {
            LocalDateTime ldt = LocalDateTime.parse(trimmed, SQLITE_FORMAT);
            return ldt.toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException e) {
            // Continua
        }

        // 4. Prova formato SQLite con millisecondi (yyyy-MM-dd HH:mm:ss.SSS)
        try {
            LocalDateTime ldt = LocalDateTime.parse(trimmed, SQLITE_FORMAT_MS);
            return ldt.toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException e) {
            // Continua
        }

        // 5. Prova con millisecondi variabili (rimuovi parte dopo il punto)
        try {
            if (trimmed.contains(".")) {
                String withoutMs = trimmed.substring(0, trimmed.indexOf('.'));
                LocalDateTime ldt = LocalDateTime.parse(withoutMs, SQLITE_FORMAT);
                return ldt.toInstant(ZoneOffset.UTC);
            }
        } catch (Exception e) {
            // Ignora
        }

        // 6. Prova solo data con ora implicita (yyyy-MM-dd)
        try {
            if (trimmed.length() == 10) {
                LocalDateTime ldt = LocalDateTime.parse(trimmed + " 00:00:00", SQLITE_FORMAT);
                return ldt.toInstant(ZoneOffset.UTC);
            }
        } catch (DateTimeParseException e) {
            // Ignora
        }

        // Se tutto fallisce, logga e ritorna null
        System.err.println("[InstantConverter] Impossibile parsare timestamp: '" + dbData + "'");
        return null;
    }
}
