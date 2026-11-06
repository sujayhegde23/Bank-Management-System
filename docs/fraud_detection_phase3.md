# Phase 3 — Fraud Detection Integration with Banking Transactions

**Repository:** `sujayhegde23/Bank-Management-System`  
**Branch:** `feature/fraud-phase-3-integration`  
**Date:** November 2026  
**Status:** Completed & Verified

---

## 1. Overview & Architectural Goals

Phase 3 establishes an asynchronous, resilient, and non-blocking integration bridge between core banking operations (MySQL) and the Phase 2 Rule-Based Fraud Detection Engine (MongoDB).

Every completed financial operation (`DEPOSIT`, `WITHDRAWAL`, `TRANSFER`) is reliably captured without introducing distributed two-phase commit overhead or endangering core banking performance and availability.

### Core Architectural Guarantees:
1. **Zero Dual-Write Hazard:** Outbox event insertion occurs inside the exact same atomic MySQL transaction as account balance updates and the `bank_transactions` audit ledger.
2. **MongoDB Independence & Isolation:** Core banking transactions succeed completely and instantaneously, even if MongoDB is completely offline, unreachable, or crashing.
3. **At-Least-Once Delivery & Idempotency:** Asynchronous background worker claims events using MySQL 8.0 `FOR UPDATE SKIP LOCKED` and evaluates them against the idempotent Phase 2 engine.
4. **No Lock Contention:** MySQL transactional row locks are released immediately after claim batch commit, before evaluating rules or calling MongoDB.
5. **Accurate Context Calculation:** `HIGH_VELOCITY` strictly excludes the evaluated transaction ID to avoid double-counting. `NEW_BENEFICIARY` verifies prior transfers directly against the MySQL ledger.

---

## 2. MySQL Transactional Outbox Schema

The table `fraud_outbox_events` was defined in `database/schema.sql` and initialized via `database/initOutbox.js`:

```sql
CREATE TABLE IF NOT EXISTS fraud_outbox_events (
    event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT NOT NULL UNIQUE,
    event_type VARCHAR(32) NOT NULL,
    payload JSON NOT NULL,
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at DATETIME NULL,
    locked_by VARCHAR(128) NULL,
    last_error VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_outbox_transaction FOREIGN KEY (transaction_id)
        REFERENCES bank_transactions (transaction_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    INDEX idx_outbox_poll (status, next_attempt_at),
    INDEX idx_outbox_lease (status, locked_at),
    INDEX idx_outbox_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Key Schema Properties & Retention Policy:
- **`transaction_id` UNIQUE & FK RESTRICT:** Strictly enforces an unalterable financial audit trail. Attempting to delete a parent row from `bank_transactions` when an outbox record references it is rejected with MySQL errno 1451 (`ER_ROW_IS_REFERENCED_2`). Financial outbox records cannot be silently pruned via cascade deletion.
- **Audit Retention Policy:** Fraud outbox events constitute permanent immutable records of asynchronous event delivery and risk evaluation. If historical ledger pruning is required during compliance archival, outbox records must be deliberately archived to audit cold storage in lockstep with transaction records.
- **`status` ENUM:** State machine: `PENDING` -> `PROCESSING` -> `COMPLETED` or `FAILED`.
- **`idx_outbox_poll (status, next_attempt_at)`:** High-speed index allowing workers to poll pending and retriable events without full table scans.
- **`idx_outbox_lease (status, locked_at)`:** High-speed index enabling quick detection and recovery of abandoned processing leases if a worker crashes.

---

## 3. Atomic Banking Transaction Integration

The helper `recordOutboxEvent(conn, { transactionId, eventType, payload })` in `backend/src/services/fraud/outboxRepository.js` was integrated into all financial pathways within `backend/src/services/transactionService.js`:

### 1. `executeDeposit`:
```javascript
// Insert unmodifiable transaction ledger entry (NFR-10, FR-18, FR-19)
const [insertResult] = await conn.execute(
  `INSERT INTO bank_transactions
    (transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks)
   VALUES (?, 'DEPOSIT', ?, NULL, ?, ?, ?)`,
  [transactionRef, normalizedAmount, accountId, performedByUserId, safeRemarks]
);

