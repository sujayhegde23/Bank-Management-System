/**
 * ==============================================================================
 * Critical Security Test Suite: Customer Account Data Isolation
 * ==============================================================================
 * Comprehensive security audit and authorization verification covering:
 * 1. Customer A sees their own accounts only.
 * 2. Customer B sees their own accounts only.
 * 3. Customer A cannot retrieve Customer B's account directly (GET /api/accounts/:id).
 * 4. Customer B cannot retrieve Customer A's account directly (GET /api/accounts/:id).
 * 5. Customer A cannot access Customer B's statement (GET /api/accounts/:id/statement).
 * 6. Customer A cannot access Customer B's transaction history (GET /api/accounts/:id/transactions).
 * 7. Customer A cannot initiate a transfer from Customer B's account (POST /api/transactions/transfer).
 * 8. Customer A cannot initiate a transfer from Customer B's account (POST /api/accounts/:id/transfers).
 * 9. Customer A cannot bypass isolation by supplying Customer B's customerId query filter.
 * 10. Customer A cannot view Customer B's profile (GET /api/customers/:id).
 * 11. Customer A cannot modify Customer B's profile (PUT/PATCH /api/customers/:id).
 * 12. Customer A cannot access Customer B's transaction receipts (GET /api/transactions/:id/receipt).
 * 13. Customer user without customer profile is denied access (403 AUTH_002).
 * 14. Unauthenticated requests are rejected with 401 AUTH_003.
 * 15. Employee account access and operations continue to work.
 * 16. Administrator account oversight continues to work.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool, query, testConnection } = require('../src/config/db');

const TEST_PASSWORD = 'Password123!';

describe('Critical Security Suite: Customer Account Data Isolation', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customerACookie = null;
  let customerAId = null;
  let customerBCookie = null;
  let customerBId = null;
  let unlinkedCustCookie = null;

  // Dedicated test fixtures
  let accountA1Id = null;
  let accountA1Num = null;
  let accountA2Id = null;
  let accountA2Num = null;
  let accountB1Id = null;
  let accountB1Num = null;
  let accountB2Id = null;
  let accountB2Num = null;

  let txnB1Id = null;

  const createdAccountIds = [];
  const createdCustomerIds = [];
  const createdUserIds = [];

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.admin1', password: TEST_PASSWORD });
    assert.equal(adminRes.status, 200);
    adminCookie = adminRes.headers['set-cookie'];

    // 2. Authenticate Employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.employee1', password: TEST_PASSWORD });
    assert.equal(empRes.status, 200);
    employeeCookie = empRes.headers['set-cookie'];

    // 3. Authenticate Customer A (test.customer1)
    const custARes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(custARes.status, 200);
    customerACookie = custARes.headers['set-cookie'];

    const meARes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', customerACookie);
    assert.equal(meARes.status, 200);
    customerAId = Number(meARes.body.data.customerId);
    assert.ok(customerAId, 'Customer A must have a valid customerId');

    // 4. Authenticate Customer B (test.customer2)
    const custBRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });
    assert.equal(custBRes.status, 200);
    customerBCookie = custBRes.headers['set-cookie'];

    const meBRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', customerBCookie);
    assert.equal(meBRes.status, 200);
    customerBId = Number(meBRes.body.data.customerId);
    assert.ok(customerBId, 'Customer B must have a valid customerId');
    assert.notEqual(customerAId, customerBId, 'Customer A and Customer B must be distinct customers');

    // 5. Create known dedicated isolation test accounts
    const suffix = Date.now().toString().slice(-6);

    // Account A1 (Customer A)
    accountA1Num = `ACC-SECA1-${suffix}`;
    const accA1Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, ?, 'SAVINGS', 10000.00, 'ACTIVE')`,
      [accountA1Num, customerAId]
    );
    accountA1Id = accA1Res.insertId;
    createdAccountIds.push(accountA1Id);

    // Account A2 (Customer A)
    accountA2Num = `ACC-SECA2-${suffix}`;
    const accA2Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, ?, 'CURRENT', 15000.00, 'ACTIVE')`,
      [accountA2Num, customerAId]
    );
    accountA2Id = accA2Res.insertId;
    createdAccountIds.push(accountA2Id);

    // Account B1 (Customer B)
    accountB1Num = `ACC-SECB1-${suffix}`;
    const accB1Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, ?, 'SAVINGS', 8000.00, 'ACTIVE')`,
      [accountB1Num, customerBId]
    );
    accountB1Id = accB1Res.insertId;
    createdAccountIds.push(accountB1Id);

    // Account B2 (Customer B)
    accountB2Num = `ACC-SECB2-${suffix}`;
    const accB2Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, ?, 'CURRENT', 12000.00, 'ACTIVE')`,
      [accountB2Num, customerBId]
    );
    accountB2Id = accB2Res.insertId;
    createdAccountIds.push(accountB2Id);

    // Insert a transaction on Account B1 to test receipt isolation
    const txnB1Res = await query(
      `INSERT INTO bank_transactions (transaction_ref, type, amount, destination_account_id, performed_by_user_id, remarks)
       VALUES (?, 'DEPOSIT', 1000.00, ?, ?, 'Cash deposit to B1')`,
      [`TXN-SECB1-${suffix}`, accountB1Id, 2]
    );
    txnB1Id = txnB1Res.insertId;

    // 6. Create Customer C (User with role CUSTOMER but NO row in customers table)
    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const unlinkedUserRes = await query(
      `INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'CUSTOMER', 'ACTIVE')`,
      [`unlinked_cust_${suffix}`, hash]
    );
    const unlinkedUserId = unlinkedUserRes.insertId;
    createdUserIds.push(unlinkedUserId);

    const unlinkedLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: `unlinked_cust_${suffix}`, password: TEST_PASSWORD });
    assert.equal(unlinkedLoginRes.status, 200);
    unlinkedCustCookie = unlinkedLoginRes.headers['set-cookie'];
  });

  after(async () => {
    try {
      if (createdAccountIds.length > 0) {
        for (const accId of createdAccountIds) {
          await query('DELETE FROM fraud_outbox_events WHERE transaction_id IN (SELECT transaction_id FROM bank_transactions WHERE source_account_id = ? OR destination_account_id = ?)', [accId, accId]).catch(() => {});
        }
        await query(
          `DELETE FROM bank_transactions WHERE source_account_id IN (${createdAccountIds.map(() => '?').join(',')}) OR destination_account_id IN (${createdAccountIds.map(() => '?').join(',')})`,
          [...createdAccountIds, ...createdAccountIds]
        );
      }
      if (txnB1Id) {
        await query('DELETE FROM fraud_outbox_events WHERE transaction_id = ?', [txnB1Id]).catch(() => {});
        await query('DELETE FROM bank_transactions WHERE transaction_id = ?', [txnB1Id]);
      }
      if (createdAccountIds.length > 0) {
        await query(`DELETE FROM accounts WHERE account_id IN (${createdAccountIds.map(() => '?').join(',')})`, createdAccountIds);
      }
      if (createdCustomerIds.length > 0) {
        await query(`DELETE FROM customers WHERE customer_id IN (${createdCustomerIds.map(() => '?').join(',')})`, createdCustomerIds);
      }
      if (createdUserIds.length > 0) {
        await query(`DELETE FROM users WHERE user_id IN (${createdUserIds.map(() => '?').join(',')})`, createdUserIds);
      }
      await pool.end();
    } catch (err) {
      console.error('Teardown error:', err);
    }
  });

  // ============================================================================
  // 1. Account Listing Isolation (GET /api/accounts)
  // ============================================================================
  describe('1. Account Listing Isolation (GET /api/accounts)', () => {
    it('Customer A must see only their own accounts, never Customer B accounts', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Cookie', customerACookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));

      // Customer A test accounts must be present
      const a1 = res.body.data.find((a) => a.accountId === accountA1Id);
      const a2 = res.body.data.find((a) => a.accountId === accountA2Id);
      assert.ok(a1, 'Account A1 must be visible to Customer A');
      assert.ok(a2, 'Account A2 must be visible to Customer A');

      // Customer B test accounts must NOT be present
      const b1 = res.body.data.find((a) => a.accountId === accountB1Id);
      const b2 = res.body.data.find((a) => a.accountId === accountB2Id);
      assert.equal(b1, undefined, "Customer B's Account B1 must NEVER leak to Customer A");
      assert.equal(b2, undefined, "Customer B's Account B2 must NEVER leak to Customer A");

      // Verify every single account belongs strictly to customerAId
      res.body.data.forEach((acc) => {
        assert.equal(acc.customerId, customerAId, `Account ${acc.accountNumber} has customerId ${acc.customerId}, expected ${customerAId}`);
      });
    });

    it('Customer B must see only their own accounts, never Customer A accounts', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Cookie', customerBCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));

      // Customer B test accounts must be present
      const b1 = res.body.data.find((a) => a.accountId === accountB1Id);
      const b2 = res.body.data.find((a) => a.accountId === accountB2Id);
      assert.ok(b1, 'Account B1 must be visible to Customer B');
      assert.ok(b2, 'Account B2 must be visible to Customer B');

      // Customer A test accounts must NOT be present
      const a1 = res.body.data.find((a) => a.accountId === accountA1Id);
      const a2 = res.body.data.find((a) => a.accountId === accountA2Id);
      assert.equal(a1, undefined, "Customer A's Account A1 must NEVER leak to Customer B");
      assert.equal(a2, undefined, "Customer A's Account A2 must NEVER leak to Customer B");

      res.body.data.forEach((acc) => {
        assert.equal(acc.customerId, customerBId, `Account ${acc.accountNumber} has customerId ${acc.customerId}, expected ${customerBId}`);
      });
    });

    it('Customer A cannot bypass isolation by supplying Customer B customerId in query', async () => {
      const res = await request(app)
        .get(`/api/accounts?customerId=${customerBId}`)
        .set('Cookie', customerACookie);

      // Must be rejected with 403 Forbidden (anti-spoofing)
      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ============================================================================
  // 2. Direct Account Access Protection (GET /api/accounts/:accountId)
  // ============================================================================
  describe('2. Direct Account Access Protection (GET /api/accounts/:accountId)', () => {
    it('Customer A can retrieve their own Account A1', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountA1Id}`)
        .set('Cookie', customerACookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.accountId, accountA1Id);
      assert.equal(res.body.data.customerId, customerAId);
    });

    it('Customer A cannot retrieve Customer B Account B1 directly (403 AUTH_002)', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountB1Id}`)
        .set('Cookie', customerACookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('Customer B cannot retrieve Customer A Account A1 directly (403 AUTH_002)', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountA1Id}`)
        .set('Cookie', customerBCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ============================================================================
  // 3. Statement Access Protection (GET /api/accounts/:accountId/statement)
  // ============================================================================
  describe('3. Statement Access Protection (GET /api/accounts/:accountId/statement)', () => {
    it('Customer A can access their own account statement', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountA1Id}/statement?preset=all`)
        .set('Cookie', customerACookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.account.accountId, accountA1Id);
    });

    it('Customer A cannot access Customer B statement (403 AUTH_002)', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountB1Id}/statement?preset=all`)
        .set('Cookie', customerACookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('Customer B cannot access Customer A statement (403 AUTH_002)', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountA1Id}/statement?preset=all`)
        .set('Cookie', customerBCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ============================================================================
  // 4. Transaction History Protection (GET /api/accounts/:accountId/transactions)
  // ============================================================================
  describe('4. Transaction History Protection (GET /api/accounts/:accountId/transactions)', () => {
    it('Customer A can access their own account transactions', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountA1Id}/transactions`)
        .set('Cookie', customerACookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.accountId, accountA1Id);
    });

    it('Customer A cannot access Customer B transaction history (403 AUTH_002)', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountB1Id}/transactions`)
        .set('Cookie', customerACookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('Customer B cannot access Customer A transaction history (403 AUTH_002)', async () => {
      const res = await request(app)
        .get(`/api/accounts/${accountA1Id}/transactions`)
        .set('Cookie', customerBCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ============================================================================
  // 5. Fund Transfer Protection (POST /api/transactions/transfer & /api/accounts/:id/transfers)
  // ============================================================================
  describe('5. Fund Transfer Protection', () => {
    it('Customer A can initiate a transfer from their own Account A1 to Account B1', async () => {
      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Cookie', customerACookie)
        .send({
          sourceAccountId: accountA1Id,
          destinationAccountId: accountB1Id,
          amount: 250.00,
          remarks: 'Legitimate payment to Customer B'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.sourceAccountId, accountA1Id);
    });

    it('Customer A cannot transfer FROM Customer B Account B1 via /api/transactions/transfer (403 AUTH_002)', async () => {
      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Cookie', customerACookie)
        .send({
          sourceAccountId: accountB1Id,
          destinationAccountId: accountA1Id,
          amount: 500.00,
          remarks: 'Illegitimate siphon attempt'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('Customer A cannot transfer FROM Customer B Account B1 via /api/accounts/:id/transfers (403 AUTH_002)', async () => {
      const res = await request(app)
        .post(`/api/accounts/${accountB1Id}/transfers`)
        .set('Cookie', customerACookie)
        .send({
          destinationAccountId: accountA1Id,
          amount: 500.00,
          remarks: 'Illegitimate URL manipulation attempt'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ============================================================================
  // 6. Customer Profile Protection (GET & PUT /api/customers/:id)
  // ============================================================================
  describe('6. Customer Profile Protection', () => {
    it('Customer A can view their own profile', async () => {
      const res = await request(app)
        .get(`/api/customers/${customerAId}`)
        .set('Cookie', customerACookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.customerId, customerAId);
    });

    it('Customer A cannot view Customer B profile (403 AUTH_002)', async () => {
      const res = await request(app)
        .get(`/api/customers/${customerBId}`)
        .set('Cookie', customerACookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('Customer A cannot modify Customer B profile (403 AUTH_002)', async () => {
      const res = await request(app)
        .put(`/api/customers/${customerBId}`)
        .set('Cookie', customerACookie)
        .send({
          phone: '+919999999999',
          email: 'hacked@evil.com',
          address: 'Malicious Address'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ============================================================================
  // 7. Transaction Receipt Protection (GET /api/transactions/:id/receipt)
  // ============================================================================
  describe('7. Transaction Receipt Protection', () => {
    it('Customer A cannot access Customer B transaction receipt (403 AUTH_002)', async () => {
      const res = await request(app)
        .get(`/api/transactions/${txnB1Id}/receipt`)
        .set('Cookie', customerACookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ============================================================================
  // 8. Unauthenticated & Unlinked Customer Access Protection
  // ============================================================================
  describe('8. Unauthenticated & Unlinked Customer Access Protection', () => {
    it('Customer user without a linked customer profile is denied account access with 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Cookie', unlinkedCustCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('Unauthenticated requests to /api/accounts are rejected with 401 AUTH_003', async () => {
      const res = await request(app).get('/api/accounts');
      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('Unauthenticated requests to /api/accounts/:id are rejected with 401 AUTH_003', async () => {
      const res = await request(app).get(`/api/accounts/${accountA1Id}`);
      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });
  });

  // ============================================================================
  // 9. Staff & Administrator Oversight Compatibility
  // ============================================================================
  describe('9. Staff & Administrator Oversight Compatibility', () => {
    it('Employee can retrieve Account A1 and Account B1', async () => {
      const resA = await request(app)
        .get(`/api/accounts/${accountA1Id}`)
        .set('Cookie', employeeCookie);
      assert.equal(resA.status, 200);
      assert.equal(resA.body.data.accountId, accountA1Id);

      const resB = await request(app)
        .get(`/api/accounts/${accountB1Id}`)
        .set('Cookie', employeeCookie);
      assert.equal(resB.status, 200);
      assert.equal(resB.body.data.accountId, accountB1Id);
    });

    it('Employee can filter accounts by customerId', async () => {
      const res = await request(app)
        .get(`/api/accounts?customerId=${customerAId}`)
        .set('Cookie', employeeCookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.data.length >= 2);
    });

    it('Administrator can view all accounts across the bank', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Cookie', adminCookie);
      assert.equal(res.status, 200);
      // Admin sees accounts across all customers
      const hasA = res.body.data.some((a) => a.accountId === accountA1Id);
      const hasB = res.body.data.some((a) => a.accountId === accountB1Id);
      assert.ok(hasA, 'Admin sees Customer A accounts');
      assert.ok(hasB, 'Admin sees Customer B accounts');
    });
  });
});
