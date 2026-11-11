/**
 * ==============================================================================
 * OTP Authentication & Challenge Management Service (Phase 2)
 * ==============================================================================
 * Implements Multi-Factor Authentication business logic:
 * - Authoritative role-based destination email resolution
 * - Cryptographically secure 6-digit OTP generation via Node.js crypto.randomInt
 * - HMAC-SHA256 hash protection using OTP_HMAC_SECRET and per-challenge salt
 * - Timing-attack resistant hash verification via crypto.timingSafeEqual
 * - Challenge lifecycle management (PENDING, VERIFIED, EXPIRED, LOCKED)
 * - Atomic state transitions and single-use guarantee
 * - 60-second resend cooldown & 5-minute expiry enforcement
 * ==============================================================================
 */

require('../config/env');
const crypto = require('crypto');
const { query } = require('../config/db');
const { sendOtpEmail } = require('../config/mailer');
const { recordAuditEvent } = require('./auditService');

const isProduction = process.env.NODE_ENV === 'production';
const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFICATION_ATTEMPTS = 3;

// In-memory reference for local dev/testing inspection
const activeChallengeOtps = new Map();

/**
 * Retrieves the latest generated OTP for a challenge (development and testing helper).
 * @param {string} challengeId
 * @returns {string|null}
 */
function getLatestOtpForChallenge(challengeId) {
  return activeChallengeOtps.get(challengeId) || null;
}


/**
 * Returns the configured HMAC secret for OTP protection.
 */
function getHmacSecret() {
  const secret = process.env.OTP_HMAC_SECRET;
  if (!secret) {
    if (isProduction) {
      throw new Error('Fatal: OTP_HMAC_SECRET environment variable must be set in production.');
    }
    return 'dev-otp-hmac-secret-bms-academic-prototype-key-32b';
  }
  return secret;
}

/**
 * Masks an email address for safe display in UI/API responses.
 * Examples:
 *   test.customer1@example.com -> t***1@example.com
 *   admin@corebank.internal    -> a***n@corebank.internal
 *   ab@domain.com              -> a***@domain.com
 * @param {string} email
 * @returns {string}
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '***@***.***';
  }
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  const first = local[0];
  const last = local[local.length - 1];
  return `${first}***${last}@${domain}`;
}

/**
 * Resolves the authoritative destination email address based strictly on the user's role.
 * Role Routing Rules:
 *   - ADMIN    -> process.env.ADMIN_OTP_EMAIL
 *   - EMPLOYEE -> employees.email in MySQL
 *   - CUSTOMER -> customers.email in MySQL
 *
 * Never redirects customer or employee OTPs to the admin email.
 * Fails safely if the email is missing or malformed.
 *
 * @param {object} user - User record from MySQL { user_id, username, role }
 * @returns {Promise<{ email: string, maskedEmail: string }>}
 */
