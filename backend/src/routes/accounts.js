/**
 * ==============================================================================
 * Bank Account Management Routes (Issue #7)
 * ==============================================================================
 * Implements SRS FR-07, FR-08, FR-09, FR-10, FR-11, NFR-03, NFR-16, NFR-18,
 * and Architecture Specification §4 (CMP-05), §9 (Endpoints 8, 9, 10, 11), §10.
 *
 * Endpoints:
 * - POST  /api/accounts                (Create new bank account; Employee only)
 * - GET   /api/accounts                (List accounts; Employee/Admin all, Customer own)
 * - GET   /api/accounts/:accountId     (View account details; Employee/Admin, Customer own)
 * - PATCH /api/accounts/:accountId/status (Update account status; Employee only)
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const { query, withTransaction } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateUniqueAccountNumber } = require('../services/accountService');

// Permitted account types
const VALID_ACCOUNT_TYPES = ['SAVINGS', 'CURRENT'];

// Permitted account statuses
const VALID_ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'FROZEN'];

// Forbidden client fields on account creation
const FORBIDDEN_CREATE_FIELDS = [
  'account_id',
  'accountId',
  'account_number',
  'accountNumber',
  'status',
  'opened_at',
  'openedAt',
  'updated_at',
  'updatedAt'
];

/**
 * Strict validator for account ID route parameter.
 * Accepts only positive safe integers without trailing characters, decimals, or signs.
 * Rejects values like "12abc", "1.5", "0", "-5", or values outside Number.isSafeInteger.
 *
 * @param {string} rawId
 * @returns {number|null}
 */
