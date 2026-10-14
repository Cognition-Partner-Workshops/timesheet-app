const nodemailer = require('nodemailer');

let transporter = null;

async function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  } else {
    // Fallback: use Ethereal test account for development
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('Using Ethereal test email account:', testAccount.user);
  }

  return transporter;
}

async function sendOtpEmail(toEmail, otpCode) {
  const mailer = await getTransporter();

  const info = await mailer.sendMail({
    from: process.env.SMTP_FROM || '"Time Tracker" <noreply@timetracker.app>',
    to: toEmail,
    subject: 'Your Login Verification Code',
    text: `Your verification code is: ${otpCode}\n\nThis code expires in 5 minutes.\n\nIf you did not request this code, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1976d2;">Time Tracker</h2>
        <p>Your verification code is:</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1976d2;">${otpCode}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in 5 minutes.</p>
        <p style="color: #999; font-size: 12px;">If you did not request this code, please ignore this email.</p>
      </div>
    `,
  });

  // Log preview URL for Ethereal test emails
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('OTP email preview URL:', previewUrl);
  }

  return info;
}

// Allow replacing transporter for tests
function setTransporter(t) {
  transporter = t;
}

module.exports = {
  sendOtpEmail,
  getTransporter,
  setTransporter,
};
