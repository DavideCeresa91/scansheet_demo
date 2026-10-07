# Scan Sheet vDemo

Repository statico per provare **solo l'aspetto e il flusso dell'interfaccia** di Scan Sheet.

Non contiene:
- Google Apps Script
- Google Cloud / OAuth
- Google Sheets
- ACCESS_KEY
- Client ID / Client Secret
- API key
- sincronizzazione esterna

Contiene:
- layout principale
- fotocamera reale del dispositivo
- pulsanti Camera on/off e Torcia
- pulsante "Leggi ora" con lettura simulata
- quantità + / -
- registro demo locale nella pagina
- temi
- confronto rapido tra camera 4:3, 4:5 e 3:4
- confronto `cover` / `contain`

## Pubblicazione GitHub Pages

Crea un repository, per esempio:

`scansheet-vDemo`

Carica questi file nella root e poi:

Settings → Pages → Deploy from a branch → `main` → `/(root)`

L'URL sarà del tipo:

`https://TUO-USERNAME.github.io/scansheet-vDemo/`

## Nota

La camera richiede HTTPS: GitHub Pages va bene.
La funzione "Leggi ora" in vDemo è intenzionalmente simulata: serve a testare UI e flusso senza librerie barcode o backend.
