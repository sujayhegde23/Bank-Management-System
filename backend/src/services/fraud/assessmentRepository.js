/**
 * ==============================================================================
 * Fraud Detection Engine - Assessment & Alert Repository
 * ==============================================================================
 * Persists risk assessments in `transaction_risk_assessments` and fraud alerts
 * in `fraud_alerts` using MongoDB.
 *
 * Idempotency & Concurrency Design:
 * - Uses the unique `transactionId` index on both collections.
 * - If an assessment or alert for a transactionId already exists, MongoDB rejects
 *   the duplicate with error code 11000.
 * - The repository catches code 11000 safely, loads the existing persisted document,
 *   and returns it marked with `isExisting: true`.
 * - No existing assessment is silently overwritten or updated.
 * - Alerts are generated for ANY transaction that triggers at least one enabled
 *   fraud detection rule (regardless of whether the score is LOW, MEDIUM, HIGH, or CRITICAL),
 *   as well as for any assessment classified as HIGH or CRITICAL.
 * - Transactions where NO rules trigger return `null` and do not touch `fraud_alerts`.
 * ==============================================================================
 */

const { getDb } = require('../../config/mongo');
const { FraudEngineError } = require('./utils/errors');
const { RISK_LEVELS } = require('./riskScoringService');

/**
 * Persists a transaction risk assessment in MongoDB.
 * Idempotent: returns existing assessment on duplicate transactionId.
 *
 * @param {object} assessmentData
 * @returns {Promise<object>}
 */
async function saveAssessment(assessmentData) {
  const db = getDb();
  if (!db) {
    throw new FraudEngineError('MongoDB is not connected; cannot persist risk assessment');
  }

  const collection = db.collection('transaction_risk_assessments');

  const doc = {
    transactionId: Number(assessmentData.transactionId),
    customerId: Number(assessmentData.customerId),
    accountId: Number(assessmentData.accountId),
    transactionType: assessmentData.transactionType,
    amount: Number(assessmentData.amount),
    riskScore: Number(assessmentData.riskScore),
    riskLevel: assessmentData.riskLevel,
    triggeredRules: (assessmentData.triggeredRules || []).map((r) => ({
      ruleCode: r.ruleCode,
      points: Number(r.points ?? 0),
      description: r.description || ''
    })),
    decision: assessmentData.decision,
    assessedAt: assessmentData.assessedAt instanceof Date ? assessmentData.assessedAt : new Date()
  };

  try {
    const result = await collection.insertOne(doc);
    return {
      _id: result.insertedId,
      ...doc,
      isExisting: false
    };
  } catch (err) {
    // Code 11000: Duplicate key error on unique transactionId index
    if (err.code === 11000 || String(err.message).includes('duplicate key')) {
      const existing = await collection.findOne({ transactionId: doc.transactionId });
      if (existing) {
        return {
          ...existing,
          isExisting: true
        };
      }
    }
    throw new FraudEngineError(`Failed to persist risk assessment: ${err.message}`, 'MONGO_PERSIST_ERROR', err);
  }
}

/**
 * Persists a fraud alert in MongoDB.
 * Business Rule: Every transaction that triggers at least one enabled fraud detection rule
 * must generate a fraud alert, regardless of its final risk classification.
 * Does NOT generate alerts for transactions where no rules triggered.
 * Idempotent: returns existing alert on duplicate transactionId.
 *
 * @param {object} alertData
 * @returns {Promise<object|null>} - Saved or existing alert document, or null if no alert is warranted
 */
async function saveAlert(alertData) {
  if (!alertData) return null;

  // Policy: Generate alert if at least one rule triggered OR risk level is HIGH/CRITICAL
  const hasTriggeredRules =
    (Array.isArray(alertData.reasons) && alertData.reasons.length > 0) ||
    (Array.isArray(alertData.triggeredRules) && alertData.triggeredRules.length > 0);
  const isHighOrCritical =
    alertData.riskLevel === RISK_LEVELS.HIGH || alertData.riskLevel === RISK_LEVELS.CRITICAL;

  if (!hasTriggeredRules && !isHighOrCritical) {
    return null;
  }

  const db = getDb();
  if (!db) {
    throw new FraudEngineError('MongoDB is not connected; cannot persist fraud alert');
  }

  const collection = db.collection('fraud_alerts');

  const alertDoc = {
    transactionId: Number(alertData.transactionId),
    customerId: Number(alertData.customerId),
    accountId: Number(alertData.accountId),
    riskScore: Number(alertData.riskScore),
    riskLevel: alertData.riskLevel,
    status: 'OPEN',
    reasons: Array.isArray(alertData.reasons) ? alertData.reasons : [],
    triggeredRules: Array.isArray(alertData.triggeredRules)
      ? alertData.triggeredRules.map((r) => ({
          ruleCode: r.ruleCode,
          points: Number(r.points ?? 0),
          description: r.description || ''
        }))
      : [],
    createdAt: alertData.createdAt instanceof Date ? alertData.createdAt : new Date(),
    updatedAt: alertData.updatedAt instanceof Date ? alertData.updatedAt : new Date()
  };

  try {
    const result = await collection.insertOne(alertDoc);
    return {
      _id: result.insertedId,
      ...alertDoc,
      isExisting: false
    };
  } catch (err) {
    // Code 11000: Duplicate key error on unique transactionId index
    if (err.code === 11000 || String(err.message).includes('duplicate key')) {
      const existing = await collection.findOne({ transactionId: alertDoc.transactionId });
      if (existing) {
        return {
          ...existing,
          isExisting: true
        };
      }
    }
    throw new FraudEngineError(`Failed to persist fraud alert: ${err.message}`, 'MONGO_ALERT_PERSIST_ERROR', err);
  }
}

/**
 * Retrieves a risk assessment document by transactionId.
 *
 * @param {number} transactionId
 * @returns {Promise<object|null>}
 */
async function getAssessmentByTransactionId(transactionId) {
  const db = getDb();
  if (!db) return null;
  return db.collection('transaction_risk_assessments').findOne({ transactionId: Number(transactionId) });
}

/**
 * Retrieves a fraud alert document by transactionId.
 *
 * @param {number} transactionId
 * @returns {Promise<object|null>}
 */
async function getAlertByTransactionId(transactionId) {
  const db = getDb();
  if (!db) return null;
  return db.collection('fraud_alerts').findOne({ transactionId: Number(transactionId) });
}

/**
 * Deletes an assessment by transactionId.
 * Used exclusively for transactional rollback if alert insertion fails on a new evaluation.
 *
 * @param {number} transactionId
 * @returns {Promise<boolean>}
 */
async function deleteAssessment(transactionId) {
  const db = getDb();
  if (!db) return false;
  const result = await db.collection('transaction_risk_assessments').deleteOne({
    transactionId: Number(transactionId)
  });
  return result.deletedCount > 0;
}

module.exports = {
  saveAssessment,
  saveAlert,
  getAssessmentByTransactionId,
  getAlertByTransactionId,
  deleteAssessment
};

