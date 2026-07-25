package com.lorenzodm.librepm.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Configurazione dell'identity provider Clerk per il profilo {@code cloud}.
 *
 * <p>Il backend non gestisce credenziali: riceve un JWT firmato da Clerk e ne
 * verifica la firma contro il JWKS pubblicato dall'issuer. Qui non compare
 * nessun segreto, solo indirizzi pubblici.
 *
 * <p>I valori vanno tenuti allineati a quelli del gestionale
 * ({@code associago.clerk}): LibrePM è la sezione bandi della stessa
 * associazione e usa la stessa istanza Clerk, così un unico accesso vale per
 * entrambe le sezioni.
 *
 * @since 0.2.0
 */
@Component
@ConfigurationProperties(prefix = "librepm.clerk")
public class ClerkProperties {

    /**
     * Issuer del token, cioè la Frontend API dell'istanza Clerk
     * (es. {@code https://<slug>.clerk.accounts.dev}). Spring risolve da qui
     * {@code /.well-known/openid-configuration} e quindi il JWKS.
     */
    private String issuerUri = "";

    /**
     * Audience attesa nel token. Vuota disattiva il controllo: accettabile solo
     * se l'istanza Clerk serve esclusivamente questa associazione.
     */
    private String audience = "";

    /**
     * Claim da cui leggere il ruolo, in ordine di preferenza. Clerk non ha un
     * claim di ruolo standard: dipende da come è configurato il session token
     * template, per questo l'elenco è configurabile.
     */
    private List<String> roleClaims = new ArrayList<>(List.of("role", "roles", "org_role"));

    /**
     * Ruoli ammessi. Sono gli stessi del sito ({@code sito/src/data/admin.ts}) e
     * del gestionale: un ruolo presente nel token ma assente da questo elenco
     * non concede nessuna autorizzazione.
     *
     * <p>{@code socio} e {@code volontario} compaiono di proposito senza avere
     * accesso ad alcuna API: la governance dei progetti non li riguarda, ma un
     * loro token resta un token valido e non deve essere confuso con uno rotto.
     */
    private List<String> knownRoles = new ArrayList<>(List.of(
            "presidente",
            "coordinatore-servizi",
            "psicologo",
            "operatore-alimentare",
            "orientatore-servizi",
            "facilitatore-digitale",
            "responsabile-amministrativo",
            "referente-volontari",
            "socio",
            "volontario"
    ));

    public String getIssuerUri() {
        return issuerUri;
    }

    public void setIssuerUri(String issuerUri) {
        this.issuerUri = issuerUri;
    }

    public String getAudience() {
        return audience;
    }

    public void setAudience(String audience) {
        this.audience = audience;
    }

    public List<String> getRoleClaims() {
        return roleClaims;
    }

    public void setRoleClaims(List<String> roleClaims) {
        this.roleClaims = roleClaims;
    }

    public List<String> getKnownRoles() {
        return knownRoles;
    }

    public void setKnownRoles(List<String> knownRoles) {
        this.knownRoles = knownRoles;
    }
}
