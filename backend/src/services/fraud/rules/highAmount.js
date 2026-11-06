/**
 * ==============================================================================
 * Fraud Rule 1: HIGH_AMOUNT
 * ==============================================================================
 * Purpose: Detect unusually large transactions exceeding configured threshold.
 *
 * Comparison Logic:
 * - Strictly greater than: Triggers ONLY when amount > rule.threshold.
 * - Does not trigger when amount <= rule.threshold.
 * - Uses exact paise comparison to avoid floating-point inaccuracies.
 * ==============================================================================
 */

const { isAmountStrictlyGreaterThan, formatPaiseToRupees } = require('../utils/monetary');

/**
 * Evaluates the HIGH_AMOUNT rule against the transaction.
 *
 * @param {object} transaction - Validated transaction payload (amount in integer paise)
 * @param {object} rule - MongoDB fraud rule document (threshold in integer paise)
 * @returns {Promise<{ triggered: boolean, points?: number, description?: string }>}
 */
async function evaluateHighAmount(transaction, rule) {
  const isExceeded = isAmountStrictlyGreaterThan(transaction.amount, rule.threshold);

  if (isExceeded) {
    const formattedAmount = formatPaiseToRupees(transaction.amount);
    const formattedThreshold = formatPaiseToRupees(rule.threshold);

    return {
      triggered: true,
      points: rule.weight,
      description: `Transaction amount ${formattedAmount} strictly exceeds configured threshold ${formattedThreshold}`
    };
  }

  return { triggered: false };
}

module.exports = {
  evaluateHighAmount
};

