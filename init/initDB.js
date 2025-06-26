const mongoose = require('mongoose');
const Listing = require('../models/listing');
const { data } = require('./data');

const MOGOOSE_URL = "mongodb://127.0.0.1:27017/PGAccommodation";

async function main() {
    try {
        await mongoose.connect(MOGOOSE_URL);
        console.log("Connected to MongoDB");

        // Clear existing listings
        await Listing.deleteMany({});
        console.log("Cleared existing listings");

        // Insert new listings
        const listings = await Listing.insertMany(data);
        console.log(`Successfully inserted ${listings.length} listings`);

        // Close the connection
        await mongoose.connection.close();
        console.log("Database connection closed");
    } catch (error) {
        console.error("Error initializing database:", error);
    }
}

main(); 