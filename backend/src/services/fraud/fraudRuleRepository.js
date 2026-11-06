/**
 * ==============================================================================
 * Fraud Detection Engine - Rule Repository
 * ==============================================================================
 * Retrieves and validates configurable fraud rules from the MongoDB `fraud_rules`
 * collection. MongoDB is the authoritative single source of truth for rule definitions.
 *
 * Configurable Rule Management & Validation:
 * - Reads threshold, weight, and config dynamically from MongoDB.
 * - Ignores disabled rules (`enabled: false`).
 * - Validates enabled rule configuration strictly. If an enabled rule is malformed,
 *   a FraudConfigurationError is thrown rather than silently ignoring the problem.
 * - Supports in-memory caching with a 30-second TTL and immediate invalidation
 *   via `clearRuleCache()`.
 * ==============================================================================
 */

const { getDb } = require('../../config/mongo');
const { FraudConfigurationError } = require('./utils/errors');

let cachedEnabledRules = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30000; // 30-second TTL

/**
 * Validates the structure and constraints of an enabled fraud rule.
 *
 * @param {object} rule - MongoDB fraud rule document
 * @throws {FraudConfigurationError} if any required property is malformed
 */
function validateRuleConfig(rule) {
  if (!rule || typeof rule !== 'object') {
    throw new FraudConfigurationError('Rule document must be an object');
  }

  // 1. Rule code
  if (!rule.ruleCode || typeof rule.ruleCode !== 'string' || !rule.ruleCode.trim()) {
    throw new FraudConfigurationError('Rule is missing a valid ruleCode string');
  }

  // 2. Enabled flag
  if (typeof rule.enabled !== 'boolean') {
    throw new FraudConfigurationError(
      `Rule "${rule.ruleCode}" has invalid "enabled" status: ${rule.enabled}. Must be a boolean.`
    );
  }

  // 3. Weight (0-100)
  if (
    typeof rule.weight !== 'number' ||
    Number.isNaN(rule.weight) ||
    rule.weight < 0 ||
    rule.weight > 100
  ) {
    throw new FraudConfigurationError(
      `Rule "${rule.ruleCode}" is enabled but malformed: weight must be a number between 0 and 100, received: ${rule.weight}`
    );
  }

  // 4. Threshold validation (if present)
  if (rule.threshold !== undefined && rule.threshold !== null) {
    const threshNum = Number(rule.threshold);
    if (Number.isNaN(threshNum) || threshNum < 0) {
      throw new FraudConfigurationError(
        `Rule "${rule.ruleCode}" has invalid non-numeric or negative threshold: ${rule.threshold}`
      );
    }
  }

  // 5. Rule-specific config validation
  if (rule.ruleCode === 'UNUSUAL_HOUR' && rule.config) {
    const { startHour, endHour } = rule.config;
    if (startHour !== undefined && (typeof startHour !== 'number' || startHour < 0 || startHour > 23)) {
      throw new FraudConfigurationError(
        `Rule "${rule.ruleCode}" has invalid startHour in config: ${startHour}`
      );
    }
    if (endHour !== undefined && (typeof endHour !== 'number' || endHour < 0 || endHour > 23)) {
      throw new FraudConfigurationError(
        `Rule "${rule.ruleCode}" has invalid endHour in config: ${endHour}`
      );
    }
  }

  return true;
}

/**
 * Retrieves all enabled fraud detection rules from MongoDB.
 *
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false] - Invalidate in-memory cache and fetch fresh
 * @returns {Promise<Array<object>>} - List of validated enabled rule documents
 */
async function getEnabledRules({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedEnabledRules && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedEnabledRules;
  }

  const db = getDb();
  const rules = await db
    .collection('fraud_rules')
    .find({ enabled: true })
    .toArray();

  // Validate every enabled rule strictly before making it available to the engine
  for (const rule of rules) {
    validateRuleConfig(rule);
  }

  cachedEnabledRules = rules;
  cacheTimestamp = now;
  return rules;
}

/**
 * Retrieves a single fraud rule document by ruleCode regardless of enabled status.
 *
 * @param {string} ruleCode
 * @returns {Promise<object|null>}
 */
async function getRuleByCode(ruleCode) {
  const db = getDb();
  return db.collection('fraud_rules').findOne({ ruleCode });
}

/**
 * Clears the in-memory rule cache.
 * Useful for automated tests or after rule updates in MongoDB.
 */
function clearRuleCache() {
  cachedEnabledRules = null;
  cacheTimestamp = 0;
}

module.exports = {
  getEnabledRules,
  getRuleByCode,
  validateRuleConfig,
  clearRuleCache
};

