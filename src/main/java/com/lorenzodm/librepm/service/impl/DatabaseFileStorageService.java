package com.lorenzodm.librepm.service.impl;

import com.lorenzodm.librepm.api.exception.BadRequestException;
import com.lorenzodm.librepm.api.exception.ResourceNotFoundException;
import com.lorenzodm.librepm.service.FileStorageService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;

/**
 * Gli allegati conservati nel database. <strong>Sempre, ovunque.</strong>
 *
 * <p><strong>Perché.</strong> Nel profilo {@code cloud} la configurazione
 * mandava i file in {@code /tmp/librepm}, e il commento accanto diceva il vero:
 * su Cloud Run il filesystem è effimero e la home può non essere scrivibile. Ma
 * {@code /tmp} lì è un disco in memoria — sparisce a ogni riavvio dell'istanza
 * <em>e</em> consuma la RAM del contenitore, quindi un allegato grosso non si
 * limita a svanire: può far morire il servizio.
 *
 * <p><strong>Perché anche sul desktop, dove il disco è vero.</strong> Perché un
 * allegato che sta in un posto diverso a seconda di dove gira il programma è un
 * allegato che si perde nel passaggio: il backup del database non se lo porta
 * dietro, la sincronizzazione fra locale e cloud nemmeno, e chi esporta i dati
 * si ritrova le righe senza i file. Un posto solo significa che «ho una copia
 * del database» vuol dire davvero avere tutto.
 *
 * <p><strong>Non è il posto definitivo.</strong> Un archivio oggetti (S3, R2,
 * Scaleway) lo è. Ma è un fornitore in più, un contratto di trattamento dati in
 * più e una regione in più da verificare; nel frattempo il database sopravvive
 * ai riavvii, finisce nei backup ed è già dove stanno i dati.
 *
 * <p>{@link LocalFileStorageService} resta nel codice ma non è più un bean: la
 * sua storia è nel commento che porta.
 */
@Service
public class DatabaseFileStorageService implements FileStorageService {

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${librepm.assets.allowed-extensions}")
    private String allowedExtensionsCsv;

    @Value("${librepm.assets.max-file-size:-1}")
    private long maxFileSize;

    @Override
    @Transactional
    public StoredFile store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File vuoto o mancante");
        }
        if (maxFileSize > 0 && file.getSize() > maxFileSize) {
            throw new BadRequestException("File troppo grande: " + file.getSize() + " bytes");
        }

        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.bin";
        String cleaned = sanitizeFileName(original);
        String ext = getExtension(cleaned);
        if (!isAllowedExtension(ext)) {
            throw new BadRequestException("Estensione non consentita: " + ext);
        }

        try {
            byte[] content = file.getBytes();
            String checksum = sha256(content);
            // Stesso schema di nome di LocalFileStorageService: chi legge
            // `assets.file_path` non deve accorgersi di quale delle due
            // implementazioni ha scritto.
            String relative = UUID.randomUUID() + "-" + cleaned;

            entityManager.createNativeQuery(
                    "INSERT INTO asset_blobs "
                    + "(file_path, original_file_name, mime_type, size_bytes, checksum_sha256, content, created_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?)")
                    .setParameter(1, relative)
                    .setParameter(2, cleaned)
                    .setParameter(3, file.getContentType())
                    .setParameter(4, (long) content.length)
                    .setParameter(5, checksum)
                    .setParameter(6, content)
                    .setParameter(7, LocalDateTime.now())
                    .executeUpdate();

            // `absolutePath` resta null: un file nel database non ha un
            // percorso. Nessun chiamante lo usa — è un residuo dell'interfaccia,
            // nata quando lo storage su disco era l'unico previsto.
            return new StoredFile(relative, cleaned, file.getContentType(),
                    content.length, checksum, null);

        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Errore salvataggio file nel database", e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Resource loadAsResource(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            throw new BadRequestException("Path non valido");
        }
        try {
            byte[] content = (byte[]) entityManager
                    .createNativeQuery("SELECT content FROM asset_blobs WHERE file_path = ?")
                    .setParameter(1, relativePath)
                    .getSingleResult();
            return new ByteArrayResource(content);
        } catch (NoResultException e) {
            throw new ResourceNotFoundException("File non trovato: " + relativePath);
        }
    }

    private boolean isAllowedExtension(String ext) {
        if (ext.isBlank()) return false;
        return Arrays.stream(allowedExtensionsCsv.split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT))
                .anyMatch(a -> a.equals(ext.toLowerCase(Locale.ROOT)));
    }

    private String sanitizeFileName(String name) {
        String cleaned = StringUtils.cleanPath(name);
        cleaned = cleaned.replace("\\", "_").replace("/", "_");
        if (cleaned.length() > 200) {
            cleaned = cleaned.substring(cleaned.length() - 200);
        }
        return cleaned;
    }

    private String getExtension(String fileName) {
        int idx = fileName.lastIndexOf('.');
        if (idx < 0 || idx == fileName.length() - 1) return "";
        return fileName.substring(idx + 1).toLowerCase(Locale.ROOT);
    }

    private String sha256(byte[] content) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(content);
        StringBuilder sb = new StringBuilder(digest.length * 2);
        for (byte b : digest) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
