/**
 * ==============================================================================
 * Centralized Audit Logging Service (Feature 2 & Feature 4)
 * ==============================================================================
 * Provides immutable audit trail recording and search querying across all banking
 * operations, employee lifecycle actions, customer updates, and administrative events.
 *
 * Core Guarantees:
 * - Server-side actor derivation (never trusts client-supplied actor ID).
 * - Sensitive credential stripping (passwords, hashes, tokens never stored).
 * - Preservation of historical records across user deactivations (ON DELETE SET NULL).
 * - Isolation from financial ledger (audit_logs is separate from bank_transactions).
 * ==============================================================================
 */

const { query } = require('../config/db');

/**
 * Strips sensitive keys (passwords, hashes, tokens, session IDs) from metadata objects.
 * @param {object|null} meta
 * @returns {object|null}
 */
function sanitizeMetadata(meta) {
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  const clean = Array.isArray(meta) ? [] : {};
  const sensitiveRegex = /password|hash|token|secret|session|cookie/i;

  for (const [key, val] of Object.entries(meta)) {
    if (sensitiveRegex.test(key)) {
      continue; // Omit completely
    }
    if (val && typeof val === 'object') {
      clean[key] = sanitizeMetadata(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Record a new immutable audit log event.
 * @param {object} params
 * @param {number|null} [params.actorUserId] - User ID of authenticated actor (from session)
 * @param {string} params.actionType - Categorical action type (e.g. 'EMPLOYEE_CREATED', 'DEPOSIT_COMPLETED')
 * @param {string|null} [params.targetEntityType] - Target domain entity ('EMPLOYEE', 'CUSTOMER', 'ACCOUNT', 'TRANSACTION', 'USER')
 * @param {string|number|null} [params.targetEntityId] - Primary identifier of target entity
 * @param {string} params.description - Human-readable summary of the action
 * @param {'SUCCESS'|'FAILURE'} [params.result='SUCCESS'] - Operation outcome
 * @param {object|null} [params.metadata] - Optional sanitized structured context
 * @param {object|null} [connection] - Optional active transaction connection
 * @returns {Promise<number|null>} Inserted audit_id or null
 */
async function recordAuditEvent(params, connection = null) {
  const {
    actorUserId = null,
    actionType,
    targetEntityType = null,
    targetEntityId = null,
    description,
    result = 'SUCCESS',
    metadata = null
  } = params || {};

  if (!actionType || !description) {
    console.warn('recordAuditEvent: missing actionType or description');
    return null;
  }

  const cleanMeta = sanitizeMetadata(metadata);
  const metaJson = cleanMeta ? JSON.stringify(cleanMeta) : null;
  const targetIdStr = targetEntityId !== null && targetEntityId !== undefined ? String(targetEntityId) : null;
  const safeResult = result === 'FAILURE' ? 'FAILURE' : 'SUCCESS';

  const sql = `
    INSERT INTO audit_logs (
      actor_user_id, action_type, target_entity_type, target_entity_id, description, result, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    actorUserId || null,
    actionType,
    targetEntityType || null,
    targetIdStr,
    description.slice(0, 500),
    safeResult,
    metaJson
  ];

  try {
    if (connection && typeof connection.execute === 'function') {
      const [res] = await connection.execute(sql, values);
      return res.insertId;
    } else {
      const res = await query(sql, values);
      return res.insertId;
    }
  } catch (err) {
    console.error('Failed to record audit log event:', err.message);
    return null;
  }
}

/**
 * List and filter audit logs for Administrator inspection.
 * @param {object} [filters]
 * @returns {Promise<{ items: Array, pagination: object }>}
 */
async function listAuditLogs(filters = {}) {
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const whereClauses = [];
  const params = [];

  if (filters.actorUserId) {
    const actorId = parseInt(filters.actorUserId, 10);
    if (!isNaN(actorId)) {
      whereClauses.push('a.actor_user_id = ?');
      params.push(actorId);
    }
  }

  if (filters.actionType) {
    whereClauses.push('a.action_type = ?');
    params.push(filters.actionType.trim());
  }

  if (filters.targetEntityType) {
    whereClauses.push('a.target_entity_type = ?');
    params.push(filters.targetEntityType.trim().toUpperCase());
  }

  if (filters.result) {
    const r = filters.result.trim().toUpperCase();
    if (r === 'SUCCESS' || r === 'FAILURE') {
      whereClauses.push('a.result = ?');
      params.push(r);
    }
  }

  if (filters.startDate) {
    whereClauses.push('a.created_at >= ?');
    params.push(`${filters.startDate} 00:00:00`);
  }

  if (filters.endDate) {
    whereClauses.push('a.created_at <= ?');
    params.push(`${filters.endDate} 23:59:59`);
  }

  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    whereClauses.push('(a.description LIKE ? OR a.action_type LIKE ? OR a.target_entity_id LIKE ? OR u.username LIKE ?)');
    params.push(term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 1. Total count query
  const countSql = `
    SELECT COUNT(*) AS total
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_user_id = u.user_id
    ${whereSql}
  `;
  const countRows = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);

  // 2. Paginated rows query
  const listSql = `
    SELECT 
      a.audit_id AS auditId,
      a.actor_user_id AS actorUserId,
      u.username AS actorUsername,
      u.role AS actorRole,
      COALESCE(emp.full_name, cust.full_name, u.username) AS actorName,
      a.action_type AS actionType,
      a.target_entity_type AS targetEntityType,
      a.target_entity_id AS targetEntityId,
      a.description,
      a.result,
      a.metadata,
      a.created_at AS createdAt
    FROM audit_logs a
    LEFT JOIN users u ON a.actor_user_id = u.user_id
    LEFT JOIN employees emp ON u.user_id = emp.user_id
    LEFT JOIN customers cust ON u.user_id = cust.user_id
    ${whereSql}
    ORDER BY a.created_at DESC, a.audit_id DESC
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, limit, offset];
  const rows = await query(listSql, queryParams);

  const items = rows.map(r => ({
    auditId: r.auditId,
    actor: {
      userId: r.actorUserId,
      username: r.actorUsername || 'System/Anonymous',
      role: r.actorRole || 'SYSTEM',
      name: r.actorName || r.actorUsername || 'System'
    },
    actionType: r.actionType,
    targetEntityType: r.targetEntityType,
    targetEntityId: r.targetEntityId,
    description: r.description,
    result: r.result,
    metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
    createdAt: r.createdAt
  }));

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

/**
 * Retrieve personal activity history for an authenticated employee (Feature 4).
 * Strictly scopes all database queries to actor_user_id = employeeUserId.
 * Never exposes other staff members' activities.
 *
 * @param {object} params
 * @param {number} params.employeeUserId - Authenticated employee's user_id
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.category='ALL'] - 'ALL' | 'ACCOUNT' | 'CUSTOMER' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER'
 * @param {string} [params.actionType] - Specific action type
 * @param {string} [params.result] - 'SUCCESS' | 'FAILURE'
 * @param {string} [params.startDate] - 'YYYY-MM-DD'
 * @param {string} [params.endDate] - 'YYYY-MM-DD'
 * @param {string} [params.search] - Safe keyword search across own descriptions and targets
 * @returns {Promise<{ items: Array, summary: object, pagination: object }>}
 */
async function getEmployeeActivityHistory({
  employeeUserId,
  page = 1,
  limit = 20,
  category = 'ALL',
  actionType,
  result,
  startDate,
  endDate,
  search
}) {
  const actorId = parseInt(employeeUserId, 10);
  if (!actorId || isNaN(actorId)) {
    throw new Error('Valid employee user ID is required');
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const whereClauses = ['a.actor_user_id = ?'];
  const params = [actorId];

  // Specific Action Type or Category
  if (actionType && actionType.trim()) {
    whereClauses.push('a.action_type = ?');
    params.push(actionType.trim());
  } else if (category && category.trim().toUpperCase() !== 'ALL') {
    const cat = category.trim().toUpperCase();
    if (cat === 'ACCOUNT') {
      whereClauses.push("(a.target_entity_type = 'ACCOUNT' OR a.action_type LIKE 'ACCOUNT_%')");
    } else if (cat === 'CUSTOMER') {
      whereClauses.push("(a.target_entity_type = 'CUSTOMER' OR a.action_type LIKE 'CUSTOMER_%')");
    } else if (cat === 'DEPOSIT') {
      whereClauses.push("a.action_type IN ('DEPOSIT_COMPLETED', 'DEPOSIT_FAILED')");
    } else if (cat === 'WITHDRAWAL') {
      whereClauses.push("a.action_type IN ('WITHDRAWAL_COMPLETED', 'WITHDRAWAL_FAILED')");
    } else if (cat === 'TRANSFER') {
      whereClauses.push("a.action_type IN ('TRANSFER_COMPLETED', 'TRANSFER_FAILED')");
    }
  }

  // Operation result filter
  if (result) {
    const r = result.trim().toUpperCase();
    if (r === 'SUCCESS' || r === 'FAILURE') {
      whereClauses.push('a.result = ?');
      params.push(r);
    }
  }

  // Date range filters
  if (startDate) {
    whereClauses.push('a.created_at >= ?');
    params.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    whereClauses.push('a.created_at <= ?');
    params.push(`${endDate} 23:59:59`);
  }

  // Safe keyword search across own operations
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    whereClauses.push('(a.description LIKE ? OR a.action_type LIKE ? OR a.target_entity_id LIKE ?)');
    params.push(term, term, term);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  // Summary counts for this specific employee across all time
  const summarySql = `
    SELECT
      COUNT(*) AS totalCount,
      SUM(CASE WHEN a.result = 'SUCCESS' THEN 1 ELSE 0 END) AS successCount,
      SUM(CASE WHEN a.result = 'FAILURE' THEN 1 ELSE 0 END) AS failureCount
    FROM audit_logs a
    WHERE a.actor_user_id = ?
  `;
  const summaryRows = await query(summarySql, [actorId]);
  const totalOperations = Number(summaryRows[0]?.totalCount || 0);
  const successOperations = Number(summaryRows[0]?.successCount || 0);
  const failureOperations = Number(summaryRows[0]?.failureCount || 0);

  // Filtered total count query
  const countSql = `SELECT COUNT(*) AS total FROM audit_logs a ${whereSql}`;
  const countRows = await query(countSql, params);
  const total = Number(countRows[0]?.total || 0);

  // Paginated rows query
  const listSql = `
    SELECT 
      a.audit_id AS auditId,
      a.action_type AS actionType,
      a.target_entity_type AS targetEntityType,
      a.target_entity_id AS targetEntityId,
      a.description,
      a.result,
      a.metadata,
      a.created_at AS createdAt
    FROM audit_logs a
    ${whereSql}
    ORDER BY a.created_at DESC, a.audit_id DESC
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, l, offset];
  const rows = await query(listSql, queryParams);

  const items = rows.map(r => {
    let parsedMeta = null;
    if (r.metadata) {
      try {
        parsedMeta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      } catch (_) {
        parsedMeta = r.metadata;
      }
    }
    return {
      auditId: r.auditId,
      actionType: r.actionType,
      targetEntityType: r.targetEntityType,
      targetEntityId: r.targetEntityId,
      description: r.description,
      result: r.result,
      metadata: parsedMeta,
      createdAt: r.createdAt
    };
  });

  return {
    items,
    summary: {
      totalOperations,
      successOperations,
      failureOperations
    },
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1
    }
  };
}

module.exports = {
  recordAuditEvent,
  listAuditLogs,
  getEmployeeActivityHistory,
  sanitizeMetadata
};
