/**
 * ==============================================================================
 * Fraud Detection Engine - Fraud Monitoring Dashboard Service (Phase 4)
 * ==============================================================================
 * Provides aggregation statistics, alert exploration, investigation management,
 * and rule configuration for Employee and Administrator operational workflows.
 *
 * Architecture Principles:
 * 1. MongoDB remains authoritative source for fraud alerts, assessments, rules,
 *    and investigations.
 * 2. MySQL remains authoritative source for banking transactions, accounts, and customers.
 * 3. Zero N+1 Queries: Batch-hydrates MySQL transaction details using a single
 *    `WHERE transaction_id IN (...)` query.
 * 4. High-performance MongoDB Aggregations: Computes metrics using `$facet` pipelines
 *    without loading collections into application memory.
 * 5. Full Audit Integrity: Investigation notes and status changes are append-only.
 * 6. Cache Invalidation: Rule updates immediately flush the fraud engine in-memory cache.
 * ==============================================================================
 */

const { ObjectId } = require('mongodb');
const { getDb, isMongoConnected } = require('../../config/mongo');
const { query } = require('../../config/db');
const { clearRuleCache, validateRuleConfig } = require('./fraudRuleRepository');
const { toStoredPaise, fromStoredPaise } = require('./utils/monetary');
const { RISK_LEVELS } = require('./riskScoringService');

/**
 * Allowed status transitions for fraud investigation case management.
 * State machine:
 * OPEN -> UNDER_REVIEW, IN_PROGRESS, RESOLVED, FALSE_POSITIVE, CLOSED
 * UNDER_REVIEW -> IN_PROGRESS, RESOLVED, FALSE_POSITIVE, CLOSED
 * IN_PROGRESS -> UNDER_REVIEW, RESOLVED, FALSE_POSITIVE, CLOSED
 * RESOLVED -> CLOSED, UNDER_REVIEW (reopened for review)
 * FALSE_POSITIVE -> CLOSED, UNDER_REVIEW (reopened for review)
 * CLOSED -> UNDER_REVIEW (reopened for review)
 */
const ALLOWED_STATUS_TRANSITIONS = {
  OPEN: ['UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE', 'CLOSED'],
  UNDER_REVIEW: ['IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE', 'CLOSED'],
  IN_PROGRESS: ['UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE', 'CLOSED'],
  RESOLVED: ['CLOSED', 'UNDER_REVIEW'],
  FALSE_POSITIVE: ['CLOSED', 'UNDER_REVIEW'],
  CLOSED: ['UNDER_REVIEW']
};

/**
 * Standard error helper for domain validation and missing records.
 */
