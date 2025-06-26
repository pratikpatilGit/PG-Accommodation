const express = require("express");
const router = express.Router();

// Privacy Policy
router.get("/privacy", (req, res) => {
  res.render("policies/privacy");
});

// Terms of Service
router.get("/terms", (req, res) => {
  res.render("policies/terms");
});

// Cookie Policy
router.get("/cookies", (req, res) => {
  res.render("policies/cookies");
});

module.exports = router; 