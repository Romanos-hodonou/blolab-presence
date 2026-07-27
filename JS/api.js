/* ==========================================================================
   BloLab — api.js
   Couche unique d'accès aux données. Toutes les pages (login.js, signup.js,
   scan.js, dashboard.js) doivent passer par les fonctions de ce fichier
   plutôt que de parler à localStorage ou au réseau directement.

   COMMENT ÇA MARCHE :
   - Tant que MOCK_MODE = true, tout est simulé avec localStorage (comme
     avant), pour continuer à développer/tester sans backend.
   - Le jour où le vrai serveur est prêt : passez MOCK_MODE à false et
     réglez BASE_URL. Aucune autre page n'a besoin d'être modifiée, tant
     que le serveur respecte le contrat d'API décrit plus bas.
   ========================================================================== */

var API_CONFIG = {
  MOCK_MODE: true,                          // ⚠️ passer à false une fois le backend prêt
  BASE_URL: 'http://localhost:5000/api'     // ⚠️ à remplacer par la vraie adresse une fois hébergé
};

/* ==========================================================================
   1. COUCHE TRANSPORT — communication HTTP brute avec le backend
   ========================================================================== */

async function apiRequest(method, endpoint, data, token) {
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  var options = { method: method, headers: headers };
  if (data !== undefined && data !== null) options.body = JSON.stringify(data);

  var response;
  try {
    response = await fetch(API_CONFIG.BASE_URL + endpoint, options);
  } catch (networkErr) {
    throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion ou que le backend est démarré.');
  }

  var body = null;
  try { body = await response.json(); } catch (parseErr) { /* réponse vide ou non-JSON, on ignore */ }

  if (!response.ok) {
    var message = (body && (body.message || body.error)) || ('Erreur serveur (' + response.status + ')');
    throw new Error(message);
  }

  return body;
}

function apiGet(endpoint, token)          { return apiRequest('GET', endpoint, null, token); }
function apiPost(endpoint, data, token)   { return apiRequest('POST', endpoint, data, token); }
function apiPut(endpoint, data, token)    { return apiRequest('PUT', endpoint, data, token); }
function apiDelete(endpoint, token)       { return apiRequest('DELETE', endpoint, null, token); }

/* ==========================================================================
   2. SESSION — qui est connecté, côté navigateur
   Reste toujours en localStorage (même en mode réel) : c'est la façon
   normale de garder un token/utilisateur côté client entre deux pages.
   ========================================================================== */

function getSession() {
  try { return JSON.parse(localStorage.getItem('blolab_session')); }
  catch (err) { return null; }
}

function saveSession(session) {
  try { localStorage.setItem('blolab_session', JSON.stringify(session)); }
  catch (err) { /* stockage indisponible (navigation privée, quota plein...) */ }
}

function clearSession() {
  try { localStorage.removeItem('blolab_session'); }
  catch (err) {}
}

/* ==========================================================================
   3. AUTHENTIFICATION
   Contrat backend attendu :
     POST /auth/login   { email, password }        → { token, user }
     POST /auth/signup  { name, email, password,
                           role, detail }           → { token, user }
   où user = { id, name, email, role, isAdmin }
   ========================================================================== */

async function login(email, password, fallbackRole) {
  if (API_CONFIG.MOCK_MODE) {
    // Démo : pas de vérification de mot de passe, on retrouve juste le
    // membre par e-mail s'il existe déjà (auto-inscrit ou ajouté par un admin).
    var member = await findMemberByEmail(email);
    var session = {
      role: member ? member.role : (fallbackRole || 'apprenant'),
      email: email,
      name: member ? member.name : '',
      isAdmin: member ? !!member.isAdmin : false
    };
    saveSession(session);
    return session;
  }

  var result = await apiPost('/auth/login', { email: email, password: password });
  var session = Object.assign({ token: result.token }, result.user);
  saveSession(session);
  return session;
}

async function signup(data) {
  // data = { name, email, password, role, detail, isAdminRequested }
  if (API_CONFIG.MOCK_MODE) {
    var member = {
      id: 'm_' + Date.now(),
      name: data.name,
      email: data.email,
      role: data.role,
      detail: data.detail || '',
      isAdmin: !!data.isAdminRequested,   // ⚠️ voir avertissement plus bas
      createdAt: new Date().toISOString()
    };
    await upsertMember(member);
    var session = {
      role: member.role, email: member.email, name: member.name, isAdmin: member.isAdmin
    };
    saveSession(session);
    return session;
  }

  var result = await apiPost('/auth/signup', data);
  var session = Object.assign({ token: result.token }, result.user);
  saveSession(session);
  return session;

  // ⚠️ IMPORTANT pour le vrai backend : le champ isAdmin ne doit JAMAIS être
  // accepté tel quel depuis le formulaire d'inscription. Le serveur doit
  // toujours créer isAdmin=false à l'inscription, quoi qu'envoie le client.
  // Seul un admin existant peut promouvoir quelqu'un ensuite (voir updateMember).
}

