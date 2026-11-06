/**
 * ==============================================================================
 * Fraud Monitoring Dashboard Routes (Phase 4)
 * ==============================================================================
 * Provides endpoints for fraud monitoring, alert auditing, investigation
 * lifecycle management, and rule configuration for Banking Staff and Administrators.
 *
 * RBAC Permissions Matrix:
 * - EMPLOYEE: View stats, alerts, details, investigations, rules. Create & update investigations.
 * - ADMIN: All employee operations + Modify fraud rules.
 * - CUSTOMER: Denied access (403 AUTH_002) across all endpoints.
 * - UNAUTHENTICATED: Denied access (401 AUTH_003).
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getDashboardStats,
  listAlerts,
  getAlertDetails,
  createInvestigation,
  listInvestigations,
  getInvestigationDetails,
  updateInvestigation,
  listFraudRules,
  updateFraudRule,
  FraudDashboardError
} = require('../services/fraud');

/**
 * Common error handler for fraud dashboard route endpoints.
 */
function handleFraudRouteError(err, res, defaultCode = 'FRAUD_ERROR') {
  if (err instanceof FraudDashboardError) {
    return res.status(err.status || 400).json({
      success: false,
      errorCode: err.code,
      message: err.message,
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  // Handle MongoDB or connection errors gracefully
  const isDbError = err.name === 'MongoError' || err.name === 'MongoServerSelectionError' || String(err.message).includes('Mongo');
  const status = isDbError ? 503 : 500;
  const code = isDbError ? 'FRAUD_DB_UNAVAILABLE' : defaultCode;
  const message = isDbError ? 'Fraud detection database is currently unavailable' : err.message || 'An unexpected error occurred';

  console.error(`Fraud Route Error [${code}]:`, err.message);

  return res.status(status).json({
    success: false,
    errorCode: code,
    message,
    error: {
      code,
      message
    }
  });
}

// ------------------------------------------------------------------------------
// A. Fraud Overview Statistics
// ------------------------------------------------------------------------------
/**
 * GET /api/fraud/dashboard/stats
 * Access: EMPLOYEE, ADMIN
 */
router.get(
  '/dashboard/stats',
  requireAuth,
  requireRole('EMPLOYEE', 'ADMIN'),
  async (req, res) => {
    try {
      const stats = await getDashboardStats();
      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (err) {
      return handleFraudRouteError(err, res, 'STATS_FETCH_FAILED');
    }
  }
);

// ------------------------------------------------------------------------------
// B. List Fraud Alerts
// ------------------------------------------------------------------------------
/**
 * GET /api/fraud/alerts
 * Access: EMPLOYEE, ADMIN
 */
router.get(
  '/alerts',
  requireAuth,
  requireRole('EMPLOYEE', 'ADMIN'),
  async (req, res) => {
    try {
      const {
        page,
        limit,
        riskLevel,
        status,
        startDate,
        endDate,
        transactionId,
        sortField,
        sortOrder
      } = req.query;

      const result = await listAlerts({
        page,
        limit,
        riskLevel,
        status,
        startDate,
        endDate,
        transactionId,
        sortField,
        sortOrder
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      return handleFraudRouteError(err, res, 'ALERTS_FETCH_FAILED');
    }
  }
);

// ------------------------------------------------------------------------------
// C. Alert Details
// ------------------------------------------------------------------------------
/**
 * GET /api/fraud/alerts/:id
 * Access: EMPLOYEE, ADMIN
 */
router.get(
  '/alerts/:id',
  requireAuth,
  requireRole('EMPLOYEE', 'ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const details = await getAlertDetails(id);

      return res.status(200).json({
        success: true,
        data: details
      });
    } catch (err) {
      return handleFraudRouteError(err, res, 'ALERT_DETAILS_FAILED');
    }
  }
);

// ------------------------------------------------------------------------------
// D. Investigation Management
// ------------------------------------------------------------------------------
/**
 * POST /api/fraud/alerts/:id/investigations
 * Create an investigation for an alert.
 * Access: EMPLOYEE, ADMIN
 */
router.post(
  '/alerts/:id/investigations',
  requireAuth,
  requireRole('EMPLOYEE', 'ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { notes, assignedEmployeeId } = req.body || {};

      const investigation = await createInvestigation({
        alertId: id,
        notes,
        assignedEmployeeId,
        user: req.user
      });

      const statusCode = investigation.isExisting ? 200 : 201;
      return res.status(statusCode).json({
        success: true,
        message: investigation.isExisting
          ? 'Existing active investigation retrieved'
          : 'Investigation case opened successfully',
        data: investigation
      });
    } catch (err) {
      return handleFraudRouteError(err, res, 'INVESTIGATION_CREATE_FAILED');
    }
  }
);

/**
 * GET /api/fraud/investigations
 * List investigations with pagination and filters.
 * Access: EMPLOYEE, ADMIN
 */
router.get(
  '/investigations',
  requireAuth,
  requireRole('EMPLOYEE', 'ADMIN'),
  async (req, res) => {
    try {
      const {
        page,
        limit,
        status,
        assignedEmployeeId,
        startDate,
        endDate,
        sortField,
        sortOrder
      } = req.query;

      const result = await listInvestigations({
        page,
        limit,
        status,
        assignedEmployeeId,
        startDate,
        endDate,
        sortField,
        sortOrder
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      return handleFraudRouteError(err, res, 'INVESTIGATIONS_FETCH_FAILED');
    }
  }
);

/**
 * GET /api/fraud/investigations/:id
 * Get detailed investigation record.
 * Access: EMPLOYEE, ADMIN
 */
router.get(
  '/investigations/:id',
  requireAuth,
  requireRole('EMPLOYEE', 'ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const details = await getInvestigationDetails(id);

      return res.status(200).json({
        success: true,
        data: details
      });
    } catch (err) {
      return handleFraudRouteError(err, res, 'INVESTIGATION_DETAILS_FAILED');
    }
  }
);

/**
 * PATCH /api/fraud/investigations/:id
 * Update investigation status, notes, assignment, or resolution.
 * Access: EMPLOYEE, ADMIN
 */
router.patch(
  '/investigations/:id',
  requireAuth,
  requireRole('EMPLOYEE', 'ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, assignedEmployeeId, note, resolution } = req.body || {};

      const updated = await updateInvestigation(
        id,
        { status, assignedEmployeeId, note, resolution },
        req.user
      );

      return res.status(200).json({
        success: true,
        message: 'Investigation updated successfully',
        data: updated
      });
    } catch (err) {
      return handleFraudRouteError(err, res, 'INVESTIGATION_UPDATE_FAILED');
    }
  }
);

// ------------------------------------------------------------------------------
// E. Fraud Rule Management
// ------------------------------------------------------------------------------
/**
 * GET /api/fraud/rules
 * View configured fraud rules.
 * Access: EMPLOYEE, ADMIN
 */
router.get(
  '/rules',
  requireAuth,
  requireRole('EMPLOYEE', 'ADMIN'),
  async (req, res) => {
    try {
      const rules = await listFraudRules();
      return res.status(200).json({
        success: true,
        data: {
          rules
        }
      });
    } catch (err) {
      return handleFraudRouteError(err, res, 'RULES_FETCH_FAILED');
    }
  }
);

/**
 * PATCH /api/fraud/rules/:id
 * Modify a fraud rule (enable/disable, threshold, weight, config).
 * Access: ADMIN ONLY
 */
router.patch(
  '/rules/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body || {};

      const updatedRule = await updateFraudRule(id, updateData);

      return res.status(200).json({
        success: true,
        message: `Fraud rule ${updatedRule.ruleCode} updated successfully`,
        data: {
          rule: updatedRule
        }
      });
    } catch (err) {
      return handleFraudRouteError(err, res, 'RULE_UPDATE_FAILED');
    }
  }
);

module.exports = router;

