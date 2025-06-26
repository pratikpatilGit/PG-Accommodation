const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");
const wrapAsync = require("../utils/wrapAsync");
const { razorpay, twilioClient } = require("../config/payment");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const User = require("../models/user");

// Generate PDF receipt
const generateReceipt = async (payment, booking) => {
  const doc = new PDFDocument();
  const receiptPath = path.join(__dirname, `../public/receipts/${payment._id}.pdf`);
  const writeStream = fs.createWriteStream(receiptPath);

  doc.pipe(writeStream);

  // Add receipt content
  doc.fontSize(20).text('Booking Receipt', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Receipt ID: ${payment.transactionId}`);
  doc.text(`Date: ${new Date().toLocaleDateString()}`);
  doc.moveDown();
  doc.text('Booking Details:');
  doc.text(`Listing: ${booking.listing.title}`);
  doc.text(`Check-in: ${booking.startDate.toLocaleDateString()}`);
  doc.text(`Check-out: ${booking.endDate.toLocaleDateString()}`);
  doc.moveDown();
  doc.text('Payment Details:');
  doc.text(`Amount: ₹${payment.amount.toLocaleString("en-IN")}`);
  doc.text(`Method: ${payment.method}`);
  doc.text(`Status: ${payment.status}`);
  doc.text(`Transaction ID: ${payment.transactionId}`);
  doc.text(`Razorpay Order ID: ${payment.razorpayOrderId}`);
  if (payment.razorpayPaymentId) {
    doc.text(`Razorpay Payment ID: ${payment.razorpayPaymentId}`);
  }

  doc.end();
  return `/receipts/${payment._id}.pdf`;
};

// Send SMS notification
const sendSMS = async (to, message) => {
  try {
    // Format the phone number for Twilio (add +91 for Indian numbers)
    // Remove any existing country code if present
    let cleanNumber = to.replace(/^\+91/, '');
    
    // Add the +91 country code
    const formattedNumber = `+91${cleanNumber}`;
    
    console.log(`Sending SMS to formatted number: ${formattedNumber}`);
    
    // Check if Twilio phone number is properly configured
    if (!process.env.TWILIO_PHONE_NUMBER) {
      console.error("Twilio phone number not configured in environment variables");
      return null;
    }
    
    // Make sure the Twilio phone number is in E.164 format
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER.startsWith('+') 
      ? process.env.TWILIO_PHONE_NUMBER 
      : `+${process.env.TWILIO_PHONE_NUMBER}`;
    
    console.log(`Using Twilio phone number: ${twilioPhoneNumber}`);
    
    const response = await twilioClient.messages.create({
      body: message,
      to: formattedNumber,
      from: twilioPhoneNumber,
    });
    console.log("SMS sent successfully:", response.sid);
    return response;
  } catch (error) {
    console.error("SMS sending failed:", error);
    // Don't throw the error, just log it and continue
    return null;
  }
};

// Initiate payment
module.exports.initiatePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found"
            });
        }

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: Math.round(booking.totalPrice * 100),
            currency: "INR",
            receipt: `booking_${booking._id}`
        });

        // Update booking with order ID
        booking.razorpayOrderId = order.id;
        await booking.save();

        res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            amount: booking.totalPrice,
            currency: "INR",
            orderId: order.id
        });
    } catch (error) {
        console.error("Payment initiation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to initiate payment",
            error: error.message
        });
    }
};

// Handle payment callback
module.exports.handlePaymentCallback = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    console.log('Received payment callback:', {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    });

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details" });
    }

    // Verify signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Find booking by order ID
    const booking = await Booking.findOne({ razorpayOrderId: razorpay_order_id });

    if (!booking) {
      console.error('Booking not found for order:', razorpay_order_id);
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ booking: booking._id });

    if (existingPayment) {
      return res.status(400).json({ error: "Payment already processed" });
    }

    // Create payment record
    const payment = new Payment({
      booking: booking._id,
      amount: booking.initialPayment,
      currency: "INR",
      status: "succeeded",
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      method: booking.paymentMethod
    });

    console.log('Creating payment record:', payment);

    await payment.save();

    // Update booking status
    booking.status = "confirmed";
    booking.payment = payment._id;
    await booking.save();

    // Send SMS notification
    try {
      // Get the booking with listing details
      const bookingWithDetails = await Booking.findById(booking._id)
        .populate('listing')
        .populate('user');

      if (!bookingWithDetails) {
        console.error('Could not find booking details for SMS notification');
        return res.status(200).json({ 
          success: true, 
          bookingId: booking._id,
          payment: payment._id
        });
      }

      const listing = bookingWithDetails.listing;
      const user = bookingWithDetails.user;

      // Send SMS to listing owner
      if (listing && listing.phoneNumber) {
        try {
          const ownerMessage = `New booking confirmed! Payment of ₹${booking.initialPayment} received for your property "${listing.title}". Booking #${booking._id}`;
          const smsResult = await sendSMS(listing.phoneNumber, ownerMessage);
          if (smsResult) {
            console.log('SMS sent to listing owner:', listing.phoneNumber);
          } else {
            console.log('SMS notification skipped for listing owner: SMS sending failed');
          }
        } catch (smsError) {
          console.error("Failed to send SMS to listing owner:", smsError);
        }
      } else {
        console.log('SMS notification skipped: Listing has no phone number');
      }

      // Send SMS to user if they have a phone number
      if (user && user.phoneNumber) {
        try {
          const userMessage = `Your payment of ₹${booking.initialPayment} for booking #${booking._id} has been confirmed. Thank you for choosing our service!`;
          const smsResult = await sendSMS(user.phoneNumber, userMessage);
          if (smsResult) {
            console.log('SMS sent to user:', user.phoneNumber);
          } else {
            console.log('SMS notification skipped for user: SMS sending failed');
          }
        } catch (smsError) {
          console.error("Failed to send SMS to user:", smsError);
        }
      } else {
        console.log('SMS notification skipped: User has no phone number');
      }

    } catch (error) {
      console.error("Error sending SMS notifications:", error);
    }

    return res.status(200).json({ 
      success: true, 
      bookingId: booking._id,
      payment: payment._id
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Handle payment failure
module.exports.handlePaymentFailure = async (req, res) => {
    try {
        const { razorpay_order_id } = req.body;

        console.log('Received payment failure:', { razorpay_order_id });

        if (!razorpay_order_id) {
            console.error('Missing order ID:', req.body);
            return res.status(400).json({
                success: false,
                error: "Missing order ID"
            });
        }

        // Find booking by order ID
        const booking = await Booking.findOne({ razorpayOrderId: razorpay_order_id });

        if (!booking) {
            console.error('Booking not found for order:', razorpay_order_id);
            return res.status(404).json({
                success: false,
                error: "Booking not found"
            });
        }

        // Check if payment already exists
        const existingPayment = await Payment.findOne({
            booking: booking._id,
            status: "failed"
        });

        if (existingPayment) {
            console.log('Payment failure already recorded:', existingPayment._id);
            return res.json({
                success: true,
                bookingId: booking._id
            });
        }

        // Create failed payment record
        const payment = new Payment({
            booking: booking._id,
            amount: booking.initialPayment,
            method: booking.paymentMethod,
            razorpayOrderId: razorpay_order_id,
            status: "failed",
            transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        await payment.save();
        console.log('Payment failure record created:', payment._id);

        // Update booking status
        booking.status = "pending";
        booking.payment = payment._id;
        await booking.save();
        console.log('Booking status updated:', booking._id);

        // Return success response
        res.json({
            success: true,
            bookingId: booking._id
        });
    } catch (error) {
        console.error("Payment failure handling error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to handle payment failure",
            details: error.message
        });
    }
};

// View payment details
module.exports.viewPaymentDetails = wrapAsync(async (req, res) => {
    const { id } = req.params;
    const payment = await Payment.findById(id).populate({
        path: 'booking',
        populate: {
            path: 'listing'
        }
    });

    if (!payment) {
        req.flash("error", "Payment not found!");
        return res.redirect("/listings");
    }

    // Check if user is authorized to view payment
    if (!payment.booking.user.equals(req.user._id)) {
        req.flash("error", "You are not authorized to view this payment!");
        return res.redirect("/listings");
    }

    // Render the payment view template
    res.render("bookings/payment", { payment });
});

// Process refund
module.exports.processRefund = wrapAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const payment = await Payment.findById(id).populate("booking");
    if (!payment) {
      throw new ExpressError(404, "Payment not found!");
    }

    // Check if user is authorized to request refund
    if (!payment.booking.user.equals(req.user._id)) {
      throw new ExpressError(403, "You are not authorized to request a refund!");
    }

    // Check if payment is eligible for refund
    if (payment.status !== "succeeded") {
      throw new ExpressError(400, "This payment is not eligible for refund!");
    }

    // Process refund
    await payment.processRefund(reason);

    req.flash("success", "Refund request submitted successfully!");
    res.redirect(`/payments/callback/${payment._id}`);
  } catch (error) {
    console.error('Refund processing error:', error);
    req.flash("error", error.message || "An error occurred while processing refund");
    res.redirect(`/bookings/${id}`);
  }
});

// Example of real Stripe integration (commented out)
/*
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports.initiateStripePayment = wrapAsync(async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId);

  // Create Stripe payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: booking.totalPrice * 100, // Amount in cents
    currency: 'inr',
    metadata: {
      bookingId: booking._id.toString(),
    },
  });

  // Create payment record
  const payment = new Payment({
    booking: bookingId,
    transactionId: paymentIntent.id,
    amount: booking.totalPrice,
    method: 'stripe',
    status: 'pending',
    paymentDetails: {
      paymentIntent,
    },
  });

  await payment.save();

  // Return client secret for Stripe Elements
  res.json({
    clientSecret: paymentIntent.client_secret,
  });
});

module.exports.handleStripeWebhook = wrapAsync(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const payment = await Payment.findOne({
      transactionId: paymentIntent.id,
    });

    if (payment) {
      await payment.updateStatus('succeeded');
    }
  }

  res.json({ received: true });
});
*/ 