// Phase 3: Record fraud evaluation event in the same atomic MySQL transaction
await recordOutboxEvent(conn, {
  transactionId: insertResult.insertId,
  eventType: 'DEPOSIT',
  payload: {
    transactionId: insertResult.insertId,
    transactionRef,
    transactionType: 'DEPOSIT',
    amount: normalizedAmount,
    customerId: account.customer_id,
    accountId: account.account_id,
    destinationAccountId: null,
    performedByUserId,
    timestamp: new Date().toISOString()
  }
});
```

### 2. `executeWithdrawal`:
```javascript
const [insertResult] = await conn.execute(
  `INSERT INTO bank_transactions
    (transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks)
   VALUES (?, 'WITHDRAWAL', ?, ?, NULL, ?, ?)`,
  [transactionRef, normalizedAmount, accountId, performedByUserId, safeRemarks]
);

// Phase 3: Record fraud evaluation event in the same atomic MySQL transaction
await recordOutboxEvent(conn, {
  transactionId: insertResult.insertId,
  eventType: 'WITHDRAWAL',
  payload: {
    transactionId: insertResult.insertId,
    transactionRef,
    transactionType: 'WITHDRAWAL',
    amount: normalizedAmount,
    customerId: account.customer_id,
    accountId: account.account_id,
    destinationAccountId: null,
    performedByUserId,
    timestamp: new Date().toISOString()
  }
});
```

### 3. `executeTransfer`:
```javascript
const [insertResult] = await conn.execute(
  `INSERT INTO bank_transactions
    (transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks)
   VALUES (?, 'TRANSFER', ?, ?, ?, ?, ?)`,
  [transactionRef, normalizedAmount, srcId, resolvedDestId, performedByUserId, safeRemarks]
);

// Phase 3: Record fraud evaluation event in the same atomic MySQL transaction
await recordOutboxEvent(conn, {
  transactionId: insertResult.insertId,
  eventType: 'TRANSFER',
  payload: {
    transactionId: insertResult.insertId,
    transactionRef,
    transactionType: 'TRANSFER',
    amount: normalizedAmount,
    customerId: sourceAccount.customer_id,
    accountId: sourceAccount.account_id,
    destinationAccountId: resolvedDestId,
    performedByUserId,
    timestamp: new Date().toISOString()
  }
});
```

### Rollback Verification:
If balance debit fails, account lock fails, or any simulated failure occurs (`BEFORE_LEDGER_INSERT`, `AFTER_LEDGER_INSERT`), MySQL rolls back the entire transaction. Neither ledger nor outbox records are created.

---

## 4. Authoritative Transaction Context Provider

The service `backend/src/services/fraud/transactionContextProvider.js` queries MySQL directly to assemble authoritative fraud evaluation payloads:

1. **Transaction Identification:** Retrieves type, amount, timestamp, and derived customer ownership. Converts currency to integer paise using `toStoredPaise()`.
2. **`HIGH_VELOCITY` Context:**
   ```sql
   SELECT COUNT(*) AS count
   FROM bank_transactions
   WHERE (source_account_id = ? OR destination_account_id = ?)
     AND created_at >= (? - INTERVAL ? MINUTE)
     AND created_at <= ?
     AND transaction_id != ?
   ```
   - Sets `recentTransactionCount: count` and `includeCurrentTransaction: false`.
   - The Phase 2 evaluator detects `includeCurrentTransaction: false` and increments by 1 for the evaluated transaction, eliminating double-counting.
3. **`NEW_BENEFICIARY` Context:**
   ```sql
   SELECT COUNT(*) AS count
   FROM bank_transactions
   WHERE type = 'TRANSFER'
     AND source_account_id = ?
     AND destination_account_id = ?
     AND transaction_id != ?
     AND created_at <= ?
   ```
   - If count is 0: `isNewBeneficiary: true`. If count > 0: `isNewBeneficiary: false`.

---

## 5. Asynchronous Background Worker & Claiming Protocol

The background worker is implemented in `backend/src/services/fraud/fraudOutboxWorker.js`:

### 1. Atomic Event Claiming:
```sql
SELECT event_id, transaction_id, event_type, payload, attempt_count, created_at
FROM fraud_outbox_events
WHERE (status = 'PENDING' AND next_attempt_at <= NOW())
   OR (status = 'PROCESSING' AND locked_at < NOW() - INTERVAL ? SECOND)
ORDER BY next_attempt_at ASC, event_id ASC
LIMIT ?
FOR UPDATE SKIP LOCKED;

UPDATE fraud_outbox_events
SET status = 'PROCESSING',
    locked_at = NOW(),
    locked_by = ?,
    attempt_count = attempt_count + 1
