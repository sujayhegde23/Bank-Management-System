/**
 * ==============================================================================
 * Authentication Routes
 * ==============================================================================
 * Endpoints:
 * - POST /api/auth/login   (Public: authenticates user, establishes session)
 * - POST /api/auth/logout  (Authenticated: destroys session, clears cookie)
 * - GET  /api/auth/me      (Authenticated: returns safe profile for active user)
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Precomputed static dummy hash used to equalize response timing when username does not exist
// Precalculated for "dummy-password-timing-mitigation" with 10 salt rounds
const DUMMY_HASH = '$2b$10$wT8K8U1yH4CqN0Xq7Z3CWeG5yH0bN2zL4pQ8vR6tS2uW1xY9zA3B.';

/**
 * POST /api/auth/login
 * Public endpoint to authenticate a user and establish a secure session.
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

    // 4. Verify account status (inactive users return generic AUTH_001 per FR-24 & Architecture §10.2)
    if (user.status !== 'ACTIVE') {
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

    // 5. Resolve display name and domain identifier from linked profile tables
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
      // SRS A-07: Administrators are USER rows with role ADMIN and no extra profile table
      displayName = 'Administrator';
    }

    // 6. Regenerate session to prevent session fixation and establish authenticated session
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error on login:', err.message);
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

      req.session.user = {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        displayName: displayName,
        customerId: customerId,
        employeeId: employeeId
      };

      return res.status(200).json({
        success: true,
        data: {
          userId: user.user_id,
          username: user.username,
          role: user.role,
          displayName: displayName
        }
      });
    });
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

  req.session.destroy((err) => {
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
      displayName: req.user.displayName,
      customerId: req.user.customerId || undefined,
      employeeId: req.user.employeeId || undefined
    }
  });
});

module.exports = router;
