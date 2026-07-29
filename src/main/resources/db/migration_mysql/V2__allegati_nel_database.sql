-- Il contenuto degli allegati dentro il database.
--
-- ---------------------------------------------------------------------------
-- Il problema, che era già noto
-- ---------------------------------------------------------------------------
-- Nel profilo `cloud` la configurazione dice:
--
--     # Su Cloud Run il filesystem è effimero e la home può non essere scrivibile.
--     data:
--       path: ${LIBREPM_DATA_PATH:/tmp/librepm}
--
-- Il commento è esatto e la scelta era consapevole: `/tmp` è l'unico posto
-- scrivibile. Ma su Cloud Run `/tmp` è un disco in memoria — sparisce a ogni
-- riavvio dell'istanza **e** consuma la RAM del contenitore, quindi un allegato
-- grosso non si limita a svanire: può far morire il servizio.
--
-- `assets.file_path` continuava a indicare un file che dopo il primo riavvio
-- non c'era più.
--
-- ---------------------------------------------------------------------------
-- Perché solo su MySQL
-- ---------------------------------------------------------------------------
-- Questa tabella serve dove il disco non sopravvive. Nel profilo desktop
-- LibrePM gira su SQLite con una cartella vera sotto la home dell'utente: lì
-- `LocalFileStorageService` è la scelta giusta e non si tocca. Per questo la
-- gemella in `db/migration` non esiste — non è una dimenticanza.
--
-- ---------------------------------------------------------------------------
-- Perché una tabella separata da `assets`
-- ---------------------------------------------------------------------------
-- Se i byte stessero in `assets`, ogni elenco degli allegati di un progetto se
-- li trascinerebbe dietro anche mostrando solo nome e dimensione. Qui la riga
-- di `assets` resta leggera e il contenuto si legge solo quando qualcuno lo
-- scarica davvero.
--
-- Il legame è `file_path`, non `asset_id`: è la chiave che
-- `FileStorageService` già restituisce e con cui `loadAsResource` già cerca. Il
-- contenuto viene scritto prima che l'`Asset` esista, quindi un `asset_id` in
-- quel momento non ci sarebbe.

CREATE TABLE `asset_blobs` (
  `id` bigint NOT NULL AUTO_INCREMENT,

  -- Lo stesso valore che finisce in `assets.file_path`: il nome generato dal
  -- servizio di storage, non un percorso scelto da chi carica.
  `file_path` varchar(768) NOT NULL,

  `original_file_name` varchar(255) NOT NULL,
  `mime_type` varchar(128) DEFAULT NULL,
  `size_bytes` bigint NOT NULL,
  `checksum_sha256` varchar(64) NOT NULL,

  -- LONGBLOB e non BLOB: BLOB si ferma a 64 KB, meno di una pagina scansionata.
  -- Il limite vero lo mette `librepm.assets.max-file-size`, non il tipo.
  `content` longblob NOT NULL,

  `created_at` datetime(6) DEFAULT NULL,

  PRIMARY KEY (`id`),
  -- Un percorso, un contenuto. Il nome contiene un UUID, quindi una collisione
  -- significherebbe un errore di generazione: meglio che il vincolo lo dica.
  UNIQUE KEY `ux_asset_blobs_file_path` (`file_path`),
  KEY `ix_asset_blobs_checksum` (`checksum_sha256`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
