const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const Profile = require('../models/profileModel');
const otpGenerator = require('otp-generator');
const bcrypt = require('bcrypt');
const mailSender = require("../utils/mailSender");
const { passwordUpdated } = require('../mail/templates/passwordUpdate');
const jwt = require('jsonwebtoken');

require('dotenv').config();

//send-OTP
exports.sendOTP = async (req, res) => {
    try {
        //fetch email from request ki body
        const { email } = req.body;

        //check if user already exist
        const checkUserPresent = await User.findOne({ email });

        //if user already exist , then return a response
        if (checkUserPresent) {
            return res.status(401).json({
                success: false,
                message: "User already registered",
            })
        }

        let result;
        //generate OTP  and check unique otp or not
        do {
            var otp = otpGenerator.generate(6, {
                upperCaseAlphabets: false,
                lowerCaseAlphabets: false,
                specialChars: false,
            })
            console.log("OTP generate: ", otp);

            //check unique otp or not
            result = await OTP.findOne({ otp: otp });

        } while (result);

        const otpPayload = { email, otp };

        //create an entry for OTP
        const otpBody = await OTP.create(otpPayload);
        console.log(otpBody);

        //return response successful
        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            otp,
        })

    } catch (error) {
        console.log("Error uccured on OTP sent: ", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

//signup
exports.signup = async (req, res) => {
    try {
        //data fetch from request ki body
        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            accountType,
            contactNumber,
            otp
        } = req.body;
        //validate krlo
        if (!firstName || !lastName || !email || !password || !confirmPassword || !otp) {
            return res.status(403).json({
                success: false,
                message: "All fields are required",
            })
        }
        //2 password match krlo
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Password and ConfirmPassword Value does not match, please try again",
            })
        }
        //check user already exist or not
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User is already registered",
            });
        }

        //find most recent OTP stored for the user
        const recentOTP = await OTP.find({ email }).sort({ createdAt: -1 }).limit(1);
        console.log("recent OTP :", recentOTP);
        //validate OTP
        if (recentOTP.length == 0) {
            //OTP not found 
            return res.status(400).json({
                success: false,
                message: "OTP not Found"
            })
        } else if (otp !== recentOTP[0].otp) {
            //Invalid OTP
            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
            })
        }
        //Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create the user
        let approved = ""
        approved === "Instructor" ? (approved = false) : (approved = true)
        //enrty create in DB 

        const ProfileDetails = await Profile.create({
            gender: null,
            dateOfBirth: null,
            about: null,
            contactNumber: null,
        })

        const user = await User.create({
            firstName,
            lastName,
            email,
            contactNumber,
            password: hashedPassword,
            approved: approved,
            accountType,
            additionalDetails: ProfileDetails._id,
            image: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`,
        })

        //return response
        return res.status(200).json({
            success: true,
            message: "User is registered Successfully",
            user,
        })

    } catch (error) {
        console.log("Error uccured on signup page : ", error);
        return res.status(500).json({
            success: false,
            message: "User cannot be registered. please try again",
        })
    }
}

//login
exports.login = async (req, res) => {
    try {
        //fetch data from request body
        const { email, password } = req.body;
        //validation data
        if (!email || !password) {
            return res.status(403).json({
                success: false,
                message: "All fields are required, please try again",
            })
        }
        //user check exist or not
        const user = await User.findOne({ email }).populate("additionalDetails");
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User is not registered, please signup first",
            })
        }
        //generate JWT token , after password matching
        if (await bcrypt.compare(password, user.password)) {
            const payload = {
                email: user.email,
                id: user._id,
                accountType: user.accountType,
            }
            const token = jwt.sign(payload, process.env.JWT_SECRET, {
                expiresIn: "24h",
            })

            user.token = token;
            user.password = undefined;

            //create cookie and send response
            const options = {
                expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                httpOnly: true,
            }
            res.cookie("token", token, options).status(200).json({
                success: true,
                token,
                user,
                message: "Logged in successfully",
            })
        } else {
            return res.status(401).json({
                success: false,
                message: "Password is incorrect",
            });
        }

    } catch (error) {
        console.log("Error uccured on login page : ", error);
        return res.status(500).json({
            success: false,
            message: "Login Failure, please try again",
        })
    }
}

//change-Password

exports.changePassword = async (req, res) => {
    try {
        //get user data from req.user
        const userDetails = await User.findById(req.user.id);
        //get data from req body 
        //get oldPassword , newPassword , confirmNewPassword req body
        const { oldPassword, newPassword } = req.body;
        //validation
        const isPasswordMatch = await bcrypt.compare(
            oldPassword,
            userDetails.password,
        )
        if (isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: "The password is incorrect",
            })
        }

        //update pwd in DB
        const encryptedPassword = await bcrypt.hash(newPassword, 10);
        const updatedUserDetails = await User.findByIdAndUpdate(
            req.user.id,
            { password: encryptedPassword },
            { new: true },
        )

        //send mail - Password Uppdated 
        try {
            const mailResponse = await mailSender(
                updatedUserDetails.email,
                "Password for your account has been updated",
                passwordUpdated(
                    updatedUserDetails.email,
                    `Password updated successfully for ${updatedUserDetails.firstName} ${updatedUserDetails.lastName}`,
                )
            )
            console.log("Email sent succesfully : ", mailResponse.response);
        } catch (error) {
            console.log("Error occurred while sending email:", error);
            return res.status(500).json({
                success: false,
                message: "Error occured while sending email",
                error: error.message,
            })
        }
        //retrun response
        return res.status(200).json({
            success: true,
            message: "Password updated successfully"
        })

    } catch (error) {
        // If there's an error updating the password, log the error and return a 500 (Internal Server Error) error
        console.error("Error occurred while updating password:", error)
        return res.status(500).json({
            success: false,
            message: "Error occurred while updating password",
            error: error.message,
        })
    }
}