import "dotenv/config";
import { sendEmail } from "./sendEmail.js";

// Escape user-provided text so it can't inject HTML into the mail
const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const sendPaymentConfirmationMail = async (
  email,
  { studentName, courseTitle, amount, paymentId, date }
) => {
  return sendEmail({
    to: email,
    subject: "Payment Confirmation - LMS",
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2>Payment Successful</h2>
        <p>Hi ${esc(studentName)},</p>
        <p>We've received your payment. Here are the details:</p>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 6px 0; color: #666;">Course</td><td style="padding: 6px 0;"><b>${esc(courseTitle)}</b></td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Amount Paid</td><td style="padding: 6px 0;"><b>₹${esc(amount)}</b></td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Payment ID</td><td style="padding: 6px 0;">${esc(paymentId)}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Date</td><td style="padding: 6px 0;">${esc(date)}</td></tr>
        </table>
        <p style="margin-top: 16px;">You now have access to this course. Happy learning!</p>
      </div>
    `,
  });
};