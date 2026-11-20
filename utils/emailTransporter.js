import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const emailUser = process.env.EMAIL;
const emailPass = process.env.APP_PASSWORD || process.env.EMAIL_PASS;

if (!emailUser || !emailPass) {
  console.warn(
    "Warning: EMAIL or APP_PASSWORD is missing in environment variables. OTP emails may fail."
  );
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

export default transporter;