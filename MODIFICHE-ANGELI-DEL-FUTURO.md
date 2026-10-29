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

## 29 ottobre 2026 — revisione funzionale e controlli di rilascio

- Identità cloud ricavata dal token verificato anche nelle API storiche; verifica
  issuer conservata quando è configurata un'audience.
- Note, backlink, ricerca e risultati import/export isolati per utente/progetto;
  ricerca compatibile con MySQL e rispetto delle note riservate per ruolo.
- Appartenenza delle risorse a progetto/bando verificata in finanza, bandi e
  controllo modifiche; importi e date validati; spese collegate ai consuntivi.
- Requisiti e rendicontazioni modificabili tramite moduli con salvataggio
  esplicito; risposte obsolete ignorate al cambio progetto o budget.
- Download autenticati, vere esportazioni progetto JSON/CSV, gestione degli
  errori e collegamenti alle note corretti.
- Menu mobile con focus e navigazione da tastiera; schermata di attesa adattiva;
  riuso del logo PNG già presente per alleggerire il caricamento.
- Forecast corretto; merge selettivo e storico non simulati quando non
  supportati. Limiti e lavoro residuo descritti in [INTERVENTI.md](INTERVENTI.md).
- Test automatici ampliati e CI con test MySQL, lockfile, lint e build.

Procedura e stato effettivo del rilascio in [DEPLOY.md](DEPLOY.md). La presenza
di queste modifiche nel repository non implica che siano già pubblicate.

## 25 luglio 2026 (bis) — usabile dal telefono, e un accesso solo

### Il layout su schermo stretto

LibrePM aveva le misure della finestra desktop da cui nasce: binario laterale da
220px sempre aperto, un pannello di contesto da 280px a destra, tabelle a sei
colonne. Su un telefono da 390px restavano poche decine di pixel di contenuto
utile fra due colonne di cornice.

- `desktop/src/styles/mobile.css` — **nuovo**. Strato responsive caricato da
  entrambi i punti d'ingresso: qui non c'è nulla di estetico da tenere separato
  come il tema, solo il comportamento del layout sotto una certa larghezza.
  L'applicazione desktop a finestra piena non incontra mai queste regole.
  Soglie: 992px per il binario, 768px per tabelle e controlli, 480px per
  l'impilamento delle etichette.
- `desktop/src/layout/LeftNav.jsx` — sotto i 992px esce dal flusso e diventa un
  cassetto sovrapposto: sfondo che oscura, chiusura con la X, con Esc, toccando
  fuori o scegliendo una voce. Da chiuso è `visibility: hidden` e non solo
  spostato — un pannello fuori schermo ma visibile resta nell'ordine di
  tabulazione e il fuoco ci finisce alla cieca. All'apertura il fuoco entra nel
  cassetto.
- `desktop/src/layout/TopHeader.jsx` — pulsante hamburger sotto i 992px, titolo
  troncabile, fasce di sicurezza dei telefoni con intaglio.
- `desktop/src/layout/AppShell.jsx` — stato del cassetto (sta qui perché il
  pulsante che lo apre vive nella barra in alto), e **il pannello di contesto
  ora parte chiuso su schermo stretto**: partire aperto significava presentare
  l'applicazione con un pannello informativo che copre la pagina prima ancora
  che si sia visto di che pagina si tratta.
- Il pannello di contesto aveva già delle regole per il mobile in
  `librepm-shell.css`, ma **non potevano funzionare**: `.jl-rightpanel.closed`
  azzera larghezza e imbottitura, e su un elemento largo zero il
  `translateX(100%)` non sposta niente. Da aperto restava una colonna fissa
  sopra il contenuto, senza sfondo e senza modo di chiuderla se non ritrovando
  il suo pulsante nella barra in alto, che il pannello stesso copre a metà. Ora
  è un cassetto vero, con sfondo cliccabile.
