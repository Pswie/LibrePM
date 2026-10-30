# Collegamento LibrePM, AssociaGo e Bandi

Lavoro del 29 ottobre 2026. Le tre applicazioni restano siti separati. LibrePM conserva il registro comune dei progetti; AssociaGo conserva persone, presenze e contabilità; Bandi conserva catalogo e fascicoli delle candidature. Un database fisico può ospitare più database separati, ma le applicazioni non devono scrivere direttamente nelle tabelle delle altre: qui i motori sono anche diversi, MySQL/SQLite e PostgreSQL.

## Lavori eseguiti in LibrePM

- [x] Registro persistente dei progetti comuni, identificati dallo stesso UUID del progetto LibrePM.
- [x] Corrispondenze con gli identificativi locali degli altri siti, senza abbinamenti per titolo e senza duplicare un progetto a ogni retry. ID opachi e revisioni mantengono il confronto esatto anche su MySQL.
- [x] Import iniziale da un progetto AssociaGo o da un fascicolo Bandi, con proprietario reale e membership OWNER. Le successive revisioni sorgenti non sovrascrivono il piano operativo.
- [x] Provenienza iniziale immutabile e storico delle revisioni opache osservate, senza inventarne un ordinamento cronologico.
- [x] API utente con controllo del proprietario o dell'effettiva appartenenza al progetto. Un VIEWER può leggere ma non pubblicare/allineare.
- [x] Autenticazione fra server con due chiavi distinte, organizzazione fissa e confronto costante delle credenziali. Nessun segreto nel browser o nei collegamenti.
- [x] Proiezioni versionate di nome, descrizione e preventivo. La versione aumenta quando cambia il contenuto effettivo della proiezione, comprese le righe del budget.
- [x] Stato separato per ogni applicazione, ultimo successo, errore persistito e retry. La mancata risposta di un'applicazione non annulla le modifiche locali.
- [x] Allineamento manuale e periodico; lease persistente sul database per evitare che due istanze allineino contemporaneamente lo stesso progetto.
- [x] Riepiloghi in sola lettura: entrate/uscite/saldo e presenze da AssociaGo, stato del fascicolo da Bandi. Nessun movimento contabile viene creato dall'importazione di un preventivo.
- [x] Dati finanziari rimossi dalle risposte utente per ruoli cloud che non possono consultarli, compreso il contributo richiesto nella candidatura.
- [x] Schermata **Integrazioni → Progetti collegati**, scelta del progetto comune, condivisione del progetto corrente, pulsanti **Apri in AssociaGo/Bandi**, stato e riepiloghi.
- [x] Selezione persistita per utente e organizzazione; collegamenti `?suiteProject=UUID` risolti dopo l'accesso. Un collegamento errato o non autorizzato mostra un errore e non apre silenziosamente il primo progetto.
- [x] Migrazioni additive SQLite `V901` e MySQL `V3`, senza modificare le migrazioni precedenti o i dati produttivi.
- [x] Test su registro, importazione, autenticazione, autorizzazione, revisioni, retry, budget, selezione e navigazione; client HTTP reale verificato per credenziali, redirect e risposta troppo grande.

## Come usarlo

1. Aprire un progetto LibrePM e andare in **Integrazioni**.
2. Premere **Condividi questo progetto**. Il registro non modifica automaticamente la contabilità o i fascicoli delle altre applicazioni.
3. Premere **Allinea applicazioni**. AssociaGo crea o collega il progetto locale autorizzato; Bandi conserva il progetto comune e consente di collegare un fascicolo esistente.
4. Usare **Apri in…** per passare all'altra applicazione mantenendo il progetto. Restano i sistemi di accesso già previsti: Clerk nei siti che lo usano, accesso locale in Bandi.
5. Leggere lo stato per ogni sito. Se uno è offline, il riepilogo eventualmente visibile è l'ultimo ricevuto: la data dell'ultimo successo e l'errore segnalano che non è aggiornato.

È possibile partire anche dalla condivisione autorizzata di un progetto AssociaGo o di un fascicolo Bandi. LibrePM crea il piano iniziale una sola volta. Un collegamento a un record già assegnato a un altro progetto restituisce 409: nessuna riassegnazione silenziosa.

## Configurazione del backend

Il modello senza segreti è in `.env.suite.example`. Queste variabili vanno impostate nell'ambiente del processo/server: il backend Java non carica automaticamente quel file.

| Variabile | Significato |
| --- | --- |
| `SUITE_ENABLED` | `false` per impostazione predefinita; attiva l'integrazione con `true`. |
| `SUITE_ORGANIZATION_ID` | UUID identico nelle tre applicazioni, distinto da associationId e profilo Bandi. |
| `SUITE_ASSOCIAGO_API_URL`, `SUITE_BANDI_API_URL` | Origini dei backend remoti, senza `/api` e senza altri percorsi. |
| `SUITE_LIBREPM_API_URL` | Origine del registro LibrePM da configurare anche negli altri siti. |
| `SUITE_*_PUBLIC_URL` | Origini dei siti visibili all'utente, per i pulsanti e i collegamenti al progetto. |
| `SUITE_ASSOCIAGO_KEY` | Chiave casuale server di almeno 32 caratteri, uguale in LibrePM e AssociaGo. |
| `SUITE_BANDI_KEY` | Altra chiave casuale di almeno 32 caratteri, uguale in LibrePM e Bandi. |
| `SUITE_IMPORT_OWNER_ID` | UUID di un utente LibrePM reale e attivo; serve per importazioni senza un soggetto Clerk già collegato a un utente esistente. Non viene accettato dal browser. |
| `SUITE_SYNC_INTERVAL_MS` | Pausa fra i cicli, 300000 ms di default. |
| `SUITE_SYNC_INITIAL_DELAY_MS` | Ritardo iniziale, 60000 ms di default. |