WHERE event_id IN (?);
```
- The claiming transaction **commits immediately**, releasing all MySQL table/row locks before processing begins.
- Concurrent workers claim mutually exclusive sets of events without blocking each other.

### 2. Worker Lease Safety, Heartbeat Renewal & Ownership Enforcement:
- **Active Heartbeat Renewal:** When processing a batch or evaluating an event, the worker runs a background heartbeat timer at `leaseSeconds / 3` intervals (e.g. every 20s for a 60s lease) that executes:
  ```sql
  UPDATE fraud_outbox_events
  SET locked_at = NOW()
  WHERE event_id = ? AND locked_by = ? AND status = 'PROCESSING'
  ```
  This advances `locked_at` continuously while the worker is actively evaluating rules or awaiting MongoDB responses, preventing a second worker from prematurely reclaiming an in-flight event.
- **Strict Ownership Verification (`locked_by`):** Only the specific worker instance holding the active claim can renew, complete, or fail an event:
  - `markEventCompleted(eventId, workerId)` validates `locked_by = ? AND status = 'PROCESSING'`.
  - `markEventFailed(eventId, { workerId, ... })` validates `locked_by = ? AND status = 'PROCESSING'`.
- **Lost Ownership Prevention:** If MongoDB or rule evaluation stalls beyond the lease duration without heartbeat renewal and another worker reclaims the lease, the original worker detects `affectedRows === 0`. It halts its heartbeat and drops completion/failure updates, ensuring it never overwrites the new owner's state.
- **Abandoned Lease Recovery:** Events where a worker crashed or died without releasing its lock remain recoverable after `locked_at < NOW() - INTERVAL leaseSeconds SECOND`.
- **Graceful Shutdown Claim Release:** When the server or worker initiates graceful shutdown (`worker.stop()`), all uncompleted events claimed by that worker are immediately reverted back to `status = 'PENDING', locked_at = NULL, locked_by = NULL` so peer workers can process them without waiting for lease timeouts.

### 3. Error Handling & Controlled Backoff:
- **Permanent Errors** (`FraudValidationError`, `FraudConfigurationError`, `TXN_NOT_FOUND`):
  Immediately marked `FAILED` with sanitized error message; no futile retries.
- **Transient Errors** (MongoDB downtime, network timeout):
  Schedules retries using exponential backoff schedule `[0s, 30s, 2m, 10m, 30m]` up to `FRAUD_WORKER_MAX_ATTEMPTS` (5). If max attempts are reached, the event transitions to `FAILED`.
- **Error Sanitization:** All errors stored in `last_error` strip connection URIs (`mongodb://...`, `mysql://...`) and password query parameters before writing.

---

## 6. Operational Visibility & Diagnostics

The administrator endpoint `/api/diagnostics` was updated in `backend/src/routes/diagnostics.js` to report queue telemetry and worker health:
```json
{
  "fraudOutbox": {
    "pending": 0,
    "processing": 0,
    "completed": 12,
    "failed": 0,
    "total": 12,
    "oldestPendingAt": null,
    "worker": {
      "workerId": "worker-14220-4a81",
      "isRunning": true,
      "isProcessing": false,
      "enabled": true,
      "pollIntervalMs": 5000,
      "batchSize": 10,
      "leaseSeconds": 60,
      "maxAttempts": 5
    }
  }
}
```

---

## 7. Automated Test Suite Results

Comprehensive automated tests in `backend/tests/fraudOutboxIntegration.test.js`:

