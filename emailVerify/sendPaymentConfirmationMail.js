import nodemailer from 'nodemailer'


export const sendPaymentConfirmationMail = async (email, { studentName, courseTitle, amount, paymentId, date }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.MAIL_USER,
    to: email,
    subject: 'Payment Confirmation - LMS',
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2>Payment Successful</h2>
        <p>Hi ${studentName},</p>
        <p>We've received your payment. Here are the details:</p>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 6px 0; color: #666;">Course</td><td style="padding: 6px 0;"><b>${courseTitle}</b></td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Amount Paid</td><td style="padding: 6px 0;"><b>₹${amount}</b></td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Payment ID</td><td style="padding: 6px 0;">${paymentId}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Date</td><td style="padding: 6px 0;">${date}</td></tr>
        </table>
        <p style="margin-top: 16px;">You now have access to this course. Happy learning!</p>
      </div>
    `
  }
  await transporter.sendMail(mailOptions);
}
