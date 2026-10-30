# LibrePM su PostgreSQL e Supabase

Preparazione del 30 ottobre 2026. L'utente ha confermato che Aiven non conteneva dati: si inizializza quindi un database nuovo, senza esportazioni o recuperi da Aiven. Nessuna risorsa Supabase reale è stata creata, collegata o modificata durante questo lavoro.

Il backend resta Spring Boot su Google Cloud Run e l'accesso resta Clerk. Supabase fornisce PostgreSQL; non serve introdurre un secondo login o un client Supabase nel browser. Le API e i collegamenti con AssociaGo e Bandi rimangono gli stessi.

## Cosa è stato preparato

- Profilo esplicito `cloud-postgres`, che include automaticamente `cloud` e ne conserva autenticazione, ruoli e CORS.
- Driver JDBC PostgreSQL 42.7.14 e modulo PostgreSQL per Flyway, allineato alla versione Flyway gestita dal progetto.
- Migrazioni PostgreSQL isolate in `db/migration_postgresql`: 100 tabelle applicative, indici, unicità e chiavi esterne. Le migrazioni MySQL e SQLite precedenti restano invariate e utilizzabili con i rispettivi profili.
- Schema privato `librepm`, distinto da quello AssociaGo anche quando i due backend usano lo stesso progetto Supabase. Nessuna tabella applicativa viene creata in `public`.
- Utente migrator/owner separabile dall'utente applicativo. Il primo modifica la struttura, il secondo legge e scrive i dati senza permessi DDL. I permessi sulla cronologia Flyway vanno revocati all'utente applicativo dopo le migrazioni.
- Allegati in colonne `bytea`, con checksum e metadati esistenti; nessun uso di large object/OID PostgreSQL. Due descrizioni testuali precedentemente annotate `@Lob` ora usano testo normale su tutti i motori.
- Indici unici su `lower(username)` e `lower(email)` per mantenere l'identità indipendente dalle maiuscole. Gli identificativi opachi e le revisioni della suite conservano invece il confronto esatto.
- ID, date convertite e JSON conservati nelle rappresentazioni stringa previste dal codice. Non si trasformano arbitrariamente in UUID nativi identificativi come `wp-personal`, `role-owner` e `ts-todo`.
- Metadati iniziali controllati: stati e priorità delle attività, ruoli e permessi applicativi, sette profili di lavoro e calendario standard. Nessun utente, password utilizzabile, progetto, socio o movimento viene inventato.
- Diagnostica compatibile con PostgreSQL e ruolo runtime limitato. La mancata lettura della cronologia migrazioni non segnala il database come guasto.

Le chiavi esterne sono installate dopo la creazione delle tabelle e possono essere differite in una transazione controllata. Questo rende possibile un eventuale import futuro senza disattivare controlli o trigger; nel lavoro attuale non occorre trasferire dati.

## Attivazione successiva su Supabase

La configurazione di esempio senza segreti è [.env.postgres.example](.env.postgres.example). I valori reali vanno impostati nell'ambiente del backend o in Secret Manager: il file non viene caricato automaticamente da Java.

1. Preparare nel progetto Supabase lo schema `librepm` e due ruoli separati, per esempio `librepm_owner` e `librepm_app`. Il bootstrap coordinato delle due applicazioni è nella repository AssociaGo, in `scripts/supabase/`.
2. Escludere gli schemi applicativi dagli schemi esposti tramite Data API. Non concedere `USAGE` o accesso alle tabelle a `PUBLIC`, `anon` o `authenticated`; le richieste utente passano dal backend che applica l'autorizzazione Clerk. Se in futuro si vuole esporre direttamente una tabella, occorre un progetto di permessi e RLS specifico.
3. Impostare `SPRING_PROFILES_ACTIVE=cloud-postgres`, URL JDBC PostgreSQL e credenziali runtime. Configurare separatamente `LIBREPM_MIGRATION_URL`, `LIBREPM_MIGRATION_USERNAME` e `LIBREPM_MIGRATION_PASSWORD` per Flyway. Se omessi, Flyway eredita le credenziali principali: un runtime privo di DDL non può inizializzare uno schema nuovo.
4. Usare TLS con verifica del certificato e il certificato CA appropriato al collegamento scelto. Gli esempi contengono `HOST` e un percorso CA segnaposto, da sostituire con i valori del progetto.
5. Per Java/Hikari preferire connessione diretta o pooler in modalità sessione. Le migrazioni richiedono una sessione stabile; se in seguito si sceglie un pooler in modalità transazione per il solo runtime, vanno verificate le limitazioni e, per il pooler condiviso, disabilitate le prepared statement JDBC con `prepareThreshold=0`. Non copiare automaticamente la stessa URL di un'app Node nel backend Java. [Documentazione connessioni Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
6. Mantenere `CLERK_ISSUER_URI`, `CLERK_AUDIENCE`, `CORS_ALLOWED_ORIGINS` e variabili `SUITE_*` già previste. Primo accesso reale con un account Clerk invitato e autorizzato; l'utente interno viene collegato/creato dal flusso esistente, non da una credenziale di esempio.
7. Applicare il bootstrap/finalizzazione dei privilegi e collaudare una revisione senza traffico principale. Promuoverla solo dopo aver verificato salute, login, progetto, attività, allegati e scambio fra applicazioni.

