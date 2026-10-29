package com.lorenzodm.librepm.api.validation;

import com.lorenzodm.librepm.api.exception.BadRequestException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

/** Validation for the existing map-based finance and grant API payloads. */
public final class RequestValues {
    private RequestValues() {}

    public static double amount(Map<String, Object> body, String field) {
        Object value = body.get(field);
        if (!(value instanceof Number number) || !Double.isFinite(number.doubleValue()) || number.doubleValue() < 0) {
            throw new BadRequestException(field + " deve essere un importo numerico non negativo");
        }
        return number.doubleValue();
    }

    public static String requiredText(Map<String, Object> body, String field) {
        Object value = body.get(field);
        if (!(value instanceof String text) || text.isBlank()) {
            throw new BadRequestException(field + " è obbligatorio");
        }
        return text.trim();
    }

    public static LocalDate date(Map<String, Object> body, String field) {
        String value = requiredText(body, field);
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            throw new BadRequestException(field + " deve essere una data ISO valida (YYYY-MM-DD)");
        }
    }

    public static void orderedDates(LocalDate start, LocalDate end) {
        if (start == null || end == null || start.isAfter(end)) {
            throw new BadRequestException("La data iniziale deve precedere o coincidere con la data finale");
        }
    }
}
