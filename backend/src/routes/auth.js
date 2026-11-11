/**
 * ==============================================================================
 * Authentication Routes (Phase 2 - Email OTP Multi-Factor Authentication)
 * ==============================================================================
 * Endpoints:
 * - POST /api/auth/login       (Public: verifies credentials, dispatches OTP challenge)
 * - POST /api/auth/verify-otp  (Public / Pre-Auth: verifies 6-digit OTP, establishes session)
 * - POST /api/auth/resend-otp  (Public / Pre-Auth: renews OTP challenge with 60s cooldown)
 * - POST /api/auth/logout      (Authenticated: destroys session, clears cookie)
 * - GET  /api/auth/me          (Authenticated: returns safe profile for active user)
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { recordAuditEvent } = require('../services/auditService');
const {
  createLoginChallenge,
  verifyOtpChallenge,
  resendOtpChallenge
} = require('../services/otpService');

// Precomputed static dummy hash used to equalize response timing when username does not exist
// Precalculated for "dummy-password-timing-mitigation" with 10 salt rounds
const DUMMY_HASH = '$2b$10$wT8K8U1yH4CqN0Xq7Z3CWeG5yH0bN2zL4pQ8vR6tS2uW1xY9zA3B.';

/**
 * POST /api/auth/login
 * Step 1 of Multi-Factor Authentication:
 * Verifies username & password, resolves role-specific destination email,
 * generates a 6-digit OTP challenge, and dispatches the code via email.
 *
 * PRE-AUTHENTICATION GUARANTEE:
 * Does NOT create an authenticated session.
 * Does NOT set req.session.user.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  // Input validation: ensure both username and password are provided and non-empty
  const missingFields = [];
  if (!username || typeof username !== 'string' || !username.trim()) {
    missingFields.push({ field: 'username', issue: 'Username is required' });
  }
  if (!password || typeof password !== 'string' || !password.trim()) {
    missingFields.push({ field: 'password', issue: 'Password is required' });
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Invalid input',
      fields: missingFields,
      error: {
        code: 'VAL_001',
        message: 'Invalid input',
        fields: missingFields
      }
    });
  }

  const trimmedUsername = username.trim();

  try {
    // 1. Parameterized lookup of user record
    const userRows = await query(
      'SELECT user_id, username, password_hash, role, status FROM users WHERE username = ?',
      [trimmedUsername]
    );

    const user = userRows && userRows.length > 0 ? userRows[0] : null;

    // 2. Timing attack mitigation: compare with dummy hash if user does not exist
    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      await recordAuditEvent({
        actorUserId: null,
        actionType: 'LOGIN_FAILED',
        targetEntityType: 'USER',
        targetEntityId: null,
        description: `Failed login attempt for unknown username '${trimmedUsername}'.`,
        result: 'FAILURE',
        metadata: { attemptedUsername: trimmedUsername }
      });
      return res.status(401).json({
        success: false,
        errorCode: 'AUTH_001',
        message: 'Invalid username or password',
        error: {
          code: 'AUTH_001',
          message: 'Invalid username or password'
        }
      });
    }

    // 3. Verify password hash
    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordMatch) {
      await recordAuditEvent({
        actorUserId: user.user_id,
        actionType: 'LOGIN_FAILED',
        targetEntityType: 'USER',
        targetEntityId: user.user_id,
        description: `Failed login attempt for username '${user.username}' (invalid password).`,
        result: 'FAILURE',
        metadata: { attemptedUsername: trimmedUsername }
      });
      return res.status(401).json({
        success: false,
        errorCode: 'AUTH_001',
        message: 'Invalid username or password',
        error: {
          code: 'AUTH_001',
          message: 'Invalid username or password'
        }
      });
    }

    // 4. Verify account status (inactive users return generic AUTH_001)
    if (user.status !== 'ACTIVE') {
      await recordAuditEvent({
        actorUserId: user.user_id,
        actionType: 'LOGIN_FAILED',
        targetEntityType: 'USER',
        targetEntityId: user.user_id,
        description: `Failed login attempt for deactivated username '${user.username}'.`,
        result: 'FAILURE',
        metadata: { attemptedUsername: trimmedUsername, userStatus: user.status }
      });
      return res.status(401).json({
        success: false,
        errorCode: 'AUTH_001',
        message: 'Invalid username or password',
        error: {
          code: 'AUTH_001',
          message: 'Invalid username or password'
        }
      });
    }

    // 5. Generate and deliver 2FA OTP challenge
    try {
      const challengeData = await createLoginChallenge({
        user,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      // Bind the pending challenge to a short-lived pre-authentication session context
      req.session.pendingChallenge = {
        challengeId: challengeData.challengeId,
        userId: user.user_id,
        role: user.role,
        username: user.username,
        createdAt: Date.now()
      };

      const responsePayload = {
        challengeId: challengeData.challengeId,
        maskedEmail: challengeData.maskedEmail,
        expiresInSeconds: challengeData.expiresInSeconds,
        resendAvailableInSeconds: challengeData.resendAvailableInSeconds
      };

      return res.status(200).json({
        success: true,
        data: responsePayload
      });
    } catch (routingErr) {
      console.error('OTP Challenge creation error:', routingErr.message);

      await recordAuditEvent({
        actorUserId: user.user_id,
        actionType: 'LOGIN_FAILED',
        targetEntityType: 'USER',
        targetEntityId: user.user_id,
        description: `Failed login attempt for user '${user.username}': ${routingErr.message}`,
        result: 'FAILURE',
        metadata: { reason: routingErr.message, role: user.role }
      });

      return res.status(400).json({
        success: false,
        errorCode: 'AUTH_007',
        message: routingErr.message || 'Unable to route verification code to registered email address.',
        error: {
          code: 'AUTH_007',
          message: routingErr.message || 'Unable to route verification code to registered email address.'
        }
      });
    }
  } catch (error) {
    console.error('Login process error:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

/**
 * POST /api/auth/verify-otp
 * Step 2 of Multi-Factor Authentication:
 * Validates the 6-digit OTP code against the challenge.
 * Checks expiry, attempt count, and single-use guarantee.
 * Only upon successful verification, regenerates the session and establishes req.session.user.
 */
