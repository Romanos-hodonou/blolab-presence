// Démo front-end : lit la session simulée créée à la connexion/inscription.
var session = null;
try { session = JSON.parse(localStorage.getItem('blolab_session')); } catch (err) {}

if (!session) {
  window.location.href = 'login.html';
} else {
  var name = session.name || session.email || 'Personnel';
  document.getElementById('welcome-title').textContent = 'Bonjour, ' + name.split('@')[0].split(' ')[0] + '.';
  document.getElementById('dash-user').textContent = name.split('@')[0] + (session.isAdmin ? ' — Admin' : ' — Personnel');
}

document.getElementById('logout-link').addEventListener('click', function (e) {
  e.preventDefault();
  try { localStorage.removeItem('blolab_session'); } catch (err) {}
  window.location.href = 'login.html';
});

/* ---------------------------------------------------------------
   Carte "Mon accès aujourd'hui"
   --------------------------------------------------------------- */
function todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function quotaFor(role) { return role === 'personnel' ? 2 : 1; }

if (session) {
  var quota = quotaFor(session.role);
  var log = [];
  try { log = JSON.parse(localStorage.getItem('blolab_scanlog:' + session.email + ':' + todayKey())) || []; } catch (err) {}
  var count = log.length;
  var statusEl = document.getElementById('access-status-text');
  if (count >= quota) {
    statusEl.textContent = 'Entrée validée (' + count + '/' + quota + ') ✅';
  } else {
    statusEl.innerHTML = 'Pas encore scanné aujourd’hui (0/' + quota + '). <a href="scan.html">Scanner maintenant →</a>';
  }
}

/* ---------------------------------------------------------------
   Panneau admin : Gestion des membres
   (localStorage sert de base de données de démonstration)
   --------------------------------------------------------------- */
if (session && session.isAdmin) {
  document.getElementById('admin-panel').hidden = false;
  document.getElementById('qr-panel').hidden = false;
}

function getMembers() {
  try { return JSON.parse(localStorage.getItem('blolab_members')) || []; }
  catch (err) { return []; }
}
function saveMembers(members) {
  try { localStorage.setItem('blolab_members', JSON.stringify(members)); } catch (err) {}
}

var tableBody   = document.getElementById('member-table-body');
var emptyState  = document.getElementById('member-empty');
var form        = document.getElementById('member-form');
var addBtn      = document.getElementById('add-member-btn');
var cancelBtn   = document.getElementById('cancel-member-btn');
var idField     = document.getElementById('member-id');
var nameField   = document.getElementById('member-name');
var emailField  = document.getElementById('member-email');
var roleField   = document.getElementById('member-role');
var detailField = document.getElementById('member-detail');
var adminField  = document.getElementById('member-admin');

function renderMembers() {
  var members = getMembers();
  tableBody.innerHTML = '';
  emptyState.hidden = members.length > 0;

  members.forEach(function (m) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + m.name + (m.isAdmin ? ' <span class="tag-admin">admin</span>' : '') + '</td>' +
      '<td>' + m.email + '</td>' +
      '<td><span class="tag-role tag-role--' + m.role + '">' + m.role + '</span></td>' +
      '<td>' + (m.detail || '—') + '</td>' +
      '<td class="member-table__actions">' +
        '<button type="button" class="link-action" data-edit="' + m.id + '">Modifier</button>' +
        '<button type="button" class="link-action link-action--danger" data-delete="' + m.id + '">Supprimer</button>' +
      '</td>';
    tableBody.appendChild(tr);
  });
}

function resetForm() {
  idField.value = '';
  nameField.value = '';
  emailField.value = '';
  roleField.value = 'apprenant';
  detailField.value = '';
  adminField.checked = false;
  document.getElementById('save-member-btn').textContent = 'Enregistrer';
}

addBtn.addEventListener('click', function () {
  resetForm();
  form.hidden = false;
  nameField.focus();
});

cancelBtn.addEventListener('click', function () {
  form.hidden = true;
  resetForm();
});