class FraudDashboardError extends Error {
  constructor(message, code = 'FRAUD_DASHBOARD_ERROR', status = 400) {
    super(message);
    this.name = 'FraudDashboardError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Safely parse a MongoDB ObjectId string.
 * @param {string} idStr
 * @returns {ObjectId|null}
 */
function parseObjectId(idStr) {
  if (typeof idStr === 'string' && /^[0-9a-fA-F]{24}$/.test(idStr)) {
    try {
      return new ObjectId(idStr);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Validates that MongoDB is connected.
 * @throws {FraudDashboardError} if disconnected
 */
function ensureMongoDb() {
  if (!isMongoConnected()) {
    throw new FraudDashboardError('Fraud database is currently unavailable', 'FRAUD_DB_UNAVAILABLE', 503);
  }
  const db = getDb();
  if (!db) {
    throw new FraudDashboardError('Fraud database is currently unavailable', 'FRAUD_DB_UNAVAILABLE', 503);
  }
  return db;
}

/**
 * ==============================================================================
 * A. Fraud Overview Statistics
 * ==============================================================================
 * Executes aggregation pipelines to return system-wide metrics across alerts,
 * assessments, and investigations.
 *
 * @returns {Promise<object>}
 */
async function getDashboardStats() {
  const db = ensureMongoDb();

  const alertsCollection = db.collection('fraud_alerts');
  const assessmentsCollection = db.collection('transaction_risk_assessments');
  const investigationsCollection = db.collection('fraud_investigations');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // 1. Aggregations on fraud_alerts
  const [alertsFacet] = await alertsCollection
    .aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byRiskLevel: [
            { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          recent24h: [
            { $match: { createdAt: { $gte: oneDayAgo } } },
            { $count: 'count' }
          ],
          recentScoreAvg: [
            { $sort: { createdAt: -1 } },
            { $limit: 1000 },
            {
              $group: {
                _id: null,
                avgScore: { $avg: '$riskScore' },
                count: { $sum: 1 }
              }
            }
          ],
          overTime: [
            { $match: { createdAt: { $gte: fourteenDaysAgo } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ])
    .toArray();

  // 2. Aggregations on transaction_risk_assessments
  const [assessmentsFacet] = await assessmentsCollection
    .aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byRiskLevel: [
            { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
          ],
          byDecision: [
            { $group: { _id: '$decision', count: { $sum: 1 } } }
          ],
          recentScoreAvg: [
            { $sort: { assessedAt: -1 } },
            { $limit: 1000 },
            {
              $group: {
                _id: null,
                avgScore: { $avg: '$riskScore' },
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ])
    .toArray();

  // 3. Aggregations on fraud_investigations
  const [investigationsFacet] = await investigationsCollection
    .aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ]
        }
      }
    ])
    .toArray();

  // Unpack alerts stats
  const totalAlerts = alertsFacet?.total[0]?.count || 0;
  const recentAlertCount = alertsFacet?.recent24h[0]?.count || 0;
  const recentScoreAvgRaw = alertsFacet?.recentScoreAvg?.[0]?.avgScore;
  const recentAverageRiskScore =
    recentScoreAvgRaw !== undefined && recentScoreAvgRaw !== null
      ? Number(recentScoreAvgRaw.toFixed(2))
      : 0;

  const alertsByRiskLevel = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };
  (alertsFacet?.byRiskLevel || []).forEach((item) => {
    if (item._id && alertsByRiskLevel[item._id] !== undefined) {
      alertsByRiskLevel[item._id] = item.count;
    }
  });

  const alertsByStatus = {
    OPEN: 0,
    UNDER_REVIEW: 0,
    RESOLVED: 0,
    FALSE_POSITIVE: 0
  };
  (alertsFacet?.byStatus || []).forEach((item) => {
    if (item._id) {
      alertsByStatus[item._id] = item.count;
    }
  });

  const alertsOverTime = (alertsFacet?.overTime || []).map((item) => ({
    date: item._id,
    count: item.count
  }));

  // Unpack assessments stats
  const totalAssessments = assessmentsFacet?.total[0]?.count || 0;
  const recentAssessmentScoreAvgRaw = assessmentsFacet?.recentScoreAvg?.[0]?.avgScore;
  const recentAverageAssessmentScore =
    recentAssessmentScoreAvgRaw !== undefined && recentAssessmentScoreAvgRaw !== null
      ? Number(recentAssessmentScoreAvgRaw.toFixed(2))
      : 0;
  const assessmentsByRiskLevel = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };
  (assessmentsFacet?.byRiskLevel || []).forEach((item) => {
    if (item._id && assessmentsByRiskLevel[item._id] !== undefined) {
      assessmentsByRiskLevel[item._id] = item.count;
    }
  });

  const highRiskAssessments = assessmentsByRiskLevel.HIGH || 0;
  const criticalRiskAssessments = assessmentsByRiskLevel.CRITICAL || 0;

  // Unpack investigations stats
  const totalInvestigations = investigationsFacet?.total[0]?.count || 0;
  const investigationsByStatus = {
    OPEN: 0,
    UNDER_REVIEW: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    FALSE_POSITIVE: 0,
    CLOSED: 0
  };
  (investigationsFacet?.byStatus || []).forEach((item) => {
    if (item._id) {
      investigationsByStatus[item._id] = item.count;
    }
  });

  const pendingInvestigations =
    (investigationsByStatus.OPEN || 0) +
    (investigationsByStatus.UNDER_REVIEW || 0) +
    (investigationsByStatus.IN_PROGRESS || 0);

  const resolvedInvestigations =
    (investigationsByStatus.RESOLVED || 0) +
    (investigationsByStatus.FALSE_POSITIVE || 0) +
    (investigationsByStatus.CLOSED || 0);

  return {
    totalAlerts,
    recentAlertCount,
    recentAverageRiskScore,
    recentAverageAlertScore: recentAverageRiskScore,
    recentAverageAssessmentScore,
    averageRiskScore: recentAverageRiskScore,
    totalAssessments,
    highRiskAssessments,
    criticalRiskAssessments,
    highRiskAlerts: alertsByRiskLevel.HIGH || 0,
    criticalRiskAlerts: alertsByRiskLevel.CRITICAL || 0,
    assessmentsByRiskLevel,
    alertsByRiskLevel,
    alertsByStatus,
    alertsOverTime,
    totalInvestigations,
    pendingInvestigations,
    resolvedInvestigations,
    investigationsByStatus
  };
}

/**
 * Batch-hydrates banking transaction details from MySQL for a list of transaction IDs.
 * Guarantees exactly ONE MySQL query (zero N+1 queries).
 *
 * @param {Array<number>} transactionIds
 * @returns {Promise<Map<number, object>>}
 */
async function hydrateBankingTransactions(transactionIds) {
  const result = new Map();
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    return result;
  }

  const uniqueIds = Array.from(new Set(transactionIds.map((id) => Number(id)).filter((id) => Number.isSafeInteger(id) && id > 0)));
  if (uniqueIds.length === 0) {
    return result;
  }

  const placeholders = uniqueIds.map(() => '?').join(',');
  const sql = `
    SELECT
      t.transaction_id AS transactionId,
      t.transaction_ref AS transactionRef,
      t.type AS transactionType,
      t.amount,
      t.source_account_id AS sourceAccountId,
      t.destination_account_id AS destinationAccountId,
      sa.account_number AS sourceAccountNumber,
      da.account_number AS destinationAccountNumber,
      c.customer_id AS customerId,
      c.full_name AS customerName,
      t.performed_by_user_id AS performedByUserId,
      u.username AS performedByUsername,
      t.remarks,
      t.created_at AS timestamp
    FROM bank_transactions t
    LEFT JOIN accounts sa ON t.source_account_id = sa.account_id
    LEFT JOIN accounts da ON t.destination_account_id = da.account_id
    LEFT JOIN customers c ON (
      (t.source_account_id IS NOT NULL AND sa.customer_id = c.customer_id) OR
      (t.source_account_id IS NULL AND da.customer_id = c.customer_id)
    )
    LEFT JOIN users u ON t.performed_by_user_id = u.user_id
    WHERE t.transaction_id IN (${placeholders})
  `;

  try {
    const rows = await query(sql, uniqueIds);
    for (const row of rows) {
      result.set(Number(row.transactionId), {
        transactionId: Number(row.transactionId),
        transactionRef: row.transactionRef,
        transactionType: row.transactionType,
        amount: Number(row.amount),
        amountFormatted: Number(row.amount).toFixed(2),
        sourceAccountId: row.sourceAccountId ? Number(row.sourceAccountId) : null,
        destinationAccountId: row.destinationAccountId ? Number(row.destinationAccountId) : null,
        sourceAccountNumber: row.sourceAccountNumber || null,
        destinationAccountNumber: row.destinationAccountNumber || null,
        customerId: row.customerId ? Number(row.customerId) : null,
        customerName: row.customerName || 'Unknown Customer',
        performedByUserId: row.performedByUserId ? Number(row.performedByUserId) : null,
        performedByUsername: row.performedByUsername || null,
        remarks: row.remarks || '',
        timestamp: row.timestamp,
        isArchived: false,
        isUnavailable: false
      });
    }
  } catch (err) {
    console.error('Failed to hydrate banking transactions from MySQL:', err.message);
  }

  // Fallback: For any transaction ID not present in MySQL (e.g. purged/archived ledger rows or test fixtures),
  // hydrate the authoritative evaluated type and amount from MongoDB transaction_risk_assessments.
  const missingIds = uniqueIds.filter((id) => !result.has(id));
  if (missingIds.length > 0) {
    try {
      const db = getDb();
      if (db) {
        const assessments = await db
          .collection('transaction_risk_assessments')
          .find({ transactionId: { $in: missingIds } })
          .toArray();

        for (const as of assessments) {
          const paise = as.amount;
          const formatted = paise !== null && paise !== undefined ? fromStoredPaise(paise) : null;
          const numAmount = formatted !== null ? parseFloat(formatted) : null;
          result.set(Number(as.transactionId), {
            transactionId: Number(as.transactionId),
            transactionRef: `TXN-${as.transactionId}`,
            transactionType: as.transactionType || 'UNAVAILABLE',
            amount: numAmount,
            amountFormatted: formatted,
            sourceAccountId: as.accountId ? Number(as.accountId) : null,
            destinationAccountId: null,
            sourceAccountNumber: null,
            destinationAccountNumber: null,
            customerId: as.customerId ? Number(as.customerId) : null,
            customerName: as.customerId ? `Customer #${as.customerId}` : 'Unknown Customer',
            performedByUserId: null,
            performedByUsername: null,
            remarks: 'Archived transaction (recovered from fraud risk assessment ledger)',
            timestamp: as.assessedAt,
            isArchived: true,
            isUnavailable: false
          });
        }
      }
    } catch (fallbackErr) {
      console.warn('Failed to hydrate missing transactions from risk assessments fallback:', fallbackErr.message);
    }
  }

  return result;
}

/**
 * ==============================================================================
 * B. List Fraud Alerts
 * ==============================================================================
 * Returns paginated fraud alerts with filtering, sorting, and hydrated MySQL details.
 *
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.riskLevel] - 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
 * @param {string} [params.status] - 'ALL' | 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'FALSE_POSITIVE'
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @param {string|number} [params.transactionId]
 * @param {string} [params.sortField='createdAt']
 * @param {number} [params.sortOrder=-1]
 * @returns {Promise<{ items: Array<object>, pagination: object }>}
 */
async function listAlerts({
  page = 1,
  limit = 20,
  riskLevel,
  status,
  startDate,
  endDate,
  transactionId,
  sortField = 'createdAt',
  sortOrder = -1
} = {}) {
  const db = ensureMongoDb();
  const collection = db.collection('fraud_alerts');

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * pageSize;

  const match = {};

  // 1. Filter by riskLevel
  if (riskLevel && riskLevel !== 'ALL') {
    const normRisk = String(riskLevel).toUpperCase().trim();
    if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(normRisk)) {
      match.riskLevel = normRisk;
    }
  }

  // 2. Filter by status
  if (status && status !== 'ALL') {
    const normStatus = String(status).toUpperCase().trim();
    if (['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE', 'CLOSED'].includes(normStatus)) {
      match.status = normStatus;
    }
  }

  // 3. Filter by transactionId
  if (transactionId !== undefined && transactionId !== null && transactionId !== '') {
    const parsedTxnId = Number(transactionId);
    if (Number.isSafeInteger(parsedTxnId) && parsedTxnId > 0) {
      match.transactionId = parsedTxnId;
    }
  }

  // 4. Filter by date range (Strict UTC)
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
          start.setUTCHours(0, 0, 0, 0);
        }
        match.createdAt.$gte = start;
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
          end.setUTCHours(23, 59, 59, 999);
        }
        match.createdAt.$lte = end;
      }
    }
    if (Object.keys(match.createdAt).length === 0) {
      delete match.createdAt;
    }
  }

  // 5. Query total count and documents
  const total = await collection.countDocuments(match);

  const allowedSortFields = ['createdAt', 'riskScore', 'riskLevel', 'status', 'transactionId'];
  const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'createdAt';
  const safeSortOrder = sortOrder === 1 || sortOrder === '1' || sortOrder === 'asc' ? 1 : -1;

  const alertDocs = await collection
    .find(match)
    .sort({ [safeSortField]: safeSortOrder, _id: safeSortOrder })
    .skip(skip)
    .limit(pageSize)
    .toArray();

  if (alertDocs.length === 0) {
    return {
      items: [],
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1
      }
    };
  }

  // 6. Batch hydrate MySQL transaction information (Zero N+1)
  const txnIds = alertDocs.map((a) => a.transactionId);
  const txnMap = await hydrateBankingTransactions(txnIds);

  // 7. Check for existing investigations linked to these alerts
  const alertObjectIds = alertDocs.map((a) => a._id);
  const investigationsCollection = db.collection('fraud_investigations');
  const investigations = await investigationsCollection
    .find({
      $or: [
        { alertId: { $in: alertObjectIds } },
        { transactionId: { $in: txnIds } }
      ]
    })
    .toArray();

  const investigationMap = new Map();
  for (const inv of investigations) {
    if (inv.alertId) investigationMap.set(String(inv.alertId), inv);
    if (inv.transactionId) investigationMap.set(String(inv.transactionId), inv);
  }

  // 8. Combine into unified view
  const items = alertDocs.map((alert) => {
    const txn = txnMap.get(Number(alert.transactionId)) || null;
    const inv = investigationMap.get(String(alert._id)) || investigationMap.get(String(alert.transactionId)) || null;

    return {
      alertId: alert._id.toString(),
      transactionId: alert.transactionId,
      customerId: alert.customerId,
      accountId: alert.accountId,
      riskScore: alert.riskScore,
      riskLevel: alert.riskLevel,
      status: alert.status,
      reasons: alert.reasons || [],
      triggeredRules: alert.triggeredRules || [],
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
      // Hydrated banking transaction details
      transactionRef: txn?.transactionRef || null,
      transactionType: txn ? txn.transactionType : 'UNAVAILABLE',
      amount: txn ? txn.amount : null,
      amountFormatted: txn ? txn.amountFormatted : null,
      customerName: txn?.customerName || null,
      sourceAccountNumber: txn?.sourceAccountNumber || null,
      destinationAccountNumber: txn?.destinationAccountNumber || null,
      isArchived: Boolean(txn?.isArchived),
      isUnavailable: !txn,
      // Investigation presence
      investigationId: inv ? inv._id.toString() : null,
      investigationStatus: inv ? inv.status : null
    };
  });

  return {
    items,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1
    }
  };
}