async function resolveUserEmail(user) {
  if (!user || !user.role) {
    throw new Error('Invalid user object provided for email resolution.');
  }

  let destinationEmail = null;

  if (user.role === 'ADMIN') {
    const adminEmail = process.env.ADMIN_OTP_EMAIL;
    if (!adminEmail || typeof adminEmail !== 'string' || !adminEmail.includes('@')) {
      throw new Error('Admin OTP destination email (ADMIN_OTP_EMAIL) is not properly configured.');
    }
    destinationEmail = adminEmail.trim();
  } else if (user.role === 'EMPLOYEE') {
    const empRows = await query(
      'SELECT email FROM employees WHERE user_id = ?',
      [user.user_id]
    );
    if (!empRows || empRows.length === 0 || !empRows[0].email) {
      throw new Error(`Employee profile for user '${user.username}' has no registered email address.`);
    }
    destinationEmail = empRows[0].email.trim();
  } else if (user.role === 'CUSTOMER') {
    const custRows = await query(
      'SELECT email FROM customers WHERE user_id = ?',
      [user.user_id]
    );
    if (!custRows || custRows.length === 0 || !custRows[0].email) {
      throw new Error(`Customer profile for user '${user.username}' has no registered email address.`);
    }
    destinationEmail = custRows[0].email.trim();
  } else {
    throw new Error(`Unsupported role '${user.role}' for OTP email routing.`);
  }

  if (!destinationEmail || !destinationEmail.includes('@')) {
    throw new Error(`Invalid destination email address resolved for user '${user.username}'.`);
  }

  return {
    email: destinationEmail,
    maskedEmail: maskEmail(destinationEmail)
  };
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 * @returns {string} 6-digit string (e.g. '491823')
 */
function generateOtpCode() {
  const codeNum = crypto.randomInt(100000, 1000000);
  return codeNum.toString();
}

/**
 * Computes an HMAC-SHA256 hash of the OTP and salt using the server-side secret.
 * @param {string} otp
 * @param {string} salt
 * @returns {string} Hex-encoded digest
 */
function computeOtpHmac(otp, salt) {
  const hmacSecret = getHmacSecret();
  return crypto.createHmac('sha256', hmacSecret)
    .update(`${otp}:${salt}`)
    .digest('hex');
}

/**
 * Creates, persists, and delivers a fresh OTP authentication challenge.
 * Invalidates any existing pending challenges for the same user.
 *
 * @param {object} params
 * @param {object} params.user - User entity { user_id, username, role, status }
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @returns {Promise<{ challengeId: string, maskedEmail: string, expiresInSeconds: number, resendAvailableInSeconds: number, devOtp?: string }>}
 */
async function createLoginChallenge({ user, ipAddress = null, userAgent = null }) {
  if (!user || !user.user_id) {
    throw new Error('User identifier is required to create an OTP challenge.');
  }

  // 1. Resolve destination email according to role routing policy
  const { email, maskedEmail } = await resolveUserEmail(user);

  // 2. Invalidate any existing PENDING challenges for this user (prevent concurrent active OTPs)
  await query(
    "UPDATE auth_otp_challenges SET status = 'EXPIRED' WHERE user_id = ? AND status = 'PENDING'",
    [user.user_id]
  );

  // 3. Generate cryptographic OTP and salt
  const otp = generateOtpCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = computeOtpHmac(otp, salt);
  const challengeId = crypto.randomUUID();

  // 4. Persist challenge in MySQL
  await query(`
    INSERT INTO auth_otp_challenges (
      challenge_id, user_id, otp_hash, otp_salt, attempts_count, max_attempts,
      status, expires_at, resend_available_at
    ) VALUES (
      ?, ?, ?, ?, 0, ?,
      'PENDING',
      DATE_ADD(NOW(), INTERVAL ? MINUTE),
      DATE_ADD(NOW(), INTERVAL ? SECOND)
    )
  `, [
    challengeId,
    user.user_id,
    otpHash,
    salt,
    MAX_VERIFICATION_ATTEMPTS,
    OTP_EXPIRY_MINUTES,
    RESEND_COOLDOWN_SECONDS
  ]);

  // 5. Send OTP email (Nodemailer Gmail SMTP with dev fallback)
  await sendOtpEmail({
    to: email,
    otp,
    username: user.username,
    expiresInMinutes: OTP_EXPIRY_MINUTES
  });

  // Track in active store for test/dev verification
  activeChallengeOtps.set(challengeId, otp);

  // 6. Record audit event (Sanitizer strips any OTP values)
  await recordAuditEvent({
    actorUserId: user.user_id,
    actionType: 'OTP_GENERATED',
    targetEntityType: 'USER',
    targetEntityId: user.user_id,
    description: `Security verification OTP generated and dispatched for user '${user.username}' (${user.role}).`,
    result: 'SUCCESS',
    metadata: {
      challengeId,
      maskedEmail,
      role: user.role,
      ipAddress,
      userAgent
    }
  });

  const responseData = {
    challengeId,
    maskedEmail,
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    resendAvailableInSeconds: RESEND_COOLDOWN_SECONDS
  };

  // Provide plain OTP for automated testing if running in test environment
  if (process.env.NODE_ENV === 'test') {
    responseData._testOnlyOtp = otp;
  }

  return responseData;
}

/**
 * Validates a submitted OTP against the specified challenge.
 *
 * @param {object} params
 * @param {string} params.challengeId
 * @param {string} params.otp
 * @param {string} [params.sessionChallengeId] - Optional challenge ID bound to pre-auth session
 * @param {number} [params.sessionUserId] - Optional user ID bound to pre-auth session
 * @returns {Promise<{ success: boolean, errorCode?: string, message: string, user?: object, remainingAttempts?: number }>}
 */
async function verifyOtpChallenge({ challengeId, otp, sessionChallengeId = null, sessionUserId = null }) {
  // Input validation
  if (!challengeId || typeof challengeId !== 'string' || !challengeId.trim()) {
    return {
      success: false,
      errorCode: 'VAL_001',
      message: 'Challenge ID is required.'
    };
  }

  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    return {
      success: false,
      errorCode: 'VAL_001',
      message: 'A 6-digit numeric verification code is required.'
    };
  }

  const trimmedChallengeId = challengeId.trim();
  const trimmedOtp = otp.trim();

  // Verify pre-authentication session binding if provided
  if (sessionChallengeId && sessionChallengeId !== trimmedChallengeId) {
    return {
      success: false,
      errorCode: 'AUTH_004',
      message: 'Verification challenge does not match pre-authentication context.'
    };
  }

  // 1. Fetch challenge record from database
  const rows = await query(`
    SELECT challenge_id, user_id, otp_hash, otp_salt, attempts_count, max_attempts,
           status, expires_at, resend_available_at
    FROM auth_otp_challenges
    WHERE challenge_id = ?
  `, [trimmedChallengeId]);

  if (!rows || rows.length === 0) {
    return {
      success: false,
      errorCode: 'AUTH_004',
      message: 'Invalid or expired verification challenge.'
    };
  }

  const challenge = rows[0];

  // Verify user ID matches pre-authentication session context
  if (sessionUserId && Number(sessionUserId) !== Number(challenge.user_id)) {
    return {
      success: false,
      errorCode: 'AUTH_004',
      message: 'Challenge owner does not match pre-authentication context.'
    };
  }

  // 2. Check if challenge was already used (Single-use guarantee)
  if (challenge.status === 'VERIFIED') {
    return {
      success: false,
      errorCode: 'AUTH_006',
      message: 'This verification code has already been used. Please request a new code.'
    };
  }

  // 3. Check if challenge is locked due to exceeded attempts
  if (challenge.status === 'LOCKED' || challenge.attempts_count >= challenge.max_attempts) {
    if (challenge.status !== 'LOCKED') {
      await query("UPDATE auth_otp_challenges SET status = 'LOCKED' WHERE challenge_id = ?", [trimmedChallengeId]);
    }
    return {
      success: false,
      errorCode: 'AUTH_005',
      message: 'Maximum verification attempts exceeded. Please sign in again.'
    };
  }

  // 4. Check if challenge is expired
  const now = new Date();
  const expiresAt = new Date(challenge.expires_at);
  if (challenge.status === 'EXPIRED' || now > expiresAt) {
    if (challenge.status !== 'EXPIRED') {
      await query("UPDATE auth_otp_challenges SET status = 'EXPIRED' WHERE challenge_id = ?", [trimmedChallengeId]);
    }
    return {
      success: false,
      errorCode: 'AUTH_004',
      message: 'Verification code has expired. Please request a new code.'
    };
  }

  // 5. Verify HMAC in constant time
  const candidateHash = computeOtpHmac(trimmedOtp, challenge.otp_salt || '');
  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const storedBuf = Buffer.from(challenge.otp_hash, 'hex');

  const isHashMatch = candidateBuf.length === storedBuf.length &&
    crypto.timingSafeEqual(candidateBuf, storedBuf);

  if (!isHashMatch) {
    const newAttempts = challenge.attempts_count + 1;
    const isNowLocked = newAttempts >= challenge.max_attempts;
    const nextStatus = isNowLocked ? 'LOCKED' : 'PENDING';

    await query(
      'UPDATE auth_otp_challenges SET attempts_count = ?, status = ? WHERE challenge_id = ?',
      [newAttempts, nextStatus, trimmedChallengeId]
    );

    await recordAuditEvent({
      actorUserId: challenge.user_id,
      actionType: 'OTP_FAILED',
      targetEntityType: 'USER',
      targetEntityId: challenge.user_id,
      description: `Failed OTP attempt (${newAttempts}/${challenge.max_attempts}) for user ID ${challenge.user_id}.${isNowLocked ? ' Challenge locked.' : ''}`,
      result: 'FAILURE',
      metadata: { challengeId: trimmedChallengeId, attempts: newAttempts, locked: isNowLocked }
    });

    if (isNowLocked) {
      return {
        success: false,
        errorCode: 'AUTH_005',
        message: 'Maximum verification attempts exceeded. Please sign in again.',
        remainingAttempts: 0
      };
    }

    return {
      success: false,
      errorCode: 'AUTH_001',
      message: 'Invalid verification code.',
      remainingAttempts: Math.max(0, challenge.max_attempts - newAttempts)
    };
  }

  // 6. Atomic verification transition: update status only if still PENDING
  const updateResult = await query(
    "UPDATE auth_otp_challenges SET status = 'VERIFIED' WHERE challenge_id = ? AND status = 'PENDING'",
    [trimmedChallengeId]
  );

  if (updateResult.affectedRows === 0) {
    return {
      success: false,
      errorCode: 'AUTH_006',
      message: 'This verification code was already processed or expired.'
    };
  }

  // 7. Verify user is still ACTIVE in users table
  const userRows = await query(
    'SELECT user_id, username, role, status, created_at FROM users WHERE user_id = ?',
    [challenge.user_id]
  );

  if (!userRows || userRows.length === 0 || userRows[0].status !== 'ACTIVE') {
    return {
      success: false,
      errorCode: 'AUTH_001',
      message: 'User account is inactive or not found.'
    };
  }

  const user = userRows[0];

  // 8. Resolve domain profile details
  let displayName = user.username;
  let customerId = null;
  let employeeId = null;

  if (user.role === 'CUSTOMER') {
    const custRows = await query(
      'SELECT customer_id, full_name FROM customers WHERE user_id = ?',
      [user.user_id]
    );
    if (custRows && custRows.length > 0) {
      displayName = custRows[0].full_name;
      customerId = custRows[0].customer_id;
    }
  } else if (user.role === 'EMPLOYEE') {
    const empRows = await query(
      'SELECT employee_id, full_name FROM employees WHERE user_id = ?',
      [user.user_id]
    );
    if (empRows && empRows.length > 0) {
      displayName = empRows[0].full_name;
      employeeId = empRows[0].employee_id;
    }
  } else if (user.role === 'ADMIN') {
    displayName = 'Administrator';
  }

  await recordAuditEvent({
    actorUserId: user.user_id,
    actionType: 'OTP_VERIFIED',
    targetEntityType: 'USER',
    targetEntityId: user.user_id,
    description: `OTP successfully verified for user '${user.username}' (${user.role}).`,
    result: 'SUCCESS',
    metadata: { challengeId: trimmedChallengeId, role: user.role }
  });

  return {
    success: true,
    user: {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      displayName,
      customerId,
      employeeId
    }
  };
}

