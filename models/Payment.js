const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Booking",
    required: true,
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
  },
  razorpayOrderId: {
    type: String,
    required: true,
  },
  razorpayPaymentId: {
    type: String,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
    default: "INR",
  },
  method: {
    type: String,
    enum: ["credit card", "debit card", "net banking", "upi", "wallet"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "succeeded", "failed", "refunded"],
    default: "pending",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed,
  },
  refundDetails: {
    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
    },
    refundedAt: Date,
  },
  receiptUrl: {
    type: String,
  }
}, {
  timestamps: true,
});

// Method to update payment status
paymentSchema.methods.updateStatus = async function(newStatus) {
  this.status = newStatus;
  await this.save();
  
  // Update associated booking status
  const Booking = mongoose.model("Booking");
  const booking = await Booking.findById(this.booking);
  if (booking) {
    if (newStatus === "succeeded") {
      booking.status = "confirmed";
    } else if (newStatus === "failed") {
      booking.status = "pending";
    } else if (newStatus === "refunded") {
      booking.status = "cancelled";
    }
    await booking.save();
  }
};

// Method to process refund
paymentSchema.methods.processRefund = async function(reason) {
  this.refundDetails = {
    refundId: `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    refundAmount: this.amount,
    refundReason: reason,
    refundStatus: "pending",
    refundedAt: new Date()
  };
  
  await this.save();
  
  // Simulate refund processing
  setTimeout(async () => {
    this.refundDetails.refundStatus = "completed";
    await this.updateStatus("refunded");
  }, 5000); // Simulate 5 second processing time
};

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment; 