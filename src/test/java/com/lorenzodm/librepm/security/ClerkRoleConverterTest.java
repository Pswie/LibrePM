package com.lorenzodm.librepm.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ClerkRoleConverterTest {

    private final ClerkProperties properties = new ClerkProperties();

    private List<String> roles(Jwt jwt) {
        return new ClerkRoleConverter(properties).convert(jwt).getAuthorities().stream()
                .map(GrantedAuthority::getAuthority).distinct().toList();
    }

    private Jwt.Builder legacyPresident() {
        return Jwt.withTokenValue("synthetic-unit-value").header("alg", "RS256")
                .subject("synthetic-user")
                .claim("role", "presidente")
                .claim("roles", List.of("admin"))
                .claim("org_role", "org:admin")
                .claim("public_metadata", Map.of("role", "presidente", "roles", List.of("admin")));
    }

    @Test
    void organizationMemberRevokesEveryLegacyAdministrativeRole() {
        assertThat(roles(legacyPresident().claim("o", Map.of("rol", "member")).build()))
                .containsExactly("ROLE_SOCIO");
    }

    @Test
    void explicitNullOrganizationRoleDoesNotFallBackToOldMetadata() {
        Map<String, Object> organization = new HashMap<>();
        organization.put("rol", null);
        assertThat(roles(legacyPresident().claim("o", organization).build())).isEmpty();
    }

    @Test
    void unknownOrganizationRoleDoesNotFallBackToOldMetadata() {
        assertThat(roles(legacyPresident().claim("o", Map.of("rol", "unrecognized-role")).build()))
                .isEmpty();
    }

    @Test
    void malformedOrganizationRoleDoesNotFallBackToOldMetadata() {
        assertThat(roles(legacyPresident().claim("o", Map.of("rol", 42)).build())).isEmpty();
    }

    @Test
    void blankOrganizationRoleDoesNotFallBackToOldMetadata() {
        assertThat(roles(legacyPresident().claim("o", Map.of("rol", " ")).build())).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({"admin,ROLE_PRESIDENTE", "org:admin,ROLE_PRESIDENTE", "member,ROLE_SOCIO", "org:member,ROLE_SOCIO", "presidente,ROLE_PRESIDENTE"})
    void supportedOrganizationRolesKeepTheirExistingMappings(String organizationRole, String authority) {
        assertThat(roles(legacyPresident().claim("o", Map.of("rol", organizationRole)).build()))
                .containsExactly(authority);
    }

    @Test
    void missingOrganizationClaimPreservesLegacyRoles() {
        assertThat(roles(legacyPresident().build())).containsExactly("ROLE_PRESIDENTE");
    }

    @Test
    void organizationWithoutRolePreservesLegacyRoles() {
        assertThat(roles(legacyPresident().claim("o", Map.of("id", "synthetic-org")).build()))
                .containsExactly("ROLE_PRESIDENTE");
    }

    @Test
    void configuredLegacyClaimAndNormalizationRemainSupported() {
        properties.setRoleClaims(List.of("app_role"));
        Jwt jwt = Jwt.withTokenValue("synthetic-unit-value").header("alg", "RS256")
                .subject("synthetic-user").claim("app_role", "Coordinatore_Servizi").build();
        assertThat(roles(jwt)).containsExactly("ROLE_COORDINATORE_SERVIZI");
    }
}
