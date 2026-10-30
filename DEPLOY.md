# Rilascio della sezione bandi

Aggiornamento del 30 ottobre 2026: l'utente ha confermato che Aiven era vuoto e
ha scelto di preparare PostgreSQL su Supabase per entrambe le applicazioni.
Il percorso attuale è [SUPABASE-POSTGRES.md](SUPABASE-POSTGRES.md), con profilo
`cloud-postgres`, schema privato `librepm` e Clerk invariato. Non occorrono
recupero o esportazione da Aiven. I dettagli Aiven del 29 ottobre qui sotto
descrivono la configurazione online precedente; nessuna risorsa online è
stata aggiornata durante la preparazione locale.

Verifica del 29 ottobre 2026. Il backend è su Google Cloud Run; l'interfaccia
è su Vercel. Aggiornare soltanto Google non aggiorna le schermate.

| Componente | Configurazione verificata |
| --- | --- |
| Repository / branch | `Pswie/LibrePM`, `cloud/adf-bandi` |
| Progetto Google | `flawless-star-503422-q3` |
| Regione / servizio | `europe-west8` / `adf-bandi-collaudo` |
| Backend | `https://adf-bandi-collaudo-865322334234.europe-west8.run.app` |
| Revisione attualmente assegnata | `adf-bandi-collaudo-00006-s86`, 100% traffico |
| Frontend | `https://adf-bandi-collaudo.vercel.app` |
| Progetto / team Vercel | `adf-bandi-collaudo` / `villa-langellottis-projects` |
| Deployment frontend attuale | `dpl_H8JZwmqtyTgGqKeZQn5xxGefWF4v` |
| Database | Aiven MySQL, database `librepm`, condiviso come servizio con il gestionale |

## Configurazione Aiven precedente — verifica del 29 ottobre

Il backend attuale risponde **503**. I log riportano `UnknownHostException`
per `mysql-275a161-angelidelfuturoaps-8c60.a.aivencloud.com`: anche la
risoluzione DNS locale restituisce nome inesistente. Flyway non può collegarsi
e l'applicazione termina prima di aprire la porta HTTP. La vecchia indicazione
Cloud Run `Ready` non dimostra che una nuova istanza riesca ad avviarsi.

La sospensione per inattività è una spiegazione plausibile, da confermare nel
pannello Aiven: i [servizi MySQL gratuiti possono essere spenti dopo inattività](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier)
e successivamente riaccesi. Il DNS da solo non dimostra che il servizio sia
stato sospeso anziché eliminato.

