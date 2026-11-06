/**
 * ==============================================================================
 * Fraud Detection Engine - MySQL Transactional Outbox Repository (Phase 3)
 * ==============================================================================
 * Provides database access for the transactional outbox pattern.
 *
 * Guarantees:
 * 1. Atomicity: recordOutboxEvent executes within the same MySQL transaction
 *    connection as core banking operations (balance update & ledger insert).
 * 2. Concurrency Safety: claimEvents uses MySQL 8.0 `FOR UPDATE SKIP LOCKED`
 *    and commits immediately to release locks before processing.
 * 3. Deadlock & Leak Prevention: Leases allow orphaned events to be reclaimed
 *    safely after worker crashes or restarts.
 * 4. Lease Ownership & Safety: Active heartbeats renew leases; only the current
 *    owner matching `locked_by` can renew, complete, or fail claimed events.
 * 5. Retention Integrity: ON DELETE RESTRICT prevents cascade-deletion of outbox
 *    audit logs when banking transactions are referenced.
 * ==============================================================================
 */

const { pool, withTransaction } = require('../../config/db');

/**
 * Sanitizes an error message by stripping sensitive connection strings,
 * credentials, and secrets, and truncating to a safe database column length.
 *
 * @param {Error|string|any} error
 * @param {number} [maxLength=1000]
 * @returns {string}
 */
function sanitizeErrorMessage(error, maxLength = 1000) {
  if (!error) return 'Unknown error';
  let message = typeof error === 'string' ? error : (error.message || String(error));

  // Redact connection strings (e.g. mongodb://user:pass@host, mysql://...)
  message = message.replace(/(mongodb|mongodb\+srv|mysql|postgres):\/\/[^\s]+/gi, '$1://[REDACTED]');
  // Redact password or secret query parameters or key-values
  message = message.replace(/(password|passwd|pwd|secret|token)=([^&\s]+)/gi, '$1=[REDACTED]');

  if (message.length > maxLength) {
    message = message.substring(0, maxLength - 3) + '...';
  }

  return message;
}

/**
 * Records an event into the transactional outbox table.
 * MUST be called with the active transactional connection (conn) to guarantee atomicity.
 *
 * @param {import('mysql2/promise').Connection} conn - Active transactional database connection
 * @param {object} params
 * @param {number|string|bigint} params.transactionId - The bank_transactions.transaction_id
 * @param {string} params.eventType - 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER'
 * @param {object} params.payload - Minimal context payload for fraud evaluation
 * @returns {Promise<{ eventId: number, transactionId: number, eventType: string, status: string }>}
 */
async function recordOutboxEvent(conn, { transactionId, eventType, payload }) {
  if (!conn || typeof conn.execute !== 'function') {
    throw new Error('recordOutboxEvent requires an active database transaction connection');
  }
  if (!transactionId) {
    throw new Error('transactionId is required to record outbox event');
  }
  if (!eventType) {
    throw new Error('eventType is required to record outbox event');
  }

  const safePayload = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  const safeTxId = String(transactionId);
  const safeType = String(eventType).toUpperCase();

  const [result] = await conn.execute(
    `INSERT INTO fraud_outbox_events
      (transaction_id, event_type, payload, status, attempt_count, next_attempt_at)
     VALUES (?, ?, ?, 'PENDING', 0, NOW())`,
    [safeTxId, safeType, safePayload]
  );

  return {
    eventId: result.insertId,
    transactionId: Number(safeTxId),
    eventType: safeType,
    status: 'PENDING'
  };
}

/**
 * Atomically claims a batch of pending or retriable outbox events using MySQL 8.0 FOR UPDATE SKIP LOCKED.
 * Commits the claim immediately to release row locks before worker processing begins.
 *
 * @param {object} options
 * @param {string} options.workerId - Unique worker identifier
 * @param {number} [options.batchSize=10] - Maximum events to claim per batch
 * @param {number} [options.leaseSeconds=60] - Processing lease duration before event can be reclaimed
 * @param {number} [options.maxAttempts=5] - Maximum retry attempts
 * @returns {Promise<Array<{
 *   eventId: number,
 *   transactionId: number,
 *   eventType: string,
 *   payload: object,
 *   attemptCount: number,
 *   createdAt: string
 * }>>}
 */
