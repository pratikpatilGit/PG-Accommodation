const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const initData = require("./data.js");

const MOGOOSE_URL = "mongodb://127.0.0.1:27017/PGAccommodation";

main()
  .then(() => {
    console.log("DB is Connected...");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MOGOOSE_URL);
}

const initDB = async () => {
  await Listing.deleteMany({});
  // console.log(initData.data);
  initData.data = initData.data.map((obj) => ({
    ...obj,
    owner: "6725b51530fb2963a500b015",
  }));
  await Listing.insertMany(initData.data);
  console.log("data was initilized");
};

initDB();
