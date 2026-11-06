/**
 * Automated Integration Test Suite: Employee Console UI & Workflow Improvements (Feature 1)
 *
 * Verifies:
 * 1. Account Status Enforcement (FR-11):
 *    - Rejects cash deposit on FROZEN account with HTTP 409 ACC_001
 *    - Rejects cash withdrawal on FROZEN account with HTTP 409 ACC_001
 *    - Rejects cash deposit on INACTIVE account with HTTP 409 ACC_001
 *    - Rejects cash withdrawal on INACTIVE account with HTTP 409 ACC_001
 * 2. Successful Counter Operations (FR-12, FR-13):
 *    - Executes deposit on ACTIVE account and returns new balance & reference (201)
 *    - Executes withdrawal on ACTIVE account and returns new balance & reference (201)
 * 3. Employee Role Security Boundaries (NFR-03, AUTH_002):
 *    - Employee forbidden from accessing Admin-only Employee Management (/api/employees)
 *    - Employee forbidden from accessing Admin-only Audit Logs (/api/audit-logs)
 *    - Employee forbidden from accessing Admin-only Executive Dashboard (/api/reports/dashboard)
 * 4. Safe Authentication & Profile Inspection:
 *    - Employee profile via GET /api/auth/me returns safe fields with EMPLOYEE role and ACTIVE status
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { query, pool, testConnection } = require('../src/config/db');

const TEST_PASSWORD = 'Password123!';

describe('Employee Console UI & Workflow Improvements Suite (Feature 1)', () => {
  let isDbLive = false;
  let employeeCookie = null;
  let employeeUserId = null;
  let activeAccountId = null;
  let frozenAccountId = null;
  let inactiveAccountId = null;
  const createdAccountIds = [];

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // Log in as test Employee
    const empLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.employee1', password: TEST_PASSWORD });
    assert.equal(empLoginRes.status, 200);
    employeeCookie = empLoginRes.headers['set-cookie'];
    employeeUserId = empLoginRes.body.data.userId;

    // Create a dedicated active account for testing
    const createRes = await request(app)
      .post('/api/accounts')
      .set('Cookie', employeeCookie)
      .send({
        customerId: 1,
        accountType: 'SAVINGS'
      });
    assert.equal(createRes.status, 201);
    activeAccountId = createRes.body.data.accountId;
    createdAccountIds.push(activeAccountId);

    // Initial deposit into active account so we have funds to test withdrawal
    const initDep = await request(app)
      .post(`/api/accounts/${activeAccountId}/deposits`)
      .set('Cookie', employeeCookie)
      .send({ amount: 1500.00, remarks: 'Test initial deposit' });
    assert.equal(initDep.status, 201);

    // Create account to freeze
    const freezeRes = await request(app)
      .post('/api/accounts')
      .set('Cookie', employeeCookie)
      .send({
        customerId: 1,
        accountType: 'CURRENT'
      });
    assert.equal(freezeRes.status, 201);
    frozenAccountId = freezeRes.body.data.accountId;
    createdAccountIds.push(frozenAccountId);

    // Freeze account
    await request(app)
      .patch(`/api/accounts/${frozenAccountId}/status`)
      .set('Cookie', employeeCookie)
      .send({ status: 'FROZEN', reason: 'Security freeze test' });

    // Create account to deactivate
    const inactRes = await request(app)
      .post('/api/accounts')
      .set('Cookie', employeeCookie)
      .send({
        customerId: 1,
        accountType: 'SAVINGS'
      });
    assert.equal(inactRes.status, 201);
    inactiveAccountId = inactRes.body.data.accountId;
    createdAccountIds.push(inactiveAccountId);

    // Deactivate account
    await request(app)
      .patch(`/api/accounts/${inactiveAccountId}/status`)
      .set('Cookie', employeeCookie)
      .send({ status: 'INACTIVE', reason: 'Closure test' });
  });

  after(async () => {
    try {
      if (createdAccountIds.length > 0) {
        await query(
          `DELETE FROM bank_transactions WHERE source_account_id IN (${createdAccountIds.map(() => '?').join(',')}) OR destination_account_id IN (${createdAccountIds.map(() => '?').join(',')})`,
          [...createdAccountIds, ...createdAccountIds]
        );
        await query(
          `DELETE FROM audit_logs WHERE target_entity_type = 'ACCOUNT' AND target_entity_id IN (${createdAccountIds.map(() => '?').join(',')})`,
          createdAccountIds
        );
        await query(
          `DELETE FROM accounts WHERE account_id IN (${createdAccountIds.map(() => '?').join(',')})`,
          createdAccountIds
        );
      }
    } catch (err) {
      console.error('Cleanup hook error:', err);
    } finally {
      if (pool && typeof pool.end === 'function') {
        try {
          await pool.end();
        } catch (_) {}
      }
    }
  });

  describe('1. Account Status Enforcement (FR-11)', () => {
    it('should reject cash deposit on FROZEN account with HTTP 409 ACC_001', async () => {
      const res = await request(app)
        .post(`/api/accounts/${frozenAccountId}/deposits`)
        .set('Cookie', employeeCookie)
        .send({ amount: 100.00, remarks: 'Deposit into frozen' });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
      assert.match(res.body.message, /frozen or inactive/i);
    });

    it('should reject cash withdrawal on FROZEN account with HTTP 409 ACC_001', async () => {
      const res = await request(app)
        .post(`/api/accounts/${frozenAccountId}/withdrawals`)
        .set('Cookie', employeeCookie)
        .send({ amount: 50.00, remarks: 'Withdraw from frozen' });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
      assert.match(res.body.message, /frozen or inactive/i);
    });

    it('should reject cash deposit on INACTIVE account with HTTP 409 ACC_001', async () => {
      const res = await request(app)
        .post(`/api/accounts/${inactiveAccountId}/deposits`)
        .set('Cookie', employeeCookie)
        .send({ amount: 200.00, remarks: 'Deposit into inactive' });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
      assert.match(res.body.message, /frozen or inactive/i);
    });

    it('should reject cash withdrawal on INACTIVE account with HTTP 409 ACC_001', async () => {
      const res = await request(app)
        .post(`/api/accounts/${inactiveAccountId}/withdrawals`)
        .set('Cookie', employeeCookie)
        .send({ amount: 50.00, remarks: 'Withdraw from inactive' });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
      assert.match(res.body.message, /frozen or inactive/i);
    });
  });

  describe('2. Active Account Counter Cash Operations (FR-12, FR-13)', () => {
    it('should successfully execute cash deposit on ACTIVE account and return new balance & reference', async () => {
      const res = await request(app)
        .post(`/api/accounts/${activeAccountId}/deposits`)
        .set('Cookie', employeeCookie)
        .send({ amount: 500.00, remarks: 'Counter deposit success test' });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.transactionRef);
      assert.equal(Number(res.body.data.amount), 500.00);
      assert.equal(Number(res.body.data.balanceAfter), 2000.00);
    });

    it('should successfully execute cash withdrawal on ACTIVE account and return new balance & reference', async () => {
      const res = await request(app)
        .post(`/api/accounts/${activeAccountId}/withdrawals`)
        .set('Cookie', employeeCookie)
        .send({ amount: 300.00, remarks: 'Counter withdrawal success test' });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.transactionRef);
      assert.equal(Number(res.body.data.amount), 300.00);
      assert.equal(Number(res.body.data.balanceAfter), 1700.00);
    });
  });

  describe('3. Employee Role Security Boundaries (NFR-03, AUTH_002)', () => {
    it('should forbid Employee from accessing /api/employees with HTTP 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/employees')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should forbid Employee from accessing /api/audit-logs with HTTP 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should forbid Employee from accessing /api/reports/dashboard with HTTP 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  describe('4. Safe Authentication Profile (My Profile §4)', () => {
    it('should return safe authenticated profile with EMPLOYEE role and ACTIVE status', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.role, 'EMPLOYEE');
      assert.equal(res.body.data.status, 'ACTIVE');
      assert.ok(res.body.data.displayName);
      assert.ok(res.body.data.employeeId);
      assert.equal(res.body.data.userId, employeeUserId);
      assert.equal(res.body.data.password, undefined);
      assert.equal(res.body.data.password_hash, undefined);
    });
  });
});
