// Shared helper: sends mail through Brevo's HTTPS API.
// Works on Render's free plan (Gmail SMTP does not, Render blocks it).
export const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.BREVO_API_KEY || !process.env.MAIL_USER) {
    throw new Error("BREVO_API_KEY or MAIL_USER is missing in environment variables");
  }

  // Fail fast instead of hanging if Brevo is unreachable
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "LMS", email: process.env.MAIL_USER },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Brevo error ${response.status}: ${data.message || JSON.stringify(data)}`);
    }

    console.log(`Email sent to ${to}:`, data.messageId);
    return data;
  } finally {
    clearTimeout(timer);
  }
};