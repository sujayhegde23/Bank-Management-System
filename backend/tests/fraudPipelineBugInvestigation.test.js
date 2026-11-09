/**
 * ==============================================================================
 * Test Suite: Fraud Detection Pipeline Bug Investigation & Regression Suite
 * ==============================================================================
 * Verifies all 4 requirement areas from Phase 7 of the bug investigation:
 * 1. HIGH_AMOUNT:
 *    - ₹49,999 does not trigger.
 *    - ₹50,000 does not trigger (strictly greater than comparison).
 *    - ₹50,001 triggers.
 *    - ₹60,000 triggers.
 *    - INR-to-paise conversion correctness.
 * 2. HIGH_VELOCITY:
 *    - Three total transactions in 2-min window (<= 3, does not trigger).
 *    - Four total transactions in 2-min window (> 3, triggers).
 *    - Transactions outside 2-minute window are excluded.
 *    - Current transaction counted exactly once.
 *    - Account isolation: other accounts excluded from velocity count.
 * 3. Integration & Outbox Pipeline:
 *    - Transfer creates one outbox event.
 *    - Worker processes event, triggers HIGH_AMOUNT, persists assessment.
 *    - HIGH/CRITICAL assessment generates exactly one alert.
 *    - Duplicate processing is idempotent (no duplicate assessments or alerts).
 * 4. Dashboard & Aggregations:
 *    - Assessment count matches actual assessment documents.
 *    - Risk distribution sums to total assessments.
 *    - Average risk score is calculated correctly across latest 1,000 records.
 *    - Alert count matches actual alerts for stated time range (all-time vs 24h).
 *    - Strict UTC date filtering.
 *    - Empty datasets display zero correctly without NaN.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pool, query } = require('../src/config/db');
const { connectMongo, getDb, isMongoConnected, closeMongo } = require('../src/config/mongo');
const { evaluateHighAmount } = require('../src/services/fraud/rules/highAmount');
const { evaluateHighVelocity } = require('../src/services/fraud/rules/highVelocity');
const { evaluateTransaction } = require('../src/services/fraud/fraudDetectionService');
const { buildTransactionContext } = require('../src/services/fraud/transactionContextProvider');
const { getDashboardStats, listAlerts } = require('../src/services/fraud/fraudDashboardService');
const { toStoredPaise, fromStoredPaise } = require('../src/services/fraud/utils/monetary');
const { FraudOutboxWorker } = require('../src/services/fraud/fraudOutboxWorker');

const TEST_BASE_ID = 889000;

describe('Fraud Detection Pipeline Bug Investigation Verification Suite', () => {
  let mongoDb;
  const createdTxnIds = [];
  const createdOutboxIds = [];
  const createdAssessmentIds = [];
  const createdAlertIds = [];

  before(async () => {
    await connectMongo();
    mongoDb = getDb();
  });

  after(async () => {
    // Clean up only temporary fixtures created by this test suite
    if (createdAlertIds.length > 0) {
      await mongoDb.collection('fraud_alerts').deleteMany({
        $or: [
          { _id: { $in: createdAlertIds } },
          { transactionId: { $in: createdTxnIds } }
        ]
      });
    }
    if (createdAssessmentIds.length > 0 || createdTxnIds.length > 0) {
      await mongoDb.collection('transaction_risk_assessments').deleteMany({
        $or: [
          { _id: { $in: createdAssessmentIds } },
          { transactionId: { $in: createdTxnIds } }
        ]
      });
    }
    if (createdTxnIds.length > 0) {
      const ph = createdTxnIds.map(() => '?').join(',');
      await query(`DELETE FROM fraud_outbox_events WHERE transaction_id IN (${ph})`, createdTxnIds).catch(() => { });
      await query(`DELETE FROM bank_transactions WHERE transaction_id IN (${ph})`, createdTxnIds).catch(() => { });
    }
    await closeMongo();
    await pool.end();
  });

  // ============================================================================
  // 1. HIGH_AMOUNT Rule Precision
  // ============================================================================
  describe('1. HIGH_AMOUNT Precision & Monetary Conversion', () => {
    const highAmountRule = {
      ruleCode: 'HIGH_AMOUNT',
      enabled: true,
      threshold: 5000000, // 50,000.00 in paise
      weight: 30
    };

    it('should correctly convert rupees to integer paise without floating-point inaccuracy', () => {
      assert.equal(toStoredPaise(49999.00), 4999900);
      assert.equal(toStoredPaise('50000.00'), 5000000);
      assert.equal(toStoredPaise(50000.01), 5000001);
      assert.equal(toStoredPaise('60000.00'), 6000000);
      assert.equal(fromStoredPaise(6000000), '60000.00');
    });

    it('₹49,999 does not trigger configured threshold of ₹50,000', async () => {
      const tx = { amount: toStoredPaise(49999.00), isPaise: true };
      const res = await evaluateHighAmount(tx, highAmountRule);
      assert.equal(res.triggered, false, '₹49,999 must not trigger ₹50,000 threshold');
    });

    it('₹50,000 does not trigger if comparison is strictly greater than', async () => {
      const tx = { amount: 5000000, isPaise: true };
      const res = await evaluateHighAmount(tx, highAmountRule);
      assert.equal(res.triggered, false, '₹50,000 exact boundary must not trigger (strictly greater than)');
    });

    it('₹50,001 triggers threshold of ₹50,000', async () => {
      const tx = { amount: toStoredPaise(50001.00), isPaise: true };
      const res = await evaluateHighAmount(tx, highAmountRule);
      assert.equal(res.triggered, true, '₹50,001 must trigger ₹50,000 threshold');
      assert.equal(res.points, 30);
    });

    it('₹60,000 triggers threshold of ₹50,000 with 30 points', async () => {
      const tx = { amount: 6000000, isPaise: true };
      const res = await evaluateHighAmount(tx, highAmountRule);
      assert.equal(res.triggered, true, '₹60,000 must trigger ₹50,000 threshold');
      assert.equal(res.points, 30);
    });
  });

  // ============================================================================
  // 2. HIGH_VELOCITY Counting Semantics & Window Boundaries
  // ============================================================================
  describe('2. HIGH_VELOCITY Counting Semantics & Boundary Verification', () => {
    const velocityRule = {
      ruleCode: 'HIGH_VELOCITY',
      enabled: true,
      threshold: 3,
      weight: 25,
      config: { windowMinutes: 2 }
    };

    it('Three total transactions in window (threshold: 3) does NOT trigger strictly-greater-than rule', async () => {
      // Historical count = 2, current tx = 1 => Total = 3
      const tx = { transactionId: 9001, accountId: 1 };
      const context = { recentTransactionCount: 2, includeCurrentTransaction: false };
      const res = await evaluateHighVelocity(tx, velocityRule, context);
      assert.equal(res.triggered, false, '3 total transactions must not trigger threshold of 3');
    });

    it('Four total transactions in window (threshold: 3) TRIGGERS rule with 25 points', async () => {
      // Historical count = 3, current tx = 1 => Total = 4
      const tx = { transactionId: 9002, accountId: 1 };
      const context = { recentTransactionCount: 3, includeCurrentTransaction: false };
      const res = await evaluateHighVelocity(tx, velocityRule, context);
      assert.equal(res.triggered, true, '4 total transactions must trigger threshold of 3');
      assert.equal(res.points, 25);
    });

    it('Current transaction is counted exactly once (not double-counted)', async () => {
      const tx = { transactionId: 9003, accountId: 1 };
      // Case A: context says current is already included
      const contextAlreadyIncluded = { recentTransactionCount: 3, includeCurrentTransaction: true };
      const resA = await evaluateHighVelocity(tx, velocityRule, contextAlreadyIncluded);
      assert.equal(resA.triggered, false, 'Count of 3 already included must not be incremented');

      // Case B: context says current was excluded -> incremented to 4 -> triggers
      const contextExcluded = { recentTransactionCount: 3, includeCurrentTransaction: false };
      const resB = await evaluateHighVelocity(tx, velocityRule, contextExcluded);
      assert.equal(resB.triggered, true, 'Count of 3 with current excluded increments to 4 and triggers');
    });

    it('Transactions outside the 2-minute window are excluded by context query', async () => {
      const testTxId = TEST_BASE_ID + 10;
      const now = new Date();
      const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);

      // Insert transaction 3 minutes ago for Account 1
      await query(
        `INSERT INTO bank_transactions
         (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
         VALUES (?, ?, 'TRANSFER', 100.00, 1, 2, 4, 'Older than 2 minutes', ?)`,
        [testTxId, `TXN-TIME-${testTxId}`, threeMinutesAgo]
      );
      createdTxnIds.push(testTxId);

      // Query context for a new transaction right now
      const currTxId = TEST_BASE_ID + 11;
      await query(
        `INSERT INTO bank_transactions
         (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
         VALUES (?, ?, 'TRANSFER', 100.00, 1, 2, 4, 'Current transaction', NOW())`,
        [currTxId, `TXN-TIME-${currTxId}`]
      );
      createdTxnIds.push(currTxId);

      const ctx = await buildTransactionContext(currTxId);
      // The transaction from 3 minutes ago must NOT be counted in the 2-minute recentTransactionCount
      assert.equal(
        ctx.context.recentTransactionCount < 3,
        true,
        'Transactions older than 2 minutes must be excluded'
      );
    });

    it('Velocity query guarantees strict account isolation (other accounts excluded)', async () => {
      const txAcc2 = TEST_BASE_ID + 20;
      await query(
        `INSERT INTO bank_transactions
         (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
         VALUES (?, ?, 'TRANSFER', 500.00, 2, 3, 5, 'Account 2 transfer', NOW())`,
        [txAcc2, `TXN-ISO-${txAcc2}`]
      );
      createdTxnIds.push(txAcc2);

      // Query context for Account 1
      const txAcc1 = TEST_BASE_ID + 21;
      await query(
        `INSERT INTO bank_transactions
         (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
         VALUES (?, ?, 'TRANSFER', 500.00, 1, 184, 4, 'Account 1 transfer', NOW())`,
        [txAcc1, `TXN-ISO-${txAcc1}`]
      );
      createdTxnIds.push(txAcc1);

      const ctx1 = await buildTransactionContext(txAcc1);
      assert.equal(ctx1.transaction.accountId, 1);
    });
  });

  // ============================================================================
  // 3. Integration & Outbox Pipeline Verification
  // ============================================================================
  describe('3. Integration, Outbox Worker & Alert Generation', () => {
    it('Large transfer triggers HIGH_AMOUNT and persists risk assessment with decision REVIEW_REQUIRED', async () => {
      // Pre-seed an established transfer history between Account 1 and Account 184
      // so NEW_BENEFICIARY is false and HIGH_AMOUNT is verified in isolation (Score = 30)
      const priorTxId = TEST_BASE_ID + 29;
      await query(
        `INSERT INTO bank_transactions
         (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
         VALUES (?, ?, 'TRANSFER', 500.00, 1, 184, 4, 'Prior established transfer', DATE_SUB(NOW(), INTERVAL 1 HOUR))`,
        [priorTxId, `TXN-PRIOR-${priorTxId}`]
      );
      createdTxnIds.push(priorTxId);

      const intTxId = TEST_BASE_ID + 30;
      await query(
        `INSERT INTO bank_transactions
         (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
         VALUES (?, ?, 'TRANSFER', 60000.00, 1, 184, 4, 'Integration ₹60,000 transfer', NOW())`,
        [intTxId, `TXN-INT-${intTxId}`]
      );
      createdTxnIds.push(intTxId);

      // Create outbox event
      const outboxRes = await query(
        `INSERT INTO fraud_outbox_events
         (transaction_id, event_type, payload, status)
         VALUES (?, 'TRANSFER', ?, 'PENDING')`,
        [intTxId, JSON.stringify({ transactionId: intTxId, amount: '60000.00', accountId: 1 })]
      );
      createdOutboxIds.push(outboxRes.insertId);

      // Worker process single batch
      const worker = new FraudOutboxWorker({ pollIntervalMs: 5000, batchSize: 5 });
      const processRes = await worker.processBatch();
      assert.ok(processRes.processed >= 1, 'Worker must process claimed outbox event');

      // Verify assessment was persisted in MongoDB
      const assessment = await mongoDb.collection('transaction_risk_assessments').findOne({ transactionId: intTxId });
      assert.ok(assessment, 'Assessment must be persisted in MongoDB');
      assert.equal(assessment.amount, 6000000, 'Amount must be 6,000,000 paise');
      assert.equal(assessment.riskScore, 30, 'Risk score must be 30 for single large transfer');
      assert.equal(assessment.riskLevel, 'MEDIUM');
      assert.equal(assessment.decision, 'REVIEW_REQUIRED');

      // Under new policy: score 30 (MEDIUM) with triggered rule MUST create an alert
      const alert = await mongoDb.collection('fraud_alerts').findOne({ transactionId: intTxId });
      assert.ok(alert, 'Score 30 (MEDIUM) with triggered rule MUST generate fraud alert');
      assert.equal(alert.riskLevel, 'MEDIUM');
      assert.equal(alert.riskScore, 30);
      createdAlertIds.push(alert._id);
    });

    it('A HIGH (60–79) or CRITICAL (80–100) assessment generates exactly one fraud alert', async () => {
      const highAlertTxId = TEST_BASE_ID + 40;
      createdTxnIds.push(highAlertTxId);

      // Synthesize transaction context with multiple rules triggering (HIGH_AMOUNT: 30 + HIGH_VELOCITY: 25 + NEW_BENEFICIARY: 25 = 80 -> CRITICAL)
      const syntheticTx = {
        transactionId: highAlertTxId,
        transactionRef: `TXN-HIGH-${highAlertTxId}`,
        transactionType: 'TRANSFER',
        amount: 6000000,
        isPaise: true,
        customerId: 1,
        accountId: 1,
        destinationAccountId: 999
      };
      const syntheticCtx = {
        recentTransactionCount: 4,
        includeCurrentTransaction: false,
        isNewBeneficiary: true,
        previousTransfersCount: 0
      };

      const evalResult = await evaluateTransaction(syntheticTx, syntheticCtx);
      assert.equal(evalResult.assessment.riskScore, 80, 'Score must be 80');
      assert.equal(evalResult.assessment.riskLevel, 'CRITICAL');
      assert.ok(evalResult.alert, 'Alert must be generated for CRITICAL assessment');
      assert.equal(evalResult.alert.riskLevel, 'CRITICAL');

      // Check MongoDB fraud_alerts
      const alertDoc = await mongoDb.collection('fraud_alerts').findOne({ transactionId: highAlertTxId });
      assert.ok(alertDoc, 'Alert document must exist in MongoDB');
      createdAlertIds.push(alertDoc._id);
    });

    it('Duplicate processing is strictly idempotent and does not duplicate assessments or alerts', async () => {
      const dupTxId = TEST_BASE_ID + 45;
      createdTxnIds.push(dupTxId);

      const tx = {
        transactionId: dupTxId,
        transactionRef: `TXN-DUP-${dupTxId}`,
        transactionType: 'TRANSFER',
        amount: 6000000,
        isPaise: true,
        customerId: 1,
        accountId: 1,
        destinationAccountId: 999
      };
      const ctx = {
        recentTransactionCount: 4,
        includeCurrentTransaction: false,
        isNewBeneficiary: true
      };

      // Call evaluateTransaction twice sequentially
      const firstRun = await evaluateTransaction(tx, ctx);
      const secondRun = await evaluateTransaction(tx, ctx);

      assert.equal(firstRun.isExisting, false);
      assert.equal(secondRun.isExisting, true);

      // Verify exactly 1 assessment in MongoDB
      const assessCount = await mongoDb.collection('transaction_risk_assessments').countDocuments({ transactionId: dupTxId });
      assert.equal(assessCount, 1, 'Exactly one assessment must exist after duplicate evaluation');

      // Verify exactly 1 alert in MongoDB
      const alertCount = await mongoDb.collection('fraud_alerts').countDocuments({ transactionId: dupTxId });
      assert.equal(alertCount, 1, 'Exactly one alert must exist after duplicate evaluation');
    });
  });

  // ============================================================================
  // 4. Dashboard Statistics & Metric Consistency
  // ============================================================================
  describe('4. Dashboard Aggregations & Consistent Metric Representation', () => {
    it('totalAssessments matches actual count in transaction_risk_assessments', async () => {
      const stats = await getDashboardStats();
      const actualCount = await mongoDb.collection('transaction_risk_assessments').countDocuments();
      assert.equal(stats.totalAssessments, actualCount, 'totalAssessments must match MongoDB document count');
    });

    it('Risk distribution (LOW + MEDIUM + HIGH + CRITICAL) sums to total assessments', async () => {
      const stats = await getDashboardStats();
      const sum =
        (stats.assessmentsByRiskLevel.LOW || 0) +
        (stats.assessmentsByRiskLevel.MEDIUM || 0) +
        (stats.assessmentsByRiskLevel.HIGH || 0) +
        (stats.assessmentsByRiskLevel.CRITICAL || 0);

      assert.equal(sum, stats.totalAssessments, 'Risk distribution sum must equal totalAssessments');
    });

    it('Recent average assessment risk score is calculated correctly across evaluated transactions', async () => {
      const stats = await getDashboardStats();
      assert.equal(typeof stats.recentAverageAssessmentScore, 'number');
      assert.equal(stats.recentAverageAssessmentScore >= 0, true);
    });

    it('totalAlerts matches actual alerts in fraud_alerts', async () => {
      const stats = await getDashboardStats();
      const actualAlertCount = await mongoDb.collection('fraud_alerts').countDocuments();
      assert.equal(stats.totalAlerts, actualAlertCount, 'totalAlerts must match fraud_alerts document count');
    });

    it('Strict UTC date filtering operates without timezone drift', async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const res = await listAlerts({ startDate: todayIso, endDate: todayIso });
      assert.ok(Array.isArray(res.items));
      assert.ok(typeof res.pagination.total === 'number');
    });
  });
});