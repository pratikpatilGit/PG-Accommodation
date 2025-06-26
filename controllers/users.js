const User = require("../models/user");

module.exports.renderSignupFrom = (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.signup = async (req, res) => {
  try {
    let { username, email, password } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);
    console.log(registeredUser);
    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Welcome to PG Accomodiation!");
      res.redirect("/listings");
    });
  } catch (error) {
    req.flash("error", error.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginFrom = (req, res) => {
  res.render("users/login.ejs", { redirectUrl: req.query.redirect || '' });
};

module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back to PG Accomodiation!");
  req.session.flashShown = true; // Set flag to indicate flash has been shown
  let redirectUrl = req.body.redirect || res.locals.redirectUrl || "/listings";
  delete req.session.redirectUrl; // Clear the redirect URL from session
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
  req.logOut((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "you are Logout!");
    res.redirect("/listings");
  });
};
