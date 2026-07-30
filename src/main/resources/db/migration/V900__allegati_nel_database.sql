-- Il contenuto degli allegati dentro il database, anche in locale.
--
-- Gemella SQLite di V2__allegati_nel_database.sql (serie MySQL).
--
-- ---------------------------------------------------------------------------
-- Perché anche qui, dove il disco è vero
-- ---------------------------------------------------------------------------
-- Su Cloud Run la ragione era ovvia: i file finivano in /tmp, un disco in
-- memoria che sparisce a ogni riavvio e consuma la RAM del contenitore.
--
-- Sul desktop il disco esiste davvero e sopravvive. La ragione è un'altra: un
-- allegato che sta in un posto diverso a seconda di dove gira il programma è un
-- allegato che si perde nel passaggio. Il backup del database non se lo porta
-- dietro, la sincronizzazione fra locale e cloud nemmeno, e chi esporta i dati
-- si ritrova le righe senza i file.
--
-- Con un posto solo, «ho una copia del database» vuol dire davvero avere tutto.
--
-- ---------------------------------------------------------------------------
-- Perché il numero 900
-- ---------------------------------------------------------------------------
-- Questo è un fork con un upstream attivo. Monte è arrivato a V62; la V63 di
-- questo ramo ci si è appoggiata sopra, e il giorno che monte aggiunge una sua
-- V63 Flyway trova due file con la stessa versione e si rifiuta di partire.
--
-- Dalla 900 in su lo spazio è riservato a questo fork: monte non ci arriverà
-- mai, e i merge restano puliti. La V63 non si può rinumerare — è già
-- applicata, e cambiarle versione la farebbe riapplicare — ma da qui in avanti
-- si usa questo intervallo.
--
-- Dialetto: BLOB invece di longblob (SQLite non distingue le dimensioni),
-- INTEGER PRIMARY KEY AUTOINCREMENT, niente ENGINE né COLLATE.

CREATE TABLE IF NOT EXISTS asset_blobs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Lo stesso valore che finisce in `assets.file_path`: il nome generato dal
    -- servizio di storage, non un percorso scelto da chi carica.
    file_path           VARCHAR(768) NOT NULL,

    original_file_name  VARCHAR(255) NOT NULL,
    mime_type           VARCHAR(128),
    size_bytes          INTEGER NOT NULL,
    checksum_sha256     VARCHAR(64) NOT NULL,
    content             BLOB NOT NULL,

    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Un percorso, un contenuto. Il nome contiene un UUID: una collisione
    -- vorrebbe dire un errore di generazione, ed è meglio che il vincolo lo dica.
    UNIQUE (file_path)
);

CREATE INDEX IF NOT EXISTS idx_asset_blobs_checksum ON asset_blobs(checksum_sha256);