/**
 * ==============================================================================
 * C. Alert Details
 * ==============================================================================
 * Retrieves complete alert details, associated risk assessment, triggered rules,
 * MySQL transaction details, and investigation history.
 *
 * @param {string|number} alertIdOrTxnId
 * @returns {Promise<object>}
 */
async function getAlertDetails(alertIdOrTxnId) {
  const db = ensureMongoDb();
  const alertsCollection = db.collection('fraud_alerts');
  const assessmentsCollection = db.collection('transaction_risk_assessments');
  const investigationsCollection = db.collection('fraud_investigations');

  let alert = null;
  const objectId = parseObjectId(String(alertIdOrTxnId));

  if (objectId) {
    alert = await alertsCollection.findOne({ _id: objectId });
  }

  if (!alert) {
    const numId = Number(alertIdOrTxnId);
    if (Number.isSafeInteger(numId) && numId > 0) {
      alert = await alertsCollection.findOne({ transactionId: numId });
    }
  }

  if (!alert) {
    throw new FraudDashboardError('Fraud alert not found', 'ALERT_NOT_FOUND', 404);
  }

  // Fetch associated risk assessment
  const assessment = await assessmentsCollection.findOne({ transactionId: alert.transactionId });

  // Fetch associated investigation(s)
  const investigation = await investigationsCollection.findOne({
    $or: [{ alertId: alert._id }, { transactionId: alert.transactionId }]
  });

  // Hydrate MySQL banking transaction
  const txnsMap = await hydrateBankingTransactions([alert.transactionId]);
  const transaction = txnsMap.get(alert.transactionId) || null;

  return {
    alert: {
      alertId: alert._id.toString(),
      transactionId: alert.transactionId,
      customerId: alert.customerId,
      accountId: alert.accountId,
      riskScore: alert.riskScore,
      riskLevel: alert.riskLevel,
      status: alert.status,
      reasons: alert.reasons || [],
      triggeredRules: alert.triggeredRules || [],
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt
    },
    assessment: assessment
      ? {
          assessmentId: assessment._id.toString(),
          transactionId: assessment.transactionId,
          riskScore: assessment.riskScore,
          riskLevel: assessment.riskLevel,
          decision: assessment.decision,
          triggeredRules: assessment.triggeredRules || [],
          amountPaise: assessment.amount,
          amountRupees: assessment.amount !== null && assessment.amount !== undefined ? Number(fromStoredPaise(assessment.amount)) : null,
          assessedAt: assessment.assessedAt
        }
      : null,
    transaction,
    investigation: investigation
      ? {
          investigationId: investigation._id.toString(),
          alertId: investigation.alertId ? investigation.alertId.toString() : null,
          transactionId: investigation.transactionId,
          assignedEmployeeId: investigation.assignedEmployeeId,
          status: investigation.status,
          notes: investigation.notes || [],
          resolution: investigation.resolution || null,
          createdAt: investigation.createdAt,
          updatedAt: investigation.updatedAt
        }
      : null
  };
}

