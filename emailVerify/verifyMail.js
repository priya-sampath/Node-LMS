import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import handlebars from "handlebars";
import { sendEmail } from "./sendEmail.js";

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

  return sendEmail({
    to: email,
    subject: "Email verification",
    html: htmlToSend,
  });
};