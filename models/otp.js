import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  otp: {
    type: String,
    required: true,
  },
  time: {
    type: Date,
    default: Date.now,
    expires: 300, // 5 minutes (matches OTP validity in userController)
  },
});

const OTP = mongoose.models.OTP || mongoose.model("OTP", otpSchema);

export default OTP;