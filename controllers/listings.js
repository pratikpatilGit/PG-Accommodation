const Listing = require("../models/listing");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

module.exports.index = async (req, res) => {
  const allListing = await Listing.find({});
  res.render("listings/index.ejs", { allListing });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  if (!listing) {
    req.flash("error", "Listing does not exist!");
    res.redirect("/listings");
  }
  res.render("listings/show.ejs", { listing });
};

module.exports.createListing = async (req, res, next) => {
  try {
    const listingData = req.body.listing;
    const requiredFields = [
      'title', 
      'userName', 
      'phoneNumber', 
      'email', 
      'address', 
      'adharCard', 
      'description', 
      'rent', 
      'location',
      'capacity',
      'bedrooms',
      'bathrooms',
      'availability'
    ];
    
    for (const field of requiredFields) {
      if (!listingData[field]) {
        throw new Error(`${field} is required`);
      }
    }

    // Validate address fields
    const addressFields = ['street', 'city', 'state', 'zipCode'];
    for (const field of addressFields) {
      if (!listingData.address[field]) {
        throw new Error(`Address ${field} is required`);
      }
    }

    // Handle profile image upload
    if (!req.files['listing[profileImage]'] || !req.files['listing[profileImage]'][0]) {
      throw new Error("Profile image is required");
    }

    const profileImage = req.files['listing[profileImage]'][0];
    const profileImageData = {
      url: profileImage.path,
      filename: profileImage.filename
    };

    // Handle property images
    let propertyImages = [];
    if (req.files['listing[image]']) {
      propertyImages = req.files['listing[image]'].map((file) => ({
        url: file.path,
        filename: file.filename,
      }));
    }

    // Format the address for location geocoding
    const formattedAddress = `${listingData.address.street}, ${listingData.address.city}, ${listingData.address.state} ${listingData.address.zipCode}`;

    // Get coordinates for the address
    let addressResponse = await geocodingClient
      .forwardGeocode({
        query: formattedAddress,
        limit: 1,
      })
      .send();

    if (!addressResponse.body.features.length) {
      throw new Error("Could not geocode the provided address");
    }

    const coordinates = addressResponse.body.features[0].geometry.coordinates;

    // Create new listing with all required fields
    let newListing = new Listing({
      ...listingData,
      owner: req.user._id,
      profileImage: profileImageData,
      image: propertyImages,
      geometry: {
        type: "Point",
        coordinates: coordinates
      },
      capacity: parseInt(listingData.capacity),
      bedrooms: parseInt(listingData.bedrooms),
      bathrooms: parseInt(listingData.bathrooms),
      availability: listingData.availability === 'true'
    });

    await newListing.save();
    req.flash("success", "New Listing Created!");
    return res.redirect("/listings");
  } catch (err) {
    console.error("Error creating listing:", err);
    req.flash("error", err.message);
    return res.redirect("/listings/new");
  }
};

module.exports.editListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing does not exist!");
    return res.redirect("/listings");
  }
  res.render("listings/edit", { listing });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

  if (req.files['listing[profileImage]'] && req.files['listing[profileImage]'][0]) {
    const profileImage = req.files['listing[profileImage]'][0];
    listing.profileImage = {
      url: profileImage.path,
      filename: profileImage.filename
    };
  }

  if (req.files['listing[image]']) {
    const images = req.files['listing[image]'].map((file) => ({
      url: file.path,
      filename: file.filename,
    }));
    listing.image = images;
  }

  await listing.save();
  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};
