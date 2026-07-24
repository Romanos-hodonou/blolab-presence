const express = require("express");

const app = express();
const PORT = 3000;

// Middleware pour lire le JSON
app.use(express.json());

// Route de test
app.get("/", (req, res) => {
    res.send("Bienvenue sur l'API Blolab !");
});

// Lancement du serveur
app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});