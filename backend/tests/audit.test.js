/**
 * ==============================================================================
 * Centralized Audit Logs & Activity Monitoring Integration Test Suite (Feature 2)
 * ==============================================================================
 * Verifies all 12 Section 8 Acceptance Criteria:
 * 1. Important operations create expected audit events across all banking modules.
 * 2. Actor identity is derived strictly from authenticated server sessions.
 * 3. Client-supplied actor IDs cannot spoof or override actor identity.
 * 4. Success and failure results are recorded accurately.
 * 5. Historical audit logs persist when employees/users are deactivated.
 * 6. Bank employees rejected with HTTP 403 AUTH_002.
 * 7. Customers rejected with HTTP 403 AUTH_002.
 * 8. Unauthenticated requests rejected with HTTP 401 AUTH_003.
 * 9. Pagination and all filters (date, action, entity, result, search) work accurately.
 * 10. Audit log inspection is strictly read-only (zero mutation endpoints exist).
 * 11. Sensitive credentials (passwords, hashes, tokens) are never recorded in metadata.
 * 12. Existing banking transactions and ledger records function normally.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, testConnection } = require('../src/config/db');
const { loginAs, loginAndGetUser } = require('./helpers/authHelper');
const { getLatestOtpForChallenge } = require('../src/services/otpService');

const TEST_PASSWORD = 'Password123!';

describe('Centralized Audit Logs & Activity Monitoring Suite (Feature 2)', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customerCookie = null;
  let adminUserId = null;
  let employeeUserId = null;
  let customerUserId = null;

  // Track created fixtures for cleanup
  const createdUserIds = [];
  const createdAccountIds = [];
  const createdAuditIds = [];

  let testAuditAccId = null;
  let testAuditAccNumber = null;

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // Authenticate Admin via 2FA OTP flow
    const adminAuth = await loginAndGetUser(request, app, 'test.admin1', TEST_PASSWORD);
    adminCookie = adminAuth.cookie;
    adminUserId = adminAuth.user.userId;

    // Authenticate Employee via 2FA OTP flow
    const empAuth = await loginAndGetUser(request, app, 'test.employee1', TEST_PASSWORD);
    employeeCookie = empAuth.cookie;
    employeeUserId = empAuth.user.userId;

    // Authenticate Customer via 2FA OTP flow
    const custAuth = await loginAndGetUser(request, app, 'test.customer1', TEST_PASSWORD);
    customerCookie = custAuth.cookie;
    customerUserId = custAuth.user.userId;

    // Setup an isolated test account for auditing tests
    const now = Date.now();
    testAuditAccNumber = `ACC-AUDIT-${now}`;
    const [a1] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 5000.00, 'ACTIVE')`,
      [testAuditAccNumber]
    );
    testAuditAccId = a1.insertId;
    createdAccountIds.push(testAuditAccId);
  });

  after(async () => {
    if (!isDbLive) return;

    try {
      // Clean up created accounts
      if (createdAccountIds.length > 0) {
        const placeholders = createdAccountIds.map(() => '?').join(',');
        await pool.execute(
          `DELETE foe FROM fraud_outbox_events foe
           JOIN bank_transactions bt ON foe.transaction_id = bt.transaction_id
           WHERE bt.source_account_id IN (${placeholders}) OR bt.destination_account_id IN (${placeholders})`,
          [...createdAccountIds, ...createdAccountIds]
        );
        await pool.execute(
          `DELETE FROM bank_transactions WHERE source_account_id IN (${placeholders}) OR destination_account_id IN (${placeholders})`,
          [...createdAccountIds, ...createdAccountIds]
        );
        await pool.execute(
          `DELETE FROM accounts WHERE account_id IN (${placeholders})`,
          createdAccountIds
        );
      }

      // Clean up created employees and users
      if (createdUserIds.length > 0) {
        await pool.execute(
          `DELETE FROM employees WHERE user_id IN (${createdUserIds.map(() => '?').join(',')})`,
          createdUserIds
        );
        await pool.execute(
          `DELETE FROM customers WHERE user_id IN (${createdUserIds.map(() => '?').join(',')})`,
          createdUserIds
        );
        await pool.execute(
          `DELETE FROM users WHERE user_id IN (${createdUserIds.map(() => '?').join(',')})`,
          createdUserIds
        );
      }

      // Clean up created test audit logs
      if (createdAuditIds.length > 0) {
        await pool.execute(
          `DELETE FROM audit_logs WHERE audit_id IN (${createdAuditIds.map(() => '?').join(',')})`,
          createdAuditIds
        );
      }
    } catch (cleanupErr) {
      console.error('Error during audit test teardown:', cleanupErr.message);
    } finally {
      await pool.end();
    }
  });

  // ============================================================================
  // 1. Role-Based Access Control & Clearance (Criteria 6, 7, 8)
  // ============================================================================
  describe('1. Role-Based Access Control and Security Clearance', () => {
    it('should reject unauthenticated request to GET /api/audit-logs with AUTH_003 (401)', async () => {
      const res = await request(app).get('/api/audit-logs');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should reject Customer role with AUTH_002 (403)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', customerCookie);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject Employee role with AUTH_002 (403)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', employeeCookie);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should allow Administrator role to access GET /api/audit-logs (200)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', adminCookie);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
      assert.ok(res.body.data.pagination);
      assert.equal(typeof res.body.data.pagination.total, 'number');
    });

    it('should allow Administrator to fetch filter dropdown options (200)', async () => {
      const res = await request(app)
        .get('/api/audit-logs/filters')
        .set('Cookie', adminCookie);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.actionTypes));
      assert.ok(Array.isArray(res.body.data.targetEntityTypes));
    });
  });

  // ============================================================================
  // 2. Read-Only Guarantees (Criteria 10)
  // ============================================================================
  describe('2. Read-Only Guarantees & Immutability', () => {
    it('should reject POST requests to /api/audit-logs (404/405 - no creation endpoint)', async () => {
      const res = await request(app)
        .post('/api/audit-logs')
        .set('Cookie', adminCookie)
        .send({ actionType: 'FAKE_ACTION' });
      assert.ok([404, 405].includes(res.status));
    });

    it('should reject PUT /api/audit-logs/:id attempts (404/405 - records cannot be mutated)', async () => {
      const res = await request(app)
        .put('/api/audit-logs/1')
        .set('Cookie', adminCookie)
        .send({ description: 'tampered log' });
      assert.ok([404, 405].includes(res.status));
    });

    it('should reject DELETE /api/audit-logs/:id attempts (404/405 - records cannot be deleted)', async () => {
      const res = await request(app)
        .delete('/api/audit-logs/1')
        .set('Cookie', adminCookie);
      assert.ok([404, 405].includes(res.status));
    });
  });

  // ============================================================================
  // 3. Server Actor Derivation & Anti-Spoofing (Criteria 2, 3)
  // ============================================================================
  describe('3. Server Actor Derivation and Anti-Spoofing', () => {
    it('should ignore client-supplied spoofed actor ID and derive actor strictly from server session', async () => {
      const now = Date.now();
      const testEmpUsername = `emp_spoof_${now}`;

      // Admin creates an employee, but passes spoofed actorUserId: 999999 or customerUserId in body
      const empRes = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Anti Spoof Test',
          email: `${testEmpUsername}@bank.com`,
          phone: '+1-555-019-9999',
          username: testEmpUsername,
          initialPassword: TEST_PASSWORD,
          actorUserId: 999999, // Attempted spoofing
          actorId: 888888
        });

      assert.equal(empRes.status, 201);
      const createdUserId = empRes.body.data.userId;
      createdUserIds.push(createdUserId);

      // Inspect recorded audit event
      const auditRes = await request(app)
        .get(`/api/audit-logs?search=${testEmpUsername}`)
        .set('Cookie', adminCookie);

      assert.equal(auditRes.status, 200);
      const matching = auditRes.body.data.items.find(
        (i) => i.actionType === 'EMPLOYEE_CREATED' && i.description.includes(testEmpUsername)
      );
      assert.ok(matching, 'EMPLOYEE_CREATED audit event must be found');

      // Actor must be the authenticated admin (adminUserId), NOT the spoofed 999999
      assert.equal(matching.actor.userId, adminUserId);
      assert.equal(matching.actor.role, 'ADMIN');
    });
  });

  // ============================================================================
  // 4. Lifecycle Operations & Audited Events (Criteria 1, 4)
  // ============================================================================
  describe('4. Lifecycle Operations Auditing (Success and Failure Outcomes)', () => {
    it('should audit successful user login (USER_LOGIN)', async () => {
      await loginAs(request, app, 'test.admin1', TEST_PASSWORD);

      const auditRes = await request(app)
        .get('/api/audit-logs?actionType=USER_LOGIN&limit=5')
        .set('Cookie', adminCookie);

      assert.equal(auditRes.status, 200);
      assert.ok(auditRes.body.data.items.length > 0);
      const latestLogin = auditRes.body.data.items[0];
      assert.equal(latestLogin.actionType, 'USER_LOGIN');
      assert.equal(latestLogin.result, 'SUCCESS');
      assert.equal(latestLogin.targetEntityType, 'USER');
    });

    it('should audit failed login attempt (LOGIN_FAILED) with result FAILURE', async () => {
      const badLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent_audit_user', password: 'WrongPassword123!' });
      assert.equal(badLoginRes.status, 401);

      const auditRes = await request(app)
        .get('/api/audit-logs?actionType=LOGIN_FAILED&limit=5')
        .set('Cookie', adminCookie);

      assert.equal(auditRes.status, 200);
      assert.ok(auditRes.body.data.items.length > 0);
      const failedLogin = auditRes.body.data.items.find((i) =>
        i.description.includes('nonexistent_audit_user')
      );
      assert.ok(failedLogin, 'LOGIN_FAILED audit record must exist');
      assert.equal(failedLogin.result, 'FAILURE');
      assert.equal(failedLogin.actionType, 'LOGIN_FAILED');
    });

    it('should audit user logout (USER_LOGOUT)', async () => {
      // Create session via OTP flow, then log out
      const agent = request.agent(app);
      const loginRes = await agent
        .post('/api/auth/login')
        .send({ username: 'test.employee1', password: TEST_PASSWORD });
      assert.equal(loginRes.status, 200);
      const otp = getLatestOtpForChallenge(loginRes.body.data.challengeId);
      const verifyRes = await agent
        .post('/api/auth/verify-otp')
        .send({ challengeId: loginRes.body.data.challengeId, otp });
      assert.equal(verifyRes.status, 200);

      const logoutRes = await agent.post('/api/auth/logout');
      assert.equal(logoutRes.status, 200);

      const auditRes = await request(app)
        .get('/api/audit-logs?actionType=USER_LOGOUT&limit=5')
        .set('Cookie', adminCookie);

      assert.equal(auditRes.status, 200);
      const logoutItem = auditRes.body.data.items.find((i) =>
        i.description.includes('test.employee1')
      );
      assert.ok(logoutItem, 'USER_LOGOUT record must exist');
      assert.equal(logoutItem.result, 'SUCCESS');
    });

    it('should audit employee updates and status transitions (EMPLOYEE_UPDATED, EMPLOYEE_DEACTIVATED, EMPLOYEE_REACTIVATED)', async () => {
      const now = Date.now();
      const empUsername = `emp_life_${now}`;

      // 1. Create employee
      const createRes = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Lifecycle Test Emp',
          email: `${empUsername}@bank.com`,
          phone: '+1-555-019-1234',
          username: empUsername,
          initialPassword: TEST_PASSWORD
        });
      assert.equal(createRes.status, 201);
      const empId = createRes.body.data.employeeId;
      createdUserIds.push(createRes.body.data.userId);

      // 2. Update employee profile
      const updateRes = await request(app)
        .put(`/api/employees/${empId}`)
        .set('Cookie', adminCookie)
        .send({ fullName: 'Lifecycle Updated Emp', phone: '+1-555-019-9999' });
      assert.equal(updateRes.status, 200);

      // 3. Deactivate employee
      const deactRes = await request(app)
        .patch(`/api/employees/${empId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'INACTIVE' });
      assert.equal(deactRes.status, 200);

      // 4. Reactivate employee
      const reactRes = await request(app)
        .patch(`/api/employees/${empId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'ACTIVE' });
      assert.equal(reactRes.status, 200);

      // Verify all actions logged in audit trail
      const auditRes = await request(app)
        .get(`/api/audit-logs?search=${empUsername}`)
        .set('Cookie', adminCookie);
      assert.equal(auditRes.status, 200);
      const items = auditRes.body.data.items;

      assert.ok(items.some((i) => i.actionType === 'EMPLOYEE_CREATED'));
      assert.ok(items.some((i) => i.actionType === 'EMPLOYEE_UPDATED'));
      assert.ok(items.some((i) => i.actionType === 'EMPLOYEE_DEACTIVATED'));
      assert.ok(items.some((i) => i.actionType === 'EMPLOYEE_REACTIVATED'));
    });

    it('should audit customer registration and updates (CUSTOMER_REGISTERED, CUSTOMER_UPDATED)', async () => {
      const now = Date.now();
      const custUsername = `cust_audit_${now}`;

      // Register customer as employee
      const regRes = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Audit Customer',
          dateOfBirth: '1992-05-15',
          phone: `+1-555-${String(now).slice(-7)}`,
          email: `${custUsername}@example.com`,
          address: '123 Governance St, Suite 4',
          username: custUsername,
          password: TEST_PASSWORD
        });

      assert.equal(regRes.status, 201);
      const custId = regRes.body.data.customerId;
      createdUserIds.push(regRes.body.data.userId);

      // Update customer as employee
      const updateRes = await request(app)
        .put(`/api/customers/${custId}`)
        .set('Cookie', employeeCookie)
        .send({ address: '456 Updated Governance Way' });
      assert.equal(updateRes.status, 200);

      // Verify audit logs
      const auditRes = await request(app)
        .get(`/api/audit-logs?search=${custUsername}`)
        .set('Cookie', adminCookie);

      assert.equal(auditRes.status, 200);
      const items = auditRes.body.data.items;
      assert.ok(items.some((i) => i.actionType === 'CUSTOMER_REGISTERED'));
      assert.ok(items.some((i) => i.actionType === 'CUSTOMER_UPDATED'));
    });

    it('should audit account creation and status updates (ACCOUNT_CREATED, ACCOUNT_FROZEN, ACCOUNT_UNFROZEN)', async () => {
      // 1. Create account as employee
      const createRes = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({ customerId: 1, accountType: 'SAVINGS' });
      assert.equal(createRes.status, 201);
      const accId = createRes.body.data.accountId;
      const accNum = createRes.body.data.accountNumber;
      createdAccountIds.push(accId);

      // 2. Freeze account
      const freezeRes = await request(app)
        .patch(`/api/accounts/${accId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'FROZEN', reason: 'Compliance audit lock' });
      assert.equal(freezeRes.status, 200);

      // 3. Unfreeze account
      const unfreezeRes = await request(app)
        .patch(`/api/accounts/${accId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'ACTIVE', reason: 'Compliance check cleared' });
      assert.equal(unfreezeRes.status, 200);

      // Verify audit logs
      const auditRes = await request(app)
        .get(`/api/audit-logs?search=${accNum}`)
        .set('Cookie', adminCookie);

      assert.equal(auditRes.status, 200);
      const items = auditRes.body.data.items;
      assert.ok(items.some((i) => i.actionType === 'ACCOUNT_CREATED'));
      assert.ok(items.some((i) => i.actionType === 'ACCOUNT_FROZEN'));
      assert.ok(items.some((i) => i.actionType === 'ACCOUNT_UNFROZEN'));
    });

    it('should audit completed deposits and withdrawals (DEPOSIT_COMPLETED, WITHDRAWAL_COMPLETED)', async () => {
      // Deposit 1500.00
      const depRes = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({ accountId: testAuditAccId, amount: 1500.0, remarks: 'Audit deposit verification' });
      assert.equal(depRes.status, 201);

      // Withdraw 500.00
      const withRes = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', employeeCookie)
        .send({ accountId: testAuditAccId, amount: 500.0, remarks: 'Audit withdrawal verification' });
      assert.equal(withRes.status, 201);

      const auditRes = await request(app)
        .get(`/api/audit-logs?search=${testAuditAccNumber}`)
        .set('Cookie', adminCookie);

      assert.equal(auditRes.status, 200);
      const items = auditRes.body.data.items;
      assert.ok(items.some((i) => i.actionType === 'DEPOSIT_COMPLETED' && i.result === 'SUCCESS'));
      assert.ok(items.some((i) => i.actionType === 'WITHDRAWAL_COMPLETED' && i.result === 'SUCCESS'));
    });

    it('should audit failed withdrawals (WITHDRAWAL_FAILED) when funds are insufficient', async () => {
      const excessiveAmount = 99999999.0;
      const failRes = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', employeeCookie)
        .send({ accountId: testAuditAccId, amount: excessiveAmount });
      assert.equal(failRes.status, 422);

      const auditRes = await request(app)
        .get(`/api/audit-logs?actionType=WITHDRAWAL_FAILED&limit=5`)
        .set('Cookie', adminCookie);

      assert.equal(auditRes.status, 200);
      const failLog = auditRes.body.data.items.find(
        (i) => i.actionType === 'WITHDRAWAL_FAILED' && Number(i.targetEntityId) === testAuditAccId
      );
      assert.ok(failLog, 'WITHDRAWAL_FAILED audit entry must exist');
      assert.equal(failLog.result, 'FAILURE');
      assert.equal(failLog.actor.userId, employeeUserId);
    });
  });

  // ============================================================================
  // 5. Sensitive Credential Stripping (Criteria 11)
  // ============================================================================
  describe('5. Credential Stripping & Secret Sanitization', () => {
    it('should NEVER record passwords, initialPasswords, or token hashes in audit log metadata', async () => {
      const now = Date.now();
      const secretUsername = `secret_test_${now}`;

      const secRes = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Secret Test Employee',
          email: `${secretUsername}@bank.com`,
          phone: '+1-555-019-8888',
          username: secretUsername,
          initialPassword: 'SuperSecretPlaintextPassword99!',
          password: 'SuperSecretPlaintextPassword99!'
        });
      if (secRes.body?.data?.userId) createdUserIds.push(secRes.body.data.userId);

      const [rows] = await pool.execute(
        `SELECT metadata FROM audit_logs WHERE description LIKE ?`,
        [`%${secretUsername}%`]
      );

      assert.ok(rows.length > 0, 'Audit record must be in database');
      for (const row of rows) {
        const rawJson = typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata);
        if (rawJson) {
          assert.ok(!rawJson.toLowerCase().includes('supersecretplaintextpassword99!'), 'Plaintext password must not be in metadata');
          assert.ok(!rawJson.toLowerCase().includes('initialpassword'), 'initialPassword key must be stripped');
          assert.ok(!rawJson.toLowerCase().includes('password_hash'), 'password_hash must be stripped');
          assert.ok(!rawJson.toLowerCase().includes('session'), 'session IDs must be stripped');
        }
      }
    });
  });

  // ============================================================================
  // 6. Preservation Across Deactivations (Criteria 5)
  // ============================================================================
  describe('6. Audit Record Preservation Across User Deactivation', () => {
    it('should preserve historical audit logs even when employee account is deactivated or deleted', async () => {
      const now = Date.now();
      const tempUsername = `temp_actor_${now}`;

      // 1. Create employee
      const createRes = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Deactivation Persistence Test',
          email: `${tempUsername}@bank.com`,
          phone: '+1-555-019-3333',
          username: tempUsername,
          initialPassword: TEST_PASSWORD
        });
      assert.equal(createRes.status, 201);
      const tempEmpId = createRes.body.data.employeeId;
      const tempUserId = createRes.body.data.userId;
      createdUserIds.push(tempUserId);

      // 2. Perform action as this new employee
      const agent = request.agent(app);
      const loginRes = await agent
        .post('/api/auth/login')
        .send({ username: tempUsername, password: TEST_PASSWORD });
      assert.equal(loginRes.status, 200);
      const tempOtp = getLatestOtpForChallenge(loginRes.body.data.challengeId);
      const verifyRes = await agent
        .post('/api/auth/verify-otp')
        .send({ challengeId: loginRes.body.data.challengeId, otp: tempOtp });
      assert.equal(verifyRes.status, 200);

      // Perform a deposit
      const depRes = await agent
        .post('/api/transactions/deposit')
        .send({ accountId: testAuditAccId, amount: 200.0, remarks: 'Deposit before deactivation' });
      assert.equal(depRes.status, 201);

      // 3. Admin deactivates the employee
      const deactRes = await request(app)
        .patch(`/api/employees/${tempEmpId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'INACTIVE' });
      assert.equal(deactRes.status, 200);

      // 4. Query audit logs - previously recorded deposit MUST still exist with actorUserId intact
      const auditRes = await request(app)
        .get(`/api/audit-logs?actorUserId=${tempUserId}`)
        .set('Cookie', adminCookie);

      assert.equal(auditRes.status, 200);
      assert.ok(auditRes.body.data.items.length >= 1, 'Audit log entries must persist after deactivation');
      const depositLog = auditRes.body.data.items.find((i) => i.actionType === 'DEPOSIT_COMPLETED');
      assert.ok(depositLog, 'DEPOSIT_COMPLETED log must persist');
      assert.equal(depositLog.actor.userId, tempUserId);
    });
  });

  // ============================================================================
  // 7. Filtering, Search & Pagination (Criteria 9)
  // ============================================================================
  describe('7. Filtering, Search, and Pagination Capabilities', () => {
    it('should filter logs by actionType', async () => {
      const res = await request(app)
        .get('/api/audit-logs?actionType=USER_LOGIN')
        .set('Cookie', adminCookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length > 0);
      assert.ok(res.body.data.items.every((i) => i.actionType === 'USER_LOGIN'));
    });

    it('should filter logs by targetEntityType', async () => {
      const res = await request(app)
        .get('/api/audit-logs?targetEntityType=ACCOUNT')
        .set('Cookie', adminCookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.every((i) => i.targetEntityType === 'ACCOUNT'));
    });

    it('should filter logs by result (SUCCESS and FAILURE)', async () => {
      const successRes = await request(app)
        .get('/api/audit-logs?result=SUCCESS')
        .set('Cookie', adminCookie);
      assert.equal(successRes.status, 200);
      assert.ok(successRes.body.data.items.every((i) => i.result === 'SUCCESS'));

      const failRes = await request(app)
        .get('/api/audit-logs?result=FAILURE')
        .set('Cookie', adminCookie);
      assert.equal(failRes.status, 200);
      assert.ok(failRes.body.data.items.every((i) => i.result === 'FAILURE'));
    });

    it('should paginate results with page and limit parameters', async () => {
      const res = await request(app)
        .get('/api/audit-logs?page=1&limit=3')
        .set('Cookie', adminCookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length <= 3);
      assert.equal(res.body.data.pagination.limit, 3);
      assert.equal(res.body.data.pagination.page, 1);
    });

    it('should filter by valid date range (startDate and endDate)', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/audit-logs?startDate=${today}&endDate=${today}`)
        .set('Cookie', adminCookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length > 0);
    });

    it('should reject invalid startDate > endDate with VAL_001 (400)', async () => {
      const res = await request(app)
        .get('/api/audit-logs?startDate=2026-12-31&endDate=2026-01-01')
        .set('Cookie', adminCookie);
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject malformed date format with VAL_001 (400)', async () => {
      const res = await request(app)
        .get('/api/audit-logs?startDate=invalid-date')
        .set('Cookie', adminCookie);
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VAL_001');
    });
  });

  // ============================================================================
  // 8. Banking Ledger Separation & Zero Regressions (Criteria 12)
  // ============================================================================
  describe('8. Monetary Ledger Independence and Core Banking Stability', () => {
    it('should maintain bank_transactions and audit_logs as completely separate tables', async () => {
      // bank_transactions has financial fields (transaction_ref, amount, source_account_id, destination_account_id)
      // audit_logs has operational governance fields (audit_id, actor_user_id, action_type, result, metadata)
      const [bankTxCols] = await pool.execute('DESCRIBE bank_transactions');
      const [auditCols] = await pool.execute('DESCRIBE audit_logs');

      const bankFieldNames = bankTxCols.map((c) => c.Field);
      const auditFieldNames = auditCols.map((c) => c.Field);

      assert.ok(bankFieldNames.includes('transaction_ref'));
      assert.ok(bankFieldNames.includes('amount'));
      assert.ok(!bankFieldNames.includes('action_type'));

      assert.ok(auditFieldNames.includes('audit_id'));
      assert.ok(auditFieldNames.includes('action_type'));
      assert.ok(auditFieldNames.includes('result'));
      assert.ok(!auditFieldNames.includes('transaction_ref'));
    });
  });
});