/**
 * ==============================================================================
 * D. Investigation Management
 * ==============================================================================
 */

/**
 * Create an investigation for a fraud alert.
 *
 * @param {object} params
 * @param {string} params.alertId - Alert ObjectId string or transactionId
 * @param {string} [params.notes] - Initial investigator note
 * @param {number} [params.assignedEmployeeId] - Optional assigned employee ID
 * @param {object} params.user - Authenticated user context
 * @returns {Promise<object>} Created investigation
 */
async function createInvestigation({ alertId, notes, assignedEmployeeId, user }) {
  const db = ensureMongoDb();
  const alertsCollection = db.collection('fraud_alerts');
  const investigationsCollection = db.collection('fraud_investigations');

  let alert = null;
  const objectId = parseObjectId(String(alertId));
  if (objectId) {
    alert = await alertsCollection.findOne({ _id: objectId });
  }
  if (!alert) {
    const num = Number(alertId);
    if (Number.isSafeInteger(num) && num > 0) {
      alert = await alertsCollection.findOne({ transactionId: num });
    }
  }

  if (!alert) {
    throw new FraudDashboardError('Cannot create investigation: referenced alert does not exist', 'ALERT_NOT_FOUND', 404);
  }

  // Check if an open or active investigation already exists for this alert/transaction
  const existing = await investigationsCollection.findOne({
    $or: [{ alertId: alert._id }, { transactionId: alert.transactionId }]
  });

  if (existing) {
    // If active investigation already exists, return conflict or existing
    return {
      ...existing,
      investigationId: existing._id.toString(),
      isExisting: true
    };
  }

  const assignedEmp = assignedEmployeeId
    ? Number(assignedEmployeeId)
    : user.employeeId
    ? Number(user.employeeId)
    : null;

  const now = new Date();
  const initialStatus = assignedEmp ? 'IN_PROGRESS' : 'OPEN';

  const notesList = [];
  if (notes && typeof notes === 'string' && notes.trim()) {
    notesList.push({
      noteId: new ObjectId().toString(),
      text: notes.trim(),
      authorUserId: user.userId,
      authorName: user.displayName || user.username,
      authorRole: user.role,
      createdAt: now
    });
  }

  const investigationDoc = {
    alertId: alert._id,
    transactionId: alert.transactionId,
    assignedEmployeeId: assignedEmp,
    status: initialStatus,
    notes: notesList,
    history: [
      {
        action: 'CREATED',
        fromStatus: null,
        toStatus: initialStatus,
        assignedEmployeeId: assignedEmp,
        changedBy: user.displayName || user.username,
        changedAt: now
      }
    ],
    resolution: null,
    createdAt: now,
    updatedAt: now
  };

  let result;
  try {
    result = await investigationsCollection.insertOne(investigationDoc);
  } catch (err) {
    if (err.code === 11000) {
      // Concurrent duplicate request safely handled by unique index constraint
      const concurrentExisting = await investigationsCollection.findOne({
        $or: [{ alertId: alert._id }, { transactionId: alert.transactionId }]
      });
      if (concurrentExisting) {
        return {
          ...concurrentExisting,
          investigationId: concurrentExisting._id.toString(),
          isExisting: true
        };
      }
    }
    throw err;
  }

  // Update alert status to UNDER_REVIEW
  await alertsCollection.updateOne(
    { _id: alert._id },
    { $set: { status: 'UNDER_REVIEW', updatedAt: now } }
  );

  return {
    investigationId: result.insertedId.toString(),
    ...investigationDoc,
    isExisting: false
  };
}

