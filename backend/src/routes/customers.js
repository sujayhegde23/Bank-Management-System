/**
 * ==============================================================================
 * Customer Directory Routes
 * ==============================================================================
 * Implements customer lookup and search required for Account Creation (FR-07, FR-05)
 * and horizontal data privacy protection (NFR-03).
 *
 * Endpoints:
 * - GET /api/customers              (Search/List registered customers; Employee & Admin)
 * - GET /api/customers/:customerId  (View customer details; Employee, Admin, Customer own)
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * Strict positive integer validator for customer ID.
 * @param {string} rawId
 * @returns {number|null}
 */
function parseStrictCustomerId(rawId) {
  if (typeof rawId !== 'string') return null;
  if (!/^[1-9]\d*$/.test(rawId)) return null;
  const parsed = Number(rawId);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * GET /api/customers
 * List and search registered customers.
 * Access: Authenticated EMPLOYEE and ADMIN.
 */
router.get('/', requireAuth, requireRole('EMPLOYEE', 'ADMIN'), async (req, res, next) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT c.customer_id,
             c.user_id,
             c.full_name,
             c.date_of_birth,
             c.phone,
             c.email,
             c.address,
             c.created_at,
             c.updated_at,
             u.username,
             u.status AS user_status
      FROM customers c
      JOIN users u ON c.user_id = u.user_id
    `;
    const params = [];

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` WHERE c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR u.username LIKE ?`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY c.customer_id ASC`;

    const rows = await query(sql, params);

    const customers = rows.map((r) => ({
      customerId: r.customer_id,
      userId: r.user_id,
      username: r.username,
      fullName: r.full_name,
      dateOfBirth: r.date_of_birth,
      phone: r.phone,
      email: r.email,
      address: r.address,
      userStatus: r.user_status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/customers/:customerId
 * View details of a specific customer.
 * Access: Employee, Admin, or the Customer requesting their own profile.
 */
router.get('/:customerId', requireAuth, async (req, res, next) => {
  try {
    const customerId = parseStrictCustomerId(req.params.customerId);
    if (!customerId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid customer ID format. Must be a positive integer.',
        error: {
          code: 'VAL_001',
          message: 'Invalid customer ID format. Must be a positive integer.'
        }
      });
    }

    // Role check: Customer can only access their own profile
    if (req.user.role === 'CUSTOMER' && req.user.customerId !== customerId) {
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

    const rows = await query(
      `SELECT c.customer_id,
              c.user_id,
              c.full_name,
              c.date_of_birth,
              c.phone,
              c.email,
              c.address,
              c.created_at,
              c.updated_at,
              u.username,
              u.status AS user_status
       FROM customers c
       JOIN users u ON c.user_id = u.user_id
       WHERE c.customer_id = ?
       LIMIT 1`,
      [customerId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'CUST_001',
        message: 'Customer not found',
        error: {
          code: 'CUST_001',
          message: 'Customer not found'
        }
      });
    }

    const r = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        customerId: r.customer_id,
        userId: r.user_id,
        username: r.username,
        fullName: r.full_name,
        dateOfBirth: r.date_of_birth,
        phone: r.phone,
        email: r.email,
        address: r.address,
        userStatus: r.user_status,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

