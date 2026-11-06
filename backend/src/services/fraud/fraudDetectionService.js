/**
 * ==============================================================================
 * Fraud Detection Engine - Orchestration Service
 * ==============================================================================
 * Primary entry point for evaluating completed banking transactions against
 * configurable rule sets, assigning risk scores, and generating assessments and alerts.
 *
 * Architecture & Scope:
 * - MySQL remains authoritative for banking data; this service NEVER modifies MySQL.
 * - MongoDB stores fraud rules, risk assessments, and fraud alerts.
 * - Entirely independent and callable programmatically.
 * - Idempotent evaluation: repeated calls for the same transactionId do not create
 *   duplicate records or overwrite previous results.
 * ==============================================================================
 */

const { validateTransactionInput } = require('./utils/validation');
const { getEnabledRules } = require('./fraudRuleRepository');
const { getRuleEvaluator } = require('./rules');
const {
  calculateRiskScore,
  classifyRiskLevel,
  determineDecision,
  RISK_LEVELS
} = require('./riskScoringService');
const {
  saveAssessment,
  saveAlert,
  getAssessmentByTransactionId,
  getAlertByTransactionId,
  deleteAssessment
} = require('./assessmentRepository');
const { fromStoredPaise } = require('./utils/monetary');
const { FraudEngineError, FraudValidationError, FraudConfigurationError } = require('./utils/errors');

/**
 * Evaluates a completed banking transaction against active MongoDB fraud rules.
 *
 * @param {object} rawTransaction - Transaction payload
 * @param {object} [context={}] - Historical context (velocity count, beneficiary history)
 * @param {object} [options={}]
 * @param {boolean} [options.checkExisting=true] - Return existing assessment if already evaluated
 * @param {boolean} [options.forceRefreshRules=false] - Bypass rule cache
 * @returns {Promise<{
 *   assessment: object,
 *   alert: object|null,
 *   triggeredRules: Array<object>,
 *   isExisting: boolean
 * }>}
 */
