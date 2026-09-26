const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
}

/**
 * Sends a password-reset email. Throws if SMTP isn't configured or the send
 * fails -- callers decide whether to surface that or fail quietly.
 */
async function sendPasswordResetEmail({ to, name, resetUrl, institutionName }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Email is not configured on the server (SMTP_HOST/SMTP_USER/SMTP_PASS missing)');
  }

  const from = process.env.MAIL_FROM || `CampusHub <${process.env.SMTP_USER}>`;

  await getTransporter().sendMail({
    from,
    to,
    subject: `Reset your CampusHub password${institutionName ? ` — ${institutionName}` : ''}`,
    text: `Hi ${name},\n\nWe received a request to reset your CampusHub password. ` +
          `Click the link below to choose a new one. This link expires in 30 minutes.\n\n${resetUrl}\n\n` +
          `If you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#101A2E">
        <h2 style="margin-bottom:4px">Reset your password</h2>
        <p style="color:#5C5A52">${institutionName || 'CampusHub'}</p>
        <p>Hi ${name},</p>
        <p>We received a request to reset your CampusHub password. This link expires in 30 minutes.</p>
        <p style="margin:28px 0">
          <a href="${resetUrl}" style="background:#2F6FED;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">
            Reset password
          </a>
        </p>
        <p style="color:#6B7385;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        <p style="color:#6B7385;font-size:12px;word-break:break-all">${resetUrl}</p>
      </div>`
  });
}

module.exports = { sendPasswordResetEmail };