/**
 * Renews an existing pending OTP challenge by generating a fresh OTP and enforcing cooldown.
 *
 * @param {object} params
 * @param {string} params.challengeId
 * @param {string} [params.sessionChallengeId]
 * @returns {Promise<{ success: boolean, errorCode?: string, message: string, expiresInSeconds?: number, resendAvailableInSeconds?: number, devOtp?: string }>}
 */
async function resendOtpChallenge({ challengeId, sessionChallengeId = null }) {
  if (!challengeId || typeof challengeId !== 'string' || !challengeId.trim()) {
    return {
      success: false,
      errorCode: 'VAL_001',
      message: 'Challenge ID is required to resend OTP.'
    };
  }

  const trimmedChallengeId = challengeId.trim();

  if (sessionChallengeId && sessionChallengeId !== trimmedChallengeId) {
    return {
      success: false,
      errorCode: 'AUTH_004',
      message: 'Challenge does not match pre-authentication context.'
    };
  }

  // Fetch challenge
  const rows = await query(`
    SELECT challenge_id, user_id, attempts_count, max_attempts, status,
           expires_at, resend_available_at
    FROM auth_otp_challenges
    WHERE challenge_id = ?
  `, [trimmedChallengeId]);

  if (!rows || rows.length === 0) {
    return {
      success: false,
      errorCode: 'AUTH_004',
      message: 'Invalid or expired verification challenge.'
    };
  }

  const challenge = rows[0];

  if (challenge.status !== 'PENDING') {
    return {
      success: false,
      errorCode: 'AUTH_004',
      message: `Cannot resend code for challenge with status '${challenge.status}'. Please sign in again.`
    };
  }

  // Enforce 60-second cooldown
  const now = new Date();
  const resendAvailableAt = new Date(challenge.resend_available_at);
  if (now < resendAvailableAt) {
    const secondsRemaining = Math.max(1, Math.ceil((resendAvailableAt.getTime() - now.getTime()) / 1000));
    return {
      success: false,
      errorCode: 'RATE_001',
      message: `Please wait ${secondsRemaining} second(s) before requesting another verification code.`,
      secondsRemaining
    };
  }

  // Fetch user to resolve email
  const userRows = await query(
    'SELECT user_id, username, role, status FROM users WHERE user_id = ?',
    [challenge.user_id]
  );

  if (!userRows || userRows.length === 0 || userRows[0].status !== 'ACTIVE') {
    return {
      success: false,
      errorCode: 'AUTH_001',
      message: 'User account is inactive or not found.'
    };
  }

  const user = userRows[0];
  const { email } = await resolveUserEmail(user);

  // Generate new OTP, salt, and HMAC
  const newOtp = generateOtpCode();
  const newSalt = crypto.randomBytes(16).toString('hex');
  const newOtpHash = computeOtpHmac(newOtp, newSalt);

  // Atomically update challenge: reset attempts, update hash/salt, extend expiry and cooldown
  await query(`
    UPDATE auth_otp_challenges
    SET otp_hash = ?,
        otp_salt = ?,
        attempts_count = 0,
        expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
        resend_available_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
    WHERE challenge_id = ? AND status = 'PENDING'
  `, [
    newOtpHash,
    newSalt,
    OTP_EXPIRY_MINUTES,
    RESEND_COOLDOWN_SECONDS,
    trimmedChallengeId
  ]);

  // Deliver email
  await sendOtpEmail({
    to: email,
    otp: newOtp,
    username: user.username,
    expiresInMinutes: OTP_EXPIRY_MINUTES
  });

  activeChallengeOtps.set(trimmedChallengeId, newOtp);

  await recordAuditEvent({
    actorUserId: user.user_id,
    actionType: 'OTP_RESENT',
    targetEntityType: 'USER',
    targetEntityId: user.user_id,
    description: `A new verification code was dispatched for user '${user.username}' (${user.role}).`,
    result: 'SUCCESS',
    metadata: { challengeId: trimmedChallengeId, role: user.role }
  });

  const responseData = {
    success: true,
    message: 'A fresh verification code has been dispatched to your registered email.',
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    resendAvailableInSeconds: RESEND_COOLDOWN_SECONDS
  };

  if (process.env.NODE_ENV === 'test') {
    responseData._testOnlyOtp = newOtp;
  }

  return responseData;
}

module.exports = {
  getHmacSecret,
  maskEmail,
  resolveUserEmail,
  createLoginChallenge,
  verifyOtpChallenge,
  resendOtpChallenge,
  generateOtpCode,
  computeOtpHmac,
  getLatestOtpForChallenge
};
