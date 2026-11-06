/**
 * ==============================================================================
 * Fraud Detection Engine - Asynchronous Outbox Background Worker (Phase 3)
 * ==============================================================================
 * Connects MySQL transactional outbox events to the Phase 2 fraud detection engine.
 *
 * Resilience & Reliability Architecture:
 * - Decoupled: Banking transactions commit completely independently of MongoDB.
 * - Concurrency Safe: Uses MySQL 8.0 `FOR UPDATE SKIP LOCKED` for claiming events.
 * - Lock Isolation: Releases MySQL row locks before performing MongoDB operations.
 * - Processing Leases & Heartbeat: Leases prevent stalled events if worker crashes.
 *   Active heartbeat renews the lease while an event is being actively processed.
 * - Ownership Integrity: Only the worker matching `locked_by` can renew or complete
 *   its claimed event, preventing workers from overwriting each other.
 * - Controlled Retries: Exponential backoff schedule [0s, 30s, 2m, 10m, 30m]
 *   capped at FRAUD_WORKER_MAX_ATTEMPTS before marking FAILED.
 * - Error Classification: Differentiates transient errors (network/database) from
 *   permanent validation errors.
 * - Sanitized Errors: Stored errors never contain credentials or connection strings.
 * ==============================================================================
 */

const crypto = require('crypto');
const {
  claimEvents,
  renewEventLease,
  releaseClaimedEvents,
  markEventCompleted,
  markEventFailed,
  getOutboxMetrics
} = require('./outboxRepository');
const { buildTransactionContext } = require('./transactionContextProvider');
const { evaluateTransaction } = require('./fraudDetectionService');
const { FraudValidationError, FraudConfigurationError } = require('./utils/errors');

// Retry backoff delays in milliseconds for attempts 1, 2, 3, 4, 5
const BACKOFF_SCHEDULE_MS = [
  0,               // Attempt 1 immediate
  30 * 1000,       // Attempt 2: 30 seconds
  2 * 60 * 1000,   // Attempt 3: 2 minutes
  10 * 60 * 1000,  // Attempt 4: 10 minutes
  30 * 60 * 1000   // Attempt 5: 30 minutes
];

