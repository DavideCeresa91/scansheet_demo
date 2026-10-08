const $ = id => document.getElementById(id);

const DEMO_SETTINGS_KEY = 'scanSheetVDemoSettingsV2';

let stream = null;
let cameraActive = false;
let torchOn = false;
let reading = false;
let holdToken = 0;
let detectionTimer = null;
let demoCount = 0;
let nativeDetector = null;
let demoRecords = [];
let scanMode = 'hold';

const defaultSettings = {
  operator: 'Davide Ceresa',
  theme: 'burgundy',
  customColor: '#923753',
  cameraRatio: 'tall',
  cameraFit: 'cover',
  scanMode: 'hold',
  vibrationEnabled: true,
  autoFlashEnabled: false
};

function loadSettings() {
  try {
    return {...defaultSettings, ...JSON.parse(localStorage.getItem(DEMO_SETTINGS_KEY) || '{}')};
  } catch {
    return {...defaultSettings};
  }
}

let settings = loadSettings();

function saveSettings() {
  localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(settings));
}

function hexToRgb(hex) {
  const clean = String(hex).trim().replace('#','');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0,2),16),
    g: parseInt(clean.slice(2,4),16),
    b: parseInt(clean.slice(4,6),16)
  };
}

function rgbToHex({r,g,b}) {
  const c = n => Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function mix(hexA, hexB, amount) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  if (!a || !b) return hexA;
  return rgbToHex({
    r:a.r+(b.r-a.r)*amount,
    g:a.g+(b.g-a.g)*amount,
    b:a.b+(b.b-a.b)*amount
  });
}

function applyCustomColor(hex) {
  const normalized = String(hex).trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) return false;

  const root = document.documentElement;
  root.style.setProperty('--accent', normalized);
  root.style.setProperty('--accent-hover', mix(normalized,'#000000',.2));
  root.style.setProperty('--accent-soft', mix(normalized,'#FFFFFF',.9));
  root.style.setProperty('--accent-border', mix(normalized,'#FFFFFF',.68));
  root.style.setProperty('--focus', mix(normalized,'#FFFFFF',.38));
  document.querySelector('meta[name="theme-color"]').content = normalized;
  return true;
}

function clearCustomThemeProperties() {
  const root = document.documentElement;
  ['--accent','--accent-hover','--accent-soft','--accent-border','--focus'].forEach(p => root.style.removeProperty(p));
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme === 'custom' ? 'burgundy' : theme;
  if (theme === 'custom') {
    applyCustomColor(settings.customColor);
  } else {
    clearCustomThemeProperties();
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    document.querySelector('meta[name="theme-color"]').content = accent;
  }
  $('custom-theme-controls').hidden = theme !== 'custom';
}

function applyCameraOptions() {
  const panel = $('camera-panel');
  panel.classList.remove('ratio-wide','ratio-tall','ratio-portrait','fit-cover','fit-contain');
  panel.classList.add('ratio-' + settings.cameraRatio, 'fit-' + settings.cameraFit);
}

function renderScanMode() {
  scanMode = settings.scanMode;
  document.body.classList.toggle('scan-mode-continuous', scanMode === 'continuous');

  if (scanMode === 'hold') {
    $('scan-hold').querySelector('span').textContent = 'Registra';
    $('hold-hint').textContent = 'Tieni premuto per leggere';
    $('scan-mode-note').textContent =
      'La fotocamera resta pronta, ma il lettore è attivo solo mentre tieni premuto Registra.';
  } else {
    $('scan-hold').querySelector('span').textContent = reading ? 'Annulla lettura' : 'Scansiona';
    $('hold-hint').textContent = reading ? 'Ricerca del codice in corso…' : 'Premi una volta per iniziare';
    $('scan-mode-note').textContent =
      'Premi Scansiona: la fotocamera si apre e continua a cercare finché trova un codice o annulli.';
  }
}

function renderSettings() {
  $('operator').value = settings.operator;
  $('operator-label').textContent = settings.operator || 'Operatore demo';
  $('theme').value = settings.theme;
  $('custom-color').value = settings.customColor;
  $('custom-hex').value = settings.customColor.toUpperCase();
  $('camera-ratio').value = settings.cameraRatio;
  $('camera-fit').value = settings.cameraFit;
  $('scan-mode').value = settings.scanMode;
  $('vibration-enabled').checked = settings.vibrationEnabled;
  $('auto-flash-enabled').checked = settings.autoFlashEnabled;

  setTheme(settings.theme);
  applyCameraOptions();
  renderScanMode();
}

