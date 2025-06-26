const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
  },
  user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
  },
  startDate: {
      type: Date,
      required: true,
  },
  endDate: {
      type: Date,
      required: true,
  },
  nights: {
      type: Number,
      required: true,
  },
  pricePerNight: {
      type: Number,
      required: true,
  },
  totalPrice: {
      type: Number,
      required: true,
  },
  initialPayment: {
      type: Number,
      required: true,
  },
  status: {
      type: String,
      enum: ["pending", "pending_payment", "confirmed", "cancelled", "completed"],
      default: "pending",
  },
  paymentMethod:{
      type: String,
      required: true,
  },
  razorpayOrderId: {
      type: String,
      required: true,
  },
  payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment"
  },
  createdAt: {
      type: Date,
      default: Date.now,
  },
}, {
  timestamps: true,
});

bookingSchema.statics.checkAvailability = async function(listingId, startDate, endDate) {
  const conflictingBookings = await this.find({
      listing: listingId,
      status: { $ne: "cancelled" },
      $or: [
          {
              startDate: { $lte: endDate },
              endDate: { $gte: startDate },
          },
      ],
  });
  return conflictingBookings.length === 0;
};

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;