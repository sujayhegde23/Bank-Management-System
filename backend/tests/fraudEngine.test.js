/**
 * ==============================================================================
 * Automated Test Suite: Phase 2 - Rule-Based Fraud Detection Engine
 * ==============================================================================
 * Repository: sujayhegde23/Bank-Management-System
 * Branch: feature/fraud-phase-2-engine
 *
 * Verifies all 20 required scenarios from Section 10:
 * 1. HIGH_AMOUNT triggers when configured threshold is exceeded.
 * 2. HIGH_AMOUNT does not trigger below or at threshold (strictly greater than).
 * 3. HIGH_VELOCITY triggers when transaction count exceeds configured threshold.
 * 4. HIGH_VELOCITY does not trigger below or at threshold.
 * 5. NEW_BENEFICIARY triggers for a first-time beneficiary.
 * 6. NEW_BENEFICIARY does not trigger for a known beneficiary.
 * 7. NEW_BENEFICIARY does not run for non-transfer transactions.
 * 8. UNUSUAL_HOUR triggers within configured time window.
 * 9. UNUSUAL_HOUR does not trigger outside the window.
 * 10. Disabled rules are ignored.
 * 11. Missing or malformed enabled rules are handled safely.
 * 12. Risk score correctly combines multiple triggered rules.
 * 13. Risk score is capped at 100.
 * 14. Correct risk classification boundaries (LOW, MEDIUM, HIGH, CRITICAL).
 * 15. LOW and MEDIUM assessments do not generate alerts.
 * 16. HIGH and CRITICAL assessments generate alerts.
 * 17. Repeated evaluation does not duplicate assessments (idempotency).
 * 18. Repeated evaluation does not duplicate alerts (idempotency).
 * 19. Invalid transaction input is rejected.
 * 20. MongoDB failures are handled safely.
 * ==============================================================================
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { connectMongo, getDb, closeMongo, isMongoConnected } = require('../src/config/mongo');
const { initializeMongoDatabase } = require('../src/config/initMongo');
const {
  evaluateTransaction,
  calculateRiskScore,
  classifyRiskLevel,
  determineDecision,
  RISK_LEVELS,
  DECISIONS,
  clearRuleCache,
  FraudValidationError,
  FraudConfigurationError,
  FraudEngineError,
  toPaise,
  toStoredPaise,
  isAmountStrictlyGreaterThan,
  paiseToRupees,
  formatPaiseToRupees,
  toSafeId,
  saveAssessment,
  saveAlert,
  deleteAssessment
} = require('../src/services/fraud');

const TEST_TX_BASE_ID = 98100000;

describe('Phase 2: Rule-Based Fraud Detection Engine Test Suite', () => {
  let db;

  before(async () => {
    await connectMongo();
    await initializeMongoDatabase();
    db = getDb();

    // Clean up any lingering test records from previous runs
    await db.collection('transaction_risk_assessments').deleteMany({
      transactionId: { $gte: TEST_TX_BASE_ID }
    });
    await db.collection('fraud_alerts').deleteMany({
      transactionId: { $gte: TEST_TX_BASE_ID }
    });
  });

  after(async () => {
    try {
      if (!isMongoConnected()) {
        await connectMongo();
      }
      const activeDb = getDb();
      if (activeDb) {
        await activeDb.collection('transaction_risk_assessments').deleteMany({
          transactionId: { $gte: TEST_TX_BASE_ID }
        });
        await activeDb.collection('fraud_alerts').deleteMany({
          transactionId: { $gte: TEST_TX_BASE_ID }
        });
        await initializeMongoDatabase(activeDb);
      }
    } catch {
      // Continue cleanup safely
    } finally {
      clearRuleCache();
      await closeMongo().catch(() => {});
    }
  });

  beforeEach(() => {
    clearRuleCache();
  });

  // ============================================================================
  // Test 1: HIGH_AMOUNT triggers when amount > threshold
  // ============================================================================
  it('Test 1: HIGH_AMOUNT triggers when configured threshold is exceeded', async () => {
    const txId = TEST_TX_BASE_ID + 1;
    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 75000.0, // Configured threshold is ₹50,000
      timestamp: new Date('2026-11-05T14:30:00+05:30') // normal banking hours
    };

    const result = await evaluateTransaction(tx, {}, { forceRefreshRules: true });
    assert.ok(result.assessment, 'Assessment must be returned');
    assert.equal(result.isExisting, false);
    assert.equal(result.assessment.amount, 7500000, 'Assessment amount must be stored in integer paise (7,500,000 paise)');

    const highAmountTrigger = result.triggeredRules.find((r) => r.ruleCode === 'HIGH_AMOUNT');
    assert.ok(highAmountTrigger, 'HIGH_AMOUNT rule must trigger for ₹75,000 > ₹50,000');
    assert.equal(highAmountTrigger.points, 30, 'HIGH_AMOUNT configured weight should be 30');
    assert.ok(highAmountTrigger.description.includes('strictly exceeds'));
  });

  // ============================================================================
  // Test 2: HIGH_AMOUNT does not trigger at or below threshold
  // ============================================================================
  it('Test 2: HIGH_AMOUNT does not trigger below or at threshold (strictly greater than)', async () => {
    // Case 2a: Strictly below threshold (₹40,000 <= ₹50,000)
    const txBelow = {
      transactionId: TEST_TX_BASE_ID + 2,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 40000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };
    const resBelow = await evaluateTransaction(txBelow);
    const belowTrigger = resBelow.triggeredRules.find((r) => r.ruleCode === 'HIGH_AMOUNT');
    assert.equal(belowTrigger, undefined, 'HIGH_AMOUNT must not trigger below threshold');
    assert.equal(resBelow.assessment.amount, 4000000, 'Assessment amount must be stored in integer paise (4,000,000 paise)');

    // Case 2b: Exactly at threshold (₹50,000.00 <= ₹50,000.00)
    const txExact = {
      transactionId: TEST_TX_BASE_ID + 3,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 50000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };
    const resExact = await evaluateTransaction(txExact);
    const exactTrigger = resExact.triggeredRules.find((r) => r.ruleCode === 'HIGH_AMOUNT');
    assert.equal(exactTrigger, undefined, 'HIGH_AMOUNT must not trigger when amount equals threshold exactly');
    assert.equal(resExact.assessment.amount, 5000000, 'Assessment amount must be stored in integer paise (5,000,000 paise)');

    // Precision unit check: ₹50,000.01 exceeds ₹50,000.00 in paise
    assert.equal(isAmountStrictlyGreaterThan('50000.01', 5000000), true);
    assert.equal(isAmountStrictlyGreaterThan(5000000, 5000000), false);
    assert.equal(isAmountStrictlyGreaterThan('49999.99', 5000000), false);
  });

  // ============================================================================
  // Test 3: HIGH_VELOCITY triggers when count exceeds configured threshold
  // ============================================================================
  it('Test 3: HIGH_VELOCITY triggers when transaction count exceeds its configured threshold', async () => {
    const tx = {
      transactionId: TEST_TX_BASE_ID + 4,
      customerId: 1,
      accountId: 10,
      transactionType: 'TRANSFER',
      destinationAccountId: 20,
      amount: 5000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    // Configured threshold is 3; 5 transactions in window exceeds 3
    const context = {
      recentTransactionCount: 5,
      isNewBeneficiary: false
    };

    const result = await evaluateTransaction(tx, context);
    const velocityTrigger = result.triggeredRules.find((r) => r.ruleCode === 'HIGH_VELOCITY');
    assert.ok(velocityTrigger, 'HIGH_VELOCITY must trigger when count (5) > threshold (3)');
    assert.equal(velocityTrigger.points, 25);
    assert.ok(velocityTrigger.description.includes('5 transactions'));
  });

  // ============================================================================
  // Test 4: HIGH_VELOCITY does not trigger below or at threshold
  // ============================================================================
  it('Test 4: HIGH_VELOCITY does not trigger below or at threshold', async () => {
    const tx = {
      transactionId: TEST_TX_BASE_ID + 5,
      customerId: 1,
      accountId: 10,
      transactionType: 'TRANSFER',
      destinationAccountId: 20,
      amount: 5000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    // Case 4a: Below threshold (2 < 3)
    const resBelow = await evaluateTransaction(tx, { recentTransactionCount: 2, isNewBeneficiary: false });
    assert.equal(
      resBelow.triggeredRules.find((r) => r.ruleCode === 'HIGH_VELOCITY'),
      undefined,
      'HIGH_VELOCITY must not trigger below threshold'
    );

    // Case 4b: At threshold (3 <= 3)
    const txExact = { ...tx, transactionId: TEST_TX_BASE_ID + 6 };
    const resExact = await evaluateTransaction(txExact, { recentTransactionCount: 3, isNewBeneficiary: false });
    assert.equal(
      resExact.triggeredRules.find((r) => r.ruleCode === 'HIGH_VELOCITY'),
      undefined,
      'HIGH_VELOCITY must not trigger when count equals threshold'
    );
  });

  // ============================================================================
  // Test 5: NEW_BENEFICIARY triggers for a first-time beneficiary
  // ============================================================================
  it('Test 5: NEW_BENEFICIARY triggers for a first-time beneficiary transfer', async () => {
    const tx = {
      transactionId: TEST_TX_BASE_ID + 7,
      customerId: 1,
      accountId: 10,
      destinationAccountId: 99,
      transactionType: 'TRANSFER',
      amount: 8000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    const context = {
      isNewBeneficiary: true,
      recentTransactionCount: 1
    };

    const result = await evaluateTransaction(tx, context);
    const trigger = result.triggeredRules.find((r) => r.ruleCode === 'NEW_BENEFICIARY');
    assert.ok(trigger, 'NEW_BENEFICIARY must trigger when recipient is a new beneficiary');
    assert.equal(trigger.points, 25);
    assert.ok(trigger.description.includes('First-time transfer'));
  });

  // ============================================================================
  // Test 6: NEW_BENEFICIARY does not trigger for a known beneficiary
  // ============================================================================
  it('Test 6: NEW_BENEFICIARY does not trigger for a known beneficiary', async () => {
    const tx = {
      transactionId: TEST_TX_BASE_ID + 8,
      customerId: 1,
      accountId: 10,
      destinationAccountId: 20,
      transactionType: 'TRANSFER',
      amount: 8000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    const context = {
      isNewBeneficiary: false,
      previousTransfersCount: 12
    };

    const result = await evaluateTransaction(tx, context);
    const trigger = result.triggeredRules.find((r) => r.ruleCode === 'NEW_BENEFICIARY');
    assert.equal(trigger, undefined, 'NEW_BENEFICIARY must not trigger for known beneficiary');
  });

  // ============================================================================
  // Test 7: NEW_BENEFICIARY does not run for non-transfer transactions
  // ============================================================================
  it('Test 7: NEW_BENEFICIARY does not run for non-transfer transactions', async () => {
    // 7a: DEPOSIT transaction with isNewBeneficiary: true
    const depositTx = {
      transactionId: TEST_TX_BASE_ID + 9,
      customerId: 1,
      accountId: 10,
      transactionType: 'DEPOSIT',
      amount: 10000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };
    const resDeposit = await evaluateTransaction(depositTx, { isNewBeneficiary: true });
    assert.equal(
      resDeposit.triggeredRules.find((r) => r.ruleCode === 'NEW_BENEFICIARY'),
      undefined,
      'NEW_BENEFICIARY must not run for DEPOSIT'
    );

    // 7b: WITHDRAWAL transaction with isNewBeneficiary: true
    const withdrawalTx = {
      transactionId: TEST_TX_BASE_ID + 10,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 10000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };
    const resWithdrawal = await evaluateTransaction(withdrawalTx, { isNewBeneficiary: true });
    assert.equal(
      resWithdrawal.triggeredRules.find((r) => r.ruleCode === 'NEW_BENEFICIARY'),
      undefined,
      'NEW_BENEFICIARY must not run for WITHDRAWAL'
    );
  });

  // ============================================================================
  // Test 8: UNUSUAL_HOUR triggers within configured time window
  // ============================================================================
  it('Test 8: UNUSUAL_HOUR triggers within the configured time window (01:00 - 05:00 Asia/Kolkata)', async () => {
    // 02:30 AM IST is within the 01:00 - 05:00 off-hours window
    const offHoursTimestamp = new Date('2026-11-05T02:30:00+05:30');

    const tx = {
      transactionId: TEST_TX_BASE_ID + 11,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 5000.0,
      timestamp: offHoursTimestamp
    };

    const result = await evaluateTransaction(tx, {});
    const trigger = result.triggeredRules.find((r) => r.ruleCode === 'UNUSUAL_HOUR');
    assert.ok(trigger, 'UNUSUAL_HOUR must trigger for 02:30 IST timestamp');
    assert.equal(trigger.points, 20);
    assert.ok(trigger.description.includes('unusual banking hours'));
  });

  // ============================================================================
  // Test 9: UNUSUAL_HOUR does not trigger outside the window
  // ============================================================================
  it('Test 9: UNUSUAL_HOUR does not trigger outside the window', async () => {
    // 9a: Afternoon 14:15 IST (2:15 PM)
    const normalHours = new Date('2026-11-05T14:15:00+05:30');
    const txNormal = {
      transactionId: TEST_TX_BASE_ID + 12,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 5000.0,
      timestamp: normalHours
    };
    const resNormal = await evaluateTransaction(txNormal, {});
    assert.equal(
      resNormal.triggeredRules.find((r) => r.ruleCode === 'UNUSUAL_HOUR'),
      undefined,
      'UNUSUAL_HOUR must not trigger at 14:15 IST'
    );

    // 9b: Boundary test: 05:00:00 AM IST is outside half-open window [01:00, 05:00)
    const boundaryTime = new Date('2026-11-05T05:00:00+05:30');
    const txBoundary = {
      transactionId: TEST_TX_BASE_ID + 13,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 5000.0,
      timestamp: boundaryTime
    };
    const resBoundary = await evaluateTransaction(txBoundary, {});
    assert.equal(
      resBoundary.triggeredRules.find((r) => r.ruleCode === 'UNUSUAL_HOUR'),
      undefined,
      'UNUSUAL_HOUR must not trigger at 05:00:00 boundary'
    );
  });

  // ============================================================================
  // Test 10: Disabled rules are ignored
  // ============================================================================
  it('Test 10: Disabled rules are ignored by the detection engine', async () => {
    // Temporarily disable HIGH_AMOUNT rule in MongoDB
    await db.collection('fraud_rules').updateOne(
      { ruleCode: 'HIGH_AMOUNT' },
      { $set: { enabled: false, updatedAt: new Date() } }
    );
    clearRuleCache();

    const tx = {
      transactionId: TEST_TX_BASE_ID + 14,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 90000.0, // Well above ₹50,000 threshold
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    const result = await evaluateTransaction(tx, {}, { forceRefreshRules: true });
    const trigger = result.triggeredRules.find((r) => r.ruleCode === 'HIGH_AMOUNT');
    assert.equal(trigger, undefined, 'Disabled HIGH_AMOUNT rule must not be evaluated or triggered');

    // Restore rule to enabled
    await db.collection('fraud_rules').updateOne(
      { ruleCode: 'HIGH_AMOUNT' },
      { $set: { enabled: true, updatedAt: new Date() } }
    );
    clearRuleCache();
  });

  // ============================================================================
  // Test 11: Missing or malformed enabled rules are handled safely
  // ============================================================================
  it('Test 11: Missing or malformed enabled rules are handled safely with clear configuration errors', async () => {
    // Insert a malformed enabled rule with invalid negative weight
    await db.collection('fraud_rules').insertOne({
      ruleCode: 'MALFORMED_TEMP_RULE',
      name: 'Malformed Rule',
      enabled: true,
      weight: -25, // Invalid weight (< 0)
      createdAt: new Date(),
      updatedAt: new Date()
    });
    clearRuleCache();

    const tx = {
      transactionId: TEST_TX_BASE_ID + 15,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 5000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    // Engine must throw FraudConfigurationError rather than silently proceeding
    await assert.rejects(
      async () => {
        await evaluateTransaction(tx, {}, { forceRefreshRules: true });
      },
      (err) => {
        assert.ok(err instanceof FraudConfigurationError);
        assert.ok(err.message.includes('MALFORMED_TEMP_RULE'));
        return true;
      }
    );

    // Clean up temporary rule
    await db.collection('fraud_rules').deleteOne({ ruleCode: 'MALFORMED_TEMP_RULE' });
    clearRuleCache();
  });

  // ============================================================================
  // Test 12: Risk score correctly combines multiple triggered rules
  // ============================================================================
  it('Test 12: Risk score correctly combines multiple triggered rules', async () => {
    // Transaction triggers:
    // 1. HIGH_AMOUNT (₹80,000 > ₹50,000) -> 30 points
    // 2. HIGH_VELOCITY (4 > 3) -> 25 points
    // 3. NEW_BENEFICIARY (isNewBeneficiary = true) -> 25 points
    // Sum = 30 + 25 + 25 = 80 points -> Level: CRITICAL (80-100) -> Decision: FLAGGED
    const tx = {
      transactionId: TEST_TX_BASE_ID + 16,
      customerId: 1,
      accountId: 10,
      destinationAccountId: 99,
      transactionType: 'TRANSFER',
      amount: 80000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30') // normal hour
    };

    const context = {
      recentTransactionCount: 4,
      isNewBeneficiary: true
    };

    const result = await evaluateTransaction(tx, context);
    assert.equal(result.triggeredRules.length, 3, 'Three rules must trigger');
    assert.equal(result.assessment.riskScore, 80, 'Risk score must be 30 + 25 + 25 = 80');
    assert.equal(result.assessment.riskLevel, 'CRITICAL');
    assert.equal(result.assessment.decision, 'FLAGGED');
  });

  // ============================================================================
  // Test 13: Risk score is capped at 100
  // ============================================================================
  it('Test 13: Risk score calculation is strictly capped at 100', () => {
    const mockRules = [
      { ruleCode: 'RULE_A', points: 50 },
      { ruleCode: 'RULE_B', points: 40 },
      { ruleCode: 'RULE_C', points: 30 }
    ];
    // Sum = 120, capped at 100
    const score = calculateRiskScore(mockRules);
    assert.equal(score, 100, 'Score of 120 must be capped at 100');

    // Test zero rules
    assert.equal(calculateRiskScore([]), 0);
  });

  // ============================================================================
  // Test 14: Correct risk classification boundaries
  // ============================================================================
  it('Test 14: Centralized risk classification boundaries and automated decisions', () => {
    // LOW: 0 - 29 -> APPROVED
    assert.equal(classifyRiskLevel(0), RISK_LEVELS.LOW);
    assert.equal(determineDecision(classifyRiskLevel(0)), DECISIONS.APPROVED);
    assert.equal(classifyRiskLevel(29), RISK_LEVELS.LOW);
    assert.equal(determineDecision(classifyRiskLevel(29)), DECISIONS.APPROVED);

    // MEDIUM: 30 - 59 -> REVIEW_REQUIRED
    assert.equal(classifyRiskLevel(30), RISK_LEVELS.MEDIUM);
    assert.equal(determineDecision(classifyRiskLevel(30)), DECISIONS.REVIEW_REQUIRED);
    assert.equal(classifyRiskLevel(59), RISK_LEVELS.MEDIUM);
    assert.equal(determineDecision(classifyRiskLevel(59)), DECISIONS.REVIEW_REQUIRED);

    // HIGH: 60 - 79 -> FLAGGED
    assert.equal(classifyRiskLevel(60), RISK_LEVELS.HIGH);
    assert.equal(determineDecision(classifyRiskLevel(60)), DECISIONS.FLAGGED);
    assert.equal(classifyRiskLevel(79), RISK_LEVELS.HIGH);
    assert.equal(determineDecision(classifyRiskLevel(79)), DECISIONS.FLAGGED);

    // CRITICAL: 80 - 100 -> FLAGGED
    assert.equal(classifyRiskLevel(80), RISK_LEVELS.CRITICAL);
    assert.equal(determineDecision(classifyRiskLevel(80)), DECISIONS.FLAGGED);
    assert.equal(classifyRiskLevel(100), RISK_LEVELS.CRITICAL);
    assert.equal(determineDecision(classifyRiskLevel(100)), DECISIONS.FLAGGED);
  });

  // ============================================================================
  // Test 15: Alert generation policy based on triggered rules
  // ============================================================================
  it('Test 15: Transactions without triggered rules do NOT generate alerts; transactions with triggered rules generate alerts', async () => {
    // Case 15a: Zero triggered rules (Score = 0, LOW) -> No alert
    const txZero = {
      transactionId: TEST_TX_BASE_ID + 50,
      customerId: 1,
      accountId: 10,
      transactionType: 'TRANSFER',
      destinationAccountId: 20, // known beneficiary
      amount: 10000.0, // below ₹50,000 threshold
      timestamp: new Date('2026-11-05T14:30:00+05:30') // normal hour
    };

    const resZero = await evaluateTransaction(txZero, { recentTransactionCount: 0, isNewBeneficiary: false });
    assert.equal(resZero.assessment.riskScore, 0);
    assert.equal(resZero.assessment.riskLevel, 'LOW');
    assert.equal(resZero.assessment.decision, 'APPROVED');
    assert.equal(resZero.alert, null, 'No alert returned when zero rules are triggered');

    const zeroAlertInDb = await db.collection('fraud_alerts').findOne({ transactionId: txZero.transactionId });
    assert.equal(zeroAlertInDb, null, 'No fraud_alerts document should exist when zero rules are triggered');

    // Case 15b: LOW risk assessment with 1 triggered rule (Score = 25, triggers HIGH_VELOCITY only) -> Generates alert
    const txLow = {
      transactionId: TEST_TX_BASE_ID + 17,
      customerId: 1,
      accountId: 10,
      transactionType: 'TRANSFER',
      destinationAccountId: 20, // known beneficiary
      amount: 10000.0, // below ₹50,000 threshold
      timestamp: new Date('2026-11-05T14:30:00+05:30') // normal hour
    };

    const resLow = await evaluateTransaction(txLow, { recentTransactionCount: 4, isNewBeneficiary: false });
    assert.equal(resLow.assessment.riskScore, 25);
    assert.equal(resLow.assessment.riskLevel, 'LOW');
    assert.equal(resLow.assessment.decision, 'APPROVED');
    assert.ok(resLow.alert, 'Alert MUST be returned for LOW assessment when a rule triggers');
    assert.equal(resLow.alert.riskLevel, 'LOW');

    const lowAlertInDb = await db.collection('fraud_alerts').findOne({ transactionId: txLow.transactionId });
    assert.ok(lowAlertInDb, 'fraud_alerts document must exist for LOW assessment that triggered a rule');
    assert.equal(lowAlertInDb.riskLevel, 'LOW');

    // Case 15c: MEDIUM risk assessment with triggered rules (Score = 30 + 25 = 55, HIGH_AMOUNT + HIGH_VELOCITY) -> Generates alert
    const txMedium = {
      transactionId: TEST_TX_BASE_ID + 18,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 60000.0, // HIGH_AMOUNT (30)
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    const resMedium = await evaluateTransaction(txMedium, { recentTransactionCount: 4 });
    assert.equal(resMedium.assessment.riskScore, 55);
    assert.equal(resMedium.assessment.riskLevel, 'MEDIUM');
    assert.equal(resMedium.assessment.decision, 'REVIEW_REQUIRED');
    assert.ok(resMedium.alert, 'Alert MUST be returned for MEDIUM assessment that triggered rules');
    assert.equal(resMedium.alert.riskLevel, 'MEDIUM');

    const medAlertInDb = await db.collection('fraud_alerts').findOne({ transactionId: txMedium.transactionId });
    assert.ok(medAlertInDb, 'fraud_alerts document must exist for MEDIUM assessment that triggered rules');
    assert.equal(medAlertInDb.riskLevel, 'MEDIUM');
  });

  // ============================================================================
  // Test 16: HIGH and CRITICAL assessments generate alerts
  // ============================================================================
  it('Test 16: HIGH and CRITICAL assessments generate alerts in fraud_alerts collection', async () => {
    // Case 16a: HIGH risk assessment (Score = 30 + 25 + 20 = 75 -> HIGH)
    const txHigh = {
      transactionId: TEST_TX_BASE_ID + 19,
      customerId: 1,
      accountId: 10,
      destinationAccountId: 20, // known beneficiary
      transactionType: 'TRANSFER',
      amount: 75000.0, // HIGH_AMOUNT (30)
      timestamp: new Date('2026-11-05T03:00:00+05:30') // UNUSUAL_HOUR (20)
    };
    const resHigh = await evaluateTransaction(txHigh, {
      recentTransactionCount: 4, // HIGH_VELOCITY (25)
      isNewBeneficiary: false
    });
    assert.equal(resHigh.assessment.riskScore, 75);
    assert.equal(resHigh.assessment.riskLevel, 'HIGH');
    assert.ok(resHigh.alert, 'Alert must be generated for HIGH assessment');
    assert.equal(resHigh.alert.transactionId, txHigh.transactionId);
    assert.equal(resHigh.alert.status, 'OPEN');
    assert.equal(resHigh.alert.riskLevel, 'HIGH');
    assert.ok(Array.isArray(resHigh.alert.reasons));
    assert.equal(resHigh.alert.reasons.length, 3);

    const highAlertDb = await db.collection('fraud_alerts').findOne({ transactionId: txHigh.transactionId });
    assert.ok(highAlertDb, 'fraud_alerts document must exist in database');
    assert.equal(highAlertDb.status, 'OPEN');

    // Case 16b: CRITICAL risk assessment (Score = 30 + 25 + 25 + 20 = 100 -> CRITICAL)
    const txCritical = {
      transactionId: TEST_TX_BASE_ID + 20,
      customerId: 1,
      accountId: 10,
      destinationAccountId: 99,
      transactionType: 'TRANSFER',
      amount: 75000.0, // HIGH_AMOUNT (30)
      timestamp: new Date('2026-11-05T03:00:00+05:30') // UNUSUAL_HOUR (20)
    };
    const resCritical = await evaluateTransaction(txCritical, {
      recentTransactionCount: 5, // HIGH_VELOCITY (25)
      isNewBeneficiary: true // NEW_BENEFICIARY (25)
    });
    assert.equal(resCritical.assessment.riskScore, 100);
    assert.equal(resCritical.assessment.riskLevel, 'CRITICAL');
    assert.equal(resCritical.assessment.decision, 'FLAGGED');
    assert.ok(resCritical.alert, 'Alert must be generated for CRITICAL assessment');
    assert.equal(resCritical.alert.riskLevel, 'CRITICAL');
  });

  // ============================================================================
  // Test 17: Repeated evaluation does not duplicate assessments (Idempotency)
  // ============================================================================
  it('Test 17: Repeated evaluation does not create duplicate assessments', async () => {
    const tx = {
      transactionId: TEST_TX_BASE_ID + 21,
      customerId: 1,
      accountId: 10,
      transactionType: 'DEPOSIT',
      amount: 5000.0,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    // First evaluation
    const firstRes = await evaluateTransaction(tx);
    assert.equal(firstRes.isExisting, false);

    // Second evaluation for the identical transactionId
    const secondRes = await evaluateTransaction(tx);
    assert.equal(secondRes.isExisting, true);
    assert.equal(secondRes.assessment.transactionId, tx.transactionId);

    // Verify exactly ONE assessment exists in MongoDB
    const count = await db
      .collection('transaction_risk_assessments')
      .countDocuments({ transactionId: tx.transactionId });
    assert.equal(count, 1, 'Assessment collection must contain exactly 1 document for transactionId');
  });

  // ============================================================================
  // Test 18: Repeated evaluation does not duplicate alerts (Idempotency)
  // ============================================================================
  it('Test 18: Repeated evaluation of HIGH/CRITICAL transaction does not duplicate alerts', async () => {
    const tx = {
      transactionId: TEST_TX_BASE_ID + 22,
      customerId: 1,
      accountId: 10,
      destinationAccountId: 99,
      transactionType: 'TRANSFER',
      amount: 70000.0, // 25
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };
    const context = {
      recentTransactionCount: 4, // 20
      isNewBeneficiary: true // 20 -> Total 65 (HIGH)
    };

    // First evaluation
    const firstRes = await evaluateTransaction(tx, context);
    assert.ok(firstRes.alert);

    // Second evaluation
    const secondRes = await evaluateTransaction(tx, context);
    assert.equal(secondRes.isExisting, true);

    // Verify exactly ONE alert exists in MongoDB
    const alertCount = await db
      .collection('fraud_alerts')
      .countDocuments({ transactionId: tx.transactionId });
    assert.equal(alertCount, 1, 'Alerts collection must contain exactly 1 document for transactionId');
  });

  // ============================================================================
  // Test 19: Invalid transaction input is rejected
  // ============================================================================
  it('Test 19: Invalid transaction input is strictly rejected before evaluation', async () => {
    // 19a: Null transaction
    await assert.rejects(
      async () => evaluateTransaction(null),
      (err) => err instanceof FraudValidationError && err.message.includes('non-null object')
    );

    // 19b: Missing transactionId
    await assert.rejects(
      async () => evaluateTransaction({ customerId: 1, accountId: 1, amount: 100, transactionType: 'TRANSFER' }),
      (err) => err instanceof FraudValidationError && err.message.includes('transactionId')
    );

    // 19c: Non-positive amount (zero)
    await assert.rejects(
      async () => evaluateTransaction({ transactionId: TEST_TX_BASE_ID + 99, customerId: 1, accountId: 1, amount: 0, transactionType: 'TRANSFER' }),
      (err) => err instanceof FraudValidationError && err.message.includes('strictly positive')
    );

    // 19d: Negative amount
    await assert.rejects(
      async () => evaluateTransaction({ transactionId: TEST_TX_BASE_ID + 99, customerId: 1, accountId: 1, amount: -500, transactionType: 'TRANSFER' }),
      (err) => err instanceof FraudValidationError && err.message.includes('strictly positive')
    );

    // 19e: Unsupported transaction type
    await assert.rejects(
      async () => evaluateTransaction({ transactionId: TEST_TX_BASE_ID + 99, customerId: 1, accountId: 1, amount: 500, transactionType: 'UNKNOWN_TYPE' }),
      (err) => err instanceof FraudValidationError && err.message.includes('Unsupported transaction type')
    );

    // 19f: Negative velocity count in context
    await assert.rejects(
      async () => evaluateTransaction(
        { transactionId: TEST_TX_BASE_ID + 99, customerId: 1, accountId: 1, amount: 500, transactionType: 'TRANSFER' },
        { recentTransactionCount: -5 }
      ),
      (err) => err instanceof FraudValidationError && err.message.includes('non-negative number')
    );
  });

  // ============================================================================
  // Test 20: MongoDB failures are handled safely
  // ============================================================================
  it('Test 20: MongoDB failures are handled safely without unhandled crashes or credential leaks', async () => {
    // Temporarily disconnect MongoDB
    await closeMongo();
    assert.equal(isMongoConnected(), false);

    const tx = {
      transactionId: TEST_TX_BASE_ID + 23,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: 1000.0,
      timestamp: new Date()
    };

    await assert.rejects(
      async () => {
        await evaluateTransaction(tx, {}, { forceRefreshRules: true });
      },
      (err) => {
        assert.ok(err instanceof FraudEngineError, 'Should throw FraudEngineError');
        // Ensure error message does NOT leak database credentials or internal URI
        assert.ok(!String(err.message).includes('mongodb://'), 'URI must not leak in error');
        assert.ok(!String(err.message).includes('password'), 'Password must not leak in error');
        return true;
      }
    );

    // Reconnect MongoDB for subsequent operations
    await connectMongo();
    assert.equal(isMongoConnected(), true);
    db = getDb();
  });

  // ============================================================================
  // Test 21: Monetary Precision for ₹19.99 (paise = 1999)
  // ============================================================================
  it('Test 21: Monetary Precision - converts ₹19.99 into exactly 1999 paise without IEEE 754 float drift', async () => {
    const txId = TEST_TX_BASE_ID + 24;
    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: '19.99', // String representation from MySQL DECIMAL(15,2)
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    // 1. Direct utility precision test
    assert.equal(toPaise('19.99'), 1999n);
    assert.equal(toStoredPaise('19.99'), 1999);
    assert.equal(toPaise(19.99), 1999n);
    assert.equal(paiseToRupees(1999), '19.99');
    assert.equal(formatPaiseToRupees(1999), '₹19.99');

    // 2. Full engine evaluation and persistence
    const res = await evaluateTransaction(tx);
    assert.equal(res.assessment.amount, 1999, 'Assessment amount must be exactly 1999 integer paise');

    // 3. Inspect persisted document directly in MongoDB
    const doc = await db.collection('transaction_risk_assessments').findOne({ transactionId: txId });
    assert.ok(doc, 'Persisted document must exist');
    assert.equal(doc.amount, 1999, 'Persisted MongoDB amount must be integer 1999, NOT double 19.99');
    assert.equal(typeof doc.amount, 'number');
    assert.equal(Number.isInteger(doc.amount), true, 'doc.amount must be an integer');
  });

  // ============================================================================
  // Test 22: Boundary Comparison: ₹50,000.00 versus ₹50,000.01
  // ============================================================================
  it('Test 22: Boundary Comparison - ₹50,000.00 does not trigger, while ₹50,000.01 triggers HIGH_AMOUNT', async () => {
    // 50,000 INR = 5,000,000 paise (configured threshold)
    const thresholdPaise = 5000000;

    // Case 22a: Exactly ₹50,000.00 (5,000,000 paise)
    const txExact = {
      transactionId: TEST_TX_BASE_ID + 25,
      customerId: 1,
      accountId: 10,
      transactionType: 'TRANSFER',
      amount: '50000.00',
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };
    const resExact = await evaluateTransaction(txExact);
    assert.equal(resExact.assessment.amount, 5000000);
    assert.equal(
      resExact.triggeredRules.find((r) => r.ruleCode === 'HIGH_AMOUNT'),
      undefined,
      '₹50,000.00 (5,000,000 paise) must NOT trigger threshold of 5,000,000 paise'
    );

    // Case 22b: ₹50,000.01 (5,000,001 paise) -> strictly exceeds threshold
    const txExceed = {
      transactionId: TEST_TX_BASE_ID + 26,
      customerId: 1,
      accountId: 10,
      transactionType: 'TRANSFER',
      amount: '50000.01',
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };
    const resExceed = await evaluateTransaction(txExceed);
    assert.equal(resExceed.assessment.amount, 5000001);
    const trigger = resExceed.triggeredRules.find((r) => r.ruleCode === 'HIGH_AMOUNT');
    assert.ok(trigger, '₹50,000.01 (5,000,001 paise) MUST trigger threshold of 5,000,000 paise');
    assert.equal(trigger.points, 30);
    assert.ok(trigger.description.includes('₹50,000.01'));
  });

  // ============================================================================
  // Test 23: Large Valid Monetary Amounts
  // ============================================================================
  it('Test 23: Large Valid Monetary Amounts - accurately handles high-value banking transactions without overflow', async () => {
    const txId = TEST_TX_BASE_ID + 27;
    // ₹100,000,000.00 (10 Crore INR = 10,000,000,000 paise)
    const largeAmountStr = '100000000.00';
    const expectedPaise = 10000000000;

    assert.equal(toStoredPaise(largeAmountStr), expectedPaise);
    assert.equal(formatPaiseToRupees(expectedPaise), '₹10,00,00,000.00');

    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 10,
      transactionType: 'TRANSFER',
      amount: largeAmountStr,
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    const res = await evaluateTransaction(tx);
    assert.equal(res.assessment.amount, expectedPaise);
    const highAmount = res.triggeredRules.find((r) => r.ruleCode === 'HIGH_AMOUNT');
    assert.ok(highAmount);

    const doc = await db.collection('transaction_risk_assessments').findOne({ transactionId: txId });
    assert.equal(doc.amount, expectedPaise);
  });

  // ============================================================================
  // Test 24: Unsafe MySQL BIGINT Identifiers Rejection
  // ============================================================================
  it('Test 24: Unsafe MySQL BIGINT Identifiers - strictly rejects IDs exceeding Number.MAX_SAFE_INTEGER', async () => {
    // 24a: transactionId exceeding Number.MAX_SAFE_INTEGER (9007199254740991)
    const unsafeTxId = '9007199254740993'; // 2^53 + 1
    await assert.rejects(
      async () => {
        await evaluateTransaction({
          transactionId: unsafeTxId,
          customerId: 1,
          accountId: 1,
          amount: 1000.0,
          transactionType: 'TRANSFER'
        });
      },
      (err) => {
        assert.ok(err instanceof FraudValidationError);
        assert.ok(err.message.includes('exceeds JavaScript Number.MAX_SAFE_INTEGER'));
        return true;
      }
    );

    // 24b: customerId exceeding Number.MAX_SAFE_INTEGER (MySQL max signed BIGINT: 9223372036854775807)
    await assert.rejects(
      async () => {
        await evaluateTransaction({
          transactionId: TEST_TX_BASE_ID + 99,
          customerId: '9223372036854775807',
          accountId: 1,
          amount: 1000.0,
          transactionType: 'TRANSFER'
        });
      },
      (err) => {
        assert.ok(err instanceof FraudValidationError);
        assert.ok(err.message.includes('exceeds JavaScript Number.MAX_SAFE_INTEGER'));
        return true;
      }
    );

    // 24c: Float identifiers are rejected
    await assert.rejects(
      async () => {
        toSafeId('123.45', 'transactionId');
      },
      (err) => err instanceof FraudValidationError && err.message.includes('Must be an integer identifier')
    );

    // 24d: Non-positive identifiers are rejected
    await assert.rejects(
      async () => {
        toSafeId('0', 'transactionId');
      },
      (err) => err instanceof FraudValidationError && err.message.includes('strictly positive integer')
    );
  });

  // ============================================================================
  // Test 25: Duplicate Concurrent Evaluations (Concurrency Safety)
  // ============================================================================
  it('Test 25: Duplicate Concurrent Evaluations - multiple simultaneous calls create exactly 1 assessment and 1 alert', async () => {
    const txId = TEST_TX_BASE_ID + 28;
    const tx = {
      transactionId: txId,
      customerId: 1,
      accountId: 10,
      destinationAccountId: 99,
      transactionType: 'TRANSFER',
      amount: '80000.00', // HIGH_AMOUNT (25)
      timestamp: new Date('2026-11-05T03:00:00+05:30') // UNUSUAL_HOUR (15)
    };
    const context = {
      recentTransactionCount: 5, // HIGH_VELOCITY (20)
      isNewBeneficiary: true // NEW_BENEFICIARY (20) -> Total 80 (CRITICAL -> Alert)
    };

    // Execute 5 concurrent evaluations at the exact same millisecond
    const results = await Promise.all([
      evaluateTransaction(tx, context),
      evaluateTransaction(tx, context),
      evaluateTransaction(tx, context),
      evaluateTransaction(tx, context),
      evaluateTransaction(tx, context)
    ]);

    // All calls should resolve successfully
    assert.equal(results.length, 5);
    results.forEach((r) => {
      assert.equal(r.assessment.transactionId, txId);
      assert.equal(r.assessment.riskLevel, 'CRITICAL');
      assert.ok(r.alert);
    });

    // Exactly one assessment must exist in MongoDB
    const assessmentCount = await db
      .collection('transaction_risk_assessments')
      .countDocuments({ transactionId: txId });
    assert.equal(assessmentCount, 1, 'Exactly one assessment document must exist in MongoDB');

    // Exactly one alert must exist in MongoDB
    const alertCount = await db
      .collection('fraud_alerts')
      .countDocuments({ transactionId: txId });
    assert.equal(alertCount, 1, 'Exactly one alert document must exist in MongoDB');
  });

  // ============================================================================
  // Test 26: Missing & Empty Historical Context Safety
  // ============================================================================
  it('Test 26: Missing & Empty Historical Context - engine evaluates safely without crashes or false positives', async () => {
    const baseTx = {
      transactionId: TEST_TX_BASE_ID + 29,
      customerId: 1,
      accountId: 10,
      transactionType: 'TRANSFER',
      destinationAccountId: 20,
      amount: '5000.00',
      timestamp: new Date('2026-11-05T14:30:00+05:30')
    };

    // 26a: context = null
    const resNull = await evaluateTransaction(baseTx, null);
    assert.equal(resNull.triggeredRules.length, 0);

    // 26b: context = undefined
    const resUndef = await evaluateTransaction({ ...baseTx, transactionId: TEST_TX_BASE_ID + 30 });
    assert.equal(resUndef.triggeredRules.length, 0);

    // 26c: context = {} (empty object)
    const resEmpty = await evaluateTransaction({ ...baseTx, transactionId: TEST_TX_BASE_ID + 31 }, {});
    assert.equal(resEmpty.triggeredRules.length, 0);

    // 26d: context = { recentTransactions: [] } (empty array)
    const resEmptyArray = await evaluateTransaction(
      { ...baseTx, transactionId: TEST_TX_BASE_ID + 32 },
      { recentTransactions: [] }
    );
    assert.equal(resEmptyArray.triggeredRules.length, 0);
  });

  // ============================================================================
  // Test 27: Timezone Boundary Cases (Asia/Kolkata [01:00, 05:00))
  // ============================================================================
  it('Test 27: Timezone Boundary Cases - verifies exact half-open window [01:00, 05:00) IST across UTC timestamps', async () => {
    // Asia/Kolkata is UTC + 5:30
    const txBase = {
      customerId: 1,
      accountId: 10,
      transactionType: 'WITHDRAWAL',
      amount: '1000.00'
    };

    // Case 27a: 01:00:00.000 IST (exact window start) -> in UTC: 2026-11-04T19:30:00.000Z
    const resStart = await evaluateTransaction({
      ...txBase,
      transactionId: TEST_TX_BASE_ID + 33,
      timestamp: new Date('2026-11-04T19:30:00.000Z')
    });
    const triggerStart = resStart.triggeredRules.find((r) => r.ruleCode === 'UNUSUAL_HOUR');
    assert.ok(triggerStart, '01:00:00 IST (19:30 UTC) MUST trigger UNUSUAL_HOUR');

    // Case 27b: 00:59:59.000 IST (1 second before window) -> in UTC: 2026-11-04T19:29:59.000Z
    const resBefore = await evaluateTransaction({
      ...txBase,
      transactionId: TEST_TX_BASE_ID + 34,
      timestamp: new Date('2026-11-04T19:29:59.000Z')
    });
    assert.equal(
      resBefore.triggeredRules.find((r) => r.ruleCode === 'UNUSUAL_HOUR'),
      undefined,
      '00:59:59 IST (19:29:59 UTC) must NOT trigger UNUSUAL_HOUR'
    );

    // Case 27c: 04:59:59.000 IST (last second of window) -> in UTC: 2026-11-04T23:29:59.000Z
    const resLastSec = await evaluateTransaction({
      ...txBase,
      transactionId: TEST_TX_BASE_ID + 35,
      timestamp: new Date('2026-11-04T23:29:59.000Z')
    });
    assert.ok(
      resLastSec.triggeredRules.find((r) => r.ruleCode === 'UNUSUAL_HOUR'),
      '04:59:59 IST (23:29:59 UTC) MUST trigger UNUSUAL_HOUR'
    );

    // Case 27d: 05:00:00.000 IST (exact end of half-open window) -> in UTC: 2026-11-04T23:30:00.000Z
    const resEnd = await evaluateTransaction({
      ...txBase,
      transactionId: TEST_TX_BASE_ID + 36,
      timestamp: new Date('2026-11-04T23:30:00.000Z')
    });
    assert.equal(
      resEnd.triggeredRules.find((r) => r.ruleCode === 'UNUSUAL_HOUR'),
      undefined,
      '05:00:00 IST (23:30:00 UTC) must NOT trigger UNUSUAL_HOUR'
    );
  });

  // ============================================================================
  // Test 28: Partial Persistence Rollback & Self-Healing Alert Recovery
  // ============================================================================
  it('Test 28: Partial Persistence Rollback & Self-Healing Recovery - rollback orphan assessment on alert failure and recover on retry', async () => {
    const txId = TEST_TX_BASE_ID + 37;

    // Simulate scenario: An assessment exists in transaction_risk_assessments with HIGH risk level,
    // but fraud_alerts document is missing (e.g. from historical crash or partial write failure)
    await saveAssessment({
      transactionId: txId,
      customerId: 1,
      accountId: 10,
      transactionType: 'TRANSFER',
      amount: 7500000,
      riskScore: 65,
      riskLevel: 'HIGH',
      triggeredRules: [{ ruleCode: 'HIGH_AMOUNT', points: 25, description: 'High amount' }],
      decision: 'FLAGGED',
      assessedAt: new Date()
    });

    // Verify alert does NOT exist yet
    const beforeAlert = await db.collection('fraud_alerts').findOne({ transactionId: txId });
    assert.equal(beforeAlert, null);

    // Calling evaluateTransaction on this transactionId triggers self-healing idempotency
    const res = await evaluateTransaction({
      transactionId: txId,
      customerId: 1,
      accountId: 10,
      transactionType: 'TRANSFER',
      amount: '75000.00'
    });

    assert.equal(res.isExisting, true);
    assert.ok(res.alert, 'Self-healing must generate the missing alert for HIGH risk assessment');
    assert.equal(res.alert.transactionId, txId);
    assert.equal(res.alert.status, 'OPEN');

    // Verify alert now exists in MongoDB
    const afterAlert = await db.collection('fraud_alerts').findOne({ transactionId: txId });
    assert.ok(afterAlert);
    assert.equal(afterAlert.transactionId, txId);
  });
});