async function setupDetector() {
  if (!('BarcodeDetector' in window)) return;
  try {
    const supported = await BarcodeDetector.getSupportedFormats();
    const wanted = ['ean_13','ean_8','code_128','code_39','upc_a','upc_e','qr_code']
      .filter(f => supported.includes(f));
    nativeDetector = new BarcodeDetector({formats:wanted.length ? wanted : supported});
  } catch {
    nativeDetector = null;
  }
}

async function startCamera() {
  if (cameraActive) return true;

  $('camera-closed').hidden = true;
  $('camera-live').hidden = false;

  if (!navigator.mediaDevices?.getUserMedia) {
    $('camera-message').textContent = 'Fotocamera non disponibile in questo browser.';
    return false;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{
        facingMode:{ideal:'environment'},
        width:{ideal:1280},
        height:{ideal:720}
      }
    });

    $('video').srcObject = stream;
    await $('video').play();
    cameraActive = true;

    const track = stream.getVideoTracks()[0];
    let torchAvailable = false;
    try { torchAvailable = Boolean(track?.getCapabilities?.().torch); } catch {}
    $('torch').hidden = !torchAvailable;

    $('camera-message').textContent =
      scanMode === 'hold'
        ? 'Fotocamera pronta. Tieni premuto Registra solo quando vuoi leggere.'
        : 'Fotocamera pronta. Premi Scansiona per cercare il codice.';
    return true;
  } catch (error) {
    cameraActive = false;
    $('camera-live').hidden = true;
    $('camera-closed').hidden = false;

    $('camera-message').textContent =
      error.name === 'NotAllowedError' ? 'Accesso alla fotocamera negato.' :
      error.name === 'NotFoundError' ? 'Nessuna fotocamera disponibile.' :
      'Non riesco ad avviare la fotocamera. Tocca Apri fotocamera per riprovare.';
    return false;
  }
}

function stopCamera({collapsed=true} = {}) {
  stopReading();
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  $('video').srcObject = null;
  cameraActive = false;
  torchOn = false;
  $('torch').hidden = true;
  $('torch-label').textContent = 'Torcia';

  if (collapsed) {
    $('camera-live').hidden = true;
    $('camera-closed').hidden = false;
  }
}

async function setTorch(next, {silent=false} = {}) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track || !cameraActive) return false;

  let available = false;
  try { available = Boolean(track.getCapabilities?.().torch); } catch {}
  if (!available) return false;

  try {
    await track.applyConstraints({advanced:[{torch:Boolean(next)}]});
    torchOn = Boolean(next);
    $('torch-label').textContent = torchOn ? 'Spegni' : 'Torcia';
    $('torch').setAttribute('aria-pressed', String(torchOn));
    return true;
  } catch {
    torchOn = false;
    $('torch-label').textContent = 'Torcia';
    $('torch').setAttribute('aria-pressed', 'false');
    if (!silent) $('camera-message').textContent = 'Torcia non disponibile su questo dispositivo.';
    return false;
  }
}

async function toggleTorch() {
  await setTorch(!torchOn);
}

async function detectionLoop(token) {
  const video = $('video');

  while (reading && token === holdToken && cameraActive) {
    if (nativeDetector && video.readyState >= 2) {
      try {
        const codes = await nativeDetector.detect(video);
        if (reading && token === holdToken && codes.length) {
          completeRead(codes[0].rawValue);
          return;
        }
      } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 120));
  }
}

function scheduleDemoFallback(token) {
  clearTimeout(detectionTimer);
  if (nativeDetector) return;

  detectionTimer = setTimeout(() => {
    if (reading && token === holdToken && cameraActive) {
      completeRead('800123456789' + (demoCount % 10));
    }
  }, scanMode === 'hold' ? 1400 : 1800);
}

async function startReading(event) {
  event?.preventDefault?.();
  if (reading) return;

  if (!cameraActive) {
    const started = await startCamera();
    if (!started) return;
  }

  reading = true;
  holdToken++;
  const token = holdToken;

  $('scan-hold').classList.add('is-held');
  $('camera-panel').classList.add('is-reading');

  if (settings.autoFlashEnabled) {
    setTorch(true, {silent:true});
  }

  if (scanMode === 'hold') {
    $('hold-hint').textContent = 'Lettura attiva · rilascia per fermare';
    $('camera-message').textContent = 'Lettura attiva soltanto mentre tieni premuto.';
  } else {
    $('scan-hold').querySelector('span').textContent = 'Annulla lettura';
    $('hold-hint').textContent = 'Ricerca del codice in corso…';
    $('camera-message').textContent = 'Lettura continua: fermala con Annulla oppure attendi il codice.';
  }

  detectionLoop(token);
  scheduleDemoFallback(token);
}

