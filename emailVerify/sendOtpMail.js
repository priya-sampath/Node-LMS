import "dotenv/config";
import { sendEmail } from "./sendEmail.js";

export const sendOtpMail = async (email, otp) => {
  return sendEmail({
    to: email,
    subject: "Password reset OTP",
    html: `<p>Your OTP for password reset is : <b>${otp}</b>. It is valid for 10 minutes.</p>`,
  });
};