router.post('/verify-otp', async (req, res) => {
  const { challengeId, otp } = req.body || {};

  if (!challengeId || typeof challengeId !== 'string' || !challengeId.trim()) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Challenge ID is required.',
      error: { code: 'VAL_001', message: 'Challenge ID is required.' }
    });
  }

  if (!otp || typeof otp !== 'string' || !otp.trim()) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Verification code is required.',
      error: { code: 'VAL_001', message: 'Verification code is required.' }
    });
  }

  try {
    const sessionChallenge = req.session?.pendingChallenge;
    const verificationResult = await verifyOtpChallenge({
      challengeId: challengeId.trim(),
      otp: otp.trim(),
      sessionChallengeId: sessionChallenge?.challengeId,
      sessionUserId: sessionChallenge?.userId
    });

    if (!verificationResult.success) {
      let statusCode = 400;
      if (verificationResult.errorCode === 'AUTH_001') {
        statusCode = 401;
      } else if (verificationResult.errorCode === 'AUTH_005') {
        statusCode = 403;
      } else if (verificationResult.errorCode === 'AUTH_006') {
        statusCode = 409;
      }

      return res.status(statusCode).json({
        success: false,
        errorCode: verificationResult.errorCode,
        message: verificationResult.message,
        remainingAttempts: verificationResult.remainingAttempts,
        error: {
          code: verificationResult.errorCode,
          message: verificationResult.message,
          remainingAttempts: verificationResult.remainingAttempts
        }
      });
    }

    // OTP verification successful
    const userProfile = verificationResult.user;

    // Regenerate session to prevent session fixation attacks
    req.session.regenerate(async (err) => {
      if (err) {
        console.error('Session regeneration error on OTP verification:', err.message);
        return res.status(500).json({
          success: false,
          errorCode: 'SYS_001',
          message: 'Something went wrong. Please try again later.',
          error: {
            code: 'SYS_001',
            message: 'Something went wrong. Please try again later.'
          }
        });
      }

      // Establish authenticated session with verified user identity
      req.session.user = {
        userId: userProfile.userId,
        username: userProfile.username,
        role: userProfile.role,
        status: userProfile.status,
        createdAt: userProfile.createdAt,
        displayName: userProfile.displayName,
        customerId: userProfile.customerId,
        employeeId: userProfile.employeeId
      };

      // Clean up pre-authentication context
      delete req.session.pendingChallenge;

      await recordAuditEvent({
        actorUserId: userProfile.userId,
        actionType: 'USER_LOGIN',
        targetEntityType: 'USER',
        targetEntityId: userProfile.userId,
        description: `User '${userProfile.username}' authenticated successfully via OTP as ${userProfile.role}.`,
        result: 'SUCCESS',
        metadata: { role: userProfile.role, username: userProfile.username, challengeId }
      });

      return res.status(200).json({
        success: true,
        data: {
          userId: userProfile.userId,
          username: userProfile.username,
          role: userProfile.role,
          displayName: userProfile.displayName
        }
      });
    });
  } catch (error) {
    console.error('OTP verification error:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

/**
 * POST /api/auth/resend-otp
 * Renews an existing pending OTP challenge.
 * Enforces a strict 60-second cooldown rate limit.
 * Generates and delivers a fresh 6-digit code, invalidating the previous OTP.
 */
router.post('/resend-otp', async (req, res) => {
  const { challengeId } = req.body || {};

  if (!challengeId || typeof challengeId !== 'string' || !challengeId.trim()) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Challenge ID is required to resend verification code.',
      error: { code: 'VAL_001', message: 'Challenge ID is required to resend verification code.' }
    });
  }

  try {
    const sessionChallenge = req.session?.pendingChallenge;
    const resendResult = await resendOtpChallenge({
      challengeId: challengeId.trim(),
      sessionChallengeId: sessionChallenge?.challengeId
    });

    if (!resendResult.success) {
      const statusCode = resendResult.errorCode === 'RATE_001' ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        errorCode: resendResult.errorCode,
        message: resendResult.message,
        secondsRemaining: resendResult.secondsRemaining,
        error: {
          code: resendResult.errorCode,
          message: resendResult.message,
          secondsRemaining: resendResult.secondsRemaining
        }
      });
    }

    const responsePayload = {
      challengeId: challengeId.trim(),
      message: resendResult.message,
      expiresInSeconds: resendResult.expiresInSeconds,
      resendAvailableInSeconds: resendResult.resendAvailableInSeconds
    };

    return res.status(200).json({
      success: true,
      data: responsePayload
    });
  } catch (error) {
    console.error('OTP resend error:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroys server-side session and clears authentication cookie.
 */
router.post('/logout', (req, res) => {
  // Check if active session exists
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      errorCode: 'AUTH_003',
      message: 'Please log in to continue',
      error: {
        code: 'AUTH_003',
        message: 'Please log in to continue'
      }
    });
  }

  const loggedOutUser = req.session.user;

  req.session.destroy(async (err) => {
    if (err) {
      console.error('Session destruction error on logout:', err.message);
      return res.status(500).json({
        success: false,
        errorCode: 'SYS_001',
        message: 'Something went wrong. Please try again later.',
        error: {
          code: 'SYS_001',
          message: 'Something went wrong. Please try again later.'
        }
      });
    }

    await recordAuditEvent({
      actorUserId: loggedOutUser.userId,
      actionType: 'USER_LOGOUT',
      targetEntityType: 'USER',
      targetEntityId: loggedOutUser.userId,
      description: `User '${loggedOutUser.username}' logged out.`,
      result: 'SUCCESS',
      metadata: { role: loggedOutUser.role, username: loggedOutUser.username }
    });

    res.clearCookie('bms.sid');
    return res.status(200).json({
      success: true,
      data: {
        message: 'Logged out'
      }
    });
  });
});

/**
 * GET /api/auth/me
 * Returns current safe user profile for active session.
 */
router.get('/me', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      userId: req.user.userId,
      username: req.user.username,
      role: req.user.role,
      status: req.user.status || 'ACTIVE',
      createdAt: req.user.createdAt || undefined,
      displayName: req.user.displayName,
      customerId: req.user.customerId || undefined,
      employeeId: req.user.employeeId || undefined
    }
  });
});

module.exports = router;
