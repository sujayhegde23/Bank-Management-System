/**
 * ==============================================================================
 * Account Domain Service
 * ==============================================================================
 * Implements business rules for Bank Account management:
 * - Cryptographically strong unique account number generation with collision retry (FR-08, NFR-16)
 * - Strict account eligibility and status verification for financial transactions (FR-11, ACC_001)
 * ==============================================================================
 */

const crypto = require('crypto');
const { query } = require('../config/db');

// Account type prefix mapping for human-readable banking identifiers
const ACCOUNT_TYPE_PREFIXES = {
  SAVINGS: 'SB',
  CURRENT: 'CA'
};

/**
 * Generate a unique account number using cryptographically secure random integers.
 * Enforces format: ACC-<TYPE>-<8 RANDOM DIGITS>, e.g. ACC-SB-58291047
 * Employs bounded retry loop to resolve potential collisions before database insertion.
 *
 * @param {'SAVINGS'|'CURRENT'} accountType - Account category
 * @param {import('mysql2/promise').Connection} [dbConn] - Optional active transaction connection
 * @param {number} [maxAttempts=5] - Maximum collision retry attempts
 * @returns {Promise<string>} Unique account number
 */
async function generateUniqueAccountNumber(accountType = 'SAVINGS', dbConn = null, maxAttempts = 5) {
  const typeKey = (accountType || 'SAVINGS').toUpperCase();
  const typePrefix = ACCOUNT_TYPE_PREFIXES[typeKey] || 'GEN';
  const queryExecutor = dbConn ? (sql, params) => dbConn.execute(sql, params).then(([r]) => r) : query;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Generate an 8-digit cryptographically strong random number (10000000 to 99999999)
    const randomSuffix = crypto.randomInt(10000000, 100000000);
    const candidateNumber = `ACC-${typePrefix}-${randomSuffix}`;

    // Verify candidate does not already exist in accounts table
    const existing = await queryExecutor(
      'SELECT account_id FROM accounts WHERE account_number = ? LIMIT 1',
      [candidateNumber]
    );

    if (!existing || existing.length === 0) {
      return candidateNumber;
    }
  }

  const error = new Error('Failed to generate a unique account number after multiple attempts. Please retry.');
  error.statusCode = 500;
  error.code = 'SYS_001';
  throw error;
}

/**
 * Verify account eligibility for transactions (FR-11).
 * Validates that the account exists and is in 'ACTIVE' status.
 * Rejects INACTIVE and FROZEN accounts with HTTP 409 and errorCode ACC_001.
 *
 * @param {number} accountId - Internal account ID
 * @param {import('mysql2/promise').Connection} [dbConn] - Optional active transaction connection
 * @returns {Promise<object>} The active account record
 */
async function verifyAccountEligibility(accountId, dbConn = null) {
  const queryExecutor = dbConn ? (sql, params) => dbConn.execute(sql, params).then(([r]) => r) : query;

  const rows = await queryExecutor(
    `SELECT account_id, account_number, customer_id, account_type, balance, status
     FROM accounts
     WHERE account_id = ?
     LIMIT 1`,
    [accountId]
  );

  if (!rows || rows.length === 0) {
    const error = new Error('Account not found');
    error.statusCode = 404;
    error.code = 'ACC_002';
    throw error;
  }

  const account = rows[0];

  if (account.status !== 'ACTIVE') {
    const error = new Error('Account is frozen or inactive');
    error.statusCode = 409;
    error.code = 'ACC_001';
    error.accountStatus = account.status;
    throw error;
  }

  return account;
}

module.exports = {
  generateUniqueAccountNumber,
  verifyAccountEligibility,
  ACCOUNT_TYPE_PREFIXES
};

