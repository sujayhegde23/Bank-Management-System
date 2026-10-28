/**
 * ==============================================================================
 * Deposit and Withdrawal Management Integration Test Suite (Issue #8)
 * ==============================================================================
 * Verifies:
 * - SRS FR-12: Cash/fund deposit into active bank account (TC-05, AC-1).
 * - SRS FR-13: Cash/fund withdrawal from active bank account (TC-15, AC-2).
 * - SRS FR-14: Reject withdrawal with insufficient balance (TC-06, AC-4).
 * - SRS FR-11: Prevent transactions on inactive or frozen accounts (TC-08, AC-5).
 * - SRS FR-18: Unique cryptographic transaction reference allocation (NFR-16).
 * - SRS FR-19: Insert-only audit ledger recording in bank_transactions (NFR-10).
 * - Non-functional requirements: NFR-04, NFR-07, NFR-08, NFR-09, NFR-17, NFR-18.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, testConnection } = require('../src/config/db');

const TEST_PASSWORD = 'Password123!';

describe('Deposit and Withdrawal Management Suite (Issue #8)', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customerCookie = null;
  let customer2Cookie = null;

  // Track dynamically created test accounts for cleanup
  const createdAccountIds = [];
  let testActiveAccountId = null;
  let testFrozenAccountId = null;
  let testInactiveAccountId = null;

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // 1. Authenticate test roles
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.admin1', password: TEST_PASSWORD });
    assert.equal(adminRes.status, 200);
    adminCookie = adminRes.headers['set-cookie'];

    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.employee1', password: TEST_PASSWORD });
    assert.equal(empRes.status, 200);
    employeeCookie = empRes.headers['set-cookie'];

    const custRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(custRes.status, 200);
    customerCookie = custRes.headers['set-cookie'];

    const cust2Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });
    assert.equal(cust2Res.status, 200);
    customer2Cookie = cust2Res.headers['set-cookie'];

    // 2. Create isolated test accounts for testing transactions
    // Account A: Active account starting with 10,000.00
    const [accARes] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 10000.00, 'ACTIVE')`,
      [`ACC-TEST-ACT-${Date.now()}`]
    );
    testActiveAccountId = accARes.insertId;
    createdAccountIds.push(testActiveAccountId);

    // Account B: Frozen account with 2,000.00
    const [accBRes] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 2000.00, 'FROZEN')`,
      [`ACC-TEST-FRZ-${Date.now()}`]
    );
    testFrozenAccountId = accBRes.insertId;
    createdAccountIds.push(testFrozenAccountId);

    // Account C: Inactive account with 1,000.00
    const [accCRes] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 1000.00, 'INACTIVE')`,
      [`ACC-TEST-INA-${Date.now()}`]
    );
    testInactiveAccountId = accCRes.insertId;
    createdAccountIds.push(testInactiveAccountId);
  });

  after(async () => {
    try {
      if (createdAccountIds.length > 0) {
        const placeholders = createdAccountIds.map(() => '?').join(',');
        // Delete child transactions first to satisfy foreign key constraints
        await pool.execute(
          `DELETE FROM bank_transactions
           WHERE source_account_id IN (${placeholders}) OR destination_account_id IN (${placeholders})`,
          [...createdAccountIds, ...createdAccountIds]
        );
        // Delete created accounts
        await pool.execute(
          `DELETE FROM accounts WHERE account_id IN (${placeholders})`,
          createdAccountIds
        );
      }
    } finally {
      await pool.end();
    }
  });

  // ============================================================================
  // 1. Cash Deposit Operations (FR-12, FR-18, FR-19, TC-05, AC-1)
  // ============================================================================
  describe('1. Deposit Operations (FR-12, TC-05)', () => {
    it('should allow an authorized employee to deposit money via POST /api/transactions/deposit', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 2500.00,
          remarks: 'Counter cash deposit'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      const data = res.body.data;
      assert.equal(data.type, 'DEPOSIT');
      assert.equal(data.accountId, testActiveAccountId);
      assert.equal(data.amount, 2500.00);
      assert.equal(data.balanceAfter, 12500.00);
      assert.ok(data.transactionId);
      assert.match(data.transactionRef, /^TXN-DEP-[A-F0-9]+$/);

      // Verify database state directly
      const [rows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testActiveAccountId]);
      assert.equal(Number(rows[0].balance), 12500.00);

      // Verify bank_transactions ledger row
      const [txnRows] = await pool.execute('SELECT * FROM bank_transactions WHERE transaction_id = ?', [data.transactionId]);
      assert.equal(txnRows.length, 1);
      assert.equal(txnRows[0].type, 'DEPOSIT');
      assert.equal(Number(txnRows[0].amount), 2500.00);
      assert.equal(txnRows[0].source_account_id, null);
      assert.equal(txnRows[0].destination_account_id, testActiveAccountId);
      assert.equal(txnRows[0].remarks, 'Counter cash deposit');
    });

    it('should allow deposit via nested REST route POST /api/accounts/:accountId/deposits', async () => {
      const res = await request(app)
        .post(`/api/accounts/${testActiveAccountId}/deposits`)
        .set('Cookie', employeeCookie)
        .send({
          amount: 500.50,
          remarks: 'Check deposit'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.amount, 500.50);
      assert.equal(res.body.data.balanceAfter, 13000.50);

      const [rows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testActiveAccountId]);
      assert.equal(Number(rows[0].balance), 13000.50);
    });

    it('should handle small fractional deposits (0.01) with exact decimal precision', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId,
          amount: '0.01'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.balanceAfter, 13000.51);

      const [rows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testActiveAccountId]);
      assert.equal(Number(rows[0].balance), 13000.51);
    });
  });

  // ============================================================================
  // 2. Cash Withdrawal Operations (FR-13, FR-18, FR-19, TC-15, AC-2)
  // ============================================================================
  describe('2. Withdrawal Operations (FR-13, TC-15)', () => {
    it('should allow an authorized employee to withdraw funds via POST /api/transactions/withdraw', async () => {
      const res = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 1000.00,
          remarks: 'ATM cash withdrawal at branch'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      const data = res.body.data;
      assert.equal(data.type, 'WITHDRAWAL');
      assert.equal(data.accountId, testActiveAccountId);
      assert.equal(data.amount, 1000.00);
      assert.equal(data.balanceAfter, 12000.51);
      assert.ok(data.transactionId);
      assert.match(data.transactionRef, /^TXN-WTH-[A-F0-9]+$/);

      // Verify database accounts table
      const [rows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testActiveAccountId]);
      assert.equal(Number(rows[0].balance), 12000.51);

      // Verify bank_transactions ledger row
      const [txnRows] = await pool.execute('SELECT * FROM bank_transactions WHERE transaction_id = ?', [data.transactionId]);
      assert.equal(txnRows.length, 1);
      assert.equal(txnRows[0].type, 'WITHDRAWAL');
      assert.equal(Number(txnRows[0].amount), 1000.00);
      assert.equal(txnRows[0].source_account_id, testActiveAccountId);
      assert.equal(txnRows[0].destination_account_id, null);
    });

    it('should allow withdrawal via nested REST route POST /api/accounts/:accountId/withdrawals', async () => {
      const res = await request(app)
        .post(`/api/accounts/${testActiveAccountId}/withdrawals`)
        .set('Cookie', employeeCookie)
        .send({
          amount: 2000.51
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.balanceAfter, 10000.00);

      const [rows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testActiveAccountId]);
      assert.equal(Number(rows[0].balance), 10000.00);
    });

    it('should allow boundary withdrawal of exact total balance down to 0.00 (TC-15)', async () => {
      // Create a temporary account with exact balance 350.00
      const [tempRes] = await pool.execute(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
         VALUES (?, 1, 'SAVINGS', 350.00, 'ACTIVE')`,
        [`ACC-TEMP-ZERO-${Date.now()}`]
      );
      const tempId = tempRes.insertId;
      createdAccountIds.push(tempId);

      const res = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', employeeCookie)
        .send({
          accountId: tempId,
          amount: 350.00,
          remarks: 'Full account withdrawal'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.balanceAfter, 0.00);

      const [rows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [tempId]);
      assert.equal(Number(rows[0].balance), 0.00);
    });
  });

  // ============================================================================
  // 3. Insufficient Balance & Overdraft Protection (FR-14, TC-06, AC-4)
  // ============================================================================
  describe('3. Insufficient Balance Protection (FR-14, TC-06)', () => {
    it('should reject a withdrawal exceeding available balance with TXN_001 (422)', async () => {
      // testActiveAccountId has balance 10,000.00
      const res = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 10000.01 // 1 cent over balance
        });

      assert.equal(res.status, 422);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'TXN_001');
      assert.match(res.body.message, /insufficient balance/i);

      // Verify balance is unchanged (NFR-08)
      const [rows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testActiveAccountId]);
      assert.equal(Number(rows[0].balance), 10000.00);
    });

    it('should reject withdrawal exceeding balance on nested route with TXN_001 (422)', async () => {
      const res = await request(app)
        .post(`/api/accounts/${testActiveAccountId}/withdrawals`)
        .set('Cookie', employeeCookie)
        .send({
          amount: 999999.00
        });

      assert.equal(res.status, 422);
      assert.equal(res.body.errorCode, 'TXN_001');
    });
  });

  // ============================================================================
  // 4. Account Status Enforcement (FR-11, TC-08, AC-5)
  // ============================================================================
  describe('4. Account Status Restrictions (FR-11, TC-08)', () => {
    it('should reject deposit to FROZEN account with ACC_001 (409)', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testFrozenAccountId,
          amount: 500.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
      assert.match(res.body.message, /frozen or inactive/i);

      // Verify balance unchanged
      const [rows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testFrozenAccountId]);
      assert.equal(Number(rows[0].balance), 2000.00);
    });

    it('should reject withdrawal from FROZEN account with ACC_001 (409)', async () => {
      const res = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testFrozenAccountId,
          amount: 100.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
    });

    it('should reject deposit to INACTIVE account with ACC_001 (409)', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testInactiveAccountId,
          amount: 500.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');

      // Verify balance unchanged
      const [rows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testInactiveAccountId]);
      assert.equal(Number(rows[0].balance), 1000.00);
    });

    it('should reject withdrawal from INACTIVE account with ACC_001 (409)', async () => {
      const res = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testInactiveAccountId,
          amount: 100.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
    });
  });

  // ============================================================================
  // 5. Amount Input Validation (NFR-04, NFR-18, TC-12, AC-3)
  // ============================================================================
  describe('5. Monetary Amount Validation (NFR-04, NFR-18, TC-12)', () => {
    it('should reject zero amount with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 0
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
      assert.match(res.body.message, /invalid amount/i);
    });

    it('should reject negative amount with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId,
          amount: -100.00
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('should reject non-numeric amount with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 'abc'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('should reject amounts with more than 2 decimal places with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 10.555
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('should reject missing amount with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });
  });

  // ============================================================================
  // 6. Account ID and Existence Validation (FR-09, ACC_002, VAL_001)
  // ============================================================================
  describe('6. Account Identification & Existence', () => {
    it('should return ACC_002 (404) for nonexistent account ID', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: 999999,
          amount: 100.00
        });

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'ACC_002');
    });

    it('should return VAL_001 (400) for malformed account ID', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: '12abc',
          amount: 100.00
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });
  });

  // ============================================================================
  // 7. Authentication & Authorization Security (NFR-02, NFR-05)
  // ============================================================================
  describe('7. Authentication and Role-Based Access Control', () => {
    it('should reject unauthenticated deposit request with AUTH_003 (401)', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .send({
          accountId: testActiveAccountId,
          amount: 100.00
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should reject CUSTOMER role attempt to perform deposit with AUTH_002 (403)', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', customerCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 100.00
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject CUSTOMER role attempt to perform withdrawal with AUTH_002 (403)', async () => {
      const res = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', customerCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 100.00
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject ADMIN role attempt to deposit (Employee-only per Architecture §14 DD-08)', async () => {
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', adminCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 100.00
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ============================================================================
  // 8. Atomicity and Rollback Verification (NFR-08, NFR-09, NFR-17, TC-10, AC-6)
  // ============================================================================
  describe('8. Atomicity and Transaction Rollback (TC-10)', () => {
    it('should rollback balance update if failure occurs before ledger insertion', async () => {
      // 1. Get initial balance
      const [initRows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testActiveAccountId]);
      const initialBalance = Number(initRows[0].balance);

      // 2. Count existing transactions for this account
      const [countInit] = await pool.execute(
        'SELECT COUNT(*) as cnt FROM bank_transactions WHERE destination_account_id = ?',
        [testActiveAccountId]
      );
      const initialTxnCount = countInit[0].cnt;

      // 3. Attempt deposit with forced failure hook
      const res = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 5000.00,
          _testFailurePoint: 'AFTER_BALANCE_UPDATE'
        });

      assert.equal(res.status, 500);
      assert.equal(res.body.errorCode, 'TXN_003');
      assert.match(res.body.message, /transaction failed/i);

      // 4. Verify balance is completely unchanged (rollback confirmed)
      const [afterRows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testActiveAccountId]);
      assert.equal(Number(afterRows[0].balance), initialBalance);

      // 5. Verify no orphan transaction record was created
      const [countAfter] = await pool.execute(
        'SELECT COUNT(*) as cnt FROM bank_transactions WHERE destination_account_id = ?',
        [testActiveAccountId]
      );
      assert.equal(countAfter[0].cnt, initialTxnCount);
    });

    it('should rollback withdrawal if failure occurs after balance update', async () => {
      const [initRows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testActiveAccountId]);
      const initialBalance = Number(initRows[0].balance);

      const res = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', employeeCookie)
        .send({
          accountId: testActiveAccountId,
          amount: 1500.00,
          _testFailurePoint: 'BEFORE_LEDGER_INSERT'
        });

      assert.equal(res.status, 500);
      assert.equal(res.body.errorCode, 'TXN_003');

      // Verify balance unchanged
      const [afterRows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testActiveAccountId]);
      assert.equal(Number(afterRows[0].balance), initialBalance);
    });
  });

  // ============================================================================
  // 9. Concurrency & Race Condition Safety (NFR-08, NFR-17)
  // ============================================================================
  describe('9. Concurrency Safety with Row-Level Locking (SELECT ... FOR UPDATE)', () => {
    it('should safely prevent overdraft under concurrent withdrawal requests', async () => {
      // Create a test account with exactly 2,500.00
      const [raceAccRes] = await pool.execute(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
         VALUES (?, 1, 'SAVINGS', 2500.00, 'ACTIVE')`,
        [`ACC-RACE-${Date.now()}`]
      );
      const raceAccountId = raceAccRes.insertId;
      createdAccountIds.push(raceAccountId);

      // Send 5 concurrent withdrawal requests of 1,000.00 simultaneously
      // Initial balance is 2,500.00 -> Exactly 2 requests must succeed (2 * 1,000 = 2,000)
      // and 3 requests must be rejected with 422 TXN_001!
      // Final balance must be exactly 500.00!
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/transactions/withdraw')
          .set('Cookie', employeeCookie)
          .send({
            accountId: raceAccountId,
            amount: 1000.00,
            remarks: 'Concurrent test withdrawal'
          })
      );

      const results = await Promise.all(promises);

      const successCount = results.filter((r) => r.status === 201).length;
      const rejectedCount = results.filter((r) => r.status === 422).length;

      assert.equal(successCount, 2, 'Exactly 2 withdrawals should succeed');
      assert.equal(rejectedCount, 3, 'Exactly 3 withdrawals should be rejected due to insufficient funds');

      // Check final balance in database
      const [finalRows] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [raceAccountId]);
      assert.equal(Number(finalRows[0].balance), 500.00, 'Final balance must be exactly 500.00');

      // Check number of recorded transactions
      const [txnRows] = await pool.execute(
        'SELECT COUNT(*) as cnt FROM bank_transactions WHERE source_account_id = ?',
        [raceAccountId]
      );
      assert.equal(txnRows[0].cnt, 2, 'Exactly 2 transaction records must exist');
    });
  });

  // ============================================================================
  // 10. Account Transaction History & Ledger Isolation (FR-20, FR-21, NFR-03, TC-16)
  // ============================================================================
  describe('10. Transaction Ledger Retrieval & Customer Isolation (FR-20, FR-21)', () => {
    it('should allow Bank Employee to view transaction history of an account', async () => {
      const res = await request(app)
        .get(`/api/accounts/${testActiveAccountId}/transactions`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.transactions));
      assert.ok(res.body.data.transactions.length >= 2);

      const firstTxn = res.body.data.transactions[0];
      assert.ok(firstTxn.transactionRef);
      assert.ok(firstTxn.type);
      assert.ok(firstTxn.direction);
    });

    it('should allow Customer to view transactions of their OWN account (FR-20, TC-16)', async () => {
      // testActiveAccountId belongs to customer_id = 1 (test.customer1)
      const res = await request(app)
        .get(`/api/accounts/${testActiveAccountId}/transactions`)
        .set('Cookie', customerCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    it('should reject Customer attempt to view transactions of another customer account with AUTH_002 (403)', async () => {
      // testActiveAccountId belongs to customer 1; test.customer2 (customer_id 2) queries it
      const res = await request(app)
        .get(`/api/accounts/${testActiveAccountId}/transactions`)
        .set('Cookie', customer2Cookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should allow Employee to list all recent transactions via GET /api/transactions', async () => {
      const res = await request(app)
        .get('/api/transactions?limit=10')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.transactions));
    });
  });
});

