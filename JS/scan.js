/* ---------------------------------------------------------------
   scan.js — logique d'affichage uniquement. Toute la logique
   métier (quotas, points de contrôle, géolocalisation) vient
   désormais de api.js, chargé avant ce fichier.
   --------------------------------------------------------------- */

var session = getSession();

if (!session || !session.email) {
  window.location.href = 'login.html';
}

var scanTitleEl = document.getElementById('scan-title');
var scanLedeEl  = document.getElementById('scan-lede');
var viewfinder  = document.getElementById('viewfinder');
var statusText  = document.getElementById('status-text');
var btn         = document.getElementById('camera-btn');
var hintText    = document.getElementById('hint-text');
var errorText   = document.getElementById('error-text');

var role = session ? session.role : 'apprenant';
scanLedeEl.textContent = 'Rendez-vous devant ' + CHECKPOINT_LABELS[role] + ' et scannez le QR code affiché pour valider votre entrée.';

/* ---------------------------------------------------------------
   Blocage préventif : on connaît déjà le quota du jour avant
   même d'ouvrir la caméra.
   --------------------------------------------------------------- */
function showQuotaBlocked(count, quota) {
  viewfinder.classList.add('is-blocked');
  statusText.textContent = 'Quota atteint (' + count + '/' + quota + ')';
  scanTitleEl.textContent = 'Scan déjà effectué';
  scanLedeEl.textContent = 'Vous avez déjà atteint votre quota de scans pour aujourd’hui (' + count + '/' + quota + '). Réessayez demain.';
  btn.hidden = true;
  hintText.hidden = true;
}

(async function checkExistingQuota() {
  if (!session || !session.email) return;
  var ownQuota = quotaFor(role);
  var ownLog = await getScanLog(session.email);
  if (ownLog.length >= ownQuota) {
    showQuotaBlocked(ownLog.length, ownQuota);
  }
})();

/* ---------------------------------------------------------------
   Scan caméra (html5-qrcode)
   --------------------------------------------------------------- */
var html5QrCode = null;
var hasSucceeded = false;

function showError(message) {
  errorText.textContent = message;
  errorText.hidden = false;
  statusText.textContent = 'Caméra indisponible';
  viewfinder.classList.remove('is-reading');
}

function showLocationBlocked(message) {
  viewfinder.classList.add('is-blocked');
  statusText.textContent = 'Position hors zone';
  scanTitleEl.textContent = 'Vous n’êtes pas à BloLab';
  scanLedeEl.textContent = message;
  btn.disabled = false;
  btn.hidden = false;
  btn.textContent = 'Réessayer';
  btn.onclick = function () { window.location.reload(); };
  hintText.hidden = true;
}

function showRejected(result, decodedText) {
  viewfinder.classList.remove('is-reading');
  viewfinder.classList.add('is-blocked');
  statusText.textContent = 'Scan refusé';
  scanTitleEl.textContent = result.reason === 'quota_reached' ? 'Scan déjà effectué' : 'Ce n’est pas le bon point de contrôle';
  scanLedeEl.textContent = result.message;
  hintText.hidden = false;
  hintText.textContent = 'Contenu lu : ' + decodedText;
  btn.textContent = 'Réessayer';
  btn.disabled = false;
  btn.hidden = false;
  btn.onclick = function () { window.location.reload(); };
}

function onScanSuccess(decodedText, currentCoords) {
  if (hasSucceeded) return;
  hasSucceeded = true;

  html5QrCode.stop().then(async function () {
    var result = await submitScan(decodedText, role, session.email, currentCoords);

    if (!result.ok) {
      showRejected(result, decodedText);
      return;
    }

    viewfinder.classList.remove('is-reading');
    viewfinder.classList.add('is-success');
    statusText.textContent = 'Accès validé';
    scanTitleEl.textContent = 'Accès validé';
    scanLedeEl.textContent = 'Bienvenue — entrée enregistrée (' + result.count + '/' + result.quota + ' aujourd’hui).';
    hintText.hidden = false;
    hintText.textContent = 'Point de contrôle : ' + CHECKPOINT_LABELS[role];

    var isPersonnel = role === 'personnel';
    btn.textContent = isPersonnel ? 'Aller à mon tableau de bord' : 'Retour à l’accueil';
    btn.disabled = false;
    btn.hidden = false;
    btn.onclick = function () { window.location.href = isPersonnel ? 'dashboard.html' : 'login.html'; };
  }).catch(function () {
    viewfinder.classList.add('is-success');
  });
}

function onScanFailure() {
  /* appelé en continu tant qu'aucun QR n'est détecté — on ignore volontairement */
}

function startScanning(coords) {
  if (typeof Html5Qrcode === 'undefined') {
    showError('La librairie de scan n’a pas pu se charger. Vérifiez votre connexion internet.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Démarrage de la caméra…';
  errorText.hidden = true;

  html5QrCode = new Html5Qrcode('reader');

  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10 },
    function (decodedText) { onScanSuccess(decodedText, coords); },
    onScanFailure
  ).then(function () {
    btn.hidden = true;
    viewfinder.classList.add('is-reading');
    statusText.textContent = 'Recherche du QR code…';
  }).catch(function () {
    btn.disabled = false;
    btn.textContent = 'Activer la caméra pour scanner';
    showError('Impossible d’accéder à la caméra : autorisation refusée, aucun appareil trouvé, ou page ouverte hors HTTPS/localhost.');
  });
}

/* ---------------------------------------------------------------
   Géolocalisation : on vérifie la position AVANT d'ouvrir la caméra,
   pour empêcher un scan à partir d'une photo prise ailleurs.
   --------------------------------------------------------------- */
async function checkLocationThenScan() {
  btn.disabled = true;
  btn.textContent = 'Vérification de votre position…';
  statusText.textContent = 'Localisation en cours…';
  errorText.hidden = true;

  var coords;
  try {
    coords = await getCurrentCoords();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Activer la caméra pour scanner';
    var msg = 'Impossible de vérifier votre position.';
    if (err.code === err.PERMISSION_DENIED) {
      msg = 'La géolocalisation a été refusée. Elle est obligatoire pour scanner : autorisez-la dans les réglages du navigateur.';
    } else if (err.code === err.TIMEOUT) {
      msg = 'La localisation a pris trop de temps à répondre. Réessayez, de préférence à l’extérieur ou près d’une fenêtre.';
    } else if (err.message) {
      msg = err.message;
    }
    showError(msg);
    return;
  }

  var check = isWithinBlolabRange(coords);
  if (!check.withinRange) {
    showLocationBlocked(
      'Le scan n’est autorisé que sur place, à BloLab. Vous semblez être à environ ' +
      Math.round(check.distance) + ' m du site (précision GPS incluse).'
    );
    return;
  }

  startScanning(coords);
}

btn.addEventListener('click', checkLocationThenScan);
