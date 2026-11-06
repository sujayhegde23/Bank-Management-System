/**
 * ==============================================================================
 * Fraud Rule 3: NEW_BENEFICIARY
 * ==============================================================================
 * Purpose: Detect transfers directed to a beneficiary who has not previously
 * received funds from the sending account/customer.
 *
 * Evaluation Logic:
 * - Applies ONLY to TRANSFER transactions. Bypasses DEPOSIT and WITHDRAWAL.
 * - Accepts beneficiary history as part of the supplied transaction context.
 * - Does not infer or guess beneficiary history if reliable context is missing.
 * - Triggers when the beneficiary is confirmed to be new.
 * ==============================================================================
 */

/**
 * Evaluates the NEW_BENEFICIARY rule against supplied transaction context.
 *
 * @param {object} transaction - Validated transaction payload
 * @param {object} rule - MongoDB fraud rule document
 * @param {object} [context] - Historical transaction context
 * @returns {Promise<{ triggered: boolean, points?: number, description?: string }>}
 */
async function evaluateNewBeneficiary(transaction, rule, context = {}) {
  // 1. Rule applies strictly to TRANSFER operations
  if (transaction.transactionType !== 'TRANSFER') {
    return {
      triggered: false,
      reason: 'Rule applies only to TRANSFER transactions'
    };
  }

  const safeContext = context && typeof context === 'object' ? context : {};

  // 2. Beneficiary history must be reliably supplied
  const hasReliableContext =
    safeContext.isNewBeneficiary !== undefined ||
    safeContext.previousTransfersCount !== undefined ||
    safeContext.knownBeneficiary !== undefined ||
    safeContext.beneficiaryHistory !== undefined;

  if (!hasReliableContext) {
    return {
      triggered: false,
      reason: 'No reliable beneficiary history supplied in context'
    };
  }

  // 3. Evaluate context to see if beneficiary is new
  const isExplicitlyNew = safeContext.isNewBeneficiary === true;
  const isZeroPreviousTransfers =
    safeContext.previousTransfersCount === 0 ||
    safeContext.beneficiaryHistory?.previousTransfers === 0;
  const isUnknownBeneficiary =
    safeContext.knownBeneficiary === false ||
    safeContext.beneficiaryHistory?.isNew === true;

  const isNew = isExplicitlyNew || isZeroPreviousTransfers || isUnknownBeneficiary;

  // If context indicates known beneficiary or previous transfers exist
  if (!isNew) {
    return { triggered: false };
  }

  const destInfo = transaction.destinationAccountId
    ? ` account #${transaction.destinationAccountId}`
    : '';

  return {
    triggered: true,
    points: rule.weight,
    description: `First-time transfer to beneficiary${destInfo}. Recipient has not previously received funds from this sender.`
  };
}

module.exports = {
  evaluateNewBeneficiary
};

