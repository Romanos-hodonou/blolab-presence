
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

async function login(req, res) {
  const { email, password } = req.body;

  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  if (rows.length === 0) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }

  const user = rows[0];
  const motDePasseValide = await bcrypt.compare(password, user.password_hash);
  if (!motDePasseValide) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    role: user.role,
    nom: user.nom,
    prenom: user.prenom,
  });
}

module.exports = { login };