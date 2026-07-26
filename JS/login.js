document.querySelectorAll('.toggle-visibility').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var input = document.getElementById(btn.dataset.target);
    var isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    btn.classList.toggle('is-active', isHidden);
  });
});

// Bascule Apprenant / Personnel
var roleContent = {
  apprenant: {
    title: 'Connectez-vous à l’atelier.',
    lede: 'Accédez à votre espace apprenant pour réserver les machines et suivre vos projets.',
    badgeLabel: 'MEMBRE — APPRENANT',
    badgeRole: 'Fabrication numérique',
    indicator: 'Vous vous connectez en tant qu’<strong>apprenant</strong>.',
    footnote: 'Pas encore apprenant ? <a href="https://blolab.org" target="_blank" rel="noopener">Découvrir les formations</a> · <a href="mailto:contact@blolab.org">contact@blolab.org</a>',
    redirect: 'scan.html'
  },
  personnel: {
    title: 'Connexion personnel.',
    lede: 'Accédez à l’espace encadrement pour gérer les réservations, les sessions et les membres.',
    badgeLabel: 'MEMBRE — PERSONNEL',
    badgeRole: 'Équipe encadrement',
    indicator: 'Vous vous connectez en tant que <strong>personnel</strong>.',
    footnote: 'Accès réservé à l’équipe BloLab · <a href="mailto:contact@blolab.org">contact@blolab.org</a>',
    redirect: 'dashboard.html'
  }
};

var roleButtons    = document.querySelectorAll('.role-switch__btn');
var roleInput      = document.getElementById('role-input');
var titleEl        = document.getElementById('form-title');
var ledeEl         = document.getElementById('form-lede');
var footnoteEl     = document.getElementById('form-footnote');
var badgeLabel     = document.getElementById('badge-label');
var badgeRole      = document.getElementById('badge-role');
var roleIndicator  = document.getElementById('role-indicator');

function setRole(role) {
  var data = roleContent[role];
  roleInput.value = role;
  titleEl.textContent = data.title;
  ledeEl.textContent = data.lede;
  footnoteEl.innerHTML = data.footnote;
  badgeLabel.textContent = data.badgeLabel;
  badgeRole.textContent = data.badgeRole;
  roleIndicator.innerHTML = data.indicator;

  roleButtons.forEach(function (b) {
    var active = b.dataset.role === role;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', active);
  });
}

roleButtons.forEach(function (b) {
  b.addEventListener('click', function () { setRole(b.dataset.role); });
});

function findMemberByEmail(email) {
  var members = [];
  try { members = JSON.parse(localStorage.getItem('blolab_members')) || []; } catch (err) {}
  return members.find(function (m) { return m.email.toLowerCase() === (email || '').toLowerCase(); }) || null;
}

document.getElementById('login-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var email = document.getElementById('email').value;
  var member = findMemberByEmail(email);

  // Démo front-end uniquement : simule une session locale.
  // Si l'e-mail correspond à un membre déjà connu (auto-inscrit ou ajouté par un admin),
  // on reprend son rôle réel plutôt que le sélecteur — à remplacer par une vraie authentification.
  var role = member ? member.role : roleInput.value;
  var sessionData = {
    role: role,
    email: email,
    name: member ? member.name : '',
    isAdmin: member ? !!member.isAdmin : false
  };
  try { localStorage.setItem('blolab_session', JSON.stringify(sessionData)); } catch (err) {}

  var btn = e.target.querySelector('.btn-primary');
  btn.classList.add('is-loading');
  btn.disabled = true;
  setTimeout(function () {
    window.location.href = 'scan.html';
  }, 650);
});
