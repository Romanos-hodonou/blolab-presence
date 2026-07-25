const express = require("express");
const cors = require("cors");
require("dotenv").config();
const pool = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour lire le JSON
app.use(cors());
app.use(express.json());

// Test de connexion a la base de donnees
pool.getConnection()
  .then(() => console.log("Connexion MySQL reussie"))
  .catch((err) => console.error("Erreur de connexion MySQL :", err.message));

// Route de test
app.get("/", (req, res) => {
    res.send("Bienvenue sur l'API Blolab !");
});

// Lancement du serveur
app.listen(PORT, () => {
    console.log(`Serveur lance sur http://localhost:${PORT}`);
});