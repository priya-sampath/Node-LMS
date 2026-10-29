
import nodemailer from "nodemailer"
import 'dotenv/config'
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import handlebars from "handlebars"
import { Users } from "../models/userModel.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)



export const verifymail = async (token, email) => {
  const emailTemplateSource = fs.readFileSync(path.join(__dirname, "template.hbs"), "utf-8")

  const template = handlebars.compile(emailTemplateSource)
  const htmlToSend = template({ token: encodeURIComponent(token) })
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
  const mailConfigurations = {
    from: process.env.MAIL_USER,
    to: email,
    subject: 'Email verification',
    html: htmlToSend
  }

  transporter.sendMail(mailConfigurations, function (error, info) {
    if (error) {
      throw new Error(error)
    }
    console.log('Email send Successfully');

    console.log(info);

  })
}