Gli URL devono usare HTTPS; HTTP è ammesso soltanto per localhost/loopback nei collaudi locali. Credenziali, query, frammenti, porte fuori intervallo e percorsi arbitrari non sono ammessi nelle origini. Il client non segue redirect, connette entro 4 secondi, limita ogni richiesta a 12 secondi e ogni risposta a 64 KiB. Il lease per progetto dura al massimo 120 secondi in caso di arresto improvviso.

Il job periodico funziona mentre il processo è in esecuzione. Un servizio Cloud Run sospeso o scalato a zero richiede una richiesta per ripartire; il pulsante di allineamento e il retry peer restano disponibili. Per una cadenza garantita su Cloud Run si può configurare successivamente un richiamo esterno autenticato.

## Contratto e API

Il contratto condiviso si trova nella repository AssociaGo: `integration/SUITE-V1-CONTRACT.md` e `integration/suite-v1.openapi.json`. Non viene usato il precedente `SyncService`, che non applicava realmente le modifiche remote.

| Percorso | Uso |
| --- | --- |
| `GET/POST /api/integrations/v1/projects` | Elenco visibile / registrazione autorizzata del progetto LibrePM. |
| `GET /api/integrations/v1/projects/{id}` | Contesto autorizzato. |
| `POST /api/integrations/v1/projects/{id}/sync` | Pubblicazione delle proiezioni e lettura dei riepiloghi. |
| `GET/PUT /api/integrations/v1/selection` | Scelta persistente dell'utente. |
| `GET/POST /api/integrations/v1/peer/projects` | Catalogo dell'organizzazione / importazione iniziale da un peer. |
| `GET /api/integrations/v1/peer/projects/{id}` | Contesto del progetto comune. |
| `POST /api/integrations/v1/peer/projects/{id}/instances` | Collegamento di un record locale già verificato dal sito sorgente. |
| `POST /api/integrations/v1/peer/projects/{id}/sync` | Retry da un'applicazione collegata. |

I peer inviano `X-Suite-Peer`, `X-Suite-Key`, `X-Suite-Organization`. Il peer autenticato deve corrispondere alla sorgente dichiarata nell'importazione o nel collegamento. Una configurazione assente restituisce 503; credenziali errate 401; organizzazione o permessi errati 403; input errato 400; collegamento/versione concorrente 409. Il risultato di `/sync` include lo stato reale per ogni peer, anche in caso di allineamento parziale.

## Limiti gestiti esplicitamente

- Il motore finanziario esistente di LibrePM usa `Double`. Un budget importato viene accettato soltanto se la conversione da decimale esatto e ritorno non perde cifre; in caso contrario l'importazione restituisce 409 `SUITE_AMOUNT_PRECISION` prima di creare il progetto. Non avviene un arrotondamento silenzioso. Le somme delle righe vengono calcolate con `BigDecimal` per la proiezione.
- Valute diverse nelle righe di uno stesso preventivo impediscono l'aggregazione e restituiscono un errore esplicito. AssociaGo gestisce EUR e può rifiutare una proiezione con valuta o precisione incompatibile, mantenendo funzionante LibrePM.
- Il nome comune rispetta il limite nativo di 200 caratteri e la descrizione quello di 2000.
- I fascicoli Bandi non vengono creati inventando un bando o una domanda. Un progetto può essere presente nel registro e nel mirror senza avere ancora un fascicolo.
- La scadenza iniziale del progetto è conservata come metadato del registro. La scadenza del bando non viene trasformata automaticamente nella fine del piano e non genera attività.
- La sincronizzazione riguarda le proiezioni e i riepiloghi elencati: non replica tutte le modifiche e non crea un unico login fra prodotti con autenticazioni differenti.

## Verifiche e pubblicazione

Verifiche aggiornate al 30 ottobre: compilazione Java e suite Gradle **107 prove su 107 passate, nessuna saltata**, comprendendo MySQL 8.4 e PostgreSQL 17 reali, SQLite/H2 e le 13 prove backend della suite. Verificati anche `npm run lint`, `npm run test:api` (5 prove), `npm run test:suite` (5 prove), build web e desktop. Il collaudo `npm run test:suite-ui` usa Chrome headless con il componente React reale: condivisione, scelta persistita, allineamento parziale, retry riuscito, link sicuri, cambio progetto e larghezza mobile di 390 pixel. Le risposte HTTP prodotte dai test sono validate contro lo schema comune; le catture si trovano in `build/suite-contract-captures.json`, senza credenziali. Il timeout assoluto è verificato anche con un server che invia gli header e poi blocca il corpo della risposta. Restano gli avvisi preesistenti delle dipendenze Sass e dei bundle Vite grandi, che non impediscono le build.

Non sono stati eseguiti deploy, commit, sostituzioni di siti o scritture sui database produttivi. Aggiornamento del 30 ottobre: l'utente ha confermato che Aiven era vuoto e ha scelto PostgreSQL/Supabase. Il nuovo backend è preparato nella guida [SUPABASE-POSTGRES.md](SUPABASE-POSTGRES.md), con schema privato e Clerk conservato. Prima della pubblicazione servono configurazione del progetto Supabase, credenziali separate, variabili/chiavi della suite e collaudo sui servizi reali; si aggiorneranno i servizi esistenti conservando domini e accesso, con possibilità di tornare alla revisione precedente.
