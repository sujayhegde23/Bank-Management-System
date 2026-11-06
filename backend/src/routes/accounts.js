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
const { recordAuditEvent } = require('../services/auditService');
const {
  executeDeposit,
  executeWithdrawal,
  getAccountTransactions,
  executeTransfer
} = require('../services/transactionService');
const {
  generateAccountStatement,
  statementToCsv
} = require('../services/statementService');

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
 * Format account database row into safe, uniform API response.
 * Enforces Feature 2 balance clarity:
 * - balance: stored DECIMAL balance (backward compatibility)
 * - currentBalance: actual stored monetary ledger balance
 * - availableBalance: funds available for transaction (equals currentBalance for ACTIVE, 0 for FROZEN/INACTIVE)
 * @param {Object} r
 * @returns {Object}
 */
function formatAccountResponse(r) {
  const balanceNum = Number(r.balance);
  const isActive = r.status === 'ACTIVE';
  return {
    accountId: r.account_id,
    accountNumber: r.account_number,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    accountType: r.account_type,
    balance: balanceNum,
    currentBalance: balanceNum,
    availableBalance: isActive ? balanceNum : 0,
    status: r.status,
    openedAt: r.opened_at,
    updatedAt: r.updated_at
  };
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

    await recordAuditEvent({
      actorUserId: req.user.userId,
      actionType: 'ACCOUNT_CREATED',
      targetEntityType: 'ACCOUNT',
      targetEntityId: createdAccount.account_id,
      description: `Account '${createdAccount.account_number}' (${createdAccount.account_type}) created for customer '${customer.full_name}' by ${req.user.role.toLowerCase()} '${req.user.username}'.`,
      result: 'SUCCESS',
      metadata: {
        accountId: createdAccount.account_id,
        accountNumber: createdAccount.account_number,
        customerId: createdAccount.customer_id,
        accountType: createdAccount.account_type
      }
    });

    return res.status(201).json({
      success: true,
      data: formatAccountResponse({
        ...createdAccount,
        customer_name: customer.full_name,
        customer_email: customer.email,
        customer_phone: customer.phone
      })
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
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_002',
          message: 'Customer profile required for account operations',
          error: {
            code: 'AUTH_002',
            message: 'Customer profile required for account operations'
          }
        });
      }

      // If customer provides customerId filter that does not match their own, reject (anti-spoofing)
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

    // Filter by status (permitted for customer, staff, and admin)
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

    // Filter by accountType (permitted for customer, staff, and admin)
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
      if (isCustomer) {
        // Customer search is scoped strictly to account number (prevents cross-customer reconnaissance)
        conditions.push('a.account_number LIKE ?');
        params.push(term);
      } else {
        conditions.push('(a.account_number LIKE ? OR c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)');
        params.push(term, term, term, term);
      }
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += ` ORDER BY a.account_id ASC`;

    const rows = await query(sql, params);

    const accounts = rows.map(formatAccountResponse);

    return res.status(200).json({
      success: true,
      data: accounts
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts/summary
 * Aggregate account metrics (Current balance, Available balance, and status breakdown).
 * Available balance rules (Feature 2):
 * - ACTIVE account: available balance equals current stored balance.
 * - FROZEN account: available balance is 0.00 (transfers restricted per FR-11).
 * - INACTIVE account: available balance is 0.00 (dormant/closed).
 * Access: Customer (own accounts), Employee, Admin.
 */
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const isCustomer = req.user.role === 'CUSTOMER';
    let sql = `
      SELECT 
        COUNT(*) AS total_accounts,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_accounts,
        SUM(CASE WHEN status = 'FROZEN' THEN 1 ELSE 0 END) AS frozen_accounts,
        SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive_accounts,
        COALESCE(SUM(balance), 0.00) AS total_current_balance,
        COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN balance ELSE 0.00 END), 0.00) AS total_available_balance
      FROM accounts
    `;
    const params = [];

    if (isCustomer) {
      if (!req.user.customerId) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_002',
          message: 'Customer profile required for account operations',
          error: {
            code: 'AUTH_002',
            message: 'Customer profile required for account operations'
          }
        });
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

      sql += ' WHERE customer_id = ?';
      params.push(req.user.customerId);
    } else if (req.query.customerId) {
      const cId = parseStrictCustomerId(req.query.customerId);
      if (!cId) {
        return res.status(400).json({
          success: false,
          errorCode: 'VAL_001',
          message: 'Invalid customer ID filter',
          error: { code: 'VAL_001', message: 'Invalid customer ID filter' }
        });
      }
      sql += ' WHERE customer_id = ?';
      params.push(cId);
    }

    const rows = await query(sql, params);
    const row = rows[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        totalAccounts: Number(row.total_accounts || 0),
        activeAccounts: Number(row.active_accounts || 0),
        frozenAccounts: Number(row.frozen_accounts || 0),
        inactiveAccounts: Number(row.inactive_accounts || 0),
        totalCurrentBalance: Number(Number(row.total_current_balance || 0).toFixed(2)),
        totalAvailableBalance: Number(Number(row.total_available_balance || 0).toFixed(2)),
        currency: 'INR'
      }
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
    if (req.user.role === 'CUSTOMER' && (!req.user.customerId || Number(account.customer_id) !== Number(req.user.customerId))) {
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
      data: formatAccountResponse(account)
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

    let actionType = 'ACCOUNT_UPDATED';
    if (targetStatus === 'FROZEN') {
      actionType = 'ACCOUNT_FROZEN';
    } else if (targetStatus === 'ACTIVE' && existing[0].status === 'FROZEN') {
      actionType = 'ACCOUNT_UNFROZEN';
    } else if (targetStatus === 'ACTIVE' && existing[0].status === 'INACTIVE') {
      actionType = 'ACCOUNT_REACTIVATED';
    } else if (targetStatus === 'INACTIVE') {
      actionType = 'ACCOUNT_DEACTIVATED';
    }

    await recordAuditEvent({
      actorUserId: req.user.userId,
      actionType,
      targetEntityType: 'ACCOUNT',
      targetEntityId: accountId,
      description: `Account ${existing[0].account_number} status changed from ${existing[0].status} to ${targetStatus} by ${req.user.role.toLowerCase()} '${req.user.username}'.${reason ? ` Reason: ${reason}` : ''}`,
      result: 'SUCCESS',
      metadata: {
        accountId,
        accountNumber: existing[0].account_number,
        previousStatus: existing[0].status,
        newStatus: targetStatus,
        reason: reason || null
      }
    });

    return res.status(200).json({
      success: true,
      message: `Account status successfully updated to ${targetStatus}`,
      data: {
        ...formatAccountResponse(updated),
        reason: reason || null
      }
    });
  } catch (error) {
    next(error);
  }
});


