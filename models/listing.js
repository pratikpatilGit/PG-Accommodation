const { ref } = require("joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Reviews = require("./review.js");

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  profileImage: {
    url: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    }
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    }
  },
  adharCard: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true,
  },
  image: [
    {
      url: {
        type: String,
        required: true,
      },
      filename: {
        type: String,
        required: true,
      },
    },
  ],
  rent: {
    type: Number,
    required: true,
    min: [0, "Rent cannot be negative"],
    index: true,
  },
  pre_reservation_amount: {
    type: Number,
    required: true,
    min: [0, "Pre-reservation amount cannot be negative"],
    default: 0
  },
  location: {
    type: String,
    required: true,
    index: true,
  },
  country: {
    type: String,
    required: true,
    default: "India",
    trim: true
  },
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  amenities: {
    type: [String],
    default: [],
  },
  availability: {
    type: Boolean,
    default: true,
    index: true,
  },
  capacity: {
    type: Number,
    required: true,
    min: [1, "Capacity must be at least 1"],
  },
  bedrooms: {
    type: Number,
    required: true,
    min: [1, "Bedrooms must be at least 1"],
  },
  bathrooms: {
    type: Number,
    required: true,
    min: [1, "Bathrooms must be at least 1"],
  },
});

// Middleware to delete related reviews when a listing is deleted
listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Reviews.deleteMany({ _id: { $in: listing.reviews } });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
