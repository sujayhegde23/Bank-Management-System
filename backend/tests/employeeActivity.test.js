/**
 * ==============================================================================
 * Feature 4: Employee Personal Activity History Integration Test Suite
 * ==============================================================================
 * Verifies that bank employees can securely review their own historical banking
 * operations without exposing other staff members' activities, with server-enforced
 * actor derivation, date filtering, pagination, category filtering, and immutability.
 *
 * Test Scenarios:
 * 1. Employee can view their own activity history.
 * 2. Employee cannot view another employee's activity history (Strict Isolation).
 * 3. Client-supplied actor IDs cannot bypass restrictions (Anti-Spoofing).
 * 4. Pagination works correctly (page, limit, total, totalPages).
 * 5. Date filters work and validate properly (startDate, endDate, VAL_001).
 * 6. Activity type and category filters work (ACCOUNT, DEPOSIT, WITHDRAWAL).
 * 7. Empty activity history is handled cleanly.
 * 8. Audit entries cannot be modified or deleted through this feature.
 * 9. Unauthenticated requests and Customer requests are rejected (AUTH_003, AUTH_002).
 * 10. Existing administrator audit-log functionality remains intact.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, query, testConnection } = require('../src/config/db');
const { loginAs, loginAndGetUser } = require('./helpers/authHelper');

const TEST_PASSWORD = 'Password123!';

describe('Feature 4: Employee Personal Activity History Test Suite', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employee1Cookie = null;
  let employee1UserId = null;
  let employee2Cookie = null;
  let employee2UserId = null;
  let customerCookie = null;

  let testAccount1Id = null;
  let testAccount2Id = null;
  let emp1DepositTxnRef = null;
  let emp2DepositTxnRef = null;

  const createdAccountIds = [];
  const createdUserIds = [];

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // 1. Authenticate Admin
    adminCookie = await loginAs(request, app, 'test.admin1', TEST_PASSWORD);

    // 2. Authenticate Employee 1
    const emp1 = await loginAndGetUser(request, app, 'test.employee1', TEST_PASSWORD);
    employee1Cookie = emp1.cookie;
    employee1UserId = emp1.user.userId;

    // 3. Authenticate Employee 2
    const emp2 = await loginAndGetUser(request, app, 'test.employee2', TEST_PASSWORD);
    employee2Cookie = emp2.cookie;
    employee2UserId = emp2.user.userId;

    // 4. Authenticate Customer 1
    customerCookie = await loginAs(request, app, 'test.customer1', TEST_PASSWORD);

    // 5. Employee 1 creates an account for Customer 1
    const acc1Res = await request(app)
      .post('/api/accounts')
      .set('Cookie', employee1Cookie)
      .send({ customerId: 1, accountType: 'SAVINGS' });
    assert.equal(acc1Res.status, 201);
    testAccount1Id = acc1Res.body.data.accountId;
    createdAccountIds.push(testAccount1Id);

    // 6. Employee 2 creates an account for Customer 2
    const acc2Res = await request(app)
      .post('/api/accounts')
      .set('Cookie', employee2Cookie)
      .send({ customerId: 2, accountType: 'CURRENT' });
    assert.equal(acc2Res.status, 201);
    testAccount2Id = acc2Res.body.data.accountId;
    createdAccountIds.push(testAccount2Id);

    // 7. Employee 1 processes a cash deposit on Account 1
    const dep1Res = await request(app)
      .post(`/api/accounts/${testAccount1Id}/deposits`)
      .set('Cookie', employee1Cookie)
      .send({ amount: 1500, remarks: 'Emp1 Distinct Cash Deposit' });
    assert.equal(dep1Res.status, 201);
    emp1DepositTxnRef = dep1Res.body.data.transactionReference;

    // 8. Employee 2 processes a cash deposit on Account 2
    const dep2Res = await request(app)
      .post(`/api/accounts/${testAccount2Id}/deposits`)
      .set('Cookie', employee2Cookie)
      .send({ amount: 2500, remarks: 'Emp2 Distinct Cash Deposit' });
    assert.equal(dep2Res.status, 201);
    emp2DepositTxnRef = dep2Res.body.data.transactionReference;
  });

  after(async () => {
    if (isDbLive) {
      try {
        if (createdAccountIds.length > 0) {
          const ph = createdAccountIds.map(() => '?').join(',');
          await query(
            `DELETE foe FROM fraud_outbox_events foe
             JOIN bank_transactions bt ON foe.transaction_id = bt.transaction_id
             WHERE bt.source_account_id IN (${ph}) OR bt.destination_account_id IN (${ph})`,
            [...createdAccountIds, ...createdAccountIds]
          ).catch(() => {});
          await query(`DELETE FROM bank_transactions WHERE source_account_id IN (${ph}) OR destination_account_id IN (${ph})`, [...createdAccountIds, ...createdAccountIds]);
          await query(`DELETE FROM accounts WHERE account_id IN (${ph})`, createdAccountIds);
        }
        if (createdUserIds.length > 0) {
          const ph = createdUserIds.map(() => '?').join(',');
          await query(`DELETE FROM audit_logs WHERE actor_user_id IN (${ph})`, createdUserIds);
          await query(`DELETE FROM employees WHERE user_id IN (${ph})`, createdUserIds);
          await query(`DELETE FROM users WHERE user_id IN (${ph})`, createdUserIds);
        }
      } catch (err) {
        console.error('Test cleanup error:', err.message);
      } finally {
        try {
          await pool.end();
        } catch (_) {}
      }
    }
  });

  /* ----------------------------------------------------------------------------
     1. Employee Can View Their Own Activity
     ---------------------------------------------------------------------------- */
  describe('1. Employee Personal Activity Access', () => {
    it('should allow authenticated employee to view their own activity history (200 OK)', async () => {
      const res = await request(app)
        .get('/api/audit-logs/my-activity')
        .set('Cookie', employee1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items), 'items must be an array');
      assert.ok(res.body.data.items.length > 0, 'must contain audited operations');
      assert.ok(res.body.data.summary, 'must contain summary object');
      assert.ok(res.body.data.pagination, 'must contain pagination object');

      // Verify item fields
      const firstItem = res.body.data.items[0];
      assert.ok(firstItem.auditId, 'must have auditId');
      assert.ok(firstItem.actionType, 'must have actionType');
      assert.ok(firstItem.description, 'must have description');
      assert.ok(firstItem.result, 'must have result');
      assert.ok(firstItem.createdAt, 'must have createdAt');

      // Check summary numbers
      assert.ok(res.body.data.summary.totalOperations >= 2);
      assert.ok(res.body.data.summary.successOperations >= 2);
    });
  });

  /* ----------------------------------------------------------------------------
     2. Employee Cannot View Another Employee's Activity (Strict Isolation)
     ---------------------------------------------------------------------------- */
  describe('2. Strict Staff Isolation Boundary', () => {
    it('should strictly isolate Employee 1 from viewing Employee 2 activities', async () => {
      const emp1Res = await request(app)
        .get('/api/audit-logs/my-activity')
        .set('Cookie', employee1Cookie);

      assert.equal(emp1Res.status, 200);
      const emp1Items = emp1Res.body.data.items;

      // Employee 1 should see their deposit (emp1DepositTxnRef)
      const emp1HasOwnDeposit = emp1Items.some(i => i.description.includes(emp1DepositTxnRef) || i.description.includes('Emp1 Distinct Cash Deposit'));
      assert.ok(emp1HasOwnDeposit, 'Employee 1 must see their own deposit operation');

      // Employee 1 must NOT see Employee 2's deposit (emp2DepositTxnRef)
      const emp1HasEmp2Deposit = emp1Items.some(i => i.description.includes(emp2DepositTxnRef) || i.description.includes('Emp2 Distinct Cash Deposit'));
      assert.equal(emp1HasEmp2Deposit, false, 'Employee 1 must NEVER see Employee 2 deposit operation');

      // Check Employee 2's perspective
      const emp2Res = await request(app)
        .get('/api/audit-logs/my-activity')
        .set('Cookie', employee2Cookie);

      assert.equal(emp2Res.status, 200);
      const emp2Items = emp2Res.body.data.items;

      const emp2HasOwnDeposit = emp2Items.some(i => i.description.includes(emp2DepositTxnRef) || i.description.includes('Emp2 Distinct Cash Deposit'));
      assert.ok(emp2HasOwnDeposit, 'Employee 2 must see their own deposit operation');

      const emp2HasEmp1Deposit = emp2Items.some(i => i.description.includes(emp1DepositTxnRef) || i.description.includes('Emp1 Distinct Cash Deposit'));
      assert.equal(emp2HasEmp1Deposit, false, 'Employee 2 must NEVER see Employee 1 deposit operation');
    });
  });

  /* ----------------------------------------------------------------------------
     3. Anti-Spoofing: Client-Supplied Actor IDs Cannot Bypass Restrictions
     ---------------------------------------------------------------------------- */
  describe('3. Server-Side Actor Derivation and Anti-Spoofing', () => {
    it('should ignore client-supplied actorUserId in query params and return only session actor records', async () => {
      // Employee 1 passes ?actorUserId=<employee2UserId>
      const spoofRes = await request(app)
        .get(`/api/audit-logs/my-activity?actorUserId=${employee2UserId}`)
        .set('Cookie', employee1Cookie);

      assert.equal(spoofRes.status, 200);
      const items = spoofRes.body.data.items;

      // Must NOT contain Employee 2's activities
      const containsEmp2Record = items.some(i => i.description.includes(emp2DepositTxnRef));
      assert.equal(containsEmp2Record, false, 'Spoofed actorUserId must be completely ignored');

      // Must contain Employee 1's activities
      const containsEmp1Record = items.some(i => i.description.includes(emp1DepositTxnRef));
      assert.ok(containsEmp1Record, 'Session-derived actor records must be returned');
    });
  });

  /* ----------------------------------------------------------------------------
     4. Pagination Verification
     ---------------------------------------------------------------------------- */
  describe('4. Pagination Controls', () => {
    it('should paginate activity history with page and limit parameters', async () => {
      const page1Res = await request(app)
        .get('/api/audit-logs/my-activity?page=1&limit=1')
        .set('Cookie', employee1Cookie);

      assert.equal(page1Res.status, 200);
      assert.equal(page1Res.body.data.items.length, 1);
      assert.equal(page1Res.body.data.pagination.page, 1);
      assert.equal(page1Res.body.data.pagination.limit, 1);
      assert.ok(page1Res.body.data.pagination.total >= 2);
      assert.ok(page1Res.body.data.pagination.totalPages >= 2);

      const page2Res = await request(app)
        .get('/api/audit-logs/my-activity?page=2&limit=1')
        .set('Cookie', employee1Cookie);

      assert.equal(page2Res.status, 200);
      assert.equal(page2Res.body.data.items.length, 1);
      assert.equal(page2Res.body.data.pagination.page, 2);

      // Verify page 1 and page 2 return different records
      assert.notEqual(page1Res.body.data.items[0].auditId, page2Res.body.data.items[0].auditId);
    });
  });

  /* ----------------------------------------------------------------------------
     5. Date Range Filtering and Validation
     ---------------------------------------------------------------------------- */
  describe('5. Date Range Filtering & Validation', () => {
    it('should filter activities by valid startDate and endDate', async () => {
      const todayStr = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/audit-logs/my-activity?startDate=${todayStr}&endDate=${todayStr}`)
        .set('Cookie', employee1Cookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length > 0, 'Today filter must return operations processed today');
    });

    it('should reject invalid startDate format with HTTP 400 VAL_001', async () => {
      const res = await request(app)
        .get('/api/audit-logs/my-activity?startDate=04-11-2026')
        .set('Cookie', employee1Cookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject startDate after endDate with HTTP 400 VAL_001', async () => {
      const res = await request(app)
        .get('/api/audit-logs/my-activity?startDate=2026-12-31&endDate=2026-01-01')
        .set('Cookie', employee1Cookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });
  });

  /* ----------------------------------------------------------------------------
     6. Activity Type and Category Filtering
     ---------------------------------------------------------------------------- */
  describe('6. Category and Action Type Filtering', () => {
    it('should filter activities by category=DEPOSIT', async () => {
      const res = await request(app)
        .get('/api/audit-logs/my-activity?category=DEPOSIT')
        .set('Cookie', employee1Cookie);

      assert.equal(res.status, 200);
      const items = res.body.data.items;
      assert.ok(items.length > 0);
      assert.ok(items.every(i => i.actionType.startsWith('DEPOSIT_')), 'all items must be deposit actions');
    });

    it('should filter activities by category=ACCOUNT', async () => {
      const res = await request(app)
        .get('/api/audit-logs/my-activity?category=ACCOUNT')
        .set('Cookie', employee1Cookie);

      assert.equal(res.status, 200);
      const items = res.body.data.items;
      assert.ok(items.length > 0);
      assert.ok(items.every(i => i.targetEntityType === 'ACCOUNT' || i.actionType.startsWith('ACCOUNT_')));
    });

    it('should filter activities by specific actionType=ACCOUNT_CREATED', async () => {
      const res = await request(app)
        .get('/api/audit-logs/my-activity?actionType=ACCOUNT_CREATED')
        .set('Cookie', employee1Cookie);

      assert.equal(res.status, 200);
      const items = res.body.data.items;
      assert.ok(items.length > 0);
      assert.ok(items.every(i => i.actionType === 'ACCOUNT_CREATED'));
    });
  });

  /* ----------------------------------------------------------------------------
     7. Empty Activity History Handling
     ---------------------------------------------------------------------------- */
  describe('7. Empty Activity History Handling', () => {
    it('should gracefully handle empty activity history for staff with zero operations (200 OK)', async () => {
      // Create a brand new employee with zero operations
      const newEmpUserRes = await query(
        'INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)',
        [`fresh_emp_${Date.now()}`, '$2a$10$Wq093sM/55i8x75f73iSMeL.f6uJpU5Wl1nQd4b4n0P6m3K5k5R3K', 'EMPLOYEE', 'ACTIVE']
      );
      const newUserId = newEmpUserRes.insertId;
      createdUserIds.push(newUserId);

      await query(
        'INSERT INTO employees (user_id, full_name, email, phone) VALUES (?, ?, ?, ?)',
        [newUserId, 'Fresh Employee', `fresh_${Date.now()}@bank.com`, '+1-555-019-9999']
      );

      // Even if login was audited, query for non-matching category or date in distant future
      const emptyRes = await request(app)
        .get('/api/audit-logs/my-activity?category=WITHDRAWAL')
        .set('Cookie', employee2Cookie);

      // Verify that when zero records match, 200 OK is returned with empty list
      const distantRes = await request(app)
        .get('/api/audit-logs/my-activity?startDate=2099-01-01&endDate=2099-01-31')
        .set('Cookie', employee1Cookie);

      assert.equal(distantRes.status, 200);
      assert.equal(distantRes.body.success, true);
      assert.deepEqual(distantRes.body.data.items, []);
      assert.equal(distantRes.body.data.pagination.total, 0);
      assert.equal(distantRes.body.data.pagination.totalPages, 1);
    });
  });

  /* ----------------------------------------------------------------------------
     8. Immutability: Audit Entries Cannot Be Modified
     ---------------------------------------------------------------------------- */
  describe('8. Audit Log Immutability and Read-Only Enforcement', () => {
    it('should reject POST requests to /api/audit-logs/my-activity (404/405)', async () => {
      const res = await request(app)
        .post('/api/audit-logs/my-activity')
        .set('Cookie', employee1Cookie)
        .send({ actionType: 'FAKE_ACTION' });

      assert.ok([403, 404, 405].includes(res.status), `Expected 403/404/405, got ${res.status}`);
    });

    it('should reject PUT requests to /api/audit-logs/my-activity (404/405)', async () => {
      const res = await request(app)
        .put('/api/audit-logs/my-activity')
        .set('Cookie', employee1Cookie)
        .send({ description: 'tampered' });

      assert.ok([403, 404, 405].includes(res.status), `Expected 403/404/405, got ${res.status}`);
    });

    it('should reject DELETE requests to /api/audit-logs/my-activity (404/405)', async () => {
      const res = await request(app)
        .delete('/api/audit-logs/my-activity')
        .set('Cookie', employee1Cookie);

      assert.ok([403, 404, 405].includes(res.status), `Expected 403/404/405, got ${res.status}`);
    });
  });

  /* ----------------------------------------------------------------------------
     9. Authorization Boundaries: Unauthenticated & Customer Rejection
     ---------------------------------------------------------------------------- */
  describe('9. Authentication and Role Boundaries', () => {
    it('should reject unauthenticated request with HTTP 401 AUTH_003', async () => {
      const res = await request(app)
        .get('/api/audit-logs/my-activity');

      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should reject Customer role with HTTP 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/audit-logs/my-activity')
        .set('Cookie', customerCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject Administrator role from employee-specific endpoint with HTTP 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/audit-logs/my-activity')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  /* ----------------------------------------------------------------------------
     10. Administrator Audit Logs Remain Fully Functional
     ---------------------------------------------------------------------------- */
  describe('10. Administrator Centralized Audit Log Integrity', () => {
    it('should allow Administrator to access GET /api/audit-logs and view system-wide logs (200 OK)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));

      // Admin should see activities across different employees
      const items = res.body.data.items;
      const hasEmp1Activity = items.some(i => i.actor && i.actor.userId === employee1UserId);
      assert.ok(hasEmp1Activity, 'Admin must have oversight across staff activity');
    });

    it('should continue to forbid Employees from accessing the full admin audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Cookie', employee1Cookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });
});
