/**
 * ==============================================================================
 * Authentication and Authorization Middleware
 * ==============================================================================
 * Implements Architecture Specification Section 6 and Section 10:
 * - requireAuth: Verifies active session, checks live status in MySQL (FR-24),
 *   rejects unauthenticated/deactivated sessions with AUTH_003 (401).
 * - requireRole: Enforces server-side RBAC against Role-to-Operation matrix (FR-03, NFR-02),
 *   rejects unauthorized roles with AUTH_002 (403).
 * ==============================================================================
 */

const { query } = require('../config/db');

/**
 * Middleware: Verify that request has an active, valid session and active user in MySQL.
 */
async function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.userId) {
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

  try {
    // Verify user still exists and is ACTIVE in database on every protected request (FR-24, Architecture §6.2)
    const rows = await query(
      'SELECT user_id, username, role, status FROM users WHERE user_id = ?',
      [req.session.user.userId]
    );

    if (!rows || rows.length === 0 || rows[0].status !== 'ACTIVE') {
      // Invalidate session immediately if user was deactivated or deleted
      req.session.destroy(() => {});
      res.clearCookie('bms.sid');
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

    // Resolve domain-specific profile identity live from MySQL using foreign keys
    let customerId = null;
    let employeeId = null;
    let displayName = req.session.user.displayName || rows[0].username;

    if (rows[0].role === 'CUSTOMER') {
      const custRows = await query(
        'SELECT customer_id, full_name FROM customers WHERE user_id = ? LIMIT 1',
        [rows[0].user_id]
      );
      if (custRows && custRows.length > 0) {
        customerId = Number(custRows[0].customer_id);
        displayName = custRows[0].full_name;
      }
    } else if (rows[0].role === 'EMPLOYEE') {
      const empRows = await query(
        'SELECT employee_id, full_name FROM employees WHERE user_id = ? LIMIT 1',
        [rows[0].user_id]
      );
      if (empRows && empRows.length > 0) {
        employeeId = Number(empRows[0].employee_id);
        displayName = empRows[0].full_name;
      }
    } else if (rows[0].role === 'ADMIN') {
      displayName = 'Administrator';
    }

    // Attach fresh verified user context from database
    req.user = {
      userId: rows[0].user_id,
      username: rows[0].username,
      role: rows[0].role,
      displayName,
      customerId,
      employeeId
    };

    next();
  } catch (error) {
    console.error('requireAuth database verification error:', error.message);
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
}

/**
 * Middleware factory: Enforce role-based access control.
 * @param {...string} allowedRoles - Permitted roles (CUSTOMER, EMPLOYEE, ADMIN)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
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

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        errorCode: 'AUTH_002',
        message: 'You are not authorized to perform this operation',
        error: {
          code: 'AUTH_002',
          message: 'You are not authorized to perform this operation'
        }
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