1. Aprire la [console Aiven](https://console.aiven.io/), scegliere il progetto
   dell'associazione, poi **Services** e il servizio MySQL esistente.
2. In **Overview → Actions → Power on service**, riaccendere quel servizio.
3. Attendere lo stato operativo e il ripristino del backup; confrontare host,
   porta e utente con la configurazione di Cloud Run. Non pubblicare password.
4. Verificare che il database `librepm` e i dati precedenti siano presenti.
5. Riprovare DNS e `/actuator/health`; se l'endpoint è cambiato, aggiornare la
   configurazione del backend prima del rilascio. La password rimane in Secret
   Manager, referenziata come `aiven-db-password`.

[Procedura ufficiale di riaccensione](https://aiven.io/docs/products/mysql/howto/power-cycle-service):
Aiven ripristina il backup disponibile; l'operazione può richiedere da minuti
a ore. I servizi spenti possono essere eliminati dopo 180 giorni, o prima per
versioni fuori supporto. Se il servizio non compare, verificare backup e stato
dell'account prima di creare un sostituto. Riaccendere il servizio esistente
è preferibile per recuperare anche i dati del gestionale.

Il 29 ottobre il tentativo di accesso alla sessione Chrome è stato bloccato da
un errore di installazione del plugin Browser (modulo runtime mancante), prima
di poter verificare Aiven. Non sono state modificate risorse o credenziali.

## Verifiche prima del rilascio

Comandi PowerShell dalla radice del repository:

```powershell
.\gradlew.bat --no-daemon test bootJar
npm ci --ignore-scripts --prefix desktop
npm run lint --prefix desktop
npm run test:api --prefix desktop
npm run test:grants --prefix desktop
npm run build --prefix desktop
npm run build:web --prefix desktop
```

I test `CloudPostgresSchemaIT` e `CloudMySqlSchemaIT` devono risultare eseguiti
con database di collaudo isolati: una prova saltata non è una prova passata.
La workflow `Verify Cloud` usa PostgreSQL 17 e MySQL 8 effimeri e verifica
le rispettive migrazioni. La build web locale richiede le variabili pubbliche del
progetto Vercel; una build con valori fittizi verifica soltanto la compilazione.

Prima della pubblicazione: salvare un backup verificato del database e rendere
disponibile il sorgente completo della versione rilasciata nel branch
`cloud/adf-bandi`, al quale punta il link nell'applicazione.

## Google Cloud Run

Dopo aver predisposto il nuovo schema PostgreSQL e le verifiche, dalla radice
di LibrePM. Prima della promozione configurare sulla revisione candidata il
profilo, le due connessioni runtime/migrator e i secret della nuova guida:
il solo deploy del sorgente conserva ancora le vecchie variabili MySQL.

```powershell
gcloud auth list --filter=status:ACTIVE
gcloud run services describe adf-bandi-collaudo --project=flawless-star-503422-q3 --region=europe-west8 --format='value(status.latestReadyRevisionName,status.url)'
gcloud run deploy adf-bandi-collaudo --source . --project=flawless-star-503422-q3 --region=europe-west8 --no-traffic --tag candidate
```

La build usa il `Dockerfile` e `.gcloudignore`. Questi comandi aggiornano il
servizio esistente e conservano variabili, riferimenti ai secret e service
account; non usare flag che cancellano tale configurazione. La nuova revisione
parte senza traffico sul dominio principale. Recuperare l'URL con tag
`candidate` e il nome della nuova revisione:

```powershell
gcloud run services describe adf-bandi-collaudo --project=flawless-star-503422-q3 --region=europe-west8 --format='yaml(status.latestReadyRevisionName,status.traffic)'
```

Sull'URL `candidate` verificare `/actuator/health` (200, `UP`), `/api/me`
senza token (401), e le operazioni interessate con un account di collaudo.
Soltanto dopo, assegnare il traffico alla revisione verificata:

```powershell
gcloud run services update-traffic adf-bandi-collaudo --project=flawless-star-503422-q3 --region=europe-west8 --to-revisions=NOME_NUOVA_REVISIONE=100
```

Ripetere i controlli sull'URL principale. Il nuovo traffico sostituisce la
vecchia versione; conservare inizialmente la revisione precedente per poter
tornare indietro. [Gestione ufficiale di revisioni e traffico](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration).

Rollback alla revisione annotata prima del rilascio (qui il riferimento del
29 ottobre; aggiornarlo a ogni rilascio):

```powershell
gcloud run services update-traffic adf-bandi-collaudo --project=flawless-star-503422-q3 --region=europe-west8 --to-revisions=adf-bandi-collaudo-00006-s86=100
```

Il rollback del codice non ripristina database o migrazioni e non risolve un
database spento. Non eliminare il database né il servizio Cloud Run per
sostituire la versione dell'applicazione.

## Vercel

Da `desktop`, già collegata al progetto tramite `.vercel/project.json`:

```powershell
Set-Location desktop
vercel whoami
vercel inspect https://adf-bandi-collaudo.vercel.app
vercel deploy --prod --skip-domain
```

La build remota usa `vercel.json`, `npm run build:web` e le variabili del
progetto (`VITE_API_BASE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`,
`VITE_CLERK_PRIMARY_URL`). Nessuna password database deve entrare nel frontend.
Controllare il deployment restituito, poi promuoverlo:

```powershell
vercel inspect URL_NUOVO_DEPLOYMENT
vercel promote URL_NUOVO_DEPLOYMENT
```

Il dominio pubblico ora serve la nuova build. Verificare accesso dal sito,
registro bandi, ricerca, allegati e navigazione da telefono. Il collaudo completo
dell'accesso va fatto sul dominio pubblico: un URL temporaneo può non essere
ammesso dalla configurazione satellite Clerk o dal CORS del backend.

In caso di regressione, dalla stessa cartella:

```powershell
vercel rollback
vercel rollback status
```

Il rollback torna al precedente deployment di produzione; il piano Hobby
permette questo solo per il precedente immediato. Conservare inizialmente la
vecchia build. [Build di produzione senza promozione automatica](https://vercel.com/docs/cli/deploy)
e [rollback Vercel](https://vercel.com/docs/cli/rollback).

## Stato della pubblicazione

Nessun aggiornamento online eseguito durante questa analisi. Prima del rilascio
occorre creare/configurare il progetto Supabase scelto e i suoi secret,
applicare le migrazioni private e completare il collaudo della revisione
candidata. Lo stato delle sessioni Google/Vercel riportato sopra è quello
verificato il 29 ottobre e va ricontrollato al momento del rilascio.
