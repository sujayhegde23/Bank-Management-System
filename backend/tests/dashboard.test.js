/**
 * ==============================================================================
 * Admin Dashboard & Executive Overview Integration Test Suite (Feature 1)
 * ==============================================================================
 * Verifies:
 * - Admin-only clearance on GET /api/reports/dashboard (NFR-03, AUTH_002, AUTH_003).
 * - Exact summary card matching with underlying database records.
 * - Exact monetary aggregate handling and decimal precision.
 * - Single-counting of fund transfers in all volume and count metrics.
 * - Flexible time filters (today, 7d, 30d, all, custom date range).
 * - Empty dataset handling and resilience.
 * - Read-only query execution with zero state mutation.
 * - Recent transaction performer details without leaking sensitive credentials.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, testConnection } = require('../src/config/db');

const TEST_PASSWORD = 'Password123!';

describe('Admin Dashboard and Executive Overview Suite (Feature 1)', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customerCookie = null;

  // Track created fixtures for cleanup
  const createdAccountIds = [];
  const createdTransactionIds = [];

  let testSenderAccId = null;
  let testRecipientAccId = null;
  let testFrozenAccId = null;
  let testSenderAccNumber = null;
  let testRecipientAccNumber = null;
  let testFrozenAccNumber = null;

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.admin1', password: TEST_PASSWORD });
    assert.equal(adminRes.status, 200);
    adminCookie = adminRes.headers['set-cookie'];

    // Authenticate Employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.employee1', password: TEST_PASSWORD });
    assert.equal(empRes.status, 200);
    employeeCookie = empRes.headers['set-cookie'];

    // Authenticate Customer
    const custRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(custRes.status, 200);
    customerCookie = custRes.headers['set-cookie'];

    // Setup isolated test accounts
    const now = Date.now();
    testSenderAccNumber = `ACC-DASH-S-${now}`;
    testRecipientAccNumber = `ACC-DASH-R-${now}`;
    testFrozenAccNumber = `ACC-DASH-FZ-${now}`;

    const [a1] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 15000.00, 'ACTIVE')`,
      [testSenderAccNumber]
    );
    testSenderAccId = a1.insertId;
    createdAccountIds.push(testSenderAccId);

    const [a2] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 2, 'CURRENT', 5000.00, 'ACTIVE')`,
      [testRecipientAccNumber]
    );
    testRecipientAccId = a2.insertId;
    createdAccountIds.push(testRecipientAccId);

    const [a3] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 3500.00, 'FROZEN')`,
      [testFrozenAccNumber]
    );
    testFrozenAccId = a3.insertId;
    createdAccountIds.push(testFrozenAccId);
  });

  after(async () => {
    try {
      if (createdTransactionIds.length > 0) {
        const placeholders = createdTransactionIds.map(() => '?').join(',');
        await pool.execute(
          `DELETE FROM bank_transactions WHERE transaction_id IN (${placeholders})`,
          createdTransactionIds
        );
      }
      if (createdAccountIds.length > 0) {
        const placeholders = createdAccountIds.map(() => '?').join(',');
        await pool.execute(
          `DELETE FROM accounts WHERE account_id IN (${placeholders})`,
          createdAccountIds
        );
      }
    } catch (cleanupErr) {
      console.error('Error during dashboard test teardown:', cleanupErr.message);
    } finally {
      await pool.end();
    }
  });

  /* ==========================================================================
     1. Authentication and Authorization (Security)
     ========================================================================== */
  describe('1. Access Control on GET /api/reports/dashboard', () => {
    it('should allow Administrator to access the dashboard', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data, 'Should contain dashboard data payload');
      assert.ok(res.body.data.summary);
      assert.ok(res.body.data.accountsOverview);
      assert.ok(res.body.data.transactionActivity);
      assert.ok(Array.isArray(res.body.data.recentTransactions));
      assert.ok(res.body.data.attentionItems);
    });

    it('should reject unauthenticated request with 401 AUTH_003', async () => {
      const res = await request(app).get('/api/reports/dashboard');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should reject Employee request with 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject Customer request with 403 AUTH_002', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Cookie', customerCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  /* ==========================================================================
     2. Summary Cards Data Accuracy
     ========================================================================== */
  describe('2. Summary Cards Database Record Matching', () => {
    it('should accurately match customer and account counts from database', async () => {
      const [custRows] = await pool.execute(`
        SELECT 
          COUNT(*) AS totalCustomers,
          SUM(CASE WHEN u.status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeCustomers,
          SUM(CASE WHEN u.status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactiveCustomers
        FROM customers c
        JOIN users u ON c.user_id = u.user_id
      `);

      const [accRows] = await pool.execute(`
        SELECT 
          COUNT(*) AS totalAccounts,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeAccounts,
          SUM(CASE WHEN status = 'FROZEN' THEN 1 ELSE 0 END) AS frozenAccounts,
          SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactiveAccounts,
          COALESCE(SUM(balance), 0.00) AS totalBalance
        FROM accounts
      `);

      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const { summary } = res.body.data;

      assert.equal(summary.totalCustomers, Number(custRows[0].totalCustomers));
      assert.equal(summary.activeCustomers, Number(custRows[0].activeCustomers));
      assert.equal(summary.inactiveCustomers, Number(custRows[0].inactiveCustomers));

      assert.equal(summary.totalAccounts, Number(accRows[0].totalAccounts));
      assert.equal(summary.activeAccounts, Number(accRows[0].activeAccounts));
      assert.equal(summary.frozenAccounts, Number(accRows[0].frozenAccounts));
      assert.equal(summary.inactiveAccounts, Number(accRows[0].inactiveAccounts));
      assert.equal(summary.totalSystemBalance, Number(accRows[0].totalBalance).toFixed(2));
    });

    it('should accurately calculate transactions today', async () => {
      const [todayRows] = await pool.execute(`
        SELECT 
          COUNT(*) AS cnt,
          COALESCE(SUM(amount), 0.00) AS vol
        FROM bank_transactions
        WHERE DATE(created_at) = CURRENT_DATE()
      `);

      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const { transactionsToday } = res.body.data.summary;
      assert.equal(transactionsToday.count, Number(todayRows[0].cnt));
      assert.equal(transactionsToday.totalVolume, Number(todayRows[0].vol).toFixed(2));
    });
  });

  /* ==========================================================================
     3. Transfer Single-Counting in Dashboard Activity
     ========================================================================== */
  describe('3. Transfer Single-Counting Integrity', () => {
    it('should count a fund transfer EXACTLY ONCE in dashboard transaction metrics', async () => {
      // Step A: Capture pre-transfer dashboard state
      const preRes = await request(app)
        .get('/api/reports/dashboard?period=all')
        .set('Cookie', adminCookie);
      assert.equal(preRes.status, 200);

      const preCount = preRes.body.data.transactionActivity.periodStats.totalCount;
      const preVolume = Number(preRes.body.data.transactionActivity.periodStats.totalVolume);
      const preTrfCount = preRes.body.data.transactionActivity.periodStats.transfers.count;
      const preTrfVol = Number(preRes.body.data.transactionActivity.periodStats.transfers.volume);

      // Step B: Insert single fund transfer between test accounts (₹2,400.00)
      const trfRef = `TXN-DASH-TRF-${Date.now()}`;
      const trfAmount = 2400.00;
      const [insertRes] = await pool.execute(
        `INSERT INTO bank_transactions (
          transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks
        ) VALUES (?, 'TRANSFER', ?, ?, ?, 1, 'Dashboard single-counting test transfer')`,
        [trfRef, trfAmount, testSenderAccId, testRecipientAccId]
      );
      createdTransactionIds.push(insertRes.insertId);

      // Step C: Fetch dashboard state after transfer
      const postRes = await request(app)
        .get('/api/reports/dashboard?period=all')
        .set('Cookie', adminCookie);
      assert.equal(postRes.status, 200);

      const postCount = postRes.body.data.transactionActivity.periodStats.totalCount;
      const postVolume = Number(postRes.body.data.transactionActivity.periodStats.totalVolume);
      const postTrfCount = postRes.body.data.transactionActivity.periodStats.transfers.count;
      const postTrfVol = Number(postRes.body.data.transactionActivity.periodStats.transfers.volume);

      // Step D: Verify exact increment (Increment by 1, NOT 2; Volume by ₹2,400.00, NOT ₹4,800.00)
      assert.equal(postCount, preCount + 1, 'Dashboard totalCount must increment by exactly 1');
      assert.equal(postTrfCount, preTrfCount + 1, 'Transfer count must increment by exactly 1');
      assert.equal(postVolume.toFixed(2), (preVolume + trfAmount).toFixed(2), 'Total volume must increment by exactly transfer amount');
      assert.equal(postTrfVol.toFixed(2), (preTrfVol + trfAmount).toFixed(2), 'Transfer volume must increment by exactly transfer amount');
    });
  });

  /* ==========================================================================
     4. Date Filters and Period Presets
     ========================================================================== */
  describe('4. Time Filters and Validation', () => {
    it('should support preset period filters (today, 7d, 30d, all)', async () => {
      const presets = ['today', '7d', '30d', 'all'];
      for (const p of presets) {
        const res = await request(app)
          .get(`/api/reports/dashboard?period=${p}`)
          .set('Cookie', adminCookie);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data.transactionActivity.periodStats);
      }
    });

    it('should support explicit startDate and endDate filters', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/reports/dashboard?startDate=${today}&endDate=${today}`)
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.filter.startDate, today);
      assert.equal(res.body.data.filter.endDate, today);
    });

    it('should handle future date filters with clean zero/empty structures', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard?startDate=2099-01-01&endDate=2099-01-02')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.transactionActivity.periodStats.totalCount, 0);
      assert.equal(res.body.data.transactionActivity.periodStats.totalVolume, '0.00');
      assert.equal(res.body.data.transactionActivity.dailyActivity.length, 0);
    });

    it('should reject malformed startDate with VAL_001 (400)', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard?startDate=not-a-date')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject when startDate is chronologically after endDate with VAL_001 (400)', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard?startDate=2026-11-04&endDate=2026-11-01')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });
  });

  /* ==========================================================================
     5. Recent Transactions and Attention Items
     ========================================================================== */
  describe('5. Recent Transactions & Attention Items', () => {
    it('should include performer context without exposing passwords or hashes', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const { recentTransactions } = res.body.data;
      assert.ok(Array.isArray(recentTransactions));

      if (recentTransactions.length > 0) {
        const tx = recentTransactions[0];
        assert.ok(tx.transactionRef);
        assert.ok(tx.type);
        assert.ok(tx.amount);
        assert.ok(tx.performedBy);
        assert.ok(tx.performedBy.username);
        assert.ok(tx.performedBy.role);
        assert.equal(tx.performedBy.password, undefined);
        assert.equal(tx.performedBy.password_hash, undefined);
      }
    });

    it('should include frozen accounts in attentionItems if any exist', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const { frozenAccounts } = res.body.data.attentionItems;
      assert.ok(Array.isArray(frozenAccounts));
      assert.ok(frozenAccounts.length >= 1, 'Should list our test frozen account');
      const match = frozenAccounts.find(a => a.accountNumber === testFrozenAccNumber);
      assert.ok(match, 'Test frozen account must be present in attention items');
      assert.equal(match.balance, '3500.00');
    });
  });

  /* ==========================================================================
     6. Read-Only Verification
     ========================================================================== */
  describe('6. Read-Only Query Verification', () => {
    it('should never mutate account balances or transaction records while querying dashboard', async () => {
      const [accBefore] = await pool.execute('SELECT account_id, balance FROM accounts ORDER BY account_id ASC');
      const [txnBefore] = await pool.execute('SELECT COUNT(*) AS cnt FROM bank_transactions');

      // Fetch dashboard repeatedly
      await Promise.all([
        request(app).get('/api/reports/dashboard?period=today').set('Cookie', adminCookie),
        request(app).get('/api/reports/dashboard?period=7d').set('Cookie', adminCookie),
        request(app).get('/api/reports/dashboard?period=all').set('Cookie', adminCookie)
      ]);

      const [accAfter] = await pool.execute('SELECT account_id, balance FROM accounts ORDER BY account_id ASC');
      const [txnAfter] = await pool.execute('SELECT COUNT(*) AS cnt FROM bank_transactions');

      assert.equal(accBefore.length, accAfter.length);
      for (let i = 0; i < accBefore.length; i++) {
        assert.equal(
          Number(accBefore[i].balance).toFixed(2),
          Number(accAfter[i].balance).toFixed(2),
          `Account ${accBefore[i].account_id} balance must remain completely unchanged`
        );
      }
      assert.equal(txnBefore[0].cnt, txnAfter[0].cnt);
    });
  });
});

