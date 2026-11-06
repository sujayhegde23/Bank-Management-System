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
  executeTransfer,
  listBankTransactions,
  getTransactionReceipt,
  verifyBeneficiary
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
 * POST /api/transactions/transfer/verify-beneficiary
 * POST /api/transactions/verify-beneficiary
 * Verify destination beneficiary account details prior to transfer (Feature 3).
 * Access: Authenticated CUSTOMER only.
 */
router.post(['/transfer/verify-beneficiary', '/verify-beneficiary'], requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
  try {
    const { destinationAccount, destinationAccountNumber, destinationAccountId, sourceAccountId } = req.body || {};
    const dest = destinationAccountId !== undefined && destinationAccountId !== null && destinationAccountId !== ''
      ? destinationAccountId
      : (destinationAccountNumber || destinationAccount);

    const result = await verifyBeneficiary({
      destinationAccount: dest,
      sourceAccountId,
      sessionCustomerId: req.user.customerId
    });

    return res.status(200).json({
      success: true,
      message: 'Beneficiary account verified successfully.',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.get(['/transfer/verify-beneficiary', '/verify-beneficiary'], requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
  try {
    const { destinationAccount, destinationAccountNumber, destinationAccountId, sourceAccountId } = req.query || {};
    const dest = destinationAccountId !== undefined && destinationAccountId !== null && destinationAccountId !== ''
      ? destinationAccountId
      : (destinationAccountNumber || destinationAccount);

    const result = await verifyBeneficiary({
      destinationAccount: dest,
      sourceAccountId,
      sessionCustomerId: req.user.customerId
    });

    return res.status(200).json({
      success: true,
      message: 'Beneficiary account verified successfully.',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

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

    if (!req.user.customerId) {
      return res.status(403).json({
        success: false,
        errorCode: 'AUTH_002',
        message: 'Customer profile required for transfer operations',
        error: { code: 'AUTH_002', message: 'Customer profile required for transfer operations' }
      });
    }

    // Verify source account belongs strictly to authenticated customer
    const srcRows = await query('SELECT customer_id FROM accounts WHERE account_id = ? LIMIT 1', [parsedSourceAccountId]);
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
      sourceAccountId: parsedSourceAccountId,
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

router.get('/', requireAuth, requireRole('EMPLOYEE', 'ADMIN'), async (req, res, next) => {
  try {
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

    const limitParam = req.query.limit !== undefined ? req.query.limit : req.query.size;
    if (limitParam !== undefined) {
      const parsedLimit = parseStrictAccountId(limitParam);
      if (parsedLimit === null || parsedLimit < 1 || parsedLimit > 100) {
        return res.status(400).json({
          success: false,
          errorCode: 'VAL_001',
          message: 'Invalid limit parameter. Must be an integer between 1 and 100.',
          error: {
            code: 'VAL_001',
            message: 'Invalid limit parameter. Must be an integer between 1 and 100.'
          }
        });
      }
    }

    const result = await listBankTransactions({
      page: req.query.page,
      limit: limitParam,
      accountNumber: req.query.accountNumber,
      accountId: req.query.accountId,
      type: req.query.type,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to,
      search: req.query.search
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
 * GET /api/transactions/:transactionId/receipt
 * Retrieve authoritative transaction receipt proof for cash deposits, withdrawals, and transfers (Feature 2).
 * Access: Authenticated EMPLOYEE, ADMIN, or owning CUSTOMER.
 */
router.get('/:transactionId/receipt', requireAuth, async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const receipt = await getTransactionReceipt({
      transactionIdentifier: transactionId,
      user: req.user
    });

    return res.status(200).json({
      success: true,
      data: receipt
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