function stopReading(event) {
  event?.preventDefault?.();

  reading = false;
  holdToken++;
  clearTimeout(detectionTimer);
  detectionTimer = null;

  $('scan-hold')?.classList.remove('is-held');
  $('camera-panel')?.classList.remove('is-reading');

  if (settings.autoFlashEnabled && torchOn) {
    setTorch(false, {silent:true});
  }

  if (scanMode === 'continuous') {
    $('scan-hold').querySelector('span').textContent = 'Scansiona';
    $('hold-hint').textContent = 'Premi una volta per iniziare';
  } else {
    $('hold-hint').textContent = 'Tieni premuto per leggere';
  }

  if (cameraActive) {
    $('camera-message').textContent =
      scanMode === 'hold'
        ? 'Fotocamera pronta. Tieni premuto Registra solo quando vuoi leggere.'
        : 'Fotocamera pronta. Premi Scansiona per cercare il codice.';
  }
}

function completeRead(value) {
  if (!reading) return;

  $('barcode').value = value;
  stopReading();

  if (settings.vibrationEnabled) navigator.vibrate?.(70);

  stopCamera({collapsed:true});
  $('camera-message').textContent =
    'Codice riconosciuto. Fotocamera spenta; puoi riaprirla se vuoi leggere di nuovo.';
}

function renderRecords() {
  $('records').replaceChildren();

  for (const rec of demoRecords.slice().reverse()) {
    const li = document.createElement('li');
    li.className = 'record';
    li.dataset.state = rec.state;

    li.innerHTML = `
      <div class="record-top">
        <strong class="record-code"></strong>
        <span class="record-qty"></span>
      </div>
      <div class="record-bottom">
        <span class="record-meta"></span>
        <span class="record-state"></span>
      </div>`;

    li.querySelector('.record-code').textContent = rec.barcode;
    li.querySelector('.record-qty').textContent = 'Qtà ' + rec.quantity;
    li.querySelector('.record-meta').textContent =
      new Intl.DateTimeFormat('it-IT',{
        hour:'2-digit',minute:'2-digit',second:'2-digit'
      }).format(new Date(rec.at)) + ' · ' + rec.operator;
    li.querySelector('.record-state').textContent = rec.state === 'pending' ? 'In attesa' : 'Inviato';
    if (rec.state === 'pending') li.querySelector('.record-state').classList.add('pending');

    $('records').append(li);
  }

  demoCount = demoRecords.length;
  $('pending-count').textContent = demoCount + ' demo';
  $('empty-state').hidden = demoCount > 0;
  $('export-history').disabled = demoCount === 0;
  $('clear-history').disabled = !demoRecords.some(r => r.state === 'sent');
}

function addDemoRecord(barcode, quantity) {
  demoRecords.push({
    id: crypto.randomUUID?.() || String(Date.now()),
    barcode,
    quantity,
    operator: settings.operator || 'Davide Ceresa',
    at: new Date().toISOString(),
    state: 'sent'
  });
  renderRecords();
}

function csvCell(value) {
  const s = String(value ?? '');
  return '"' + s.replaceAll('"','""') + '"';
}

function exportHistory() {
  if (!demoRecords.length) return;
  const rows = [
    ['timestamp','barcode','quantita','operatore','stato'],
    ...demoRecords.map(r => [r.at,r.barcode,r.quantity,r.operator,r.state])
  ];
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'barcode-bipper-demo-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function clearSentHistory() {
  demoRecords = demoRecords.filter(r => r.state !== 'sent');
  renderRecords();
}

/* Hold-to-scan input: avoids native long-press haptic where possible. */
const holdButton = $('scan-hold');
holdButton.addEventListener('contextmenu', e => e.preventDefault());
holdButton.addEventListener('selectstart', e => e.preventDefault());
holdButton.addEventListener('dragstart', e => e.preventDefault());

holdButton.addEventListener('touchstart', e => {
  e.preventDefault();
  if (scanMode === 'hold') {
    if (!reading) startReading(e);
  }
}, {passive:false});

holdButton.addEventListener('touchend', e => {
  e.preventDefault();
  if (scanMode === 'hold') stopReading(e);
  else {
    if (reading) stopReading(e);
    else startReading(e);
  }
}, {passive:false});

holdButton.addEventListener('touchcancel', e => {
  e.preventDefault();
  if (scanMode === 'hold') stopReading(e);
}, {passive:false});

