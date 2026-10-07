const $ = id => document.getElementById(id);

let stream = null;
let cameraActive = false;
let torchOn = false;
let reading = false;
let holdToken = 0;
let detectionTimer = null;
let demoCount = 0;
let nativeDetector = null;

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  document.querySelector('meta[name="theme-color"]').content = accent;
}

function applyCameraOptions() {
  const panel = $('camera-panel');
  panel.classList.remove('ratio-wide','ratio-tall','ratio-portrait','fit-cover','fit-contain');
  panel.classList.add('ratio-' + $('camera-ratio').value, 'fit-' + $('camera-fit').value);
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
      'Fotocamera pronta. Tieni premuto Registra solo quando vuoi leggere.';
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
  $('torch').textContent = 'Torcia';

  if (collapsed) {
    $('camera-live').hidden = true;
    $('camera-closed').hidden = false;
  }
}

async function toggleTorch() {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return;

  try {
    torchOn = !torchOn;
    await track.applyConstraints({advanced:[{torch:torchOn}]});
    $('torch').textContent = torchOn ? 'Spegni torcia' : 'Torcia';
  } catch {
    torchOn = false;
    $('camera-message').textContent = 'Torcia non disponibile su questo dispositivo.';
  }
}

/* Lettura possibile soltanto mentre reading === true. */
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

function startReading(event) {
  if (!cameraActive || reading) return;

  event?.preventDefault?.();

  reading = true;
  holdToken++;
  const token = holdToken;

  $('scan-hold').classList.add('is-held');
  $('camera-panel').classList.add('is-reading');
  $('hold-hint').textContent = 'Lettura attiva · rilascia per fermare';
  $('camera-message').textContent = 'Lettura attiva soltanto mentre tieni premuto.';

  detectionLoop(token);

  /*
    Fallback vDemo:
    se il browser non supporta BarcodeDetector, simuliamo una lettura
    dopo 1,4 s DI PRESSIONE CONTINUA. Se rilasci prima, non succede nulla.
  */
  if (!nativeDetector) {
    clearTimeout(detectionTimer);
    detectionTimer = setTimeout(() => {
      if (reading && token === holdToken && cameraActive) {
        completeRead('800123456789' + (demoCount % 10));
      }
    }, 1400);
  }
}

function stopReading(event) {
  if (event) event.preventDefault();

  reading = false;
  holdToken++;
  clearTimeout(detectionTimer);
  detectionTimer = null;

  $('scan-hold')?.classList.remove('is-held');
  $('camera-panel')?.classList.remove('is-reading');

  if (cameraActive) {
    $('hold-hint').textContent = 'Tieni premuto per leggere';
    $('camera-message').textContent =
      'Fotocamera pronta. Tieni premuto Registra solo quando vuoi leggere.';
  }
}

function completeRead(value) {
  if (!reading) return;

  $('barcode').value = value;
  stopReading();

  /* Unica vibrazione intenzionale: avviene solo al riconoscimento. */
  navigator.vibrate?.(70);

  stopCamera({collapsed:true});

  $('camera-message').textContent =
    'Codice riconosciuto. Fotocamera spenta; puoi riaprirla se vuoi leggere di nuovo.';
}

function addDemoRecord(barcode, quantity) {
  demoCount++;

  const li = document.createElement('li');
  li.className = 'record';
  li.innerHTML = `
    <div class="record-top">
      <strong class="record-code"></strong>
      <span class="record-qty"></span>
    </div>
    <div class="record-bottom">
      <span class="record-meta"></span>
      <span class="record-state">Demo</span>
    </div>`;

  li.querySelector('.record-code').textContent = barcode;
  li.querySelector('.record-qty').textContent = 'Qtà ' + quantity;
  li.querySelector('.record-meta').textContent =
    new Intl.DateTimeFormat('it-IT',{
      hour:'2-digit',minute:'2-digit',second:'2-digit'
    }).format(new Date()) +
    ' · ' + ($('operator').value.trim() || 'Davide Ceresa');

  $('records').prepend(li);
  $('empty-state').hidden = true;
  $('pending-count').textContent = demoCount + ' demo';
}

/*
  Trigger di lettura volutamente NON nativo:
  è un <div role="button"> e non un <button>, così Android/Chrome
  ha meno motivi per applicare feedback aptico da long-press.

  Su touch usiamo touchstart/touchend con preventDefault().
  Su mouse/stilo usiamo Pointer Events ma ignoriamo pointerType="touch"
  per evitare un doppio avvio.
*/
const holdButton = $('scan-hold');

holdButton.addEventListener('contextmenu', e => e.preventDefault());
holdButton.addEventListener('selectstart', e => e.preventDefault());
holdButton.addEventListener('dragstart', e => e.preventDefault());

holdButton.addEventListener('touchstart', e => {
  e.preventDefault();
  if (!reading) startReading(e);
}, {passive:false});

holdButton.addEventListener('touchend', e => {
  e.preventDefault();
  stopReading(e);
}, {passive:false});

holdButton.addEventListener('touchcancel', e => {
  e.preventDefault();
  stopReading(e);
}, {passive:false});

holdButton.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return;
  e.preventDefault();
  try { holdButton.setPointerCapture(e.pointerId); } catch {}
  startReading(e);
}, {passive:false});

holdButton.addEventListener('pointerup', e => {
  if (e.pointerType === 'touch') return;
  e.preventDefault();
  stopReading(e);
}, {passive:false});

holdButton.addEventListener('pointercancel', e => {
  if (e.pointerType === 'touch') return;
  e.preventDefault();
  stopReading(e);
}, {passive:false});

holdButton.addEventListener('lostpointercapture', e => {
  if (e.pointerType === 'touch') return;
  stopReading(e);
});

/* Accessibilità da tastiera: tieni premuto Spazio/Invio. */
holdButton.addEventListener('keydown', e => {
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && !reading) {
    e.preventDefault();
    startReading(e);
  }
});
holdButton.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    stopReading(e);
  }
});

/* Evita il click sintetico dopo un'interazione touch. */
holdButton.addEventListener('click', e => e.preventDefault());

$('camera-closed').addEventListener('click', startCamera);
$('torch').addEventListener('click', toggleTorch);

$('settings-open').addEventListener('click', () => $('settings-dialog').showModal());

$('operator').addEventListener('input', () => {
  $('operator-label').textContent = $('operator').value.trim() || 'Operatore demo';
});

$('theme').addEventListener('change', () => setTheme($('theme').value));
$('camera-ratio').addEventListener('change', applyCameraOptions);
$('camera-fit').addEventListener('change', applyCameraOptions);

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

window.addEventListener('online', () => $('network').textContent = 'Online');
window.addEventListener('offline', () => $('network').textContent = 'Senza rete');

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopReading();
    if (cameraActive) stopCamera({collapsed:true});
  }
});

(async () => {
  setTheme('burgundy');
  applyCameraOptions();
  await setupDetector();

  /* La camera prova a partire subito all'apertura della pagina. */
  await startCamera();
})();
