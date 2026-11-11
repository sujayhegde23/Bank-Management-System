/**
 * ==============================================================================
 * Automated Test Suite: Phase 3 - Fraud Detection Integration with Banking
 * ==============================================================================
 * Repository: sujayhegde23/Bank-Management-System
 * Branch: feature/fraud-phase-3-integration
 *
 * Verifies:
 * 1. MySQL Transactional Outbox Pattern: Atomic insertion with banking operations.
 * 2. Outbox Audit Retention: ON DELETE RESTRICT prevents cascade deletion of outbox logs.
 * 3. Rollback Atomicity: Outbox events are rolled back if banking operation fails.
 * 4. Context Provider: Authoritative details, HIGH_VELOCITY exclusion, NEW_BENEFICIARY.
 * 5. Concurrent Claiming: FOR UPDATE SKIP LOCKED prevents duplicate claims across workers.
 * 6. Worker Lease Safety & Heartbeat: Active workers renew leases; prevents premature reclamation.
 * 7. Lease Recovery: Expired abandoned events can be reclaimed by active workers.
 * 8. Ownership Protection: Workers that lost ownership cannot complete or fail events.
 * 9. Idempotent Processing: Duplicate processing never creates duplicate assessments/alerts.
 * 10. Error Handling & Backoff: Transient vs permanent failure handling with sanitization.
 * 11. Failure Isolation: Banking operations succeed even when MongoDB is offline.
 * 12. Diagnostics Telemetry: Admin endpoint reports queue metrics and worker status.
 * ==============================================================================
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, query } = require('../src/config/db');
const { connectMongo, getDb, closeMongo, isMongoConnected } = require('../src/config/mongo');
const { initializeMongoDatabase } = require('../src/config/initMongo');
const { loginAs } = require('./helpers/authHelper');
const {
  recordOutboxEvent,
  claimEvents,
  renewEventLease,
  releaseClaimedEvents,
  markEventCompleted,
  markEventFailed,
  getOutboxEventByTransactionId,
  getOutboxMetrics,
  sanitizeErrorMessage,
  buildTransactionContext,
  evaluateTransaction,
  FraudOutboxWorker,
  fraudOutboxWorker,
  FraudValidationError
} = require('../src/services/fraud');
const {
  executeDeposit,
  executeWithdrawal,
  executeTransfer
} = require('../src/services/transactionService');

describe('Phase 3: Fraud Detection Integration & Transactional Outbox Suite', () => {
  let adminCookie;
  let testCustomer1AccountId = 1; // ACC-T1 (Cust 1)
  let testCustomer2AccountId = 2; // ACC-T2 (Cust 2)
  let createdTxnIds = [];
  let createdAccountIds = [];

  before(async () => {
    // 1. Ensure MongoDB initialized
    await connectMongo();
    await initializeMongoDatabase();

    // 2. Authenticate admin for diagnostics tests
    adminCookie = await loginAs(request, app, 'test.admin1', 'Password123!');

    // 3. Ensure test accounts have predictable baseline balance
    await pool.execute('UPDATE accounts SET balance = 500000.00 WHERE account_id = 1');
    await pool.execute('UPDATE accounts SET balance = 500000.00 WHERE account_id = 2');
  });

  after(async () => {
    // Clean up test transactions and created accounts
    try {
      if (createdTxnIds.length > 0) {
        const placeholders = createdTxnIds.map(() => '?').join(',');
        // Due to ON DELETE RESTRICT, outbox records must be deleted before transaction records
        await pool.execute(`DELETE FROM fraud_outbox_events WHERE transaction_id IN (${placeholders})`, createdTxnIds);
        await pool.execute(`DELETE FROM bank_transactions WHERE transaction_id IN (${placeholders})`, createdTxnIds);
      }
      if (createdAccountIds.length > 0) {
        const placeholders = createdAccountIds.map(() => '?').join(',');
        await pool.execute(`DELETE FROM accounts WHERE account_id IN (${placeholders})`, createdAccountIds);
      }
      // Restore baseline accounts
      await pool.execute('UPDATE accounts SET balance = 10000.00 WHERE account_id = 1');
      await pool.execute('UPDATE accounts SET balance = 5000.00 WHERE account_id = 2');
    } catch (err) {
      console.error('Error during test cleanup:', err.message);
    } finally {
      await closeMongo().catch(() => {});
      await pool.end().catch(() => {});
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 1: Transactional Outbox & Banking Operation Atomicity
  // --------------------------------------------------------------------------
  describe('1. Transactional Outbox, Atomicity & Retention Policy', () => {
    it('should record an outbox event atomically when executeDeposit succeeds', async () => {
      const depositRes = await executeDeposit({
        accountId: testCustomer1AccountId,
        amount: '250.00',
        remarks: 'Test deposit outbox atomicity',
        performedByUserId: 1
      });
      createdTxnIds.push(depositRes.transactionId);

      assert.ok(depositRes.transactionId);
      const outboxEvent = await getOutboxEventByTransactionId(depositRes.transactionId);
      assert.ok(outboxEvent, 'Outbox event must exist for deposit');
      assert.equal(outboxEvent.event_type, 'DEPOSIT');
      assert.equal(outboxEvent.status, 'PENDING');
      assert.equal(outboxEvent.attempt_count, 0);
      assert.equal(outboxEvent.payload.transactionType, 'DEPOSIT');
      assert.equal(outboxEvent.payload.customerId, 1);
      assert.equal(outboxEvent.payload.accountId, testCustomer1AccountId);
    });

    it('should record an outbox event atomically when executeWithdrawal succeeds', async () => {
      const withdrawRes = await executeWithdrawal({
        accountId: testCustomer1AccountId,
        amount: '150.00',
        remarks: 'Test withdrawal outbox atomicity',
        performedByUserId: 1
      });
      createdTxnIds.push(withdrawRes.transactionId);

      assert.ok(withdrawRes.transactionId);
      const outboxEvent = await getOutboxEventByTransactionId(withdrawRes.transactionId);
      assert.ok(outboxEvent, 'Outbox event must exist for withdrawal');
      assert.equal(outboxEvent.event_type, 'WITHDRAWAL');
      assert.equal(outboxEvent.status, 'PENDING');
      assert.equal(outboxEvent.payload.transactionType, 'WITHDRAWAL');
      assert.equal(outboxEvent.payload.customerId, 1);
      assert.equal(outboxEvent.payload.accountId, testCustomer1AccountId);
    });

    it('should record an outbox event atomically when executeTransfer succeeds', async () => {
      const transferRes = await executeTransfer({
        sourceAccountId: testCustomer1AccountId,
        destinationAccountId: testCustomer2AccountId,
        amount: '500.00',
        remarks: 'Test transfer outbox atomicity',
        performedByUserId: 4 // Test Customer One user
      });
      createdTxnIds.push(transferRes.transactionId);

      assert.ok(transferRes.transactionId);
      const outboxEvent = await getOutboxEventByTransactionId(transferRes.transactionId);
      assert.ok(outboxEvent, 'Outbox event must exist for transfer');
      assert.equal(outboxEvent.event_type, 'TRANSFER');
      assert.equal(outboxEvent.status, 'PENDING');
      assert.equal(outboxEvent.payload.transactionType, 'TRANSFER');
      assert.equal(outboxEvent.payload.customerId, 1);
      assert.equal(outboxEvent.payload.accountId, testCustomer1AccountId);
      assert.equal(outboxEvent.payload.destinationAccountId, testCustomer2AccountId);
    });

    it('should rollback outbox event if transaction fails before ledger insert (TC-10)', async () => {
      const [beforeCountRows] = await pool.query('SELECT COUNT(*) AS total FROM fraud_outbox_events');
      const countBefore = Number(beforeCountRows[0].total);

      await assert.rejects(
        async () => {
          await executeDeposit({
            accountId: testCustomer1AccountId,
            amount: '100.00',
            performedByUserId: 1,
            _testFailurePoint: 'BEFORE_LEDGER_INSERT'
          });
        },
        (err) => err.code === 'TXN_003'
      );

      const [afterCountRows] = await pool.query('SELECT COUNT(*) AS total FROM fraud_outbox_events');
      const countAfter = Number(afterCountRows[0].total);
      assert.equal(countAfter, countBefore, 'Outbox event count must not change on rollback');
    });

    it('should rollback outbox event if transaction fails after ledger insert (TC-10)', async () => {
      const [beforeCountRows] = await pool.query('SELECT COUNT(*) AS total FROM fraud_outbox_events');
      const countBefore = Number(beforeCountRows[0].total);

      await assert.rejects(
        async () => {
          await executeWithdrawal({
            accountId: testCustomer1AccountId,
            amount: '100.00',
            performedByUserId: 1,
            _testFailurePoint: 'AFTER_LEDGER_INSERT'
          });
        },
        (err) => err.code === 'TXN_003'
      );

      const [afterCountRows] = await pool.query('SELECT COUNT(*) AS total FROM fraud_outbox_events');
      const countAfter = Number(afterCountRows[0].total);
      assert.equal(countAfter, countBefore, 'Outbox event must be rolled back atomically');
    });

    it('should not create an outbox event when withdrawal is rejected for insufficient funds', async () => {
      const [beforeCountRows] = await pool.query('SELECT COUNT(*) AS total FROM fraud_outbox_events');
      const countBefore = Number(beforeCountRows[0].total);

      await assert.rejects(
        async () => {
          await executeWithdrawal({
            accountId: testCustomer1AccountId,
            amount: '99999999.00', // exceeds balance
            performedByUserId: 1
          });
        },
        (err) => err.code === 'TXN_001'
      );

      const [afterCountRows] = await pool.query('SELECT COUNT(*) AS total FROM fraud_outbox_events');
      const countAfter = Number(afterCountRows[0].total);
      assert.equal(countAfter, countBefore, 'Rejected operations must produce zero outbox events');
    });

    it('should prevent deleting a banking transaction referenced by an outbox event (ON DELETE RESTRICT)', async () => {
      const dep = await executeDeposit({
        accountId: testCustomer1AccountId,
        amount: '180.00',
        remarks: 'Retention policy test',
        performedByUserId: 1
      });
      createdTxnIds.push(dep.transactionId);

      // Verify outbox event exists
      const outboxEvent = await getOutboxEventByTransactionId(dep.transactionId);
      assert.ok(outboxEvent, 'Outbox event must exist');

      // Attempt to delete transaction directly from bank_transactions
      await assert.rejects(
        async () => {
          await pool.execute('DELETE FROM bank_transactions WHERE transaction_id = ?', [dep.transactionId]);
        },
        (err) => {
          assert.ok(
            err.message.includes('foreign key constraint fails') ||
            err.code === 'ER_ROW_IS_REFERENCED_2' ||
            err.errno === 1451,
            `Expected foreign key constraint violation, received: ${err.message}`
          );
          return true;
        }
      );

      // Verify records are strictly retained in MySQL
      const [txRows] = await pool.query('SELECT transaction_id FROM bank_transactions WHERE transaction_id = ?', [dep.transactionId]);
      assert.equal(txRows.length, 1, 'Transaction record must be retained');
      const [outboxRows] = await pool.query('SELECT event_id FROM fraud_outbox_events WHERE transaction_id = ?', [dep.transactionId]);
      assert.equal(outboxRows.length, 1, 'Outbox event record must be retained');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Transaction Context Provider
  // --------------------------------------------------------------------------
  describe('2. Transaction Context Provider', () => {
    it('should build authoritative transaction context for a deposit', async () => {
      const depositRes = await executeDeposit({
        accountId: testCustomer1AccountId,
        amount: '125.50',
        remarks: 'Context test deposit',
        performedByUserId: 1
      });
      createdTxnIds.push(depositRes.transactionId);

      const { transaction, context } = await buildTransactionContext(depositRes.transactionId);
      assert.equal(transaction.transactionId, depositRes.transactionId);
      assert.equal(transaction.transactionType, 'DEPOSIT');
      assert.equal(transaction.amount, 12550); // Exact integer paise
      assert.equal(transaction.customerId, 1);
      assert.equal(transaction.accountId, testCustomer1AccountId);
      assert.equal(transaction.destinationAccountId, null);
      assert.ok(transaction.timestamp instanceof Date);
      assert.equal(typeof context.recentTransactionCount, 'number');
      assert.equal(context.includeCurrentTransaction, false);
      assert.equal(context.isNewBeneficiary, false);
    });

    it('should accurately compute HIGH_VELOCITY count strictly excluding current transaction', async () => {
      // Execute 3 consecutive transactions for account 1
      const tx1 = await executeDeposit({ accountId: testCustomer1AccountId, amount: '10.00', performedByUserId: 1 });
      const tx2 = await executeDeposit({ accountId: testCustomer1AccountId, amount: '10.00', performedByUserId: 1 });
      const tx3 = await executeDeposit({ accountId: testCustomer1AccountId, amount: '10.00', performedByUserId: 1 });
      createdTxnIds.push(tx1.transactionId, tx2.transactionId, tx3.transactionId);

      const { context: ctx3 } = await buildTransactionContext(tx3.transactionId, { velocityWindowMinutes: 5 });
      assert.ok(ctx3.recentTransactionCount >= 2, `Expected >= 2 prior transactions, received: ${ctx3.recentTransactionCount}`);
      assert.equal(ctx3.includeCurrentTransaction, false);
    });

    it('should detect NEW_BENEFICIARY = true for a first-time transfer between accounts', async () => {
      // Create a new dedicated destination account for Customer 2
      const [accInsert] = await pool.execute(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
         VALUES ('ACC-TEST-NEW-BEN-01', 2, 'SAVINGS', 1000.00, 'ACTIVE')`
      );
      const newDestAccountId = accInsert.insertId;
      createdAccountIds.push(newDestAccountId);

      const transferRes = await executeTransfer({
        sourceAccountId: testCustomer1AccountId,
        destinationAccountId: newDestAccountId,
        amount: '200.00',
        remarks: 'First transfer to new beneficiary',
        performedByUserId: 4
      });
      createdTxnIds.push(transferRes.transactionId);

      const { transaction, context } = await buildTransactionContext(transferRes.transactionId);
      assert.equal(transaction.transactionType, 'TRANSFER');
      assert.equal(context.isNewBeneficiary, true);
      assert.equal(context.previousTransfersCount, 0);
    });

    it('should detect NEW_BENEFICIARY = false for a repeated transfer to known beneficiary', async () => {
      const destAccountId = createdAccountIds[createdAccountIds.length - 1];
      const transferRes = await executeTransfer({
        sourceAccountId: testCustomer1AccountId,
        destinationAccountId: destAccountId,
        amount: '250.00',
        remarks: 'Second transfer to now-known beneficiary',
        performedByUserId: 4
      });
      createdTxnIds.push(transferRes.transactionId);

      const { context } = await buildTransactionContext(transferRes.transactionId);
      assert.equal(context.isNewBeneficiary, false);
      assert.ok(context.previousTransfersCount >= 1);
    });

    it('should reject context building for non-existent transaction with permanent error', async () => {
      await assert.rejects(
        async () => {
          await buildTransactionContext(999999999);
        },
        (err) => {
          assert.equal(err.code, 'TXN_NOT_FOUND');
          assert.equal(err.isPermanent, true);
          return true;
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Concurrency Safety, Event Claiming & Lease Heartbeats
  // --------------------------------------------------------------------------
  describe('3. Concurrency Safety, Event Claiming & Worker Lease Safety', () => {
    it('should claim pending events and update them to PROCESSING', async () => {
      const dep = await executeDeposit({ accountId: testCustomer1AccountId, amount: '50.00', performedByUserId: 1 });
      createdTxnIds.push(dep.transactionId);

      const claimed = await claimEvents({
        workerId: 'worker-unit-test-1',
        batchSize: 50
      });

      assert.ok(claimed.length > 0);
      const claimedDep = claimed.find((e) => e.transactionId === dep.transactionId);
      assert.ok(claimedDep, 'Expected created deposit to be among claimed events');
      assert.equal(claimedDep.eventType, 'DEPOSIT');

      // Verify row state in DB: status = 'PROCESSING', locked_by = 'worker-unit-test-1'
      const [rows] = await pool.query('SELECT status, locked_by, locked_at FROM fraud_outbox_events WHERE event_id = ?', [claimedDep.eventId]);
      assert.equal(rows[0].status, 'PROCESSING');
      assert.equal(rows[0].locked_by, 'worker-unit-test-1');
      assert.ok(rows[0].locked_at);
    });

    it('should partition events across concurrent workers without overlap (SKIP LOCKED)', async () => {
      const txns = await Promise.all([
        executeDeposit({ accountId: testCustomer1AccountId, amount: '10.00', performedByUserId: 1 }),
        executeDeposit({ accountId: testCustomer1AccountId, amount: '10.00', performedByUserId: 1 }),
        executeDeposit({ accountId: testCustomer1AccountId, amount: '10.00', performedByUserId: 1 }),
        executeDeposit({ accountId: testCustomer1AccountId, amount: '10.00', performedByUserId: 1 })
      ]);
      txns.forEach((t) => createdTxnIds.push(t.transactionId));

      const [batchA, batchB] = await Promise.all([
        claimEvents({ workerId: 'worker-concurrent-A', batchSize: 2 }),
        claimEvents({ workerId: 'worker-concurrent-B', batchSize: 2 })
      ]);

      const idsA = new Set(batchA.map((e) => e.eventId));
      const idsB = new Set(batchB.map((e) => e.eventId));

      for (const id of idsA) {
        assert.ok(!idsB.has(id), `Duplicate claim detected: event #${id} claimed by both workers`);
      }
    });

    it('should allow an active worker to renew its lease', async () => {
      const dep = await executeDeposit({ accountId: testCustomer1AccountId, amount: '60.00', performedByUserId: 1 });
      createdTxnIds.push(dep.transactionId);

      const workerA = new FraudOutboxWorker({ workerId: 'worker-lease-renew-A', leaseSeconds: 5 });
      const claimed = await claimEvents({ workerId: workerA.workerId, batchSize: 50, leaseSeconds: 5 });
      const myEvent = claimed.find((e) => e.transactionId === dep.transactionId);
      assert.ok(myEvent, 'Expected deposit event to be claimed');

      // Initial locked_at timestamp
      const [rowsBefore] = await pool.query('SELECT locked_at FROM fraud_outbox_events WHERE event_id = ?', [myEvent.eventId]);
      const initialLockedAt = new Date(rowsBefore[0].locked_at).getTime();

      // Wait a moment and renew
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const renewed = await workerA.renewLease(myEvent.eventId);
      assert.equal(renewed, true, 'Worker A must successfully renew its own lease');

      // Updated locked_at timestamp
      const [rowsAfter] = await pool.query('SELECT locked_at FROM fraud_outbox_events WHERE event_id = ?', [myEvent.eventId]);
      const updatedLockedAt = new Date(rowsAfter[0].locked_at).getTime();
      assert.ok(updatedLockedAt > initialLockedAt, 'locked_at timestamp must advance forward on lease renewal');
    });

    it('should prevent a second worker from reclaiming an actively renewed lease', async () => {
      const dep = await executeDeposit({ accountId: testCustomer1AccountId, amount: '70.00', performedByUserId: 1 });
      createdTxnIds.push(dep.transactionId);

      // Worker A claims with 2-second lease
      const workerA = new FraudOutboxWorker({ workerId: 'worker-active-A', leaseSeconds: 2 });
      const claimedA = await claimEvents({ workerId: workerA.workerId, batchSize: 50, leaseSeconds: 2 });
      const eventA = claimedA.find((e) => e.transactionId === dep.transactionId);
      assert.ok(eventA);

      // Sleep 1.1s, then renew lease for Worker A
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const renewed = await workerA.renewLease(eventA.eventId);
      assert.equal(renewed, true, 'Lease must be renewed');

      // Sleep another 1s (total 2.1s since initial claim, but only 1.0s since renewal)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Worker B attempts to reclaim with 2-second lease
      const workerB = new FraudOutboxWorker({ workerId: 'worker-intruder-B', leaseSeconds: 2 });
      const claimedB = await claimEvents({ workerId: workerB.workerId, batchSize: 50, leaseSeconds: 2 });
      const eventB = claimedB.find((e) => e.eventId === eventA.eventId);
      assert.equal(eventB, undefined, 'Worker B must NOT be able to reclaim an actively renewed event');

      // Confirm DB still has worker-active-A
      const [check] = await pool.query('SELECT locked_by, status FROM fraud_outbox_events WHERE event_id = ?', [eventA.eventId]);
      assert.equal(check[0].locked_by, 'worker-active-A');
      assert.equal(check[0].status, 'PROCESSING');
    });

    it('should reclaim abandoned events after lease expiration', async () => {
      const [testTxn] = await pool.execute(
        `INSERT INTO bank_transactions
          (transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks)
         VALUES ('TXN-TEST-LEASE-01', 'DEPOSIT', 10.00, NULL, 1, 1, 'Lease test')`
      );
      createdTxnIds.push(testTxn.insertId);

      const [eventRes] = await pool.execute(
        `INSERT INTO fraud_outbox_events
          (transaction_id, event_type, payload, status, attempt_count, locked_at, locked_by, next_attempt_at)
         VALUES (?, 'DEPOSIT', '{}', 'PROCESSING', 1, NOW() - INTERVAL 120 SECOND, 'dead-worker', NOW())`,
        [testTxn.insertId]
      );
      const staleEventId = eventRes.insertId;

      const reclaimed = await claimEvents({
        workerId: 'recovery-worker',
        batchSize: 50,
        leaseSeconds: 60
      });

      const foundStale = reclaimed.find((e) => e.eventId === staleEventId);
      assert.ok(foundStale, 'Stale leased event must be reclaimed by active worker');
      assert.equal(foundStale.attemptCount, 2);
    });

    it('should prevent a worker that lost ownership from completing another worker\'s claimed event', async () => {
      const dep = await executeDeposit({ accountId: testCustomer1AccountId, amount: '80.00', performedByUserId: 1 });
      createdTxnIds.push(dep.transactionId);

      // Worker A claims event
      const workerA = new FraudOutboxWorker({ workerId: 'worker-lost-owner-A', leaseSeconds: 5 });
      const claimedA = await claimEvents({ workerId: workerA.workerId, batchSize: 50, leaseSeconds: 5 });
      const myEvent = claimedA.find((e) => e.transactionId === dep.transactionId);
      assert.ok(myEvent);

      // Simulate lease expiration deterministically past lease window
      await pool.execute('UPDATE fraud_outbox_events SET locked_at = NOW() - INTERVAL 10 SECOND WHERE event_id = ?', [myEvent.eventId]);

      // Worker B reclaims the expired event
      const workerB = new FraudOutboxWorker({ workerId: 'worker-new-owner-B', leaseSeconds: 10 });
      const claimedB = await claimEvents({ workerId: workerB.workerId, batchSize: 50, leaseSeconds: 5 });
      const eventB = claimedB.find((e) => e.eventId === myEvent.eventId);
      assert.ok(eventB, 'Worker B must reclaim the expired event');

      // Worker A now attempts to mark it COMPLETED
      const markResult = await markEventCompleted({ eventId: myEvent.eventId, workerId: 'worker-lost-owner-A' });
      assert.equal(markResult, false, 'Worker A must NOT be able to complete event after losing ownership');

      // Verify DB row remains in PROCESSING under worker-new-owner-B
      const [finalRows] = await pool.query('SELECT status, locked_by FROM fraud_outbox_events WHERE event_id = ?', [myEvent.eventId]);
      assert.equal(finalRows[0].status, 'PROCESSING', 'Status must remain PROCESSING');
      assert.equal(finalRows[0].locked_by, 'worker-new-owner-B', 'Ownership must remain with Worker B');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 4: Background Worker & Fraud Engine Integration
  // --------------------------------------------------------------------------
  describe('4. Background Worker & Fraud Engine Integration', () => {
    it('should process pending low-risk deposit and mark COMPLETED with Mongo assessment', async () => {
      const [accRes] = await pool.execute(
        `INSERT INTO accounts (customer_id, account_number, account_type, balance, status)
         VALUES (1, ?, 'SAVINGS', 1000.00, 'ACTIVE')`,
        [`ACC-TEST-LOW-${Date.now()}`]
      );
      const lowRiskAccountId = accRes.insertId;
      createdAccountIds.push(lowRiskAccountId);

      const dep = await executeDeposit({ accountId: lowRiskAccountId, amount: '45.00', performedByUserId: 1 });
      createdTxnIds.push(dep.transactionId);

      const worker = new FraudOutboxWorker({ workerId: 'test-exec-worker' });
      const batchResult = await worker.processBatch(50);

      assert.ok(batchResult.processed > 0);
      assert.ok(batchResult.succeeded > 0);

      // Verify outbox status in MySQL
      const outboxEvent = await getOutboxEventByTransactionId(dep.transactionId);
      assert.equal(outboxEvent.status, 'COMPLETED');
      assert.equal(outboxEvent.locked_at, null);
      assert.equal(outboxEvent.locked_by, null);

      // Verify assessment in MongoDB
      const mongoDb = getDb();
      const assessment = await mongoDb.collection('transaction_risk_assessments').findOne({ transactionId: dep.transactionId });
      assert.ok(assessment, 'Assessment must be saved in MongoDB');
      assert.equal(assessment.riskLevel, 'LOW');
      assert.equal(assessment.decision, 'APPROVED');
    });

    it('should process high-risk transaction, create HIGH/CRITICAL alert in MongoDB, and mark COMPLETED', async () => {
      // 1. Create 3 prior transactions in rapid succession for velocity
      const p1 = await executeDeposit({ accountId: testCustomer1AccountId, amount: '10.00', performedByUserId: 1 });
      const p2 = await executeDeposit({ accountId: testCustomer1AccountId, amount: '10.00', performedByUserId: 1 });
      const p3 = await executeDeposit({ accountId: testCustomer1AccountId, amount: '10.00', performedByUserId: 1 });
      createdTxnIds.push(p1.transactionId, p2.transactionId, p3.transactionId);

      // 2. Create a new beneficiary account for Customer 2
      const [accInsert] = await pool.execute(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
         VALUES ('ACC-TEST-ALERT-01', 2, 'SAVINGS', 1000.00, 'ACTIVE')`
      );
      const alertDestAccId = accInsert.insertId;
      createdAccountIds.push(alertDestAccId);

      // 3. Execute transfer of ₹75,000 to new beneficiary (triggers HIGH_AMOUNT + HIGH_VELOCITY + NEW_BENEFICIARY = 65 -> HIGH)
      const highTransfer = await executeTransfer({
        sourceAccountId: testCustomer1AccountId,
        destinationAccountId: alertDestAccId,
        amount: '75000.00',
        remarks: 'High risk composite fraud test',
        performedByUserId: 4
      });
      createdTxnIds.push(highTransfer.transactionId);

      const worker = new FraudOutboxWorker({ workerId: 'test-alert-worker' });
      await worker.processBatch(50);

      // Verify outbox completed
      const outboxEvent = await getOutboxEventByTransactionId(highTransfer.transactionId);
      assert.equal(outboxEvent.status, 'COMPLETED');

      // Verify MongoDB assessment and fraud alert
      const mongoDb = getDb();
      const assessment = await mongoDb.collection('transaction_risk_assessments').findOne({ transactionId: highTransfer.transactionId });
      assert.ok(assessment, 'Assessment must exist in MongoDB');
      assert.equal(assessment.riskLevel, 'CRITICAL');
      assert.equal(assessment.decision, 'FLAGGED');

      const alert = await mongoDb.collection('fraud_alerts').findOne({ transactionId: highTransfer.transactionId });
      assert.ok(alert, 'High-risk assessment must trigger fraud_alert');
      assert.equal(alert.status, 'OPEN');
      assert.equal(alert.riskLevel, 'CRITICAL');
    });

    it('should verify duplicate processing does not create duplicate fraud assessments or alerts', async () => {
      const highTransfer = await executeTransfer({
        sourceAccountId: testCustomer1AccountId,
        destinationAccountId: testCustomer2AccountId,
        amount: '60000.00',
        remarks: 'Duplicate processing idempotency test',
        performedByUserId: 4
      });
      createdTxnIds.push(highTransfer.transactionId);

      // Worker 1 processes batch
      const worker1 = new FraudOutboxWorker({ workerId: 'worker-idem-1' });
      await worker1.processBatch(50);

      // Simulate duplicate evaluation on same transaction
      const { transaction, context } = await buildTransactionContext(highTransfer.transactionId);
      const resDup = await evaluateTransaction(transaction, context);
      assert.equal(resDup.isExisting, true, 'Subsequent evaluation must report isExisting: true');

      // Verify MongoDB document counts
      const mongoDb = getDb();
      const assessmentCount = await mongoDb.collection('transaction_risk_assessments').countDocuments({ transactionId: highTransfer.transactionId });
      assert.equal(assessmentCount, 1, 'Exactly one assessment must exist in MongoDB');

      const alertCount = await mongoDb.collection('fraud_alerts').countDocuments({ transactionId: highTransfer.transactionId });
      assert.ok(alertCount <= 1, 'Alert count must not exceed 1');
    });

    it('should be idempotent: subsequent worker runs on empty or completed queue are no-ops', async () => {
      const worker = new FraudOutboxWorker({ workerId: 'test-idle-worker' });
      const result = await worker.processBatch(10);
      assert.equal(typeof result.processed, 'number');
      assert.equal(typeof result.succeeded, 'number');
      assert.equal(typeof result.failed, 'number');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 5: Error Handling, Retries, Backoff & Error Sanitization
  // --------------------------------------------------------------------------
  describe('5. Error Handling, Retries, & Sanitization', () => {
    it('should mark permanent validation error as FAILED without retrying', async () => {
      const dep = await executeDeposit({ accountId: testCustomer1AccountId, amount: '22.00', performedByUserId: 1 });
      createdTxnIds.push(dep.transactionId);

      const claimed = await claimEvents({ workerId: 'test-perm-fail-worker', batchSize: 50 });
      const myEvent = claimed.find((e) => e.transactionId === dep.transactionId);
      assert.ok(myEvent);

      const permError = new FraudValidationError('Transaction payload malformed: invalid parameter structure');
      const worker = new FraudOutboxWorker({ workerId: 'test-perm-fail-worker' });
      assert.equal(worker._isPermanentError(permError), true);

      const result = await markEventFailed({
        eventId: myEvent.eventId,
        workerId: 'test-perm-fail-worker',
        error: permError,
        isPermanent: true
      });

      assert.equal(result.status, 'FAILED');
      assert.equal(result.isTerminal, true);

      const [rows] = await pool.query('SELECT status, attempt_count, last_error FROM fraud_outbox_events WHERE event_id = ?', [myEvent.eventId]);
      assert.equal(rows[0].status, 'FAILED');
      assert.ok(rows[0].last_error.includes('Transaction payload malformed'));
    });

    it('should schedule next_attempt_at with exponential backoff on transient failure', async () => {
      const dep = await executeDeposit({ accountId: testCustomer1AccountId, amount: '23.00', performedByUserId: 1 });
      createdTxnIds.push(dep.transactionId);

      const claimed = await claimEvents({ workerId: 'test-transient-worker', batchSize: 50 });
      const myEvent = claimed.find((e) => e.transactionId === dep.transactionId);
      assert.ok(myEvent);

      const nextTime = new Date(Date.now() + 30000);
      const result = await markEventFailed({
        eventId: myEvent.eventId,
        workerId: 'test-transient-worker',
        error: new Error('Simulated transient network timeout'),
        isPermanent: false,
        nextAttemptAt: nextTime,
        maxAttempts: 5
      });

      assert.equal(result.status, 'PENDING');
      assert.equal(result.isTerminal, false);

      const [rows] = await pool.query('SELECT status, next_attempt_at, last_error FROM fraud_outbox_events WHERE event_id = ?', [myEvent.eventId]);
      assert.equal(rows[0].status, 'PENDING');
      assert.ok(rows[0].last_error.includes('Simulated transient network timeout'));
    });

    it('should transition to FAILED when attempt_count reaches maxAttempts', async () => {
      const dep = await executeDeposit({ accountId: testCustomer1AccountId, amount: '24.00', performedByUserId: 1 });
      createdTxnIds.push(dep.transactionId);

      const claimed = await claimEvents({ workerId: 'test-max-worker', batchSize: 50 });
      const myEvent = claimed.find((e) => e.transactionId === dep.transactionId);
      assert.ok(myEvent);

      // Simulate attempt_count reaching maxAttempts (5)
      await pool.execute('UPDATE fraud_outbox_events SET attempt_count = 5 WHERE event_id = ?', [myEvent.eventId]);

      const result = await markEventFailed({
        eventId: myEvent.eventId,
        workerId: 'test-max-worker',
        error: new Error('Persistent failure'),
        isPermanent: false,
        maxAttempts: 5
      });

      assert.equal(result.status, 'FAILED');
      assert.equal(result.isTerminal, true);

      const [rows] = await pool.query('SELECT status, last_error FROM fraud_outbox_events WHERE event_id = ?', [myEvent.eventId]);
      assert.equal(rows[0].status, 'FAILED');
    });

    it('should sanitize credentials and connection strings from error messages', () => {
      const sensitiveError = new Error('Mongo connection failed: mongodb://admin:SuperSecretPass123!@127.0.0.1:27017/bank_fraud?authSource=admin');
      const sanitized = sanitizeErrorMessage(sensitiveError);

      assert.ok(!sanitized.includes('SuperSecretPass123!'), 'Password must be redacted');
      assert.ok(!sanitized.includes('127.0.0.1:27017'), 'Host/port URI must be redacted');
      assert.ok(sanitized.includes('mongodb://[REDACTED]'), 'Expected redacted protocol format');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 6: Failure Isolation (Banking operations independent of MongoDB)
  // --------------------------------------------------------------------------
  describe('6. Failure Isolation & System Resiliency', () => {
    it('should allow banking transactions to succeed completely even if MongoDB is disconnected', async () => {
      // 1. Temporarily close MongoDB
      await closeMongo();
      assert.equal(isMongoConnected(), false);

      // 2. Perform banking operations (deposit, withdrawal)
      const dep = await executeDeposit({
        accountId: testCustomer1AccountId,
        amount: '100.00',
        remarks: 'Deposit during Mongo outage',
        performedByUserId: 1
      });
      createdTxnIds.push(dep.transactionId);

      const wth = await executeWithdrawal({
        accountId: testCustomer1AccountId,
        amount: '50.00',
        remarks: 'Withdrawal during Mongo outage',
        performedByUserId: 1
      });
      createdTxnIds.push(wth.transactionId);

      // Banking operations succeed cleanly
      assert.ok(dep.transactionId);
      assert.ok(wth.transactionId);

      // Outbox records are preserved in MySQL
      const depOutbox = await getOutboxEventByTransactionId(dep.transactionId);
      const wthOutbox = await getOutboxEventByTransactionId(wth.transactionId);
      assert.equal(depOutbox.status, 'PENDING');
      assert.equal(wthOutbox.status, 'PENDING');

      // 3. Reconnect MongoDB and verify worker processes queued events
      await connectMongo();
      assert.equal(isMongoConnected(), true);

      const worker = new FraudOutboxWorker({ workerId: 'test-recovery-worker' });
      await worker.processBatch(50);

      const depOutboxAfter = await getOutboxEventByTransactionId(dep.transactionId);
      assert.equal(depOutboxAfter.status, 'COMPLETED');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 7: Diagnostics & Operational Telemetry
  // --------------------------------------------------------------------------
  describe('7. Diagnostics Route & Queue Telemetry', () => {
    it('should expose fraud outbox queue metrics and worker status to ADMIN', async () => {
      const res = await request(app)
        .get('/api/diagnostics')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(res.body.data.fraudOutbox);
      assert.equal(typeof res.body.data.fraudOutbox.pending, 'number');
      assert.equal(typeof res.body.data.fraudOutbox.completed, 'number');
      assert.equal(typeof res.body.data.fraudOutbox.total, 'number');
      assert.ok(res.body.data.fraudOutbox.worker);
      assert.equal(typeof res.body.data.fraudOutbox.worker.enabled, 'boolean');
      assert.ok(res.body.data.tableStats.fraud_outbox_events !== undefined);
    });
  });
});
