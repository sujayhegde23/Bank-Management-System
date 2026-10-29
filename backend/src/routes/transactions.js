/**
 * ==============================================================================
 * Transaction Management Routes (Issue #8)
 * ==============================================================================
 * Implements SRS FR-11, FR-12, FR-13, FR-14, FR-18, FR-19, NFR-04, NFR-07, NFR-08,
 * NFR-09, NFR-10, NFR-17, NFR-18, and Architecture Specification §9, §10, §11.
 *
 * Endpoints:
 * - POST /api/transactions/deposit   (Deposit funds; Employee only)
 * - POST /api/transactions/withdraw  (Withdraw funds; Employee only)
 * - GET  /api/transactions           (List recent transactions; Employee/Admin only)
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  executeDeposit,
  executeWithdrawal,
  executeTransfer
} = require('../services/transactionService');
const { query } = require('../config/db');

/**
 * Strict positive integer validator for account ID.
 * @param {any} val
 * @returns {number|null}
 */
function parseStrictAccountId(val) {
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
 * POST /api/transactions/deposit
 * Deposit cash/funds into an active bank account.
 * Access: Authenticated EMPLOYEE only (FR-12, Architecture §14 DD-08).
 */
router.post('/deposit', requireAuth, requireRole('EMPLOYEE'), async (req, res, next) => {
  try {
    const { accountId, amount, remarks, _testFailurePoint } = req.body || {};

    const parsedAccountId = parseStrictAccountId(accountId);
    if (!parsedAccountId) {
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

    const result = await executeDeposit({
      accountId: parsedAccountId,
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
 * POST /api/transactions/withdraw
 * Withdraw cash/funds from an active bank account.
 * Access: Authenticated EMPLOYEE only (FR-13, FR-14, Architecture §14 DD-08).
 */
router.post('/withdraw', requireAuth, requireRole('EMPLOYEE'), async (req, res, next) => {
  try {
    const { accountId, amount, remarks, _testFailurePoint } = req.body || {};

    const parsedAccountId = parseStrictAccountId(accountId);
    if (!parsedAccountId) {
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

    const result = await executeWithdrawal({
      accountId: parsedAccountId,
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
 * GET /api/transactions
 * Retrieve recent transaction records for banking oversight (FR-21).
 * Access: Authenticated EMPLOYEE or ADMIN only.
 */

/**
 * POST /api/transactions/transfer
 * Customer fund transfer between accounts (FR-15, FR-16, FR-17).
 * Access: Authenticated CUSTOMER only.
 */
router.post('/transfer', requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
  try {
    const {
      sourceAccountId,
      destinationAccountId,
      destinationAccountNumber,
      destinationAccount,
      amount,
      remarks,
      _testFailurePoint
    } = req.body || {};

    const parsedSourceAccountId = parseStrictAccountId(sourceAccountId);
    if (!parsedSourceAccountId) {
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

    const result = await executeTransfer({
      sourceAccountId: parsedSourceAccountId,
      destinationAccountId: targetDest,
      destinationAccountNumber,
      amount,
      remarks,
      performedByUserId: req.user.userId,
      sessionCustomerId: req.user.customerId,
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

router.get('/', requireAuth, requireRole('EMPLOYEE', 'ADMIN'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const countRows = await query('SELECT COUNT(*) AS total FROM bank_transactions');
    const total = countRows[0]?.total || 0;

    const rows = await query(
      `SELECT
         t.transaction_id AS transactionId,
         t.transaction_ref AS transactionRef,
         t.type,
         t.amount,
         t.source_account_id AS sourceAccountId,
         t.destination_account_id AS destinationAccountId,
         t.performed_by_user_id AS performedByUserId,
         t.remarks,
         t.created_at AS timestamp,
         sa.account_number AS sourceAccountNumber,
         da.account_number AS destinationAccountNumber
       FROM bank_transactions t
       LEFT JOIN accounts sa ON t.source_account_id = sa.account_id
       LEFT JOIN accounts da ON t.destination_account_id = da.account_id
       ORDER BY t.created_at DESC, t.transaction_id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        transactions: rows.map((r) => ({
          ...r,
          amount: Number(r.amount)
        })),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

