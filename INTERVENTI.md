# Analisi e interventi — 29 ottobre 2026

Audit del fork `cloud/adf-bandi`: backend Spring Boot, interfaccia React/Electron,
versione web della sezione bandi e pubblicazione. Questo file distingue il lavoro
verificato dalle funzionalità che richiedono ulteriore sviluppo.

## Da correggere e verificare

- [x] **P1 — Identità nelle API cloud:** impedire che l'header storico `X-User-Id`
  consenta di impersonare altri utenti; usare l'identità verificata dal JWT.
- [x] **P1 — Note e ricerca:** correggere la precedenza AND/OR della ricerca,
  controllare accesso a feed e backlink e rispettare la visibilità delle note.
- [x] **P1 — Ricerca cloud:** eliminare le query SQLite incompatibili con MySQL
  e i riferimenti a colonne task inesistenti; verificare ricerche reali.
- [x] **P1 — Risorse dei progetti:** verificare che gli identificativi figli di
  finanza e bandi appartengano al progetto indicato nell'URL.
- [x] **P1 — Spese e riepiloghi:** verificare e correggere l'aggiornamento dei
  consuntivi dopo registrazione e cancellazione di una spesa.
- [x] **P1 — Download allegati:** scaricare i file cloud con autenticazione e
  mostrare eventuali errori invece di aprire un URL senza token.
- [x] **P1 — Export e collegamenti alle note:** isolare i risultati import/export
  per utente e progetto; richiedere identità e permessi anche nelle API dei link
  alle note, restituendo 403 per accesso negato.
- [x] **P2 — Cambio progetto:** azzerare selezioni e dati dipendenti dal progetto
  e impedire che risposte asincrone precedenti sovrascrivano il contesto corrente.
- [x] **P2 — Requisiti e rendicontazioni:** completare i controlli mancanti,
  gestire errori e stati di salvataggio nelle schermate dei bandi.
- [x] **P2 — Design e accessibilità:** verificare il layout mobile e correggere
  problemi concreti di leggibilità, comandi e navigazione.
- [x] **P2 — Operazioni apparentemente riuscite:** correggere le esportazioni web
  che scaricavano backup SQLite anziché JSON/CSV; impedire il falso merge di un
  ramo e correggere il forecast basato sulle ore consumate anziché sui risultati.
- [x] **P2 — Verifiche automatiche:** eseguire test backend, build web/desktop e
  controllo mobile; correggere la CI che salta i test e ignora il lockfile.
- [ ] **Pubblicazione:** identificare il servizio Google attivo, pubblicare la
  nuova versione verificata e sostituire il traffico della precedente. Annotare
  accessi mancanti o impedimenti, senza cancellare database o allegati.

## Evidenze iniziali

- Working tree inizialmente pulito, commit `8d27aea`.
- Il backend cloud usa MySQL, Clerk JWT e Google Cloud Run; il desktop usa SQLite.
- La prima build web termina correttamente, ma segnala un logo SVG di circa
  8,6 MB e un bundle editor superiore a 1 MB: ottimizzazione da valutare.
- La CI desktop usa `-x test` e cancella `package-lock.json` prima di installare:
  il risultato non è riproducibile e i test non proteggono i rilasci.

## Risultato delle modifiche

- Nel cloud l'header utente è ricavato dal JWT verificato. Un identificativo
  fornito dal client non può impersonare altri utenti. Issuer e audience restano
  verificati insieme.
- Note riservate filtrate in lettura, feed, ricerca, revisioni e backlink. Un
  ex membro non mantiene accesso alle proprie note; Viewer non può scriverle né
  modificarne i collegamenti. Progetti eliminati esclusi senza errori dei proxy.
- Ricerca riscritta con query JPA portabili: niente query FTS SQLite su MySQL,
  niente colonne di stato/priorità obsolete; caratteri `%` e `_` trattati come
  testo. Il limite è compreso tra 1 e 100 risultati.
- Finanza, bandi e controllo modifiche verificano l'appartenenza delle risorse
  al progetto. Totali delle nuove spese aggiornati atomicamente e nella stessa
  transazione; importi negativi/non finiti e intervalli data invertiti rifiutati.
- I moduli dei bandi gestiscono descrizione, tipo, evidenze e completamento dei
  requisiti, oltre a date e scadenze delle rendicontazioni. Errori visibili e
  bozze conservate quando un salvataggio fallisce.
- Cambio progetto/budget isolato; risposte di richieste precedenti ignorate.
- Download con token corrente e nome del file conservato; esportazioni web
  realmente JSON/CSV del progetto. Backup globale desktop nascosto sul web.
