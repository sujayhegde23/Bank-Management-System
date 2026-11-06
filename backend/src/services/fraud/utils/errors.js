/**
 * ==============================================================================
 * Fraud Detection Engine - Error Classes
 * ==============================================================================
 */

class FraudEngineError extends Error {
  constructor(message, code = 'FRAUD_ENGINE_ERROR', details = null) {
    super(message);
    this.name = 'FraudEngineError';
    this.code = code;
    this.details = details;
  }
}

class FraudValidationError extends FraudEngineError {
  constructor(message, details = null) {
    super(message, 'FRAUD_VALIDATION_ERROR', details);
    this.name = 'FraudValidationError';
  }
}

class FraudConfigurationError extends FraudEngineError {
  constructor(message, details = null) {
    super(message, 'FRAUD_CONFIGURATION_ERROR', details);
    this.name = 'FraudConfigurationError';
  }
}

module.exports = {
  FraudEngineError,
  FraudValidationError,
  FraudConfigurationError
};

