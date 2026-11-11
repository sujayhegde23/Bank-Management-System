/**
 * ==============================================================================
 * Feature 2: Customer Balance Display and Account Status Clarity Test Suite
 * ==============================================================================
 * Tests:
 * 1. Active account displays correct current balance.
 * 2. Active account displays correct available balance (equals current balance).
 * 3. Frozen account retains its actual current balance.
 * 4. Frozen account displays zero available balance under applicable rules (0.00).
 * 5. Inactive account retains its actual current balance.
 * 6. Inactive and frozen accounts cannot transact (withdraw, deposit, transfer).
 * 7. Aggregate current balance is accurate (MySQL DECIMAL exactness).
 * 8. Aggregate available balance is accurate (excludes frozen and inactive funds).
 * 9. Account status changes (freezing, deactivating, unfreezing) do not alter stored balances.
 * 10. Existing deposits, withdrawals, and transfers remain correct and update balances atomically.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, query, testConnection } = require('../src/config/db');
const { loginAs } = require('./helpers/authHelper');

const TEST_PASSWORD = 'Password123!';

describe('Feature 2: Customer Balance Display and Account Status Clarity', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customer1Cookie = null;
  let customer2Cookie = null;

  // Track temporary IDs for safe teardown
  const createdAccountIds = [];
  const createdTransactionIds = [];

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // 1. Authenticate Admin
    adminCookie = await loginAs(request, app, 'test.admin1', TEST_PASSWORD);

    // 2. Authenticate Employee
    employeeCookie = await loginAs(request, app, 'test.employee1', TEST_PASSWORD);

    // 3. Authenticate Customer 1 (Owns ACC-T1 ACTIVE ₹10,000, ACC-T4 INACTIVE ₹1,000)
    customer1Cookie = await loginAs(request, app, 'test.customer1', TEST_PASSWORD);

    // 4. Authenticate Customer 2 (Owns ACC-T2 ACTIVE ₹5,000, ACC-T3 FROZEN ₹2,000)
    customer2Cookie = await loginAs(request, app, 'test.customer2', TEST_PASSWORD);
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
        await query(
          `DELETE FROM accounts WHERE account_id IN (${createdAccountIds.map(() => '?').join(',')})`,
          createdAccountIds
        );
      }
      if (createdTransactionIds.length > 0) {
        const ph = createdTransactionIds.map(() => '?').join(',');
        await query(
          `DELETE FROM fraud_outbox_events WHERE transaction_id IN (${ph})`,
          createdTransactionIds
        ).catch(() => {});
        await query(
          `DELETE FROM bank_transactions WHERE transaction_id IN (${ph})`,
          createdTransactionIds
        );
      }
      await pool.end();
    } catch (err) {
      console.error('Teardown error in customerBalanceDisplay.test.js:', err);
    }
  });

  // --------------------------------------------------------------------------
  // Requirement 1 & 2: Active Account Current & Available Balance
  // --------------------------------------------------------------------------
  describe('1 & 2. Active Account Balance Clarity', () => {
    it('should display correct current balance for active account (ACC-T1 = ₹10,000)', async () => {
      const res = await request(app)
        .get('/api/accounts/1')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.accountNumber, 'ACC-T1');
      assert.equal(res.body.data.status, 'ACTIVE');
      assert.equal(res.body.data.currentBalance, 10000.00);
      assert.equal(res.body.data.balance, 10000.00);
    });

    it('should display available balance equal to current balance for active account (ACC-T1 = ₹10,000)', async () => {
      const res = await request(app)
        .get('/api/accounts/1')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.availableBalance, 10000.00);
      assert.equal(res.body.data.availableBalance, res.body.data.currentBalance);
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 3 & 4: Frozen Account Retains Balance but Zero Available
  // --------------------------------------------------------------------------
  describe('3 & 4. Frozen Account Balance Clarity', () => {
    it('should retain actual stored current balance when account is frozen (ACC-T3 = ₹2,000)', async () => {
      const res = await request(app)
        .get('/api/accounts/3')
        .set('Cookie', customer2Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.accountNumber, 'ACC-T3');
      assert.equal(res.body.data.status, 'FROZEN');
      assert.equal(res.body.data.currentBalance, 2000.00);
      assert.equal(res.body.data.balance, 2000.00);
    });

    it('should display exactly ₹0.00 available balance for frozen account (ACC-T3 = ₹0.00)', async () => {
      const res = await request(app)
        .get('/api/accounts/3')
        .set('Cookie', customer2Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.availableBalance, 0);
    });

    it('should verify direct MySQL record confirms frozen account balance is not erased or zeroed out', async () => {
      const rows = await query('SELECT balance, status FROM accounts WHERE account_id = 3');
      assert.equal(rows[0].status, 'FROZEN');
      assert.equal(Number(rows[0].balance), 2000.00);
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 5: Inactive Account Retains Balance
  // --------------------------------------------------------------------------
  describe('5. Inactive Account Balance Clarity', () => {
    it('should retain actual stored current balance for inactive account (ACC-T4 = ₹1,000)', async () => {
      const res = await request(app)
        .get('/api/accounts/4')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.accountNumber, 'ACC-T4');
      assert.equal(res.body.data.status, 'INACTIVE');
      assert.equal(res.body.data.currentBalance, 1000.00);
      assert.equal(res.body.data.balance, 1000.00);
    });

    it('should display zero available balance for inactive account (ACC-T4 = ₹0.00)', async () => {
      const res = await request(app)
        .get('/api/accounts/4')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.availableBalance, 0);
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 6: Inactive & Frozen Accounts Cannot Transact
  // --------------------------------------------------------------------------
  describe('6. Inactive & Frozen Accounts Transaction Restrictions (FR-11)', () => {
    it('should reject withdrawal attempt on frozen account with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/accounts/3/withdrawals')
        .set('Cookie', employeeCookie)
        .send({ amount: 100.00, remarks: 'Test withdrawal on frozen account' });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
      assert.match(res.body.message, /frozen or inactive/i);
    });

    it('should reject deposit attempt on frozen account with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/accounts/3/deposits')
        .set('Cookie', employeeCookie)
        .send({ amount: 100.00, remarks: 'Test deposit on frozen account' });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
      assert.match(res.body.message, /frozen or inactive/i);
    });

    it('should reject withdrawal attempt on inactive account with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/accounts/4/withdrawals')
        .set('Cookie', employeeCookie)
        .send({ amount: 100.00, remarks: 'Test withdrawal on inactive account' });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
      assert.match(res.body.message, /frozen or inactive/i);
    });

    it('should reject transfer from inactive account with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: 4,
          destinationAccountId: 2,
          amount: 50.00,
          remarks: 'Transfer attempt from inactive account'
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
    });

    it('should reject transfer into a frozen account with 409 ACC_001', async () => {
      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: 1,
          destinationAccountId: 3, // ACC-T3 is FROZEN
          amount: 50.00,
          remarks: 'Transfer attempt to frozen account'
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'ACC_001');
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 7 & 8: Aggregate Current & Available Balance Accuracy
  // --------------------------------------------------------------------------
  describe('7 & 8. Aggregate Portfolio Balance Accuracy', () => {
    it('should accurately calculate Customer 1 aggregate balances matching MySQL ledger calculation', async () => {
      const expRows = await query(`
        SELECT 
          COUNT(*) AS total_accounts,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_accounts,
          SUM(CASE WHEN status = 'FROZEN' THEN 1 ELSE 0 END) AS frozen_accounts,
          SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive_accounts,
          COALESCE(SUM(balance), 0.00) AS total_current_balance,
          COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN balance ELSE 0.00 END), 0.00) AS total_available_balance
        FROM accounts
        WHERE customer_id = 1
      `);
      const exp = expRows[0];

      const res = await request(app)
        .get('/api/accounts/summary')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.totalAccounts, Number(exp.total_accounts));
      assert.equal(res.body.data.activeAccounts, Number(exp.active_accounts));
      assert.equal(res.body.data.frozenAccounts, Number(exp.frozen_accounts));
      assert.equal(res.body.data.inactiveAccounts, Number(exp.inactive_accounts));
      assert.equal(res.body.data.totalCurrentBalance, Number(Number(exp.total_current_balance).toFixed(2)));
      assert.equal(res.body.data.totalAvailableBalance, Number(Number(exp.total_available_balance).toFixed(2)));
    });

    it('should accurately calculate Customer 2 aggregate balances matching MySQL ledger calculation', async () => {
      const expRows = await query(`
        SELECT 
          COUNT(*) AS total_accounts,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_accounts,
          SUM(CASE WHEN status = 'FROZEN' THEN 1 ELSE 0 END) AS frozen_accounts,
          SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive_accounts,
          COALESCE(SUM(balance), 0.00) AS total_current_balance,
          COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN balance ELSE 0.00 END), 0.00) AS total_available_balance
        FROM accounts
        WHERE customer_id = 2
      `);
      const exp = expRows[0];

      const res = await request(app)
        .get('/api/accounts/summary')
        .set('Cookie', customer2Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.totalAccounts, Number(exp.total_accounts));
      assert.equal(res.body.data.activeAccounts, Number(exp.active_accounts));
      assert.equal(res.body.data.frozenAccounts, Number(exp.frozen_accounts));
      assert.equal(res.body.data.inactiveAccounts, Number(exp.inactive_accounts));
      assert.equal(res.body.data.totalCurrentBalance, Number(Number(exp.total_current_balance).toFixed(2)));
      assert.equal(res.body.data.totalAvailableBalance, Number(Number(exp.total_available_balance).toFixed(2)));
    });

    it('should reflect both currentBalance and availableBalance on /api/accounts listing items', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.length >= 2);

      const accT1 = res.body.data.find(a => a.accountNumber === 'ACC-T1');
      assert.ok(accT1);
      assert.equal(accT1.currentBalance, 10000.00);
      assert.equal(accT1.availableBalance, 10000.00);

      const accT4 = res.body.data.find(a => a.accountNumber === 'ACC-T4');
      assert.ok(accT4);
      assert.equal(accT4.currentBalance, 1000.00);
      assert.equal(accT4.availableBalance, 0.00);
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 9: Account Status Changes Do Not Alter Stored Balances
  // --------------------------------------------------------------------------
  describe('9. Balance Immutability under Status Lifecycle Transitions', () => {
    let tempAccountId = null;
    let tempAccountNum = null;

    before(async () => {
      // Create dedicated account for status transition testing
      const suffix = Date.now().toString().slice(-6);
      tempAccountNum = `ACC-BALTEST-${suffix}`;
      const insertRes = await query(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
         VALUES (?, 1, 'SAVINGS', 3500.75, 'ACTIVE')`,
        [tempAccountNum]
      );
      tempAccountId = insertRes.insertId;
      createdAccountIds.push(tempAccountId);
    });

    it('should verify initial ACTIVE state: current = available = ₹3,500.75', async () => {
      const res = await request(app)
        .get(`/api/accounts/${tempAccountId}`)
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'ACTIVE');
      assert.equal(res.body.data.currentBalance, 3500.75);
      assert.equal(res.body.data.availableBalance, 3500.75);
    });

    it('should freeze account: stored balance in MySQL remains ₹3,500.75 while available becomes ₹0.00', async () => {
      // 1. Employee freezes the account
      const patchRes = await request(app)
        .patch(`/api/accounts/${tempAccountId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'FROZEN', reason: 'Security investigation check' });

      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.data.status, 'FROZEN');
      assert.equal(patchRes.body.data.currentBalance, 3500.75);
      assert.equal(patchRes.body.data.availableBalance, 0);

      // 2. Direct MySQL check
      const rows = await query('SELECT balance, status FROM accounts WHERE account_id = ?', [tempAccountId]);
      assert.equal(rows[0].status, 'FROZEN');
      assert.equal(Number(rows[0].balance), 3500.75);

      // 3. Customer read
      const custRes = await request(app)
        .get(`/api/accounts/${tempAccountId}`)
        .set('Cookie', customer1Cookie);
      assert.equal(custRes.body.data.currentBalance, 3500.75);
      assert.equal(custRes.body.data.availableBalance, 0);
    });

    it('should unfreeze account: available balance restores to full ₹3,500.75 without data drift', async () => {
      // 1. Employee unfreezes the account
      const patchRes = await request(app)
        .patch(`/api/accounts/${tempAccountId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'ACTIVE', reason: 'Investigation completed' });

      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.data.status, 'ACTIVE');
      assert.equal(patchRes.body.data.currentBalance, 3500.75);
      assert.equal(patchRes.body.data.availableBalance, 3500.75);

      // 2. Direct MySQL check
      const rows = await query('SELECT balance, status FROM accounts WHERE account_id = ?', [tempAccountId]);
      assert.equal(Number(rows[0].balance), 3500.75);
    });

    it('should deactivate account: balance remains ₹3,500.75 while available becomes ₹0.00', async () => {
      const patchRes = await request(app)
        .patch(`/api/accounts/${tempAccountId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'INACTIVE', reason: 'Customer requested dormancy' });

      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.data.status, 'INACTIVE');
      assert.equal(patchRes.body.data.currentBalance, 3500.75);
      assert.equal(patchRes.body.data.availableBalance, 0);

      const rows = await query('SELECT balance, status FROM accounts WHERE account_id = ?', [tempAccountId]);
      assert.equal(Number(rows[0].balance), 3500.75);
    });

    it('should reactivate account: available balance restores to full ₹3,500.75', async () => {
      const patchRes = await request(app)
        .patch(`/api/accounts/${tempAccountId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'ACTIVE', reason: 'Reactivation request approved' });

      assert.equal(patchRes.status, 200);
      assert.equal(patchRes.body.data.status, 'ACTIVE');
      assert.equal(patchRes.body.data.currentBalance, 3500.75);
      assert.equal(patchRes.body.data.availableBalance, 3500.75);
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 10: Existing Deposits, Withdrawals, and Transfers
  // --------------------------------------------------------------------------
  describe('10. Financial Operations Accuracy under Available Balance Model', () => {
    let sourceAccId = null;
    let destAccId = null;

    before(async () => {
      const suffix = Date.now().toString().slice(-6);
      const sRes = await query(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
         VALUES (?, 1, 'SAVINGS', 1000.00, 'ACTIVE')`,
        [`ACC-OPS-SRC-${suffix}`]
      );
      sourceAccId = sRes.insertId;
      createdAccountIds.push(sourceAccId);

      const dRes = await query(
        `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
         VALUES (?, 2, 'SAVINGS', 500.00, 'ACTIVE')`,
        [`ACC-OPS-DST-${suffix}`]
      );
      destAccId = dRes.insertId;
      createdAccountIds.push(destAccId);
    });

    it('should process deposit and accurately update both current and available balance', async () => {
      const res = await request(app)
        .post(`/api/accounts/${sourceAccId}/deposits`)
        .set('Cookie', employeeCookie)
        .send({ amount: 500.00, remarks: 'Cash deposit' });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.balanceAfter, 1500.00);

      // Verify account query reflects both balances as 1500.00
      const accRes = await request(app)
        .get(`/api/accounts/${sourceAccId}`)
        .set('Cookie', customer1Cookie);
      assert.equal(accRes.body.data.currentBalance, 1500.00);
      assert.equal(accRes.body.data.availableBalance, 1500.00);
    });

    it('should process withdrawal and accurately reduce both current and available balance', async () => {
      const res = await request(app)
        .post(`/api/accounts/${sourceAccId}/withdrawals`)
        .set('Cookie', employeeCookie)
        .send({ amount: 300.00, remarks: 'Cash withdrawal' });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.balanceAfter, 1200.00);

      const accRes = await request(app)
        .get(`/api/accounts/${sourceAccId}`)
        .set('Cookie', customer1Cookie);
      assert.equal(accRes.body.data.currentBalance, 1200.00);
      assert.equal(accRes.body.data.availableBalance, 1200.00);
    });

    it('should execute transfer atomically debiting source and crediting destination', async () => {
      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: sourceAccId,
          destinationAccountId: destAccId,
          amount: 200.00,
          remarks: 'Inter-customer transfer'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.sourceBalanceAfter, 1000.00);

      // Source checks
      const srcAcc = await request(app)
        .get(`/api/accounts/${sourceAccId}`)
        .set('Cookie', customer1Cookie);
      assert.equal(srcAcc.body.data.currentBalance, 1000.00);
      assert.equal(srcAcc.body.data.availableBalance, 1000.00);

      // Destination checks
      const dstAcc = await request(app)
        .get(`/api/accounts/${destAccId}`)
        .set('Cookie', customer2Cookie);
      assert.equal(dstAcc.body.data.currentBalance, 700.00);
      assert.equal(dstAcc.body.data.availableBalance, 700.00);
    });

    it('should reject overdraft when transfer amount exceeds available balance', async () => {
      const res = await request(app)
        .post('/api/transactions/transfer')
        .set('Cookie', customer1Cookie)
        .send({
          sourceAccountId: sourceAccId,
          destinationAccountId: destAccId,
          amount: 50000.00, // Available is only 1,000.00
          remarks: 'Overdraft attempt'
        });

      assert.equal(res.status, 422);
      assert.equal(res.body.errorCode, 'TXN_001');
      assert.match(res.body.message, /insufficient balance/i);
    });
  });
});
