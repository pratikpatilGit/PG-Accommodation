const Joi = require("joi");
const reviews = require("./models/review");

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    userName: Joi.string().required().trim(),
    phoneNumber: Joi.string().required().trim().length(10).pattern(/^[0-9]+$/),
    email: Joi.string().required().trim().email(),
    profileImage: Joi.object({
      url: Joi.string().required(),
      filename: Joi.string().required()
    }),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      zipCode: Joi.string().required().length(6).pattern(/^[0-9]+$/)
    }).required(),
    adharCard: Joi.string().required().length(12).pattern(/^[0-9]+$/),
    description: Joi.string().required(),
    location: Joi.string().required(),
    rent: Joi.number().required().min(0),
    pre_reservation_amount: Joi.number().required().min(0).messages({
      'number.base': 'Pre-reservation amount must be a number',
      'number.min': 'Pre-reservation amount cannot be negative',
      'any.required': 'Pre-reservation amount is required'
    }),
    country: Joi.string().required().trim().default("India"),
    amenities: Joi.array().items(Joi.string()).default([]),
    capacity: Joi.number().required().min(1).required(),
    bedrooms: Joi.number().required().min(1).required(),
    bathrooms: Joi.number().required().min(1).required(),
    availability: Joi.boolean().required(),
    image: Joi.array().items(
      Joi.object({
        url: Joi.string().required(),
        filename: Joi.string().required(),
      })
    ),
    geometry: Joi.object({
      type: Joi.string().valid("Point").required(),
      coordinates: Joi.array().items(Joi.number()).length(2).required()
    }),
    owner: Joi.string().hex().length(24), // MongoDB ObjectId
    reviews: Joi.array().items(Joi.string().hex().length(24)) // Array of MongoDB ObjectIds
  }).required(),
  deleteImages: Joi.array(),
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required(),
  }).required(),
});
