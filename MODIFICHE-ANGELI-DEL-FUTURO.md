# Modifiche di Angeli del Futuro a LibrePM

Questo branch è una versione modificata di **LibrePM**, usata come *sezione
bandi* del sistema informativo dell'associazione Angeli del Futuro.

| | |
| --- | --- |
| Progetto originale | [LorenzoElSalserito/LibrePM](https://github.com/LorenzoElSalserito/LibrePM) |
| Autore e copyright | © Lorenzo De Marco (Lorenzo DM) |
| Licenza | **GNU AGPL v3.0** — testo integrale in [LICENSE](LICENSE) |
| Branch delle modifiche | `cloud/adf-bandi` |

L'AGPL chiede due cose che riguardano questo file:

1. **Art. 5a** — indicare in modo evidente che il programma è stato modificato e
   quando. È l'elenco qui sotto.
2. **Art. 13, la clausola di rete** — nel momento in cui la versione modificata
   viene esposta in rete, a chi ci interagisce va offerto il sorgente completo
   *di quella versione*. Non basta che il progetto originale sia pubblico. Il
   link è dentro l'applicazione, nella schermata di accesso, e punta a questo
   branch (vedi `desktop/src/branding.js`).

Il codice originale resta di Lorenzo De Marco; le note di copyright non sono
state rimosse da nessun file.

---

## 25 luglio 2026 — da applicazione desktop a sezione web condivisa

LibrePM nasce local-first: un backend Spring Boot su SQLite avviato da Electron,
un solo utente per installazione. Queste modifiche lo fanno girare anche come
servizio web multiutente, con l'identità gestita da un identity provider e lo
schema su un MySQL condiviso con l'altro gestionale dell'associazione (database
separati, stesso servizio).

### Profilo Spring `cloud`

- `src/main/resources/application.yml` — **nuovo profilo `cloud`**: datasource
  MySQL da variabili d'ambiente, dialetto MySQL, Flyway su
  `db/migration_mysql`, porta da `$PORT`, log su stdout invece che su file.
  Nessun default permissivo: senza issuer o con origini CORS aperte
  l'applicazione **rifiuta di avviarsi**.
- `build.gradle` — driver MySQL, `flyway-mysql`,
  `spring-boot-starter-oauth2-resource-server`, Testcontainers.
- `LibrePMApplication.java` — `setupDataPath()` ora rispetta
  `LIBREPM_DATA_PATH`. Prima la cartella dati era sempre `~/.librepm`, imposta
  come *system property*: in Spring vince su `application.yml`, quindi il
  profilo cloud non riusciva a spostarla e in container la home può non essere
  scrivibile.
- `Dockerfile` — **nuovo**: build multi-stage, utente non-root, porta da `$PORT`.

### Schema MySQL

- `src/main/resources/db/migration_mysql/V1__baseline_schema.sql` — **nuovo**:
  94 tabelle, generate da Hibernate dalle entity JPA con dialetto MySQL 8 e
  verificate applicandole davvero. Le migrazioni in `db/migration` restano
  quelle SQLite del desktop.
- `src/main/resources/db/migration/V63__clerk_user_link.sql` — **nuova**:
  colonna `users.clerk_user_id` anche su SQLite, perché la entity è una sola.
- `core/entity/AppPreference.java` — la colonna `key` è ora quotata:
  `key` è una **parola riservata** di MySQL e senza virgolette il `CREATE TABLE`
  è un errore di sintassi. Hibernate registrava il fallimento nel log e
  continuava, quindi la tabella semplicemente non nasceva.
- `core/entity/Dependency.java` — stesso trattamento per `lag` e `lead`, che in
  MySQL 8 sono funzioni finestra e quindi riservate.
- `core/entity/Asset.java` — `file_path` da 1000 a 768 caratteri: la colonna è
  unica, quindi indicizzata, e in utf8mb4 servono 4 byte per carattere. Il
  limite di una chiave InnoDB è 3072 byte, cioè 768 caratteri esatti.
- `core/entity/User.java`, `repository/UserRepository.java` — campo
  `clerkUserId` e relativa ricerca.

Il nome fisico delle colonne non cambia in nessuno di questi casi, quindi i
database SQLite già in uso restano validi.

### Identità e autorizzazioni sul web

- `security/CloudSecurityConfig.java` — **nuovo**: resource server JWT,
  stateless, CORS su origini esatte. Sono negati `/api/auth/**` (un login con
  password parallelo all'identity provider sarebbe una seconda porta da
  presidiare), `/api/bootstrap/**` (crea utenti senza autenticazione),
  `/api/db/**` (importa e sovrascrive il database di tutti), `/api/sync/**`,
  `/api/diagnostics/**` e la documentazione OpenAPI.
- `security/OwnUserAuthorizationManager.java` — **nuovo**, ed è la modifica più
  importante. Quasi tutte le API di LibrePM hanno la forma
  `/api/users/{userId}/...`: sul desktop l'identificativo nell'URL è innocuo,
  perché l'unico utente è chi ha aperto il programma, ma su un backend
  condiviso basta cambiarlo per leggere e scrivere i progetti di un'altra
  persona. Nessuna regola basata sui ruoli lo impedisce — il ruolo dice *che
  cosa* si può fare, non *su chi*. Questo gestore confronta l'identificativo
  dell'URL con quello ricavato dal token e nega quando non combaciano.
- `security/ClerkProperties.java`, `ClerkRoleConverter.java`,
  `AudienceValidator.java`, `ClerkIdentityService.java` — **nuovi**: lettura dei
  ruoli dal token e collegamento fra identità esterna e utente interno.
- `security/SecurityConfig.java`, `config/CorsConfig.java`,
  `config/WebCorsConfig.java` — limitati a `@Profile("!cloud")`. Tutti e tre,
  con l'autenticazione disattivata o con origini `localhost:*` e
  `allowCredentials`, aprirebbero l'API a qualsiasi sito.
- `api/controller/MeController.java` — **nuovo**: `GET /api/me`. Sostituisce la
  sequenza di bootstrap del desktop, che online è chiusa. L'identificativo
  dell'utente non viene mai accettato dalla richiesta.

### Frontend, build web

- `desktop/vite.web.config.mjs`, `desktop/index.web.html`,
  `desktop/src/main.web.jsx` — **nuovi**: build web separata da quella Electron,
  con la propria CSP (gli host li riempie la build partendo dalle variabili
  d'ambiente, per non tenerli allineati a memoria).
- `desktop/src/WebAuthGate.jsx` — **nuovo**: accesso, attivazione
  dell'organizzazione, risoluzione dell'identità, offerta AGPL del sorgente.
- `desktop/src/api/librepm.js` — URL del backend da `VITE_API_BASE_URL`, con
  errore esplicito sul web invece del ripiego su `localhost`; token di sessione
  aggiunto a ogni richiesta.
- `desktop/src/App.jsx` — salta il bootstrap quando la sessione arriva dal web.
- `desktop/src/branding.js` — **nuovo**: l'offerta del sorgente dell'art. 13.
- `desktop/vercel.json`, `desktop/package.json`, `desktop/.gitignore`.

### Aspetto della build web

- `desktop/src/styles/adf-theme.css` — **nuovo**: tema di Angeli del Futuro
  (carta calda, verde bosco, terracotta, Plus Jakarta Sans). Ridefinisce i token
  `--jl-*` e `--bs-*` invece di riscrivere i componenti, e ridipinge i colori
  fissi rimasti in `index.css`, `Dashboard.css` e `librepm-shell.css`. Caricato
  solo da `main.web.jsx`: **l'applicazione Electron non cambia aspetto**.
- `desktop/src/layout/LeftNav.jsx` — i colori della barra laterale passano da
  valori fissi a variabili con il valore storico come ripiego
  (`var(--adf-rail-bg, linear-gradient(...))`). Serviva perché il componente
  tiene i propri stili in un blocco `<style>` interno: stando nel body vince
  nella cascata su qualunque foglio esterno, quindi non era ridipingibile da
  fuori. Con il ripiego, sul desktop — dove le variabili non sono definite —
  resta il blu notte originale.

### Difetti preesistenti corretti lungo la strada

- `desktop/src/api/librepm.js` — `diagnosticsGenerate()` e `reportGenerate()`
  usavano `currentUserId`, un identificatore **mai dichiarato**: in un modulo ES
  la riga lancia `ReferenceError`, quindi le due funzioni fallivano sempre. Il
  nome corretto è `CURRENT_USER_ID`.

### Collaudo

- `src/test/java/com/lorenzodm/librepm/cloud/CloudMySqlSchemaIT.java` —
  **nuovo**: applica le migrazioni MySQL a un database vero e verifica con
  `ddl-auto=validate` che le entity combacino con lo schema. È il test che
  protegge la baseline quando qualcuno modifica una entity.
