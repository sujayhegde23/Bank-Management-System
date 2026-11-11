/**
 * ==============================================================================
 * Centralized Mailer Service (Nodemailer with Gmail SMTP / STARTTLS)
 * ==============================================================================
 * Delivers One-Time Password (OTP) verification emails for Multi-Factor Authentication.
 * Supports:
 * - STARTTLS encryption on port 587 (or SSL on port 465)
 * - Google App Password authentication
 * - Safe fail-closed behavior in production
 * - Development-only logging fallback when SMTP is unconfigured in development/test
 * ==============================================================================
 */

require('./env');
const nodemailer = require('nodemailer');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Validates SMTP configuration based on environment.
 * In production: fails closed if SMTP_USER or SMTP_PASS is missing.
 * In development/test: falls back to dev logging trap if unconfigured.
 */
function getSmtpConfig() {
  const isProd = process.env.NODE_ENV === 'production';
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';
  const from = process.env.SMTP_FROM ? process.env.SMTP_FROM.trim() : (user || '"Core Bank Security" <no-reply@corebank.internal>');

  const isConfigured = Boolean(user && pass);

  if (isProd && !isConfigured) {
    throw new Error('Fatal: SMTP email delivery (SMTP_USER and SMTP_PASS) must be configured in production.');
  }

  return {
    host,
    port,
    user,
    pass,
    from,
    isConfigured
  };
}

let transporter = null;

// In-memory test transport capture for tests & verification
const capturedTestEmails = [];

function getCapturedTestEmails() {
  return [...capturedTestEmails];
}

function clearCapturedTestEmails() {
  capturedTestEmails.length = 0;
}

function getLatestCapturedOtpForEmail(email) {
  for (let i = capturedTestEmails.length - 1; i >= 0; i--) {
    if (capturedTestEmails[i].to === email) {
      return capturedTestEmails[i].otp;
    }
  }
  return null;
}


function getTransporter() {
  if (transporter) return transporter;

  const config = getSmtpConfig();
  if (config.isConfigured) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // true for 465, false for 587 (STARTTLS)
      requireTLS: config.port === 587,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
  }
  return transporter;
}

/**
 * Send an OTP verification email to recipient.
 * @param {object} params
 * @param {string} params.to - Destination email address
 * @param {string} params.otp - Six-digit OTP
 * @param {string} [params.username] - User's username
 * @param {number} [params.expiresInMinutes=5] - Expiry window in minutes
 * @returns {Promise<{ messageId: string, deliveryMode: 'smtp'|'dev_logger' }>}
 */
async function sendOtpEmail({ to, otp, username = 'Valued Customer', expiresInMinutes = 5 }) {
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    throw new Error('Invalid destination email address');
  }

  // Record into test-only in-memory capture store
  capturedTestEmails.push({
    to,
    otp,
    username,
    expiresInMinutes,
    timestamp: Date.now()
  });

  const config = getSmtpConfig();

  if (!config.isConfigured) {
    if (process.env.NODE_ENV === 'production' || isProduction) {
      throw new Error('Email delivery unavailable: SMTP is not configured in production.');
    }
    // Development / Test only fallback: Log to console in development
    if (process.env.NODE_ENV !== 'test') {
      console.log(`\n================================================================`);
      console.log(`[DEV OTP DISPATCH] Destination: ${to} (User: ${username})`);
      console.log(`[DEV OTP DISPATCH] 6-Digit OTP: ${otp}`);
      console.log(`[DEV OTP DISPATCH] Validity: ${expiresInMinutes} minutes`);
      console.log(`================================================================\n`);
    }
    return { messageId: `dev-mock-${Date.now()}`, deliveryMode: 'dev_logger' };
  }

  const transport = getTransporter();
  const mailOptions = {
    from: config.from,
    to: to,
    subject: 'Core Bank — Security Verification Code',
    text: `Hello ${username},\n\nYour security verification code is: ${otp}\n\nThis code will expire in ${expiresInMinutes} minutes. If you did not request this login code, please contact Core Bank Security immediately.\n\nThank you,\nCore Bank Security Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">CORE BANK</h2>
        <p style="color: #475569; font-size: 15px;">Hello <strong>${username}</strong>,</p>
        <p style="color: #475569; font-size: 14px;">Use the following 6-digit verification code to complete your sign-in to the Core Bank portal:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e3a8a; background: #f1f5f9; padding: 12px 24px; border-radius: 6px; border: 1px solid #cbd5e1;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This verification code is valid for <strong>${expiresInMinutes} minutes</strong> and can only be used once.</p>
        <p style="color: #dc2626; font-size: 12px; margin-top: 20px;"><strong>Notice:</strong> Core Bank representatives will never ask you for your verification code. If you did not initiate this request, please secure your account immediately.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 11px; margin-bottom: 0;">&copy; ${new Date().getFullYear()} Core Bank Management System. All rights reserved.</p>
      </div>
    `
  };

  const info = await transport.sendMail(mailOptions);
  return { messageId: info.messageId, deliveryMode: 'smtp' };
}

module.exports = {
  sendOtpEmail,
  getSmtpConfig,
  getCapturedTestEmails,
  clearCapturedTestEmails,
  getLatestCapturedOtpForEmail
};