holdButton.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return;
  e.preventDefault();
  if (scanMode === 'hold') {
    try { holdButton.setPointerCapture(e.pointerId); } catch {}
    if (!reading) startReading(e);
  }
}, {passive:false});

holdButton.addEventListener('pointerup', e => {
  if (e.pointerType === 'touch') return;
  e.preventDefault();
  if (scanMode === 'hold') stopReading(e);
  else {
    if (reading) stopReading(e);
    else startReading(e);
  }
}, {passive:false});

holdButton.addEventListener('pointercancel', e => {
  if (e.pointerType === 'touch') return;
  if (scanMode === 'hold') stopReading(e);
}, {passive:false});

holdButton.addEventListener('keydown', e => {
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  e.preventDefault();
  if (scanMode === 'hold') {
    if (!e.repeat && !reading) startReading(e);
  } else if (!e.repeat) {
    if (reading) stopReading(e);
    else startReading(e);
  }
});
holdButton.addEventListener('keyup', e => {
  if ((e.code === 'Space' || e.code === 'Enter') && scanMode === 'hold') {
    e.preventDefault();
    stopReading(e);
  }
});
holdButton.addEventListener('click', e => e.preventDefault());

$('camera-closed').addEventListener('click', async () => {
  const ok = await startCamera();
  if (ok && scanMode === 'continuous') startReading();
});
$('torch').addEventListener('click', toggleTorch);

/* Configuration placeholders. */
$('demo-choose-sheet').addEventListener('click', () => {
  const state = $('demo-connection-state');
  state.classList.remove('ok');
  state.querySelector('span:last-child').textContent =
    'Demo: qui si aprirebbe la scelta del Google Sheet.';
});
$('demo-test-connection').addEventListener('click', () => {
  const state = $('demo-connection-state');
  state.classList.add('ok');
  state.querySelector('span:last-child').textContent =
    'Demo: connessione simulata con successo.';
});
$('demo-save-config').addEventListener('click', () => {
  const state = $('demo-connection-state');
  state.classList.add('ok');
  state.querySelector('span:last-child').textContent =
    'Demo: configurazione simulata come salvata.';
});

/* Drawer. */
function openDrawer() {
  $('drawer-backdrop').hidden = false;
  requestAnimationFrame(() => {
    $('drawer-backdrop').classList.add('open');
    $('app-drawer').classList.add('open');
  });
  $('app-drawer').setAttribute('aria-hidden','false');
  $('menu-open').setAttribute('aria-expanded','true');
  document.body.classList.add('drawer-open');
}
function closeDrawer() {
  $('drawer-backdrop').classList.remove('open');
  $('app-drawer').classList.remove('open');
  $('app-drawer').setAttribute('aria-hidden','true');
  $('menu-open').setAttribute('aria-expanded','false');
  document.body.classList.remove('drawer-open');
  setTimeout(() => {
    if (!$('app-drawer').classList.contains('open')) $('drawer-backdrop').hidden = true;
  }, 180);
}
$('menu-open').addEventListener('click', openDrawer);
$('menu-close').addEventListener('click', closeDrawer);
$('drawer-backdrop').addEventListener('click', closeDrawer);
$('drawer-settings').addEventListener('click', () => {
  closeDrawer();
  setTimeout(() => $('settings-dialog').showModal(), 120);
});
$('drawer-config').addEventListener('click', () => {
  closeDrawer();
  setTimeout(() => $('config-dialog').showModal(), 120);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('app-drawer').classList.contains('open')) closeDrawer();
});

/* Settings. */
$('operator').addEventListener('input', () => {
  settings.operator = $('operator').value.trim();
  $('operator-label').textContent = settings.operator || 'Operatore demo';
  saveSettings();
});

$('theme').addEventListener('change', () => {
  settings.theme = $('theme').value;
  setTheme(settings.theme);
  saveSettings();
});

function commitCustomHex(value) {
  let v = value.trim().toUpperCase();
  if (!v.startsWith('#')) v = '#' + v;
  const valid = /^#[0-9A-F]{6}$/.test(v);
  $('custom-color-error').hidden = valid;
  if (!valid) return;

  settings.customColor = v;
  $('custom-color').value = v;
  $('custom-hex').value = v;
  if (settings.theme === 'custom') applyCustomColor(v);
  saveSettings();
}

$('custom-color').addEventListener('input', () => {
  commitCustomHex($('custom-color').value);
});
$('custom-hex').addEventListener('change', () => {
  commitCustomHex($('custom-hex').value);
});

