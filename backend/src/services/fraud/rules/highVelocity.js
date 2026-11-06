/**
 * ==============================================================================
 * Fraud Rule 2: HIGH_VELOCITY
 * ==============================================================================
 * Purpose: Detect high frequency of transactions within a short time window.
 *
 * Evaluation Logic:
 * - Reads threshold and window configuration from MongoDB rule document.
 * - Accepts historical context supplied by caller (no direct MySQL queries).
 * - Compares transaction count against rule.threshold.
 * - Triggers strictly when count > rule.threshold.
 * - Does not trigger when count <= rule.threshold.
 *
 * Count Convention & Double-Counting Prevention:
 * - Caller supplies transaction frequency via `context.recentTransactionCount` or
 *   `context.recentTransactions` (array of transactions/timestamps in window).
 * - If `context.recentTransactionCount` is provided and `context.includeCurrentTransaction === false`,
 *   the current transaction is counted by incrementing the count by 1.
 * - Otherwise, the supplied count is evaluated directly to match the caller's pre-computed
 *   window tally without accidental double-counting.
 * ==============================================================================
 */

/**
 * Evaluates the HIGH_VELOCITY rule against supplied transaction context.
 *
 * @param {object} transaction - Validated transaction payload
 * @param {object} rule - MongoDB fraud rule document
 * @param {object} [context] - Historical transaction context
 * @returns {Promise<{ triggered: boolean, points?: number, description?: string }>}
 */
async function evaluateHighVelocity(transaction, rule, context = {}) {
  const safeContext = context && typeof context === 'object' ? context : {};
  let count = 0;

  if (safeContext.recentTransactionCount !== undefined && safeContext.recentTransactionCount !== null) {
    count = Number(safeContext.recentTransactionCount);
    // Explicit opt-in only: if caller asserts current transaction was excluded from count, increment once
    if (safeContext.includeCurrentTransaction === false || safeContext.currentTransactionIncluded === false) {
      count += 1;
    }
  } else if (Array.isArray(safeContext.recentTransactions)) {
    // Check if the current transaction is already in the supplied historical array
    const containsCurrent = safeContext.recentTransactions.some(
      (tx) => (tx && typeof tx === 'object') && (
        tx.transactionId === transaction.transactionId ||
        tx.id === transaction.transactionId ||
        tx.transaction_id === transaction.transactionId
      )
    );

    count = safeContext.recentTransactions.length;
    if ((safeContext.includeCurrentTransaction === false || safeContext.currentTransactionIncluded === false) && !containsCurrent) {
      count += 1;
    }
  } else {
    // Missing, null, or empty velocity context safely results in non-trigger
    return { triggered: false };
  }

  const threshold = Number(rule.threshold ?? 3);
  const windowMinutes = rule.config?.windowMinutes ?? 2;

  // Trigger strictly when count exceeds threshold
  if (count > threshold) {
    return {
      triggered: true,
      points: rule.weight,
      description: `High transaction velocity: observed ${count} transactions within ${windowMinutes}-minute window (configured threshold: ${threshold})`
    };
  }

  return { triggered: false };
}

module.exports = {
  evaluateHighVelocity
};

