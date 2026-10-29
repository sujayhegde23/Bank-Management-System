/**
 * ==============================================================================
 * Customer Fund Transfer Integration Test Suite (Issue #9)
 * ==============================================================================
 * Verifies:
 * - SRS FR-15: Customer fund transfer between accounts (TC-07, AC-1, AC-4, AC-6).
 * - SRS FR-16: Verify sufficient balance before transfer (TC-06, AC-3).
 * - SRS FR-17: Update sender and receiver balances atomically (TC-07, AC-4).
 * - SRS FR-11: Prevent transactions on inactive or frozen accounts (TC-08, AC-2).
 * - SRS FR-18: Unique cryptographic transaction reference allocation (NFR-16).
 * - SRS FR-19: Insert-only audit ledger recording in bank_transactions (NFR-10).
 * - Non-functional requirements: NFR-03, NFR-04, NFR-08, NFR-09, NFR-10, NFR-17, NFR-18.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, testConnection } = require('../src/config/db');

const TEST_PASSWORD = 'Password123!';

describe('Customer Fund Transfer Suite (Issue #9)', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customer1Cookie = null;
  let customer2Cookie = null;

  // Track dynamically created test accounts for cleanup
  const createdAccountIds = [];
  let cust1ActiveAcc1 = null;
  let cust1ActiveAcc2 = null;
  let cust2ActiveAcc = null;
  let cust1FrozenAcc = null;
  let cust1InactiveAcc = null;
  let cust2FrozenAcc = null;

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

    // 2. Create isolated test accounts for testing transfers
    // Customer 1 (customer_id = 1) Accounts:
    // Acc 1: Active with balance 10,000.00
    const [acc1Res] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 10000.00, 'ACTIVE')`,
      [`ACC-TRF-C1A-${Date.now()}`]
    );
    cust1ActiveAcc1 = acc1Res.insertId;
    createdAccountIds.push(cust1ActiveAcc1);

    // Acc 2: Active with balance 3,000.00
    const [acc2Res] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'CURRENT', 3000.00, 'ACTIVE')`,
      [`ACC-TRF-C1B-${Date.now()}`]
    );
    cust1ActiveAcc2 = acc2Res.insertId;
    createdAccountIds.push(cust1ActiveAcc2);

    // Acc 3: Frozen with balance 2,000.00
    const [acc3Res] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 2000.00, 'FROZEN')`,
      [`ACC-TRF-C1F-${Date.now()}`]
    );
    cust1FrozenAcc = acc3Res.insertId;
    createdAccountIds.push(cust1FrozenAcc);

    // Acc 4: Inactive with balance 1,000.00
    const [acc4Res] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 1000.00, 'INACTIVE')`,
      [`ACC-TRF-C1I-${Date.now()}`]
    );
    cust1InactiveAcc = acc4Res.insertId;
    createdAccountIds.push(cust1InactiveAcc);

    // Customer 2 (customer_id = 2) Accounts:
    // Acc 5: Active with balance 5,000.00
    const [acc5Res] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 2, 'SAVINGS', 5000.00, 'ACTIVE')`,
      [`ACC-TRF-C2A-${Date.now()}`]
    );
    cust2ActiveAcc = acc5Res.insertId;
    createdAccountIds.push(cust2ActiveAcc);

    // Acc 6: Frozen with balance 4,000.00
    const [acc6Res] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 2, 'SAVINGS', 4000.00, 'FROZEN')`,
      [`ACC-TRF-C2F-${Date.now()}`]
    );
    cust2FrozenAcc = acc6Res.insertId;
    createdAccountIds.push(cust2FrozenAcc);
  });

  after(async () => {
    try {
      if (createdAccountIds.length > 0) {
        const placeholders = createdAccountIds.map(() => '?').join(',');
        // Clean child transactions first to satisfy foreign key constraints
        await pool.execute(
          `DELETE FROM bank_transactions
           WHERE source_account_id IN (${placeholders}) OR destination_account_id IN (${placeholders})`,
          [...createdAccountIds, ...createdAccountIds]
        );

        // Delete test accounts
        await pool.execute(
          `DELETE FROM accounts WHERE account_id IN (${placeholders})`,
          createdAccountIds
        );
      }
    } catch (err) {
      console.error('Error cleaning up transfer test accounts:', err.message);
    } finally {
      await pool.end();
    }
  });

  // Helper to query account balances directly from DB
  async function getDbBalances(srcId, dstId) {
    const [rows] = await pool.execute(
      'SELECT account_id, balance FROM accounts WHERE account_id IN (?, ?)',
      [srcId, dstId]
    );
    const srcRow = rows.find((r) => r.account_id === srcId);
    const dstRow = rows.find((r) => r.account_id === dstId);
    return {
      srcBalance: Number(srcRow.balance),
      dstBalance: Number(dstRow.balance)
    };
  }

  // ----------------------------------------------------------------------------
  // 1. Successful Fund Transfer & Balance Conservation (TC-07, FR-15, FR-17)
  // ----------------------------------------------------------------------------
  describe('1. Successful Fund Transfer (TC-07, FR-15, FR-17, AC-1, AC-4, AC-5)', () => {
    it('should successfully transfer funds between two active accounts, update both balances, and preserve total funds', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      const transferAmount = 1500.00;

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: transferAmount,
          remarks: 'Payment for services'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok((res.body.data.transactionRef || res.body.data.transactionReference).startsWith('TXN-TRF-'));
      assert.equal(res.body.data.amount, transferAmount);
      assert.equal(res.body.data.sourceAccountId, cust1ActiveAcc1);
      assert.equal(res.body.data.destinationAccountId, cust2ActiveAcc);

      // Verify source balance in response
      assert.equal(res.body.data.sourceBalanceAfter, beforeBal.srcBalance - transferAmount);

      // Verify direct database balances
      const afterBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance - transferAmount);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance + transferAmount);

      // Verify Conservation of Total Funds (NFR-08)
      assert.equal(beforeBal.srcBalance + beforeBal.dstBalance, afterBal.srcBalance + afterBal.dstBalance);

      // Verify unmodifiable ledger record in bank_transactions (AC-5, FR-19, NFR-10)
      const [txRows] = await pool.execute(
        `SELECT transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, remarks
         FROM bank_transactions WHERE transaction_ref = ?`,
        [res.body.data.transactionReference]
      );
      assert.equal(txRows.length, 1);
      assert.equal(txRows[0].type, 'TRANSFER');
      assert.equal(Number(txRows[0].amount), transferAmount);
      assert.equal(txRows[0].source_account_id, cust1ActiveAcc1);
      assert.equal(txRows[0].destination_account_id, cust2ActiveAcc);
      assert.equal(txRows[0].remarks, 'Payment for services');
    });

    it('should allow customer to transfer between two accounts that they own', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust1ActiveAcc2);
      const amount = 500.00;

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust1ActiveAcc2,
          amount,
          remarks: 'Internal account rebalance'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);

      const afterBal = await getDbBalances(cust1ActiveAcc1, cust1ActiveAcc2);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance - amount);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance + amount);
      assert.equal(beforeBal.srcBalance + beforeBal.dstBalance, afterBal.srcBalance + afterBal.dstBalance);
    });

    it('should accept destination specified by account number string (e.g. ACC-TRF-...)', async () => {
      // Look up destination account number
      const [destRow] = await pool.execute(
        'SELECT account_number FROM accounts WHERE account_id = ?',
        [cust2ActiveAcc]
      );
      const destAccNum = destRow[0].account_number;

      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      const amount = 250.00;

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountNumber: destAccNum,
          amount,
          remarks: 'Transfer via account number string'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.destinationAccountNumber, destAccNum);

      const afterBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance - amount);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance + amount);
    });

    it('should allow transferring exact remaining balance down to 0.00 (boundary value)', async () => {
      // Create temporary dedicated account with 500.00
      const [tempRes] = await pool.execute(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
         VALUES (?, 1, 'SAVINGS', 500.00, 'ACTIVE')`,
        [`ACC-TRF-ZERO-${Date.now()}`]
      );
      const tempAccId = tempRes.insertId;
      createdAccountIds.push(tempAccId);

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: tempAccId,
          destinationAccountId: cust2ActiveAcc,
          amount: 500.00,
          remarks: 'Empty source balance to zero'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.sourceBalanceAfter, 0);

      const [chk] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [tempAccId]);
      assert.equal(Number(chk[0].balance), 0.00);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Insufficient Balance & Overdraft Rejection (FR-14, FR-16, TC-06, AC-3)
  // ----------------------------------------------------------------------------
  describe('2. Insufficient Balance Protection (FR-14, FR-16, TC-06, AC-3)', () => {
    it('should reject transfer exceeding available balance with TXN_001 (422) and leave balances unchanged', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      const excessiveAmount = beforeBal.srcBalance + 0.01; // Boundary: 1 cent above balance

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: excessiveAmount,
          remarks: 'Attempted overdraft transfer'
        });

      assert.equal(res.status, 422);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'TXN_001');

      // Verify database balances remain unaltered
      const afterBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);
    });

    it('should reject transfer with vastly excessive amount (e.g. 1,000,000.00)', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 1000000.00
        });

      assert.equal(res.status, 422);
      assert.equal(res.body.errorCode, 'TXN_001');

      const afterBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Customer Authorization & Data Isolation (AC-1, NFR-03, TC-16)
  // ----------------------------------------------------------------------------
  describe('3. Customer Authorization & Isolation (AC-1, NFR-03)', () => {
    it('should reject Customer 1 attempt to transfer FROM Customer 2 account with AUTH_002 (403)', async () => {
      const beforeBal = await getDbBalances(cust2ActiveAcc, cust1ActiveAcc1);

      // Customer 1 tries to spend money from Customer 2's account
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust2ActiveAcc,
          destinationAccountId: cust1ActiveAcc1,
          amount: 100.00
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_002');

      // Verify no money was stolen/transferred
      const afterBal = await getDbBalances(cust2ActiveAcc, cust1ActiveAcc1);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);
    });

    it('should reject unauthenticated transfer request with AUTH_003 (401)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 100.00
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should reject Employee attempt to call customer transfer endpoint with AUTH_002 (403)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', employeeCookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 100.00
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject Admin attempt to call customer transfer endpoint with AUTH_002 (403)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', adminCookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 100.00
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Destination & Status Validation (FR-11, AC-2, TC-08, TC-12)
  // ----------------------------------------------------------------------------
  describe('4. Destination & Status Restrictions (FR-11, AC-2, TC-08)', () => {
    it('should reject transfer to the SAME account (source === destination) with TXN_002 (400)', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust1ActiveAcc2);

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust1ActiveAcc1,
          amount: 100.00
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
      assert.match(res.body.message, /different/i);

      const afterBal = await getDbBalances(cust1ActiveAcc1, cust1ActiveAcc2);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
    });

    it('should reject transfer when destination account does not exist with ACC_002 (404)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: 999999,
          amount: 100.00
        });

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'ACC_002');
    });

    it('should reject transfer when destination account number does not exist with ACC_002 (404)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountNumber: 'ACC-DOES-NOT-EXIST-999',
          amount: 100.00
        });

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'ACC_002');
    });

    it('should reject transfer FROM a FROZEN source account with ACC_001 (409)', async () => {
      const beforeBal = await getDbBalances(cust1FrozenAcc, cust2ActiveAcc);

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1FrozenAcc,
          destinationAccountId: cust2ActiveAcc,
          amount: 100.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');

      const afterBal = await getDbBalances(cust1FrozenAcc, cust2ActiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);
    });

    it('should reject transfer FROM an INACTIVE source account with ACC_001 (409)', async () => {
      const beforeBal = await getDbBalances(cust1InactiveAcc, cust2ActiveAcc);

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1InactiveAcc,
          destinationAccountId: cust2ActiveAcc,
          amount: 100.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');

      const afterBal = await getDbBalances(cust1InactiveAcc, cust2ActiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);
    });

    it('should reject transfer TO a FROZEN destination account with ACC_001 (409)', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust2FrozenAcc);

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2FrozenAcc,
          amount: 100.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');

      const afterBal = await getDbBalances(cust1ActiveAcc1, cust2FrozenAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);
    });

    it('should reject transfer TO an INACTIVE destination account with ACC_001 (409)', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust1InactiveAcc);

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust1InactiveAcc,
          amount: 100.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');

      const afterBal = await getDbBalances(cust1ActiveAcc1, cust1InactiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Monetary Input Validation (NFR-04, NFR-18, TC-12, AC-3)
  // ----------------------------------------------------------------------------
  describe('5. Monetary Amount Validation (NFR-04, NFR-18, TC-12, AC-3)', () => {
    it('should reject missing amount with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('should reject zero amount with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 0
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('should reject negative amount with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: -50.00
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('should reject non-numeric amount with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 'one_hundred'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('should reject amount with excessive fractional precision (>2 decimal places) with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 10.555
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('should reject amount exceeding maximum single transaction limit with TXN_002 (400)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 1000000000.00
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('should reject malformed source account ID with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: 'invalid_id',
          destinationAccountId: cust2ActiveAcc,
          amount: 100.00
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Atomicity & Forced Rollback on Failure (NFR-09, NFR-17, TC-10, AC-4)
  // ----------------------------------------------------------------------------
  describe('6. Atomicity and Rollback on Failure (NFR-09, NFR-17, TC-10, AC-4)', () => {
    it('should rollback entire transfer if failure occurs after sender debit (TC-10)', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      const amount = 500.00;

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount,
          _testFailurePoint: 'AFTER_DEBIT'
        });

      assert.equal(res.status, 500);
      assert.equal(res.body.errorCode, 'TXN_003');

      // Verify rollback: NEITHER account balance has changed
      const afterBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);

      // Verify no orphan transaction records exist
      const [txs] = await pool.execute(
        'SELECT * FROM bank_transactions WHERE remarks = ?',
        ['Simulated failure after sender debit (TC-10)']
      );
      assert.equal(txs.length, 0);
    });

    it('should rollback entire transfer if failure occurs after recipient credit (TC-10)', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      const amount = 500.00;

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount,
          _testFailurePoint: 'AFTER_CREDIT'
        });

      assert.equal(res.status, 500);
      assert.equal(res.body.errorCode, 'TXN_003');

      const afterBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);
    });

    it('should rollback entire transfer if failure occurs before ledger insertion (TC-10)', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      const amount = 500.00;

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount,
          _testFailurePoint: 'BEFORE_LEDGER_INSERT'
        });

      assert.equal(res.status, 500);
      assert.equal(res.body.errorCode, 'TXN_003');

      const afterBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);
    });

    it('should rollback entire transfer if failure occurs after ledger insertion (TC-10)', async () => {
      const beforeBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      const amount = 500.00;

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount,
          _testFailurePoint: 'AFTER_LEDGER_INSERT'
        });

      assert.equal(res.status, 500);
      assert.equal(res.body.errorCode, 'TXN_003');

      const afterBal = await getDbBalances(cust1ActiveAcc1, cust2ActiveAcc);
      assert.equal(afterBal.srcBalance, beforeBal.srcBalance);
      assert.equal(afterBal.dstBalance, beforeBal.dstBalance);
    });
  });

  // ----------------------------------------------------------------------------
  // 7. Concurrency Safety with Row-Level Exclusive Locks (AC-4, NFR-17)
  // ----------------------------------------------------------------------------
  describe('7. Concurrency Safety & Row-Level Locking (AC-4, NFR-17)', () => {
    it('should safely prevent overdraft under concurrent transfers spending same balance', async () => {
      // Create dedicated account with 2,500.00
      const [accRes] = await pool.execute(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
         VALUES (?, 1, 'SAVINGS', 2500.00, 'ACTIVE')`,
        [`ACC-CONCUR-${Date.now()}`]
      );
      const srcAccId = accRes.insertId;
      createdAccountIds.push(srcAccId);

      // Launch 5 concurrent transfer requests of 1,000.00 each simultaneously
      // Available balance is 2,500.00, so at most 2 requests can succeed (2,000.00 total)
      // Exactly 3 requests must be rejected with 422 (TXN_001)
      const transferPromises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/transfers')
          .set('Cookie', customer1Cookie)
          .send({
            sourceAccountId: srcAccId,
            destinationAccountId: cust2ActiveAcc,
            amount: 1000.00,
            remarks: 'Concurrent transfer stress'
          })
      );

      const results = await Promise.all(transferPromises);
      const successCount = results.filter((r) => r.status === 201).length;
      const rejectedCount = results.filter((r) => r.status === 422).length;

      assert.equal(successCount, 2, 'Exactly 2 transfers of 1000.00 should succeed against 2500.00 balance');
      assert.equal(rejectedCount, 3, 'Exactly 3 transfers should be rejected with 422 Insufficient Balance');

      // Final balance must be exactly 500.00 (2500 - 2000)
      const [finalRow] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [srcAccId]);
      assert.equal(Number(finalRow[0].balance), 500.00);
    });

    it('should prevent deadlocks when two concurrent transfers occur in opposite directions (A->B and B->A)', async () => {
      // Transfer from Customer 1 to Customer 2, and simultaneous transfer from Customer 2 to Customer 1
      const [c1Res, c2Res] = await Promise.all([
        request(app)
          .post('/api/transfers')
          .set('Cookie', customer1Cookie)
          .send({
            sourceAccountId: cust1ActiveAcc2,
            destinationAccountId: cust2ActiveAcc,
            amount: 100.00,
            remarks: 'C1 to C2 bidirectional test'
          }),
        request(app)
          .post('/api/transfers')
          .set('Cookie', customer2Cookie)
          .send({
            sourceAccountId: cust2ActiveAcc,
            destinationAccountId: cust1ActiveAcc2,
            amount: 100.00,
            remarks: 'C2 to C1 bidirectional test'
          })
      ]);

      // Both should complete without deadlock
      assert.equal(c1Res.status, 201);
      assert.equal(c2Res.status, 201);
    });
  });

  // ----------------------------------------------------------------------------
  // 8. Transaction Statement & Ledger Verification (FR-20, TC-16, AC-5)
  // ----------------------------------------------------------------------------
  describe('8. Statement Ledger & Direction Verification (FR-20, TC-16, AC-5)', () => {
    it('should reflect transfer as DEBIT in sender ledger and CREDIT in recipient ledger', async () => {
      const amount = 300.00;
      const transferRes = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount,
          remarks: 'Ledger direction audit'
        });

      assert.equal(transferRes.status, 201);
      const txnRef = transferRes.body.data.transactionRef || transferRes.body.data.transactionReference;

      // 1. Check Sender (Customer 1) Statement Ledger
      const senderLedgerRes = await request(app)
        .get(`/api/accounts/${cust1ActiveAcc1}/transactions`)
        .set('Cookie', customer1Cookie);

      assert.equal(senderLedgerRes.status, 200);
      const senderTxn = senderLedgerRes.body.data.transactions.find((t) => t.transactionRef === txnRef);
      assert.ok(senderTxn, 'Transaction must appear in sender account statement');
      assert.equal(senderTxn.direction, 'DEBIT');
      assert.equal(senderTxn.type, 'TRANSFER');
      assert.equal(senderTxn.amount, amount);

      // 2. Check Recipient (Customer 2) Statement Ledger
      const recipientLedgerRes = await request(app)
        .get(`/api/accounts/${cust2ActiveAcc}/transactions`)
        .set('Cookie', customer2Cookie);

      assert.equal(recipientLedgerRes.status, 200);
      const recipientTxn = recipientLedgerRes.body.data.transactions.find((t) => t.transactionRef === txnRef);
      assert.ok(recipientTxn, 'Transaction must appear in recipient account statement');
      assert.equal(recipientTxn.direction, 'CREDIT');
      assert.equal(recipientTxn.type, 'TRANSFER');
      assert.equal(recipientTxn.amount, amount);
    });
  });

  // ----------------------------------------------------------------------------
  // 9. Alternate REST Endpoints (AC-6)
  // ----------------------------------------------------------------------------
  describe('9. Alternate REST Endpoints (/api/transactions/transfer, /api/accounts/:id/transfers)', () => {
    it('should execute transfer via POST /api/transactions/transfer', async () => {
      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 50.00,
          remarks: 'Transfer via /transactions/transfer'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });

    it('should execute transfer via POST /api/accounts/:accountId/transfers', async () => {
      const res = await request(app)
        .post(`/api/accounts/${cust1ActiveAcc1}/transfers`)
        .set('Cookie', customer1Cookie)
        .send({
          destinationAccountId: cust2ActiveAcc,
          amount: 50.00,
          remarks: 'Transfer via /accounts/:id/transfers'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });
  });
});
