/**
 * ==============================================================================
 * Regression Test Suite: Fraud Detection End-to-End Functional Debugging
 * ==============================================================================
 * Verifies the 12 critical functional behaviors identified during end-to-end debugging:
 * 1. ₹60,000 high-amount evaluation.
 * 2. Exact threshold boundary (50,000.00 vs 50,000.01).
 * 3. Three transactions within two minutes (velocity count logic).
 * 4. Four transactions within two minutes (triggers velocity rule).
 * 5. Current transaction not double-counted.
 * 6. Historical transactions from another account not counted.
 * 7. Correct score calculation using MongoDB-configured weights (dynamic sum).
 * 8. Correct HIGH/CRITICAL alert generation (score >= 60 generates alert, < 60 does not).
 * 9. Correct transaction type hydration (live MySQL & assessment fallback).
 * 10. Correct amount hydration (live MySQL & assessment fallback).
 * 11. Missing MySQL & Mongo transaction handling (UNAVAILABLE state).
 * 12. Rule cache invalidation (cache refresh on MongoDB updates).
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pool, query } = require('../src/config/db');
const { connectMongo, getDb, isMongoConnected, closeMongo } = require('../src/config/mongo');
const { evaluateTransaction } = require('../src/services/fraud/fraudDetectionService');
const {
  getEnabledRules,
  getRuleByCode,
  clearRuleCache
} = require('../src/services/fraud/fraudRuleRepository');
const {
  hydrateBankingTransactions,
  listAlerts
} = require('../src/services/fraud/fraudDashboardService');
const {
  buildTransactionContext
} = require('../src/services/fraud/transactionContextProvider');
const {
  toStoredPaise,
  formatPaiseToRupees,
  isAmountStrictlyGreaterThan
} = require('../src/services/fraud/utils/monetary');
const { evaluateHighAmount } = require('../src/services/fraud/rules/highAmount');
const { evaluateHighVelocity } = require('../src/services/fraud/rules/highVelocity');

const BASE_TEST_TX_ID = 77880000;

describe('Fraud Detection Functional Debugging Regression Tests (12 Points)', () => {

  let mongoDb;
  const createdTestTxnIds = [];

  before(async () => {
    await connectMongo();
    mongoDb = getDb();
    clearRuleCache();
    // Clean up any leftover test transactions from prior aborted runs
    await mongoDb.collection('transaction_risk_assessments').deleteMany({
      transactionId: { $gte: BASE_TEST_TX_ID, $lte: BASE_TEST_TX_ID + 1000 }
    });
    await mongoDb.collection('fraud_alerts').deleteMany({
      transactionId: { $gte: BASE_TEST_TX_ID, $lte: BASE_TEST_TX_ID + 1000 }
    });
  });

  after(async () => {
    // Teardown any test assessment/alert documents created during this suite
    if (createdTestTxnIds.length > 0) {
      if (mongoDb) {
        await mongoDb.collection('transaction_risk_assessments').deleteMany({
          transactionId: { $in: createdTestTxnIds }
        });
        await mongoDb.collection('fraud_alerts').deleteMany({
          transactionId: { $in: createdTestTxnIds }
        });
      }
      const ph = createdTestTxnIds.map(() => '?').join(',');
      await query(`DELETE FROM fraud_outbox_events WHERE transaction_id IN (${ph})`, createdTestTxnIds).catch(() => {});
      await query(`DELETE FROM bank_transactions WHERE transaction_id IN (${ph})`, createdTestTxnIds).catch(() => {});
    }
    clearRuleCache();
    await closeMongo();
    await pool.end();
  });

  // ----------------------------------------------------------------------------
  // 1. ₹60,000 High-Amount Evaluation
  // ----------------------------------------------------------------------------
  it('1. should correctly evaluate ₹60,000 against high-amount rule without double-conversion', async () => {
    const txId = BASE_TEST_TX_ID + 1;
    createdTestTxnIds.push(txId);

    const rule = await getRuleByCode('HIGH_AMOUNT');
    assert.ok(rule, 'HIGH_AMOUNT rule must be configured in MongoDB');
    assert.equal(rule.threshold, 5000000, 'Threshold must be 5,000,000 paise (₹50,000.00)');

    // Direct rule evaluation
    const ruleResult = await evaluateHighAmount({ amount: 6000000 }, rule);
    assert.equal(ruleResult.triggered, true, '₹60,000 (6,000,000 paise) must trigger rule');
    assert.equal(ruleResult.points, rule.weight, 'Points awarded must match rule weight');
    assert.ok(ruleResult.description.includes('₹60,000.00'), 'Description must format exact amount in rupees');

    // Engine evaluation with amount in rupees
    const evalRupees = await evaluateTransaction({
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      transactionType: 'TRANSFER',
      amount: 60000.0
    }, {}, { checkExisting: false });

    assert.equal(evalRupees.assessment.amount, 6000000, 'Assessment amount must be stored as 6,000,000 integer paise');

    // Engine evaluation with isPaise: true (from buildTransactionContext)
    const txIdPaise = BASE_TEST_TX_ID + 2;
    createdTestTxnIds.push(txIdPaise);
    const evalPaise = await evaluateTransaction({
      transactionId: txIdPaise,
      customerId: 1,
      accountId: 1,
      transactionType: 'TRANSFER',
      amount: 6000000,
      isPaise: true
    }, {}, { checkExisting: false });

    assert.equal(evalPaise.assessment.amount, 6000000, 'Amount with isPaise: true must remain 6,000,000 paise without double-conversion');
  });

  // ----------------------------------------------------------------------------
  // 2. Exact Threshold Boundary
  // ----------------------------------------------------------------------------
  it('2. should verify strict inequality threshold boundary: 50,000.00 does not trigger, 50,000.01 triggers', async () => {
    const rule = await getRuleByCode('HIGH_AMOUNT');
    const thresholdPaise = rule.threshold; // 5000000 paise

    // Exact threshold: 5,000,000 paise (₹50,000.00)
    const atThreshold = await evaluateHighAmount({ amount: thresholdPaise }, rule);
    assert.equal(atThreshold.triggered, false, 'Exact threshold amount (₹50,000.00) must NOT trigger (amount > threshold is false)');

    // Exceeds by 1 paisa: 5,000,001 paise (₹50,000.01)
    const aboveThreshold = await evaluateHighAmount({ amount: thresholdPaise + 1 }, rule);
    assert.equal(aboveThreshold.triggered, true, 'Amount of ₹50,000.01 (5,000,001 paise) must trigger');
  });

  // ----------------------------------------------------------------------------
  // 3. Three Transactions within Two Minutes (Velocity Count Logic)
  // ----------------------------------------------------------------------------
  it('3. should verify three transactions within two minutes does not trigger threshold of 3', async () => {
    const rule = await getRuleByCode('HIGH_VELOCITY');
    assert.equal(rule.threshold, 3, 'Velocity threshold must be configured as 3 in MongoDB');

    // At transaction 3: caller historical count = 2, current tx = +1 => total = 3
    const contextTx3 = {
      recentTransactionCount: 2,
      includeCurrentTransaction: false
    };

    const resTx3 = await evaluateHighVelocity({ transactionId: 1003 }, rule, contextTx3);
    assert.equal(resTx3.triggered, false, 'Transaction 3 (total count = 3) must NOT trigger velocity rule because 3 > 3 is false');
  });

  // ----------------------------------------------------------------------------
  // 4. Four Transactions within Two Minutes (Triggers Velocity Rule)
  // ----------------------------------------------------------------------------
  it('4. should verify four transactions within two minutes triggers threshold of 3', async () => {
    const rule = await getRuleByCode('HIGH_VELOCITY');

    // At transaction 4: caller historical count = 3, current tx = +1 => total = 4
    const contextTx4 = {
      recentTransactionCount: 3,
      includeCurrentTransaction: false
    };

    const resTx4 = await evaluateHighVelocity({ transactionId: 1004 }, rule, contextTx4);
    assert.equal(resTx4.triggered, true, 'Transaction 4 (total count = 4) must trigger velocity rule because 4 > 3 is true');
    assert.equal(resTx4.points, rule.weight, 'Points awarded must equal configured HIGH_VELOCITY weight');
    assert.ok(resTx4.description.includes('observed 4 transactions'), 'Description must report observed count 4');
  });

  // ----------------------------------------------------------------------------
  // 5. Current Transaction Not Double-Counted
  // ----------------------------------------------------------------------------
  it('5. should ensure current transaction is not double-counted when already included', async () => {
    const rule = await getRuleByCode('HIGH_VELOCITY');

    // Scenario A: Caller already included current transaction (count = 3, includeCurrentTransaction = true)
    const contextA = {
      recentTransactionCount: 3,
      includeCurrentTransaction: true
    };
    const resA = await evaluateHighVelocity({ transactionId: 1005 }, rule, contextA);
    assert.equal(resA.triggered, false, 'Pre-computed count of 3 with current included must evaluate to 3 (does not trigger)');

    // Scenario B: Caller passed array that already contains current transaction
    const contextB = {
      recentTransactions: [
        { transactionId: 1001 },
        { transactionId: 1002 },
        { transactionId: 1005 } // current transaction
      ],
      includeCurrentTransaction: false
    };
    const resB = await evaluateHighVelocity({ transactionId: 1005 }, rule, contextB);
    assert.equal(resB.triggered, false, 'Array already containing current transaction must not be incremented again (count = 3)');
  });

  // ----------------------------------------------------------------------------
  // 6. Historical Transactions from Another Account Not Counted
  // ----------------------------------------------------------------------------
  it('6. should ensure velocity query only counts transactions for the specified account', async () => {
    const targetAccountId = 1;
    const foreignAccountId = 2;
    const now = new Date();

    // Insert 2 transactions for foreignAccountId
    const insForeign = await query(
      `INSERT INTO bank_transactions
       (transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
       VALUES
       (?, 'TRANSFER', 500.00, ?, 3, 2, 'Foreign tx 1', ?),
       (?, 'TRANSFER', 500.00, ?, 3, 2, 'Foreign tx 2', ?)`,
      [
        `TXN-TEST-REG-F1-${Date.now()}`, foreignAccountId, now,
        `TXN-TEST-REG-F2-${Date.now()}`, foreignAccountId, now
      ]
    );

    // Insert 1 transaction for targetAccountId
    const insTarget = await query(
      `INSERT INTO bank_transactions
       (transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
       VALUES (?, 'TRANSFER', 500.00, ?, 3, 2, 'Target tx', ?)`,
      [`TXN-TEST-REG-T1-${Date.now()}`, targetAccountId, now]
    );

    const targetTxId = insTarget.insertId;
    createdTestTxnIds.push(targetTxId);
    createdTestTxnIds.push(insForeign.insertId);
    createdTestTxnIds.push(insForeign.insertId + 1);

    // Build context for target transaction
    const { context } = await buildTransactionContext(targetTxId, { velocityWindowMinutes: 5 });

    // The foreign transactions must NOT be counted in target transaction's velocity
    // Only previous transactions on target account (or 0 if this was the only one) are counted
    const targetOtherRows = await query(
      `SELECT COUNT(*) AS c FROM bank_transactions
       WHERE (source_account_id = ? OR destination_account_id = ?)
         AND created_at >= (? - INTERVAL 5 MINUTE)
         AND created_at <= ?
         AND transaction_id != ?`,
      [targetAccountId, targetAccountId, now, now, targetTxId]
    );
    const expectedTargetCount = Number(targetOtherRows[0].c);
    assert.equal(context.recentTransactionCount, expectedTargetCount, 'Velocity context must only count target account transactions');
  });

  // ----------------------------------------------------------------------------
  // 7. Correct Score Calculation Using MongoDB-Configured Weights
  // ----------------------------------------------------------------------------
  it('7. should calculate risk score by summing MongoDB-configured weights', async () => {
    const rules = await getEnabledRules();
    const highAmountRule = rules.find((r) => r.ruleCode === 'HIGH_AMOUNT');
    const highVelocityRule = rules.find((r) => r.ruleCode === 'HIGH_VELOCITY');

    assert.ok(highAmountRule && highVelocityRule, 'Rules must exist in MongoDB');
    assert.equal(highAmountRule.weight, 30);
    assert.equal(highVelocityRule.weight, 25);

    const txId = BASE_TEST_TX_ID + 10;
    createdTestTxnIds.push(txId);

    // Evaluate daytime transaction where HIGH_AMOUNT and HIGH_VELOCITY both trigger
    const daytime = new Date('2026-11-05T09:00:00.000Z'); // 14:30 IST (normal hours)
    const result = await evaluateTransaction({
      transactionId: txId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 184,
      transactionType: 'TRANSFER',
      amount: 60000.0,
      timestamp: daytime
    }, {
      recentTransactionCount: 4, // > 3 threshold triggers velocity
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    }, { checkExisting: false });

    // Score must be exact sum: 30 + 25 = 55
    assert.equal(result.assessment.riskScore, 55, 'Risk score must be 55 (30 + 25)');
    assert.equal(result.assessment.riskLevel, 'MEDIUM', 'Score 55 must classify as MEDIUM (30–59)');
    assert.equal(result.assessment.decision, 'REVIEW_REQUIRED');
  });

  // ----------------------------------------------------------------------------
  // 8. Alert Generation on Triggered Rules (Policy Alignment)
  // ----------------------------------------------------------------------------
  it('8. should generate alerts for any assessment with triggered rules, and none when zero rules trigger', async () => {
    // A. Assessment with ZERO triggered rules -> NO alert
    const txZeroId = BASE_TEST_TX_ID + 19;
    createdTestTxnIds.push(txZeroId);
    const resZero = await evaluateTransaction({
      transactionId: txZeroId,
      customerId: 1,
      accountId: 1,
      transactionType: 'TRANSFER',
      amount: 1000.0,
      timestamp: new Date('2026-11-05T09:00:00.000Z')
    }, {
      recentTransactionCount: 0,
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    }, { checkExisting: false });

    assert.equal(resZero.alert, null, 'Assessment with zero triggered rules must NOT generate an alert');

    // B. MEDIUM assessment with triggered rules (score 55 = HIGH_AMOUNT 30 + HIGH_VELOCITY 25) -> Alert generated
    const txMediumId = BASE_TEST_TX_ID + 20;
    createdTestTxnIds.push(txMediumId);
    const resMedium = await evaluateTransaction({
      transactionId: txMediumId,
      customerId: 1,
      accountId: 1,
      transactionType: 'TRANSFER',
      amount: 60000.0,
      timestamp: new Date('2026-11-05T09:00:00.000Z')
    }, {
      recentTransactionCount: 4,
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    }, { checkExisting: false });

    assert.ok(resMedium.alert, 'MEDIUM risk assessment with triggered rules MUST generate an alert');
    assert.equal(resMedium.alert.riskLevel, 'MEDIUM');

    // B. HIGH assessment (score 75 = HIGH_AMOUNT 30 + HIGH_VELOCITY 25 + UNUSUAL_HOUR 20) -> Alert generated
    const txHighId = BASE_TEST_TX_ID + 21;
    createdTestTxnIds.push(txHighId);
    const nightTime = new Date('2026-11-05T21:30:00.000Z'); // 03:00 AM IST (triggers UNUSUAL_HOUR)
    const resHigh = await evaluateTransaction({
      transactionId: txHighId,
      customerId: 1,
      accountId: 1,
      transactionType: 'TRANSFER',
      amount: 60000.0,
      timestamp: nightTime
    }, {
      recentTransactionCount: 4,
      includeCurrentTransaction: false,
      isNewBeneficiary: false
    }, { checkExisting: false });

    assert.equal(resHigh.assessment.riskScore, 75);
    assert.equal(resHigh.assessment.riskLevel, 'HIGH');
    assert.ok(resHigh.alert, 'HIGH risk assessment must generate a fraud alert');
    assert.equal(resHigh.alert.riskLevel, 'HIGH');

    // C. CRITICAL assessment (score 100 = all 4 rules trigger) -> Alert generated
    const txCriticalId = BASE_TEST_TX_ID + 22;
    createdTestTxnIds.push(txCriticalId);
    const resCritical = await evaluateTransaction({
      transactionId: txCriticalId,
      customerId: 1,
      accountId: 1,
      destinationAccountId: 9999,
      transactionType: 'TRANSFER',
      amount: 60000.0,
      timestamp: nightTime
    }, {
      recentTransactionCount: 4,
      includeCurrentTransaction: false,
      isNewBeneficiary: true
    }, { checkExisting: false });

    assert.equal(resCritical.assessment.riskScore, 100);
    assert.equal(resCritical.assessment.riskLevel, 'CRITICAL');
    assert.ok(resCritical.alert, 'CRITICAL risk assessment must generate a fraud alert');
    assert.equal(resCritical.alert.riskLevel, 'CRITICAL');
  });

  // ----------------------------------------------------------------------------
  // 9. Correct Transaction Type Hydration
  // ----------------------------------------------------------------------------
  it('9. should correctly hydrate transaction type from MySQL or MongoDB assessment fallback', async () => {
    // A. From MySQL: create a test transaction in MySQL
    const liveTxId = BASE_TEST_TX_ID + 50;
    await query(
      `INSERT INTO bank_transactions
       (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
       VALUES (?, ?, 'TRANSFER', 60000.00, 1, 2, 4, 'Live type hydration test', NOW())`,
      [liveTxId, `TXN-HYDRATE-TYPE-${liveTxId}`]
    );
    createdTestTxnIds.push(liveTxId);

    const hydratedMap = await hydrateBankingTransactions([liveTxId]);
    const liveTx = hydratedMap.get(liveTxId);
    assert.ok(liveTx, `Transaction ${liveTxId} must be hydrated`);
    assert.equal(liveTx.transactionType, 'TRANSFER');
    assert.equal(liveTx.isArchived, false);

    // B. From Assessment fallback: alert transaction in MongoDB only (not in MySQL)
    const fallbackTxId = BASE_TEST_TX_ID + 51;
    await mongoDb.collection('transaction_risk_assessments').insertOne({
      transactionId: fallbackTxId,
      customerId: 1,
      accountId: 1,
      transactionType: 'TRANSFER',
      amount: 5000000,
      riskScore: 70,
      riskLevel: 'HIGH',
      decision: 'FLAGGED',
      assessedAt: new Date()
    });
    createdTestTxnIds.push(fallbackTxId);

    const fallbackMap = await hydrateBankingTransactions([fallbackTxId]);
    const archivedTx = fallbackMap.get(fallbackTxId);
    assert.ok(archivedTx, `Transaction ${fallbackTxId} must be hydrated from risk assessment fallback`);
    assert.equal(archivedTx.transactionType, 'TRANSFER', 'Must hydrate exact transaction type from assessment');
    assert.equal(archivedTx.isArchived, true, 'Must indicate isArchived: true');
  });

  // ----------------------------------------------------------------------------
  // 10. Correct Amount Hydration
  // ----------------------------------------------------------------------------
  it('10. should correctly hydrate amount in rupees from MySQL and from integer paise in Mongo assessment', async () => {
    // A. From MySQL: liveTxId has amount 60000.00
    const liveTxId = BASE_TEST_TX_ID + 60;
    await query(
      `INSERT INTO bank_transactions
       (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
       VALUES (?, ?, 'TRANSFER', 60000.00, 1, 2, 4, 'Live amount hydration test', NOW())`,
      [liveTxId, `TXN-HYDRATE-AMT-${liveTxId}`]
    );
    createdTestTxnIds.push(liveTxId);

    const hydratedMap = await hydrateBankingTransactions([liveTxId]);
    const liveTx = hydratedMap.get(liveTxId);
    assert.ok(liveTx, `Transaction ${liveTxId} must be hydrated`);
    assert.equal(liveTx.amountFormatted, '60000.00');
    assert.equal(liveTx.amount, 60000);

    // B. From Assessment fallback: fallbackTxId has 750000000 paise in assessment
    const fallbackTxId = BASE_TEST_TX_ID + 61;
    await mongoDb.collection('transaction_risk_assessments').insertOne({
      transactionId: fallbackTxId,
      customerId: 1,
      accountId: 1,
      transactionType: 'TRANSFER',
      amount: 750000000,
      riskScore: 80,
      riskLevel: 'CRITICAL',
      decision: 'FLAGGED',
      assessedAt: new Date()
    });
    createdTestTxnIds.push(fallbackTxId);

    const fallbackMap = await hydrateBankingTransactions([fallbackTxId]);
    const archivedTx = fallbackMap.get(fallbackTxId);
    assert.ok(archivedTx, `Transaction ${fallbackTxId} must be hydrated from risk assessment fallback`);
    assert.equal(archivedTx.amountFormatted, '7500000.00', 'Amount formatted must be 7500000.00');
    assert.equal(archivedTx.amount, 7500000);
  });

  // ----------------------------------------------------------------------------
  // 11. Missing MySQL & Mongo Transaction Handling
  // ----------------------------------------------------------------------------
  it('11. should safely handle completely missing transactions with UNAVAILABLE status', async () => {
    const nonExistentId = 999999999;
    const hydratedMap = await hydrateBankingTransactions([nonExistentId]);
    assert.equal(hydratedMap.has(nonExistentId), false, 'Non-existent transaction must not be in hydrated map');

    // Test listAlerts behavior when transaction is completely unavailable
    // Insert a temporary test alert with no matching MySQL row or assessment
    const tempAlertRes = await mongoDb.collection('fraud_alerts').insertOne({
      transactionId: nonExistentId,
      customerId: 999,
      accountId: 999,
      riskScore: 85,
      riskLevel: 'CRITICAL',
      status: 'OPEN',
      reasons: ['Synthetic test alert for missing transaction'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const alertList = await listAlerts({ limit: 10 });
    const missingAlertItem = alertList.items.find((item) => item.transactionId === nonExistentId);

    assert.ok(missingAlertItem, 'Alert must be listed');
    assert.equal(missingAlertItem.transactionType, 'UNAVAILABLE', 'Transaction type must display UNAVAILABLE');
    assert.equal(missingAlertItem.isUnavailable, true, 'isUnavailable must be true');
    assert.equal(missingAlertItem.amountFormatted, null, 'amountFormatted must be null');

    // Clean up temporary alert
    await mongoDb.collection('fraud_alerts').deleteOne({ _id: tempAlertRes.insertedId });
  });

  // ----------------------------------------------------------------------------
  // 12. Rule Cache Invalidation
  // ----------------------------------------------------------------------------
  it('12. should invalidate rule cache when rules are refreshed or cleared', async () => {
    clearRuleCache();

    // Initial cache population
    const cachedRules1 = await getEnabledRules();
    const initialAmountWeight = cachedRules1.find((r) => r.ruleCode === 'HIGH_AMOUNT').weight;
    assert.equal(initialAmountWeight, 30);

    // Modify document directly in MongoDB to simulate external configuration update
    await mongoDb.collection('fraud_rules').updateOne(
      { ruleCode: 'HIGH_AMOUNT' },
      { $set: { weight: 32 } }
    );

    // Without cache invalidation, cache still returns old weight (30)
    const cachedRules2 = await getEnabledRules();
    const staleWeight = cachedRules2.find((r) => r.ruleCode === 'HIGH_AMOUNT').weight;
    assert.equal(staleWeight, 30, 'In-memory cache must return cached weight until invalidated');

    // Clear cache
    clearRuleCache();

    // Cache must now reflect the updated MongoDB weight (32)
    const freshRules = await getEnabledRules();
    const freshWeight = freshRules.find((r) => r.ruleCode === 'HIGH_AMOUNT').weight;
    assert.equal(freshWeight, 32, 'After clearRuleCache(), repository must reload fresh weight from MongoDB');

    // Restore weight to calibrated 30
    await mongoDb.collection('fraud_rules').updateOne(
      { ruleCode: 'HIGH_AMOUNT' },
      { $set: { weight: 30 } }
    );
    clearRuleCache();

    const restoredRules = await getEnabledRules();
    assert.equal(restoredRules.find((r) => r.ruleCode === 'HIGH_AMOUNT').weight, 30, 'Restored weight must be 30');
  });
});
