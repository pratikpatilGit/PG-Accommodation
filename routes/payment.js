const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { isLoggedIn } = require("../middleware");

// Initiate payment
router.post("/initiate/:id", isLoggedIn, paymentController.initiatePayment);

// Handle payment callback - explicitly handle JSON
router.post("/callback", express.json(), paymentController.handlePaymentCallback);

// Handle payment failure - explicitly handle JSON
router.post("/failure", express.json(), paymentController.handlePaymentFailure);

// View payment details
router.get("/:id", isLoggedIn, paymentController.viewPaymentDetails);

// Process refund
router.post("/:id/refund", isLoggedIn, paymentController.processRefund);


module.exports = router; 