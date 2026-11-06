/**
 * ==============================================================================
 * Fraud Detection Engine - Public Module Export
 * ==============================================================================
 */

const { evaluateTransaction } = require('./fraudDetectionService');
const {
  calculateRiskScore,
  classifyRiskLevel,
  determineDecision,
  RISK_LEVELS,
  DECISIONS,
  RISK_BOUNDARIES
} = require('./riskScoringService');
const {
  getEnabledRules,
  getRuleByCode,
  validateRuleConfig,
  clearRuleCache
} = require('./fraudRuleRepository');
const {
  saveAssessment,
  saveAlert,
  getAssessmentByTransactionId,
  getAlertByTransactionId,
  deleteAssessment
} = require('./assessmentRepository');
const {
  FraudEngineError,
  FraudValidationError,
  FraudConfigurationError
} = require('./utils/errors');
const {
  toPaise,
  toStoredPaise,
  isAmountStrictlyGreaterThan,
  paiseToRupees,
  formatPaiseToRupees,
  toSafeId,
  MAX_SAFE_BIGINT
} = require('./utils/monetary');
const { validateTransactionInput } = require('./utils/validation');

// Phase 3 Transactional Outbox & Integration
const {
  recordOutboxEvent,
  claimEvents,
  renewEventLease,
  releaseClaimedEvents,
  markEventCompleted,
  markEventFailed,
  getOutboxEventByTransactionId,
  getOutboxMetrics,
  sanitizeErrorMessage
} = require('./outboxRepository');
const { buildTransactionContext } = require('./transactionContextProvider');
const {
  FraudOutboxWorker,
  fraudOutboxWorker,
  BACKOFF_SCHEDULE_MS
} = require('./fraudOutboxWorker');

// Phase 4: Fraud Monitoring Dashboard
const {
  FraudDashboardError,
  getDashboardStats,
  listAlerts,
  getAlertDetails,
  createInvestigation,
  listInvestigations,
  getInvestigationDetails,
  updateInvestigation,
  listFraudRules,
  updateFraudRule
} = require('./fraudDashboardService');

module.exports = {
  // Primary Orchestrator
  evaluateTransaction,

  // Risk Scoring Service
  calculateRiskScore,
  classifyRiskLevel,
  determineDecision,
  RISK_LEVELS,
  DECISIONS,
  RISK_BOUNDARIES,

  // Rule Repository
  getEnabledRules,
  getRuleByCode,
  validateRuleConfig,
  clearRuleCache,

  // Assessment Repository
  saveAssessment,
  saveAlert,
  getAssessmentByTransactionId,
  getAlertByTransactionId,
  deleteAssessment,

  // Precision & Validation Utilities
  toPaise,
  toStoredPaise,
  isAmountStrictlyGreaterThan,
  paiseToRupees,
  formatPaiseToRupees,
  toSafeId,
  MAX_SAFE_BIGINT,
  validateTransactionInput,

  // Phase 3: Outbox & Asynchronous Integration
  recordOutboxEvent,
  claimEvents,
  renewEventLease,
  releaseClaimedEvents,
  markEventCompleted,
  markEventFailed,
  getOutboxEventByTransactionId,
  getOutboxMetrics,
  sanitizeErrorMessage,
  buildTransactionContext,
  FraudOutboxWorker,
  fraudOutboxWorker,
  BACKOFF_SCHEDULE_MS,

  // Phase 4: Fraud Monitoring Dashboard
  FraudDashboardError,
  getDashboardStats,
  listAlerts,
  getAlertDetails,
  createInvestigation,
  listInvestigations,
  getInvestigationDetails,
  updateInvestigation,
  listFraudRules,
  updateFraudRule,

  // Error Classes
  FraudEngineError,
  FraudValidationError,
  FraudConfigurationError
};
