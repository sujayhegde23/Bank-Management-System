/**
 * ==============================================================================
 * Fraud Detection Engine - Input Validation Utility
 * ==============================================================================
 * Validates banking transaction data and historical context supplied to the engine.
 * Ensures data integrity before any rule evaluation or persistence occurs.
 * ==============================================================================
 */

const { FraudValidationError } = require('./errors');
const { toPaise, toStoredPaise, toSafeId } = require('./monetary');

const SUPPORTED_TRANSACTION_TYPES = new Set(['TRANSFER', 'WITHDRAWAL', 'DEPOSIT']);

/**
 * Validates transaction and context inputs for fraud evaluation.
 *
 * @param {object} transaction - Completed banking transaction payload
 * @param {object} [context] - Historical transaction and relationship context
 * @returns {{
 *   transactionId: number,
 *   customerId: number,
 *   accountId: number,
 *   transactionType: 'TRANSFER'|'WITHDRAWAL'|'DEPOSIT',
 *   amount: number,
 *   timestamp: Date,
 *   destinationAccountId: number|null
 * }} - Sanitized, validated transaction object
 */
function validateTransactionInput(transaction, context = {}) {
  if (!transaction || typeof transaction !== 'object' || Array.isArray(transaction)) {
    throw new FraudValidationError('Transaction payload must be a non-null object');
  }

  // 1. Transaction Identifier
  const rawTxId = transaction.transactionId ?? transaction.transaction_id;
  const transactionId = toSafeId(rawTxId, 'transactionId');

  // 2. Customer Identifier
  const rawCustId = transaction.customerId ?? transaction.customer_id;
  const customerId = toSafeId(rawCustId, 'customerId');

  // 3. Account Identifier (Source account)
  const rawAccountId = transaction.accountId ?? transaction.account_id ?? transaction.source_account_id;
  const accountId = toSafeId(rawAccountId, 'accountId');

  // 4. Destination Account (for transfers)
  let destinationAccountId = null;
  const rawDestId = transaction.destinationAccountId ?? transaction.destination_account_id;
  if (rawDestId !== undefined && rawDestId !== null && rawDestId !== '') {
    destinationAccountId = toSafeId(rawDestId, 'destinationAccountId');
  }

  // 5. Transaction Type
  const rawType = (transaction.transactionType ?? transaction.type ?? '').toString().trim().toUpperCase();
  if (!SUPPORTED_TRANSACTION_TYPES.has(rawType)) {
    throw new FraudValidationError(
      `Unsupported transaction type: "${rawType}". Allowed types: ${Array.from(SUPPORTED_TRANSACTION_TYPES).join(', ')}`
    );
  }

  // 6. Monetary Amount - Stored and calculated as integer paise (1 INR = 100 paise)
  let amount;
  if (transaction.isPaise === true || transaction.isAmountInPaise === true) {
    const rawVal = transaction.amount;
    if (typeof rawVal === 'number' && Number.isSafeInteger(rawVal) && rawVal > 0) {
      amount = rawVal;
    } else if (typeof rawVal === 'bigint' && rawVal > 0n && rawVal <= BigInt(Number.MAX_SAFE_INTEGER)) {
      amount = Number(rawVal);
    } else {
      throw new FraudValidationError(`Transaction amount must be strictly positive integer paise: "${rawVal}"`);
    }
  } else {
    amount = toStoredPaise(transaction.amount);
  }

  // 7. Timestamp
  const rawTime = transaction.timestamp ?? transaction.created_at ?? transaction.createdAt ?? new Date();
  const timestamp = new Date(rawTime);
  if (Number.isNaN(timestamp.getTime())) {
    throw new FraudValidationError(`Invalid transaction timestamp: "${rawTime}"`);
  }

  // 8. Historical Context Validation (if provided)
  if (context !== null && context !== undefined && (typeof context !== 'object' || Array.isArray(context))) {
    throw new FraudValidationError('Transaction historical context must be an object if provided');
  }

  const safeContext = context && typeof context === 'object' && !Array.isArray(context) ? context : {};

  if (safeContext.recentTransactionCount !== undefined) {
    const count = Number(safeContext.recentTransactionCount);
    if (!Number.isFinite(count) || count < 0) {
      throw new FraudValidationError(
        `context.recentTransactionCount must be a non-negative number, received: "${safeContext.recentTransactionCount}"`
      );
    }
  }

  if (safeContext.isNewBeneficiary !== undefined && typeof safeContext.isNewBeneficiary !== 'boolean') {
    throw new FraudValidationError(
      `context.isNewBeneficiary must be a boolean, received: ${typeof safeContext.isNewBeneficiary}`
    );
  }

  return {
    transactionId,
    customerId,
    accountId,
    destinationAccountId,
    transactionType: rawType,
    amount,
    timestamp
  };
}

module.exports = {
  validateTransactionInput,
  SUPPORTED_TRANSACTION_TYPES
};