/**
 * List investigations with pagination and filtering.
 *
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.status]
 * @param {number} [params.assignedEmployeeId]
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 * @param {string} [params.sortField='createdAt']
 * @param {number} [params.sortOrder=-1]
 * @returns {Promise<{ items: Array<object>, pagination: object }>}
 */
async function listInvestigations({
  page = 1,
  limit = 20,
  status,
  assignedEmployeeId,
  startDate,
  endDate,
  sortField = 'createdAt',
  sortOrder = -1
} = {}) {
  const db = ensureMongoDb();
  const collection = db.collection('fraud_investigations');

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * pageSize;

  const match = {};

  if (status && status !== 'ALL') {
    const norm = String(status).toUpperCase().trim();
    if (['OPEN', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE', 'CLOSED'].includes(norm)) {
      match.status = norm;
    }
  }

  if (assignedEmployeeId !== undefined && assignedEmployeeId !== null && assignedEmployeeId !== '') {
    const empId = Number(assignedEmployeeId);
    if (Number.isSafeInteger(empId) && empId > 0) {
      match.assignedEmployeeId = empId;
    }
  }

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) {
      const s = new Date(startDate);
      if (!isNaN(s.getTime())) {
        if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
          s.setUTCHours(0, 0, 0, 0);
        }
        match.createdAt.$gte = s;
      }
    }
    if (endDate) {
      const e = new Date(endDate);
      if (!isNaN(e.getTime())) {
        if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
          e.setUTCHours(23, 59, 59, 999);
        }
        match.createdAt.$lte = e;
      }
    }
    if (Object.keys(match.createdAt).length === 0) delete match.createdAt;
  }

  const total = await collection.countDocuments(match);

  const allowedSortFields = ['createdAt', 'updatedAt', 'status', 'transactionId'];
  const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'createdAt';
  const safeSortOrder = sortOrder === 1 || sortOrder === '1' || sortOrder === 'asc' ? 1 : -1;

  const docs = await collection
    .find(match)
    .sort({ [safeSortField]: safeSortOrder, _id: safeSortOrder })
    .skip(skip)
    .limit(pageSize)
    .toArray();

  if (docs.length === 0) {
    return {
      items: [],
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1
      }
    };
  }

  // Hydrate MySQL transactions
  const txnIds = docs.map((d) => d.transactionId);
  const txnsMap = await hydrateBankingTransactions(txnIds);

  const items = docs.map((doc) => {
    const txn = txnsMap.get(Number(doc.transactionId)) || null;
    return {
      investigationId: doc._id.toString(),
      alertId: doc.alertId ? doc.alertId.toString() : null,
      transactionId: doc.transactionId,
      assignedEmployeeId: doc.assignedEmployeeId,
      status: doc.status,
      notesCount: (doc.notes || []).length,
      latestNote: doc.notes && doc.notes.length > 0 ? doc.notes[doc.notes.length - 1] : null,
      resolution: doc.resolution,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      // Hydrated banking details
      transactionRef: txn?.transactionRef || null,
      transactionType: txn ? txn.transactionType : 'UNAVAILABLE',
      amount: txn ? txn.amount : null,
      amountFormatted: txn ? txn.amountFormatted : null,
      customerName: txn?.customerName || null,
      isArchived: Boolean(txn?.isArchived),
      isUnavailable: !txn
    };
  });

  return {
    items,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1
    }
  };
}

