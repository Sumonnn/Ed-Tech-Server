const mongoose = require("mongoose");
const mailSender = require("../utils/mailSender");
const emailTemplate = require('../mail/templates/emailVerificationTemplate');

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: true,
    },
    createAt: {
        type: Date,
        default: Date.now(),
        expires: 5 * 60,// The document will be automatically deleted after 5 minutes of its creation time
    }
})

// a function  -> to send emails
async function sendVerifcationEmail(email, otp) {
    try {
        const title = "Verification Email from StudyNotion";

        const mailResponse = await mailSender(email, title, emailTemplate(otp))
        console.log("Email sent Successfully: ", mailResponse);

    } catch (error) {
        console.log("error occured while sending mails: " + error);
        throw error;
    }
}

OTPSchema.pre("save", async function (next) {
    await sendVerifcationEmail(this.email, this.otp);
    next();
})


module.exports = mongoose.model("OTP", OTPSchema)