async function claimEvents({
  workerId = 'worker-1',
  batchSize = 10,
  leaseSeconds = 60,
  maxAttempts = 5
} = {}) {
  const safeBatch = Math.max(1, Math.min(100, parseInt(batchSize, 10) || 10));
  const safeLease = Math.max(1, parseInt(leaseSeconds, 10) || 60);
  const safeMaxAttempts = Math.max(1, parseInt(maxAttempts, 10) || 5);
  const safeWorkerId = String(workerId).substring(0, 128);

  return await withTransaction(async (conn) => {
    // 1. Select eligible events with row-level lock skipping locked rows
    // Criteria:
    // a. PENDING and next_attempt_at is due
    // b. PROCESSING but locked_at expired past lease duration (abandoned lease recovery)
    const [rows] = await conn.execute(
      `SELECT event_id, transaction_id, event_type, payload, attempt_count, created_at
       FROM fraud_outbox_events
       WHERE (status = 'PENDING' AND next_attempt_at <= NOW())
          OR (status = 'PROCESSING' AND locked_at < NOW() - INTERVAL ? SECOND)
       ORDER BY next_attempt_at ASC, event_id ASC
       LIMIT ${safeBatch}
       FOR UPDATE SKIP LOCKED`,
      [safeLease]
    );

    if (!rows || rows.length === 0) {
      return [];
    }

    const eventIds = rows.map((r) => r.event_id);
    const placeholders = eventIds.map(() => '?').join(', ');

    // 2. Mark claimed rows as PROCESSING with active lease bound to workerId
    await conn.execute(
      `UPDATE fraud_outbox_events
       SET status = 'PROCESSING',
           locked_at = NOW(),
           locked_by = ?,
           attempt_count = attempt_count + 1
       WHERE event_id IN (${placeholders})`,
      [safeWorkerId, ...eventIds]
    );

    // 3. Return mapped claimed event objects
    return rows.map((row) => {
      let parsedPayload = {};
      try {
        parsedPayload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
      } catch {
        parsedPayload = {};
      }

      return {
        eventId: Number(row.event_id),
        transactionId: Number(row.transaction_id),
        eventType: row.event_type,
        payload: parsedPayload,
        attemptCount: Number(row.attempt_count) + 1,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
      };
    });
  });
}

/**
 * Renews the processing lease for an actively claimed event.
 * Strictly verifies that the caller matches `locked_by` and the event is still in PROCESSING.
 *
 * @param {object} params
 * @param {number|string} params.eventId - The outbox event ID
 * @param {string} params.workerId - The worker ID asserting ownership
 * @returns {Promise<boolean>} True if lease was successfully renewed; false if ownership was lost
 */
async function renewEventLease({ eventId, workerId }) {
  if (!eventId || !workerId) return false;
  const [result] = await pool.execute(
    `UPDATE fraud_outbox_events
     SET locked_at = NOW()
     WHERE event_id = ? AND locked_by = ? AND status = 'PROCESSING'`,
    [eventId, workerId]
  );
  return result.affectedRows > 0;
}

/**
 * Marks an outbox event as COMPLETED after successful fraud evaluation.
 * If workerId is provided, ownership is verified so a worker that lost its lease cannot
 * overwrite a subsequent worker's claim.
 *
 * @param {number|string|object} eventIdOrParams
 * @param {string} [maybeWorkerId]
 * @returns {Promise<boolean>}
 */
async function markEventCompleted(eventIdOrParams, maybeWorkerId) {
  let eventId;
  let workerId = null;

  if (eventIdOrParams && typeof eventIdOrParams === 'object') {
    eventId = eventIdOrParams.eventId;
    workerId = eventIdOrParams.workerId || null;
  } else {
    eventId = eventIdOrParams;
    workerId = maybeWorkerId || null;
  }

  let sql = `
    UPDATE fraud_outbox_events
    SET status = 'COMPLETED',
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL
    WHERE event_id = ?
  `;
  const params = [eventId];

  if (workerId) {
    sql += ` AND locked_by = ? AND status = 'PROCESSING'`;
    params.push(workerId);
  }

  const [result] = await pool.execute(sql, params);
  return result.affectedRows > 0;
}

/**
 * Marks an outbox event as FAILED or reschedules it for retry.
 * If workerId is provided, ownership is verified before modifying the event.
 *
 * @param {number|string|object} eventIdOrParams
 * @param {object} [options={}]
 * @returns {Promise<{ status: 'PENDING'|'FAILED', isTerminal: boolean, updated: boolean, lostOwnership?: boolean }>}
 */
