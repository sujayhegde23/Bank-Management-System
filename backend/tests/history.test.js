/**
 * ==============================================================================
 * Transaction Records and History Integration Test Suite (Issue #10)
 * ==============================================================================
 * Verifies:
 * - SRS FR-18: Unique transaction reference allocation (NFR-16).
 * - SRS FR-19: Insert-only audit ledger recording in bank_transactions (NFR-10).
 * - SRS FR-20: View account transaction history (TC-16, AC-1, AC-3, AC-4, AC-6).
 * - SRS FR-21: View customer and bank-wide transactions with filters (TC-19, AC-5).
 * - Non-functional requirements: NFR-03 (data isolation), NFR-06 (performance),
 *   NFR-10 (insert-only auditability), NFR-16 (uniqueness).
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, testConnection } = require('../src/config/db');

const TEST_PASSWORD = 'Password123!';

describe('Transaction Records and History Suite (Issue #10)', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customer1Cookie = null;
  let customer2Cookie = null;

  // Track dynamically created test accounts for cleanup
  const createdAccountIds = [];
  let cust1Acc = null;
  let cust2Acc = null;
  let emptyAcc = null;
  let cust1AccNumber = null;
  let cust2AccNumber = null;
  let emptyAccNumber = null;

  let depositTxnRef = null;
  let withdrawTxnRef = null;
  let transferTxnRef = null;

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // Authenticate test roles
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

    const cust1Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(cust1Res.status, 200);
    customer1Cookie = cust1Res.headers['set-cookie'];

    const cust2Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });
    assert.equal(cust2Res.status, 200);
    customer2Cookie = cust2Res.headers['set-cookie'];

    // Create fresh test accounts with unique numbers
    const now = Date.now();
    cust1AccNumber = `ACC-HIST-C1-${now}`;
    cust2AccNumber = `ACC-HIST-C2-${now}`;
    emptyAccNumber = `ACC-HIST-EMPTY-${now}`;

    const [a1] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 5000.00, 'ACTIVE')`,
      [cust1AccNumber]
    );
    cust1Acc = a1.insertId;
    createdAccountIds.push(cust1Acc);

    const [a2] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 2, 'SAVINGS', 3000.00, 'ACTIVE')`,
      [cust2AccNumber]
    );
    cust2Acc = a2.insertId;
    createdAccountIds.push(cust2Acc);

    const [a3] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'CURRENT', 1000.00, 'ACTIVE')`,
      [emptyAccNumber]
    );
    emptyAcc = a3.insertId;
    createdAccountIds.push(emptyAcc);
  });

  after(async () => {
    try {
      if (createdAccountIds.length > 0) {
        const placeholders = createdAccountIds.map(() => '?').join(',');
        await pool.execute(
          `DELETE FROM bank_transactions
           WHERE source_account_id IN (${placeholders}) OR destination_account_id IN (${placeholders})`,
          [...createdAccountIds, ...createdAccountIds]
        );
        await pool.execute(
          `DELETE FROM accounts WHERE account_id IN (${placeholders})`,
          createdAccountIds
        );
      }
    } catch (err) {
      console.error('Error cleaning up history test accounts:', err.message);
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------
  // Scenario 1: Deposits appear in account history (type: DEPOSIT, direction: CREDIT)
  // ----------------------------------------------------------------------------
  describe('Scenario 1: Deposits appear in account history', () => {
    it('should record deposit and display it as CREDIT in account history', async () => {
      const depRes = await request(app)
        .post('/api/transactions/deposit')
        .set('Cookie', employeeCookie)
        .send({
          accountId: cust1Acc,
          amount: 500.00,
          remarks: 'History deposit test'
        });
      assert.equal(depRes.status, 201);
      depositTxnRef = depRes.body.data.transactionReference || depRes.body.data.transactionRef;
      assert.ok(depositTxnRef, 'Deposit response must include transaction reference');

      const histRes = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions`)
        .set('Cookie', customer1Cookie);

      assert.equal(histRes.status, 200);
      assert.ok(histRes.body.success);
      const items = histRes.body.data.items;
      const match = items.find((t) => t.transactionReference === depositTxnRef);
      assert.ok(match, 'Deposit transaction must exist in history');
      assert.equal(match.type, 'DEPOSIT');
      assert.equal(match.direction, 'CREDIT');
      assert.equal(parseFloat(match.amount), 500.00);
      assert.equal(match.destinationAccountId, cust1Acc);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 2: Withdrawals appear in account history (type: WITHDRAWAL, direction: DEBIT)
  // ----------------------------------------------------------------------------
  describe('Scenario 2: Withdrawals appear in account history', () => {
    it('should record withdrawal and display it as DEBIT in account history', async () => {
      const wRes = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', employeeCookie)
        .send({
          accountId: cust1Acc,
          amount: 200.00,
          remarks: 'History withdrawal test'
        });
      assert.equal(wRes.status, 201);
      withdrawTxnRef = wRes.body.data.transactionReference || wRes.body.data.transactionRef;
      assert.ok(withdrawTxnRef, 'Withdrawal response must include transaction reference');

      const histRes = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions`)
        .set('Cookie', customer1Cookie);

      assert.equal(histRes.status, 200);
      const items = histRes.body.data.items;
      const match = items.find((t) => t.transactionReference === withdrawTxnRef);
      assert.ok(match, 'Withdrawal transaction must exist in history');
      assert.equal(match.type, 'WITHDRAWAL');
      assert.equal(match.direction, 'DEBIT');
      assert.equal(parseFloat(match.amount), 200.00);
      assert.equal(match.sourceAccountId, cust1Acc);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 3: Transfers appear for both participating accounts
  // ----------------------------------------------------------------------------
  describe('Scenario 3: Transfers appear for both participating accounts (AC-6)', () => {
    it('should show DEBIT for sender and CREDIT for recipient with matching transaction reference', async () => {
      const trfRes = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1Acc,
          destinationAccountId: cust2Acc,
          amount: 350.00,
          remarks: 'History transfer test'
        });
      assert.equal(trfRes.status, 201);
      transferTxnRef = trfRes.body.data.transactionReference;

      // Check sender history
      const senderRes = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions`)
        .set('Cookie', customer1Cookie);
      assert.equal(senderRes.status, 200);
      const senderTxn = senderRes.body.data.items.find((t) => t.transactionReference === transferTxnRef);
      assert.ok(senderTxn, 'Sender history must contain transfer');
      assert.equal(senderTxn.type, 'TRANSFER');
      assert.equal(senderTxn.direction, 'DEBIT');
      assert.equal(parseFloat(senderTxn.amount), 350.00);

      // Check recipient history
      const recipientRes = await request(app)
        .get(`/api/accounts/${cust2Acc}/transactions`)
        .set('Cookie', customer2Cookie);
      assert.equal(recipientRes.status, 200);
      const recipientTxn = recipientRes.body.data.items.find((t) => t.transactionReference === transferTxnRef);
      assert.ok(recipientTxn, 'Recipient history must contain transfer');
      assert.equal(recipientTxn.type, 'TRANSFER');
      assert.equal(recipientTxn.direction, 'CREDIT');
      assert.equal(parseFloat(recipientTxn.amount), 350.00);
      assert.equal(recipientTxn.transactionReference, senderTxn.transactionReference);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 4: Transaction references are unique and stable across retrieval calls
  // ----------------------------------------------------------------------------
  describe('Scenario 4: Transaction references are unique and stable (FR-18, NFR-16, AC-2)', () => {
    it('should maintain stable references without regenerating upon multiple retrievals', async () => {
      const call1 = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions`)
        .set('Cookie', customer1Cookie);
      const call2 = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions`)
        .set('Cookie', customer1Cookie);

      const refs1 = call1.body.data.items.map((i) => i.transactionReference);
      const refs2 = call2.body.data.items.map((i) => i.transactionReference);
      assert.deepEqual(refs1, refs2, 'Transaction references must not mutate between queries');

      // Check distinct references
      const uniqueRefs = new Set(refs1);
      assert.equal(uniqueRefs.size, refs1.length, 'Every transaction reference must be globally unique');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 5: Failed transactions do not appear in history (AC-1)
  // ----------------------------------------------------------------------------
  describe('Scenario 5: Failed transactions do not appear in history', () => {
    it('should not record a failed withdrawal due to insufficient balance in history', async () => {
      const failW = await request(app)
        .post('/api/transactions/withdraw')
        .set('Cookie', employeeCookie)
        .send({
          accountId: cust1Acc,
          amount: 99999999.00,
          remarks: 'Overdraft failure'
        });
      assert.equal(failW.status, 422);

      const histRes = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions`)
        .set('Cookie', customer1Cookie);
      const badTxn = histRes.body.data.items.find((t) => parseFloat(t.amount) === 99999999.00);
      assert.equal(badTxn, undefined, 'Failed withdrawal must not exist in transaction history');
    });

    it('should not record a failed transfer due to insufficient balance', async () => {
      const failTrf = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1Acc,
          destinationAccountId: cust2Acc,
          amount: 88888888.00,
          remarks: 'Overdraft transfer'
        });
      assert.equal(failTrf.status, 422);

      const histRes = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions`)
        .set('Cookie', customer1Cookie);
      const badTxn = histRes.body.data.items.find((t) => parseFloat(t.amount) === 88888888.00);
      assert.equal(badTxn, undefined, 'Failed transfer must not exist in transaction history');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 6: Customers can view their own account transaction history (FR-20)
  // ----------------------------------------------------------------------------
  describe('Scenario 6: Customers can view their own account transaction history', () => {
    it('should allow customer to query history with pagination metadata', async () => {
      const res = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.items);
      assert.ok(res.body.data.pagination);
      assert.equal(typeof res.body.data.pagination.page, 'number');
      assert.equal(typeof res.body.data.pagination.totalItems, 'number');
      assert.ok(res.body.data.items.length >= 3);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 7: Customers cannot access another customer history (NFR-03, TC-16, AC-4)
  // ----------------------------------------------------------------------------
  describe('Scenario 7: Customers cannot access another customer history', () => {
    it('should reject customer 1 attempting to view customer 2 account transactions with 403 AUTH_002', async () => {
      const res = await request(app)
        .get(`/api/accounts/${cust2Acc}/transactions`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'AUTH_002');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 8: Unauthenticated requests are rejected (AUTH_003)
  // ----------------------------------------------------------------------------
  describe('Scenario 8: Unauthenticated requests are rejected', () => {
    it('should return 401 AUTH_003 when requesting account transactions without session', async () => {
      const res = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions`);

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'AUTH_003');
    });

    it('should return 401 AUTH_003 when requesting global transactions without session', async () => {
      const res = await request(app)
        .get('/api/transactions');

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'AUTH_003');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 9: Unauthorized roles rejected from global transactions endpoint (AC-4, AC-5)
  // ----------------------------------------------------------------------------
  describe('Scenario 9: Unauthorized roles rejected from global transactions endpoint', () => {
    it('should reject CUSTOMER calling GET /api/transactions with 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'AUTH_002');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 10: Invalid account IDs handled correctly
  // ----------------------------------------------------------------------------
  describe('Scenario 10: Invalid account IDs handled correctly', () => {
    it('should return 400 VAL_001 for non-integer account ID', async () => {
      const res = await request(app)
        .get('/api/accounts/invalid-id/transactions')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VAL_001');
    });

    it('should return 404 ACC_002 for nonexistent account ID', async () => {
      const res = await request(app)
        .get('/api/accounts/9999999/transactions')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'ACC_002');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 11: Invalid pagination parameters handled correctly
  // ----------------------------------------------------------------------------
  describe('Scenario 11: Invalid pagination parameters handled correctly (AC-3)', () => {
    it('should return 400 VAL_001 for negative page', async () => {
      const res = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions?page=-1`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VAL_001');
    });

    it('should return 400 VAL_001 for page=0', async () => {
      const res = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions?page=0`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VAL_001');
    });

    it('should return 400 VAL_001 for limit > 100', async () => {
      const res = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions?limit=250`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VAL_001');
    });

    it('should return 400 VAL_001 for invalid global transactions pagination', async () => {
      const res = await request(app)
        .get('/api/transactions?page=abc')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VAL_001');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 12: Pagination and deterministic ordering (AC-3)
  // ----------------------------------------------------------------------------
  describe('Scenario 12: Pagination and deterministic ordering', () => {
    it('should sort newest first and return mutually exclusive rows across pages', async () => {
      // Create 3 additional small deposits to guarantee multiple pages with pageSize=2
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/transactions/deposit')
          .set('Cookie', employeeCookie)
          .send({
            accountId: cust1Acc,
            amount: 10.00 * i,
            remarks: `Pagination batch ${i}`
          });
      }

      const p1 = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions?page=1&limit=2`)
        .set('Cookie', customer1Cookie);
      assert.equal(p1.status, 200);
      assert.equal(p1.body.data.items.length, 2);

      const p2 = await request(app)
        .get(`/api/accounts/${cust1Acc}/transactions?page=2&limit=2`)
        .set('Cookie', customer1Cookie);
      assert.equal(p2.status, 200);
      assert.equal(p2.body.data.items.length, 2);

      const p1Ids = p1.body.data.items.map((i) => i.transactionId);
      const p2Ids = p2.body.data.items.map((i) => i.transactionId);

      // Verify no overlap between page 1 and page 2
      const intersection = p1Ids.filter((id) => p2Ids.includes(id));
      assert.equal(intersection.length, 0, 'Page 1 and Page 2 must not contain overlapping records');

      // Verify descending ordering
      assert.ok(p1Ids[0] > p1Ids[1], 'Transactions must be sorted descending by transaction ID');
      assert.ok(p1Ids[1] > p2Ids[0], 'Page 1 items must be strictly newer than Page 2 items');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 13: Empty history returns valid response
  // ----------------------------------------------------------------------------
  describe('Scenario 13: Empty history returns valid response', () => {
    it('should return empty items array and totalItems=0 for account with no transactions', async () => {
      const res = await request(app)
        .get(`/api/accounts/${emptyAcc}/transactions`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data.items, []);
      assert.equal(res.body.data.pagination.totalItems, 0);
      assert.equal(res.body.data.pagination.totalPages, 0);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 14: History retrieval is strictly read-only (AC-1)
  // ----------------------------------------------------------------------------
  describe('Scenario 14: History retrieval does not alter balances or insert records (AC-1)', () => {
    it('should not mutate account balance or transaction count when querying history repeatedly', async () => {
      const [bBefore] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [cust1Acc]);
      const [cBefore] = await pool.execute('SELECT COUNT(*) as count FROM bank_transactions');

      for (let i = 0; i < 3; i++) {
        await request(app)
          .get(`/api/accounts/${cust1Acc}/transactions`)
          .set('Cookie', customer1Cookie);
        await request(app)
          .get('/api/transactions')
          .set('Cookie', employeeCookie);
      }

      const [bAfter] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [cust1Acc]);
      const [cAfter] = await pool.execute('SELECT COUNT(*) as count FROM bank_transactions');

      assert.equal(bAfter[0].balance, bBefore[0].balance, 'Balance must remain unchanged during read queries');
      assert.equal(cAfter[0].count, cBefore[0].count, 'Transaction table count must remain unchanged');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 15: Filter verification on GET /api/transactions (FR-21, TC-19, AC-5)
  // ----------------------------------------------------------------------------
  describe('Scenario 15: Filter verification on GET /api/transactions (FR-21, TC-19, AC-5)', () => {
    it('should allow Employee to filter bank transactions by type (DEPOSIT)', async () => {
      const res = await request(app)
        .get('/api/transactions?type=DEPOSIT')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length > 0);
      assert.ok(res.body.data.items.every((t) => t.type === 'DEPOSIT'));
    });

    it('should allow Employee to filter bank transactions by type (TRANSFER)', async () => {
      const res = await request(app)
        .get('/api/transactions?type=TRANSFER')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length > 0);
      assert.ok(res.body.data.items.every((t) => t.type === 'TRANSFER'));
    });

    it('should allow Employee to filter bank transactions by accountNumber', async () => {
      const res = await request(app)
        .get(`/api/transactions?accountNumber=${cust2AccNumber}`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length > 0);
      const matches = res.body.data.items.every(
        (t) => t.sourceAccountNumber === cust2AccNumber || t.destinationAccountNumber === cust2AccNumber
      );
      assert.ok(matches, 'All transactions should involve the specified account number');
    });

    it('should allow Admin to filter bank transactions by date range', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/transactions?startDate=${today}&endDate=${today}`)
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data.items));
    });

    it('should allow Employee to search transactions by keyword', async () => {
      const res = await request(app)
        .get(`/api/transactions?search=${transferTxnRef}`)
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.items.length, 1);
      assert.equal(res.body.data.items[0].transactionReference, transferTxnRef);
    });
  });
});
