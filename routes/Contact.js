const express = require("express");
const router = express.Router();

// Import the required controllers and middleware functions
const { contactUsController } = require("../controllers/ContactUs");

//Routes
router.post("/contact", contactUsController);

module.exports = router;