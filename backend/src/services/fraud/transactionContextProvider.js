/**
 * ==============================================================================
 * Fraud Detection Engine - Transaction Context Provider (Phase 3)
 * ==============================================================================
 * Queries MySQL for authoritative transaction details and calculates required
 * historical evaluation contexts for Phase 2 fraud detection rules:
 *
 * 1. HIGH_VELOCITY: Queries transactions within configured window (e.g., 2 min),
 *    strictly excluding the current transaction to prevent double counting.
 * 2. NEW_BENEFICIARY: Determines if this is the first transfer from sender to
 *    destination account, excluding the current transaction.
 * 3. UNUSUAL_HOUR: Supplies transaction timestamp to be evaluated in Asia/Kolkata.
 * ==============================================================================
 */

const { pool } = require('../../config/db');
const { toStoredPaise, toSafeId } = require('./utils/monetary');

/**
 * Builds authoritative transaction data and evaluation context from MySQL.
 *
 * @param {number|string} transactionId - Primary key in bank_transactions
 * @param {object} [options={}]
 * @param {number} [options.velocityWindowMinutes=2] - Time window for velocity rule
 * @param {import('mysql2/promise').Connection|import('mysql2/promise').Pool} [options.dbConn] - Optional connection
 * @returns {Promise<{
 *   transaction: {
 *     transactionId: number,
 *     transactionRef: string,
 *     transactionType: 'DEPOSIT'|'WITHDRAWAL'|'TRANSFER',
 *     amount: number,
 *     customerId: number,
 *     accountId: number,
 *     destinationAccountId: number|null,
 *     timestamp: Date
 *   },
 *   context: {
 *     recentTransactionCount: number,
 *     includeCurrentTransaction: boolean,
 *     isNewBeneficiary: boolean,
 *     previousTransfersCount: number
 *   }
 * }>}
 */
async function buildTransactionContext(transactionId, options = {}) {
  const db = options.dbConn || pool;
  const safeTxId = toSafeId(transactionId, 'transactionId');
  const windowMinutes = Math.max(1, parseInt(options.velocityWindowMinutes, 10) || 2);

  // 1. Fetch Authoritative Transaction Record with joined accounts for customer derivation
  const [rows] = await db.execute(
    `SELECT
       bt.transaction_id,
       bt.transaction_ref,
       bt.type,
       bt.amount,
       bt.source_account_id,
       bt.destination_account_id,
       bt.performed_by_user_id,
       bt.created_at,
       src.customer_id AS source_customer_id,
       dest.customer_id AS destination_customer_id
     FROM bank_transactions bt
     LEFT JOIN accounts src ON bt.source_account_id = src.account_id
     LEFT JOIN accounts dest ON bt.destination_account_id = dest.account_id
     WHERE bt.transaction_id = ?`,
    [safeTxId]
  );

  if (!rows || rows.length === 0) {
    const error = new Error(`Transaction #${safeTxId} not found in database ledger`);
    error.code = 'TXN_NOT_FOUND';
    error.isPermanent = true;
    throw error;
  }

  const txRow = rows[0];
  const txType = String(txRow.type).toUpperCase();
  const txCreatedAt = new Date(txRow.created_at);

  let primaryAccountId = null;
  let primaryCustomerId = null;
  let destinationAccountId = null;

  if (txType === 'DEPOSIT') {
    primaryAccountId = txRow.destination_account_id;
    primaryCustomerId = txRow.destination_customer_id;
  } else if (txType === 'WITHDRAWAL') {
    primaryAccountId = txRow.source_account_id;
    primaryCustomerId = txRow.source_customer_id;
  } else if (txType === 'TRANSFER') {
    primaryAccountId = txRow.source_account_id;
    primaryCustomerId = txRow.source_customer_id;
    destinationAccountId = txRow.destination_account_id;
  }

  if (!primaryAccountId) {
    const error = new Error(`Transaction #${safeTxId} missing primary account reference`);
    error.code = 'INVALID_ACCOUNT_REFERENCE';
    error.isPermanent = true;
    throw error;
  }

  if (!primaryCustomerId) {
    const error = new Error(`Transaction #${safeTxId} missing customer association on account #${primaryAccountId}`);
    error.code = 'INVALID_CUSTOMER_REFERENCE';
    error.isPermanent = true;
    throw error;
  }

  // 2. High Velocity Context Calculation
  // Strict exclusion of the current transaction to eliminate double counting hazards.
  // Window: [txCreatedAt - windowMinutes, txCreatedAt]
  const [velocityRows] = await db.execute(
    `SELECT COUNT(*) AS count
     FROM bank_transactions
     WHERE (source_account_id = ? OR destination_account_id = ?)
       AND created_at >= (? - INTERVAL ? MINUTE)
       AND created_at <= ?
       AND transaction_id != ?`,
    [primaryAccountId, primaryAccountId, txCreatedAt, windowMinutes, txCreatedAt, safeTxId]
  );

  const recentCount = velocityRows && velocityRows.length > 0 ? Number(velocityRows[0].count) : 0;

  // 3. New Beneficiary Context Calculation (Only relevant for transfers)
  let isNewBeneficiary = false;
  let previousTransfersCount = 0;

  if (txType === 'TRANSFER' && destinationAccountId) {
    const [beneficiaryRows] = await db.execute(
      `SELECT COUNT(*) AS count
       FROM bank_transactions
       WHERE type = 'TRANSFER'
         AND source_account_id = ?
         AND destination_account_id = ?
         AND transaction_id != ?
         AND created_at <= ?`,
      [primaryAccountId, destinationAccountId, safeTxId, txCreatedAt]
    );

    const prevCount = beneficiaryRows && beneficiaryRows.length > 0 ? Number(beneficiaryRows[0].count) : 0;
    previousTransfersCount = prevCount;
    isNewBeneficiary = prevCount === 0;
  }

  // 4. Return Normalized Transaction Payload and Rich Context
  return {
    transaction: {
      transactionId: safeTxId,
      transactionRef: txRow.transaction_ref,
      transactionType: txType,
      amount: toStoredPaise(txRow.amount), // Integer paise conversion
      isPaise: true,
      customerId: primaryCustomerId,
      accountId: primaryAccountId,
      destinationAccountId: destinationAccountId || null,
      timestamp: txCreatedAt
    },
    context: {
      recentTransactionCount: recentCount,
      includeCurrentTransaction: false, // Informs rule evaluator that current tx is excluded from count
      isNewBeneficiary,
      previousTransfersCount
    }
  };
}

module.exports = {
  buildTransactionContext
};