async function evaluateTransaction(rawTransaction, context = {}, options = {}) {
  // 1. Strict Input Validation
  const tx = validateTransactionInput(rawTransaction, context);
  const amountInRupees = fromStoredPaise(tx.amount);
  console.log(`[FraudPipeline] Evaluating tx #${tx.transactionId} (${tx.transactionType}): amount=₹${amountInRupees} (${tx.amount} paise), accountId=${tx.accountId}, customerId=${tx.customerId}`);

  // 2. Idempotency Check: Return existing assessment if previously recorded
  if (options.checkExisting !== false) {
    try {
      const existingAssessment = await getAssessmentByTransactionId(tx.transactionId);
      if (existingAssessment) {
        console.log(`[FraudPipeline] Found existing assessment for tx #${tx.transactionId}: riskScore=${existingAssessment.riskScore}, riskLevel=${existingAssessment.riskLevel} (idempotent reuse)`);
        let existingAlert = await getAlertByTransactionId(tx.transactionId);

        // Self-healing: if high/critical assessment was missing an alert due to prior partial failure, recover alert
        if (!existingAlert && (existingAssessment.riskLevel === RISK_LEVELS.HIGH || existingAssessment.riskLevel === RISK_LEVELS.CRITICAL)) {
          const reasons = (existingAssessment.triggeredRules || []).map(
            (r) => r.description || `${r.ruleCode} triggered (${r.points} points)`
          );
          try {
            existingAlert = await saveAlert({
              transactionId: existingAssessment.transactionId,
              customerId: existingAssessment.customerId,
              accountId: existingAssessment.accountId,
              riskScore: existingAssessment.riskScore,
              riskLevel: existingAssessment.riskLevel,
              reasons
            });
          } catch {
            // Document non-fatal alert recovery error
          }
        }

        return {
          assessment: existingAssessment,
          alert: existingAlert,
          triggeredRules: existingAssessment.triggeredRules || [],
          isExisting: true
        };
      }
    } catch (err) {
      if (err instanceof FraudEngineError) throw err;
      throw new FraudEngineError(`Error inspecting existing assessment: ${err.message}`, 'MONGO_READ_ERROR', err);
    }
  }

  // 3. Retrieve Enabled Rules from MongoDB
  let rules = [];
  try {
    rules = await getEnabledRules({ forceRefresh: Boolean(options.forceRefreshRules) });
    console.log(`[FraudPipeline] Loaded ${rules.length} active fraud rule(s): ${rules.map((r) => `${r.ruleCode}(weight:${r.weight})`).join(', ')}`);
  } catch (err) {
    if (err instanceof FraudConfigurationError || err instanceof FraudValidationError) {
      throw err;
    }
    throw new FraudEngineError(`Failed to load fraud rules from MongoDB: ${err.message}`, 'RULE_LOAD_ERROR', err);
  }

  // 4. Rule Evaluation Execution
  const triggeredRules = [];
  for (const rule of rules) {
    const evaluator = getRuleEvaluator(rule.ruleCode);
    if (!evaluator) {
      // Unrecognized or unmapped rule code; skip safely without failing pipeline
      continue;
    }

    try {
      const evalResult = await evaluator(tx, rule, context);
      const isTriggered = Boolean(evalResult && evalResult.triggered);
      const points = isTriggered ? (evalResult.points ?? rule.weight) : 0;
      console.log(`[FraudPipeline] Rule "${rule.ruleCode}": triggered=${isTriggered}, points=${points}${evalResult?.description ? ` (${evalResult.description})` : ''}`);

      if (isTriggered) {
        triggeredRules.push({
          ruleCode: rule.ruleCode,
          points,
          description: evalResult.description || ''
        });
      }
    } catch (evalErr) {
      throw new FraudEngineError(
        `Error executing fraud rule "${rule.ruleCode}": ${evalErr.message}`,
        'RULE_EXECUTION_ERROR',
        evalErr
      );
    }
  }

  // 5. Score Calculation, Classification, and Automated Decision
  const riskScore = calculateRiskScore(triggeredRules);
  const riskLevel = classifyRiskLevel(riskScore);
  const decision = determineDecision(riskLevel);
  console.log(`[FraudPipeline] Tx #${tx.transactionId} calculated riskScore=${riskScore}, riskLevel=${riskLevel}, decision=${decision}`);

  // 6. Persist Risk Assessment (idempotent)
  let assessment;
  try {
    assessment = await saveAssessment({
      transactionId: tx.transactionId,
      customerId: tx.customerId,
      accountId: tx.accountId,
      transactionType: tx.transactionType,
      amount: tx.amount,
      riskScore,
      riskLevel,
      triggeredRules,
      decision,
      assessedAt: new Date()
    });
    console.log(`[FraudPipeline] Assessment for tx #${tx.transactionId}: ${assessment.isExisting ? 'ALREADY_EXISTS (reused)' : 'INSERTED'}`);
  } catch (err) {
    if (err instanceof FraudEngineError) throw err;
    throw new FraudEngineError(`Assessment persistence failure: ${err.message}`, 'PERSISTENCE_ERROR', err);
  }

  // 7. Persist Fraud Alert if at least one rule triggered OR score is HIGH/CRITICAL (idempotent)
  let alert = null;
  const shouldGenerateAlert =
    (Array.isArray(triggeredRules) && triggeredRules.length > 0) ||
    riskLevel === RISK_LEVELS.HIGH ||
    riskLevel === RISK_LEVELS.CRITICAL;

  if (shouldGenerateAlert) {
    const reasons = triggeredRules.map(
      (r) => r.description || `${r.ruleCode} triggered (${r.points} points)`
    );

    try {
      alert = await saveAlert({
        transactionId: tx.transactionId,
        customerId: tx.customerId,
        accountId: tx.accountId,
        riskScore,
        riskLevel,
        reasons,
        triggeredRules
      });
      console.log(`[FraudPipeline] Alert for tx #${tx.transactionId}: ${alert?.isExisting ? 'ALREADY_EXISTS (reused)' : 'INSERTED'} (${riskLevel})`);
    } catch (err) {
      // Partial persistence rollback: If alert insertion fails on a newly created assessment,
      // rollback the orphan assessment so the system is not left in an inconsistent state.
      if (!assessment.isExisting) {
        try {
          await deleteAssessment(tx.transactionId);
        } catch {
          // Document rollback attempt
        }
      }
      if (err instanceof FraudEngineError) throw err;
      throw new FraudEngineError(`Fraud alert persistence failure: ${err.message}`, 'ALERT_PERSISTENCE_ERROR', err);
    }
  }

  return {
    assessment,
    alert,
    triggeredRules,
    isExisting: Boolean(assessment?.isExisting)
  };
}

module.exports = {
  evaluateTransaction
};

