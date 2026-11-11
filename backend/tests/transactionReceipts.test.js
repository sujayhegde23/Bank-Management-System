/**
 * Automated Integration Test Suite: Transaction Receipt Generation (Feature 2)
 *
 * Verifies:
 * 1. Successful deposits produce authoritative, accurate receipts (matching database records)
 * 2. Successful withdrawals produce authoritative, accurate receipts (matching database records)
 * 3. Lookup supports both numeric transactionId and string transactionRef
 * 4. Non-existent or failed transactions return 404 TXN_004
 * 5. Unauthenticated requests return 401 AUTH_003
 * 6. Customers cannot access another customer's receipt (403 AUTH_002)
 * 7. Customers can view their own transaction receipts (200)
 * 8. Employees and Administrators can access counter receipts (200)
 * 9. Receipt retrieval is strictly read-only and never modifies account balances or records
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { query, pool, testConnection } = require('../src/config/db');
const { loginAs } = require('./helpers/authHelper');

const TEST_PASSWORD = 'Password123!';

describe('Feature 2: Transaction Receipt Generation Test Suite', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customer1Cookie = null;
  let customer2Cookie = null;
  let activeAccountId = null;
  let depositTxnRef = null;
  let depositTxnId = null;
  let withdrawTxnRef = null;
  let withdrawTxnId = null;
  const createdAccountIds = [];

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // 1. Log in as test Admin
    adminCookie = await loginAs(request, app, 'test.admin1', TEST_PASSWORD);

    // 2. Log in as test Employee
    employeeCookie = await loginAs(request, app, 'test.employee1', TEST_PASSWORD);

    // 3. Log in as Customer 1 (customer_id: 1)
    customer1Cookie = await loginAs(request, app, 'test.customer1', TEST_PASSWORD);

    // 4. Log in as Customer 2 (customer_id: 2)
    customer2Cookie = await loginAs(request, app, 'test.customer2', TEST_PASSWORD);

    // 5. Create an active account for Customer 1
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

    // Initial deposit of 2000.00
    const initDep = await request(app)
      .post(`/api/accounts/${activeAccountId}/deposits`)
      .set('Cookie', employeeCookie)
      .send({ amount: 2000.00, remarks: 'Opening counter deposit' });
    assert.equal(initDep.status, 201);
    depositTxnRef = initDep.body.data.transactionRef || initDep.body.data.transactionReference;
    depositTxnId = initDep.body.data.transactionId;

    // Withdrawal of 500.00
    const withdrawRes = await request(app)
      .post(`/api/accounts/${activeAccountId}/withdrawals`)
      .set('Cookie', employeeCookie)
      .send({ amount: 500.00, remarks: 'ATM branch withdrawal test' });
    assert.equal(withdrawRes.status, 201);
    withdrawTxnRef = withdrawRes.body.data.transactionRef || withdrawRes.body.data.transactionReference;
    withdrawTxnId = withdrawRes.body.data.transactionId;
  });

  after(async () => {
    if (!isDbLive) return;
    try {
      if (createdAccountIds.length > 0) {
        const placeholders = createdAccountIds.map(() => '?').join(',');
        await query(
          `DELETE FROM fraud_outbox_events WHERE transaction_id IN (
            SELECT transaction_id FROM bank_transactions
            WHERE source_account_id IN (${placeholders}) OR destination_account_id IN (${placeholders})
          )`,
          [...createdAccountIds, ...createdAccountIds]
        );
        await query(
          `DELETE FROM bank_transactions WHERE source_account_id IN (${placeholders}) OR destination_account_id IN (${placeholders})`,
          [...createdAccountIds, ...createdAccountIds]
        );
        await query(
          `DELETE FROM accounts WHERE account_id IN (${placeholders})`,
          createdAccountIds
        );
      }
    } catch (cleanupErr) {
      console.warn('Test teardown cleanup error:', cleanupErr.message);
    } finally {
      if (pool && typeof pool.end === 'function') {
        try {
          await pool.end();
        } catch (_) {}
      }
    }
  });

  // ============================================================================
  // 1. Cash Deposit Receipt Generation
  // ============================================================================
  describe('1. Cash Deposit Receipt Generation', () => {
    it('should generate an authoritative deposit receipt with complete bank, transaction, account, and balance details', async () => {
      const res = await request(app)
        .get(`/api/transactions/${depositTxnRef}/receipt`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const data = res.body.data;

      // Bank Information (§3)
      assert.ok(data.bank);
      assert.equal(data.bank.institutionName, 'CORE BANK');
      assert.equal(data.bank.receiptTitle, 'Official Counter Transaction Proof');

      // Transaction Information (§3, §4)
      assert.ok(data.transaction);
      assert.equal(data.transaction.transactionRef, depositTxnRef);
      assert.equal(data.transaction.type, 'DEPOSIT');
      assert.equal(data.transaction.transactionType, 'CASH DEPOSIT');
      assert.equal(data.transaction.status, 'SUCCESS');
      assert.equal(data.transaction.amount, 2000.00);
      assert.equal(data.transaction.remarks, 'Opening counter deposit');

      // Account Information (§3, §4)
      assert.ok(data.account);
      assert.equal(data.account.accountId, activeAccountId);
      assert.equal(data.account.accountType, 'SAVINGS');
      assert.ok(data.account.accountNumber.startsWith('ACC-'));
      assert.ok(data.account.customerName);

      // Balance Information (§3, §4)
      assert.ok(data.balance);
      assert.equal(data.balance.previousBalance, 0);
      assert.equal(data.balance.transactionAmount, 2000.00);
      assert.equal(data.balance.updatedBalance, 2000.00);

      // Employee Information (§3)
      assert.ok(data.employee);
      assert.ok(data.employee.name);
      assert.ok(data.employee.employeeId);
    });

    it('should retrieve identical receipt when querying by numeric transactionId', async () => {
      const res = await request(app)
        .get(`/api/transactions/${depositTxnId}/receipt`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.transaction.transactionRef, depositTxnRef);
      assert.equal(res.body.data.transaction.amount, 2000.00);
    });
  });

  // ============================================================================
  // 2. Cash Withdrawal Receipt Generation
  // ============================================================================
  describe('2. Cash Withdrawal Receipt Generation', () => {
    it('should generate an authoritative withdrawal receipt with accurate balance deduction', async () => {
      const res = await request(app)
        .get(`/api/transactions/${withdrawTxnRef}/receipt`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const data = res.body.data;

      // Transaction Information (§3, §5)
      assert.equal(data.transaction.transactionRef, withdrawTxnRef);
      assert.equal(data.transaction.type, 'WITHDRAWAL');
      assert.equal(data.transaction.transactionType, 'CASH WITHDRAWAL');
      assert.equal(data.transaction.status, 'SUCCESS');
      assert.equal(data.transaction.amount, 500.00);

      // Balance Information: Previous was 2000.00, withdrawal was 500.00, updated is 1500.00
      assert.equal(data.balance.previousBalance, 2000.00);
      assert.equal(data.balance.transactionAmount, 500.00);
      assert.equal(data.balance.updatedBalance, 1500.00);
      assert.equal(data.balance.currency, 'INR');

      // Verify numeric lookup for withdrawal as well
      if (withdrawTxnId) {
        const numRes = await request(app)
          .get(`/api/transactions/${withdrawTxnId}/receipt`)
          .set('Cookie', employeeCookie);
        assert.equal(numRes.status, 200);
        assert.equal(numRes.body.data.transaction.transactionRef, withdrawTxnRef);
      }
    });
  });

  // ============================================================================
  // 3. Financial Accuracy & Database Consistency
  // ============================================================================
  describe('3. Financial Accuracy & Non-Mutation Guarantees', () => {
    it('should match actual database records stored in bank_transactions and accounts', async () => {
      const dbTxns = await query(
        'SELECT amount, type, remarks FROM bank_transactions WHERE transaction_ref = ?',
        [withdrawTxnRef]
      );
      assert.equal(dbTxns.length, 1);
      const dbTx = dbTxns[0];

      const res = await request(app)
        .get(`/api/transactions/${withdrawTxnRef}/receipt`)
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.transaction.amount, Number(dbTx.amount));
      assert.equal(res.body.data.transaction.type, dbTx.type);
      assert.equal(res.body.data.transaction.remarks, dbTx.remarks);
    });

    it('should be strictly read-only and never modify account balances or records', async () => {
      const beforeAcc = await query(
        'SELECT balance FROM accounts WHERE account_id = ?',
        [activeAccountId]
      );
      const balanceBefore = Number(beforeAcc[0].balance);

      // Call receipt endpoint multiple times
      await request(app).get(`/api/transactions/${depositTxnRef}/receipt`).set('Cookie', employeeCookie);
      await request(app).get(`/api/transactions/${withdrawTxnRef}/receipt`).set('Cookie', employeeCookie);
      await request(app).get(`/api/transactions/${withdrawTxnRef}/receipt`).set('Cookie', adminCookie);

      const afterAcc = await query(
        'SELECT balance FROM accounts WHERE account_id = ?',
        [activeAccountId]
      );
      const balanceAfter = Number(afterAcc[0].balance);

      assert.equal(balanceAfter, balanceBefore, 'Account balance must remain completely unchanged by receipt retrieval');
    });
  });

  // ============================================================================
  // 4. Authorization & Security Boundaries
  // ============================================================================
  describe('4. Authorization & Security Boundaries', () => {
    it('should reject unauthenticated requests with HTTP 401 AUTH_003', async () => {
      const res = await request(app)
        .get(`/api/transactions/${depositTxnRef}/receipt`);

      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should reject non-existent transaction references with HTTP 404 TXN_004', async () => {
      const res = await request(app)
        .get('/api/transactions/TXN-NONEXISTENT-9999/receipt')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'TXN_004');
    });

    it('should FORBID Customer 2 from accessing Customer 1 transaction receipt with HTTP 403 AUTH_002', async () => {
      const res = await request(app)
        .get(`/api/transactions/${depositTxnRef}/receipt`)
        .set('Cookie', customer2Cookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should ALLOW Customer 1 to view their own transaction receipt with HTTP 200', async () => {
      const res = await request(app)
        .get(`/api/transactions/${depositTxnRef}/receipt`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.transaction.transactionRef, depositTxnRef);
      assert.equal(res.body.data.account.accountId, activeAccountId);
    });

    it('should ALLOW Administrator to view transaction receipt with HTTP 200', async () => {
      const res = await request(app)
        .get(`/api/transactions/${withdrawTxnRef}/receipt`)
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.transaction.transactionRef, withdrawTxnRef);
    });
  });
});
