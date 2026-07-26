document.querySelectorAll('.toggle-visibility').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var input = document.getElementById(btn.dataset.target);
    var isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    btn.classList.toggle('is-active', isHidden);
  });
});

// Le badge se met à jour avec le nom saisi
var nameInput = document.getElementById('name');
var badgeName = document.getElementById('badge-name');
nameInput.addEventListener('input', function () {
  badgeName.textContent = nameInput.value.trim() || 'Votre nom ici';
});

// Bascule Apprenant / Personnel
var roleContent = {
  apprenant: {
    title: 'Fabriquez votre badge apprenant.',
    lede: 'Inscrivez-vous pour rejoindre une formation et accéder à l’atelier.',
    badgeLabel: 'NOUVEL APPRENANT',
    indicator: 'Vous créez un badge <strong>apprenant</strong>.',
    footnote: 'Déjà en formation ? <a href="login.html">Se connecter</a> · <a href="mailto:contact@blolab.org">contact@blolab.org</a>',
    redirect: 'scan.html'
  },
  personnel: {
    title: 'Créez votre accès personnel.',
    lede: 'Réservé à l’équipe BloLab : formateurs, techniciens, coordination.',
    badgeLabel: 'NOUVEAU PERSONNEL',
    indicator: 'Vous créez un badge <strong>personnel</strong>.',
    footnote: 'Accès réservé à l’équipe BloLab · <a href="mailto:contact@blolab.org">contact@blolab.org</a>',
    redirect: 'dashboard.html'
  }
};

var roleButtons     = document.querySelectorAll('.role-switch__btn');
var roleInput       = document.getElementById('role-input');
var titleEl         = document.getElementById('form-title');
var ledeEl          = document.getElementById('form-lede');
var footnoteEl      = document.getElementById('form-footnote');
var badgeLabel      = document.getElementById('badge-label');
var badgeRole       = document.getElementById('badge-role');
var roleIndicator   = document.getElementById('role-indicator');
var fieldProgramme  = document.getElementById('field-programme');
var fieldPoste      = document.getElementById('field-poste');
var programmeSelect = document.getElementById('programme');
var posteSelect     = document.getElementById('poste');

function syncBadgeRole() {
  var role = roleInput.value;
  if (role === 'apprenant') {
    badgeRole.textContent = programmeSelect.options[programmeSelect.selectedIndex].text;
  } else {
    badgeRole.textContent = posteSelect.options[posteSelect.selectedIndex].text;
  }
}

function setRole(role) {
  var data = roleContent[role];
  roleInput.value = role;
  titleEl.textContent = data.title;
  ledeEl.textContent = data.lede;
  footnoteEl.innerHTML = data.footnote;
  badgeLabel.textContent = data.badgeLabel;
  roleIndicator.innerHTML = data.indicator;

  var isApprenant = role === 'apprenant';
  fieldProgramme.hidden = !isApprenant;
  fieldPoste.hidden = isApprenant;

  roleButtons.forEach(function (b) {
    var active = b.dataset.role === role;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', active);
  });

  syncBadgeRole();
}

roleButtons.forEach(function (b) {
  b.addEventListener('click', function () { setRole(b.dataset.role); });
});
programmeSelect.addEventListener('change', syncBadgeRole);
posteSelect.addEventListener('change', syncBadgeRole);
syncBadgeRole();

// Indicateur simple de robustesse du mot de passe
var pwd = document.getElementById('password');
var bars = document.querySelectorAll('.strength span');
pwd.addEventListener('input', function () {
  var val = pwd.value;
  var score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
  if (/\d/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  bars.forEach(function (bar, i) {
    bar.classList.toggle('is-filled', i < score);
  });
});

function upsertMember(member) {
  var members = [];
  try { members = JSON.parse(localStorage.getItem('blolab_members')) || []; } catch (err) {}
  var idx = members.findIndex(function (m) { return m.email.toLowerCase() === member.email.toLowerCase(); });
  if (idx > -1) { members[idx] = member; } else { members.push(member); }
  try { localStorage.setItem('blolab_members', JSON.stringify(members)); } catch (err) {}
}

document.getElementById('signup-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var role = roleInput.value;
  var name = nameInput.value;
  var email = document.getElementById('email').value;
  var isAdmin = role === 'personnel' && document.getElementById('is-admin').checked;
  var detail = role === 'apprenant'
    ? programmeSelect.options[programmeSelect.selectedIndex].text
    : posteSelect.options[posteSelect.selectedIndex].text;

  var member = {
    id: 'm_' + Date.now(),
    name: name, email: email, role: role, detail: detail, isAdmin: isAdmin,
    createdAt: new Date().toISOString()
  };

  // Démo front-end uniquement : simule une inscription + une session locale.
  // À remplacer par une vraie création de compte côté serveur.
  upsertMember(member);
  try {
    localStorage.setItem('blolab_session', JSON.stringify({ role: role, name: name, email: email, isAdmin: isAdmin }));
  } catch (err) { /* stockage indisponible, on continue sans */ }

  var btn = e.target.querySelector('.btn-primary');
  btn.classList.add('is-loading');
  btn.disabled = true;
  setTimeout(function () {
    window.location.href = 'scan.html';
  }, 650);
});
