/**
 * ==============================================================================
 * Fraud Detection Engine - Risk Scoring & Classification Service
 * ==============================================================================
 * Calculates aggregate risk scores, assigns risk level categories, and determines
 * initial fraud assessment decisions.
 *
 * Scoring Formula:
 *   riskScore = min(100, sum(triggeredRuleWeights))
 *
 * Classification Boundaries:
 *   - LOW:      0 – 29   -> Decision: APPROVED
 *   - MEDIUM:  30 – 59   -> Decision: REVIEW_REQUIRED
 *   - HIGH:    60 – 79   -> Decision: FLAGGED
 *   - CRITICAL:80 – 100  -> Decision: FLAGGED
 * ==============================================================================
 */

const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

const DECISIONS = {
  APPROVED: 'APPROVED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  FLAGGED: 'FLAGGED'
};

const RISK_BOUNDARIES = {
  LOW_MAX: 29,
  MEDIUM_MAX: 59,
  HIGH_MAX: 79,
  CRITICAL_MAX: 100
};

/**
 * Calculates aggregate risk score from triggered rules, capping at 100.
 *
 * @param {Array<{ points: number }>} triggeredRules
 * @returns {number} - Integer risk score between 0 and 100
 */
function calculateRiskScore(triggeredRules = []) {
  if (!Array.isArray(triggeredRules) || triggeredRules.length === 0) {
    return 0;
  }

  const rawSum = triggeredRules.reduce((total, rule) => {
    const points = Number(rule.points ?? 0);
    return total + (Number.isFinite(points) && points > 0 ? points : 0);
  }, 0);

  return Math.min(100, Math.max(0, Math.round(rawSum)));
}

/**
 * Classifies an integer risk score into categorical risk levels.
 *
 * @param {number} score - Risk score (0 - 100)
 * @returns {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'}
 */
function classifyRiskLevel(score) {
  const safeScore = Math.min(100, Math.max(0, Math.round(Number(score) || 0)));

  if (safeScore <= RISK_BOUNDARIES.LOW_MAX) {
    return RISK_LEVELS.LOW;
  }
  if (safeScore <= RISK_BOUNDARIES.MEDIUM_MAX) {
    return RISK_LEVELS.MEDIUM;
  }
  if (safeScore <= RISK_BOUNDARIES.HIGH_MAX) {
    return RISK_LEVELS.HIGH;
  }
  return RISK_LEVELS.CRITICAL;
}

/**
 * Determines the automated fraud policy decision based on the risk level.
 *
 * @param {'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'} riskLevel
 * @returns {'APPROVED'|'REVIEW_REQUIRED'|'FLAGGED'}
 */
function determineDecision(riskLevel) {
  switch (riskLevel) {
    case RISK_LEVELS.LOW:
      return DECISIONS.APPROVED;
    case RISK_LEVELS.MEDIUM:
      return DECISIONS.REVIEW_REQUIRED;
    case RISK_LEVELS.HIGH:
    case RISK_LEVELS.CRITICAL:
      return DECISIONS.FLAGGED;
    default:
      return DECISIONS.REVIEW_REQUIRED;
  }
}

module.exports = {
  calculateRiskScore,
  classifyRiskLevel,
  determineDecision,
  RISK_LEVELS,
  DECISIONS,
  RISK_BOUNDARIES
};