/**
 * POST /api/accounts/:accountId/deposits
 * Deposit money into an active account (FR-11, FR-12, FR-18, FR-19, Architecture §9.3.10).
 * Access: Authenticated EMPLOYEE only.
 */
router.post('/:accountId/deposits', requireAuth, requireRole('EMPLOYEE'), async (req, res, next) => {
  try {
    const accountId = parseStrictAccountId(req.params.accountId);
    if (!accountId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid account ID. Must be a positive integer.',
        error: {
          code: 'VAL_001',
          message: 'Invalid account ID. Must be a positive integer.'
        }
      });
    }

    const { amount, remarks, _testFailurePoint } = req.body || {};
    const result = await executeDeposit({
      accountId,
      amount,
      remarks,
      performedByUserId: req.user.userId,
      _testFailurePoint
    });

    return res.status(201).json({
      success: true,
      message: `Successfully deposited ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(result.amount)} into account ${result.accountNumber}.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/accounts/:accountId/withdrawals
 * Withdraw money from an active account (FR-11, FR-13, FR-14, FR-18, FR-19, Architecture §9.3.11).
 * Access: Authenticated EMPLOYEE only.
 */
router.post('/:accountId/withdrawals', requireAuth, requireRole('EMPLOYEE'), async (req, res, next) => {
  try {
    const accountId = parseStrictAccountId(req.params.accountId);
    if (!accountId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid account ID. Must be a positive integer.',
        error: {
          code: 'VAL_001',
          message: 'Invalid account ID. Must be a positive integer.'
        }
      });
    }

    const { amount, remarks, _testFailurePoint } = req.body || {};
    const result = await executeWithdrawal({
      accountId,
      amount,
      remarks,
      performedByUserId: req.user.userId,
      _testFailurePoint
    });

    return res.status(201).json({
      success: true,
      message: `Successfully withdrew ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(result.amount)} from account ${result.accountNumber}.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts/:accountId/transactions
 * Retrieve transaction history for an account (FR-20, FR-21, Architecture §9.3.13).
 * Access: Authenticated Customer (own account), Employee, Admin.
 */
router.get('/:accountId/transactions', requireAuth, async (req, res, next) => {
  try {
    const accountId = parseStrictAccountId(req.params.accountId);
    if (!accountId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid account ID. Must be a positive integer.',
        error: {
          code: 'VAL_001',
          message: 'Invalid account ID. Must be a positive integer.'
        }
      });
    }

    // Horizontal authorization check for Customer
    if (req.user.role === 'CUSTOMER') {
      const accRows = await query('SELECT customer_id FROM accounts WHERE account_id = ? LIMIT 1', [accountId]);
      if (!accRows || accRows.length === 0) {
        return res.status(404).json({
          success: false,
          errorCode: 'ACC_002',
          message: 'Account not found',
          error: { code: 'ACC_002', message: 'Account not found' }
        });
      }
      if (!req.user.customerId || Number(accRows[0].customer_id) !== Number(req.user.customerId)) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_002',
          message: 'You are not authorized to perform this operation',
          error: { code: 'AUTH_002', message: 'You are not authorized to perform this operation' }
        });
      }
    }

    // Validate pagination params if supplied (AC-3, NFR-18)
    if (req.query.page !== undefined) {
      const parsedPage = parseStrictAccountId(req.query.page);
      if (parsedPage === null || parsedPage < 1) {
        return res.status(400).json({
          success: false,
          errorCode: 'VAL_001',
          message: 'Invalid page parameter. Must be a positive integer.',
          error: {
            code: 'VAL_001',
            message: 'Invalid page parameter. Must be a positive integer.'
          }
        });
      }
    }

    const sizeParam = req.query.size !== undefined ? req.query.size : req.query.limit;
    if (sizeParam !== undefined) {
      const parsedSize = parseStrictAccountId(sizeParam);
      if (parsedSize === null || parsedSize < 1 || parsedSize > 100) {
        return res.status(400).json({
          success: false,
          errorCode: 'VAL_001',
          message: 'Invalid size parameter. Must be an integer between 1 and 100.',
          error: {
            code: 'VAL_001',
            message: 'Invalid size parameter. Must be an integer between 1 and 100.'
          }
        });
      }
    }

    const result = await getAccountTransactions({
      accountId,
      user: req.user,
      page: req.query.page,
      size: sizeParam,
      type: req.query.type,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts/:accountId/statement
 * Generate customer bank account statement with running balances and period summary (Feature 3).
 * Query parameters:
 *  - from: start date (YYYY-MM-DD or ISO)
 *  - to: end date (YYYY-MM-DD or ISO)
 *  - preset: '7d' | '30d' | '90d' | 'all' | 'custom'
 *  - format: 'json' (default) | 'csv'
 * Access: Authenticated Employee, Admin, or owning Customer.
 */
router.get('/:accountId/statement', requireAuth, async (req, res, next) => {
  try {
    const accountId = parseStrictAccountId(req.params.accountId);
    if (!accountId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid account ID. Must be a positive integer.',
        error: {
          code: 'VAL_001',
          message: 'Invalid account ID. Must be a positive integer.'
        }
      });
    }

    // Horizontal authorization check for Customer
    if (req.user.role === 'CUSTOMER') {
      const accRows = await query('SELECT customer_id FROM accounts WHERE account_id = ? LIMIT 1', [accountId]);
      if (!accRows || accRows.length === 0) {
        return res.status(404).json({
          success: false,
          errorCode: 'ACC_002',
          message: 'Account not found',
          error: { code: 'ACC_002', message: 'Account not found' }
        });
      }
      if (!req.user.customerId || Number(accRows[0].customer_id) !== Number(req.user.customerId)) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_002',
          message: 'You are not authorized to perform this operation',
          error: { code: 'AUTH_002', message: 'You are not authorized to perform this operation' }
        });
      }
    }

    const { from, to, preset, format, page, limit } = req.query;

    const statement = await generateAccountStatement({
      accountId,
      user: req.user,
      from,
      to,
      preset,
      page,
      limit
    });

    if (format === 'csv' || req.headers.accept?.includes('text/csv')) {
      const csvData = statementToCsv(statement);
      const filename = `bank-statement-${statement.account.accountNumber}-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csvData);
    }

    return res.status(200).json({
      success: true,
      data: statement
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/accounts/:accountId/statement/csv
 * Dedicated direct CSV export endpoint for account statement.
 */
router.get('/:accountId/statement/csv', requireAuth, async (req, res, next) => {
  req.query.format = 'csv';
  try {
    const accountId = parseStrictAccountId(req.params.accountId);
    if (!accountId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid account ID. Must be a positive integer.'
      });
    }

    if (req.user.role === 'CUSTOMER') {
      const accRows = await query('SELECT customer_id FROM accounts WHERE account_id = ? LIMIT 1', [accountId]);
      if (!accRows || accRows.length === 0) {
        return res.status(404).json({
          success: false,
          errorCode: 'ACC_002',
          message: 'Account not found'
        });
      }
      if (!req.user.customerId || Number(accRows[0].customer_id) !== Number(req.user.customerId)) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_002',
          message: 'You are not authorized to perform this operation'
        });
      }
    }

    const { from, to, preset } = req.query;
    const statement = await generateAccountStatement({
      accountId,
      user: req.user,
      from,
      to,
      preset
    });

    const csvData = statementToCsv(statement);
    const filename = `bank-statement-${statement.account.accountNumber}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
});