Il pool runtime parte da massimo tre connessioni, minimo zero. Il limite totale dipende anche dal numero di istanze Cloud Run e dagli altri backend che condividono PostgreSQL; va dimensionato sul piano realmente scelto. Cambiare profilo non trasferisce automaticamente righe da un motore all'altro.

## Verifiche

Risultato locale finale: **107 test passati su 107, nessuna prova saltata**.
Sono comprese quattro prove MySQL 8.4 reali, sette prove PostgreSQL 17 reali
e una prova di compatibilità delle date; restano coperti SQLite/H2,
autenticazione e integrazione della suite. I database usati sono effimeri o
isolati su loopback, con credenziali sintetiche; il container MySQL dedicato
è stato rimosso al termine. `bootJar` è stato ricostruito con successo.

Il collaudo usa PostgreSQL 17 reale locale, owner e app distinti e schema privato. Verifica la corrispondenza delle 100 tabelle con lo schema attuale e avvia Hibernate in `validate`, senza generare tabelle tramite Hibernate. Le prove includono:

- profilo cloud/Clerk e isolamento della cronologia Flyway;
- divieto DDL e divieto di leggere la cronologia dal ruolo runtime;
- descrizioni Unicode oltre 64 KiB e allegato binario da 180000 byte;
- ricerca con appartenenza al progetto e visibilità delle note;
- cancellazione logica con date PostgreSQL e versione concorrente;
- registro comune e selezione del progetto tramite API autenticate;
- somme dei costi e unicità dei nomi utente indipendente dal case.

La workflow `Verify Cloud` prepara sia MySQL 8 sia PostgreSQL 17 effimeri e conserva i test desktop/SQLite. Per eseguire solo il collaudo PostgreSQL occorrono `POSTGRES_TEST_URL`, `POSTGRES_TEST_USER`, `POSTGRES_TEST_PASSWORD`, `POSTGRES_TEST_MIGRATION_USER`, `POSTGRES_TEST_MIGRATION_PASSWORD`; le password possono provenire da file con il suffisso `_FILE`. Il test rifiuta URL che non siano loopback e non va indirizzato a Supabase o a un database con dati reali.

```powershell
.\gradlew.bat test --tests '*CloudPostgresSchemaIT' --tests '*PostgresDateCompatibilityTest' bootJar
```

Il driver è fissato al rilascio corrente verificato sul [sito ufficiale pgJDBC](https://jdbc.postgresql.org/); [Flyway documenta il modulo PostgreSQL separato](https://documentation.red-gate.com/flyway/reference/database-driver-reference/postgresql-database). SQLite desktop e MySQL cloud mantengono le rispettive configurazioni: `desktop` e `cloud`; PostgreSQL si attiva esclusivamente scegliendo `cloud-postgres`.

Le migrazioni PostgreSQL applicate non vanno rigenerate o modificate: le
variazioni successive si aggiungono come `V5`, `V6`, ecc. Le modifiche comuni
allo schema devono avere anche la relativa migrazione SQLite/MySQL, senza
alterare le cronologie precedenti. Flyway rimane l'unico gestore delle
migrazioni applicative; non si crea una seconda cronologia indipendente
applicando gli stessi file tramite il pannello Supabase.