function logout() {
  clearSession();
}

/* ==========================================================================
   4. MEMBRES — CRUD (création/lecture/modification/suppression)
   Contrat backend attendu :
     GET    /members                → [ member, ... ]
     GET    /members/:email         → member | 404
     POST   /members                → member          (admin uniquement)
     PUT    /members/:id            → member           (admin uniquement)
     DELETE /members/:id            → { deleted: true } (admin uniquement)
   ========================================================================== */

async function getMembers() {
  if (API_CONFIG.MOCK_MODE) {
    try { return JSON.parse(localStorage.getItem('blolab_members')) || []; }
    catch (err) { return []; }
  }
  var session = getSession();
  return apiGet('/members', session && session.token);
}

async function saveMembersMock(members) {
  try { localStorage.setItem('blolab_members', JSON.stringify(members)); }
  catch (err) {}
}

async function findMemberByEmail(email) {
  if (API_CONFIG.MOCK_MODE) {
    var members = await getMembers();
    return members.find(function (m) {
      return m.email.toLowerCase() === (email || '').toLowerCase();
    }) || null;
  }
  var session = getSession();
  try {
    return await apiGet('/members/' + encodeURIComponent(email), session && session.token);
  } catch (err) {
    return null; // 404 = membre inconnu, pas une vraie erreur ici
  }
}

async function upsertMember(member) {
  // Utilisé par signup() : crée le membre, ou met à jour s'il existe déjà.
  if (API_CONFIG.MOCK_MODE) {
    var members = await getMembers();
    var idx = members.findIndex(function (m) { return m.email.toLowerCase() === member.email.toLowerCase(); });
    if (idx > -1) { members[idx] = member; } else { members.push(member); }
    await saveMembersMock(members);
    return member;
  }
  var session = getSession();
  return apiPost('/members', member, session && session.token);
}

async function createMember(member) {
  // Utilisé par le panneau admin "Ajouter un membre" (contourne l'inscription publique).
  return upsertMember(Object.assign({ id: 'm_' + Date.now(), createdAt: new Date().toISOString() }, member));
}

async function updateMember(id, updates) {
  if (API_CONFIG.MOCK_MODE) {
    var members = await getMembers();
    members = members.map(function (m) { return m.id === id ? Object.assign({}, m, updates) : m; });
    await saveMembersMock(members);
    return members.find(function (m) { return m.id === id; });
  }
  var session = getSession();
  return apiPut('/members/' + id, updates, session && session.token);
}

async function deleteMember(id) {
  if (API_CONFIG.MOCK_MODE) {
    var members = await getMembers();
    members = members.filter(function (m) { return m.id !== id; });
    await saveMembersMock(members);
    return { deleted: true };
  }
  var session = getSession();
  return apiDelete('/members/' + id, session && session.token);
}

/* ==========================================================================
   5. POINTS DE CONTRÔLE (QR codes fixes, un par lieu)
   Contrat backend attendu :
     GET  /checkpoints                  → { apprenant: {token, generatedAt}, personnel: {...} }
     POST /checkpoints/:role/regenerate → { token, generatedAt }   (admin uniquement)
   ========================================================================== */

var CHECKPOINT_LABELS = {
  apprenant: 'la salle de formation',
  personnel: 'les bureaux du personnel'
};

function genCheckpointToken() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
}

// Format du QR affiché au mur : blolab://checkpoint/<role>/<token>
function buildCheckpointPayload(role, token) {
  return 'blolab://checkpoint/' + role + '/' + token;
}

function parseCheckpointPayload(text) {
  var match = /^blolab:\/\/checkpoint\/([a-z]+)\/(.+)$/.exec((text || '').trim());
  if (!match) return null;
  return { role: match[1], token: match[2] };
}

async function getCheckpoints() {
  if (API_CONFIG.MOCK_MODE) {
    var cp = {};
    try { cp = JSON.parse(localStorage.getItem('blolab_checkpoints')) || {}; } catch (err) {}
    var changed = false;
    ['apprenant', 'personnel'].forEach(function (role) {
      if (!cp[role]) { cp[role] = { token: genCheckpointToken(), generatedAt: new Date().toISOString() }; changed = true; }
    });
    if (changed) { try { localStorage.setItem('blolab_checkpoints', JSON.stringify(cp)); } catch (err) {} }
    return cp;
  }
  var session = getSession();
  return apiGet('/checkpoints', session && session.token);
}

async function regenerateCheckpoint(role) {
  if (API_CONFIG.MOCK_MODE) {
    var cp = await getCheckpoints();
    cp[role] = { token: genCheckpointToken(), generatedAt: new Date().toISOString() };
    try { localStorage.setItem('blolab_checkpoints', JSON.stringify(cp)); } catch (err) {}
    return cp[role];
  }
  var session = getSession();
  return apiPost('/checkpoints/' + role + '/regenerate', {}, session && session.token);
}

