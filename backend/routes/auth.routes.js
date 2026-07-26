const express = require("express");
const router = express.Router();
const { login, me } = require("../controllers/auth.controller");
const verifierToken = require("../middleware/auth.middleware");

router.post("/login", login);
router.get("/me", verifierToken, me);

module.exports = router;
