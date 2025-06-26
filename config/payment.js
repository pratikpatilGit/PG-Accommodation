require('dotenv').config();
const Razorpay = require('razorpay');
const twilio = require('twilio');

// Validate required environment variables
const requiredEnvVars = [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Validate Razorpay credentials format
if (!process.env.RAZORPAY_KEY_ID.startsWith('rzp_')) {
    throw new Error('Invalid Razorpay Key ID format. It should start with "rzp_"');
}

// Log Razorpay configuration (without exposing the secret)
console.log('Initializing Razorpay with Key ID:', process.env.RAZORPAY_KEY_ID);

// Razorpay configuration
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Test Razorpay connection asynchronously
const testRazorpayConnection = async () => {
    try {
        // Create a test order instead of listing orders
        const order = await razorpay.orders.create({
            amount: 100, // amount in smallest currency unit
            currency: "INR",
            receipt: "test_receipt_" + Date.now()
        });
        console.log('Razorpay connection successful');
        return true;
    } catch (error) {
        console.error('Razorpay connection test failed:', {
            message: error.message,
            status: error.status,
            code: error.code,
            response: error.response ? error.response.data : null
        });
        // Don't throw error, just log it
        console.warn('Warning: Razorpay connection test failed. Please check your credentials.');
        return false;
    }
};

// Run the connection test
testRazorpayConnection();

// Twilio configuration
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

module.exports = {
    razorpay,
    twilioClient
}; 