async function markEventFailed(eventIdOrParams, options = {}) {
  let eventId;
  let workerId = null;
  let opts = options;

  if (eventIdOrParams && typeof eventIdOrParams === 'object') {
    eventId = eventIdOrParams.eventId;
    workerId = eventIdOrParams.workerId || null;
    opts = eventIdOrParams;
  } else {
    eventId = eventIdOrParams;
    workerId = options.workerId || null;
    opts = options;
  }

  const sanitized = sanitizeErrorMessage(opts.error);
  const isPermanent = opts.isPermanent === true;
  const maxAttempts = opts.maxAttempts || 5;

  let ownerClause = '';
  const ownerParams = [];
  if (workerId) {
    ownerClause = ` AND locked_by = ? AND status = 'PROCESSING'`;
    ownerParams.push(workerId);
  }

  if (isPermanent) {
    const [result] = await pool.execute(
      `UPDATE fraud_outbox_events
       SET status = 'FAILED',
           locked_at = NULL,
           locked_by = NULL,
           last_error = ?
       WHERE event_id = ?${ownerClause}`,
      [sanitized, eventId, ...ownerParams]
    );
    return { status: 'FAILED', isTerminal: true, updated: result.affectedRows > 0 };
  }

  // Check attempt_count and current owner
  const [rows] = await pool.execute(
    'SELECT attempt_count, locked_by, status FROM fraud_outbox_events WHERE event_id = ?',
    [eventId]
  );

  if (!rows || rows.length === 0) {
    return { status: 'FAILED', isTerminal: true, updated: false };
  }

  if (workerId && (rows[0].locked_by !== workerId || rows[0].status !== 'PROCESSING')) {
    // Worker lost ownership; do not overwrite another worker's claim
    return { status: rows[0].status, isTerminal: false, updated: false, lostOwnership: true };
  }

  const attemptCount = Number(rows[0].attempt_count) || 1;

  if (attemptCount >= maxAttempts) {
    const [result] = await pool.execute(
      `UPDATE fraud_outbox_events
       SET status = 'FAILED',
           locked_at = NULL,
           locked_by = NULL,
           last_error = ?
       WHERE event_id = ?${ownerClause}`,
      [sanitized, eventId, ...ownerParams]
    );
    return { status: 'FAILED', isTerminal: true, updated: result.affectedRows > 0 };
  }

  // Schedule retry
  const retryTime = opts.nextAttemptAt instanceof Date ? opts.nextAttemptAt : new Date(Date.now() + 30000);
  const [result] = await pool.execute(
    `UPDATE fraud_outbox_events
     SET status = 'PENDING',
         locked_at = NULL,
         locked_by = NULL,
         next_attempt_at = ?,
         last_error = ?
     WHERE event_id = ?${ownerClause}`,
    [retryTime, sanitized, eventId, ...ownerParams]
  );

  return { status: 'PENDING', isTerminal: false, updated: result.affectedRows > 0 };
}

/**
 * Releases claimed events back to PENDING state upon graceful worker shutdown.
 *
 * @param {object} params
 * @param {string} params.workerId - The worker ID whose active claims should be released
 * @returns {Promise<number>} Number of events released
 */
async function releaseClaimedEvents({ workerId }) {
  if (!workerId) return 0;
  const [result] = await pool.execute(
    `UPDATE fraud_outbox_events
     SET status = 'PENDING',
         locked_at = NULL,
         locked_by = NULL
     WHERE locked_by = ? AND status = 'PROCESSING'`,
    [workerId]
  );
  return result.affectedRows || 0;
}

/**
 * Retrieves an outbox event by transactionId.
 *
 * @param {number|string} transactionId
 * @returns {Promise<object|null>}
 */
async function getOutboxEventByTransactionId(transactionId) {
  const [rows] = await pool.execute(
    `SELECT event_id, transaction_id, event_type, payload, status, attempt_count,
            next_attempt_at, locked_at, locked_by, last_error, created_at, updated_at
     FROM fraud_outbox_events
     WHERE transaction_id = ?`,
    [transactionId]
  );
  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  let payload = {};
  try {
    payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {});
  } catch {}
  return {
    ...row,
    payload
  };
}

/**
 * Retrieves aggregate metrics of the outbox queue for administrative telemetry.
 *
 * @returns {Promise<{
 *   pending: number,
 *   processing: number,
 *   completed: number,
 *   failed: number,
 *   total: number,
 *   oldestPendingAt: string|null
 * }>}
 */
async function getOutboxMetrics() {
  const [rows] = await pool.execute(
    `SELECT status, COUNT(*) AS count
     FROM fraud_outbox_events
     GROUP BY status`
  );

  const metrics = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0,
    oldestPendingAt: null
  };

  if (Array.isArray(rows)) {
    for (const r of rows) {
      const cnt = Number(r.count) || 0;
      metrics.total += cnt;
      const st = String(r.status).toLowerCase();
      if (st in metrics) {
        metrics[st] = cnt;
      }
    }
  }

  // Query oldest pending timestamp if there are pending events
  if (metrics.pending > 0) {
    const [oldestRows] = await pool.execute(
      `SELECT MIN(created_at) AS oldest_pending
       FROM fraud_outbox_events
       WHERE status = 'PENDING'`
    );
    if (oldestRows && oldestRows[0]?.oldest_pending) {
      metrics.oldestPendingAt = new Date(oldestRows[0].oldest_pending).toISOString();
    }
  }

  return metrics;
}

module.exports = {
  recordOutboxEvent,
  claimEvents,
  renewEventLease,
  releaseClaimedEvents,
  markEventCompleted,
  markEventFailed,
  getOutboxEventByTransactionId,
  getOutboxMetrics,
  sanitizeErrorMessage
};