$('camera-ratio').addEventListener('change', () => {
  settings.cameraRatio = $('camera-ratio').value;
  applyCameraOptions();
  saveSettings();
});
$('camera-fit').addEventListener('change', () => {
  settings.cameraFit = $('camera-fit').value;
  applyCameraOptions();
  saveSettings();
});

$('scan-mode').addEventListener('change', () => {
  stopReading();
  settings.scanMode = $('scan-mode').value;
  saveSettings();
  renderScanMode();

  if (settings.scanMode === 'continuous') {
    stopCamera({collapsed:true});
    $('camera-message').textContent =
      'Modalità Scan2Sheets: premi Apri fotocamera; la lettura continua fino al primo codice.';
  } else {
    startCamera();
  }
});

$('vibration-enabled').addEventListener('change', () => {
  settings.vibrationEnabled = $('vibration-enabled').checked;
  saveSettings();
});

$('auto-flash-enabled').addEventListener('change', () => {
  settings.autoFlashEnabled = $('auto-flash-enabled').checked;
  if (!settings.autoFlashEnabled && torchOn) setTorch(false, {silent:true});
  saveSettings();
});

$('reset-defaults').addEventListener('click', async () => {
  const operator = settings.operator;

  stopReading();
  settings = {
    ...defaultSettings,
    operator
  };
  saveSettings();
  renderSettings();

  if (cameraActive) {
    if (torchOn) await setTorch(false, {silent:true});
  } else if (settings.scanMode === 'hold') {
    await startCamera();
  }

  $('feedback').hidden = false;
  $('feedback').className = 'feedback';
  $('feedback').textContent = 'Preferenze ripristinate ai valori predefiniti.';
});

/* Quantity + registration. */
$('minus').addEventListener('click', () => {
  $('quantity').value = Math.max(0, Number($('quantity').value || 0) - 1);
});
$('plus').addEventListener('click', () => {
  $('quantity').value = Number($('quantity').value || 0) + 1;
});

$('record-form').addEventListener('submit', event => {
  event.preventDefault();
  const barcode = $('barcode').value.trim();
  const quantity = Number($('quantity').value || 0);

  if (!barcode) {
    $('feedback').hidden = false;
    $('feedback').className = 'feedback error';
    $('feedback').textContent = 'Inserisci un codice oppure leggilo con la fotocamera.';
    return;
  }

  addDemoRecord(barcode, quantity);
  $('feedback').hidden = false;
  $('feedback').className = 'feedback';
  $('feedback').textContent = 'Registrazione demo aggiunta localmente.';
  $('barcode').value = '';
  $('quantity').value = '1';
});

/* History. */
$('export-history').addEventListener('click', exportHistory);
$('clear-history').addEventListener('click', () => $('clear-history-dialog').showModal());
$('confirm-clear-history').addEventListener('click', () => {
  clearSentHistory();
  $('feedback').hidden = false;
  $('feedback').className = 'feedback';
  $('feedback').textContent = 'Cronologia locale svuotata. Nessun dato esterno è stato modificato.';
});

window.addEventListener('online', () => $('network').textContent = 'Online');
window.addEventListener('offline', () => $('network').textContent = 'Senza rete');

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopReading();
    if (cameraActive) stopCamera({collapsed:true});
  }
});


/* Keep touch/wheel scrolling inside open dialogs instead of the page below. */
function syncModalLock() {
  document.body.classList.toggle('modal-open', Boolean(document.querySelector('dialog[open]')));
}

for (const dialog of document.querySelectorAll('dialog')) {
  new MutationObserver(syncModalLock).observe(dialog, {
    attributes:true,
    attributeFilter:['open']
  });
  dialog.addEventListener('close', syncModalLock);
  dialog.addEventListener('cancel', () => setTimeout(syncModalLock, 0));
}

const previewPanel = new URLSearchParams(location.search).get('preview');

(async () => {
  renderSettings();
  renderRecords();
  await setupDetector();

  if (!previewPanel) {
    if (scanMode === 'hold') await startCamera();
    else {
      $('camera-live').hidden = true;
      $('camera-closed').hidden = false;
      $('camera-message').textContent =
        'Modalità Scan2Sheets: premi Apri fotocamera per iniziare la lettura continua.';
    }
  }
})();

if (['drawer','settings','config','clear'].includes(previewPanel)) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (previewPanel === 'drawer') openDrawer();
      if (previewPanel === 'settings') $('settings-dialog').showModal();
      if (previewPanel === 'config') $('config-dialog').showModal();
      if (previewPanel === 'clear') {
        addDemoRecord('8001234567890', 1);
        $('clear-history-dialog').showModal();
      }
    }, 250);
  });
}