tableBody.addEventListener('click', function (e) {
  var editId = e.target.getAttribute('data-edit');
  var deleteId = e.target.getAttribute('data-delete');

  if (editId) {
    var member = getMembers().find(function (m) { return m.id === editId; });
    if (!member) return;
    idField.value = member.id;
    nameField.value = member.name;
    emailField.value = member.email;
    roleField.value = member.role;
    detailField.value = member.detail || '';
    adminField.checked = !!member.isAdmin;
    document.getElementById('save-member-btn').textContent = 'Mettre à jour';
    form.hidden = false;
    nameField.focus();
  }

  if (deleteId) {
    if (!confirm('Supprimer ce membre ?')) return;
    var members = getMembers().filter(function (m) { return m.id !== deleteId; });
    saveMembers(members);
    renderMembers();
  }
});

form.addEventListener('submit', function (e) {
  e.preventDefault();
  var members = getMembers();
  var isEditing = !!idField.value;

  var record = {
    id: isEditing ? idField.value : 'm_' + Date.now(),
    name: nameField.value.trim(),
    email: emailField.value.trim(),
    role: roleField.value,
    detail: detailField.value.trim(),
    isAdmin: adminField.checked,
    createdAt: new Date().toISOString()
  };

  if (isEditing) {
    members = members.map(function (m) { return m.id === record.id ? record : m; });
  } else {
    members.push(record);
  }

  saveMembers(members);
  renderMembers();
  form.hidden = true;
  resetForm();
});

renderMembers();

/* ---------------------------------------------------------------
   Génération des QR codes de point de contrôle
   Contenu encodé : blolab://checkpoint/<role>/<token>
   --------------------------------------------------------------- */
var checkpointLabels = { apprenant: 'la salle de formation', personnel: 'les bureaux du personnel' };

function genToken() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
}
function getCheckpoints() {
  try { return JSON.parse(localStorage.getItem('blolab_checkpoints')) || {}; }
  catch (err) { return {}; }
}
function saveCheckpoints(cp) {
  try { localStorage.setItem('blolab_checkpoints', JSON.stringify(cp)); } catch (err) {}
}
function ensureCheckpoints() {
  var cp = getCheckpoints();
  var changed = false;
  ['apprenant', 'personnel'].forEach(function (role) {
    if (!cp[role]) { cp[role] = { token: genToken(), generatedAt: new Date().toISOString() }; changed = true; }
  });
  if (changed) saveCheckpoints(cp);
  return cp;
}
function formatDate(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function renderCheckpointQR(role) {
  var cp = getCheckpoints();
  var entry = cp[role];
  var container = document.getElementById('qr-' + role);
  container.innerHTML = '';

  if (typeof QRCode === 'undefined') {
    container.textContent = 'Librairie QR non chargée.';
    return;
  }

  new QRCode(container, {
    text: 'blolab://checkpoint/' + role + '/' + entry.token,
    width: 160,
    height: 160,
    colorDark: '#0e2a33',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  document.getElementById('qr-' + role + '-meta').textContent =
    'Généré le ' + formatDate(entry.generatedAt) + ' — affiché devant ' + checkpointLabels[role];
}

if (session && session.isAdmin) {
  ensureCheckpoints();
  renderCheckpointQR('apprenant');
  renderCheckpointQR('personnel');

  document.querySelectorAll('[data-regenerate]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var role = btn.getAttribute('data-regenerate');
      if (!confirm('Régénérer ce code rendra l’affichage actuel invalide pour les prochains scans. Continuer ?')) return;
      var cp = getCheckpoints();
      cp[role] = { token: genToken(), generatedAt: new Date().toISOString() };
      saveCheckpoints(cp);
      renderCheckpointQR(role);
    });
  });
}

/* ---------------------------------------------------------------
   Impression : QR codes
   --------------------------------------------------------------- */
