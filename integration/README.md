# Contratto distribuito della suite progetti

Questa directory contiene uno snapshot della release 1.0.0 del contratto comune
AssociaGo / LibrePM / Bandi. I file sono identici a quelli canonici della
repository AssociaGo, directory `integration`; non modificare questa copia
indipendentemente. Il manifest `SUITE-CONTRACT-SNAPSHOT.json` riporta gli SHA256.

- [OpenAPI 3.1 e payload verificabili](suite-v1.openapi.json)
- [Regole funzionali e autorizzazioni](SUITE-V1-CONTRACT.md)

Per aggiornare il contratto si modifica prima AssociaGo, si coordinano i tre
provider e si distribuisce la stessa release. Il comando seguente, eseguito
dalla repository AssociaGo con LibrePM e Bandi come cartelle sorelle, controlla
le fixture e richiede copie identiche in entrambe le altre repository:

```powershell
python scripts/integration/check_contract.py --check-snapshots
```

I file copiati sono autonomi e leggibili anche senza le altre repository.
Non contengono chiavi o dati personali. Le istruzioni operative della singola
applicazione rimangono nella sua documentazione di integrazione.