/* ==========================================================================
   6. SCANS & QUOTAS
   Contrat backend attendu :
     POST /scans          { checkpointToken, role, lat?, lng? }
                           → { ok, count, quota } ou { ok:false, reason }
     GET  /attendance/:role?date=YYYY-MM-DD
                           → [ { name, email, arrival, departure } ]  (admin uniquement)

   ⚠️ IMPORTANT : la validation du quota ET de la géolocalisation doit être
   refaite côté serveur dans la vraie version. Un utilisateur peut toujours
   modifier le JavaScript de son propre navigateur — les vérifications ici
   ne protègent qu'un usage normal, pas quelqu'un de déterminé à tricher.
   ========================================================================== */

function quotaFor(role) {
  return role === 'personnel' ? 2 : 1;
}

function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function getScanLog(email, date) {
  date = date || todayKey();
  if (API_CONFIG.MOCK_MODE) {
    try { return JSON.parse(localStorage.getItem('blolab_scanlog:' + email + ':' + date)) || []; }
    catch (err) { return []; }
  }
  var session = getSession();
  return apiGet('/scans/' + encodeURIComponent(email) + '?date=' + date, session && session.token);
}

async function recordScanMock(email) {
  var date = todayKey();
  var key = 'blolab_scanlog:' + email + ':' + date;
  var log = await getScanLog(email, date);
  log.push(new Date().toISOString());
  try { localStorage.setItem(key, JSON.stringify(log)); } catch (err) {}
  return log.length;
}

/**
 * Point d'entrée unique utilisé par scan.html : vérifie le QR scanné,
 * le quota du jour, puis enregistre le scan si tout est valide.
 * coords = { lat, lng } optionnel, transmis au serveur pour vérification
 * côté backend en mode réel (recommandé, plus fiable que la vérification
 * uniquement côté navigateur).
 */
async function submitScan(decodedText, expectedRole, email, coords) {
  var parsed = parseCheckpointPayload(decodedText);
  if (!parsed) {
    return { ok: false, reason: 'invalid_format', message: 'Ce QR code n’est pas reconnu comme un point de contrôle BloLab.' };
  }
  if (parsed.role !== expectedRole) {
    return {
      ok: false, reason: 'wrong_checkpoint',
      message: 'Ce QR appartient au point de contrôle "' + parsed.role + '", pas au vôtre. Rendez-vous devant ' + CHECKPOINT_LABELS[expectedRole] + '.'
    };
  }

  if (API_CONFIG.MOCK_MODE) {
    var checkpoints = await getCheckpoints();
    var expected = checkpoints[expectedRole];
    if (!expected || expected.token !== parsed.token) {
      return { ok: false, reason: 'stale_token', message: 'Ce code a été remplacé par un plus récent. Vérifiez l’affichage avec le personnel.' };
    }

    var quota = quotaFor(expectedRole);
    var currentCount = (await getScanLog(email)).length;
    if (currentCount >= quota) {
      return { ok: false, reason: 'quota_reached', count: currentCount, quota: quota, message: 'Quota de scans déjà atteint pour aujourd’hui (' + currentCount + '/' + quota + ').' };
    }

    var newCount = await recordScanMock(email);
    return { ok: true, count: newCount, quota: quota };
  }

  var session = getSession();
  var payload = { checkpointToken: parsed.token, role: expectedRole };
  if (coords) { payload.lat = coords.lat; payload.lng = coords.lng; }
  return apiPost('/scans', payload, session && session.token);
}

async function getAttendance(role, date) {
  date = date || todayKey();
  if (API_CONFIG.MOCK_MODE) {
    var members = (await getMembers()).filter(function (m) { return m.role === role; });
    var rows = [];
    for (var i = 0; i < members.length; i++) {
      var m = members[i];
      var log = await getScanLog(m.email, date);
      rows.push({ name: m.name, email: m.email, arrival: log[0] || null, departure: log[1] || null });
    }
    return rows;
  }
  var session = getSession();
  return apiGet('/attendance/' + role + '?date=' + date, session && session.token);
}

/* ==========================================================================
   7. GÉOLOCALISATION — vérifie que le scan a lieu physiquement à BloLab
   ⚠️ Coordonnées provisoires : à remplacer par les vraies (voir explication
   fournie précédemment : Google Maps → clic droit → coordonnées).
   ========================================================================== */

var BLOLAB_LAT = 6.3882;
var BLOLAB_LNG = 2.3820;
var MAX_DISTANCE_METERS = 150;

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

function getCurrentCoords() {
  return new Promise(function (resolve, reject) {
    if (!navigator.geolocation) {
      reject(new Error('Votre navigateur ne prend pas en charge la géolocalisation.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (position) {
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      function (err) {
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

function isWithinBlolabRange(coords) {
  var distance = haversineMeters(coords.lat, coords.lng, BLOLAB_LAT, BLOLAB_LNG);
  return { withinRange: distance <= MAX_DISTANCE_METERS, distance: distance };
}
