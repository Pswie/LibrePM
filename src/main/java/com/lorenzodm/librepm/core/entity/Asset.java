package com.lorenzodm.librepm.core.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import java.time.Instant;

/**
 * Represents a file attachment or digital asset.
 * <p>
 * Assets are stored locally (e.g., in {@code data/assets/}) and their metadata is tracked here.
 * They can be associated with a {@link User} (owner) and optionally linked to a {@link Task}.
 * Supports cloud synchronization via checksums for integrity verification.
 * </p>
 *
 * @author Lorenzo DM
 * @since 1.0.0
 * @version 0.5.2
 */
@Entity
@Table(name = "assets", indexes = {
        @Index(name = "idx_asset_owner", columnList = "owner_id"),
        @Index(name = "idx_asset_created", columnList = "created_at"),
        @Index(name = "idx_asset_type", columnList = "mime_type")
})
@SQLDelete(sql = "UPDATE assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@Where(clause = "deleted_at IS NULL")
public class Asset extends BaseSyncEntity {

    @NotBlank(message = "Nome file obbligatorio")
    @Column(nullable = false, length = 500)
    private String fileName;

    // 768 e non 1000: la colonna è unica, quindi indicizzata, e in utf8mb4 ogni
    // carattere occupa 4 byte. Il limite di una chiave InnoDB è 3072 byte, cioè
    // esattamente 768 caratteri; con 1000 il vincolo di unicità non si crea e su
    // MySQL lo schema resta a metà. Su SQLite la lunghezza è ignorata, quindi i
    // database desktop già in uso non cambiano. Sono percorsi relativi dentro
    // data/assets/: 768 caratteri bastano con abbondanza.
    @NotBlank(message = "Path file obbligatorio")
    @Column(nullable = false, unique = true, length = 768)
    private String filePath; // Relative path in data/assets/

    @Column(length = 100)
    private String mimeType;

    @NotNull(message = "Dimensione file obbligatoria")
    @Column(nullable = false)
    private Long sizeBytes;

    @Column(length = 64)
    private String checksum; // SHA-256 for integrity

    @Column(length = 500)
    private String description;

    @Column(length = 1000)
    private String thumbnailPath; // Generated thumbnail path (for images)

    @Column
    private Instant lastAccessedAt;

    @Column(length = 500)
    private String cloudUrl; // Cloud storage URL (S3, etc.) if synced

    // Relationships

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    // Optional relationship with Task
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    private Task task;

    @Column(name = "updated_at")
    private Instant updatedAt;

    /**
     * Default constructor.
     * Initializes ID via superclass.
     */
    public Asset() {
        super();
    }

    /**
     * Convenience constructor for creating a new asset.
     *
     * @param fileName  The original name of the file.
     * @param filePath  The relative path where the file is stored.
     * @param mimeType  The MIME type of the file.
     * @param sizeBytes The size of the file in bytes.
     * @param owner     The user who owns this asset.
     */
    public Asset(String fileName, String filePath, String mimeType, Long sizeBytes, User owner) {
        this();
        this.fileName = fileName;
        this.filePath = filePath;
        this.mimeType = mimeType;
        this.sizeBytes = sizeBytes;
        this.owner = owner;
    }

    // Getters & Setters

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public String getChecksum() {
        return checksum;
    }

    public void setChecksum(String checksum) {
        this.checksum = checksum;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getThumbnailPath() {
        return thumbnailPath;
    }

    public void setThumbnailPath(String thumbnailPath) {
        this.thumbnailPath = thumbnailPath;
    }

    public Instant getLastAccessedAt() {
        return lastAccessedAt;
    }

    public void setLastAccessedAt(Instant lastAccessedAt) {
        this.lastAccessedAt = lastAccessedAt;
    }

    public String getCloudUrl() {
        return cloudUrl;
    }

    public void setCloudUrl(String cloudUrl) {
        this.cloudUrl = cloudUrl;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    @Override
    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    // Helper methods

    /**
     * Checks if the asset is an image based on its MIME type.
     * @return true if it's an image.
     */
    public boolean isImage() {
        if (mimeType == null) return false;
        return mimeType.startsWith("image/");
    }

    /**
     * Checks if the asset is a document (PDF, Word, Excel, etc.).
     * @return true if it's a document.
     */
    public boolean isDocument() {
        if (mimeType == null) return false;
        return mimeType.contains("pdf") ||
                mimeType.contains("document") ||
                mimeType.contains("word") ||
                mimeType.contains("excel") ||
                mimeType.contains("powerpoint");
    }

    /**
     * Formats the file size into a human-readable string (e.g., "1.5 MB").
     * @return Formatted size string.
     */
    public String getFormattedSize() {
        if (sizeBytes == null) return "0 B";

        if (sizeBytes < 1024) {
            return sizeBytes + " B";
        } else if (sizeBytes < 1024 * 1024) {
            return String.format("%.1f KB", sizeBytes / 1024.0);
        } else if (sizeBytes < 1024 * 1024 * 1024) {
            return String.format("%.1f MB", sizeBytes / (1024.0 * 1024));
        } else {
            return String.format("%.2f GB", sizeBytes / (1024.0 * 1024 * 1024));
        }
    }

    /**
     * Extracts the file extension from the file name.
     * @return The file extension (lowercase) or empty string.
     */
    public String getFileExtension() {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf(".") + 1).toLowerCase();
    }

    /**
     * Updates the last accessed timestamp to the current time.
     */
    public void markAsAccessed() {
        this.lastAccessedAt = Instant.now();
    }

    @Override
    public String toString() {
        return "Asset{" +
                "id='" + getId() + '\'' +
                ", fileName='" + fileName + '\'' +
                ", mimeType='" + mimeType + '\'' +
                ", size=" + getFormattedSize() +
                '}';
    }
}
