/* ---------------------------------------------------------------
   dashboard.js — logique d'affichage uniquement. Toute la logique
   métier (membres, points de contrôle, présences) vient désormais
   de api.js, chargé avant ce fichier.
   --------------------------------------------------------------- */

var session = getSession();

if (!session) {
  window.location.href = 'login.html';
} else {
  var displayName = session.name || session.email || 'Personnel';
  document.getElementById('welcome-title').textContent = 'Bonjour, ' + displayName.split('@')[0].split(' ')[0] + '.';
  document.getElementById('dash-user').textContent = displayName.split('@')[0] + (session.isAdmin ? ' — Admin' : ' — Personnel');
}

document.getElementById('logout-link').addEventListener('click', function (e) {
  e.preventDefault();
  logout();
  window.location.href = 'login.html';
});

/* ---------------------------------------------------------------
   Carte "Mon accès aujourd'hui"
   --------------------------------------------------------------- */
(async function renderAccessStatus() {
  if (!session) return;
  var quota = quotaFor(session.role);
  var log = await getScanLog(session.email);
  var statusEl = document.getElementById('access-status-text');
  if (log.length >= quota) {
    statusEl.textContent = 'Entrée validée (' + log.length + '/' + quota + ') ✅';
  } else {
    statusEl.innerHTML = 'Pas encore scanné aujourd’hui (0/' + quota + '). <a href="scan.html">Scanner maintenant →</a>';
  }
})();

/* ---------------------------------------------------------------
   Panneau admin : Gestion des membres
   --------------------------------------------------------------- */
if (session && session.isAdmin) {
  document.getElementById('admin-panel').hidden = false;
  document.getElementById('qr-panel').hidden = false;
  document.getElementById('attendance-apprenants-section').hidden = false;
  document.getElementById('attendance-personnel-section').hidden = false;
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

async function renderMembers() {
  var members = await getMembers();
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

tableBody.addEventListener('click', async function (e) {
  var editId = e.target.getAttribute('data-edit');
  var deleteId = e.target.getAttribute('data-delete');

  if (editId) {
    var members = await getMembers();
    var member = members.find(function (m) { return m.id === editId; });
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
    await deleteMember(deleteId);
    renderMembers();
    renderAttendance();
  }
});

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  var isEditing = !!idField.value;

  var record = {
    name: nameField.value.trim(),
    email: emailField.value.trim(),
    role: roleField.value,
    detail: detailField.value.trim(),
    isAdmin: adminField.checked
  };

  if (isEditing) {
    await updateMember(idField.value, record);
  } else {
    await createMember(record);
  }

  renderMembers();
  renderAttendance();
  form.hidden = true;
  resetForm();
});

if (session && session.isAdmin) {
  renderMembers();
}

/* ---------------------------------------------------------------
   Génération des QR codes de point de contrôle
   --------------------------------------------------------------- */
async function renderCheckpointQR(role) {
  var checkpoints = await getCheckpoints();
  var entry = checkpoints[role];
  var container = document.getElementById('qr-' + role);
  container.innerHTML = '';

  if (typeof QRCode === 'undefined') {
    container.textContent = 'Librairie QR non chargée.';
    return;
  }

  new QRCode(container, {
    text: buildCheckpointPayload(role, entry.token),
    width: 160,
    height: 160,
    colorDark: '#0e2a33',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  var d = new Date(entry.generatedAt);
  var formatted = d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('qr-' + role + '-meta').textContent =
    'Généré le ' + formatted + ' — affiché devant ' + CHECKPOINT_LABELS[role];
}

if (session && session.isAdmin) {
  renderCheckpointQR('apprenant');
  renderCheckpointQR('personnel');

  document.querySelectorAll('[data-regenerate]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var role = btn.getAttribute('data-regenerate');
      if (!confirm('Régénérer ce code rendra l’affichage actuel invalide pour les prochains scans. Continuer ?')) return;
      await regenerateCheckpoint(role);
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

async function renderAttendance() {
  var apprenants = await getAttendance('apprenant');
  var appBody = document.getElementById('attendance-apprenants-body');
  appBody.innerHTML = '';
  apprenants.forEach(function (row) {
    var n = splitName(row.name);
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + n.nom + '</td><td>' + n.prenom + '</td><td>' + fmtTime(row.arrival) + '</td>';
    appBody.appendChild(tr);
  });
  document.getElementById('attendance-apprenants-empty').hidden = apprenants.length > 0;

  var personnel = await getAttendance('personnel');
  var persBody = document.getElementById('attendance-personnel-body');
  persBody.innerHTML = '';
  personnel.forEach(function (row) {
    var n = splitName(row.name);
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + n.nom + '</td><td>' + n.prenom + '</td><td>' + fmtTime(row.arrival) + '</td><td>' + fmtTime(row.departure) + '</td>';
    persBody.appendChild(tr);
  });
  document.getElementById('attendance-personnel-empty').hidden = personnel.length > 0;
}
if (session && session.isAdmin) {
  renderAttendance();
}

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
