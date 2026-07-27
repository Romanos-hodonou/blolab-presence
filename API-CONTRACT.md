# Contrat d'API — BloLab Présence

Ce document décrit les routes que le backend doit fournir pour que le frontend (déjà construit, dans `JS/api.js`) fonctionne sans modification. Le frontend a été développé en mode "mock" (localStorage) en suivant exactement ce contrat — respecter les noms de routes et la forme des réponses ci-dessous permet de brancher les deux côtés sans y retoucher.

**Base URL** : à définir ensemble (ex. `https://api.blolab-presence.com` en production, `http://localhost:5000/api` en local).

**Format** : toutes les requêtes et réponses sont en JSON (`Content-Type: application/json`).

**Authentification** : après connexion/inscription, le frontend reçoit un `token`. Il l'envoie ensuite dans l'en-tête de chaque requête qui en a besoin :
```
Authorization: Bearer <token>
```

---

## Format d'erreur attendu

Pour toute réponse en erreur (code HTTP 4xx ou 5xx), le corps doit contenir un message lisible :
```json
{ "message": "Description compréhensible de l'erreur" }
```
Le frontend affiche ce `message` directement à l'utilisateur — évitez donc les messages techniques bruts (stack traces, etc.).

---

## 1. Authentification

### `POST /auth/login`
**Body envoyé :**
```json
{ "email": "camille@blolab.org", "password": "••••••••" }
```
**Réponse attendue (200) :**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "m_123",
    "name": "Camille Dubois",
    "email": "camille@blolab.org",
    "role": "personnel",
    "isAdmin": false
  }
}
```
**Erreurs à prévoir** : 401 si e-mail/mot de passe incorrect.

⚠️ Le mot de passe doit être vérifié contre un **hash** stocké en base (ex. bcrypt) — jamais en clair.

---

### `POST /auth/signup`
**Body envoyé :**
```json
{
  "name": "Ayodélé Houénou",
  "email": "ayodele@example.com",
  "password": "motdepasse123",
  "role": "apprenant",
  "detail": "Bootcamp / Tech4Girls",
  "isAdminRequested": false
}
```
**Réponse attendue (201)** : même forme que `/auth/login`.

⚠️ **Sécurité critique** : le champ `isAdminRequested` envoyé par le formulaire public **doit toujours être ignoré**. Le compte créé doit systématiquement avoir `isAdmin: false`, quoi que le client envoie. Seul un admin existant peut promouvoir quelqu'un ensuite, via `PUT /members/:id`.

---

## 2. Membres

Toutes les routes de ce bloc, sauf mention contraire, nécessitent le header `Authorization`. Les routes de création/modification/suppression doivent en plus vérifier que l'utilisateur authentifié a bien `isAdmin: true` côté serveur (403 sinon).

### `GET /members`
Retourne la liste complète des membres.
```json
[
  { "id": "m_123", "name": "Camille Dubois", "email": "camille@blolab.org", "role": "personnel", "detail": "Formateur", "isAdmin": false, "createdAt": "2026-07-20T09:00:00.000Z" }
]
```

### `GET /members/:email`
Retourne un membre par e-mail, ou **404** si aucun membre ne correspond (pas une erreur bloquante — le frontend interprète ça comme "e-mail encore inconnu").

### `POST /members`
Crée un membre directement (utilisé par le panneau admin "Ajouter un membre", contourne l'inscription publique). Même corps que `/auth/signup` (sans `password` si le compte n'a pas vocation à se connecter seul).
**Réponse (201)** : le membre créé.

### `PUT /members/:id`
Body : champs à mettre à jour (partiel ou complet), ex. :
```json
{ "isAdmin": true }
```
**Réponse (200)** : le membre mis à jour.

### `DELETE /members/:id`
**Réponse (200)** :
```json
{ "deleted": true }
```

---

## 3. Points de contrôle (QR codes fixes)

Un point de contrôle par rôle (`apprenant`, `personnel`), affiché physiquement à l'entrée correspondante.

### `GET /checkpoints`
```json
{
  "apprenant": { "token": "AB12CD34", "generatedAt": "2026-07-27T08:00:00.000Z" },
  "personnel": { "token": "EF56GH78", "generatedAt": "2026-07-27T08:00:00.000Z" }
}
```

### `POST /checkpoints/:role/regenerate`
Réservé aux admins. Génère un nouveau `token` pour le rôle donné, invalidant l'ancien.
**Réponse (200)** :
```json
{ "token": "ZZ99YY88", "generatedAt": "2026-07-27T10:15:00.000Z" }
```

Le frontend construit lui-même le contenu affiché dans le QR à partir de ce token, sous la forme :
```
blolab://checkpoint/<role>/<token>
```
C'est ce texte-là qui sera lu au scan — le backend n'a pas besoin de le générer, seulement de fournir/valider le `token`.

---

## 4. Scans & présence

### `POST /scans`
**Body envoyé :**
```json
{
  "checkpointToken": "AB12CD34",
  "role": "apprenant",
  "lat": 6.370234,
  "lng": 2.391567
}
```
`lat`/`lng` sont la position GPS du téléphone au moment du scan — **le backend doit revérifier la distance par rapport aux coordonnées réelles de BloLab**, ne pas se fier uniquement à la vérification déjà faite côté navigateur (qui peut être contournée).

**Réponse en cas de succès (200) :**
```json
{ "ok": true, "count": 1, "quota": 1 }
```

**Réponse en cas de refus (200, pas une erreur HTTP — c'est un refus métier normal) :**
```json
{ "ok": false, "reason": "quota_reached", "count": 1, "quota": 1, "message": "Quota de scans déjà atteint pour aujourd'hui (1/1)." }
```
Valeurs possibles pour `reason` : `quota_reached`, `wrong_checkpoint`, `stale_token`, `out_of_range` (si la géolocalisation ne correspond pas).

**Règle de quota à appliquer côté serveur** : 1 scan/jour pour `apprenant`, 2 scans/jour pour `personnel` (le jour se calcule sur le fuseau horaire de l'atelier, minuit à minuit).

---

### `GET /attendance/:role?date=YYYY-MM-DD`
Réservé aux admins. `role` = `apprenant` ou `personnel`. `date` optionnelle, défaut = aujourd'hui.

**Réponse (200) :**
```json
[
  {
    "name": "Ayodélé Houénou",
    "email": "ayodele@example.com",
    "arrival": "2026-07-27T08:02:00.000Z",
    "departure": null
  }
]
```
`departure` est `null` si la personne n'a pas encore fait de second scan (concerne uniquement le personnel, qui a droit à 2 scans/jour — le premier vaut arrivée, le second vaut départ).

---

## Résumé des routes

| Méthode | Route | Auth requise | Admin requis |
|---|---|---|---|
| POST | `/auth/login` | non | non |
| POST | `/auth/signup` | non | non |
| GET | `/members` | oui | non* |
| GET | `/members/:email` | oui | non* |
| POST | `/members` | oui | **oui** |
| PUT | `/members/:id` | oui | **oui** |
| DELETE | `/members/:id` | oui | **oui** |
| GET | `/checkpoints` | oui | non* |
| POST | `/checkpoints/:role/regenerate` | oui | **oui** |
| POST | `/scans` | oui | non |
| GET | `/attendance/:role` | oui | **oui** |

\* *Ces routes ne modifient rien, mais réfléchissez ensemble à si un apprenant/personnel non-admin doit vraiment pouvoir lister tous les membres ou voir les tokens de checkpoint — le frontend actuel ne les affiche qu'aux admins, donc restreindre aussi côté serveur est cohérent et plus sûr.*

---

## Notes de sécurité à ne pas oublier

- Mots de passe : toujours hashés (bcrypt ou équivalent), jamais stockés/renvoyés en clair.
- `isAdmin` : jamais accepté depuis le formulaire d'inscription public, seulement modifiable via `PUT /members/:id` par quelqu'un déjà admin.
- Quota de scans et géolocalisation : revérifiés côté serveur, même si le frontend les vérifie déjà — le JavaScript du navigateur peut toujours être modifié par l'utilisateur.
- CORS : à activer côté serveur pour autoriser le domaine où sera hébergé le frontend (ex. Netlify) à appeler cette API.
