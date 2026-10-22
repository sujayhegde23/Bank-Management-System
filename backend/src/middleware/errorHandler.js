/**
 * ==============================================================================
 * Central Error Handling Middleware
 * ==============================================================================
 * Implements Architecture Specification Section 10:
 * - Returns structured error envelope: { success: false, error: { code, message, referenceId } }
 * - Never leaks stack traces, SQL queries, table names, or credentials to clients.
 * - Defaults unexpected errors to SYS_001 (500).
 * ==============================================================================
 */

const crypto = require('crypto');

function errorHandler(err, req, res, next) {
  const referenceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);

  // Determine status code and standardized error code
  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || (statusCode === 500 ? 'SYS_001' : 'REQ_001');
  const safeMessage = err.safeMessage ||
    (statusCode === 500 ? 'Something went wrong. Please try again later.' : (err.message || 'Invalid request.'));

  // Log internal details on server only
  console.error(`[Error ${referenceId}] ${req.method} ${req.url} - ${errorCode} (${statusCode}):`, err.message);
  if (statusCode === 500 && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    errorCode: errorCode,
    message: safeMessage,
    error: {
      code: errorCode,
      message: safeMessage,
      referenceId: referenceId,
      details: err.details || []
    }
  });
}

module.exports = errorHandler;
