const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const { isLoggedIn } = require("../middleware");

// Get all user bookings
router.get("/bookings", isLoggedIn, bookingController.getUserBookings);

// Initialize booking form
router.get("/listings/:listingId/bookings/new", isLoggedIn, bookingController.initBooking);

// Create new booking
router.post("/listings/:listingId/bookings", isLoggedIn, bookingController.createBooking);

// Get booking details
router.get("/bookings/:id", isLoggedIn, bookingController.getBookingDetails);

// Cancel booking
router.post("/bookings/:id/cancel", isLoggedIn, bookingController.cancelBooking);

// Delete booking
router.post("/bookings/:id/delete", isLoggedIn, bookingController.deleteBooking);

module.exports = router; 