/**
 * POST /api/accounts/:accountId/transfers
 * Customer fund transfer initiating from a specific source account (FR-15, FR-16, FR-17).
 * Access: Authenticated CUSTOMER only.
 */
router.post('/:accountId/transfers', requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
  try {
    const sourceAccountId = parseStrictAccountId(req.params.accountId);
    if (!sourceAccountId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid source account ID. Must be a positive integer.',
        error: {
          code: 'VAL_001',
          message: 'Invalid source account ID. Must be a positive integer.'
        }
      });
    }

    if (!req.user.customerId) {
      return res.status(403).json({
        success: false,
        errorCode: 'AUTH_002',
        message: 'Customer profile required for transfer operations',
        error: { code: 'AUTH_002', message: 'Customer profile required for transfer operations' }
      });
    }

    // Verify source account belongs strictly to authenticated customer
    const srcRows = await query('SELECT customer_id FROM accounts WHERE account_id = ? LIMIT 1', [sourceAccountId]);
    if (!srcRows || srcRows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'ACC_002',
        message: 'Source account not found',
        error: { code: 'ACC_002', message: 'Source account not found' }
      });
    }
    if (Number(srcRows[0].customer_id) !== Number(req.user.customerId)) {
      return res.status(403).json({
        success: false,
        errorCode: 'AUTH_002',
        message: 'You are not authorized to transfer from this account',
        error: { code: 'AUTH_002', message: 'You are not authorized to perform this operation' }
      });
    }

    const {
      destinationAccountId,
      destinationAccountNumber,
      destinationAccount,
      amount,
      remarks,
      _testFailurePoint
    } = req.body || {};

    const targetDest = destinationAccountId !== undefined && destinationAccountId !== null && destinationAccountId !== ''
      ? destinationAccountId
      : (destinationAccountNumber || destinationAccount);

    if (targetDest === undefined || targetDest === null || String(targetDest).trim() === '') {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Destination account is required.',
        error: {
          code: 'VAL_001',
          message: 'Destination account is required.'
        }
      });
    }

    if (amount === undefined || amount === null || amount === '') {
      return res.status(400).json({
        success: false,
        errorCode: 'TXN_002',
        message: 'Amount is required.',
        error: {
          code: 'TXN_002',
          message: 'Amount is required.'
        }
      });
    }

    const effectiveIdempotencyKey = req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'] ||
      req.body?.idempotencyKey ||
      req.body?.clientRequestId ||
      null;

    const result = await executeTransfer({
      sourceAccountId,
      destinationAccountId: targetDest,
      destinationAccountNumber,
      amount,
      remarks,
      performedByUserId: req.user.userId,
      sessionCustomerId: req.user.customerId,
      idempotencyKey: effectiveIdempotencyKey,
      _testFailurePoint
    });

    const formattedAmt = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(result.amount);

    return res.status(201).json({
      success: true,
      message: `Successfully transferred ${formattedAmt} to account ${result.destinationAccountNumber}.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

