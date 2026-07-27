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

document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var email = document.getElementById('email').value;
  var btn = e.target.querySelector('.btn-primary');
  btn.classList.add('is-loading');
  btn.disabled = true;

  try {
    // login() vient de api.js : retrouve le membre existant si son e-mail
    // est connu, sinon utilise le rôle sélectionné dans l'interrupteur
    // Apprenant/Personnel comme repli — et enregistre la session.
    await login(email, undefined, roleInput.value);
    setTimeout(function () { window.location.href = 'scan.html'; }, 400);
  } catch (err) {
    btn.classList.remove('is-loading');
    btn.disabled = false;
    alert(err.message || 'Connexion impossible pour le moment.');
  }
});