- `desktop/src/components/ResponsiveTables.jsx` — **nuovo**. Sotto i 768px ogni
  riga di tabella diventa una scheda con coppie etichetta/valore; l'etichetta la
  copia questo componente dall'intestazione di colonna. Copre le trentasei
  tabelle delle undici pagine di elenco senza modificarne il markup. La griglia
  del planner è esclusa di proposito: è una tabella di modifica, con campi
  editabili in ogni cella, e a schede perderebbe il senso.
- Bersagli touch a 44px e campi a 16px sotto i 768px — la seconda soglia perché
  sotto i 16px iOS ingrandisce la pagina al primo tocco su un campo e non la
  riporta indietro. Nessun `user-scalable=no`, che è la scorciatoia con cui di
  solito si nasconde quel difetto rinunciando all'accessibilità.
- Kanban, Gantt e calendario restano a scorrimento orizzontale: sono viste
  spaziali, e schiacciarle in una colonna sola vorrebbe dire perderle. Le
  colonne del kanban si agganciano però al bordo, così si scorre di una alla
  volta invece di fermarsi a metà fra due.
- `desktop/index.web.html` — `viewport-fit=cover`, `theme-color`, descrizione.

### Verifica

- `desktop/scripts/mobile-smoke.mjs` e `desktop/mobile-harness.html` — **nuovi**.
  Chrome headless via protocollo DevTools, nessuna dipendenza aggiunta. Misura a
  320, 375, 390, 768 e 1280px: scorrimento orizzontale, altezza minima dei
  comandi raggiungibili, corpo dei campi, binario che si fa cassetto solo sotto
  i 992, tabelle che si fanno schede solo sotto i 768, pannello di contesto che
  non si apre da solo, apertura e chiusura di entrambi i cassetti. Si lancia con
  `npm run test:mobile` mentre gira `npm run dev:renderer`.
  Il banco di prova monta i componenti veri del guscio senza backend né accesso
  Clerk, e non entra nella build di produzione: `vite.web.config.mjs` dichiara
  un solo ingresso.

> **Nota**: `npm run lint` è guasto da prima di queste modifiche —
> `eslint.config.js` importa `eslint/config`, che esiste solo da ESLint 9,
> mentre il `package.json` fissa la 8.57. Non è stato toccato: sistemarlo
> significa decidere un aggiornamento maggiore di ESLint, che non è parte di
> questo lavoro.

### Una sola identità non bastava a fare un solo accesso

Le tre applicazioni dell'associazione condividono l'istanza Clerk, ma stanno su
tre domini **registrabili** diversi. La sessione di Clerk vive in un cookie, e
`vercel.app` è nella Public Suffix List: il browser rifiuta qualunque cookie con
`Domain=.vercel.app`. Chi entrava dal sito doveva quindi riautenticarsi qui.

- `desktop/src/main.web.jsx` — questa applicazione diventa un **satellite** di
  Clerk (`isSatellite`, `domain`, `signInUrl`), con il sito come dominio
  primario. Attivo solo con `VITE_CLERK_PRIMARY_URL` impostata: senza,
  l'applicazione resta autonoma con la propria schermata di accesso, che è la
  configurazione dello sviluppo locale.
- `desktop/src/WebAuthGate.jsx` — da satellite usa `RedirectToSignIn` invece di
  montare `<SignIn>`. Non un `window.location` scritto a mano: quello
  arriverebbe alla schermata di accesso del sito senza portarsi dietro il punto
  di ritorno. L'offerta del sorgente richiesta dall'art. 13 resta visibile anche
  su questa schermata di passaggio.
- `desktop/vite.web.config.mjs` e `desktop/index.web.html` — nuovo segnaposto
  `%PRIMARY_ORIGIN%` nella CSP, riempito dalla build come già accade per l'API e
  per gli host di Clerk. Senza la variabile resta vuoto e non si apre nulla.

> Perché abbia effetto serve un passaggio fuori dal codice: nel pannello Clerk
> questo dominio va dichiarato satellite accanto al primario, e
> `VITE_CLERK_PRIMARY_URL` va impostata fra le variabili del progetto Vercel.
> Quando le tre aree passeranno a sottodomini dello stesso dominio registrabile
> l'impalcatura si potrà smontare: fra sottodomini Clerk condivide la sessione
> da sé.

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
