import nodemailer from "nodemailer";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import handlebars from "handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const verifymail = async (token, email) => {
  // Load and fill the email template
  const emailTemplateSource = fs.readFileSync(
    path.join(__dirname, "template.hbs"),
    "utf-8"
  );
  const template = handlebars.compile(emailTemplateSource);

  // Remove a trailing slash so the link never has a double slash
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

  const htmlToSend = template({
    token: encodeURIComponent(token),
    frontendUrl,
  });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS, // Gmail App Password (16 chars, no spaces)
    },
  });

  const mailConfigurations = {
    from: process.env.MAIL_USER,
    to: email,
    subject: "Email verification",
    html: htmlToSend,
  };

  // Promise form: errors now reach the controller's try/catch
  const info = await transporter.sendMail(mailConfigurations);
  console.log("Email sent successfully:", info.messageId);
  return info;
};