- Menu mobile: focus all'apertura e alla chiusura, Tab confinato nel cassetto,
  Esc e sfondo per chiuderlo. Schermata di attesa adattata alla larghezza.
- Logo di avvio/navigation sostituito con il PNG del progetto già presente:
  da circa 8,6 MB a 553 kB, senza introdurre nuove immagini o dipendenze.
- ESLint riparato per la versione effettivamente installata. CI usa il lockfile,
  esegue i test e collauda MySQL su un database temporaneo.

## Funzionalità ancora incomplete e lavoro successivo

Queste parti richiedono funzionalità nuove e non sono presentate come concluse:

- [ ] **Merge selettivo degli scenari:** mancano applicazione delle modifiche,
  confronto e risoluzione dei conflitti. Ora `MERGED` restituisce 409 e non
  modifica il ramo; il comando fittizio è stato rimosso dall'interfaccia. Rami e
  proposte rimangono metadati, non copie materializzate dei progetti.
- [ ] **Forecast storico:** mancano snapshot dell'avanzamento e delle stime.
  Date diverse da oggi restituiscono 400. Il calcolo attuale usa completamento
  0/100 dei task, esclude riepiloghi duplicati e registrazioni future, restituisce
  `null` per indici non calcolabili invece di numeri inventati. Le API esistono,
  ma una schermata dedicata a queste metriche non è ancora collegata.
- [ ] **Promemoria server:** i metodi `remindersList`, `remindersCheckDue` e
  `reminderMarkNotified` nel client sono ancora stub, non usati nelle schermate
  attive. Serve un vero scheduler con tentativi, stato e gestione dei fusi orari.
- [ ] **Connettori database desktop:** le opzioni PostgreSQL/MySQL nelle
  impostazioni sono esplicitamente disabilitate e non implementate; sono
  distinte dal profilo cloud MySQL già operativo nel codice.
- [ ] **Consuntivi preesistenti:** prima della correzione le spese registrate non
  aggiornavano le voci di budget. Alla riattivazione di Aiven confrontare spese
  storiche e importi manuali. Non è stato fatto un ricalcolo automatico perché
  potrebbe duplicare valori già inseriti manualmente. Nuove modifiche non
  possono abbassare il consuntivo sotto le spese registrate; eliminazioni
  incoerenti richiedono riconciliazione e non cancellano la spesa.
- [ ] **Prestazioni editor:** resta un bundle Markdown di circa 1 MB e rimangono
  avvisi Sass in `frappe-gantt`. Valutare caricamento su richiesta e aggiornamenti
  delle dipendenze con collaudo dedicato. Non sono errori di compilazione.

## Verifiche

Suite backend, migrazioni e ricerca provate anche su un **MySQL 8 temporaneo**,
separato dai dati in esercizio. Build JAR, renderer web e desktop completate.
Test API download/esportazioni e test Chrome su moduli bandi, errori, date e
cambio progetto completati; layout provato a 320, 375, 390, 768 e 1280 pixel.
Esito finale: **86 test backend, 0 errori, 0 fallimenti, 0 saltati**, inclusi i
4 test del profilo MySQL; **5 test API frontend** superati; test Chrome bandi e
mobile superati; lint senza errori. Il container MySQL temporaneo è stato
arrestato e rimosso dopo il collaudo. Il pacchetto backend locale è
`build/libs/LibrePM-0.1.1.jar`; i renderer compilati sono in `desktop/dist` e
`desktop/dist-web`. Non sono stati generati nuovi installer Electron.

Non è stato possibile collaudare un accesso reale completo nel sito online:
il backend in esercizio non riesce ad avviarsi a causa del database.

## Pubblicazione — bloccata da Aiven

**Nessuna vecchia versione online è stata cancellata o sostituita.** Il backend
Google Cloud Run restituisce già 503: l'hostname MySQL Aiven configurato non è
risolvibile. La sospensione per inattività è plausibile, da confermare nella
console Aiven. La sessione Chrome automatizzata non è utilizzabile per un modulo
runtime mancante; non è stato possibile riattivare il servizio dall'account.

Accessi CLI Google e Vercel disponibili. Il frontend è su **Vercel**, il backend
su **Google Cloud Run**: occorre aggiornare entrambi dopo il recupero del database.
Istruzioni complete, riferimenti alla versione precedente e rollback in
[DEPLOY.md](DEPLOY.md). Le modifiche sono in questa copia locale e non sono state
pubblicate né inviate al branch remoto. La sostituzione del traffico e il
collaudo finale restano da fare insieme dopo il ripristino Aiven.
