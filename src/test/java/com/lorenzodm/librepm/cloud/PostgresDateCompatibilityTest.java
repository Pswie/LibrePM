package com.lorenzodm.librepm.cloud;

import com.lorenzodm.librepm.core.converter.InstantAttributeConverter;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.assertj.core.api.Assertions.assertThat;

class PostgresDateCompatibilityTest {
    @Test
    void acceptsPostgresOffsetsAndKeepsExistingDesktopFormats() {
        var converter = new InstantAttributeConverter();
        assertThat(converter.convertToEntityAttribute("2026-10-30 12:00:00+00")).isEqualTo(Instant.parse("2026-10-30T12:00:00Z"));
        assertThat(converter.convertToEntityAttribute("2026-10-30 13:00:00.123456+01")).isEqualTo(Instant.parse("2026-10-30T12:00:00.123456Z"));
        assertThat(converter.convertToEntityAttribute("2026-10-30 12:00:00")).isEqualTo(Instant.parse("2026-10-30T12:00:00Z"));
        assertThat(converter.convertToEntityAttribute("2026-10-30T12:00:00Z")).isEqualTo(Instant.parse("2026-10-30T12:00:00Z"));
    }
}
