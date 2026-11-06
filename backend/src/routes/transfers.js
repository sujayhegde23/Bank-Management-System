/**
 * ==============================================================================
 * Customer Fund Transfer Routes (Issue #9 & Feature 3)
 * ==============================================================================
 * Implements SRS FR-15, FR-16, FR-17, NFR-03, NFR-06, NFR-08, NFR-09, NFR-10, NFR-17,
 * and Feature 3 Beneficiary Verification and Transfer Safety.
 *
 * Endpoints:
 * - POST /api/transfers                     (Customer initiates fund transfer between accounts; Customer only)
 * - POST /api/transfers/verify-beneficiary  (Verify beneficiary account details; Customer only)
 * - GET  /api/transfers/verify-beneficiary  (Verify beneficiary account details query; Customer only)
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { executeTransfer, verifyBeneficiary } = require('../services/transactionService');

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
 * POST /api/transfers/verify-beneficiary
 * Verify destination beneficiary account details prior to transfer (Feature 3).
 * Access: Authenticated CUSTOMER only.
 */
router.post('/verify-beneficiary', requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
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

/**
 * GET /api/transfers/verify-beneficiary
 * Query-based beneficiary verification (Feature 3).
 * Access: Authenticated CUSTOMER only.
 */
router.get('/verify-beneficiary', requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
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
 * POST /api/transfers
 * Customer fund transfer from an account owned by authenticated customer to another account (FR-15).
 * Access: Authenticated CUSTOMER only (AC-1, Architecture §9).
 */
router.post('/', requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
  try {
    const {
      sourceAccountId,
      destinationAccountId,
      destinationAccountNumber,
      destinationAccount,
      amount,
      remarks,
      idempotencyKey,
      clientRequestId,
      _testFailurePoint
    } = req.body || {};

    // Validate customer profile
    if (!req.user.customerId) {
      return res.status(403).json({
        success: false,
        errorCode: 'AUTH_002',
        message: 'Customer profile required for transfer operations',
        error: { code: 'AUTH_002', message: 'Customer profile required for transfer operations' }
      });
    }

    // Validate source account ID
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

    // Determine destination target
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

    // Amount presence check before parsing
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
      idempotencyKey ||
      clientRequestId ||
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

    if (result.isIdempotentReplay) {
      return res.status(200).json({
        success: true,
        message: `Transfer request already processed. Reference: ${result.transactionRef}.`,
        data: result,
        idempotent: true
      });
    }

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
