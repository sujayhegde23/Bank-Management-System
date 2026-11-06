/**
 * ==============================================================================
 * Feature 3 — Secure Customer Fund Transfer & Beneficiary Verification Test Suite
 * ==============================================================================
 * Verifies all 17 required scenarios:
 * 1. Valid transfer succeeds.
 * 2. Source balance decreases correctly.
 * 3. Destination balance increases correctly.
 * 4. Invalid beneficiary is rejected.
 * 5. Inactive destination is rejected.
 * 6. Frozen destination is rejected.
 * 7. Frozen source is rejected.
 * 8. Inactive source is rejected.
 * 9. Insufficient balance is rejected.
 * 10. Negative amount is rejected.
 * 11. Zero amount is rejected.
 * 12. Same-account transfer is rejected.
 * 13. Unauthorized source account is rejected.
 * 14. Database rollback works when an operation fails.
 * 15. Concurrent transfers cannot cause inconsistent balances.
 * 16. Duplicate requests do not create duplicate transactions.
 * 17. Existing transaction history and reports remain accurate.
 *
 * Plus Beneficiary Verification & Data Privacy checks.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { query, pool, testConnection } = require('../src/config/db');
const { _resetTransferDeduplicationStores } = require('../src/services/transactionService');

const TEST_PASSWORD = 'Password123!';

describe('Feature 3: Secure Customer Fund Transfer and Beneficiary Verification', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customer1Cookie = null;
  let customer2Cookie = null;

  const createdAccountIds = [];
  let cust1ActiveAcc1 = null;
  let cust1ActiveAcc1Num = null;
  let cust1ActiveAcc2 = null;
  let cust1ActiveAcc2Num = null;
  let cust1FrozenAcc = null;
  let cust1InactiveAcc = null;

  let cust2ActiveAcc = null;
  let cust2ActiveAccNum = null;
  let cust2FrozenAcc = null;
  let cust2InactiveAcc = null;

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected. Error: ${status.error}`);

    // Authenticate roles
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

    const suffix = Date.now().toString().slice(-6);

    // Customer 1 Accounts:
    cust1ActiveAcc1Num = `ACC-SEC-C1A-${suffix}`;
    const acc1Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 15000.00, 'ACTIVE')`,
      [cust1ActiveAcc1Num]
    );
    cust1ActiveAcc1 = acc1Res.insertId;
    createdAccountIds.push(cust1ActiveAcc1);

    cust1ActiveAcc2Num = `ACC-SEC-C1B-${suffix}`;
    const acc2Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'CURRENT', 5000.00, 'ACTIVE')`,
      [cust1ActiveAcc2Num]
    );
    cust1ActiveAcc2 = acc2Res.insertId;
    createdAccountIds.push(cust1ActiveAcc2);

    const acc3Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 2500.00, 'FROZEN')`,
      [`ACC-SEC-C1F-${suffix}`]
    );
    cust1FrozenAcc = acc3Res.insertId;
    createdAccountIds.push(cust1FrozenAcc);

    const acc4Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 1500.00, 'INACTIVE')`,
      [`ACC-SEC-C1I-${suffix}`]
    );
    cust1InactiveAcc = acc4Res.insertId;
    createdAccountIds.push(cust1InactiveAcc);

    // Customer 2 Accounts:
    cust2ActiveAccNum = `ACC-SEC-C2A-${suffix}`;
    const acc5Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 2, 'SAVINGS', 8000.00, 'ACTIVE')`,
      [cust2ActiveAccNum]
    );
    cust2ActiveAcc = acc5Res.insertId;
    createdAccountIds.push(cust2ActiveAcc);

    const acc6Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 2, 'CURRENT', 3000.00, 'FROZEN')`,
      [`ACC-SEC-C2F-${suffix}`]
    );
    cust2FrozenAcc = acc6Res.insertId;
    createdAccountIds.push(cust2FrozenAcc);

    const acc7Res = await query(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 2, 'SAVINGS', 1000.00, 'INACTIVE')`,
      [`ACC-SEC-C2I-${suffix}`]
    );
    cust2InactiveAcc = acc7Res.insertId;
    createdAccountIds.push(cust2InactiveAcc);
  });

  after(async () => {
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
          `DELETE FROM bank_transactions
           WHERE source_account_id IN (${placeholders}) OR destination_account_id IN (${placeholders})`,
          [...createdAccountIds, ...createdAccountIds]
        );
        await query(
          `DELETE FROM accounts WHERE account_id IN (${placeholders})`,
          createdAccountIds
        );
      }
    } catch (err) {
      console.error('Error in secureTransfers cleanup:', err.message);
    } finally {
      await pool.end();
    }
  });

  // --------------------------------------------------------------------------
  // Beneficiary Verification Flow (Section 3)
  // --------------------------------------------------------------------------
  describe('Beneficiary Verification and Privacy Protection', () => {
    it('should verify active beneficiary by account number and return minimal safe metadata', async () => {
      const res = await request(app)
        .post('/api/transfers/verify-beneficiary')
        .set('Cookie', customer1Cookie)
        .send({
          destinationAccount: cust2ActiveAccNum,
          sourceAccountId: cust1ActiveAcc1
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.verificationStatus, 'VERIFIED');
      assert.equal(res.body.data.beneficiaryName, 'Test Customer Two');
      assert.equal(res.body.data.accountType, 'SAVINGS');
      assert.ok(res.body.data.maskedAccountNumber.includes('****'));

      // Strict privacy check: No balance, email, phone, customerId exposed
      assert.equal(res.body.data.balance, undefined);
      assert.equal(res.body.data.email, undefined);
      assert.equal(res.body.data.phone, undefined);
      assert.equal(res.body.data.customerId, undefined);
    });

    it('should verify active beneficiary by numeric account ID', async () => {
      const res = await request(app)
        .post('/api/transfers/verify-beneficiary')
        .set('Cookie', customer1Cookie)
        .send({
          destinationAccountId: cust2ActiveAcc,
          sourceAccountId: cust1ActiveAcc1
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.beneficiaryName, 'Test Customer Two');
      assert.equal(res.body.data.verificationStatus, 'VERIFIED');
    });

    it('should reject beneficiary verification for non-existent account with 404 ACC_002', async () => {
      const res = await request(app)
        .post('/api/transfers/verify-beneficiary')
        .set('Cookie', customer1Cookie)
        .send({
          destinationAccount: 'ACC-NONEXISTENT-99999',
          sourceAccountId: cust1ActiveAcc1
        });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'ACC_002');
    });

    it('should reject beneficiary verification for frozen account with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/transfers/verify-beneficiary')
        .set('Cookie', customer1Cookie)
        .send({
          destinationAccountId: cust2FrozenAcc,
          sourceAccountId: cust1ActiveAcc1
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'ACC_001');
    });

    it('should reject beneficiary verification for inactive account with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/transfers/verify-beneficiary')
        .set('Cookie', customer1Cookie)
        .send({
          destinationAccountId: cust2InactiveAcc,
          sourceAccountId: cust1ActiveAcc1
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'ACC_001');
    });

    it('should reject beneficiary verification if destination matches source account with 400 TXN_002', async () => {
      const res = await request(app)
        .post('/api/transfers/verify-beneficiary')
        .set('Cookie', customer1Cookie)
        .send({
          destinationAccountId: cust1ActiveAcc1,
          sourceAccountId: cust1ActiveAcc1
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('should reject beneficiary verification if destination account parameter is missing with 400 VAL_001', async () => {
      const res = await request(app)
        .post('/api/transfers/verify-beneficiary')
        .set('Cookie', customer1Cookie)
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should support GET query-based beneficiary verification', async () => {
      const res = await request(app)
        .get(`/api/transfers/verify-beneficiary?destinationAccount=${cust2ActiveAccNum}`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.beneficiaryName, 'Test Customer Two');
    });
  });

  // --------------------------------------------------------------------------
  // Requirements 1, 2, 3: Valid Transfer Execution & Exact Balance Changes
  // --------------------------------------------------------------------------
  describe('1, 2, 3. Valid Fund Transfer & Exact Balance Ledger Updates', () => {
    let transferTxnRef = null;

    it('1. Valid transfer succeeds with 201 Created and transaction reference', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 2500.00,
          remarks: 'Valid monthly fund transfer'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.transactionRef);
      assert.ok(res.body.data.transactionRef.startsWith('TXN-TRF-'));
      assert.equal(res.body.data.amount, 2500.00);
      transferTxnRef = res.body.data.transactionRef;
    });

    it('2. Source balance decreases correctly (15,000.00 - 2,500.00 = 12,500.00)', async () => {
      const srcRows = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust1ActiveAcc1]);
      assert.equal(Number(srcRows[0].balance), 12500.00);
    });

    it('3. Destination balance increases correctly (8,000.00 + 2,500.00 = 10,500.00)', async () => {
      const destRows = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust2ActiveAcc]);
      assert.equal(Number(destRows[0].balance), 10500.00);
    });
  });

  // --------------------------------------------------------------------------
  // Requirements 4, 5, 6: Destination Beneficiary Restrictions
  // --------------------------------------------------------------------------
  describe('4, 5, 6. Destination Beneficiary Validation Restrictions', () => {
    it('4. Invalid beneficiary is rejected with 404 ACC_002', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccount: 'ACC-INVALID-NONEXISTENT',
          amount: 500.00
        });

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'ACC_002');
    });

    it('5. Inactive destination is rejected with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2InactiveAcc,
          amount: 500.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
    });

    it('6. Frozen destination is rejected with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2FrozenAcc,
          amount: 500.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
    });
  });

  // --------------------------------------------------------------------------
  // Requirements 7, 8, 9: Source Account Operational & Balance Restrictions
  // --------------------------------------------------------------------------
  describe('7, 8, 9. Source Account Status & Balance Validations', () => {
    it('7. Frozen source account is rejected with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1FrozenAcc,
          destinationAccountId: cust2ActiveAcc,
          amount: 200.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
    });

    it('8. Inactive source account is rejected with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1InactiveAcc,
          destinationAccountId: cust2ActiveAcc,
          amount: 200.00
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
    });

    it('9. Insufficient balance is rejected with 422 TXN_001', async () => {
      // Current balance of cust1ActiveAcc1 is 12,500.00
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 999999.00
        });

      assert.equal(res.status, 422);
      assert.equal(res.body.errorCode, 'TXN_001');

      // Verify balance was untouched
      const rows = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust1ActiveAcc1]);
      assert.equal(Number(rows[0].balance), 12500.00);
    });
  });

  // --------------------------------------------------------------------------
  // Requirements 10, 11, 12, 13: Input Integrity & Authorization
  // --------------------------------------------------------------------------
  describe('10, 11, 12, 13. Monetary Parameters, Self-Transfer, and Authorization', () => {
    it('10. Negative amount is rejected with 400 TXN_002', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: -500.00
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('11. Zero amount is rejected with 400 TXN_002', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 0.00
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'TXN_002');
    });

    it('12. Same-account transfer is rejected with 400 TXN_002', async () => {
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
    });

    it('13. Unauthorized source account (Customer 1 trying to debit Customer 2 account) is rejected with 403 AUTH_002', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust2ActiveAcc, // Belongs to Customer 2!
          destinationAccountId: cust1ActiveAcc1,
          amount: 100.00
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // --------------------------------------------------------------------------
  // Requirements 14: Atomic Database Rollback
  // --------------------------------------------------------------------------
  describe('14. Database Rollback Verification on Failure', () => {
    it('14. should rollback entire transfer if failure occurs after sender debit', async () => {
      const [srcBefore] = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust1ActiveAcc1]);
      const [destBefore] = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust2ActiveAcc]);

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 1000.00,
          _testFailurePoint: 'AFTER_DEBIT'
        });

      assert.equal(res.status, 500);

      // Verify atomic rollback: neither balance was modified
      const [srcAfter] = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust1ActiveAcc1]);
      const [destAfter] = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust2ActiveAcc]);

      assert.equal(Number(srcAfter.balance), Number(srcBefore.balance));
      assert.equal(Number(destAfter.balance), Number(destBefore.balance));
    });

    it('14. should rollback entire transfer if failure occurs before ledger insertion', async () => {
      const [srcBefore] = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust1ActiveAcc1]);
      const [destBefore] = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust2ActiveAcc]);

      const res = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: cust1ActiveAcc1,
          destinationAccountId: cust2ActiveAcc,
          amount: 1000.00,
          _testFailurePoint: 'BEFORE_LEDGER_INSERT'
        });

      assert.equal(res.status, 500);

      const [srcAfter] = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust1ActiveAcc1]);
      const [destAfter] = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust2ActiveAcc]);

      assert.equal(Number(srcAfter.balance), Number(srcBefore.balance));
      assert.equal(Number(destAfter.balance), Number(destBefore.balance));
    });
  });

  // --------------------------------------------------------------------------
  // Requirements 15: Concurrency Safety under Simultaneous Transfers
  // --------------------------------------------------------------------------
  describe('15. Concurrency Safety with Row-Level Exclusive Locks', () => {
    it('15. should safely prevent overdraft under concurrent transfers spending same balance', async () => {
      // Create dedicated account with 2,500.00
      const suffix = Date.now().toString().slice(-6);
      const accRes = await query(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
         VALUES (?, 1, 'SAVINGS', 2500.00, 'ACTIVE')`,
        [`ACC-CONCUR-${suffix}`]
      );
      const concurAccId = accRes.insertId;
      createdAccountIds.push(concurAccId);

      // Launch 5 concurrent transfer requests of 1,000.00 each simultaneously
      // Available balance is 2,500.00 -> at most 2 requests can succeed (2,000.00 total)
      // Exactly 3 requests must be rejected with 422 (TXN_001)
      const transferPromises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/transfers')
          .set('Cookie', customer1Cookie)
          .send({
            sourceAccountId: concurAccId,
            destinationAccountId: cust2ActiveAcc,
            amount: 1000.00,
            remarks: 'Concurrent transfer execution test'
          })
      );

      const results = await Promise.all(transferPromises);
      const successCount = results.filter((r) => r.status === 201).length;
      const rejectedCount = results.filter((r) => r.status === 422).length;

      assert.equal(successCount, 2, 'Exactly 2 transfers of 1000.00 should succeed against 2500.00 balance');
      assert.equal(rejectedCount, 3, 'Exactly 3 transfers should be rejected with 422 Insufficient Balance');

      // Final balance must be exactly 500.00 (2500 - 2000)
      const finalRow = await query('SELECT balance FROM accounts WHERE account_id = ?', [concurAccId]);
      assert.equal(Number(finalRow[0].balance), 500.00);
    });
  });

  // --------------------------------------------------------------------------
  // Requirements 16: Duplicate Request Deduplication
  // --------------------------------------------------------------------------
  describe('16. Duplicate Request Deduplication and Ledger Safety', () => {
    it('16. Duplicate requests with same idempotencyKey do not create duplicate transactions', async () => {
      _resetTransferDeduplicationStores();

      const uniqueKey = `IDEMP-TEST-${Date.now()}`;
      const payload = {
        sourceAccountId: cust1ActiveAcc2, // balance 5,000.00
        destinationAccountId: cust2ActiveAcc,
        amount: 500.00,
        remarks: 'Duplicate idempotency check',
        idempotencyKey: uniqueKey
      };

      // 1. Initial request
      const res1 = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send(payload);

      assert.equal(res1.status, 201);
      assert.equal(res1.body.success, true);
      const originalRef = res1.body.data.transactionRef;

      // 2. Duplicate submission with identical idempotencyKey
      const res2 = await request(app)
        .post('/api/transfers')
        .set('Cookie', customer1Cookie)
        .send(payload);

      // Returns the original transaction reference without creating another transaction
      assert.equal(res2.status, 200);
      assert.equal(res2.body.success, true);
      assert.equal(res2.body.data.transactionRef, originalRef);

      // 3. Verify exactly ONE ledger transaction exists with this reference in MySQL
      const ledgerRows = await query(
        'SELECT COUNT(*) AS cnt FROM bank_transactions WHERE transaction_ref = ?',
        [originalRef]
      );
      assert.equal(Number(ledgerRows[0].cnt), 1);

      // 4. Verify source account was debited exactly ONCE (5,000.00 - 500.00 = 4,500.00, NOT 4,000.00)
      const srcRows = await query('SELECT balance FROM accounts WHERE account_id = ?', [cust1ActiveAcc2]);
      assert.equal(Number(srcRows[0].balance), 4500.00);
    });
  });

  // --------------------------------------------------------------------------
  // Requirements 17: Transaction Ledger and Reports Accuracy
  // --------------------------------------------------------------------------
  describe('17. Existing Transaction History and Reports Integrity', () => {
    it('17. should verify transfer appears accurately in account transaction history', async () => {
      const res = await request(app)
        .get(`/api/accounts/${cust1ActiveAcc2}/transactions`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data.transactions));
      const trfTxn = res.body.data.transactions.find((t) => t.type === 'TRANSFER');
      assert.ok(trfTxn, 'Account history must contain the transfer');
      assert.equal(Number(trfTxn.amount), 500.00);
    });

    it('17. should verify transfer receipt is accessible to the participating customer', async () => {
      // Find the last completed transfer reference
      const [lastTxn] = await query(
        `SELECT transaction_ref FROM bank_transactions
         WHERE type = 'TRANSFER' AND source_account_id = ?
         ORDER BY transaction_id DESC LIMIT 1`,
        [cust1ActiveAcc2]
      );
      assert.ok(lastTxn);

      const res = await request(app)
        .get(`/api/transactions/${lastTxn.transaction_ref}/receipt`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.transaction.type, 'TRANSFER');
      assert.equal(res.body.data.transaction.transactionRef, lastTxn.transaction_ref);
    });
  });
});
