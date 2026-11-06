/**
 * ==============================================================================
 * Fraud Detection Engine - Monetary & Identifier Precision Utilities
 * ==============================================================================
 * Guarantees exact monetary precision and safe identifier validation:
 * 1. Monetary values are strictly calculated and stored in integer paise
 *    (1 INR = 100 paise) across MongoDB collections.
 * 2. MySQL DECIMAL(15,2) inputs are converted to paise via exact string splitting
 *    and BigInt arithmetic, eliminating IEEE 754 floating-point inaccuracies.
 * 3. MySQL BIGINT identifiers are inspected via BigInt parsing to ensure values
 *    exceeding Number.MAX_SAFE_INTEGER (2^53 - 1) are strictly rejected rather
 *    than silently truncated.
 * ==============================================================================
 */

const { FraudValidationError } = require('./errors');

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Converts a monetary value (Rupees from MySQL DECIMAL) into integer paise.
 * Uses exact string parsing to eliminate IEEE 754 floating-point rounding errors
 * (e.g. preventing issues like 19.99 * 100 becoming 1998.9999999999998).
 *
 * @param {number|string|bigint} val - Amount in rupees (e.g. "19.99", "50000.00", 75000.50)
 * @returns {bigint|null|NaN} - Integer paise as BigInt, null if nullish, NaN if invalid
 */
function toPaise(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'bigint') return val;

  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return NaN;
  }

  const str = String(val).trim();
  if (!str) return NaN;

  // Validate format: optional sign, digits, optional decimal point with digits
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    return NaN;
  }

  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;
  const [wholePart, decimalPart = ''] = cleanStr.split('.');

  // Normalize decimal part to exactly 2 digits
  let fractionDigits = decimalPart.slice(0, 2).padEnd(2, '0');
  let whole = BigInt(wholePart);
  let fraction = BigInt(fractionDigits);

  // If there is a 3rd decimal digit >= 5, round half-up
  if (decimalPart.length > 2 && parseInt(decimalPart[2], 10) >= 5) {
    fraction += 1n;
    if (fraction === 100n) {
      fraction = 0n;
      whole += 1n;
    }
  }

  const paise = whole * 100n + fraction;
  return isNegative ? -paise : paise;
}

/**
 * Validates and converts an amount into a safe integer number of paise
 * for storage in MongoDB `transaction_risk_assessments` and `fraud_rules`.
 *
 * Unit: Integer Paise (1 Rupee = 100 Paise).
 *
 * @param {number|string|bigint} val - Monetary value in rupees
 * @returns {number} - Stored integer paise
 */
function toStoredPaise(val) {
  const paise = toPaise(val);
  if (paise === null || Number.isNaN(paise)) {
    throw new FraudValidationError(`Invalid monetary amount: "${val}"`);
  }
  if (paise <= 0n) {
    throw new FraudValidationError(`Transaction amount must be strictly positive: "${val}"`);
  }
  if (paise > MAX_SAFE_BIGINT) {
    throw new FraudValidationError(
      `Monetary amount exceeds JavaScript Number.MAX_SAFE_INTEGER paise: "${val}". Rejecting to prevent precision loss.`
    );
  }
  return Number(paise);
}

/**
 * Compares two monetary amounts strictly in integer paise.
 * Returns true if amount strictly exceeds threshold (amount > threshold).
 *
 * @param {number|string|bigint} amount - Amount in paise (or rupees convertible to paise)
 * @param {number|string|bigint} threshold - Configured threshold in paise
 * @returns {boolean}
 */
function isAmountStrictlyGreaterThan(amount, threshold) {
  if (amount === null || amount === undefined || threshold === null || threshold === undefined) {
    return false;
  }

  // Parse amount in paise
  let amtPaise;
  if (typeof amount === 'bigint') {
    amtPaise = amount;
  } else if (typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 1000) {
    // If already in paise (e.g. from validated tx)
    amtPaise = BigInt(amount);
  } else {
    amtPaise = toPaise(amount);
  }

  // Parse threshold in paise
  let threshPaise;
  if (typeof threshold === 'bigint') {
    threshPaise = threshold;
  } else if (typeof threshold === 'number' && Number.isSafeInteger(threshold)) {
    // If threshold stored in integer paise in MongoDB (e.g. 5000000)
    threshPaise = BigInt(threshold);
  } else {
    threshPaise = toPaise(threshold);
  }

  if (amtPaise === null || threshPaise === null || Number.isNaN(amtPaise) || Number.isNaN(threshPaise)) {
    return false;
  }

  return amtPaise > threshPaise;
}

/**
 * Formats an integer paise value back into INR rupees decimal string (e.g. 1999 -> "19.99", 5000000 -> "50000.00").
 * Avoids floating-point math by performing exact integer division.
 *
 * @param {number|bigint} paise
 * @returns {string}
 */
function paiseToRupees(paise) {
  if (paise === null || paise === undefined) return '';
  const p = BigInt(paise);
  const isNeg = p < 0n;
  const abs = isNeg ? -p : p;
  const whole = abs / 100n;
  const fraction = abs % 100n;
  const fractionStr = fraction.toString().padStart(2, '0');
  const res = `${whole.toString()}.${fractionStr}`;
  return isNeg ? `-${res}` : res;
}

/**
 * Formats an integer paise value into standard Indian locale currency string (e.g. 5000000 -> "₹50,000.00").
 *
 * @param {number|bigint} paise
 * @returns {string}
 */
function formatPaiseToRupees(paise) {
  const r = paiseToRupees(paise);
  if (!r) return '';
  const num = Number(r);
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Validates and converts MySQL BIGINT identifiers (e.g. transactionId, customerId, accountId).
 * Protects against silent precision loss by validating against Number.MAX_SAFE_INTEGER
 * before performing any conversion.
 *
 * @param {number|string|bigint} id - MySQL ID value
 * @param {string} fieldName - Descriptive field name
 * @returns {number} - Validated safe integer identifier
 */
function toSafeId(id, fieldName = 'id') {
  if (id === null || id === undefined || id === '') {
    throw new FraudValidationError(`Missing required identifier: ${fieldName}`);
  }

  if (typeof id === 'boolean' || (typeof id === 'object' && typeof id !== 'bigint')) {
    throw new FraudValidationError(`Invalid ${fieldName}: must be a numeric integer`);
  }

  const str = String(id).trim();
  if (!/^-?\d+$/.test(str)) {
    throw new FraudValidationError(
      `Invalid ${fieldName}: "${id}". Must be an integer identifier without decimals.`
    );
  }

  let big;
  try {
    big = BigInt(str);
  } catch {
    throw new FraudValidationError(`Invalid ${fieldName}: "${id}". Cannot parse as integer.`);
  }

  if (big <= 0n) {
    throw new FraudValidationError(
      `Invalid ${fieldName}: "${id}". Must be a strictly positive integer greater than zero.`
    );
  }

  if (big > MAX_SAFE_BIGINT) {
    throw new FraudValidationError(
      `Unsafe identifier for ${fieldName}: "${id}". Value exceeds JavaScript Number.MAX_SAFE_INTEGER (${Number.MAX_SAFE_INTEGER}). Rejecting to prevent precision loss.`
    );
  }

  return Number(big);
}

module.exports = {
  toPaise,
  toStoredPaise,
  isAmountStrictlyGreaterThan,
  paiseToRupees,
  fromStoredPaise: paiseToRupees,
  formatPaiseToRupees,
  toSafeId,
  MAX_SAFE_BIGINT
};
