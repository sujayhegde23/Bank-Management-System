/**
 * ==============================================================================
 * Test Suite: Fraud Alert Policy Correction — Alert on Every Triggered Rule
 * ==============================================================================
 * Verifies all 13 required business requirements:
 * 1. No triggered rules -> no alert.
 * 2. HIGH_AMOUNT alone -> alert generated.
 * 3. HIGH_VELOCITY alone -> alert generated.
 * 4. NEW_BENEFICIARY alone -> alert generated.
 * 5. UNUSUAL_HOUR alone -> alert generated.
 * 6. A MEDIUM assessment with one triggered rule generates an alert.
 * 7. A LOW assessment with one triggered rule generates an alert.
 * 8. Multiple triggered rules generate exactly one alert.
 * 9. HIGH assessment generates an alert.
 * 10. CRITICAL assessment generates an alert.
 * 11. Duplicate worker processing does not create duplicate alerts.
 * 12. Dashboard returns alerts from all risk levels.
 * 13. Alert pagination and risk-level filtering work correctly.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, query } = require('../src/config/db');
const { connectMongo, getDb, closeMongo } = require('../src/config/mongo');
const { evaluateTransaction } = require('../src/services/fraud/fraudDetectionService');
const { saveAlert, getAlertByTransactionId, getAssessmentByTransactionId } = require('../src/services/fraud/assessmentRepository');
const { getDashboardStats, listAlerts } = require('../src/services/fraud/fraudDashboardService');
const { FraudOutboxWorker } = require('../src/services/fraud/fraudOutboxWorker');
const { clearRuleCache } = require('../src/services/fraud/fraudRuleRepository');

const TEST_BASE_ID = 88770000;

describe('Fraud Alert Policy Correction: Alert on Every Triggered Rule (13 Cases)', () => {
  let mongoDb;
  const createdTxnIds = [];
  const createdAlertIds = [];
  const createdAssessmentIds = [];

  before(async () => {
    await connectMongo();
    mongoDb = getDb();
    clearRuleCache();

    // Clean up any stale records from prior runs
    await mongoDb.collection('fraud_alerts').deleteMany({
      transactionId: { $gte: TEST_BASE_ID, $lte: TEST_BASE_ID + 5000 }
    });
    await mongoDb.collection('transaction_risk_assessments').deleteMany({
      transactionId: { $gte: TEST_BASE_ID, $lte: TEST_BASE_ID + 5000 }
    });
    await query(`DELETE FROM fraud_outbox_events WHERE transaction_id >= ? AND transaction_id <= ?`, [TEST_BASE_ID, TEST_BASE_ID + 5000]).catch(() => {});
    await query(`DELETE FROM bank_transactions WHERE transaction_id >= ? AND transaction_id <= ?`, [TEST_BASE_ID, TEST_BASE_ID + 5000]).catch(() => {});
  });

  after(async () => {
    // Teardown test fixtures created in this run
    if (createdAlertIds.length > 0 || createdTxnIds.length > 0) {
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
      await query(`DELETE FROM fraud_outbox_events WHERE transaction_id IN (${ph})`, createdTxnIds).catch(() => {});
      await query(`DELETE FROM bank_transactions WHERE transaction_id IN (${ph})`, createdTxnIds).catch(() => {});
    }
    clearRuleCache();
    await closeMongo();
    await pool.end();
  });

  // ============================================================================
  // 1. No Triggered Rules -> No Alert
  // ============================================================================
  it('1. should NOT generate an alert when zero fraud detection rules trigger', async () => {
    const txId = TEST_BASE_ID + 1;
    createdTxnIds.push(txId);

    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 2, // known beneficiary
      transactionType: 'TRANSFER',
      amount: 1000.0, // below ₹50,000
      timestamp: new Date('2026-11-06T14:30:00+05:30') // normal banking hour (2:30 PM IST)
    };
    const ctx = {
      recentTransactionCount: 0,
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    };

    const res = await evaluateTransaction(tx, ctx, { checkExisting: false });
    assert.equal(res.assessment.riskScore, 0, 'Risk score must be 0');
    assert.equal(res.assessment.riskLevel, 'LOW', 'Risk level must be LOW');
    assert.equal(res.assessment.decision, 'APPROVED');
    assert.equal(res.triggeredRules.length, 0, 'Zero rules must trigger');
    assert.equal(res.alert, null, 'Must NOT generate an alert when no rules trigger');

    const alertInDb = await mongoDb.collection('fraud_alerts').findOne({ transactionId: txId });
    assert.equal(alertInDb, null, 'No document in fraud_alerts collection should exist');
  });

  // ============================================================================
  // 2. HIGH_AMOUNT Alone -> Alert Generated
  // ============================================================================
  it('2. should generate a fraud alert when HIGH_AMOUNT alone triggers', async () => {
    const txId = TEST_BASE_ID + 2;
    createdTxnIds.push(txId);

    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 2,
      transactionType: 'TRANSFER',
      amount: 60000.0, // strictly exceeds ₹50,000 threshold (30 points)
      timestamp: new Date('2026-11-06T14:30:00+05:30') // normal hour
    };
    const ctx = {
      recentTransactionCount: 0,
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    };

    const res = await evaluateTransaction(tx, ctx, { checkExisting: false });
    assert.equal(res.assessment.riskScore, 30);
    assert.equal(res.assessment.riskLevel, 'MEDIUM');
    assert.equal(res.assessment.decision, 'REVIEW_REQUIRED');
    assert.equal(res.triggeredRules.length, 1);
    assert.equal(res.triggeredRules[0].ruleCode, 'HIGH_AMOUNT');

    assert.ok(res.alert, 'Must generate an alert when HIGH_AMOUNT triggers');
    assert.equal(res.alert.riskLevel, 'MEDIUM');
    assert.equal(res.alert.riskScore, 30);
    assert.equal(res.alert.status, 'OPEN');

    const alertInDb = await mongoDb.collection('fraud_alerts').findOne({ transactionId: txId });
    assert.ok(alertInDb, 'fraud_alerts document must exist in MongoDB');
    assert.equal(alertInDb.riskLevel, 'MEDIUM');
    createdAlertIds.push(alertInDb._id);
  });

  // ============================================================================
  // 3. HIGH_VELOCITY Alone -> Alert Generated
  // ============================================================================
  it('3. should generate a fraud alert when HIGH_VELOCITY alone triggers', async () => {
    const txId = TEST_BASE_ID + 3;
    createdTxnIds.push(txId);

    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 2,
      transactionType: 'TRANSFER',
      amount: 1000.0, // below threshold
      timestamp: new Date('2026-11-06T14:30:00+05:30') // normal hour
    };
    const ctx = {
      recentTransactionCount: 4, // exceeds threshold of 3 (25 points)
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    };

    const res = await evaluateTransaction(tx, ctx, { checkExisting: false });
    assert.equal(res.assessment.riskScore, 25);
    assert.equal(res.assessment.riskLevel, 'LOW');
    assert.equal(res.assessment.decision, 'APPROVED');
    assert.equal(res.triggeredRules.length, 1);
    assert.equal(res.triggeredRules[0].ruleCode, 'HIGH_VELOCITY');

    assert.ok(res.alert, 'Must generate an alert when HIGH_VELOCITY triggers');
    assert.equal(res.alert.riskLevel, 'LOW');
    assert.equal(res.alert.riskScore, 25);

    const alertInDb = await mongoDb.collection('fraud_alerts').findOne({ transactionId: txId });
    assert.ok(alertInDb, 'fraud_alerts document must exist');
    assert.equal(alertInDb.riskLevel, 'LOW');
    createdAlertIds.push(alertInDb._id);
  });

  // ============================================================================
  // 4. NEW_BENEFICIARY Alone -> Alert Generated
  // ============================================================================
  it('4. should generate a fraud alert when NEW_BENEFICIARY alone triggers', async () => {
    const txId = TEST_BASE_ID + 4;
    createdTxnIds.push(txId);

    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 9999, // first-time recipient
      transactionType: 'TRANSFER',
      amount: 1000.0,
      timestamp: new Date('2026-11-06T14:30:00+05:30')
    };
    const ctx = {
      recentTransactionCount: 0,
      includeCurrentTransaction: false,
      isNewBeneficiary: true // triggers 25 points
    };

    const res = await evaluateTransaction(tx, ctx, { checkExisting: false });
    assert.equal(res.assessment.riskScore, 25);
    assert.equal(res.assessment.riskLevel, 'LOW');
    assert.equal(res.triggeredRules.length, 1);
    assert.equal(res.triggeredRules[0].ruleCode, 'NEW_BENEFICIARY');

    assert.ok(res.alert, 'Must generate an alert when NEW_BENEFICIARY triggers');
    assert.equal(res.alert.riskLevel, 'LOW');
    assert.equal(res.alert.riskScore, 25);

    const alertInDb = await mongoDb.collection('fraud_alerts').findOne({ transactionId: txId });
    assert.ok(alertInDb);
    assert.equal(alertInDb.riskLevel, 'LOW');
    createdAlertIds.push(alertInDb._id);
  });

  // ============================================================================
  // 5. UNUSUAL_HOUR Alone -> Alert Generated
  // ============================================================================
  it('5. should generate a fraud alert when UNUSUAL_HOUR alone triggers', async () => {
    const txId = TEST_BASE_ID + 5;
    createdTxnIds.push(txId);

    const nightTimeUtc = new Date('2026-11-05T21:30:00.000Z'); // 03:00 AM IST (window 01:00-05:00, 20 points)
    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 2,
      transactionType: 'TRANSFER',
      amount: 1000.0,
      timestamp: nightTimeUtc
    };
    const ctx = {
      recentTransactionCount: 0,
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    };

    const res = await evaluateTransaction(tx, ctx, { checkExisting: false });
    assert.equal(res.assessment.riskScore, 20);
    assert.equal(res.assessment.riskLevel, 'LOW');
    assert.equal(res.triggeredRules.length, 1);
    assert.equal(res.triggeredRules[0].ruleCode, 'UNUSUAL_HOUR');

    assert.ok(res.alert, 'Must generate an alert when UNUSUAL_HOUR triggers');
    assert.equal(res.alert.riskLevel, 'LOW');
    assert.equal(res.alert.riskScore, 20);

    const alertInDb = await mongoDb.collection('fraud_alerts').findOne({ transactionId: txId });
    assert.ok(alertInDb);
    assert.equal(alertInDb.riskLevel, 'LOW');
    createdAlertIds.push(alertInDb._id);
  });

  // ============================================================================
  // 6. MEDIUM Assessment with One Triggered Rule Generates an Alert
  // ============================================================================
  it('6. should generate an alert for a MEDIUM assessment resulting from a single triggered rule', async () => {
    const txId = TEST_BASE_ID + 6;
    createdTxnIds.push(txId);

    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 2,
      transactionType: 'TRANSFER',
      amount: 75000.0, // HIGH_AMOUNT weight is 30, which falls in MEDIUM range (30-59)
      timestamp: new Date('2026-11-06T14:30:00+05:30')
    };
    const ctx = {
      recentTransactionCount: 0,
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    };

    const res = await evaluateTransaction(tx, ctx, { checkExisting: false });
    assert.equal(res.assessment.riskScore, 30);
    assert.equal(res.assessment.riskLevel, 'MEDIUM');
    assert.equal(res.assessment.decision, 'REVIEW_REQUIRED');
    assert.equal(res.triggeredRules.length, 1);

    assert.ok(res.alert, 'MEDIUM assessment with 1 rule must generate alert');
    assert.equal(res.alert.riskLevel, 'MEDIUM');
    assert.equal(res.alert.riskScore, 30);
  });

  // ============================================================================
  // 7. LOW Assessment with One Triggered Rule Generates an Alert
  // ============================================================================
  it('7. should generate an alert for a LOW assessment resulting from a single triggered rule', async () => {
    const txId = TEST_BASE_ID + 7;
    createdTxnIds.push(txId);

    // UNUSUAL_HOUR has weight 20 -> score 20 is strictly LOW (0-29)
    const nightTimeUtc = new Date('2026-11-05T22:00:00.000Z'); // 03:30 AM IST
    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 2,
      transactionType: 'TRANSFER',
      amount: 500.0,
      timestamp: nightTimeUtc
    };
    const ctx = {
      recentTransactionCount: 0,
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    };

    const res = await evaluateTransaction(tx, ctx, { checkExisting: false });
    assert.equal(res.assessment.riskScore, 20);
    assert.equal(res.assessment.riskLevel, 'LOW');
    assert.equal(res.assessment.decision, 'APPROVED');
    assert.equal(res.triggeredRules.length, 1);

    assert.ok(res.alert, 'LOW assessment with 1 triggered rule MUST generate alert');
    assert.equal(res.alert.riskLevel, 'LOW');
    assert.equal(res.alert.riskScore, 20);
  });

  // ============================================================================
  // 8. Multiple Triggered Rules Generate Exactly One Alert
  // ============================================================================
  it('8. should generate exactly one alert when multiple rules trigger', async () => {
    const txId = TEST_BASE_ID + 8;
    createdTxnIds.push(txId);

    // HIGH_AMOUNT (30) + HIGH_VELOCITY (25) = 55 (MEDIUM)
    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 2,
      transactionType: 'TRANSFER',
      amount: 60000.0,
      timestamp: new Date('2026-11-06T14:30:00+05:30')
    };
    const ctx = {
      recentTransactionCount: 4,
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    };

    const res = await evaluateTransaction(tx, ctx, { checkExisting: false });
    assert.equal(res.assessment.riskScore, 55);
    assert.equal(res.assessment.riskLevel, 'MEDIUM');
    assert.equal(res.triggeredRules.length, 2);

    assert.ok(res.alert, 'Alert must be generated');
    assert.equal(res.alert.riskLevel, 'MEDIUM');
    assert.equal(res.alert.riskScore, 55);
    assert.equal(res.alert.reasons.length, 2);

    const alertCount = await mongoDb.collection('fraud_alerts').countDocuments({ transactionId: txId });
    assert.equal(alertCount, 1, 'Exactly one alert document must exist for multiple triggered rules');
  });

  // ============================================================================
  // 9. HIGH Assessment Generates an Alert
  // ============================================================================
  it('9. should generate an alert for a HIGH risk assessment (60–79)', async () => {
    const txId = TEST_BASE_ID + 9;
    createdTxnIds.push(txId);

    // HIGH_AMOUNT (30) + HIGH_VELOCITY (25) + UNUSUAL_HOUR (20) = 75 (HIGH)
    const nightTimeUtc = new Date('2026-11-05T21:30:00.000Z');
    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 2,
      transactionType: 'TRANSFER',
      amount: 60000.0,
      timestamp: nightTimeUtc
    };
    const ctx = {
      recentTransactionCount: 4,
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    };

    const res = await evaluateTransaction(tx, ctx, { checkExisting: false });
    assert.equal(res.assessment.riskScore, 75);
    assert.equal(res.assessment.riskLevel, 'HIGH');
    assert.equal(res.assessment.decision, 'FLAGGED');

    assert.ok(res.alert, 'HIGH risk assessment must generate alert');
    assert.equal(res.alert.riskLevel, 'HIGH');
    assert.equal(res.alert.riskScore, 75);

    const alertCount = await mongoDb.collection('fraud_alerts').countDocuments({ transactionId: txId });
    assert.equal(alertCount, 1);
  });

  // ============================================================================
  // 10. CRITICAL Assessment Generates an Alert
  // ============================================================================
  it('10. should generate an alert for a CRITICAL risk assessment (80–100)', async () => {
    const txId = TEST_BASE_ID + 10;
    createdTxnIds.push(txId);

    // All 4 rules trigger: 30 + 25 + 25 + 20 = 100 (CRITICAL)
    const nightTimeUtc = new Date('2026-11-05T21:30:00.000Z');
    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 9999, // NEW_BENEFICIARY
      transactionType: 'TRANSFER',
      amount: 60000.0, // HIGH_AMOUNT
      timestamp: nightTimeUtc // UNUSUAL_HOUR
    };
    const ctx = {
      recentTransactionCount: 4, // HIGH_VELOCITY
      includeCurrentTransaction: false,
      isNewBeneficiary: true
    };

    const res = await evaluateTransaction(tx, ctx, { checkExisting: false });
    assert.equal(res.assessment.riskScore, 100);
    assert.equal(res.assessment.riskLevel, 'CRITICAL');
    assert.equal(res.assessment.decision, 'FLAGGED');

    assert.ok(res.alert, 'CRITICAL risk assessment must generate alert');
    assert.equal(res.alert.riskLevel, 'CRITICAL');
    assert.equal(res.alert.riskScore, 100);

    const alertCount = await mongoDb.collection('fraud_alerts').countDocuments({ transactionId: txId });
    assert.equal(alertCount, 1);
  });

  // ============================================================================
  // 11. Duplicate Worker Processing Does Not Create Duplicate Alerts
  // ============================================================================
  it('11. should preserve strict idempotency: duplicate worker processing never creates duplicate alerts', async () => {
    const workerTxId = TEST_BASE_ID + 11;
    createdTxnIds.push(workerTxId);

    // 1. Insert bank transaction into MySQL
    await query(
      `INSERT INTO bank_transactions
       (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
       VALUES (?, ?, 'TRANSFER', 60000.00, 1, 2, 4, 'Idempotent worker test', NOW())`,
      [workerTxId, `TXN-IDEM-${workerTxId}`]
    );

    // 2. Insert outbox event
    await query(
      `INSERT INTO fraud_outbox_events
       (transaction_id, event_type, payload, status)
       VALUES (?, 'TRANSFER', ?, 'PENDING')`,
      [workerTxId, JSON.stringify({ transactionId: workerTxId, amount: '60000.00', accountId: 1 })]
    );

    const worker = new FraudOutboxWorker({ pollIntervalMs: 5000, batchSize: 5 });

    // Run first batch
    const run1 = await worker.processBatch();
    assert.ok(run1.processed >= 1, 'Worker must process claimed event');

    // Run second batch sequentially (simulating retry or re-run)
    const run2 = await worker.processBatch();

    // Verify assessments count
    const assessCount = await mongoDb.collection('transaction_risk_assessments').countDocuments({ transactionId: workerTxId });
    assert.equal(assessCount, 1, 'Exactly one assessment must exist');

    // Verify alerts count: exactly 1 alert exists, no duplicates
    const alertCount = await mongoDb.collection('fraud_alerts').countDocuments({ transactionId: workerTxId });
    assert.equal(alertCount, 1, 'Exactly one alert must exist after duplicate worker runs');
  });

  // ============================================================================
  // 12. Dashboard Returns Alerts from All Risk Levels
  // ============================================================================
  it('12. should return alerts across all four risk levels (LOW, MEDIUM, HIGH, CRITICAL) in dashboard statistics', async () => {
    // Verify that our tests have generated LOW, MEDIUM, HIGH, and CRITICAL alerts
    const stats = await getDashboardStats();

    assert.ok(stats.totalAlerts >= 4, 'totalAlerts must count all alerts');
    assert.ok(stats.alertsByRiskLevel.LOW >= 1, 'Dashboard stats must report LOW alerts');
    assert.ok(stats.alertsByRiskLevel.MEDIUM >= 1, 'Dashboard stats must report MEDIUM alerts');
    assert.ok(stats.alertsByRiskLevel.HIGH >= 1, 'Dashboard stats must report HIGH alerts');
    assert.ok(stats.alertsByRiskLevel.CRITICAL >= 1, 'Dashboard stats must report CRITICAL alerts');

    // Sourced from fraud_alerts
    const actualAlertCount = await mongoDb.collection('fraud_alerts').countDocuments();
    assert.equal(stats.totalAlerts, actualAlertCount, 'totalAlerts must match actual fraud_alerts collection count');
  });

  // ============================================================================
  // 13. Alert Pagination & Risk-Level Filtering Work Correctly
  // ============================================================================
  it('13. should correctly paginate and filter alerts by riskLevel for all four levels', async () => {
    // Filter LOW
    const lowList = await listAlerts({ riskLevel: 'LOW', limit: 20 });
    assert.ok(lowList.items.length >= 1, 'Must list LOW alerts');
    for (const item of lowList.items) {
      assert.equal(item.riskLevel, 'LOW');
    }

    // Filter MEDIUM
    const medList = await listAlerts({ riskLevel: 'MEDIUM', limit: 20 });
    assert.ok(medList.items.length >= 1, 'Must list MEDIUM alerts');
    for (const item of medList.items) {
      assert.equal(item.riskLevel, 'MEDIUM');
    }

    // Filter HIGH
    const highList = await listAlerts({ riskLevel: 'HIGH', limit: 20 });
    assert.ok(highList.items.length >= 1, 'Must list HIGH alerts');
    for (const item of highList.items) {
      assert.equal(item.riskLevel, 'HIGH');
    }

    // Filter CRITICAL
    const critList = await listAlerts({ riskLevel: 'CRITICAL', limit: 20 });
    assert.ok(critList.items.length >= 1, 'Must list CRITICAL alerts');
    for (const item of critList.items) {
      assert.equal(item.riskLevel, 'CRITICAL');
    }

    // Pagination limit check
    const paged = await listAlerts({ page: 1, limit: 2 });
    assert.equal(paged.items.length, 2, 'Must return exactly 2 items for limit 2');
    assert.equal(paged.pagination.page, 1);
    assert.equal(paged.pagination.limit, 2);
    assert.ok(paged.pagination.total >= 4);
    assert.ok(paged.pagination.totalPages >= 2);
  });
});