```text
Phase 3: Fraud Detection Integration & Transactional Outbox Suite
  1. Transactional Outbox, Atomicity & Retention Policy
    ✔ should record an outbox event atomically when executeDeposit succeeds
    ✔ should record an outbox event atomically when executeWithdrawal succeeds
    ✔ should record an outbox event atomically when executeTransfer succeeds
    ✔ should rollback outbox event if transaction fails before ledger insert (TC-10)
    ✔ should rollback outbox event if transaction fails after ledger insert (TC-10)
    ✔ should not create an outbox event when withdrawal is rejected for insufficient funds
    ✔ should prevent deleting a banking transaction referenced by an outbox event (ON DELETE RESTRICT)
  2. Transaction Context Provider
    ✔ should build authoritative transaction context for a deposit
    ✔ should accurately compute HIGH_VELOCITY count strictly excluding current transaction
    ✔ should detect NEW_BENEFICIARY = true for a first-time transfer between accounts
    ✔ should detect NEW_BENEFICIARY = false for a repeated transfer to known beneficiary
    ✔ should reject context building for non-existent transaction with permanent error
  3. Concurrency Safety, Event Claiming & Worker Lease Safety
    ✔ should claim pending events and update them to PROCESSING
    ✔ should partition events across concurrent workers without overlap (SKIP LOCKED)
    ✔ should allow an active worker to renew its lease
    ✔ should prevent a second worker from reclaiming an actively renewed lease
    ✔ should reclaim abandoned events after lease expiration
    ✔ should prevent a worker that lost ownership from completing another worker's claimed event
  4. Background Worker & Fraud Engine Integration
    ✔ should process pending low-risk deposit and mark COMPLETED with Mongo assessment
    ✔ should process high-risk transaction, create HIGH/CRITICAL alert in MongoDB, and mark COMPLETED
    ✔ should verify duplicate processing does not create duplicate fraud assessments or alerts (idempotency)
    ✔ should be idempotent: subsequent worker runs on empty or completed queue are no-ops
  5. Error Handling, Retries, & Sanitization
    ✔ should mark permanent validation error as FAILED without retrying
    ✔ should schedule next_attempt_at with exponential backoff on transient failure
    ✔ should transition to FAILED when attempt_count reaches maxAttempts
    ✔ should sanitize credentials and connection strings from error messages
  6. Failure Isolation & System Resiliency
    ✔ should allow banking transactions to succeed completely even if MongoDB is disconnected
  7. Diagnostics Route & Queue Telemetry
    ✔ should expose fraud outbox queue metrics and worker status to ADMIN

✔ All 28 tests pass cleanly (5477ms)
```

---

## 8. Full Regression Test Verification

| Test Suite | Result | Details |
| :--- | :--- | :--- |
| `fraudOutboxIntegration.test.js` | **PASS (28/28)** | Outbox atomicity, `ON DELETE RESTRICT`, heartbeat lease renewal, ownership protection |
| `fraudEngine.test.js` | **PASS (28/28)** | Phase 2 rule evaluation, integer paise precision |
| `mongoFoundation.test.js` | **PASS (9/9)** | Phase 1 schema validation, dual-database health |
| `secureTransfers.test.js` | **PASS (27/27)** | Fund transfers, beneficiary validation |
| `customerBalanceDisplay.test.js`| **PASS (24/24)** | Current vs available balances, account status |
| `accountStatements.test.js` | **PASS (15/15)** | Statements, ledger balance calculations, CSV/PDF |
| `customerProfileSecurity.test.js` | **PASS (11/11)** | Profile updates, diagnostics access restriction |
| `customerAccountIsolation.test.js` | **PASS (25/25)** | Horizontal privilege escalation protection across accounts |
| Frontend Build (`vite build`) | **PASS** | 0 errors (dist/assets/index-B47of80Q.js) |

---

## 9. Files Modified and Created

### Created Files:
1. `database/initOutbox.js`: Outbox schema DDL, migration to `ON DELETE RESTRICT`, and idempotent table initializer.
2. `backend/src/services/fraud/outboxRepository.js`: Atomic outbox recording, `SKIP LOCKED` batch claiming, lease renewal (`renewEventLease`), event release (`releaseClaimedEvents`), ownership verification, metrics, error sanitization.
3. `backend/src/services/fraud/transactionContextProvider.js`: Authoritative transaction details, anti-double-counting velocity calculation, beneficiary history querying.
4. `backend/src/services/fraud/fraudOutboxWorker.js`: Singleton worker with lease management, periodic heartbeat renewal, ownership verification, graceful shutdown claim release, exponential backoff, error classification, and batch draining.
5. `backend/tests/fraudOutboxIntegration.test.js`: 28 comprehensive automated tests.
6. `docs/fraud_detection_phase3.md`: This comprehensive implementation document.

### Modified Files:
1. `database/schema.sql`: Added `fraud_outbox_events` table DDL and indexes.
2. `backend/src/services/transactionService.js`: Integrated `recordOutboxEvent` inside the atomic database transaction for deposit, withdrawal, and transfer.
3. `backend/src/services/fraud/index.js`: Exported outbox repository, context provider, worker, and constants.
4. `backend/src/routes/diagnostics.js`: Added `fraudOutbox` metrics and worker status to admin telemetry.
5. `backend/src/server.js`: Added worker lifecycle hooks on server boot and graceful shutdown.
6. `backend/.env.example`: Added configuration template for `FRAUD_WORKER_*` variables.

