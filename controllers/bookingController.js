const Listing = require("../models/listing");
const Booking = require("../models/Booking");
const ExpressError = require("../utils/ExpressError");
const wrapAsync = require("../utils/wrapAsync");
const { razorpay } = require("../config/payment");

// Initialize booking form
module.exports.initBooking = wrapAsync(async (req, res) => {
  const { listingId } = req.params;
  const listing = await Listing.findById(listingId);

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  res.render("bookings/new", { 
    listing,
    user: req.user
  });
});

module.exports.createBooking = wrapAsync(async (req, res) => {
  const { listingId } = req.params;
  const { startDate, endDate, paymentMethod } = req.body;

  console.log("Incoming booking request:", {
    listingId,
    startDate,
    endDate,
    paymentMethod,
    user: req.user ? req.user._id : 'No user'
  });

  if (!startDate || !endDate || !paymentMethod) {
      console.log("Missing required fields:", { startDate, endDate, paymentMethod });
      return res.status(400).json({
          success: false,
          message: "Missing required fields: startDate, endDate, or paymentMethod"
      });
  }

  try {
      const listing = await Listing.findById(listingId);
      if (!listing) {
          console.log("Listing not found:", listingId);
          return res.status(404).json({
              success: false,
              message: "Listing not found!"
          });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          console.log("Invalid date format:", { start, end });
          return res.status(400).json({
              success: false,
              message: "Invalid date format!"
          });
      }

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (start < today) {
          console.log("Start date in past:", { start, today });
          return res.status(400).json({
              success: false,
              message: "Start date cannot be in the past"
          });
      }

      if (start >= end) {
          console.log("Invalid date range:", { start, end });
          return res.status(400).json({
              success: false,
              message: "End date must be after start date"
          });
      }

      const isAvailable = await Booking.checkAvailability(listingId, start, end);
      if (!isAvailable) {
          console.log("Dates not available:", { listingId, start, end });
          return res.status(400).json({
              success: false,
              message: "Selected dates are not available!"
          });
      }

      const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      const totalPrice = nights * listing.rent;
      const initialPayment = listing.pre_reservation_amount;

      console.log("Creating Razorpay order with:", {
        amount: Math.round(initialPayment * 100),
        currency: "INR",
        receipt: `booking_${Date.now()}`
      });

      // Create Razorpay order
      let razorpayOrder;
      try {
          console.log("Attempting to create Razorpay order with credentials:", {
              key_id: process.env.RAZORPAY_KEY_ID,
              amount: Math.round(initialPayment * 100),
              currency: "INR",
              receipt: `booking_${Date.now()}`
          });

          razorpayOrder = await razorpay.orders.create({
              amount: Math.round(initialPayment * 100),
              currency: "INR",
              receipt: `booking_${Date.now()}`
          });
          console.log("Razorpay order created successfully:", razorpayOrder);
      } catch (error) {
          console.error("Razorpay order creation error details:", {
              message: error.message,
              stack: error.stack,
              response: error.response ? error.response.data : null,
              status: error.status,
              code: error.code
          });
          return res.status(500).json({
              success: false,
              message: "Failed to create payment order",
              error: error.message,
              details: error.response ? error.response.data : null
          });
      }

      console.log("Creating booking with:", {
          listing: listingId,
          user: req.user._id,
          startDate: start,
          endDate: end,
          pricePerNight: listing.rent,
          nights,
          totalPrice,
          initialPayment,
          status: "pending_payment",
          paymentMethod,
          razorpayOrderId: razorpayOrder.id
      });

      const booking = new Booking({
          listing: listingId,
          user: req.user._id,
          startDate: start,
          endDate: end,
          pricePerNight: listing.rent,
          nights: nights,
          totalPrice: totalPrice,
          initialPayment: initialPayment,
          status: "pending_payment",
          paymentMethod,
          razorpayOrderId: razorpayOrder.id
      });

      try {
          await booking.save();
          console.log("Booking saved successfully:", booking);
      } catch (error) {
          console.error("Booking save error:", error);
          return res.status(500).json({
              success: false,
              message: "Failed to save booking",
              error: error.message
          });
      }

      // Return JSON response for AJAX requests
      if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
          console.log("Sending success response for AJAX request");
          return res.status(201).json({
              success: true,
              bookingId: booking._id,
              message: "Booking created successfully",
              key: process.env.RAZORPAY_KEY_ID,
              amount: initialPayment,
              currency: "INR",
              orderId: razorpayOrder.id
          });
      }

      // Redirect for non-AJAX requests
      req.flash("success", "Booking created successfully! Please complete the pre-reservation payment.");
      return res.redirect(`/payments/initiate/${booking._id}`);

  } catch (error) {
      console.error("Booking creation error:", error);
      console.error("Error stack:", error.stack);

      // Return JSON error response for AJAX requests
      if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
          return res.status(500).json({
              success: false,
              message: "An error occurred while creating the booking",
              error: error.message
          });
      }

      req.flash("error", "An error occurred while creating the booking");
      return res.redirect(`/listings/${listingId}/bookings/new`);
  }
});

