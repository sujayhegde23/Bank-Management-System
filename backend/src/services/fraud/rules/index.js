/**
 * ==============================================================================
 * Fraud Rules Registry
 * ==============================================================================
 * Maps configured MongoDB rule codes (and legacy aliases) to executable
 * detection evaluator functions.
 * ==============================================================================
 */

const { evaluateHighAmount } = require('./highAmount');
const { evaluateHighVelocity } = require('./highVelocity');
const { evaluateNewBeneficiary } = require('./newBeneficiary');
const { evaluateUnusualHour } = require('./unusualHour');

const RULE_EVALUATORS = {
  HIGH_AMOUNT: evaluateHighAmount,
  HIGH_VELOCITY: evaluateHighVelocity,
  RAPID_TRANSFERS: evaluateHighVelocity, // Alias for backward compatibility
  NEW_BENEFICIARY: evaluateNewBeneficiary,
  UNUSUAL_HOUR: evaluateUnusualHour,
  SUSPICIOUS_HOUR: evaluateUnusualHour // Alias for backward compatibility
};

/**
 * Retrieves the evaluator function for a given ruleCode.
 *
 * @param {string} ruleCode
 * @returns {Function|null}
 */
function getRuleEvaluator(ruleCode) {
  if (!ruleCode) return null;
  return RULE_EVALUATORS[ruleCode.trim().toUpperCase()] || null;
}

module.exports = {
  RULE_EVALUATORS,
  getRuleEvaluator
};

