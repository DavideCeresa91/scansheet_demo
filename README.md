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


### Impostazioni e Configurazione
La vDemo ora mostra due pannelli distinti:
- **Impostazioni**: operatore, tema e preferenze della fotocamera.
- **Configurazione**: backend, chiave, scelta Sheet, prova connessione e salvataggio.

La sezione Configurazione è volutamente solo grafica: i pulsanti simulano lo stato e non contattano alcun servizio esterno.


### Header e pannelli
L'header mostra **Impostazioni** e **Configurazione** su due righe compatte a destra del logo.

- **Impostazioni**: nome operatore, tema, formato e visualizzazione fotocamera. Le modifiche si applicano subito.
- **Configurazione**: backend, chiave, Google Sheet, prova connessione e salvataggio. In vDemo sono soltanto placeholder/simulazioni.


### Variante rich drawer
Menu laterale con testata piena nel colore del tema, logo, voci ad alto contrasto e dialog meno pallidi.


## Nuove prove UI

Questa build aggiunge:

- **Cronologia locale** con `Esporta CSV` e `Svuota cronologia`.
  Il clear è pensato per rimuovere solo record già inviati; i pending andrebbero preservati.
- **Modalità Bippaggio**: lettura attiva soltanto mentre si tiene premuto `Registra`.
- **Modalità Scan2Sheets**: un tap avvia fotocamera + lettura continua fino al primo codice o all'annullamento.
- **Tema personalizzato** con color picker e valore esadecimale.
- **Vibrazione al riconoscimento** disattivabile.
- Le preferenze demo vengono salvate in `localStorage`.
