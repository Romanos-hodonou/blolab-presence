/* ---------------------------------------------------------------
   Position de BloLab — ⚠️ À REMPLACER par les vraies coordonnées
   Comment les obtenir : ouvrez Google Maps sur place (ou cherchez
   l'adresse), clic droit sur le point exact du bâtiment → les
   coordonnées s'affichent en haut, prêtes à copier.
   --------------------------------------------------------------- */
var BLOLAB_LAT = 6.3703;          // ⚠️ placeholder — latitude réelle à renseigner
var BLOLAB_LNG = 2.3912;          // ⚠️ placeholder — longitude réelle à renseigner
var MAX_DISTANCE_METERS = 150;    // rayon toléré autour du point ci-dessus (marge pour l'imprécision GPS)

function haversineMeters(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var toRad = function (d) { return d * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1);
  var dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ---------------------------------------------------------------
   Stockage partagé (démo front-end — à remplacer par un backend)
   --------------------------------------------------------------- */
function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function quotaFor(role) { return role === 'personnel' ? 2 : 1; }
function getScanLog(identifier, date) {
  var key = 'blolab_scanlog:' + identifier + ':' + date;
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch (err) { return []; }
}
function scanCount(identifier) {
  return { count: getScanLog(identifier, todayKey()).length };
}
function registerScan(identifier) {
  var date = todayKey();
  var key = 'blolab_scanlog:' + identifier + ':' + date;
  var log = getScanLog(identifier, date);
  log.push(new Date().toISOString());
  try { localStorage.setItem(key, JSON.stringify(log)); } catch (err) {}
  return log.length;
}
function getCheckpoints() {
  try { return JSON.parse(localStorage.getItem('blolab_checkpoints')) || {}; }
  catch (err) { return {}; }
}

var checkpointLabels = {
  apprenant: 'la salle de formation',
  personnel: 'les bureaux du personnel'
};

/* ---------------------------------------------------------------
   Accès : il faut être connecté pour arriver sur cette page.
   --------------------------------------------------------------- */
var session = null;
try { session = JSON.parse(localStorage.getItem('blolab_session')); } catch (err) {}

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
scanLedeEl.textContent = 'Rendez-vous devant ' + checkpointLabels[role] + ' et scannez le QR code affiché pour valider votre entrée.';

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

if (session && session.email) {
  var ownQuota = quotaFor(role);
  var ownCount = scanCount(session.email).count;
  if (ownCount >= ownQuota) {
    showQuotaBlocked(ownCount, ownQuota);
  }
}

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

function showInvalid(message, decodedText) {
  viewfinder.classList.remove('is-reading');
  viewfinder.classList.add('is-blocked');
  statusText.textContent = 'QR code invalide';
  scanTitleEl.textContent = 'Ce n’est pas le bon point de contrôle';
  scanLedeEl.textContent = message;
  hintText.hidden = false;
  hintText.textContent = 'Contenu lu : ' + decodedText;
  btn.textContent = 'Réessayer';
  btn.disabled = false;
  btn.hidden = false;
  btn.onclick = function () { window.location.reload(); };
}

function onScanSuccess(decodedText) {
  if (hasSucceeded) return;

  // Le QR affiché au mur encode : blolab://checkpoint/<role>/<token>
  var match = /^blolab:\/\/checkpoint\/([a-z]+)\/(.+)$/.exec(decodedText.trim());
  var checkpoints = getCheckpoints();

  if (!match) {
    showInvalid('Ce QR code n’est pas reconnu comme un point de contrôle BloLab.', decodedText);
    html5QrCode.stop().catch(function () {});
    return;
  }

  var qrRole  = match[1];
  var qrToken = match[2];
  var expected = checkpoints[role];

  if (qrRole !== role) {
    hasSucceeded = true;
    html5QrCode.stop().then(function () {
      showInvalid('Ce QR appartient au point de contrôle "' + qrRole + '", pas au vôtre. Rendez-vous devant ' + checkpointLabels[role] + '.', decodedText);
    });
    return;
  }

  if (!expected || expected.token !== qrToken) {
    hasSucceeded = true;
    html5QrCode.stop().then(function () {
      showInvalid('Ce code a été remplacé par un plus récent. Vérifiez l’affichage avec le personnel.', decodedText);
    });
    return;
  }

  hasSucceeded = true;
  html5QrCode.stop().then(function () {
    var count = registerScan(session.email);
    var quota = quotaFor(role);

    viewfinder.classList.remove('is-reading');
    viewfinder.classList.add('is-success');
    statusText.textContent = 'Accès validé';
    scanTitleEl.textContent = 'Accès validé';
    scanLedeEl.textContent = 'Bienvenue — entrée enregistrée (' + count + '/' + quota + ' aujourd’hui).';
    hintText.hidden = false;
    hintText.textContent = 'Point de contrôle : ' + checkpointLabels[role];

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

function startScanning() {
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
    onScanSuccess,
    onScanFailure
  ).then(function () {
    btn.hidden = true;
    viewfinder.classList.add('is-reading');
    statusText.textContent = 'Recherche du QR code…';
  }).catch(function (err) {
    btn.disabled = false;
    btn.textContent = 'Activer la caméra pour scanner';
    showError('Impossible d’accéder à la caméra : autorisation refusée, aucun appareil trouvé, ou page ouverte hors HTTPS/localhost.');
  });
}

/* ---------------------------------------------------------------
   Géolocalisation : on vérifie la position AVANT d'ouvrir la caméra,
   pour empêcher un scan à partir d'une photo prise ailleurs.
   --------------------------------------------------------------- */
function checkLocationThenScan() {
  if (!navigator.geolocation) {
    showError('Votre navigateur ne prend pas en charge la géolocalisation : impossible de vérifier votre position.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Vérification de votre position…';
  statusText.textContent = 'Localisation en cours…';
  errorText.hidden = true;

  navigator.geolocation.getCurrentPosition(
    function (position) {
      var distance = haversineMeters(
        position.coords.latitude, position.coords.longitude,
        BLOLAB_LAT, BLOLAB_LNG
      );

      if (distance > MAX_DISTANCE_METERS) {
        showLocationBlocked(
          'Le scan n’est autorisé que sur place, à BloLab. Vous semblez être à environ ' +
          Math.round(distance) + ' m du site (précision GPS incluse).'
        );
        return;
      }

      startScanning();
    },
    function (err) {
      btn.disabled = false;
      btn.textContent = 'Activer la caméra pour scanner';
      var msg = 'Impossible de vérifier votre position.';
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'La géolocalisation a été refusée. Elle est obligatoire pour scanner : autorisez-la dans les réglages du navigateur.';
      } else if (err.code === err.TIMEOUT) {
        msg = 'La localisation a pris trop de temps à répondre. Réessayez, de préférence à l’extérieur ou près d’une fenêtre.';
      }
      showError(msg);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

btn.addEventListener('click', checkLocationThenScan);
