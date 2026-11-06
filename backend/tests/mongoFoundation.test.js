/**
 * ==============================================================================
 * Automated Test Suite: MongoDB Foundation for Fraud Detection (Phase 1)
 * ==============================================================================
 * Repository: sujayhegde23/Bank-Management-System
 *
 * Verifies all Section 8 Requirements:
 * 1. MongoDB connection initialization.
 * 2. MongoDB connection failure handling.
 * 3. Prevention of duplicate connections.
 * 4. Collection initialization (all 4 collections).
 * 5. Index creation & unique constraint enforcement.
 * 6. Idempotent initialization.
 * 7. MongoDB unavailability not breaking unrelated MySQL banking APIs.
 * 8. Admin diagnostics integration & customer isolation.
 * 9. Existing authentication and MySQL operations remain fully functional.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, testConnection: testMySqlConnection } = require('../src/config/db');
const {
  connectMongo,
  getDb,
  getMongoClient,
  isMongoConnected,
  testMongoConnection,
  closeMongo,
  DEFAULT_DB_NAME
} = require('../src/config/mongo');
const { initializeMongoDatabase, DEFAULT_FRAUD_RULES } = require('../src/config/initMongo');

const TEST_PASSWORD = 'Password123!';

describe('Phase 1: MongoDB Foundation for Fraud Detection Test Suite', () => {
  let customerCookie = null;
  let adminCookie = null;

  before(async () => {
    // 1. Verify MySQL connection (primary database)
    const mysqlStatus = await testMySqlConnection();
    assert.ok(mysqlStatus.connected, 'MySQL must be connected for integration tests');

    // 2. Obtain session cookies for API tests
    const custRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(custRes.status, 200);
    customerCookie = custRes.headers['set-cookie'];

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.admin1', password: TEST_PASSWORD });
    assert.equal(adminRes.status, 200);
    adminCookie = adminRes.headers['set-cookie'];
  });

  after(async () => {
    // Ensure clean connection closures
    await closeMongo().catch(() => {});
    await pool.end().catch(() => {});
  });

  // ============================================================================
  // Test 1: MongoDB Connection Initialization
  // ============================================================================
  it('Test 1: should initialize MongoDB connection and access the database', async () => {
    const client = await connectMongo();
    assert.ok(client, 'MongoClient should be returned');
    assert.equal(isMongoConnected(), true, 'isMongoConnected should report true');

    const db = getDb();
    assert.ok(db, 'getDb() should return database instance');
    assert.equal(db.databaseName, DEFAULT_DB_NAME, `Database name should be ${DEFAULT_DB_NAME}`);

    const status = await testMongoConnection();
    assert.equal(status.connected, true);
    assert.equal(status.database, DEFAULT_DB_NAME);
  });

  // ============================================================================
  // Test 2: Connection Failure Handling
  // ============================================================================
  it('Test 2: should handle connection failures gracefully without crashing', async () => {
    // Use non-existent port with small timeout to fail fast
    const unreachableUri = 'mongodb://127.0.0.1:27999/unreachable_db?serverSelectionTimeoutMS=500';

    const status = await testMongoConnection(unreachableUri);
    assert.equal(status.connected, false, 'Connection to invalid URI should report connected: false');
    assert.ok(typeof status.error === 'string', 'Error message should be captured');

    // Reconnect to valid database
    const recover = await connectMongo();
    assert.ok(recover, 'Should recover connection to primary MongoDB');
    assert.equal(isMongoConnected(), true);
  });

  // ============================================================================
  // Test 3: Prevention of Duplicate Connections (Singleton Pattern)
  // ============================================================================
  it('Test 3: should prevent duplicate connections and reuse active client', async () => {
    const client1 = await connectMongo();
    const client2 = await connectMongo();
    assert.equal(client1, client2, 'Subsequent connectMongo() calls must return the identical client instance');

    // Test concurrent connection calls
    const [c1, c2, c3] = await Promise.all([
      connectMongo(),
      connectMongo(),
      connectMongo()
    ]);
    assert.equal(c1, c2);
    assert.equal(c2, c3);
  });

  // ============================================================================
  // Test 4: Collection Initialization
  // ============================================================================
  it('Test 4: should initialize all 4 fraud detection collections', async () => {
    const initResult = await initializeMongoDatabase();
    assert.equal(initResult.success, true);

    const db = getDb();
    const collections = await db.listCollections().toArray();
    const names = collections.map((c) => c.name);

    assert.ok(names.includes('transaction_risk_assessments'), 'transaction_risk_assessments must exist');
    assert.ok(names.includes('fraud_alerts'), 'fraud_alerts must exist');
    assert.ok(names.includes('fraud_rules'), 'fraud_rules must exist');
    assert.ok(names.includes('fraud_investigations'), 'fraud_investigations must exist');
  });

  // ============================================================================
  // Test 5: Index Creation & Unique Constraints
  // ============================================================================
  it('Test 5: should create required indexes including unique constraints on transactionId and ruleCode', async () => {
    const db = getDb();

    // 1. transaction_risk_assessments indexes
    const riskIndexes = await db.collection('transaction_risk_assessments').indexes();
    const riskNames = riskIndexes.map((i) => i.name);
    assert.ok(riskNames.includes('uniq_assessment_transaction_id'), 'Unique transactionId index must exist on assessments');
    assert.ok(riskNames.includes('idx_assessment_customer_id'), 'customerId index must exist');
    assert.ok(riskNames.includes('idx_assessment_risk_level'), 'riskLevel index must exist');
    assert.ok(riskNames.includes('idx_assessment_assessed_at'), 'assessedAt index must exist');

    // 2. fraud_alerts indexes
    const alertIndexes = await db.collection('fraud_alerts').indexes();
    const alertNames = alertIndexes.map((i) => i.name);
    assert.ok(alertNames.includes('uniq_alert_transaction_id'), 'Unique transactionId index must exist on alerts');
    assert.ok(alertNames.includes('idx_alert_status'), 'status index must exist');
    assert.ok(alertNames.includes('idx_alert_risk_level'), 'riskLevel index must exist');
    assert.ok(alertNames.includes('idx_alert_created_at'), 'createdAt index must exist');

    // 3. fraud_rules indexes
    const ruleIndexes = await db.collection('fraud_rules').indexes();
    const ruleNames = ruleIndexes.map((i) => i.name);
    assert.ok(ruleNames.includes('uniq_rule_code'), 'Unique ruleCode index must exist on rules');
    assert.ok(ruleNames.includes('idx_rule_enabled'), 'enabled index must exist');

    // 4. fraud_investigations indexes
    const investIndexes = await db.collection('fraud_investigations').indexes();
    const investNames = investIndexes.map((i) => i.name);
    assert.ok(investNames.includes('idx_investigation_alert_id'), 'alertId index must exist');
    assert.ok(investNames.includes('idx_investigation_transaction_id'), 'transactionId index must exist');
    assert.ok(investNames.includes('idx_investigation_employee_id'), 'assignedEmployeeId index must exist');
    assert.ok(investNames.includes('idx_investigation_status'), 'status index must exist');

    // 5. Test unique constraint enforcement: inserting duplicate transactionId in assessments throws code 11000
    const dummyTxId = 99999901;
    const testDoc = {
      transactionId: dummyTxId,
      customerId: 1,
      accountId: 1,
      transactionType: 'TRANSFER',
      amount: 1000,
      riskScore: 20,
      riskLevel: 'LOW',
      triggeredRules: [],
      decision: 'APPROVED',
      assessedAt: new Date()
    };

    // Clean up test document if present from previous run
    await db.collection('transaction_risk_assessments').deleteOne({ transactionId: dummyTxId });

    // First insert succeeds
    await db.collection('transaction_risk_assessments').insertOne({ ...testDoc });

    // Second insert with same transactionId must fail with duplicate key error (code 11000)
    await assert.rejects(
      async () => {
        await db.collection('transaction_risk_assessments').insertOne({ ...testDoc });
      },
      (err) => err.code === 11000 || String(err.message).includes('duplicate key')
    );

    // Clean up test document
    await db.collection('transaction_risk_assessments').deleteOne({ transactionId: dummyTxId });
  });

  // ============================================================================
  // Test 6: Idempotent Initialization
  // ============================================================================
  it('Test 6: should execute initialization repeatedly without throwing or duplicating rules', async () => {
    // Run initialization twice
    const res1 = await initializeMongoDatabase();
    assert.equal(res1.success, true);

    const res2 = await initializeMongoDatabase();
    assert.equal(res2.success, true);
    assert.equal(res2.rulesSeeded, 0, 'No duplicate rules should be seeded on repeat runs');

    const db = getDb();
    const totalRules = await db.collection('fraud_rules').countDocuments();
    assert.equal(totalRules, DEFAULT_FRAUD_RULES.length, `Rule count must remain exactly ${DEFAULT_FRAUD_RULES.length}`);
  });

  // ============================================================================
  // Test 7: MongoDB Unavailability Does NOT Break Banking APIs
  // ============================================================================
  it('Test 7: should keep MySQL banking operations fully functional when MongoDB is disconnected', async () => {
    // 1. Temporarily close MongoDB client
    await closeMongo();
    assert.equal(isMongoConnected(), false, 'MongoDB should now be disconnected');

    // 2. Health check reports MySQL CONNECTED and MongoDB DISCONNECTED, without failing the service
    const healthRes = await request(app).get('/api/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.data.status, 'UP');
    assert.equal(healthRes.body.data.database.status, 'CONNECTED');
    // Ensure no sensitive credentials leaked
    assert.equal(healthRes.body.data.database.password, undefined);
    assert.equal(healthRes.body.data.mongodb.password, undefined);

    // 3. Banking operations continue working: Login succeeds
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(loginRes.status, 200);

    // 4. Customer account access works
    const accountsRes = await request(app)
      .get('/api/accounts')
      .set('Cookie', customerCookie);
    assert.equal(accountsRes.status, 200);
    assert.ok(Array.isArray(accountsRes.body.data), 'Accounts list should return an array');

    // 5. Customer profile access works
    const profileRes = await request(app)
      .get('/api/customers/profile')
      .set('Cookie', customerCookie);
    assert.equal(profileRes.status, 200);
    assert.equal(profileRes.body.data.customerId, 1);

    // Re-establish MongoDB connection for remaining tests
    await connectMongo();
    assert.equal(isMongoConnected(), true);
  });

  // ============================================================================
  // Test 8: Admin Diagnostics Integration & Customer Isolation
  // ============================================================================
  it('Test 8: should expose MongoDB telemetry to ADMIN only, blocking non-admins', async () => {
    // 1. Administrator can view MongoDB diagnostic stats
    const adminDiagRes = await request(app)
      .get('/api/diagnostics')
      .set('Cookie', adminCookie);

    assert.equal(adminDiagRes.status, 200);
    assert.equal(adminDiagRes.body.success, true);
    assert.ok(adminDiagRes.body.data.mongodb, 'mongodb telemetry should be reported in diagnostics');
    assert.equal(adminDiagRes.body.data.mongodb.connected, true);
    assert.equal(adminDiagRes.body.data.mongodb.status, 'CONNECTED');
    assert.ok(adminDiagRes.body.data.mongodb.collectionStats, 'collectionStats must be present');
    assert.ok(typeof adminDiagRes.body.data.mongodb.collectionStats.fraud_rules === 'number');

    // 2. Admin ping works
    const pingRes = await request(app)
      .get('/api/diagnostics/ping')
      .set('Cookie', adminCookie);

    assert.equal(pingRes.status, 200);
    assert.equal(pingRes.body.data.mongoConnected, true);

    // 3. Customer is strictly denied access to diagnostics (403 AUTH_002)
    const custDiagRes = await request(app)
      .get('/api/diagnostics')
      .set('Cookie', customerCookie);

    assert.equal(custDiagRes.status, 403);
    assert.equal(custDiagRes.body.errorCode, 'AUTH_002');
  });

  // ============================================================================
  // Test 9: Public Health Check Dual-Database Transparency
  // ============================================================================
  it('Test 9: /api/health distinguishes MySQL and MongoDB without leaking connection strings', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const d = res.body.data;
    assert.equal(d.status, 'UP');
    assert.ok(d.database, 'database status must be reported');
    assert.equal(d.database.status, 'CONNECTED');
    assert.ok(d.mongodb, 'mongodb status must be reported');
    assert.equal(d.mongodb.status, 'CONNECTED');

    // Stringify payload to verify zero leak of MongoDB credentials or URI
    const str = JSON.stringify(d);
    assert.ok(!str.includes('mongodb://'), 'Raw MONGODB_URI must not be exposed');
    assert.ok(!str.includes('27017'), 'Port must not be exposed in public health');
    assert.ok(!str.includes('password'), 'Passwords must never be exposed');
  });
});

