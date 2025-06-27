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

app.get("/filter", async (req, res) => {
  try {
    if (req.query.all === "true") {
      const listings = await Listing.find().select("image.url rent amenities firstName lastName title _id location");
      return res.json({ success: true, listings });
    }

    let { minRent, maxRent, amenities } = req.query;

    minRent = Number(minRent) || 0;
    maxRent = Number(maxRent) || Infinity;

    const filterAmenities = amenities ? amenities.split(",") : [];

    const query = {
      rent: { $gte: minRent, $lte: maxRent }
    };

    if (filterAmenities.length > 0) {
      query.amenities = {
        $in: filterAmenities.map(a => new RegExp(a, "i"))
      };
    }

    const listings = await Listing.find(query).select("image.url rent amenities firstName lastName title _id location");

    res.json({
      success: true,
      listings
    });

  } catch (error) {
    console.error("Error fetching filtered listings:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
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
