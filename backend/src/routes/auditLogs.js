/**
 * ==============================================================================
 * Centralized Audit Logs Router (Feature 2 & Feature 4)
 * ==============================================================================
 * Exposes administrative inspection endpoints for system audit logs and personal
 * activity history for bank employees.
 *
 * Security:
 * - /my-activity: Strictly EMPLOYEE role clearance (Feature 4). Derives actor ID from session.
 * - / & /filters: Strictly ADMIN-only clearance via requireAuth and requireRole('ADMIN').
 * - Non-authorized roles rejected with HTTP 403 AUTH_002.
 * - Unauthenticated requests rejected with HTTP 401 AUTH_003.
 * - Read-only queries: Zero PUT, POST, PATCH, or DELETE endpoints exist.
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { listAuditLogs, getEmployeeActivityHistory } = require('../services/auditService');
const { query } = require('../config/db');

/**
 * Validate YYYY-MM-DD date string.
 * @param {string} str
 * @returns {boolean}
 */
function isValidDateString(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [year, month, day] = str.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * GET /api/audit-logs/my-activity
 * Employee-specific personal activity history endpoint (Feature 4).
 * Restricted strictly to EMPLOYEE role.
 * Derives actor identity strictly from req.user.userId (client-supplied actor IDs are ignored).
 */
router.get('/my-activity', requireAuth, requireRole('EMPLOYEE'), async (req, res, next) => {
  try {
    const { page, limit, category, actionType, result, startDate, endDate, search } = req.query;

    // Validate date filters if supplied
    if (startDate && !isValidDateString(startDate)) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid startDate parameter. Format must be YYYY-MM-DD.',
        error: { code: 'VAL_001', message: 'Invalid startDate parameter. Format must be YYYY-MM-DD.' }
      });
    }

    if (endDate && !isValidDateString(endDate)) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid endDate parameter. Format must be YYYY-MM-DD.',
        error: { code: 'VAL_001', message: 'Invalid endDate parameter. Format must be YYYY-MM-DD.' }
      });
    }

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'startDate cannot be after endDate.',
        error: { code: 'VAL_001', message: 'startDate cannot be after endDate.' }
      });
    }

    // Always use req.user.userId; client-supplied actorUserId in query or body is strictly ignored
    const resultData = await getEmployeeActivityHistory({
      employeeUserId: req.user.userId,
      page,
      limit,
      category,
      actionType,
      result,
      startDate,
      endDate,
      search
    });

    return res.status(200).json({
      success: true,
      data: resultData
    });
  } catch (error) {
    next(error);
  }
});

// Enforce Admin-only access across administrative audit log endpoints
router.use(requireAuth, requireRole('ADMIN'));

/**
 * GET /api/audit-logs
 * List and filter centralized audit logs with pagination (Admin).
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, actorUserId, actionType, targetEntityType, result, startDate, endDate, search } = req.query;

    // Validate date filters if supplied
    if (startDate && !isValidDateString(startDate)) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid startDate parameter. Format must be YYYY-MM-DD.',
        error: { code: 'VAL_001', message: 'Invalid startDate parameter. Format must be YYYY-MM-DD.' }
      });
    }

    if (endDate && !isValidDateString(endDate)) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid endDate parameter. Format must be YYYY-MM-DD.',
        error: { code: 'VAL_001', message: 'Invalid endDate parameter. Format must be YYYY-MM-DD.' }
      });
    }

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'startDate cannot be after endDate.',
        error: { code: 'VAL_001', message: 'startDate cannot be after endDate.' }
      });
    }

    const resultData = await listAuditLogs({
      page,
      limit,
      actorUserId,
      actionType,
      targetEntityType,
      result,
      startDate,
      endDate,
      search
    });

    return res.status(200).json({
      success: true,
      data: resultData
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/audit-logs/filters
 * Returns unique action types and target entity types for UI dropdowns.
 */
router.get('/filters', async (req, res, next) => {
  try {
    const [actionRows, targetRows] = await Promise.all([
      query('SELECT DISTINCT action_type AS actionType FROM audit_logs ORDER BY action_type ASC'),
      query('SELECT DISTINCT target_entity_type AS targetEntityType FROM audit_logs WHERE target_entity_type IS NOT NULL ORDER BY target_entity_type ASC')
    ]);

    return res.status(200).json({
      success: true,
      data: {
        actionTypes: actionRows.map(r => r.actionType),
        targetEntityTypes: targetRows.map(r => r.targetEntityType)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
