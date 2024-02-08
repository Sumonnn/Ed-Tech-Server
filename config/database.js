const mongoose = require("mongoose");
require("dotenv").config();

exports.connect = () => {
    mongoose
        .connect(process.env.MONGODB_URL)
        .then(() => console.log("DB Connected"))
        .catch((err) => {
            console.log("Error occured while database:");
            console.log(err)
            process.exit(1);
        })
};