class FraudOutboxWorker {
  constructor(options = {}) {
    this.workerId = options.workerId || `worker-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
    this.pollIntervalMs = parseInt(process.env.FRAUD_WORKER_POLL_INTERVAL_MS, 10) || options.pollIntervalMs || 5000;
    this.batchSize = parseInt(process.env.FRAUD_WORKER_BATCH_SIZE, 10) || options.batchSize || 10;
    this.leaseSeconds = parseInt(process.env.FRAUD_WORKER_LEASE_SECONDS, 10) || options.leaseSeconds || 60;
    this.maxAttempts = parseInt(process.env.FRAUD_WORKER_MAX_ATTEMPTS, 10) || options.maxAttempts || 5;
    this.enabled = process.env.FRAUD_WORKER_ENABLED !== 'false' && options.enabled !== false;

    // Heartbeat interval: run lease renewal every (leaseSeconds / 3) seconds (minimum 500ms)
    this.heartbeatIntervalMs = Math.max(500, options.heartbeatIntervalMs || Math.floor((this.leaseSeconds * 1000) / 3));

    this.timer = null;
    this.isRunning = false;
    this.isProcessing = false;
    this.activeBatchPromise = null;
  }

  /**
   * Starts the background worker polling loop.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    if (!this.enabled) {
      console.log(`[FraudWorker:${this.workerId}] Disabled via configuration (FRAUD_WORKER_ENABLED=false).`);
      return;
    }

    console.log(`[FraudWorker:${this.workerId}] Started with pollInterval=${this.pollIntervalMs}ms, batchSize=${this.batchSize}, lease=${this.leaseSeconds}s, heartbeat=${this.heartbeatIntervalMs}ms, maxAttempts=${this.maxAttempts}.`);

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        await this.processBatch();
      } catch (err) {
        console.error(`[FraudWorker:${this.workerId}] Unhandled error in polling cycle:`, err.message);
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(poll, this.pollIntervalMs);
        }
      }
    };

    // Schedule initial poll with a small initial jitter
    const initialDelay = Math.floor(Math.random() * 500) + 100;
    this.timer = setTimeout(poll, initialDelay);
  }

  /**
   * Gracefully stops the background worker, waiting for in-flight batches to finish,
   * and releasing any uncompleted claimed events back to PENDING.
   * @returns {Promise<void>}
   */
  async stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.activeBatchPromise) {
      console.log(`[FraudWorker:${this.workerId}] Waiting for in-flight batch to drain...`);
      await this.activeBatchPromise.catch(() => {});
    }

    // Release any lingering claims back to PENDING so other workers can process them immediately
    try {
      const releasedCount = await releaseClaimedEvents({ workerId: this.workerId });
      if (releasedCount > 0) {
        console.log(`[FraudWorker:${this.workerId}] Released ${releasedCount} unfinished event(s) back to PENDING on shutdown.`);
      }
    } catch (relErr) {
      console.warn(`[FraudWorker:${this.workerId}] Error releasing claims on shutdown:`, relErr.message);
    }

    console.log(`[FraudWorker:${this.workerId}] Stopped cleanly.`);
  }

  /**
   * Explicitly renews the lease on an event owned by this worker.
   * @param {number|string} eventId
   * @returns {Promise<boolean>}
   */
  async renewLease(eventId) {
    return await renewEventLease({ eventId, workerId: this.workerId });
  }

  /**
   * Processes a single batch of claimed outbox events with heartbeat lease renewal.
   * Can be called directly by scheduled loops or by integration test harnesses.
   *
   * @param {number} [customBatchSize]
   * @returns {Promise<{ processed: number, succeeded: number, failed: number }>}
   */
  async processBatch(customBatchSize) {
    if (this.isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0, skipped: true };
    }

    this.isProcessing = true;
    const batchSize = customBatchSize || this.batchSize;

    this.activeBatchPromise = (async () => {
      let claimedEvents = [];
      try {
        claimedEvents = await claimEvents({
          workerId: this.workerId,
          batchSize,
          leaseSeconds: this.leaseSeconds,
          maxAttempts: this.maxAttempts
        });
      } catch (err) {
        console.error(`[FraudWorker:${this.workerId}] Error claiming outbox events:`, err.message);
        return { processed: 0, succeeded: 0, failed: 0, error: err.message };
      }

      if (!claimedEvents || claimedEvents.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      let succeeded = 0;
      let failed = 0;

      for (const event of claimedEvents) {
        let heartbeatTimer = null;
        let lostOwnership = false;
        console.log(`[FraudWorker:${this.workerId}] Claimed outbox event #${event.eventId} (tx #${event.transactionId}, type: ${event.eventType}, attempt: ${event.attemptCount})`);

        // Start active heartbeat timer to renew the lease while processing MongoDB/rules
        heartbeatTimer = setInterval(async () => {
          try {
            const renewed = await renewEventLease({ eventId: event.eventId, workerId: this.workerId });
            if (!renewed) {
              lostOwnership = true;
              clearInterval(heartbeatTimer);
              heartbeatTimer = null;
            }
          } catch {}
        }, this.heartbeatIntervalMs);

        try {
          // 1. Build Authoritative Transaction & Context from MySQL
          const { transaction, context } = await buildTransactionContext(event.transactionId);
          console.log(`[FraudWorker:${this.workerId}] Loaded context for tx #${transaction.transactionId}: accountId=${transaction.accountId}, recentTxCount=${context.recentTransactionCount}, isNewBeneficiary=${context.isNewBeneficiary}`);

          // 2. Evaluate with Phase 2 Fraud Engine (idempotent, records assessment & alerts in MongoDB)
          const evalResult = await evaluateTransaction(transaction, context);

          // 3. Mark Outbox Event COMPLETED strictly verifying ownership
          if (!lostOwnership) {
            const completed = await markEventCompleted({ eventId: event.eventId, workerId: this.workerId });
            if (completed) {
              console.log(`[FraudWorker:${this.workerId}] Outbox event #${event.eventId} marked COMPLETED for tx #${event.transactionId} (score: ${evalResult.assessment?.riskScore}, level: ${evalResult.assessment?.riskLevel}).`);
              succeeded++;
            } else {
              console.warn(`[FraudWorker:${this.workerId}] Lost ownership of event #${event.eventId}; completed by another worker.`);
            }
          }
        } catch (err) {
          if (!lostOwnership) {
            failed++;
            const isPermanent = this._isPermanentError(err);
            const nextAttemptAt = this._calculateNextAttemptTime(event.attemptCount);

            console.warn(`[FraudWorker:${this.workerId}] Failed evaluating event #${event.eventId} (tx #${event.transactionId}, attempt ${event.attemptCount}): ${err.message}. Permanent: ${isPermanent}`);

            await markEventFailed({
              eventId: event.eventId,
              workerId: this.workerId,
              error: err,
              isPermanent,
              nextAttemptAt,
              maxAttempts: this.maxAttempts
            }).catch((markErr) => {
              console.error(`[FraudWorker:${this.workerId}] Error marking event #${event.eventId} failed:`, markErr.message);
            });
          }
        } finally {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        }
      }

      return {
        processed: claimedEvents.length,
        succeeded,
        failed
      };
    })();

    try {
      return await this.activeBatchPromise;
    } finally {
      this.isProcessing = false;
      this.activeBatchPromise = null;
    }
  }

  /**
   * Determines if an error is non-retriable (permanent) or transient.
   * @param {Error|any} err
   * @returns {boolean}
   * @private
   */
  _isPermanentError(err) {
    if (!err) return false;
    if (err.isPermanent === true) return true;
    if (err instanceof FraudValidationError) return true;
    if (err instanceof FraudConfigurationError) return true;
    if (err.code === 'TXN_NOT_FOUND') return true;
    if (err.code === 'INVALID_ACCOUNT_REFERENCE') return true;
    if (err.code === 'INVALID_CUSTOMER_REFERENCE') return true;
    return false;
  }

  /**
   * Computes the scheduled next attempt time based on attempt count.
   * @param {number} attemptCount
   * @returns {Date}
   * @private
   */
  _calculateNextAttemptTime(attemptCount) {
    const idx = Math.min(Math.max(1, attemptCount), BACKOFF_SCHEDULE_MS.length - 1);
    const delayMs = BACKOFF_SCHEDULE_MS[idx] || (30 * 1000);
    return new Date(Date.now() + delayMs);
  }

  /**
   * Returns worker runtime status and configuration for diagnostics.
   */
  getWorkerStatus() {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      enabled: this.enabled,
      pollIntervalMs: this.pollIntervalMs,
      batchSize: this.batchSize,
      leaseSeconds: this.leaseSeconds,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      maxAttempts: this.maxAttempts
    };
  }
}

// Singleton worker instance
const defaultWorker = new FraudOutboxWorker();

module.exports = {
  FraudOutboxWorker,
  fraudOutboxWorker: defaultWorker,
  BACKOFF_SCHEDULE_MS
};
