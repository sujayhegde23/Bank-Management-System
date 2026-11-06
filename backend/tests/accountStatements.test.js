/**
 * Automated Integration Test Suite: Customer Bank Account Statements Enhancement (Feature 4)
 * Repository: sujayhegde23/Bank-Management-System
 *
 * Verifies all 15 Section 10 Scenarios:
 * 1. Customer can access their own statement.
 * 2. Customer cannot access another customer's statement.
 * 3. Date filters work (all, 7d, 30d, 90d, custom, validation).
 * 4. Opening balance is accurate.
 * 5. Closing balance is accurate.
 * 6. Deposits are represented correctly (CREDIT, CASH DEPOSIT).
 * 7. Withdrawals are represented correctly (DEBIT, CASH WITHDRAWAL).
 * 8. Incoming transfers are represented correctly (CREDIT, TRANSFER IN, counterparty).
 * 9. Outgoing transfers are represented correctly (DEBIT, TRANSFER OUT, counterparty).
 * 10. Summary totals match transaction rows.
 * 11. Empty statements work cleanly.
 * 12. PDF export structure works.
 * 13. CSV export works.
 * 14. Large statements work (pagination).
 * 15. Statement generation does not modify account balances.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { query, pool, testConnection } = require('../src/config/db');

const TEST_PASSWORD = 'Password123!';

describe('Feature 4: Customer Account Statements Enhancement Integration Tests', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customer1Cookie = null;
  let customer2Cookie = null;

  let account1Id = null;
  let account1Number = null;
  let account2Id = null;
  let account2Number = null;

  let dep1Timestamp = null;
  let wthTimestamp = null;
  let trfTimestamp = null;
  let dep2Timestamp = null;

  const createdAccountIds = [];

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // 1. Log in as test Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.admin1', password: TEST_PASSWORD });
    assert.equal(adminRes.status, 200);
    adminCookie = adminRes.headers['set-cookie'];

    // 2. Log in as test Employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.employee1', password: TEST_PASSWORD });
    assert.equal(empRes.status, 200);
    employeeCookie = empRes.headers['set-cookie'];

    // 3. Log in as Customer 1 (customer_id: 1)
    const cust1Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(cust1Res.status, 200);
    customer1Cookie = cust1Res.headers['set-cookie'];

    // 4. Log in as Customer 2 (customer_id: 2)
    const cust2Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });
    assert.equal(cust2Res.status, 200);
    customer2Cookie = cust2Res.headers['set-cookie'];

    // 5. Create Account 1 for Customer 1
    const create1 = await request(app)
      .post('/api/accounts')
      .set('Cookie', employeeCookie)
      .send({ customerId: 1, accountType: 'SAVINGS' });
    assert.equal(create1.status, 201);
    account1Id = create1.body.data.accountId;
    account1Number = create1.body.data.accountNumber;
    createdAccountIds.push(account1Id);

    // 6. Create Account 2 for Customer 2
    const create2 = await request(app)
      .post('/api/accounts')
      .set('Cookie', employeeCookie)
      .send({ customerId: 2, accountType: 'CURRENT' });
    assert.equal(create2.status, 201);
    account2Id = create2.body.data.accountId;
    account2Number = create2.body.data.accountNumber;
    createdAccountIds.push(account2Id);

    // Sequence of operations on Account 1:
    // Txn 1: Cash Deposit +5000.00 (two days ago)
    const dep1Res = await request(app)
      .post(`/api/accounts/${account1Id}/deposits`)
      .set('Cookie', employeeCookie)
      .send({ amount: 5000.00, remarks: 'Opening payroll deposit' });
    assert.equal(dep1Res.status, 201);
    const dep1Id = dep1Res.body.data.transactionId;
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await query('UPDATE bank_transactions SET created_at = ? WHERE transaction_id = ?', [twoDaysAgo, dep1Id]);
    dep1Timestamp = twoDaysAgo;

    // Txn 2: Cash Withdrawal -1000.00 (Balance now: 4000.00)
    const wthRes = await request(app)
      .post(`/api/accounts/${account1Id}/withdrawals`)
      .set('Cookie', employeeCookie)
      .send({ amount: 1000.00, remarks: 'ATM branch withdrawal' });
    assert.equal(wthRes.status, 201);
    wthTimestamp = new Date(wthRes.body.data.timestamp);

    // Txn 3: Fund Transfer from Account 1 to Account 2: 1500.00
    // (Acc 1 now: 2500.00, Acc 2 now: 1500.00)
    const trfRes = await request(app)
      .post(`/api/accounts/${account1Id}/transfers`)
      .set('Cookie', customer1Cookie)
      .send({
        destinationAccountId: account2Id,
        amount: 1500.00,
        remarks: 'Consulting invoice payment'
      });
    assert.equal(trfRes.status, 201);
    trfTimestamp = new Date(trfRes.body.data.timestamp);

    // Txn 4: Cash Deposit +500.00 (Acc 1 final balance: 3000.00)
    const dep2Res = await request(app)
      .post(`/api/accounts/${account1Id}/deposits`)
      .set('Cookie', employeeCookie)
      .send({ amount: 500.00, remarks: 'Bonus deposit' });
    assert.equal(dep2Res.status, 201);
    dep2Timestamp = new Date(dep2Res.body.data.timestamp);
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
  // Scenario 1: Customer can access their own statement
  // ============================================================================
  it('Scenario 1: Customer can access their own statement', async () => {
    const res = await request(app)
      .get(`/api/accounts/${account1Id}/statement`)
      .set('Cookie', customer1Cookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.account.accountId, account1Id);
    assert.equal(res.body.data.customer.customerId, 1);
    assert.equal(res.body.data.customer.customerName, 'Test Customer One');
  });

  // ============================================================================
  // Scenario 2: Customer cannot access another customer's statement
  // ============================================================================
  it('Scenario 2: Customer cannot access another customer\'s statement (AUTH_002)', async () => {
    // Customer 2 tries to access Customer 1's Account 1
    const res = await request(app)
      .get(`/api/accounts/${account1Id}/statement`)
      .set('Cookie', customer2Cookie);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorCode, 'AUTH_002');
  });

  // ============================================================================
  // Scenario 3: Date filters work
  // ============================================================================
  it('Scenario 3: Date filters work (all, 7d, 30d, 90d, custom, validation)', async () => {
    // 3a. Preset: all
    const allRes = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all`)
      .set('Cookie', customer1Cookie);
    assert.equal(allRes.status, 200);
    assert.equal(allRes.body.data.period.preset, 'all');
    assert.equal(allRes.body.data.summary.transactionCount, 4);

    // 3b. Preset: 7d
    const res7d = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=7d`)
      .set('Cookie', customer1Cookie);
    assert.equal(res7d.status, 200);
    assert.equal(res7d.body.data.period.preset, '7d');

    // 3c. Preset: 30d
    const res30d = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=30d`)
      .set('Cookie', customer1Cookie);
    assert.equal(res30d.status, 200);
    assert.equal(res30d.body.data.period.preset, '30d');

    // 3d. Preset: 90d
    const res90d = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=90d`)
      .set('Cookie', customer1Cookie);
    assert.equal(res90d.status, 200);
    assert.equal(res90d.body.data.period.preset, '90d');

    // 3e. Custom range: invalid where start date > end date
    const errRes = await request(app)
      .get(`/api/accounts/${account1Id}/statement?from=2026-12-01&to=2026-11-01`)
      .set('Cookie', customer1Cookie);
    assert.equal(errRes.status, 400);
    assert.equal(errRes.body.errorCode, 'VAL_001');
  });

  // ============================================================================
  // Scenario 4: Opening balance is accurate
  // ============================================================================
  it('Scenario 4: Opening balance is accurate across date boundaries', async () => {
    // For 'all' history from inception, openingBalance is 0.00
    const allRes = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all`)
      .set('Cookie', customer1Cookie);
    assert.equal(allRes.body.data.summary.openingBalance, 0.00);

    // If we request a period starting AFTER Txn 1 (deposit of 5000), opening balance must equal 5000.00
    const fromIso = new Date(dep1Timestamp.getTime() + 1000).toISOString();
    const rangeRes = await request(app)
      .get(`/api/accounts/${account1Id}/statement?from=${fromIso}`)
      .set('Cookie', customer1Cookie);
    assert.equal(rangeRes.status, 200);
    assert.equal(rangeRes.body.data.summary.openingBalance, 5000.00);
  });

  // ============================================================================
  // Scenario 5: Closing balance is accurate
  // ============================================================================
  it('Scenario 5: Closing balance is accurate and matches Opening + Net Change', async () => {
    const res = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all`)
      .set('Cookie', customer1Cookie);

    assert.equal(res.status, 200);
    const { summary } = res.body.data;
    // Expected: 0 (opening) + 5500 (credits) - 2500 (debits) = 3000.00
    assert.equal(summary.openingBalance, 0.00);
    assert.equal(summary.totalCredits, 5500.00);
    assert.equal(summary.totalDebits, 2500.00);
    assert.equal(summary.netChange, 3000.00);
    assert.equal(summary.closingBalance, 3000.00);
  });

  // ============================================================================
  // Scenario 6: Deposits are represented correctly
  // ============================================================================
  it('Scenario 6: Deposits are represented correctly (CREDIT, CASH DEPOSIT)', async () => {
    const res = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all`)
      .set('Cookie', customer1Cookie);

    assert.equal(res.status, 200);
    const deposits = res.body.data.transactions.filter((t) => t.rawType === 'DEPOSIT');
    assert.equal(deposits.length, 2);

    for (const d of deposits) {
      assert.equal(d.direction, 'CREDIT');
      assert.equal(d.type, 'CASH DEPOSIT');
      assert.ok(d.credit > 0);
      assert.equal(d.debit, null);
      assert.ok(d.description);
    }
    assert.equal(res.body.data.summary.totalDeposits, 5500.00);
    assert.equal(res.body.data.summary.depositCount, 2);
  });

  // ============================================================================
  // Scenario 7: Withdrawals are represented correctly
  // ============================================================================
  it('Scenario 7: Withdrawals are represented correctly (DEBIT, CASH WITHDRAWAL)', async () => {
    const res = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all`)
      .set('Cookie', customer1Cookie);

    assert.equal(res.status, 200);
    const withdrawals = res.body.data.transactions.filter((t) => t.rawType === 'WITHDRAWAL');
    assert.equal(withdrawals.length, 1);

    const w = withdrawals[0];
    assert.equal(w.direction, 'DEBIT');
    assert.equal(w.type, 'CASH WITHDRAWAL');
    assert.equal(w.debit, 1000.00);
    assert.equal(w.credit, null);
    assert.ok(w.description.includes('ATM branch withdrawal'));
    assert.equal(res.body.data.summary.totalWithdrawals, 1000.00);
    assert.equal(res.body.data.summary.withdrawalCount, 1);
  });

  // ============================================================================
  // Scenario 8: Incoming transfers are represented correctly
  // ============================================================================
  it('Scenario 8: Incoming transfers are represented correctly (CREDIT, TRANSFER IN, counterparty)', async () => {
    // Account 2 received 1500 from Account 1
    const res = await request(app)
      .get(`/api/accounts/${account2Id}/statement?preset=all`)
      .set('Cookie', customer2Cookie);

    assert.equal(res.status, 200);
    const inTransfers = res.body.data.transactions.filter((t) => t.type === 'TRANSFER IN');
    assert.equal(inTransfers.length, 1);

    const inTx = inTransfers[0];
    assert.equal(inTx.direction, 'CREDIT');
    assert.equal(inTx.credit, 1500.00);
    assert.equal(inTx.debit, null);
    assert.ok(inTx.counterpartyAccount === account1Number);
    assert.ok(inTx.description.includes(account1Number));

    // Summary matches
    assert.equal(res.body.data.summary.totalTransfersIn, 1500.00);
    assert.equal(res.body.data.summary.transferInCount, 1);
    assert.equal(res.body.data.summary.incomingTransfers, 1500.00);
  });

  // ============================================================================
  // Scenario 9: Outgoing transfers are represented correctly
  // ============================================================================
  it('Scenario 9: Outgoing transfers are represented correctly (DEBIT, TRANSFER OUT, counterparty)', async () => {
    // Account 1 sent 1500 to Account 2
    const res = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all`)
      .set('Cookie', customer1Cookie);

    assert.equal(res.status, 200);
    const outTransfers = res.body.data.transactions.filter((t) => t.type === 'TRANSFER OUT');
    assert.equal(outTransfers.length, 1);

    const outTx = outTransfers[0];
    assert.equal(outTx.direction, 'DEBIT');
    assert.equal(outTx.debit, 1500.00);
    assert.equal(outTx.credit, null);
    assert.ok(outTx.counterpartyAccount === account2Number);
    assert.ok(outTx.description.includes(account2Number));

    // Summary matches
    assert.equal(res.body.data.summary.totalTransfersOut, 1500.00);
    assert.equal(res.body.data.summary.transferOutCount, 1);
    assert.equal(res.body.data.summary.outgoingTransfers, 1500.00);
  });

  // ============================================================================
  // Scenario 10: Summary totals match transaction rows
  // ============================================================================
  it('Scenario 10: Summary totals match transaction rows exactly', async () => {
    const res = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all`)
      .set('Cookie', customer1Cookie);

    assert.equal(res.status, 200);
    const { summary, transactions } = res.body.data;

    const rowCredits = transactions.reduce((acc, t) => acc + (t.credit || 0), 0);
    const rowDebits = transactions.reduce((acc, t) => acc + (t.debit || 0), 0);

    assert.equal(Number(rowCredits.toFixed(2)), summary.totalCredits);
    assert.equal(Number(rowDebits.toFixed(2)), summary.totalDebits);
    assert.equal(Number((summary.openingBalance + rowCredits - rowDebits).toFixed(2)), summary.closingBalance);
  });

  // ============================================================================
  // Scenario 11: Empty statements work
  // ============================================================================
  it('Scenario 11: Empty statements work cleanly with zero transactions', async () => {
    const res = await request(app)
      .get(`/api/accounts/${account1Id}/statement?from=2099-01-01&to=2099-01-31`)
      .set('Cookie', customer1Cookie);

    assert.equal(res.status, 200);
    const { summary, transactions } = res.body.data;

    assert.equal(transactions.length, 0);
    assert.equal(summary.transactionCount, 0);
    assert.equal(summary.totalCredits, 0);
    assert.equal(summary.totalDebits, 0);
    assert.equal(summary.openingBalance, summary.closingBalance);
  });

  // ============================================================================
  // Scenario 12: PDF export works
  // ============================================================================
  it('Scenario 12: PDF export data structure and document requirements', async () => {
    const res = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all`)
      .set('Cookie', customer1Cookie);

    assert.equal(res.status, 200);
    const data = res.body.data;

    // CORE BANK branding
    assert.equal(data.header.institutionName, 'CORE BANK');
    assert.equal(data.header.documentTitle, 'ACCOUNT STATEMENT');
    assert.ok(data.header.generatedAt);

    // Customer & Account details
    assert.ok(data.customer.customerName);
    assert.ok(data.account.accountNumber);
    assert.ok(data.account.accountType);

    // Statement period
    assert.ok(data.period.fromFormatted);
    assert.ok(data.period.toFormatted);

    // Balance summary
    assert.ok(data.summary.openingBalance !== undefined);
    assert.ok(data.summary.closingBalance !== undefined);
    assert.ok(data.summary.totalCredits !== undefined);
    assert.ok(data.summary.totalDebits !== undefined);

    // Transaction table
    assert.ok(Array.isArray(data.transactions));
    assert.ok(data.transactions.length > 0);
  });

  // ============================================================================
  // Scenario 13: CSV export works
  // ============================================================================
  it('Scenario 13: CSV export works via ?format=csv and dedicated /statement/csv endpoint', async () => {
    // 13a. Query parameter format=csv
    const res1 = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all&format=csv`)
      .set('Cookie', customer1Cookie);

    assert.equal(res1.status, 200);
    assert.ok(res1.headers['content-type'].includes('text/csv'));
    assert.ok(res1.headers['content-disposition'].includes('attachment; filename='));
    assert.ok(res1.text.startsWith('\uFEFF')); // Excel BOM
    assert.ok(res1.text.includes('CORE BANK'));
    assert.ok(res1.text.includes(account1Number));
    assert.ok(res1.text.includes('Opening Balance'));
    assert.ok(res1.text.includes('Closing Balance'));

    // 13b. Dedicated endpoint /statement/csv
    const res2 = await request(app)
      .get(`/api/accounts/${account1Id}/statement/csv?preset=all`)
      .set('Cookie', customer1Cookie);

    assert.equal(res2.status, 200);
    assert.ok(res2.headers['content-type'].includes('text/csv'));
    assert.ok(res2.text.includes(account1Number));
  });

  // ============================================================================
  // Scenario 14: Large statements work (pagination)
  // ============================================================================
  it('Scenario 14: Large statements work with server pagination support', async () => {
    // Total transactions = 4. Test page=1, limit=2
    const page1Res = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all&page=1&limit=2`)
      .set('Cookie', customer1Cookie);

    assert.equal(page1Res.status, 200);
    assert.equal(page1Res.body.data.transactions.length, 2);
    assert.equal(page1Res.body.data.pagination.page, 1);
    assert.equal(page1Res.body.data.pagination.limit, 2);
    assert.equal(page1Res.body.data.pagination.total, 4);
    assert.equal(page1Res.body.data.pagination.totalPages, 2);

    // Page 2
    const page2Res = await request(app)
      .get(`/api/accounts/${account1Id}/statement?preset=all&page=2&limit=2`)
      .set('Cookie', customer1Cookie);

    assert.equal(page2Res.status, 200);
    assert.equal(page2Res.body.data.transactions.length, 2);
    assert.equal(page2Res.body.data.pagination.page, 2);

    // Verify transactions are sliced sequentially
    assert.notEqual(
      page1Res.body.data.transactions[0].transactionId,
      page2Res.body.data.transactions[0].transactionId
    );

    // Summary totals remain complete for the period
    assert.equal(page1Res.body.data.summary.closingBalance, 3000.00);
    assert.equal(page2Res.body.data.summary.closingBalance, 3000.00);
  });

  // ============================================================================
  // Scenario 15: Statement generation does not modify account balances
  // ============================================================================
  it('Scenario 15: Statement generation does not modify account balances', async () => {
    const beforeRow = await query('SELECT balance FROM accounts WHERE account_id = ?', [account1Id]);
    const balanceBefore = Number(beforeRow[0].balance);

    // Run multiple statement generation queries
    await request(app).get(`/api/accounts/${account1Id}/statement?preset=7d`).set('Cookie', customer1Cookie);
    await request(app).get(`/api/accounts/${account1Id}/statement?preset=30d`).set('Cookie', customer1Cookie);
    await request(app).get(`/api/accounts/${account1Id}/statement?format=csv`).set('Cookie', customer1Cookie);
    await request(app).get(`/api/accounts/${account1Id}/statement/csv`).set('Cookie', customer1Cookie);
    await request(app).get(`/api/accounts/${account1Id}/statement?preset=all`).set('Cookie', adminCookie);

    const afterRow = await query('SELECT balance FROM accounts WHERE account_id = ?', [account1Id]);
    const balanceAfter = Number(afterRow[0].balance);

    assert.equal(balanceAfter, balanceBefore, 'Account balance must remain 100% invariant across statement queries');
  });
});