/**
 * Get detailed investigation record by ID.
 *
 * @param {string} investigationId
 * @returns {Promise<object>}
 */
async function getInvestigationDetails(investigationId) {
  const db = ensureMongoDb();
  const collection = db.collection('fraud_investigations');

  const objId = parseObjectId(investigationId);
  if (!objId) {
    throw new FraudDashboardError('Invalid investigation identifier format', 'INVALID_ID_FORMAT', 400);
  }

  const investigation = await collection.findOne({ _id: objId });
  if (!investigation) {
    throw new FraudDashboardError('Investigation not found', 'INVESTIGATION_NOT_FOUND', 404);
  }

  // Fetch linked alert & assessment
  const alertsCollection = db.collection('fraud_alerts');
  const alert = investigation.alertId ? await alertsCollection.findOne({ _id: investigation.alertId }) : null;

  const assessmentsCollection = db.collection('transaction_risk_assessments');
  const assessment = await assessmentsCollection.findOne({ transactionId: investigation.transactionId });

  // Hydrate MySQL transaction
  const txnsMap = await hydrateBankingTransactions([investigation.transactionId]);
  const transaction = txnsMap.get(investigation.transactionId) || null;

  // Hydrate assigned employee name from MySQL if assigned
  let assignedEmployee = null;
  if (investigation.assignedEmployeeId) {
    try {
      const empRows = await query(
        'SELECT employee_id, full_name, email, phone FROM employees WHERE employee_id = ?',
        [investigation.assignedEmployeeId]
      );
      if (empRows.length > 0) {
        assignedEmployee = {
          employeeId: Number(empRows[0].employee_id),
          fullName: empRows[0].full_name,
          email: empRows[0].email,
          phone: empRows[0].phone
        };
      }
    } catch (err) {
      console.error('Error fetching assigned employee from MySQL:', err.message);
    }
  }

  return {
    investigationId: investigation._id.toString(),
    alertId: investigation.alertId ? investigation.alertId.toString() : null,
    transactionId: investigation.transactionId,
    assignedEmployeeId: investigation.assignedEmployeeId,
    assignedEmployee,
    status: investigation.status,
    notes: investigation.notes || [],
    history: investigation.history || [],
    resolution: investigation.resolution,
    createdAt: investigation.createdAt,
    updatedAt: investigation.updatedAt,
    alert,
    assessment,
    transaction
  };
}

/**
 * Update investigation status, notes, assigned employee, or resolution.
 *
 * @param {string} investigationId
 * @param {object} updateData
 * @param {string} [updateData.status]
 * @param {number} [updateData.assignedEmployeeId]
 * @param {string} [updateData.note] - Note text to append to audit log
 * @param {string|object} [updateData.resolution] - Outcome summary
 * @param {object} user - Authenticated user context
 * @returns {Promise<object>}
 */
