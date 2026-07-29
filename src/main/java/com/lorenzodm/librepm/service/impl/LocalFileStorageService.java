package com.lorenzodm.librepm.service.impl;

import com.lorenzodm.librepm.api.exception.BadRequestException;
import com.lorenzodm.librepm.api.exception.ResourceNotFoundException;
import com.lorenzodm.librepm.service.FileStorageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;

/**
 * Gli allegati su disco.
 *
 * <p>Fuori dal profilo {@code cloud}, cioè dove il disco è vero e sopravvive ai
 * riavvii: il desktop scrive sotto la home dell'utente ed è la scelta giusta.
 *
 * <p>Su Cloud Run subentra {@link DatabaseFileStorageService}, perché lì
 * {@code /tmp} è un disco in memoria che sparisce a ogni riavvio dell'istanza e
 * consuma la RAM del contenitore. Le due implementazioni non convivono mai —
 * senza questo profilo Spring troverebbe due candidati per la stessa
 * interfaccia e non partirebbe.
 */
@Service
@Profile("!cloud")
public class LocalFileStorageService implements FileStorageService {

    @Value("${librepm.assets.storage-path}")
    private String storagePath;

    @Value("${librepm.assets.allowed-extensions}")
    private String allowedExtensionsCsv;

    @Value("${librepm.assets.max-file-size:-1}")
    private long maxFileSize;

    @Override
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
            Path root = Paths.get(storagePath);
            Files.createDirectories(root);

            String id = UUID.randomUUID().toString();
            String targetName = id + "-" + cleaned;
            Path target = root.resolve(targetName);

            // Copia file
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }

            // Checksum SHA-256
            String checksum = sha256(target);

            // path relativo (coerente con Asset.filePath)
            // Nota: salviamo solo il nome file o un path relativo alla root di storage
            // Qui assumiamo che 'assets/' sia un prefisso virtuale o una sottocartella
            // Per semplicità, salviamo il nome file come path relativo se è nella root
            String relative = targetName; 

            return new StoredFile(
                    relative,
                    cleaned,
                    file.getContentType(),
                    file.getSize(),
                    checksum,
                    target
            );

        } catch (Exception e) {
            throw new IllegalStateException("Errore salvataggio file su disco", e);
        }
    }

    @Override
    public Resource loadAsResource(String relativePath) {
        try {
            Path root = Paths.get(storagePath);
            Path file = root.resolve(relativePath).normalize();
            
            // Security check: prevent path traversal
            if (!file.startsWith(root)) {
                throw new BadRequestException("Path non valido");
            }

            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() || resource.isReadable()) {
                return resource;
            } else {
                throw new ResourceNotFoundException("File non trovato o non leggibile: " + relativePath);
            }
        } catch (MalformedURLException e) {
            throw new BadRequestException("Path non valido: " + e.getMessage());
        }
    }

    private boolean isAllowedExtension(String ext) {
        if (ext.isBlank()) return false;
        String[] allowed = allowedExtensionsCsv.split(",");
        return Arrays.stream(allowed)
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

    private String sha256(Path file) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream is = Files.newInputStream(file, StandardOpenOption.READ)) {
            byte[] buf = new byte[8192];
            int r;
            while ((r = is.read(buf)) > 0) {
                md.update(buf, 0, r);
            }
        }
        byte[] digest = md.digest();
        StringBuilder sb = new StringBuilder(digest.length * 2);
        for (byte b : digest) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
