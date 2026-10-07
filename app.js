const $ = id => document.getElementById(id);
let stream = null;
let cameraActive = false;
let torchOn = false;
let reading = false;
let demoCount = 0;

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

async function startCamera() {
  if (cameraActive) return true;
  if (!navigator.mediaDevices?.getUserMedia) {
    $('camera-message').textContent = 'Fotocamera non disponibile in questo browser.';
    return false;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}
    });

    $('video').srcObject = stream;
    await $('video').play();
    cameraActive = true;

    $('camera-toggle').textContent = 'Camera on · Spegni';
    $('camera-toggle').setAttribute('aria-pressed','true');

    const track = stream.getVideoTracks()[0];
    let torchAvailable = false;
    try { torchAvailable = Boolean(track?.getCapabilities?.().torch); } catch {}
    $('torch').hidden = !torchAvailable;

    $('camera-message').textContent = 'Inquadra il codice e premi Leggi ora.';
    return true;
  } catch (error) {
    $('camera-message').textContent =
      error.name === 'NotAllowedError' ? 'Accesso alla fotocamera negato.' :
      error.name === 'NotFoundError' ? 'Nessuna fotocamera disponibile.' :
      'Non riesco ad avviare la fotocamera.';
    return false;
  }
}

function stopCamera() {
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  $('video').srcObject = null;
  cameraActive = false;
  torchOn = false;
  $('torch').hidden = true;
  $('camera-toggle').textContent = 'Camera off · Accendi';
  $('camera-toggle').setAttribute('aria-pressed','false');
  $('camera-message').textContent = 'Camera spenta. Puoi comunque inserire un codice manualmente.';
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

async function fakeRead() {
  if (reading) return;
  if (!cameraActive && !(await startCamera())) return;

  reading = true;
  $('scan-label').textContent = 'Lettura in corso…';
  $('camera-panel').classList.add('is-reading');
  $('camera-message').textContent = 'Demo: simulazione lettura…';

  setTimeout(() => {
    const demoCode = '800123456789' + String((demoCount % 10));
    $('barcode').value = demoCode;
    $('camera-panel').classList.remove('is-reading');
    $('camera-success').hidden = false;
    $('camera-message').textContent = 'Codice demo letto. Controlla la quantità e premi Registra.';
    navigator.vibrate?.(60);

    setTimeout(() => $('camera-success').hidden = true, 800);
    $('scan-label').textContent = 'Leggi ora';
    reading = false;
  }, 900);
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
    new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date()) +
    ' · ' + ($('operator').value.trim() || 'Davide Ceresa');

  $('records').prepend(li);
  $('empty-state').hidden = true;
  $('pending-count').textContent = demoCount + (demoCount === 1 ? ' demo' : ' demo');
}

$('settings-open').addEventListener('click', () => $('settings-dialog').showModal());

$('operator').addEventListener('input', () => {
  $('operator-label').textContent = $('operator').value.trim() || 'Operatore demo';
});

$('theme').addEventListener('change', () => setTheme($('theme').value));
$('camera-ratio').addEventListener('change', applyCameraOptions);
$('camera-fit').addEventListener('change', applyCameraOptions);

$('camera-toggle').addEventListener('click', () => cameraActive ? stopCamera() : startCamera());
$('torch').addEventListener('click', toggleTorch);
$('scan').addEventListener('click', fakeRead);

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
    $('feedback').textContent = 'Inserisci un codice oppure premi Leggi ora.';
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
  if (document.hidden && cameraActive) stopCamera();
});

setTheme('burgundy');
applyCameraOptions();
startCamera();