function printQR(role) {
  var container = document.getElementById('qr-' + role);
  var canvas = container.querySelector('canvas');
  var dataUrl = canvas ? canvas.toDataURL('image/png') : '';
  var label = role === 'apprenant' ? 'Apprenants — Salle de formation' : 'Personnel — Bureaux';
  var win = window.open('', '_blank', 'width=420,height=560');
  if (!win) { alert('Le navigateur a bloqué la fenêtre d’impression (pop-up). Autorisez les pop-ups pour ce site.'); return; }
  win.document.write(
    '<html><head><title>QR — ' + label + '</title><style>' +
    'body{font-family:sans-serif;text-align:center;padding:48px 24px;}' +
    'h1{font-size:1.05rem;margin-bottom:24px;}' +
    'img{width:260px;height:260px;}' +
    'p{color:#666;font-size:.8rem;margin-top:24px;}' +
    '</style></head><body>' +
    '<h1>BloLab — ' + label + '</h1>' +
    '<img src="' + dataUrl + '" alt="QR code">' +
    '<p>À afficher à l’entrée correspondante</p>' +
    '</body></html>'
  );
  win.document.close();
  win.focus();
  setTimeout(function () { win.print(); }, 350);
}

document.querySelectorAll('[data-print]').forEach(function (btn) {
  btn.addEventListener('click', function () { printQR(btn.getAttribute('data-print')); });
});

/* ---------------------------------------------------------------
   Présences du jour — deux tableaux (apprenants / personnel)
   --------------------------------------------------------------- */
function splitName(full) {
  var parts = (full || '').trim().split(/\s+/);
  if (parts.length < 2) return { prenom: parts[0] || '—', nom: '—' };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
}
function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
}
function memberScanLog(email) {
  try { return JSON.parse(localStorage.getItem('blolab_scanlog:' + email + ':' + todayKey())) || []; }
  catch (err) { return []; }
}

function renderAttendance() {
  var members = getMembers();

  var apprenants = members.filter(function (m) { return m.role === 'apprenant'; });
  var appBody = document.getElementById('attendance-apprenants-body');
  appBody.innerHTML = '';
  apprenants.forEach(function (m) {
    var n = splitName(m.name);
    var log = memberScanLog(m.email);
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + n.nom + '</td><td>' + n.prenom + '</td><td>' + fmtTime(log[0]) + '</td>';
    appBody.appendChild(tr);
  });
  document.getElementById('attendance-apprenants-empty').hidden = apprenants.length > 0;

  var personnel = members.filter(function (m) { return m.role === 'personnel'; });
  var persBody = document.getElementById('attendance-personnel-body');
  persBody.innerHTML = '';
  personnel.forEach(function (m) {
    var n = splitName(m.name);
    var log = memberScanLog(m.email);
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + n.nom + '</td><td>' + n.prenom + '</td><td>' + fmtTime(log[0]) + '</td><td>' + fmtTime(log[1]) + '</td>';
    persBody.appendChild(tr);
  });
  document.getElementById('attendance-personnel-empty').hidden = personnel.length > 0;
}
renderAttendance();

function printTable(tableId, title) {
  var table = document.getElementById(tableId);
  var win = window.open('', '_blank');
  if (!win) { alert('Le navigateur a bloqué la fenêtre d’impression (pop-up). Autorisez les pop-ups pour ce site.'); return; }
  win.document.write(
    '<html><head><title>' + title + '</title><style>' +
    'body{font-family:sans-serif;padding:32px;}' +
    'h1{font-size:1.15rem;margin-bottom:2px;}' +
    'p{color:#666;font-size:.82rem;margin-top:0;margin-bottom:22px;}' +
    'table{width:100%;border-collapse:collapse;}' +
    'th,td{border:1px solid #ccc;padding:8px 10px;text-align:left;font-size:.88rem;}' +
    'th{background:#f1ece1;}' +
    '</style></head><body>' +
    '<h1>' + title + '</h1>' +
    '<p>BloLab — ' + new Date().toLocaleDateString('fr-FR') + '</p>' +
    table.outerHTML +
    '</body></html>'
  );
  win.document.close();
  win.focus();
  setTimeout(function () { win.print(); }, 350);
}

document.getElementById('print-apprenants-btn').addEventListener('click', function () {
  printTable('attendance-apprenants-table', 'Présences du jour — Apprenants');
});
document.getElementById('print-personnel-btn').addEventListener('click', function () {
  printTable('attendance-personnel-table', 'Présences du jour — Personnel');
});