// Get booking details
module.exports.getBookingDetails = wrapAsync(async (req, res) => {
  const { id } = req.params;
  const booking = await Booking.findById(id)
    .populate("listing")
    .populate("user")
    .populate("payment");

  if (!booking) {
    req.flash("error", "Booking not found!");
    return res.redirect("/listings");
  }

  // Check if user is authorized to view this booking
  if (!booking.user._id.equals(req.user._id) && !booking.listing.owner.equals(req.user._id)) {
    req.flash("error", "You don't have permission to view this booking!");
    return res.redirect("/listings");
  }

  res.render("bookings/show", { booking });
});

// Cancel booking
module.exports.cancelBooking = wrapAsync(async (req, res) => {
  const { id } = req.params;
  const booking = await Booking.findById(id)
    .populate("listing")
    .populate("user");

  if (!booking) {
    req.flash("error", "Booking not found!");
    return res.redirect("/bookings");
  }

  // Check if user is authorized to cancel this booking
  if (!booking.user._id.equals(req.user._id) && !booking.listing.owner.equals(req.user._id)) {
    req.flash("error", "You don't have permission to cancel this booking!");
    return res.redirect("/bookings");
  }

  // Only allow cancellation of pending or confirmed bookings
  if (!["pending", "confirmed", "reserved"].includes(booking.status)) {
    req.flash("error", "This booking cannot be cancelled!");
    return res.redirect("/bookings");
  }

  try {
    // Update booking status to cancelled
    booking.status = "cancelled";
    await booking.save();

    // If there's a payment, handle refund if needed
    if (booking.payment && booking.payment.status === 'succeeded') {
      // Add refund logic here if needed
      // For now, we'll just mark the payment as refunded
      booking.payment.status = 'refunded';
      await booking.payment.save();
    }

    req.flash("success", "Booking cancelled successfully!");
    res.redirect("/bookings");
  } catch (error) {
    console.error("Error cancelling booking:", error);
    req.flash("error", "Failed to cancel booking. Please try again.");
    res.redirect("/bookings");
  }
});

// Get all user bookings
module.exports.getUserBookings = wrapAsync(async (req, res) => {
  // Find all listings owned by the current user
  const userListings = await Listing.find({ owner: req.user._id });
  const userListingIds = userListings.map(listing => listing._id);

  // Find bookings where either:
  // 1. The user is the guest (booked the property)
  // 2. The user is the owner of the property
  const bookings = await Booking.find({
    $or: [
      { user: req.user._id }, // User's own bookings
      { listing: { $in: userListingIds } } // Bookings for user's properties
    ]
  })
    .populate({
      path: "listing",
      select: "title location images bedrooms bathrooms maxGuests rent area propertyType availableFrom description owner"
    })
    .populate({
      path: "user",
      select: "username email phone"
    })
    .populate("payment")
    .sort({ createdAt: -1 });

  // Separate bookings into two categories with null checks
  const userBookings = bookings.filter(booking => 
    booking.user && booking.user._id && booking.user._id.equals(req.user._id)
  );
  
  const ownerBookings = bookings.filter(booking => 
    booking.listing && booking.listing._id && userListingIds.includes(booking.listing._id)
  );

  res.render("bookings/index", { 
    bookings,
    userBookings,
    ownerBookings,
    isOwner: userListingIds.length > 0
  });
});

// Delete booking
module.exports.deleteBooking = wrapAsync(async (req, res) => {
  const { id } = req.params;
  const booking = await Booking.findById(id)
    .populate("listing")
    .populate("user");

  if (!booking) {
    req.flash("error", "Booking not found!");
    return res.redirect("/bookings");
  }

  // Check if user is authorized to delete this booking
  if (!booking.user._id.equals(req.user._id) && !booking.listing.owner.equals(req.user._id)) {
    req.flash("error", "You don't have permission to delete this booking!");
    return res.redirect("/bookings");
  }

  try {
    // If there's a payment, handle refund if needed
    if (booking.payment && booking.payment.status === 'succeeded') {
      // Add refund logic here if needed
      // For now, we'll just mark the payment as refunded
      booking.payment.status = 'refunded';
      await booking.payment.save();
    }

    // Delete the booking
    await Booking.findByIdAndDelete(id);

    req.flash("success", "Booking deleted successfully!");
    res.redirect("/bookings");
  } catch (error) {
    console.error("Error deleting booking:", error);
    req.flash("error", "Failed to delete booking. Please try again.");
    res.redirect("/bookings");
  }
}); 