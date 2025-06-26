const express = require("express");
const router = express.Router();

// Privacy Policy route
router.get("/privacy", (req, res) => {
  res.render("legal/privacy");
});

// Terms of Service route
router.get("/terms", (req, res) => {
  res.render("legal/terms");
});

// Cookie Policy route
router.get("/cookies", (req, res) => {
  res.render("legal/cookies");
});

module.exports = router; 