function parseStrictAccountId(rawId) {
  if (typeof rawId !== 'string') return null;
  if (!/^[1-9]\d*$/.test(rawId)) return null;
  const parsed = Number(rawId);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Strict positive integer validator for customer ID.
 * @param {any} val
 * @returns {number|null}
 */
function parseStrictCustomerId(val) {
  if (typeof val === 'number') {
    return Number.isSafeInteger(val) && val > 0 ? val : null;
  }
  if (typeof val === 'string' && /^[1-9]\d*$/.test(val.trim())) {
    const parsed = Number(val.trim());
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

/**
 * POST /api/accounts
 * Create a new bank account for an existing registered customer.
 * Access: Authenticated EMPLOYEE only (FR-07, Architecture §9.2).
 */
router.post('/', requireAuth, requireRole('EMPLOYEE'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const validationErrors = [];

    // 1. Reject forbidden client-supplied fields
    for (const field of FORBIDDEN_CREATE_FIELDS) {
      if (body[field] !== undefined) {
        validationErrors.push({
          field,
          issue: `Field '${field}' is system-generated and cannot be specified by the client`
        });
      }
    }

    // 2. Initial balance rules: must be 0.00
    const rawBalance = body.balance !== undefined ? body.balance : body.openingBalance;
    if (rawBalance !== undefined && rawBalance !== null) {
      const numBal = Number(rawBalance);
      if (isNaN(numBal) || numBal !== 0) {
        validationErrors.push({
          field: body.balance !== undefined ? 'balance' : 'openingBalance',
          issue: 'New accounts must start with an initial balance of 0.00. Deposits must be made via future transaction workflows.'
        });
      }
    }

    // 3. Customer ID validation
    const customerId = parseStrictCustomerId(body.customerId);
    if (!customerId) {
      validationErrors.push({
        field: 'customerId',
        issue: 'A valid positive customer ID is required'
      });
    }

    // 4. Account Type validation
    const rawType = body.accountType ? String(body.accountType).trim().toUpperCase() : 'SAVINGS';
    if (!VALID_ACCOUNT_TYPES.includes(rawType)) {
      validationErrors.push({
        field: 'accountType',
        issue: `Invalid account type '${body.accountType}'. Supported types are: ${VALID_ACCOUNT_TYPES.join(', ')}`
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid input',
        fields: validationErrors,
        error: {
          code: 'VAL_001',
          message: 'Invalid input',
          fields: validationErrors
        }
      });
    }

    // 5. Verify customer exists in database
    const customerRows = await query(
      `SELECT customer_id, full_name, email, phone FROM customers WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );

    if (!customerRows || customerRows.length === 0) {
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

    const customer = customerRows[0];

    // 6. Generate unique account number and create account within atomic transaction
    const createdAccount = await withTransaction(async (conn) => {
      let accountNumber = null;
      let insertResult = null;
      const MAX_INSERT_RETRIES = 5;

      for (let attempt = 1; attempt <= MAX_INSERT_RETRIES; attempt++) {
        accountNumber = await generateUniqueAccountNumber(rawType, conn);
        try {
          const [res] = await conn.execute(
            `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
             VALUES (?, ?, ?, 0.00, 'ACTIVE')`,
            [accountNumber, customerId, rawType]
          );
          insertResult = res;
          break;
        } catch (dbErr) {
          if (dbErr.code === 'ER_DUP_ENTRY' && attempt < MAX_INSERT_RETRIES) {
            continue; // Retry with next unique candidate
          }
          throw dbErr;
        }
      }

      const [newRow] = await conn.execute(
        `SELECT account_id, account_number, customer_id, account_type, balance, status, opened_at, updated_at
         FROM accounts
         WHERE account_id = ?`,
        [insertResult.insertId]
      );

      return newRow[0];
    });

    return res.status(201).json({
      success: true,
      data: {
        accountId: createdAccount.account_id,
        accountNumber: createdAccount.account_number,
        customerId: createdAccount.customer_id,
        customerName: customer.full_name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        accountType: createdAccount.account_type,
        balance: Number(createdAccount.balance),
        status: createdAccount.status,
        openedAt: createdAccount.opened_at,
        updatedAt: createdAccount.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts
 * Retrieve bank account records.
 * Access rules:
 * - EMPLOYEE & ADMIN: Can list all accounts or filter by customerId, status, accountType, search.
 * - CUSTOMER: Can view ONLY their own accounts (NFR-03, SO-01, TC-16).
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const isStaffOrAdmin = req.user.role === 'EMPLOYEE' || req.user.role === 'ADMIN';
    const isCustomer = req.user.role === 'CUSTOMER';

    let sql = `
      SELECT a.account_id,
             a.account_number,
             a.customer_id,
             a.account_type,
             a.balance,
             a.status,
             a.opened_at,
             a.updated_at,
             c.full_name AS customer_name,
             c.email AS customer_email,
             c.phone AS customer_phone
      FROM accounts a
      JOIN customers c ON a.customer_id = c.customer_id
    `;
    const conditions = [];
    const params = [];

    if (isCustomer) {
      // Horizontal data protection: customers can only view their own accounts
      if (!req.user.customerId) {
        return res.status(200).json({ success: true, data: [] });
      }

      // If customer provides customerId filter that does not match their own, reject
      if (req.query.customerId && parseStrictCustomerId(req.query.customerId) !== req.user.customerId) {
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

      conditions.push('a.customer_id = ?');
      params.push(req.user.customerId);
    } else if (isStaffOrAdmin) {
      // Filter by customerId
      if (req.query.customerId) {
        const cId = parseStrictCustomerId(req.query.customerId);
        if (!cId) {
          return res.status(400).json({
            success: false,
            errorCode: 'VAL_001',
            message: 'Invalid customer ID filter',
            error: { code: 'VAL_001', message: 'Invalid customer ID filter' }
          });
        }
        conditions.push('a.customer_id = ?');
        params.push(cId);
      }

      // Filter by status
      if (req.query.status) {
        const statusUpper = String(req.query.status).trim().toUpperCase();
        if (!VALID_ACCOUNT_STATUSES.includes(statusUpper)) {
          return res.status(400).json({
            success: false,
            errorCode: 'VAL_001',
            message: `Invalid status filter. Permitted: ${VALID_ACCOUNT_STATUSES.join(', ')}`,
            error: { code: 'VAL_001', message: `Invalid status filter. Permitted: ${VALID_ACCOUNT_STATUSES.join(', ')}` }
          });
        }
        conditions.push('a.status = ?');
        params.push(statusUpper);
      }

      // Filter by accountType
      if (req.query.accountType) {
        const typeUpper = String(req.query.accountType).trim().toUpperCase();
        if (!VALID_ACCOUNT_TYPES.includes(typeUpper)) {
          return res.status(400).json({
            success: false,
            errorCode: 'VAL_001',
            message: `Invalid accountType filter. Permitted: ${VALID_ACCOUNT_TYPES.join(', ')}`,
            error: { code: 'VAL_001', message: `Invalid accountType filter. Permitted: ${VALID_ACCOUNT_TYPES.join(', ')}` }
          });
        }
        conditions.push('a.account_type = ?');
        params.push(typeUpper);
      }

      // Search keyword filter
      if (req.query.search && typeof req.query.search === 'string' && req.query.search.trim()) {
        const term = `%${req.query.search.trim()}%`;
        conditions.push('(a.account_number LIKE ? OR c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)');
        params.push(term, term, term, term);
      }
    } else {
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

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += ` ORDER BY a.account_id ASC`;

    const rows = await query(sql, params);

    const accounts = rows.map((r) => ({
      accountId: r.account_id,
      accountNumber: r.account_number,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      customerPhone: r.customer_phone,
      accountType: r.account_type,
      balance: Number(r.balance),
      status: r.status,
      openedAt: r.opened_at,
      updatedAt: r.updated_at
    }));

    return res.status(200).json({
      success: true,
      data: accounts
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts/:accountId
 * View details and balance for a specific bank account.
 * Access rules:
 * - EMPLOYEE & ADMIN: Can view any account.
 * - CUSTOMER: Can view ONLY their own account (NFR-03, SO-01, TC-16).
 */
router.get('/:accountId', requireAuth, async (req, res, next) => {
  try {
    const accountId = parseStrictAccountId(req.params.accountId);
    if (!accountId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid account ID format. Must be a positive integer.',
        error: {
          code: 'VAL_001',
          message: 'Invalid account ID format. Must be a positive integer.'
        }
      });
    }

    const rows = await query(
      `SELECT a.account_id,
              a.account_number,
              a.customer_id,
              a.account_type,
              a.balance,
              a.status,
              a.opened_at,
              a.updated_at,
              c.full_name AS customer_name,
              c.email AS customer_email,
              c.phone AS customer_phone
       FROM accounts a
       JOIN customers c ON a.customer_id = c.customer_id
       WHERE a.account_id = ?
       LIMIT 1`,
      [accountId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'ACC_002',
        message: 'Account not found',
        error: {
          code: 'ACC_002',
          message: 'Account not found'
        }
      });
    }

    const account = rows[0];

    // Customer horizontal authorization check
    if (req.user.role === 'CUSTOMER' && account.customer_id !== req.user.customerId) {
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

    return res.status(200).json({
      success: true,
      data: {
        accountId: account.account_id,
        accountNumber: account.account_number,
        customerId: account.customer_id,
        customerName: account.customer_name,
        customerEmail: account.customer_email,
        customerPhone: account.customer_phone,
        accountType: account.account_type,
        balance: Number(account.balance),
        status: account.status,
        openedAt: account.opened_at,
        updatedAt: account.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/accounts/:accountId/status
 * Activate, deactivate, freeze, or unfreeze a bank account (FR-10).
 * Access: Authenticated EMPLOYEE only.
 */
router.patch('/:accountId/status', requireAuth, requireRole('EMPLOYEE'), async (req, res, next) => {
  try {
    const accountId = parseStrictAccountId(req.params.accountId);
    if (!accountId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid account ID format. Must be a positive integer.',
        error: {
          code: 'VAL_001',
          message: 'Invalid account ID format. Must be a positive integer.'
        }
      });
    }

    const { status, reason } = req.body || {};

    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Status field is required and must be a string',
        error: {
          code: 'VAL_001',
          message: 'Status field is required and must be a string'
        }
      });
    }

    const targetStatus = status.trim().toUpperCase();
    if (!VALID_ACCOUNT_STATUSES.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: `Invalid status value '${status}'. Permitted statuses are: ${VALID_ACCOUNT_STATUSES.join(', ')}`,
        error: {
          code: 'VAL_001',
          message: `Invalid status value '${status}'. Permitted statuses are: ${VALID_ACCOUNT_STATUSES.join(', ')}`
        }
      });
    }

    // Check for illegal fields in PATCH body (e.g. balance manipulation attempts)
    const illegalFields = Object.keys(req.body).filter(k => k !== 'status' && k !== 'reason');
    if (illegalFields.length > 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: `Cannot update field(s): ${illegalFields.join(', ')} via status endpoint`,
        error: {
          code: 'VAL_001',
          message: `Cannot update field(s): ${illegalFields.join(', ')} via status endpoint`
        }
      });
    }

    // Verify account exists
    const existing = await query(
      `SELECT account_id, account_number, customer_id, account_type, balance, status
       FROM accounts
       WHERE account_id = ?
       LIMIT 1`,
      [accountId]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'ACC_002',
        message: 'Account not found',
        error: {
          code: 'ACC_002',
          message: 'Account not found'
        }
      });
    }

    // Update status in database
    await query(
      `UPDATE accounts SET status = ? WHERE account_id = ?`,
      [targetStatus, accountId]
    );

    // Fetch updated account with customer details
    const updatedRows = await query(
      `SELECT a.account_id,
              a.account_number,
              a.customer_id,
              a.account_type,
              a.balance,
              a.status,
              a.opened_at,
              a.updated_at,
              c.full_name AS customer_name,
              c.email AS customer_email,
              c.phone AS customer_phone
       FROM accounts a
       JOIN customers c ON a.customer_id = c.customer_id
       WHERE a.account_id = ?
       LIMIT 1`,
      [accountId]
    );

    const updated = updatedRows[0];

    return res.status(200).json({
      success: true,
      message: `Account status successfully updated to ${targetStatus}`,
      data: {
        accountId: updated.account_id,
        accountNumber: updated.account_number,
        customerId: updated.customer_id,
        customerName: updated.customer_name,
        customerEmail: updated.customer_email,
        customerPhone: updated.customer_phone,
        accountType: updated.account_type,
        balance: Number(updated.balance),
        status: updated.status,
        reason: reason || null,
        openedAt: updated.opened_at,
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