async function updateInvestigation(investigationId, updateData, user) {
  const db = ensureMongoDb();
  const collection = db.collection('fraud_investigations');

  const objId = parseObjectId(investigationId);
  if (!objId) {
    throw new FraudDashboardError('Invalid investigation identifier format', 'INVALID_ID_FORMAT', 400);
  }

  const existing = await collection.findOne({ _id: objId });
  if (!existing) {
    throw new FraudDashboardError('Investigation not found', 'INVESTIGATION_NOT_FOUND', 404);
  }

  const now = new Date();
  const setUpdates = { updatedAt: now };
  const pushUpdates = {};
  const historyEntries = [];

  // 1. Status transition
  if (updateData.status !== undefined) {
    const validStatuses = ['OPEN', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE', 'CLOSED'];
    const normStatus = String(updateData.status).toUpperCase().trim();
    if (!validStatuses.includes(normStatus)) {
      throw new FraudDashboardError(
        `Invalid investigation status: "${updateData.status}". Allowed values: ${validStatuses.join(', ')}`,
        'INVALID_STATUS',
        400
      );
    }

    if (normStatus !== existing.status) {
      const allowedNext = ALLOWED_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowedNext.includes(normStatus)) {
        throw new FraudDashboardError(
          `Invalid status transition from "${existing.status}" to "${normStatus}". Allowed transitions: ${allowedNext.join(', ')}`,
          'INVALID_STATUS_TRANSITION',
          400
        );
      }

      setUpdates.status = normStatus;
      historyEntries.push({
        action: 'STATUS_CHANGE',
        fromStatus: existing.status,
        toStatus: normStatus,
        changedBy: user.displayName || user.username,
        changedAt: now
      });

      // Synchronize fraud_alerts status when investigation status changes
      if (existing.alertId) {
        const alertsCollection = db.collection('fraud_alerts');
        if (normStatus === 'RESOLVED' || normStatus === 'FALSE_POSITIVE') {
          await alertsCollection.updateOne(
            { _id: existing.alertId },
            { $set: { status: normStatus, updatedAt: now } }
          );
        } else if (normStatus === 'IN_PROGRESS' || normStatus === 'UNDER_REVIEW') {
          await alertsCollection.updateOne(
            { _id: existing.alertId },
            { $set: { status: 'UNDER_REVIEW', updatedAt: now } }
          );
        } else if (normStatus === 'CLOSED') {
          // Closing investigation resolves any remaining open/under review alerts
          await alertsCollection.updateOne(
            { _id: existing.alertId, status: { $in: ['OPEN', 'UNDER_REVIEW'] } },
            { $set: { status: 'RESOLVED', updatedAt: now } }
          );
        }
      }
    }
  }

  // 2. Assign employee
  if (updateData.assignedEmployeeId !== undefined) {
    let empId = null;
    if (updateData.assignedEmployeeId !== null && updateData.assignedEmployeeId !== '') {
      empId = Number(updateData.assignedEmployeeId);
      if (!Number.isSafeInteger(empId) || empId <= 0) {
        throw new FraudDashboardError('assignedEmployeeId must be a positive integer or null', 'INVALID_EMPLOYEE_ID', 400);
      }
    }

    if (empId !== existing.assignedEmployeeId) {
      setUpdates.assignedEmployeeId = empId;
      historyEntries.push({
        action: 'ASSIGNMENT_CHANGE',
        fromEmployeeId: existing.assignedEmployeeId,
        toEmployeeId: empId,
        changedBy: user.displayName || user.username,
        changedAt: now
      });
    }
  }

  // 3. Append Note (Never overwrite previous notes)
  if (updateData.note && typeof updateData.note === 'string' && updateData.note.trim()) {
    const newNote = {
      noteId: new ObjectId().toString(),
      text: updateData.note.trim(),
      authorUserId: user.userId,
      authorName: user.displayName || user.username,
      authorRole: user.role,
      createdAt: now
    };
    pushUpdates.notes = newNote;
  }

  // 4. Record Resolution
  if (updateData.resolution !== undefined) {
    if (typeof updateData.resolution === 'string') {
      setUpdates.resolution = updateData.resolution.trim();
    } else if (typeof updateData.resolution === 'object') {
      setUpdates.resolution = updateData.resolution;
    }
  }

  // Combine MongoDB update operations
  const mongoUpdate = { $set: setUpdates };
  if (pushUpdates.notes || historyEntries.length > 0) {
    mongoUpdate.$push = {};
    if (pushUpdates.notes) {
      mongoUpdate.$push.notes = pushUpdates.notes;
    }
    if (historyEntries.length > 0) {
      mongoUpdate.$push.history = { $each: historyEntries };
    }
  }

  await collection.updateOne({ _id: objId }, mongoUpdate);

  return getInvestigationDetails(investigationId);
}

/**
 * ==============================================================================
 * E. Fraud Rule Management
 * ==============================================================================
 */

/**
 * List all configured fraud detection rules from MongoDB.
 *
 * @returns {Promise<Array<object>>}
 */
async function listFraudRules() {
  const db = ensureMongoDb();
  const rules = await db
    .collection('fraud_rules')
    .find({})
    .sort({ ruleCode: 1 })
    .toArray();

  return rules.map((r) => ({
    ruleId: r._id.toString(),
    ruleCode: r.ruleCode,
    name: r.name,
    description: r.description,
    enabled: Boolean(r.enabled),
    threshold: r.threshold,
    // Provide rupee equivalent for monetary rules like HIGH_AMOUNT
    thresholdInRupees: r.ruleCode === 'HIGH_AMOUNT' && r.threshold !== null && r.threshold !== undefined ? Number(fromStoredPaise(r.threshold)) : null,
    weight: r.weight,
    config: r.config || null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }));
}

