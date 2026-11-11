/**
 * ==============================================================================
 * Administrator Report Export Integration Test Suite (Feature 4)
 * ==============================================================================
 * Comprehensive test verification for Feature 4:
 * - Admin-only authorization & rejection of Customer / Employee / Unauthenticated roles.
 * - Accurate RFC 4180 CSV export generation for Customers, Accounts, Transactions, Overview.
 * - Proper escaping of quotes, commas, and newlines in text fields.
 * - Single-counting of fund transfers (zero double-counting in count or volume).
 * - Date range filtering and correct handling of empty report ranges.
 * - Strict exclusion of sensitive credentials (passwords, hashes, tokens, session IDs).
 * - Verification that exports perform strictly read-only analytical queries without data mutation.
 * - Audit log event generation for compliance.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, testConnection } = require('../src/config/db');
const { loginAs } = require('./helpers/authHelper');

const TEST_PASSWORD = 'Password123!';

describe('Feature 4: Administrator Report Export Suite', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customerCookie = null;

  // Track created fixtures for teardown
  const createdUserIds = [];
  const createdCustomerIds = [];
  const createdAccountIds = [];
  const createdTransactionIds = [];

  let testAccAId = null;
  let testAccBId = null;
  let testAccANumber = null;
  let testAccBNumber = null;
  let transferTxnRef = null;
  let depositTxnRef = null;
  let specialRemark = null;

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

    // Create a special customer with commas and quotes in name for RFC 4180 escaping verification
    const now = Date.now();
    const specialUsername = `test.special.${now}`;
    const [uRes] = await pool.execute(
      `INSERT INTO users (username, password_hash, role, status)
       VALUES (?, '$2a$10$abcdefghijklmnopqrstuuEXAMPLEHASHNOTREAL', 'CUSTOMER', 'ACTIVE')`,
      [specialUsername]
    );
    const specialUserId = uRes.insertId;
    createdUserIds.push(specialUserId);

    const specialFullName = `O'Connor, "Tim" Jr., Esq.`;
    const [cRes] = await pool.execute(
      `INSERT INTO customers (user_id, full_name, date_of_birth, phone, email, address)
       VALUES (?, ?, '1990-05-15', ?, ?, '123 Baker Street, Test City')`,
      [specialUserId, specialFullName, `987${String(now).slice(-7)}`, `special.${now}@example.com`]
    );
    const specialCustomerId = cRes.insertId;
    createdCustomerIds.push(specialCustomerId);

    // Setup isolated test accounts for transfer single-counting
    testAccANumber = `ACC-EXP-A-${now}`;
    testAccBNumber = `ACC-EXP-B-${now}`;

    const [a1] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, ?, 'SAVINGS', 25000.00, 'ACTIVE')`,
      [testAccANumber, specialCustomerId]
    );
    testAccAId = a1.insertId;
    createdAccountIds.push(testAccAId);

    const [a2] = await pool.execute(
      `INSERT INTO accounts (account_number, customer_id, account_type, balance, status)
       VALUES (?, 1, 'CURRENT', 10000.00, 'ACTIVE')`,
      [testAccBNumber]
    );
    testAccBId = a2.insertId;
    createdAccountIds.push(testAccBId);

    // Create isolated transactions with special characters in remarks
    specialRemark = `Branch teller #5, note: "Urgent wire"\nSecond line of remarks`;
    transferTxnRef = `TXN-EXP-TRF-${now}`;
    const [t1] = await pool.execute(
      `INSERT INTO bank_transactions 
       (transaction_ref, source_account_id, destination_account_id, type, amount, performed_by_user_id, remarks, created_at)
       VALUES (?, ?, ?, 'TRANSFER', 5000.00, 1, ?, NOW())`,
      [transferTxnRef, testAccAId, testAccBId, specialRemark]
    );
    createdTransactionIds.push(t1.insertId);

    depositTxnRef = `TXN-EXP-DEP-${now}`;
    const [t2] = await pool.execute(
      `INSERT INTO bank_transactions 
       (transaction_ref, source_account_id, destination_account_id, type, amount, performed_by_user_id, remarks, created_at)
       VALUES (?, NULL, ?, 'DEPOSIT', 7500.00, 1, 'Cash counter deposit, ref: #42', NOW())`,
      [depositTxnRef, testAccAId]
    );
    createdTransactionIds.push(t2.insertId);
  });

  after(async () => {
    try {
      if (createdTransactionIds.length > 0) {
        const ph = createdTransactionIds.map(() => '?').join(',');
        await pool.execute(`DELETE FROM fraud_outbox_events WHERE transaction_id IN (${ph})`, createdTransactionIds).catch(() => {});
        await pool.execute(`DELETE FROM bank_transactions WHERE transaction_id IN (${ph})`, createdTransactionIds);
      }
      if (createdAccountIds.length > 0) {
        const ph = createdAccountIds.map(() => '?').join(',');
        await pool.execute(`DELETE FROM accounts WHERE account_id IN (${ph})`, createdAccountIds);
      }
      if (createdCustomerIds.length > 0) {
        const ph = createdCustomerIds.map(() => '?').join(',');
        await pool.execute(`DELETE FROM customers WHERE customer_id IN (${ph})`, createdCustomerIds);
      }
      if (createdUserIds.length > 0) {
        const ph = createdUserIds.map(() => '?').join(',');
        await pool.execute(`DELETE FROM users WHERE user_id IN (${ph})`, createdUserIds);
      }
    } catch (err) {
      console.warn('Test cleanup warning:', err.message);
    } finally {
      await pool.end();
    }
  });

  // ============================================================================
  // 1. Role-Based Access Control & Security
  // ============================================================================
  describe('1. Role-Based Access Control & Security (AUTH_002, AUTH_003)', () => {
    it('should reject unauthenticated export requests with HTTP 401 AUTH_003', async () => {
      const endpoints = [
        '/api/reports/export/customers',
        '/api/reports/export/accounts',
        '/api/reports/export/transactions',
        '/api/reports/export/overview',
        '/api/reports/export/all',
        '/api/reports/export?type=transactions'
      ];

      for (const ep of endpoints) {
        const res = await request(app).get(ep);
        assert.equal(res.status, 401, `Endpoint ${ep} must require authentication`);
        assert.equal(res.body.errorCode, 'AUTH_003');
      }
    });

    it('should forbid Customer role from exporting reports with HTTP 403 AUTH_002', async () => {
      const endpoints = [
        '/api/reports/export/customers',
        '/api/reports/export/accounts',
        '/api/reports/export/transactions',
        '/api/reports/export/overview',
        '/api/reports/export/all'
      ];

      for (const ep of endpoints) {
        const res = await request(app)
          .get(ep)
          .set('Cookie', customerCookie);
        assert.equal(res.status, 403, `Customer must be forbidden from ${ep}`);
        assert.equal(res.body.errorCode, 'AUTH_002');
      }
    });

    it('should forbid Employee role from exporting reports with HTTP 403 AUTH_002', async () => {
      const endpoints = [
        '/api/reports/export/customers',
        '/api/reports/export/accounts',
        '/api/reports/export/transactions',
        '/api/reports/export/overview',
        '/api/reports/export/all'
      ];

      for (const ep of endpoints) {
        const res = await request(app)
          .get(ep)
          .set('Cookie', employeeCookie);
        assert.equal(res.status, 403, `Employee must be forbidden from ${ep}`);
        assert.equal(res.body.errorCode, 'AUTH_002');
      }
    });

    it('should allow Administrator to export reports with HTTP 200 and text/csv', async () => {
      const res = await request(app)
        .get('/api/reports/export/customers')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/csv'));
      assert.ok(res.headers['content-disposition'].includes('attachment'));
      assert.ok(res.headers['content-disposition'].includes('bank-customer-report-'));
    });
  });

  // ============================================================================
  // 2. Customer Reports CSV Export
  // ============================================================================
  describe('2. Customer Reports CSV Export (RFC 4180, AC-1)', () => {
    it('should return correct CSV headers and customer summary metrics', async () => {
      const res = await request(app)
        .get('/api/reports/export/customers')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const csv = res.text;

      // Header row
      assert.ok(csv.includes('Customer ID,Full Name,Email,Phone,Status,Linked Accounts,Total Balance (INR),Registration Date'));

      // Summary section
      assert.ok(csv.includes('Customer Summary Metric,Value'));
      assert.ok(csv.includes('Total Registered Customers'));
      assert.ok(csv.includes('Active Customers'));
      assert.ok(csv.includes('Inactive Customers'));
      assert.ok(csv.includes('Registrations Today'));
      assert.ok(csv.includes('Registrations Last 7 Days'));
      assert.ok(csv.includes('Registrations Last 30 Days'));
    });

    it('should properly escape special characters (commas, quotes) in customer full name', async () => {
      const res = await request(app)
        .get('/api/reports/export/customers')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const csv = res.text;

      // The customer full name is: O'Connor, "Tim" Jr., Esq.
      // In RFC 4180: "O'Connor, ""Tim"" Jr., Esq."
      assert.ok(
        csv.includes('"O\'Connor, ""Tim"" Jr., Esq."'),
        'Customer full name containing comma and quotes must be properly escaped per RFC 4180'
      );
    });

    it('should strictly exclude sensitive fields (passwords, hashes, tokens, user_id)', async () => {
      const res = await request(app)
        .get('/api/reports/export/customers')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const csv = res.text;

      assert.ok(!csv.includes('password_hash'), 'password_hash must never be exported');
      assert.ok(!csv.includes('EXAMPLEHASHNOTREAL'), 'actual hash values must never be leaked');
      assert.ok(!csv.includes('session'), 'session secrets must not be exposed');
    });

    it('should support scope=records and scope=summary query options', async () => {
      const recordsRes = await request(app)
        .get('/api/reports/export/customers?scope=records')
        .set('Cookie', adminCookie);
      assert.equal(recordsRes.status, 200);
      assert.ok(recordsRes.text.startsWith('Customer ID,Full Name'));
      assert.ok(!recordsRes.text.includes('Customer Summary Metric'));

      const summaryRes = await request(app)
        .get('/api/reports/export/customers?scope=summary')
        .set('Cookie', adminCookie);
      assert.equal(summaryRes.status, 200);
      assert.ok(summaryRes.text.startsWith('Customer Summary Metric,Value'));
      assert.ok(!summaryRes.text.includes('Customer ID,Full Name'));
    });
  });

  // ============================================================================
  // 3. Account Reports CSV Export
  // ============================================================================
  describe('3. Account Reports CSV Export (AC-2)', () => {
    it('should return correct CSV headers, account directory, and aggregate breakdowns', async () => {
      const res = await request(app)
        .get('/api/reports/export/accounts')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const csv = res.text;

      // Headers
      assert.ok(csv.includes('Account Number,Customer ID,Customer Name,Account Type,Status,Balance (INR),Opened Date'));

      // Check test account present
      assert.ok(csv.includes(testAccANumber));
      assert.ok(csv.includes(testAccBNumber));

      // Summary section
      assert.ok(csv.includes('Account Summary Metric,Value'));
      assert.ok(csv.includes('Total Accounts'));
      assert.ok(csv.includes('Total System Balance (INR)'));
      assert.ok(csv.includes('Average Balance (INR)'));
      assert.ok(csv.includes('Savings Accounts Count'));
      assert.ok(csv.includes('Current Accounts Count'));
      assert.ok(csv.includes('Active Accounts Count'));

      // Decimal formatting: balances must have 2 decimals
      assert.ok(csv.includes('.00'));
    });
  });

  // ============================================================================
  // 4. Transaction Reports CSV Export & Single-Counting
  // ============================================================================
  describe('4. Transaction Reports CSV Export & Single-Counting (AC-3, TC-19)', () => {
    it('should count and sum transfers EXACTLY ONCE with zero double-counting', async () => {
      const res = await request(app)
        .get('/api/reports/export/transactions')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const csv = res.text;

      // Check headers
      assert.ok(csv.includes('Transaction Reference,Date & Time,Type,Amount (INR),Source Account,Destination Account,Remarks'));

      // The created transfer should appear in the CSV
      assert.ok(csv.includes(transferTxnRef));

      // In the records table, the transfer reference must appear EXACTLY ONCE
      const matches = csv.match(new RegExp(transferTxnRef, 'g'));
      assert.equal(matches.length, 1, 'Transfer transaction ref must appear exactly once in export (never double-counted)');

      // Verify transfer amount is 5000.00
      assert.ok(csv.includes('5000.00'));

      // Verify deposit is present
      assert.ok(csv.includes(depositTxnRef));
      assert.ok(csv.includes('7500.00'));
    });

    it('should properly escape special characters and newlines in transaction remarks', async () => {
      const res = await request(app)
        .get('/api/reports/export/transactions')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const csv = res.text;

      // specialRemark: Branch teller #5, note: "Urgent wire"\nSecond line of remarks
      // In RFC 4180: "Branch teller #5, note: ""Urgent wire""\nSecond line of remarks"
      assert.ok(
        csv.includes('"Branch teller #5, note: ""Urgent wire""'),
        'Remarks containing quotes and newlines must be quoted and internal quotes doubled'
      );
      assert.ok(
        csv.includes('Second line of remarks'),
        'Multiline remarks must be preserved across newlines within quoted cell'
      );
    });

    it('should correctly filter transactions by date range', async () => {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

      const res = await request(app)
        .get(`/api/reports/export/transactions?startDate=${todayStr}&endDate=${todayStr}`)
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(res.text.includes(transferTxnRef), 'Today transactions must be included');
      assert.ok(res.headers['content-disposition'].includes(todayStr));
    });

    it('should gracefully export an empty report when no transactions match date filter', async () => {
      // Historical date range before system existed
      const res = await request(app)
        .get('/api/reports/export/transactions?startDate=2015-01-01&endDate=2015-01-02')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/csv'));
      const csv = res.text;

      // Headers must still be present
      assert.ok(csv.includes('Transaction Reference,Date & Time,Type,Amount (INR),Source Account,Destination Account,Remarks'));

      // Summary must show 0
      assert.ok(csv.includes('Total Transactions,0'));
      assert.ok(csv.includes('Total Volume (INR),0.00'));

      // Neither test transaction should be present
      assert.ok(!csv.includes(transferTxnRef));
      assert.ok(!csv.includes(depositTxnRef));
    });
  });

  // ============================================================================
  // 5. Executive Overview & Combined Exports
  // ============================================================================
  describe('5. Executive Overview & Combined Export (Overview / All)', () => {
    it('should export executive overview report with system KPIs', async () => {
      const res = await request(app)
        .get('/api/reports/export/overview')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/csv'));
      assert.ok(res.headers['content-disposition'].includes('bank-executive-overview-'));

      const csv = res.text;
      assert.ok(csv.includes('Category,Metric,Value,Notes'));
      assert.ok(csv.includes('Customers,Total Registered Customers'));
      assert.ok(csv.includes('Accounts,Total Accounts'));
      assert.ok(csv.includes('Accounts,Total System Balance (INR)'));
      assert.ok(csv.includes('Transactions,Total Transactions'));
    });

    it('should export all 3 reports in combined bundle via /api/reports/export/all', async () => {
      const res = await request(app)
        .get('/api/reports/export/all')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      const csv = res.text;

      assert.ok(csv.includes('SECTION 1: CUSTOMER REPORT'));
      assert.ok(csv.includes('SECTION 2: ACCOUNT REPORT'));
      assert.ok(csv.includes('SECTION 3: TRANSACTION REPORT'));
    });
  });

  // ============================================================================
  // 6. Input Validation & Error Handling (VAL_001)
  // ============================================================================
  describe('6. Input Validation & Error Handling (VAL_001)', () => {
    it('should reject malformed startDate with HTTP 400 VAL_001', async () => {
      const res = await request(app)
        .get('/api/reports/export/transactions?startDate=2026-99-99')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject malformed endDate with HTTP 400 VAL_001', async () => {
      const res = await request(app)
        .get('/api/reports/export/transactions?endDate=not-a-date')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject inverted date range (startDate > endDate) with HTTP 400 VAL_001', async () => {
      const res = await request(app)
        .get('/api/reports/export/transactions?startDate=2026-12-01&endDate=2026-11-01')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.message.includes('startDate cannot be after endDate'));
    });

    it('should reject unsupported format with HTTP 400 VAL_001', async () => {
      const res = await request(app)
        .get('/api/reports/export/customers?format=xml')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject unknown report category with HTTP 400 VAL_001', async () => {
      const res = await request(app)
        .get('/api/reports/export/unknown-category')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });
  });

  // ============================================================================
  // 7. REST Route Aliases & Compatibility
  // ============================================================================
  describe('7. REST Route Aliases & Compatibility', () => {
    it('should support category-first export routes (/customers/export, etc.)', async () => {
      const r1 = await request(app).get('/api/reports/customers/export').set('Cookie', adminCookie);
      assert.equal(r1.status, 200);
      assert.ok(r1.text.includes('Customer ID,Full Name'));

      const r2 = await request(app).get('/api/reports/accounts/export').set('Cookie', adminCookie);
      assert.equal(r2.status, 200);
      assert.ok(r2.text.includes('Account Number,Customer ID'));

      const r3 = await request(app).get('/api/reports/transactions/export').set('Cookie', adminCookie);
      assert.equal(r3.status, 200);
      assert.ok(r3.text.includes('Transaction Reference,Date & Time'));

      const r4 = await request(app).get('/api/reports/overview/export').set('Cookie', adminCookie);
      assert.equal(r4.status, 200);
      assert.ok(r4.text.includes('Category,Metric,Value,Notes'));
    });

    it('should support generic query parameter route (/export?type=transactions)', async () => {
      const res = await request(app)
        .get('/api/reports/export?type=transactions')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(res.text.includes('Transaction Reference'));
    });
  });

  // ============================================================================
  // 8. Immutability & Audit Logging
  // ============================================================================
  describe('8. Immutability & Audit Logging', () => {
    it('should never mutate account balances or financial records during export', async () => {
      // Query balance before
      const [b1] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testAccAId]);
      const initialBalance = b1[0].balance;

      // Execute export
      await request(app).get('/api/reports/export/transactions').set('Cookie', adminCookie);
      await request(app).get('/api/reports/export/accounts').set('Cookie', adminCookie);
      await request(app).get('/api/reports/export/customers').set('Cookie', adminCookie);

      // Query balance after
      const [b2] = await pool.execute('SELECT balance FROM accounts WHERE account_id = ?', [testAccAId]);
      assert.equal(b2[0].balance, initialBalance, 'Account balances must remain completely unchanged by exports');
    });

    it('should log an audit event for administrative report export', async () => {
      await request(app)
        .get('/api/reports/export/transactions')
        .set('Cookie', adminCookie);

      const [logs] = await pool.execute(
        `SELECT * FROM audit_logs 
         WHERE action_type = 'REPORT_EXPORTED' 
         ORDER BY audit_id DESC LIMIT 1`
      );

      assert.ok(logs.length > 0, 'Audit log entry must be created on report export');
      assert.equal(logs[0].action_type, 'REPORT_EXPORTED');
      assert.equal(logs[0].target_entity_type, 'REPORT');
      assert.equal(logs[0].target_entity_id, 'TRANSACTIONS');
      assert.equal(logs[0].result, 'SUCCESS');
    });
  });
});
