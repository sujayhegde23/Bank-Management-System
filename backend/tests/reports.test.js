/**
 * ==============================================================================
 * Administrator Reports Integration Test Suite (Issue #12)
 * ==============================================================================
 * Verifies:
 * - SRS FR-25: Basic administrative reports for customers, accounts, and transactions.
 * - SRS NFR-03: Data access security & admin-only clearance (AUTH_002, AUTH_003).
 * - SRS NFR-06: Performance (database-level SQL aggregate queries).
 * - SRS NFR-12: Error handling, input validation, and system integrity (VAL_001).
 * - Test Case: TC-19 (View Transaction Records and Generate Report).
 * - Acceptance Criteria AC-1 through AC-5:
 *   * AC-1: Customer reports (totals, status distribution, registration trends, no credential exposure).
 *   * AC-2: Account reports (type/status breakdowns, exact decimal balance sums and averages).
 *   * AC-3: Transaction reports (transfers counted EXACTLY ONCE, no double-counting, date filtering).
 *   * AC-4: Admin-only access enforcement (Customer/Employee 403, unauthenticated 401).
 *   * AC-5: Data accuracy, empty dataset resilience, and zero mutation of balances or ledgers.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, testConnection } = require('../src/config/db');
const { loginAs } = require('./helpers/authHelper');

const TEST_PASSWORD = 'Password123!';

describe('Administrator Reports Suite (Issue #12, FR-25, TC-19)', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customerCookie = null;

  // Track created fixtures for teardown
  const createdAccountIds = [];
  const createdTransactionIds = [];

  let testSenderAccId = null;
  let testRecipientAccId = null;
  let testSenderAccNumber = null;
  let testRecipientAccNumber = null;
  let transferTxnId = null;

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // Authenticate Admin
    adminCookie = await loginAs(request, app, 'test.admin1', TEST_PASSWORD);

    // Authenticate Employee
    employeeCookie = await loginAs(request, app, 'test.employee1', TEST_PASSWORD);

    // Authenticate Customer
    customerCookie = await loginAs(request, app, 'test.customer1', TEST_PASSWORD);

    // Setup isolated test accounts for transfer single-counting verification
    const now = Date.now();
    testSenderAccNumber = `ACC-RPT-S-${now}`;
    testRecipientAccNumber = `ACC-RPT-R-${now}`;

    const [a1] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'SAVINGS', 10000.00, 'ACTIVE')`,
      [testSenderAccNumber]
    );
    testSenderAccId = a1.insertId;
    createdAccountIds.push(testSenderAccId);

    const [a2] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 2, 'CURRENT', 2500.00, 'ACTIVE')`,
      [testRecipientAccNumber]
    );
    testRecipientAccId = a2.insertId;
    createdAccountIds.push(testRecipientAccId);
  });

  after(async () => {
    try {
      // Clean up test transactions and dependent outbox events
      if (createdTransactionIds.length > 0) {
        const placeholders = createdTransactionIds.map(() => '?').join(',');
        await pool.execute(
          `DELETE FROM fraud_outbox_events WHERE transaction_id IN (${placeholders})`,
          createdTransactionIds
        );
        await pool.execute(
          `DELETE FROM bank_transactions WHERE transaction_id IN (${placeholders})`,
          createdTransactionIds
        );
      }
      // Clean up test accounts
      if (createdAccountIds.length > 0) {
        const placeholders = createdAccountIds.map(() => '?').join(',');
        await pool.execute(
          `DELETE FROM accounts WHERE account_id IN (${placeholders})`,
          createdAccountIds
        );
      }
    } catch (cleanupErr) {
      console.error('Error during reports test teardown:', cleanupErr.message);
    } finally {
      await pool.end();
    }
  });

  /* ==========================================================================
     1. Admin Clearance and Overview Reports (FR-25, AC-1, AC-2, AC-3)
     ========================================================================== */
  describe('1. Executive Overview Reports (GET /api/reports/overview)', () => {
    it('should allow Administrator to retrieve the executive overview report', async () => {
      const res = await request(app)
        .get('/api/reports/overview')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data, 'Response should contain data payload');

      const { customers, accounts, transactions, generatedAt } = res.body.data;
      assert.ok(typeof customers.total === 'number');
      assert.ok(typeof customers.active === 'number');
      assert.ok(typeof accounts.total === 'number');
      assert.ok(typeof accounts.totalBalance === 'string');
      assert.ok(typeof transactions.totalCount === 'number');
      assert.ok(typeof transactions.totalVolume === 'string');
      assert.ok(transactions.byType.DEPOSIT);
      assert.ok(transactions.byType.WITHDRAWAL);
      assert.ok(transactions.byType.TRANSFER);
      assert.ok(generatedAt, 'Should include generatedAt timestamp');
    });

    it('should filter overview transaction metrics when date parameters are supplied', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/reports/overview?startDate=${today}&endDate=${today}`)
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.filter.startDate, today);
      assert.equal(res.body.data.filter.endDate, today);
    });
  });

  /* ==========================================================================
     2. Customer Reports (FR-25, AC-1, NFR-03)
     ========================================================================== */
  describe('2. Customer Reports (GET /api/reports/customers)', () => {
    it('should allow Administrator to retrieve customer reporting metrics', async () => {
      const res = await request(app)
        .get('/api/reports/customers')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const { totalCustomers, statusBreakdown, registrationTrends, recentRegistrations } = res.body.data;
      assert.ok(totalCustomers >= 2, 'Should report at least 2 baseline customers');
      assert.ok(typeof statusBreakdown.ACTIVE === 'number');
      assert.ok(typeof statusBreakdown.INACTIVE === 'number');
      assert.equal(totalCustomers, statusBreakdown.ACTIVE + statusBreakdown.INACTIVE);

      assert.ok(typeof registrationTrends.today === 'number');
      assert.ok(typeof registrationTrends.last7Days === 'number');
      assert.ok(typeof registrationTrends.last30Days === 'number');

      assert.ok(Array.isArray(recentRegistrations));
      if (recentRegistrations.length > 0) {
        const sample = recentRegistrations[0];
        assert.ok(sample.customerId);
        assert.ok(sample.fullName);
        assert.ok(sample.email);
        assert.ok(sample.phone);
        assert.ok(sample.createdAt);
        assert.ok(sample.userStatus);
        // Verify sensitive credentials are NEVER exposed (NFR-03, AC-1)
        assert.equal(sample.password_hash, undefined, 'password_hash must never be leaked');
        assert.equal(sample.password, undefined, 'plaintext password must never be leaked');
      }
    });

    it('should accurately match customer counts from direct database records', async () => {
      const [dbCust] = await pool.execute('SELECT COUNT(*) AS total FROM customers');
      const expectedTotal = Number(dbCust[0].total);

      const res = await request(app)
        .get('/api/reports/customers')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.totalCustomers, expectedTotal);
    });
  });

  /* ==========================================================================
     3. Account Reports (FR-25, AC-2)
     ========================================================================== */
  describe('3. Account Reports (GET /api/reports/accounts)', () => {
    it('should allow Administrator to retrieve account reporting metrics and breakdowns', async () => {
      const res = await request(app)
        .get('/api/reports/accounts')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const { totalAccounts, totalBalance, averageBalance, byType, byStatus, topAccounts } = res.body.data;

      assert.ok(totalAccounts >= 2, 'Should reflect test accounts');
      assert.ok(Number(totalBalance) >= 12500.00, 'Should include balance from created test accounts');
      assert.ok(Number(averageBalance) > 0);

      // Verify type breakdown
      assert.ok(byType.SAVINGS);
      assert.ok(byType.CURRENT);
      assert.equal(totalAccounts, byType.SAVINGS.count + byType.CURRENT.count);

      // Verify status breakdown
      assert.ok(byStatus.ACTIVE);
      assert.ok(byStatus.INACTIVE);
      assert.ok(byStatus.FROZEN);
      assert.equal(totalAccounts, byStatus.ACTIVE.count + byStatus.INACTIVE.count + byStatus.FROZEN.count);

      // Verify top accounts
      assert.ok(Array.isArray(topAccounts));
      assert.ok(topAccounts.length > 0);
      assert.ok(topAccounts[0].accountNumber);
      assert.ok(topAccounts[0].balance);
    });

    it('should match underlying database balance calculations exactly', async () => {
      const [accRows] = await pool.execute(
        'SELECT COUNT(*) AS total, COALESCE(SUM(balance), 0.00) AS sumBal FROM accounts'
      );
      const expectedTotal = Number(accRows[0].total);
      const expectedSum = Number(accRows[0].sumBal).toFixed(2);

      const res = await request(app)
        .get('/api/reports/accounts')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.totalAccounts, expectedTotal);
      assert.equal(res.body.data.totalBalance, expectedSum);
    });
  });

  /* ==========================================================================
     4. Transaction Reports & Single-Counting of Transfers (FR-25, AC-3, TC-19)
     ========================================================================== */
  describe('4. Transaction Reports and Transfer Counting Integrity (AC-3, TC-19)', () => {
    it('should allow Administrator to retrieve transaction activity reports', async () => {
      const res = await request(app)
        .get('/api/reports/transactions')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(typeof res.body.data.totalCount === 'number');
      assert.ok(typeof res.body.data.totalVolume === 'string');
      assert.ok(res.body.data.byType.DEPOSIT);
      assert.ok(res.body.data.byType.WITHDRAWAL);
      assert.ok(res.body.data.byType.TRANSFER);
      assert.ok(Array.isArray(res.body.data.dailySummary));
      assert.ok(Array.isArray(res.body.data.largestTransactions));
    });

    it('should count a fund transfer EXACTLY ONCE in global transaction metrics (AC-3, TC-19)', async () => {
      // Step A: Record initial transaction counts and volume
      const preRes = await request(app)
        .get('/api/reports/transactions')
        .set('Cookie', adminCookie);
      assert.equal(preRes.status, 200);
      const preCount = preRes.body.data.totalCount;
      const preVolume = Number(preRes.body.data.totalVolume);
      const preTransferCount = preRes.body.data.byType.TRANSFER.count;
      const preTransferVolume = Number(preRes.body.data.byType.TRANSFER.volume);

      // Step B: Insert a single transfer of ₹1,500.00 between our test accounts
      const transferRef = `TXN-RPT-TRF-${Date.now()}`;
      const transferAmount = 1500.00;
      const [txnInsert] = await pool.execute(
        `INSERT INTO bank_transactions (
          transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks
        ) VALUES (?, 'TRANSFER', ?, ?, ?, 1, 'TC-19 Admin Report Transfer Test')`,
        [transferRef, transferAmount, testSenderAccId, testRecipientAccId]
      );
      transferTxnId = txnInsert.insertId;
      createdTransactionIds.push(transferTxnId);

      // Step C: Fetch report after transfer
      const postRes = await request(app)
        .get('/api/reports/transactions')
        .set('Cookie', adminCookie);
      assert.equal(postRes.status, 200);
      const postCount = postRes.body.data.totalCount;
      const postVolume = Number(postRes.body.data.totalVolume);
      const postTransferCount = postRes.body.data.byType.TRANSFER.count;
      const postTransferVolume = Number(postRes.body.data.byType.TRANSFER.volume);

      // Step D: Verify exact increment (Increment by 1, NOT 2; Volume by 1500.00, NOT 3000.00)
      assert.equal(
        postCount,
        preCount + 1,
        'Global transaction count must increment by exactly 1 for a fund transfer'
      );
      assert.equal(
        postTransferCount,
        preTransferCount + 1,
        'Transfer count must increment by exactly 1'
      );
      assert.equal(
        postVolume.toFixed(2),
        (preVolume + transferAmount).toFixed(2),
        'Global transaction volume must increment by exactly 1,500.00 (not double counted)'
      );
      assert.equal(
        postTransferVolume.toFixed(2),
        (preTransferVolume + transferAmount).toFixed(2),
        'Transfer volume must increment by exactly 1,500.00'
      );
    });

    it('should include and exclude records according to date filters (AC-3, TC-19)', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const futureDate = '2099-12-31';

      // Querying future date range where zero records exist
      const futureRes = await request(app)
        .get(`/api/reports/transactions?startDate=${futureDate}&endDate=${futureDate}`)
        .set('Cookie', adminCookie);

      assert.equal(futureRes.status, 200);
      assert.equal(futureRes.body.data.totalCount, 0);
      assert.equal(futureRes.body.data.totalVolume, '0.00');
      assert.equal(futureRes.body.data.byType.TRANSFER.count, 0);
      assert.equal(futureRes.body.data.byType.TRANSFER.volume, '0.00');
      assert.equal(futureRes.body.data.dailySummary.length, 0);

      // Querying today includes the transfer created above
      const todayRes = await request(app)
        .get(`/api/reports/transactions?startDate=${today}&endDate=${today}`)
        .set('Cookie', adminCookie);

      assert.equal(todayRes.status, 200);
      assert.ok(todayRes.body.data.totalCount >= 1);
      assert.ok(Number(todayRes.body.data.totalVolume) >= 1500.00);
    });
  });

  /* ==========================================================================
     5. Role-Based Access Control and Security (NFR-03, AC-4)
     ========================================================================== */
  describe('5. Role-Based Access Control Enforcement (NFR-03, AC-4)', () => {
    const endpoints = [
      '/api/reports/overview',
      '/api/reports/customers',
      '/api/reports/accounts',
      '/api/reports/transactions'
    ];

    for (const ep of endpoints) {
      it(`should reject unauthenticated request to ${ep} with 401 AUTH_003`, async () => {
        const res = await request(app).get(ep);
        assert.equal(res.status, 401);
        assert.equal(res.body.success, false);
        assert.equal(res.body.errorCode, 'AUTH_003');
      });

      it(`should reject Customer access to ${ep} with 403 AUTH_002`, async () => {
        const res = await request(app)
          .get(ep)
          .set('Cookie', customerCookie);
        assert.equal(res.status, 403);
        assert.equal(res.body.success, false);
        assert.equal(res.body.errorCode, 'AUTH_002');
      });

      it(`should reject Employee access to ${ep} with 403 AUTH_002`, async () => {
        const res = await request(app)
          .get(ep)
          .set('Cookie', employeeCookie);
        assert.equal(res.status, 403);
        assert.equal(res.body.success, false);
        assert.equal(res.body.errorCode, 'AUTH_002');
      });
    }
  });

  /* ==========================================================================
     6. Input Validation and Safe Error Handling (NFR-12)
     ========================================================================== */
  describe('6. Input Validation on Report Filters (NFR-12)', () => {
    it('should reject malformed startDate with VAL_001 (400)', async () => {
      const res = await request(app)
        .get('/api/reports/transactions?startDate=invalid-date')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject malformed endDate with VAL_001 (400)', async () => {
      const res = await request(app)
        .get('/api/reports/transactions?endDate=2026-13-45')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject when startDate is chronologically after endDate with VAL_001 (400)', async () => {
      const res = await request(app)
        .get('/api/reports/transactions?startDate=2026-10-29&endDate=2026-10-20')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VAL_001');
    });
  });

  /* ==========================================================================
     7. Data Immutability & Read-Only Verification (AC-5)
     ========================================================================== */
  describe('7. Data Immutability & Read-Only Verification (AC-5)', () => {
    it('should never mutate account balances or transaction records while running reports', async () => {
      // Capture balances before
      const [accBefore] = await pool.execute('SELECT account_id, balance FROM accounts ORDER BY account_id ASC');
      const [txnBefore] = await pool.execute('SELECT COUNT(*) AS cnt FROM bank_transactions');

      // Execute all report endpoints multiple times
      await Promise.all([
        request(app).get('/api/reports/overview').set('Cookie', adminCookie),
        request(app).get('/api/reports/customers').set('Cookie', adminCookie),
        request(app).get('/api/reports/accounts').set('Cookie', adminCookie),
        request(app).get('/api/reports/transactions').set('Cookie', adminCookie)
      ]);

      // Capture balances after
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
      assert.equal(txnBefore[0].cnt, txnAfter[0].cnt, 'Transaction row count must not change during report queries');
    });
  });
});

