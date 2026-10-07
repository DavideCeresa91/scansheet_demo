# Scan Sheet vDemo

Repository statico per provare l'interfaccia di Scan Sheet senza backend, Google, OAuth o credenziali.

## Comportamento attuale

- La fotocamera prova a partire subito all'apertura.
- La camera **non legge in automatico**.
- La lettura è attiva **solo mentre si tiene premuto `Registra`**.
- Durante la pressione compare una linea orizzontale del colore del tema.
- Rilasciando il pulsante la lettura si interrompe immediatamente.
- Long press: disabilitati selezione testo, callout e drag sul pulsante.
- Nessuna vibrazione alla pressione.
- Alla lettura riuscita: breve vibrazione, camera spenta e sostituita da `Apri fotocamera`.
- Se il browser supporta `BarcodeDetector`, prova a leggere davvero.
- Se non lo supporta, vDemo simula una lettura dopo 1,4 secondi di pressione continua.
- `Conferma registrazione` aggiunge soltanto una riga demo nella pagina.

## Nessuna configurazione

Non contiene:
- Google Apps Script
- Google Cloud / OAuth
- Google Sheets
- ACCESS_KEY
- Client ID / Client Secret
- API key

## GitHub Pages

Carica i file nella root del repository `scansheet-vDemo`, poi:

Settings → Pages → Deploy from a branch → `main` → `/(root)`


### Nota long-press
Il trigger `Registra` non usa più un `<button>` nativo: è un controllo neutro con gestione touch dedicata e `preventDefault()`, per ridurre il feedback aptico del long-press di Android/Chrome. La vibrazione programmata resta solo al riconoscimento del codice.
