if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const Listing = require("./models/listing.js");
const multer = require("multer");
const { storage } = require("./cloudConfig.js");
const upload = multer({ storage });
const { isLoggedIn, saveRedirectUrl, handleFlash } = require("./middleware.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const bookingRouter = require("./routes/booking.js");
const paymentRouter = require("./routes/payment.js");
const legalRouter = require("./routes/legal.js");

const DB_URL = process.env.ATLASDB_URL;

main()
  .then(() => {
    console.log("DB is Connected...");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(DB_URL);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const store = MongoStore.create({
  mongoUrl: DB_URL,
  crypto: {
    secret: process.env.SECRET,
  },
  touchAfter: 24 * 60 * 60,
});

store.on("error", function (e) {
  console.log("SESSION STORE ERROR", e)
});

const sessionOption = {
  store,
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 1000 * 60 * 60 * 24 * 3,
    maxAge: 1000 * 60 * 60 * 24 * 3,
    httpOnly: true,
  },
};

// app.get("/", (req, res) => {
//   res.send("Hello, i am root");
// });


app.use(session(sessionOption));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// app.get("/demouser", async (req, res) => {
//   let fakeUser = new User({
//     email: "krishna@gmail.com",
//     username: "krishna",
//   });

//   let registeredUser = await User.register(fakeUser, "helloworld");
//   res.send(registeredUser);
// });

//listing router
app.use("/listings", listingRouter);

// reviews Router
app.use("/listings/:id/reviews", reviewRouter);

// user Router
app.use("/", userRouter);

// booking Router
app.use("/", bookingRouter);

// payment Router
app.use("/payments", paymentRouter);

// legal Router
app.use("/", legalRouter);

// app.get("/testListing", async (req, res) => {
//   let sampleList = new Listing({
//     title: "Cozy PG Near Nashik Road",
//     location: "Nashik Road, Nashik, Maharashtra, India",
//     amenities: ["Wi-Fi", "AC", "Attached Bathroom", "Food"],
//     rent: 5000,
//     availability: true,
//     // photos: ['https://example.com/pg1.jpg', 'https://example.com/pg2.jpg'],
//     description:
//       "A comfortable and affordable PG located near Nashik Road. Offers Wi-Fi, AC, attached bathroom, and food. Ideal for students and working professionals.",
//     // owner: '12345', // Replace with the actual owner's ID
//     // reviews: []
//   });

//   await sampleList.save();
//   console.log("sample is saved");
//   res.send("successful testing");
// });

// ✅ Filter Listings API (Supports Rent & Amenities Filtering)
app.get("/filter", async (req, res) => {
  try {
    let { gender, minRent, maxRent, amenities } = req.query;

    minRent = Number(minRent) || 0;
    maxRent = Number(maxRent) || Infinity;

    let filterAmenities = amenities ? amenities.split(",") : [];
    let filterGenders = gender ? gender.split(",") : [];

    let query = { rent: { $gte: minRent, $lte: maxRent } };

    // Apply gender filter only if selected
    if (filterGenders.length > 0) {
      query.gender = { $in: filterGenders }; // Filter listings by gender
    }

    if (filterAmenities.length > 0) {
      // Correct approach for array of strings (case-insensitive, any match):
      query.amenities = { $in: filterAmenities.map(amenity => new RegExp(amenity, 'i')) }; 
    }

    console.log("Query:", JSON.stringify(query, null, 2)); // Debugging: Check the generated query

    const listings = await Listing.find(query).select("image.url rent amenities firstName lastName title _id");

    console.log("Listings found:", listings);

    if (!listings || listings.length === 0) {
      return res.status(404).json({ success: false, message: "No listings found matching your criteria." });
    }

    res.json({ success: true, listings });

  } catch (error) {
    console.error("Error fetching filtered listings:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message, 
    });
  }
});

app.use("/list", async (req, res) => {
  try {
    let query = {};

    if (req.query.amenities) {
      const amenities = req.query.amenities.split(",");
      query.amenities = { $all: amenities };
    }

    const listings = await Listing.find(query);
    res.json(listings);
  } catch (error) {
    console.error("Error fetching listings:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

// Flash middleware
app.use(handleFlash);

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page not found"));
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { message });
});

app.listen(8080, () => {
  console.log("Server is Listening......");
});
