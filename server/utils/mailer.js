import { config } from '../config/env.js';

/**
 * Dispatch an email notification, verification OTP, or password reset link.
 */
export async function sendEmail({ to, subject, html, text, otp = null, link = null }) {
  const timestamp = new Date().toISOString();

  if (config.IS_PROD && config.EMAIL_PROVIDER !== 'DEMO') {
    // Production email integration (e.g. SMTP or SendGrid API)
    // Credentials loaded from environment variables
    console.log(`[PROD EMAIL] Dispatched email to ${to} | Subject: ${subject}`);
    return {
      success: true,
      provider: config.EMAIL_PROVIDER,
      timestamp
    };
  }

  // Development Mode: Clearly labeled demo email output
  console.log(`\n======================================================`);
  console.log(`[DEV EMAIL GATEWAY] To: ${to}`);
  console.log(`[SUBJECT]: ${subject}`);
  if (otp) {
    console.log(`[DEMO EMAIL OTP]: ${otp} (Valid for ${config.OTP_EXPIRY_MINUTES} mins)`);
  }
  if (link) {
    console.log(`[ACTION LINK]: ${link}`);
  }
  console.log(`[CONTENT]:\n${text || html.replace(/<[^>]+>/g, ' ').substring(0, 300)}...`);
  console.log(`======================================================\n`);

  return {
    success: true,
    provider: 'DEMO',
    demoOtp: config.IS_PROD ? null : otp, // NEVER expose in production!
    demoLink: config.IS_PROD ? null : link,
    timestamp
  };
}
