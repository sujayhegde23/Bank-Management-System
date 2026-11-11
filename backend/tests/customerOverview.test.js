/**
 * ==============================================================================
 * Feature 1: Customer Account Overview Integration Test Suite
 * ==============================================================================
 * Verifies that retail banking customers can safely view and filter their own
 * bank accounts (FR-09), with server-enforced customer isolation, status filtering,
 * account type filtering, account number searching, anti-spoofing protection, and
 * read-only non-mutation guarantees.
 *
 * Test Scenarios:
 * 1. Customer can retrieve their own bank accounts.
 * 2. Customer cannot view accounts belonging to other customers (Horizontal Isolation).
 * 3. Client-supplied customerId tampering is rejected with 403 AUTH_002 (Anti-Spoofing).
 * 4. Unauthenticated requests are rejected with 401 AUTH_003.
 * 5. Customer can filter by status (ACTIVE, FROZEN, INACTIVE).
 * 6. Invalid status filter returns 400 VAL_001.
 * 7. Customer can filter by accountType (SAVINGS, CURRENT).
 * 8. Invalid accountType filter returns 400 VAL_001.
 * 9. Search filter matches by account number.
 * 10. Search with non-matching term returns empty list cleanly.
 * 11. Multi-filter combination (accountType + status) works accurately.
 * 12. Ledger balances are returned as numbers matching database without mutation.
 * 13. Staff and Admin oversight filtering continues to work seamlessly.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, query, testConnection } = require('../src/config/db');
const { loginAs } = require('./helpers/authHelper');

const TEST_PASSWORD = 'Password123!';

describe('Feature 1: Customer Account Overview Test Suite', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customer1Cookie = null;
  let customer1Id = null;
  let customer2Cookie = null;
  let customer2Id = null;

  let testCust1SavingsAccId = null;
  let testCust1CurrentAccId = null;
  let testCust1FrozenAccId = null;
  let testCust2SavingsAccId = null;

  let testCust1SavingsAccNum = null;
  let testCust1CurrentAccNum = null;
  let testCust1FrozenAccNum = null;

  const createdAccountIds = [];
  const createdCustomerIds = [];
  const createdUserIds = [];

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // 1. Authenticate Admin
    adminCookie = await loginAs(request, app, 'test.admin1', TEST_PASSWORD);

    // 2. Authenticate Employee
    employeeCookie = await loginAs(request, app, 'test.employee1', TEST_PASSWORD);

    // 3. Authenticate Customer 1
    customer1Cookie = await loginAs(request, app, 'test.customer1', TEST_PASSWORD);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', customer1Cookie);
    assert.equal(meRes.status, 200);
    customer1Id = meRes.body.data.customerId;
    assert.ok(customer1Id, 'Customer 1 must have an associated customerId');

    // 4. Create Customer 2 fixture to verify horizontal isolation
    const uniqueSuffix = Date.now().toString().slice(-6);
    const cust2UserRes = await query(
      `INSERT INTO users (username, password_hash, role, status) VALUES (?, 'hash', 'CUSTOMER', 'ACTIVE')`,
      [`cust_overview_test_${uniqueSuffix}`]
    );
    const cust2UserId = cust2UserRes.insertId;
    createdUserIds.push(cust2UserId);

    const cust2Res = await query(
      `INSERT INTO customers (user_id, full_name, date_of_birth, phone, email, address) VALUES (?, ?, '1990-01-01', ?, ?, '123 Test Street')`,
      [cust2UserId, `Test Overview Cust ${uniqueSuffix}`, `+9198765${uniqueSuffix}`, `overview_${uniqueSuffix}@bank.com`]
    );
    customer2Id = cust2Res.insertId;
    createdCustomerIds.push(customer2Id);

    // 5. Create known test accounts for Customer 1
    // Account 1: ACTIVE SAVINGS
    const acc1Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, ?, 'SAVINGS', 15000.00, 'ACTIVE')`,
      [`ACC-OV1-SAV-${uniqueSuffix}`, customer1Id]
    );
    testCust1SavingsAccId = acc1Res.insertId;
    testCust1SavingsAccNum = `ACC-OV1-SAV-${uniqueSuffix}`;
    createdAccountIds.push(testCust1SavingsAccId);

    // Account 2: ACTIVE CURRENT
    const acc2Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, ?, 'CURRENT', 25000.50, 'ACTIVE')`,
      [`ACC-OV1-CUR-${uniqueSuffix}`, customer1Id]
    );
    testCust1CurrentAccId = acc2Res.insertId;
    testCust1CurrentAccNum = `ACC-OV1-CUR-${uniqueSuffix}`;
    createdAccountIds.push(testCust1CurrentAccId);

    // Account 3: FROZEN SAVINGS
    const acc3Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, ?, 'SAVINGS', 5000.00, 'FROZEN')`,
      [`ACC-OV1-FRZ-${uniqueSuffix}`, customer1Id]
    );
    testCust1FrozenAccId = acc3Res.insertId;
    testCust1FrozenAccNum = `ACC-OV1-FRZ-${uniqueSuffix}`;
    createdAccountIds.push(testCust1FrozenAccId);

    // Account 4: Customer 2 account (must NEVER be visible to Customer 1)
    const acc4Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, ?, 'SAVINGS', 99999.00, 'ACTIVE')`,
      [`ACC-OV2-ISO-${uniqueSuffix}`, customer2Id]
    );
    testCust2SavingsAccId = acc4Res.insertId;
    createdAccountIds.push(testCust2SavingsAccId);
  });

  after(async () => {
    if (createdAccountIds.length > 0) {
      await query(`DELETE FROM accounts WHERE account_id IN (${createdAccountIds.map(() => '?').join(',')})`, createdAccountIds);
    }
    if (createdCustomerIds.length > 0) {
      await query(`DELETE FROM customers WHERE customer_id IN (${createdCustomerIds.map(() => '?').join(',')})`, createdCustomerIds);
    }
    if (createdUserIds.length > 0) {
      await query(`DELETE FROM users WHERE user_id IN (${createdUserIds.map(() => '?').join(',')})`, createdUserIds);
    }
    try {
      await pool.end();
    } catch (_) {}
  });

  // ----------------------------------------------------------------------------
  // 1. Authentication & Horizontal Customer Isolation
  // ----------------------------------------------------------------------------
  describe('Customer Identity & Horizontal Isolation', () => {
    it('should reject unauthenticated request with 401 AUTH_003', async () => {
      const res = await request(app).get('/api/accounts');
      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should return only accounts belonging to the authenticated customer', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Response data must be an array');

      // Every returned account must belong strictly to customer1Id
      res.body.data.forEach((acc) => {
        assert.equal(acc.customerId, customer1Id, `Account ${acc.accountNumber} must belong to authenticated customer`);
      });

      // Customer 2's account must NOT be present
      const cust2Acc = res.body.data.find((a) => a.accountId === testCust2SavingsAccId);
      assert.equal(cust2Acc, undefined, "Customer 2's account must not leak to Customer 1");

      // Verify Customer 1's test accounts are present
      const savAcc = res.body.data.find((a) => a.accountId === testCust1SavingsAccId);
      assert.ok(savAcc, 'Customer 1 savings account must be present');
      assert.equal(savAcc.accountNumber, testCust1SavingsAccNum);
      assert.equal(savAcc.accountType, 'SAVINGS');
      assert.equal(savAcc.balance, 15000.00);
      assert.equal(savAcc.status, 'ACTIVE');
    });

    it('should reject client-supplied customerId tampering with 403 AUTH_002', async () => {
      const res = await request(app)
        .get(`/api/accounts?customerId=${customer2Id}`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Account Status Filtering
  // ----------------------------------------------------------------------------
  describe('Account Status Filtering', () => {
    it('should filter accounts by status=ACTIVE', async () => {
      const res = await request(app)
        .get('/api/accounts?status=ACTIVE')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      // All returned accounts must be ACTIVE
      res.body.data.forEach((acc) => {
        assert.equal(acc.status, 'ACTIVE');
      });

      // Frozen account must NOT be included
      const frozen = res.body.data.find((a) => a.accountId === testCust1FrozenAccId);
      assert.equal(frozen, undefined, 'FROZEN account must not appear when status=ACTIVE');
    });

    it('should filter accounts by status=FROZEN', async () => {
      const res = await request(app)
        .get('/api/accounts?status=FROZEN')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      res.body.data.forEach((acc) => {
        assert.equal(acc.status, 'FROZEN');
      });

      const frozen = res.body.data.find((a) => a.accountId === testCust1FrozenAccId);
      assert.ok(frozen, 'FROZEN account must appear when status=FROZEN');
    });

    it('should reject invalid status with 400 VAL_001', async () => {
      const res = await request(app)
        .get('/api/accounts?status=BOGUS_STATUS')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Account Type Filtering
  // ----------------------------------------------------------------------------
  describe('Account Type Filtering', () => {
    it('should filter accounts by accountType=SAVINGS', async () => {
      const res = await request(app)
        .get('/api/accounts?accountType=SAVINGS')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      res.body.data.forEach((acc) => {
        assert.equal(acc.accountType, 'SAVINGS');
      });

      // Current account must NOT be present
      const current = res.body.data.find((a) => a.accountId === testCust1CurrentAccId);
      assert.equal(current, undefined, 'CURRENT account must not appear when accountType=SAVINGS');
    });

    it('should filter accounts by accountType=CURRENT', async () => {
      const res = await request(app)
        .get('/api/accounts?accountType=CURRENT')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      res.body.data.forEach((acc) => {
        assert.equal(acc.accountType, 'CURRENT');
      });

      const current = res.body.data.find((a) => a.accountId === testCust1CurrentAccId);
      assert.ok(current, 'CURRENT account must appear when accountType=CURRENT');
    });

    it('should reject invalid accountType with 400 VAL_001', async () => {
      const res = await request(app)
        .get('/api/accounts?accountType=CHECKING')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Search Filter
  // ----------------------------------------------------------------------------
  describe('Account Search Filter', () => {
    it('should search by account number keyword', async () => {
      const res = await request(app)
        .get(`/api/accounts?search=${testCust1CurrentAccNum}`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].accountNumber, testCust1CurrentAccNum);
    });

    it('should return empty list when search term has no match', async () => {
      const res = await request(app)
        .get('/api/accounts?search=NONEXISTENT_KEYWORD_XYZ999')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.length, 0);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Multi-Filter Combination
  // ----------------------------------------------------------------------------
  describe('Multi-Filter Combination', () => {
    it('should apply both accountType=SAVINGS and status=ACTIVE together', async () => {
      const res = await request(app)
        .get('/api/accounts?accountType=SAVINGS&status=ACTIVE')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      res.body.data.forEach((acc) => {
        assert.equal(acc.accountType, 'SAVINGS');
        assert.equal(acc.status, 'ACTIVE');
      });

      // Frozen savings account must NOT appear
      const frozen = res.body.data.find((a) => a.accountId === testCust1FrozenAccId);
      assert.equal(frozen, undefined);

      // Current account must NOT appear
      const current = res.body.data.find((a) => a.accountId === testCust1CurrentAccId);
      assert.equal(current, undefined);
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Data Integrity & Invariance
  // ----------------------------------------------------------------------------
  describe('Read-Only Data Integrity & Non-Mutation', () => {
    it('should preserve ledger balances accurately without floating point corruption', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      const curAcc = res.body.data.find((a) => a.accountId === testCust1CurrentAccId);
      assert.ok(curAcc);
      assert.equal(typeof curAcc.balance, 'number');
      assert.equal(curAcc.balance, 25000.50);

      // Verify database record has not mutated
      const [dbRow] = await query('SELECT balance, status FROM accounts WHERE account_id = ?', [testCust1CurrentAccId]);
      assert.equal(Number(dbRow.balance), 25000.50);
      assert.equal(dbRow.status, 'ACTIVE');
    });
  });

  // ----------------------------------------------------------------------------
  // 7. Staff & Admin Access Compatibility
  // ----------------------------------------------------------------------------
  describe('Staff & Admin Oversight Compatibility', () => {
    it('should allow employee to list accounts with customerId filter', async () => {
      const res = await request(app)
        .get(`/api/accounts?customerId=${customer1Id}`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.length >= 3);
    });

    it('should allow admin to filter accounts by status and type', async () => {
      const res = await request(app)
        .get('/api/accounts?status=FROZEN&accountType=SAVINGS')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      res.body.data.forEach((acc) => {
        assert.equal(acc.status, 'FROZEN');
        assert.equal(acc.accountType, 'SAVINGS');
      });
    });
  });
});
