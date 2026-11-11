/**
 * ==============================================================================
 * Automated Test Suite: Phase 4 - Fraud Monitoring Dashboard
 * ==============================================================================
 * Repository: sujayhegde23/Bank-Management-System
 * Branch: feature/fraud-phase-3-integration
 *
 * Verifies:
 * 1. Role-Based Authorization:
 *    - EMPLOYEE & ADMIN can view dashboard stats, alerts, alert details, investigations, rules.
 *    - EMPLOYEE & ADMIN can create and update investigations.
 *    - ADMIN only can modify fraud rules.
 *    - EMPLOYEE is rejected from modifying fraud rules (403 AUTH_002).
 *    - CUSTOMER is strictly rejected from all fraud endpoints (403 AUTH_002).
 *    - Unauthenticated requests are rejected (401 AUTH_003).
 * 2. Fraud Overview Statistics:
 *    - MongoDB aggregation pipelines calculate accurate totals across alerts,
 *      assessments, and investigations.
 * 3. Fraud Alerts Listing & Hydration:
 *    - Pagination and sorting by creation timestamp.
 *    - Filtering by riskLevel, status, and transactionId.
 *    - Safe MySQL batch hydration of banking transactions without N+1 queries.
 * 4. Alert Details:
 *    - Complete alert, risk assessment, triggered rules, MySQL transaction,
 *      and linked investigation.
 * 5. Investigation Case Management:
 *    - Case creation from alert, note appending, status updates, employee assignment.
 *    - Status transitions synchronize alert state in fraud_alerts.
 *    - Full immutable audit log of notes and status history.
 * 6. Fraud Rule Management:
 *    - Admin rule threshold updates (integer paise precision).
 *    - Weight updates and enabled/disabled toggle.
 *    - Immediate rule cache invalidation.
 * 7. Error Handling, Malformed IDs & Disconnected Resiliency.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { ObjectId } = require('mongodb');
const app = require('../src/app');
const { pool, query } = require('../src/config/db');
const { connectMongo, getDb, closeMongo, isMongoConnected } = require('../src/config/mongo');
const { initializeMongoDatabase } = require('../src/config/initMongo');
const { loginAs } = require('./helpers/authHelper');
const {
  saveAssessment,
  saveAlert,
  getEnabledRules,
  clearRuleCache,
  recordOutboxEvent,
  evaluateTransaction,
  calculateRiskScore,
  classifyRiskLevel,
  RISK_LEVELS
} = require('../src/services/fraud');
const { executeDeposit } = require('../src/services/transactionService');

const TEST_PASSWORD = 'Password123!';

describe('Phase 4: Fraud Monitoring Dashboard Test Suite', () => {
  let adminCookie;
  let employeeCookie;
  let customerCookie;

  let testTxn1Id;
  let testTxn2Id;
  let testAlert1Id;
  let testAlert2Id;
  let createdTxnIds = [];
  let initialAcc1Balance = null;

  before(async () => {
    // 1. Ensure databases connected and initialized
    await connectMongo();
    await initializeMongoDatabase();

    // 2. Authenticate Admin (test.admin1)
    adminCookie = await loginAs(request, app, 'test.admin1', TEST_PASSWORD);

    // 3. Authenticate Employee (test.employee1)
    employeeCookie = await loginAs(request, app, 'test.employee1', TEST_PASSWORD);

    // 4. Authenticate Customer (test.customer1)
    customerCookie = await loginAs(request, app, 'test.customer1', TEST_PASSWORD);

    // 5. Seed test transactions in MySQL
    const [accRows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = 1');
    if (accRows && accRows.length > 0) {
      initialAcc1Balance = accRows[0].balance;
    }

    const dep1 = await executeDeposit({
      accountId: 1,
      amount: '55000.00',
      remarks: 'Test high value deposit for alert 1',
      performedByUserId: 1
    });
    testTxn1Id = dep1.transactionId;
    createdTxnIds.push(testTxn1Id);

    const dep2 = await executeDeposit({
      accountId: 1,
      amount: '90000.00',
      remarks: 'Test critical value deposit for alert 2',
      performedByUserId: 1
    });
    testTxn2Id = dep2.transactionId;
    createdTxnIds.push(testTxn2Id);

    // 6. Seed assessments and alerts in MongoDB
    await saveAssessment({
      transactionId: testTxn1Id,
      customerId: 1,
      accountId: 1,
      transactionType: 'DEPOSIT',
      amount: 5500000, // 55,000 paise
      riskScore: 65,
      riskLevel: RISK_LEVELS.HIGH,
      triggeredRules: [
        { ruleCode: 'HIGH_AMOUNT', points: 25, description: 'Exceeded ₹50,000 threshold' },
        { ruleCode: 'HIGH_VELOCITY', points: 20, description: 'High frequency' }
      ],
      decision: 'REVIEW_REQUIRED',
      assessedAt: new Date()
    });

    const alert1 = await saveAlert({
      transactionId: testTxn1Id,
      customerId: 1,
      accountId: 1,
      riskScore: 65,
      riskLevel: RISK_LEVELS.HIGH,
      reasons: ['HIGH_AMOUNT (25 pts)', 'HIGH_VELOCITY (20 pts)'],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    testAlert1Id = alert1._id.toString();

    await saveAssessment({
      transactionId: testTxn2Id,
      customerId: 1,
      accountId: 1,
      transactionType: 'DEPOSIT',
      amount: 9000000,
      riskScore: 85,
      riskLevel: RISK_LEVELS.CRITICAL,
      triggeredRules: [
        { ruleCode: 'HIGH_AMOUNT', points: 25, description: 'Exceeded ₹50,000 threshold' },
        { ruleCode: 'HIGH_VELOCITY', points: 20, description: 'High frequency' },
        { ruleCode: 'NEW_BENEFICIARY', points: 20, description: 'First transfer' }
      ],
      decision: 'FLAGGED',
      assessedAt: new Date()
    });

    const alert2 = await saveAlert({
      transactionId: testTxn2Id,
      customerId: 1,
      accountId: 1,
      riskScore: 85,
      riskLevel: RISK_LEVELS.CRITICAL,
      reasons: ['HIGH_AMOUNT (25 pts)', 'HIGH_VELOCITY (20 pts)', 'NEW_BENEFICIARY (20 pts)'],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    testAlert2Id = alert2._id.toString();
  });

  after(async () => {
    try {
      const db = getDb();
      if (db) {
        // Clean up MongoDB test alerts, assessments, and investigations
        if (createdTxnIds.length > 0) {
          await db.collection('fraud_alerts').deleteMany({ transactionId: { $in: createdTxnIds } });
          await db.collection('transaction_risk_assessments').deleteMany({ transactionId: { $in: createdTxnIds } });
          await db.collection('fraud_investigations').deleteMany({ transactionId: { $in: createdTxnIds } });
        }
      }

      // Clean up MySQL test transactions (satisfying ON DELETE RESTRICT)
      if (createdTxnIds.length > 0) {
        const ph = createdTxnIds.map(() => '?').join(',');
        await pool.execute(`DELETE FROM fraud_outbox_events WHERE transaction_id IN (${ph})`, createdTxnIds);
        await pool.execute(`DELETE FROM bank_transactions WHERE transaction_id IN (${ph})`, createdTxnIds);
      }

      // Restore account 1 initial balance
      if (initialAcc1Balance !== null) {
        await pool.execute('UPDATE accounts SET balance = ? WHERE account_id = 1', [initialAcc1Balance]);
      }
    } catch (err) {
      console.error('Error during test cleanup in fraudDashboard.test.js:', err.message);
    } finally {
      await closeMongo().catch(() => {});
      await pool.end().catch(() => {});
    }
  });

  // ============================================================================
  // SECTION 1: Role-Based Authorization Matrix
  // ============================================================================
  describe('1. Role-Based Authorization & Customer Access Rejection', () => {
    it('should reject unauthenticated requests to fraud endpoints with 401 AUTH_003', async () => {
      const res = await request(app).get('/api/fraud/dashboard/stats');
      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should reject CUSTOMER from viewing fraud dashboard stats with 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/fraud/dashboard/stats')
        .set('Cookie', customerCookie);
      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject CUSTOMER from listing fraud alerts with 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/fraud/alerts')
        .set('Cookie', customerCookie);
      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject CUSTOMER from viewing alert details with 403 AUTH_002', async () => {
      const res = await request(app)
        .get(`/api/fraud/alerts/${testAlert1Id}`)
        .set('Cookie', customerCookie);
      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject CUSTOMER from creating an investigation with 403 AUTH_002', async () => {
      const res = await request(app)
        .post(`/api/fraud/alerts/${testAlert1Id}/investigations`)
        .set('Cookie', customerCookie)
        .send({ notes: 'Customer attempt' });
      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject CUSTOMER from viewing fraud rules with 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/fraud/rules')
        .set('Cookie', customerCookie);
      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should allow EMPLOYEE to view dashboard stats and alerts', async () => {
      const resStats = await request(app)
        .get('/api/fraud/dashboard/stats')
        .set('Cookie', employeeCookie);
      assert.equal(resStats.status, 200);
      assert.ok(resStats.body.success);

      const resAlerts = await request(app)
        .get('/api/fraud/alerts')
        .set('Cookie', employeeCookie);
      assert.equal(resAlerts.status, 200);
      assert.ok(resAlerts.body.success);
    });

    it('should allow EMPLOYEE to view fraud rules in read-only mode', async () => {
      const res = await request(app)
        .get('/api/fraud/rules')
        .set('Cookie', employeeCookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(Array.isArray(res.body.data.rules));
    });

    it('should strictly reject EMPLOYEE from modifying fraud rules with 403 AUTH_002', async () => {
      const res = await request(app)
        .patch('/api/fraud/rules/HIGH_AMOUNT')
        .set('Cookie', employeeCookie)
        .send({ thresholdInRupees: 60000 });
      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should allow ADMIN to modify fraud rules', async () => {
      const res = await request(app)
        .patch('/api/fraud/rules/HIGH_AMOUNT')
        .set('Cookie', adminCookie)
        .send({ thresholdInRupees: 50000 });
      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      assert.equal(res.body.data.rule.threshold, 5000000); // 50,000.00 in paise
    });
  });

  // ============================================================================
  // SECTION 2: Fraud Overview Statistics Aggregations
  // ============================================================================
  describe('2. Fraud Overview Statistics (MongoDB Aggregation Pipelines)', () => {
    it('should return system-wide fraud statistics using MongoDB aggregation', async () => {
      const res = await request(app)
        .get('/api/fraud/dashboard/stats')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      const data = res.body.data;

      assert.equal(typeof data.totalAlerts, 'number');
      assert.ok(data.totalAlerts >= 2);
      assert.equal(typeof data.highRiskAssessments, 'number');
      assert.ok(data.highRiskAssessments >= 1);
      assert.equal(typeof data.criticalRiskAssessments, 'number');
      assert.ok(data.criticalRiskAssessments >= 1);
      assert.equal(typeof data.totalAssessments, 'number');
      assert.ok(data.totalAssessments >= 2);

      assert.ok(data.assessmentsByRiskLevel);
      assert.equal(typeof data.assessmentsByRiskLevel.HIGH, 'number');
      assert.equal(typeof data.assessmentsByRiskLevel.CRITICAL, 'number');

      assert.ok(Array.isArray(data.alertsOverTime));
      assert.equal(typeof data.pendingInvestigations, 'number');
      assert.equal(typeof data.resolvedInvestigations, 'number');
      assert.equal(typeof data.recentAverageRiskScore, 'number');
    });

    it('should compute recentAverageRiskScore selecting the latest 1,000 records, not arbitrary records', async () => {
      const db = getDb();
      const alertsColl = db.collection('fraud_alerts');

      // Generate a batch of test alerts:
      // 1 older alert with riskScore 0 (10 days ago)
      // 1,000 newer alerts with riskScore 100 (from 1 hour ago to now)
      const now = Date.now();
      const oldAlert = {
        transactionId: 8800001,
        customerId: 1,
        accountId: 1,
        riskScore: 0,
        riskLevel: 'LOW',
        status: 'OPEN',
        reasons: ['Old outlier baseline test'],
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        updatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000)
      };

      const newAlerts = [];
      for (let i = 0; i < 1000; i++) {
        newAlerts.push({
          transactionId: 8801000 + i,
          customerId: 1,
          accountId: 1,
          riskScore: 100,
          riskLevel: 'CRITICAL',
          status: 'OPEN',
          reasons: ['Newest alert batch'],
          createdAt: new Date(now + 60000 + i), // strictly newer than all existing records
          updatedAt: new Date(now + 60000 + i)
        });
      }

      await alertsColl.insertOne(oldAlert);
      await alertsColl.insertMany(newAlerts);

      try {
        const res = await request(app)
          .get('/api/fraud/dashboard/stats')
          .set('Cookie', adminCookie);

        assert.equal(res.status, 200);
        const data = res.body.data;

        // If the query took arbitrary records or included the older record with score 0,
        // the average would be < 100.00 (e.g., 99.90).
        // Since it sorts by { createdAt: -1 } before $limit: 1000,
        // all 1,000 selected alerts have score 100, so recentAverageRiskScore MUST equal 100.
        assert.equal(
          data.recentAverageRiskScore,
          100,
          'recentAverageRiskScore must select strictly the latest 1,000 alerts sorted by createdAt descending'
        );
      } finally {
        await alertsColl.deleteMany({
          transactionId: { $in: [8800001, ...newAlerts.map((a) => a.transactionId)] }
        });
      }
    });

    it('should confirm alert counts and assessment counts are not treated as interchangeable', async () => {
      const db = getDb();
      const alertsColl = db.collection('fraud_alerts');
      const assessmentsColl = db.collection('transaction_risk_assessments');

      // Capture baseline counts
      const baseRes = await request(app)
        .get('/api/fraud/dashboard/stats')
        .set('Cookie', adminCookie);
      assert.equal(baseRes.status, 200);
      const baseStats = baseRes.body.data;

      // Seed 5 benign LOW-risk assessments with NO fraud alerts generated
      const tempAssessmentIds = [9900011, 9900012, 9900013, 9900014, 9900015];
      const lowAssessments = tempAssessmentIds.map((tid) => ({
        transactionId: tid,
        customerId: 1,
        accountId: 1,
        transactionType: 'TRANSFER',
        amount: 50000,
        riskScore: 10,
        riskLevel: 'LOW',
        triggeredRules: [],
        decision: 'APPROVED',
        assessedAt: new Date()
      }));

      await assessmentsColl.insertMany(lowAssessments);

      try {
        const afterRes = await request(app)
          .get('/api/fraud/dashboard/stats')
          .set('Cookie', adminCookie);
        assert.equal(afterRes.status, 200);
        const afterStats = afterRes.body.data;

        // Total assessments must have increased by 5
        assert.equal(
          afterStats.totalAssessments,
          baseStats.totalAssessments + 5,
          'totalAssessments must increase by 5 from transaction_risk_assessments'
        );

        // Total alerts must remain exactly the same (proving they are not interchangeable)
        assert.equal(
          afterStats.totalAlerts,
          baseStats.totalAlerts,
          'totalAlerts in fraud_alerts must not change when non-alert assessments are inserted'
        );

        // Risk-level breakdown of assessments reflects the 5 new LOW risk assessments
        assert.equal(
          afterStats.assessmentsByRiskLevel.LOW,
          (baseStats.assessmentsByRiskLevel?.LOW || 0) + 5,
          'assessmentsByRiskLevel.LOW must come from transaction_risk_assessments'
        );

        // Alerts by risk level for LOW remains unchanged
        assert.equal(
          afterStats.alertsByRiskLevel.LOW,
          baseStats.alertsByRiskLevel?.LOW || 0,
          'alertsByRiskLevel.LOW must come from fraud_alerts'
        );
      } finally {
        await assessmentsColl.deleteMany({ transactionId: { $in: tempAssessmentIds } });
      }
    });

    it('should verify that risk distribution sums to total assessments and matches transaction_risk_assessments counts', async () => {
      const db = getDb();
      const alertsColl = db.collection('fraud_alerts');
      const assessmentsColl = db.collection('transaction_risk_assessments');

      // Seed a controlled scenario:
      // 10 fraud alerts (all HIGH)
      // 106 transaction assessments: 82 LOW, 14 MEDIUM, 10 HIGH, 0 CRITICAL
      const testAlertDocs = [];
      const testAssessmentDocs = [];
      const testTxnIds = [];

      for (let i = 0; i < 106; i++) {
        const txnId = 7700000 + i;
        testTxnIds.push(txnId);

        let riskLevel;
        let riskScore;
        let decision;

        if (i < 82) {
          riskLevel = 'LOW';
          riskScore = 15;
          decision = 'APPROVED';
        } else if (i < 96) { // 82 + 14 = 96
          riskLevel = 'MEDIUM';
          riskScore = 45;
          decision = 'REVIEW_REQUIRED';
        } else { // 10 remaining (96 to 105)
          riskLevel = 'HIGH';
          riskScore = 70;
          decision = 'FLAGGED';

          // Only HIGH generates an alert (total 10 alerts)
          testAlertDocs.push({
            transactionId: txnId,
            customerId: 1,
            accountId: 1,
            riskScore: 70,
            riskLevel: 'HIGH',
            status: 'OPEN',
            reasons: ['HIGH_AMOUNT test'],
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        testAssessmentDocs.push({
          transactionId: txnId,
          customerId: 1,
          accountId: 1,
          transactionType: 'TRANSFER',
          amount: 50000,
          riskScore,
          riskLevel,
          triggeredRules: [],
          decision,
          assessedAt: new Date()
        });
      }

      await assessmentsColl.insertMany(testAssessmentDocs);
      await alertsColl.insertMany(testAlertDocs);

      try {
        const res = await request(app)
          .get('/api/fraud/dashboard/stats')
          .set('Cookie', adminCookie);

        assert.equal(res.status, 200);
        const data = res.body.data;

        // Verify risk distribution sum equals total assessments
        const distSum =
          (data.assessmentsByRiskLevel.LOW || 0) +
          (data.assessmentsByRiskLevel.MEDIUM || 0) +
          (data.assessmentsByRiskLevel.HIGH || 0) +
          (data.assessmentsByRiskLevel.CRITICAL || 0);

        assert.equal(
          distSum,
          data.totalAssessments,
          'Sum of risk distribution must strictly equal totalAssessments'
        );

        // Verify individual assessment counts reflect the batch
        assert.ok(data.assessmentsByRiskLevel.LOW >= 82, 'LOW assessments count must include 82');
        assert.ok(data.assessmentsByRiskLevel.MEDIUM >= 14, 'MEDIUM assessments count must include 14');
        assert.ok(data.assessmentsByRiskLevel.HIGH >= 10, 'HIGH assessments count must include 10');
      } finally {
        await assessmentsColl.deleteMany({ transactionId: { $in: testTxnIds } });
        await alertsColl.deleteMany({ transactionId: { $in: testTxnIds } });
      }
    });
  });

  // ============================================================================
  // SECTION 3: Fraud Alerts Listing, Filtering & Zero N+1 Hydration
  // ============================================================================
  describe('3. Fraud Alerts Listing, Filtering & MySQL Hydration', () => {
    it('should list paginated fraud alerts with hydrated MySQL banking transaction details', async () => {
      const res = await request(app)
        .get('/api/fraud/alerts?page=1&limit=10')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      const { items, pagination } = res.body.data;

      assert.ok(Array.isArray(items));
      assert.ok(items.length >= 2);
      assert.equal(pagination.page, 1);
      assert.equal(pagination.limit, 10);
      assert.ok(pagination.total >= 2);

      // Verify hydrated banking fields (zero N+1)
      const alert1Item = items.find((a) => a.transactionId === testTxn1Id);
      assert.ok(alert1Item, 'Alert 1 must be present in listing');
      assert.equal(alert1Item.transactionType, 'DEPOSIT');
      assert.equal(alert1Item.amountFormatted, '55000.00');
      assert.equal(alert1Item.riskScore, 65);
      assert.equal(alert1Item.riskLevel, 'HIGH');
      assert.ok(alert1Item.customerName);
    });

    it('should filter alerts by riskLevel = CRITICAL', async () => {
      const res = await request(app)
        .get('/api/fraud/alerts?riskLevel=CRITICAL')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      const items = res.body.data.items;
      assert.ok(items.length > 0);
      for (const item of items) {
        assert.equal(item.riskLevel, 'CRITICAL');
      }
    });

    it('should filter alerts by transactionId', async () => {
      const res = await request(app)
        .get(`/api/fraud/alerts?transactionId=${testTxn2Id}`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      const items = res.body.data.items;
      assert.equal(items.length, 1);
      assert.equal(items[0].transactionId, testTxn2Id);
      assert.equal(items[0].riskLevel, 'CRITICAL');
      assert.equal(items[0].amountFormatted, '90000.00');
    });

    it('should filter alerts by status = OPEN', async () => {
      const res = await request(app)
        .get('/api/fraud/alerts?status=OPEN')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      const items = res.body.data.items;
      for (const item of items) {
        assert.equal(item.status, 'OPEN');
      }
    });
  });

  // ============================================================================
  // SECTION 4: Alert Details
  // ============================================================================
  describe('4. Alert Details', () => {
    it('should return complete alert details by MongoDB ObjectId string', async () => {
      const res = await request(app)
        .get(`/api/fraud/alerts/${testAlert1Id}`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      const { alert, assessment, transaction } = res.body.data;

      assert.equal(alert.alertId, testAlert1Id);
      assert.equal(alert.transactionId, testTxn1Id);
      assert.equal(alert.riskScore, 65);
      assert.equal(alert.riskLevel, 'HIGH');

      assert.ok(assessment);
      assert.equal(assessment.transactionId, testTxn1Id);
      assert.equal(assessment.amountRupees, 55000);
      assert.equal(assessment.decision, 'REVIEW_REQUIRED');
      assert.ok(Array.isArray(assessment.triggeredRules));
      assert.equal(assessment.triggeredRules.length, 2);

      assert.ok(transaction);
      assert.equal(transaction.transactionId, testTxn1Id);
      assert.equal(transaction.amountFormatted, '55000.00');
      assert.equal(transaction.transactionType, 'DEPOSIT');
    });

    it('should return complete alert details by numeric transactionId', async () => {
      const res = await request(app)
        .get(`/api/fraud/alerts/${testTxn2Id}`)
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      const { alert, assessment, transaction } = res.body.data;

      assert.equal(alert.transactionId, testTxn2Id);
      assert.equal(alert.riskLevel, 'CRITICAL');
      assert.equal(assessment.riskScore, 85);
      assert.equal(transaction.amountFormatted, '90000.00');
    });

    it('should return 404 ALERT_NOT_FOUND for non-existent alert ID', async () => {
      const fakeObjectId = new ObjectId().toString();
      const res = await request(app)
        .get(`/api/fraud/alerts/${fakeObjectId}`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'ALERT_NOT_FOUND');
    });
  });

  // ============================================================================
  // SECTION 5: Investigation Case Management Lifecycle
  // ============================================================================
  describe('5. Investigation Management Lifecycle & Audit Integrity', () => {
    let createdInvId;

    it('should create an investigation for an alert, log initial note, and update alert status', async () => {
      const res = await request(app)
        .post(`/api/fraud/alerts/${testAlert1Id}/investigations`)
        .set('Cookie', employeeCookie)
        .send({
          notes: 'Flagged for unusually high deposit; initiating customer phone verification',
          assignedEmployeeId: 1
        });

      assert.equal(res.status, 201);
      assert.ok(res.body.success);
      const inv = res.body.data;

      assert.ok(inv.investigationId);
      createdInvId = inv.investigationId;
      assert.equal(inv.transactionId, testTxn1Id);
      assert.equal(inv.status, 'IN_PROGRESS');
      assert.equal(inv.notes.length, 1);
      assert.equal(inv.notes[0].text, 'Flagged for unusually high deposit; initiating customer phone verification');
      assert.equal(inv.notes[0].authorRole, 'EMPLOYEE');

      // Verify that fraud_alerts status was updated to UNDER_REVIEW
      const db = getDb();
      const alertAfter = await db.collection('fraud_alerts').findOne({ _id: new ObjectId(testAlert1Id) });
      assert.equal(alertAfter.status, 'UNDER_REVIEW');
    });

    it('should handle duplicate investigation creation idempotently', async () => {
      const res = await request(app)
        .post(`/api/fraud/alerts/${testAlert1Id}/investigations`)
        .set('Cookie', employeeCookie)
        .send({ notes: 'Second creation attempt' });

      assert.equal(res.status, 200);
      assert.ok(res.body.data.isExisting);
      assert.equal(res.body.data.investigationId, createdInvId);
    });

    it('should retrieve investigation details including notes audit history', async () => {
      const res = await request(app)
        .get(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      const inv = res.body.data;

      assert.equal(inv.investigationId, createdInvId);
      assert.equal(inv.transactionId, testTxn1Id);
      assert.equal(inv.status, 'IN_PROGRESS');
      assert.ok(inv.transaction);
      assert.equal(inv.transaction.amountFormatted, '55000.00');
      assert.ok(inv.assignedEmployee);
      assert.ok(Array.isArray(inv.notes));
      assert.equal(inv.notes.length, 1);
    });

    it('should append a new note to investigation without overwriting previous notes', async () => {
      const res = await request(app)
        .patch(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie)
        .send({
          note: 'Spoke with account holder; confirmed deposit was salary bonus'
        });

      assert.equal(res.status, 200);
      const inv = res.body.data;
      assert.equal(inv.notes.length, 2, 'Notes array must contain both notes');
      assert.equal(inv.notes[0].text, 'Flagged for unusually high deposit; initiating customer phone verification');
      assert.equal(inv.notes[1].text, 'Spoke with account holder; confirmed deposit was salary bonus');
    });

    it('should update investigation status to RESOLVED and synchronize alert status', async () => {
      const res = await request(app)
        .patch(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie)
        .send({
          status: 'RESOLVED',
          resolution: 'Legitimate customer bonus deposit; verified via branch manager'
        });

      assert.equal(res.status, 200);
      const inv = res.body.data;
      assert.equal(inv.status, 'RESOLVED');
      assert.equal(inv.resolution, 'Legitimate customer bonus deposit; verified via branch manager');

      // Verify fraud_alerts status was synchronized to RESOLVED
      const db = getDb();
      const alertAfter = await db.collection('fraud_alerts').findOne({ _id: new ObjectId(testAlert1Id) });
      assert.equal(alertAfter.status, 'RESOLVED');
    });

    it('should list investigations with status filtering', async () => {
      const res = await request(app)
        .get('/api/fraud/investigations?status=RESOLVED')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      const { items, pagination } = res.body.data;
      assert.ok(Array.isArray(items));
      assert.ok(items.length >= 1);
      const matched = items.find((i) => i.investigationId === createdInvId);
      assert.ok(matched, 'Resolved investigation must appear in listing');
      assert.equal(matched.status, 'RESOLVED');
      assert.equal(matched.notesCount, 2);
    });

    it('should reject invalid investigation status with 400 INVALID_STATUS', async () => {
      const res = await request(app)
        .patch(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie)
        .send({ status: 'INVALID_STATUS_CODE' });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'INVALID_STATUS');
    });

    it('should prevent concurrent requests from creating duplicate investigations', async () => {
      // Trigger two concurrent investigation creation requests on testAlert2Id
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/fraud/alerts/${testAlert2Id}/investigations`)
          .set('Cookie', employeeCookie)
          .send({ notes: 'Concurrent request worker 1' }),
        request(app)
          .post(`/api/fraud/alerts/${testAlert2Id}/investigations`)
          .set('Cookie', employeeCookie)
          .send({ notes: 'Concurrent request worker 2' })
      ]);

      // Both requests must succeed (one created, the other safely returns existing)
      assert.ok([200, 201].includes(res1.status));
      assert.ok([200, 201].includes(res2.status));
      assert.equal(res1.body.data.investigationId, res2.body.data.investigationId);

      // Verify strictly ONE document exists in MongoDB
      const db = getDb();
      const count = await db.collection('fraud_investigations').countDocuments({
        alertId: new ObjectId(testAlert2Id)
      });
      assert.equal(count, 1, 'Only one investigation must exist for testAlert2Id');
    });

    it('should enforce documented lifecycle and reject invalid status transitions', async () => {
      // createdInvId is currently RESOLVED.
      // Attempting invalid transition directly to IN_PROGRESS must fail
      const invalidRes1 = await request(app)
        .patch(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie)
        .send({ status: 'IN_PROGRESS' });

      assert.equal(invalidRes1.status, 400);
      assert.equal(invalidRes1.body.errorCode, 'INVALID_STATUS_TRANSITION');

      // Valid transition: RESOLVED -> CLOSED
      const closeRes = await request(app)
        .patch(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie)
        .send({ status: 'CLOSED' });
      assert.equal(closeRes.status, 200);
      assert.equal(closeRes.body.data.status, 'CLOSED');

      // From CLOSED, invalid transition directly to RESOLVED must fail
      const invalidRes2 = await request(app)
        .patch(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie)
        .send({ status: 'RESOLVED' });
      assert.equal(invalidRes2.status, 400);
      assert.equal(invalidRes2.body.errorCode, 'INVALID_STATUS_TRANSITION');

      // Valid transition: CLOSED -> UNDER_REVIEW (reopening case for review)
      const reopenRes = await request(app)
        .patch(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie)
        .send({ status: 'UNDER_REVIEW' });
      assert.equal(reopenRes.status, 200);
      assert.equal(reopenRes.body.data.status, 'UNDER_REVIEW');
    });

    it('should guarantee investigation notes and history are append-only without overwriting', async () => {
      // Append a third note
      const appendRes = await request(app)
        .patch(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie)
        .send({ note: 'Third audit note: case reopened for periodic supervisory review' });
      assert.equal(appendRes.status, 200);

      // Fetch full details
      const detailRes = await request(app)
        .get(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie);
      assert.equal(detailRes.status, 200);
      const inv = detailRes.body.data;

      // Assert notes are strictly append-only (3 notes total in order)
      assert.equal(inv.notes.length, 3);
      assert.equal(inv.notes[0].text, 'Flagged for unusually high deposit; initiating customer phone verification');
      assert.equal(inv.notes[1].text, 'Spoke with account holder; confirmed deposit was salary bonus');
      assert.equal(inv.notes[2].text, 'Third audit note: case reopened for periodic supervisory review');

      // Assert history preserves all audit actions
      const db = getDb();
      const rawDoc = await db.collection('fraud_investigations').findOne({ _id: new ObjectId(createdInvId) });
      assert.ok(Array.isArray(rawDoc.history));
      assert.ok(rawDoc.history.length >= 4, 'History must record all transitions without overwrite');
      const actions = rawDoc.history.map((h) => h.action);
      assert.ok(actions.includes('CREATED'));
      assert.ok(actions.includes('STATUS_CHANGE'));
    });

    it('should update investigation status to FALSE_POSITIVE and synchronize alert status', async () => {
      // createdInvId is currently UNDER_REVIEW; transition to FALSE_POSITIVE
      const res = await request(app)
        .patch(`/api/fraud/investigations/${createdInvId}`)
        .set('Cookie', employeeCookie)
        .send({
          status: 'FALSE_POSITIVE',
          resolution: 'Confirmed legitimate transaction; false positive triggered by salary change'
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'FALSE_POSITIVE');
      assert.equal(res.body.data.resolution, 'Confirmed legitimate transaction; false positive triggered by salary change');

      // Verify fraud_alerts status is synchronized to FALSE_POSITIVE
      const db = getDb();
      const alertAfter = await db.collection('fraud_alerts').findOne({ _id: new ObjectId(testAlert1Id) });
      assert.equal(alertAfter.status, 'FALSE_POSITIVE', 'fraud_alerts status must synchronize to FALSE_POSITIVE');
    });
  });

  // ============================================================================
  // SECTION 6: Fraud Rule Management & Cache Invalidation
  // ============================================================================
  describe('6. Fraud Rule Configuration, Monetary Precision & Cache Invalidation', () => {
    it('should list all fraud rules with integer paise and rupee representations', async () => {
      const res = await request(app)
        .get('/api/fraud/rules')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      const rules = res.body.data.rules;
      assert.ok(Array.isArray(rules));
      assert.ok(rules.length >= 4);

      const highAmount = rules.find((r) => r.ruleCode === 'HIGH_AMOUNT');
      assert.ok(highAmount);
      assert.equal(typeof highAmount.threshold, 'number');
      assert.equal(typeof highAmount.thresholdInRupees, 'number');
      assert.equal(highAmount.threshold, highAmount.thresholdInRupees * 100);
    });

    it('should allow ADMIN to update HIGH_AMOUNT threshold in rupees and verify cache invalidation', async () => {
      // 1. Update threshold to ₹75,000.00 and weight to 35
      const res = await request(app)
        .patch('/api/fraud/rules/HIGH_AMOUNT')
        .set('Cookie', adminCookie)
        .send({
          thresholdInRupees: 75000,
          weight: 35
        });

      assert.equal(res.status, 200);
      const updated = res.body.data.rule;
      assert.equal(updated.threshold, 7500000, 'Threshold must be stored in integer paise: 7,500,000');
      assert.equal(updated.thresholdInRupees, 75000);
      assert.equal(updated.weight, 35);

      // 2. Verify cache invalidation: call getEnabledRules() and confirm updated values
      const enabledRules = await getEnabledRules();
      const cachedHighAmount = enabledRules.find((r) => r.ruleCode === 'HIGH_AMOUNT');
      assert.equal(cachedHighAmount.threshold, 7500000);
      assert.equal(cachedHighAmount.weight, 35);

      // 3. Restore threshold back to ₹50,000 and weight back to calibrated 30
      await request(app)
        .patch('/api/fraud/rules/HIGH_AMOUNT')
        .set('Cookie', adminCookie)
        .send({
          thresholdInRupees: 50000,
          weight: 30
        });
      const restoredRules = await getEnabledRules();
      const restoredHighAmount = restoredRules.find((r) => r.ruleCode === 'HIGH_AMOUNT');
      assert.equal(restoredHighAmount.threshold, 5000000);
      assert.equal(restoredHighAmount.weight, 30);
    });

    it('should reject invalid weight values (< 0 or > 100) with 400', async () => {
      const res = await request(app)
        .patch('/api/fraud/rules/HIGH_AMOUNT')
        .set('Cookie', adminCookie)
        .send({ weight: 150 });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'INVALID_RULE_WEIGHT');
    });

    it('should reject non-existent rule code with 404 RULE_NOT_FOUND', async () => {
      const res = await request(app)
        .patch('/api/fraud/rules/NON_EXISTENT_RULE')
        .set('Cookie', adminCookie)
        .send({ enabled: false });

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'RULE_NOT_FOUND');
    });
  });

  // ============================================================================
  // 7. Fraud Risk Weight Calibration & Scoring Capacity Verification
  // ============================================================================
  describe('7. Fraud Risk Weight Calibration & Scoring Capacity Verification', () => {
    it('1. All four rules load their updated calibrated weights from MongoDB', async () => {
      const rules = await getEnabledRules({ forceRefresh: true });
      const ruleMap = new Map(rules.map((r) => [r.ruleCode, r.weight]));

      assert.equal(ruleMap.get('HIGH_AMOUNT'), 30, 'HIGH_AMOUNT weight must be 30');
      assert.equal(ruleMap.get('HIGH_VELOCITY'), 25, 'HIGH_VELOCITY weight must be 25');
      assert.equal(ruleMap.get('NEW_BENEFICIARY'), 25, 'NEW_BENEFICIARY weight must be 25');
      assert.equal(ruleMap.get('UNUSUAL_HOUR'), 20, 'UNUSUAL_HOUR weight must be 20');
    });

    it('2. The total possible score across all configured rules is exactly 100', async () => {
      const res = await request(app)
        .get('/api/fraud/rules')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const rules = res.body.data.rules;
      const totalPossibleScore = rules.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
      assert.equal(totalPossibleScore, 100, 'Sum of all configured rule weights must equal 100');
    });

    it('3. Triggering all four rules produces a score of 100 and CRITICAL risk level', async () => {
      const tx = {
        transactionId: 99887766,
        customerId: 1,
        accountId: 10,
        destinationAccountId: 99,
        transactionType: 'TRANSFER',
        amount: 80000.0, // Triggers HIGH_AMOUNT (30 pts)
        timestamp: new Date('2026-11-05T03:00:00+05:30') // Triggers UNUSUAL_HOUR (20 pts)
      };
      const context = {
        recentTransactionCount: 5, // Triggers HIGH_VELOCITY (25 pts)
        isNewBeneficiary: true // Triggers NEW_BENEFICIARY (25 pts)
      };

      const result = await evaluateTransaction(tx, context, { forceRefreshRules: true });
      assert.equal(result.triggeredRules.length, 4, 'All four rules must trigger');
      assert.equal(result.assessment.riskScore, 100, 'Total score must be 30 + 25 + 25 + 20 = 100');
      assert.equal(result.assessment.riskLevel, 'CRITICAL', 'Score of 100 must be CRITICAL');
      assert.equal(result.assessment.decision, 'FLAGGED');
      assert.ok(result.alert, 'Alert must be generated for CRITICAL assessment');
      assert.equal(result.alert.riskLevel, 'CRITICAL');
    });

    it('4. A score of 80 is classified as CRITICAL', () => {
      assert.equal(classifyRiskLevel(80), 'CRITICAL');
      assert.equal(classifyRiskLevel(81), 'CRITICAL');
      assert.equal(classifyRiskLevel(100), 'CRITICAL');
    });

    it('5. A score of 60 is classified as HIGH', () => {
      assert.equal(classifyRiskLevel(60), 'HIGH');
      assert.equal(classifyRiskLevel(65), 'HIGH');
      assert.equal(classifyRiskLevel(79), 'HIGH');
    });

    it('6. Cache invalidation causes updated weights to be used without restarting application', async () => {
      // 1. Update weight of NEW_BENEFICIARY to 28
      const updateRes = await request(app)
        .patch('/api/fraud/rules/NEW_BENEFICIARY')
        .set('Cookie', adminCookie)
        .send({ weight: 28 });
      assert.equal(updateRes.status, 200);

      // 2. Fetch via getEnabledRules() immediately - cache was invalidated
      const freshRules = await getEnabledRules();
      const updatedRule = freshRules.find((r) => r.ruleCode === 'NEW_BENEFICIARY');
      assert.equal(updatedRule.weight, 28, 'Cache invalidation must load updated weight 28 without restart');

      // 3. Restore weight back to calibrated 25
      const restoreRes = await request(app)
        .patch('/api/fraud/rules/NEW_BENEFICIARY')
        .set('Cookie', adminCookie)
        .send({ weight: 25 });
      assert.equal(restoreRes.status, 200);

      const restoredRules = await getEnabledRules();
      assert.equal(restoredRules.find((r) => r.ruleCode === 'NEW_BENEFICIARY').weight, 25);
    });

    it('7. Existing fraud rule threshold editing still works and preserves weights', async () => {
      const res = await request(app)
        .patch('/api/fraud/rules/HIGH_AMOUNT')
        .set('Cookie', adminCookie)
        .send({ thresholdInRupees: 60000 });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.rule.threshold, 6000000);
      assert.equal(res.body.data.rule.thresholdInRupees, 60000);
      assert.equal(res.body.data.rule.weight, 30, 'Weight must remain intact when threshold is modified');

      // Restore threshold to 50,000
      await request(app)
        .patch('/api/fraud/rules/HIGH_AMOUNT')
        .set('Cookie', adminCookie)
        .send({ thresholdInRupees: 50000 });
    });

    it('8. Risk scoring remains strictly capped at 100', () => {
      const excessiveRules = [
        { ruleCode: 'RULE_1', points: 40 },
        { ruleCode: 'RULE_2', points: 35 },
        { ruleCode: 'RULE_3', points: 30 },
        { ruleCode: 'RULE_4', points: 25 }
      ]; // Sum = 130
      const score = calculateRiskScore(excessiveRules);
      assert.equal(score, 100, 'Score summing to 130 must be capped at 100');
    });
  });
});