/**
 * Update a fraud rule's configuration in MongoDB (Admin Only).
 * Invalidates the fraud engine in-memory cache upon success.
 *
 * @param {string} ruleIdOrCode - ObjectId string or ruleCode (e.g. 'HIGH_AMOUNT')
 * @param {object} updateData
 * @param {boolean} [updateData.enabled]
 * @param {number} [updateData.threshold] - Numeric threshold (in paise or rupees depending on unit)
 * @param {string} [updateData.thresholdUnit] - 'PAISE' | 'RUPEES' (defaults to PAISE for backward compatibility)
 * @param {number} [updateData.thresholdInRupees] - Convenience field to supply rupees directly
 * @param {number} [updateData.weight] - Risk score weight (0-100)
 * @param {object} [updateData.config] - Rule specific configuration
 * @returns {Promise<object>} Updated rule document
 */
async function updateFraudRule(ruleIdOrCode, updateData) {
  const db = ensureMongoDb();
  const collection = db.collection('fraud_rules');

  let rule = null;
  const objId = parseObjectId(String(ruleIdOrCode));
  if (objId) {
    rule = await collection.findOne({ _id: objId });
  }
  if (!rule) {
    rule = await collection.findOne({ ruleCode: String(ruleIdOrCode).trim().toUpperCase() });
  }

  if (!rule) {
    throw new FraudDashboardError(`Fraud rule "${ruleIdOrCode}" not found`, 'RULE_NOT_FOUND', 404);
  }

  const setUpdates = { updatedAt: new Date() };

  // 1. Update enabled
  if (updateData.enabled !== undefined) {
    if (typeof updateData.enabled !== 'boolean') {
      throw new FraudDashboardError('Field "enabled" must be a boolean', 'INVALID_RULE_ENABLED', 400);
    }
    setUpdates.enabled = updateData.enabled;
  }

  // 2. Update weight (0 - 100)
  if (updateData.weight !== undefined) {
    const w = Number(updateData.weight);
    if (Number.isNaN(w) || w < 0 || w > 100) {
      throw new FraudDashboardError('Field "weight" must be a number between 0 and 100', 'INVALID_RULE_WEIGHT', 400);
    }
    setUpdates.weight = Math.round(w);
  }

  // 3. Update threshold
  if (updateData.thresholdInRupees !== undefined) {
    // Supplied in rupees -> convert cleanly to integer paise
    const paise = toStoredPaise(updateData.thresholdInRupees);
    if (paise < 0) {
      throw new FraudDashboardError('Monetary threshold must be a non-negative value', 'INVALID_RULE_THRESHOLD', 400);
    }
    setUpdates.threshold = paise;
  } else if (updateData.threshold !== undefined) {
    if (rule.ruleCode === 'HIGH_AMOUNT' && String(updateData.thresholdUnit).toUpperCase() === 'RUPEES') {
      const paise = toStoredPaise(updateData.threshold);
      if (paise < 0) {
        throw new FraudDashboardError('Monetary threshold must be a non-negative value', 'INVALID_RULE_THRESHOLD', 400);
      }
      setUpdates.threshold = paise;
    } else {
      const t = Number(updateData.threshold);
      if (Number.isNaN(t) || t < 0) {
        throw new FraudDashboardError('Field "threshold" must be a non-negative number', 'INVALID_RULE_THRESHOLD', 400);
      }
      setUpdates.threshold = Math.round(t);
    }
  }

  // 4. Update config
  if (updateData.config !== undefined) {
    if (typeof updateData.config !== 'object' || updateData.config === null) {
      throw new FraudDashboardError('Field "config" must be an object', 'INVALID_RULE_CONFIG', 400);
    }
    setUpdates.config = {
      ...(rule.config || {}),
      ...updateData.config
    };
  }

  // 5. Test proposed rule against validateRuleConfig
  const proposedRule = {
    ...rule,
    ...setUpdates
  };
  validateRuleConfig(proposedRule);

  // 6. Save update to MongoDB
  await collection.updateOne({ _id: rule._id }, { $set: setUpdates });

  // 7. Flush in-memory rule cache immediately
  clearRuleCache();

  // Return fresh document
  const updatedDoc = await collection.findOne({ _id: rule._id });
  return {
    ruleId: updatedDoc._id.toString(),
    ruleCode: updatedDoc.ruleCode,
    name: updatedDoc.name,
    description: updatedDoc.description,
    enabled: Boolean(updatedDoc.enabled),
    threshold: updatedDoc.threshold,
    thresholdInRupees: updatedDoc.ruleCode === 'HIGH_AMOUNT' && updatedDoc.threshold !== null && updatedDoc.threshold !== undefined ? Number(fromStoredPaise(updatedDoc.threshold)) : null,
    weight: updatedDoc.weight,
    config: updatedDoc.config || null,
    updatedAt: updatedDoc.updatedAt
  };
}

module.exports = {
  FraudDashboardError,
  hydrateBankingTransactions,
  getDashboardStats,
  listAlerts,
  getAlertDetails,
  createInvestigation,
  listInvestigations,
  getInvestigationDetails,
  updateInvestigation,
  listFraudRules,
  updateFraudRule
};
