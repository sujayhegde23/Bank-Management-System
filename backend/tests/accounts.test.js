/**
 * ==============================================================================
 * Bank Account Management Integration Test Suite (Issue #7)
 * ==============================================================================
 * Verifies:
 * - SRS FR-07: Create a bank account for a registered customer.
 * - SRS FR-08: Generate a unique account number with collision protection.
 * - SRS FR-09: View account details and balances with customer isolation.
 * - SRS FR-10: Manage account status (ACTIVE, INACTIVE, FROZEN).
 * - SRS FR-11: Prevent transactions on inactive or frozen accounts (eligibility verification).
 * - Non-functional requirements: NFR-03, NFR-16, NFR-18.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool, testConnection } = require('../src/config/db');
const {
  generateUniqueAccountNumber,
  verifyAccountEligibility
} = require('../src/services/accountService');

const TEST_PASSWORD = 'Password123!';

describe('Bank Account Management Suite (Issue #7)', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customerCookie = null;
  let customer2Cookie = null;

  // Track created account IDs for cleanup
  const createdAccountIds = [];

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // Log in as Admin (test.admin1)
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.admin1', password: TEST_PASSWORD });
    assert.equal(adminRes.status, 200);
    adminCookie = adminRes.headers['set-cookie'];

    // Log in as Employee (test.employee1)
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.employee1', password: TEST_PASSWORD });
    assert.equal(empRes.status, 200);
    employeeCookie = empRes.headers['set-cookie'];

    // Log in as Customer 1 (test.customer1 -> customer_id: 1)
    const custRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(custRes.status, 200);
    customerCookie = custRes.headers['set-cookie'];

    // Log in as Customer 2 (test.customer2 -> customer_id: 2)
    const cust2Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });
    assert.equal(cust2Res.status, 200);
    customer2Cookie = cust2Res.headers['set-cookie'];
  });

  after(async () => {
    // Teardown: delete accounts created during tests
    try {
      if (createdAccountIds.length > 0) {
        const placeholders = createdAccountIds.map(() => '?').join(',');
        await pool.execute(`DELETE FROM accounts WHERE account_id IN (${placeholders})`, createdAccountIds);
      }
    } finally {
      await pool.end();
    }
  });

  // ============================================================================
  // 1. Account Creation (FR-07, FR-08, NFR-16, NFR-18)
  // ============================================================================
  describe('1. Account Creation (FR-07, FR-08)', () => {
    it('should allow an authorized employee to create a SAVINGS account for a registered customer', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({
          customerId: 1,
          accountType: 'SAVINGS'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      const acc = res.body.data;
      assert.ok(acc.accountId);
      assert.ok(acc.accountNumber);
      assert.match(acc.accountNumber, /^ACC-SB-\d{8}$/);
      assert.equal(acc.customerId, 1);
      assert.equal(acc.customerName, 'Test Customer One');
      assert.equal(acc.accountType, 'SAVINGS');
      assert.equal(acc.balance, 0.00);
      assert.equal(acc.status, 'ACTIVE');
      createdAccountIds.push(acc.accountId);
    });

    it('should allow an authorized employee to create a CURRENT account', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({
          customerId: 2,
          accountType: 'CURRENT'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      const acc = res.body.data;
      assert.match(acc.accountNumber, /^ACC-CA-\d{8}$/);
      assert.equal(acc.accountType, 'CURRENT');
      assert.equal(acc.balance, 0.00);
      createdAccountIds.push(acc.accountId);
    });

    it('should generate distinct, unique account numbers for multiple accounts (FR-08)', async () => {
      const res1 = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({ customerId: 1, accountType: 'SAVINGS' });

      const res2 = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({ customerId: 1, accountType: 'SAVINGS' });

      assert.equal(res1.status, 201);
      assert.equal(res2.status, 201);
      createdAccountIds.push(res1.body.data.accountId, res2.body.data.accountId);
      assert.notEqual(res1.body.data.accountNumber, res2.body.data.accountNumber);
    });

    it('should reject account creation for nonexistent customer with CUST_001 (404)', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({ customerId: 999999, accountType: 'SAVINGS' });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'CUST_001');
    });

    it('should reject malformed customer ID with VAL_001 (400)', async () => {
      const malformedIds = ['12abc', '1.5', '0', '-5', null, ''];
      for (const badId of malformedIds) {
        const res = await request(app)
          .post('/api/accounts')
          .set('Cookie', employeeCookie)
          .send({ customerId: badId, accountType: 'SAVINGS' });

        assert.equal(res.status, 400);
        assert.equal(res.body.errorCode, 'VAL_001');
      }
    });

    it('should reject invalid account type with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({ customerId: 1, accountType: 'CREDIT_CARD' });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject client-supplied account number with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({
          customerId: 1,
          accountNumber: 'ACC-MY-OWN-NUMBER'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject client-supplied non-zero initial balance with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({
          customerId: 1,
          balance: 5000.00
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject client-supplied account status or account ID with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({
          customerId: 1,
          status: 'INACTIVE',
          accountId: 999
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject account creation by unauthorized roles (CUSTOMER, ADMIN) with AUTH_002 (403)', async () => {
      // Customer attempt
      const custRes = await request(app)
        .post('/api/accounts')
        .set('Cookie', customerCookie)
        .send({ customerId: 1, accountType: 'SAVINGS' });
      assert.equal(custRes.status, 403);
      assert.equal(custRes.body.errorCode, 'AUTH_002');

      // Admin attempt (Account creation is an Employee role responsibility per Architecture §9.2)
      const adminAttempt = await request(app)
        .post('/api/accounts')
        .set('Cookie', adminCookie)
        .send({ customerId: 1, accountType: 'SAVINGS' });
      assert.equal(adminAttempt.status, 403);
      assert.equal(adminAttempt.body.errorCode, 'AUTH_002');
    });

    it('should reject unauthenticated account creation with AUTH_003 (401)', async () => {
      const res = await request(app)
        .post('/api/accounts')
        .send({ customerId: 1, accountType: 'SAVINGS' });
      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });
  });

  // ============================================================================
  // 2. Account Listing and Filtering (FR-09, NFR-03)
  // ============================================================================
  describe('2. Account Listing and Filtering (FR-09)', () => {
    it('should allow Employee to list all bank accounts with customer details', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 4); // baseline seed has at least 4 accounts

      const accT1 = res.body.data.find(a => a.accountNumber === 'ACC-T1');
      assert.ok(accT1);
      assert.equal(accT1.customerName, 'Test Customer One');
      assert.equal(accT1.status, 'ACTIVE');
      assert.equal(accT1.balance, 10000.00);
      assert.equal(accT1.accountType, 'SAVINGS');
      // Ensure no password hashes or sensitive internal fields are exposed
      assert.equal(accT1.password, undefined);
      assert.equal(accT1.password_hash, undefined);
    });

    it('should allow Admin to list all bank accounts', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    });

    it('should allow filtering accounts by status (ACTIVE, INACTIVE, FROZEN)', async () => {
      const activeRes = await request(app)
        .get('/api/accounts?status=ACTIVE')
        .set('Cookie', employeeCookie);
      assert.equal(activeRes.status, 200);
      activeRes.body.data.forEach(a => assert.equal(a.status, 'ACTIVE'));

      const frozenRes = await request(app)
        .get('/api/accounts?status=FROZEN')
        .set('Cookie', employeeCookie);
      assert.equal(frozenRes.status, 200);
      frozenRes.body.data.forEach(a => assert.equal(a.status, 'FROZEN'));

      const inactiveRes = await request(app)
        .get('/api/accounts?status=INACTIVE')
        .set('Cookie', employeeCookie);
      assert.equal(inactiveRes.status, 200);
      inactiveRes.body.data.forEach(a => assert.equal(a.status, 'INACTIVE'));
    });

    it('should allow filtering accounts by accountType (SAVINGS, CURRENT)', async () => {
      const res = await request(app)
        .get('/api/accounts?accountType=SAVINGS')
        .set('Cookie', employeeCookie);
      assert.equal(res.status, 200);
      res.body.data.forEach(a => assert.equal(a.accountType, 'SAVINGS'));
    });

    it('should allow filtering accounts by customerId', async () => {
      const res = await request(app)
        .get('/api/accounts?customerId=1')
        .set('Cookie', employeeCookie);
      assert.equal(res.status, 200);
      res.body.data.forEach(a => assert.equal(a.customerId, 1));
    });

    it('should support search by account number or customer name', async () => {
      const res = await request(app)
        .get('/api/accounts?search=ACC-T1')
        .set('Cookie', employeeCookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.data.length >= 1);
      assert.equal(res.body.data[0].accountNumber, 'ACC-T1');
    });

    it('should enforce data isolation: Customer sees ONLY their own accounts (NFR-03, TC-16)', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Cookie', customerCookie); // Customer 1

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      // All accounts returned must belong strictly to customer_id 1
      res.body.data.forEach(a => {
        assert.equal(a.customerId, 1, `Customer 1 received account ${a.accountNumber} owned by customer ${a.customerId}`);
      });

      // Customer 2's accounts (ACC-T2, ACC-T3) must NEVER be included
      const hasC2Account = res.body.data.some(a => a.accountNumber === 'ACC-T2' || a.accountNumber === 'ACC-T3');
      assert.equal(hasC2Account, false, 'Customer 1 must not see Customer 2 accounts');
    });

    it('should reject Customer attempt to query another customerId with AUTH_002 (403)', async () => {
      const res = await request(app)
        .get('/api/accounts?customerId=2')
        .set('Cookie', customerCookie); // Customer 1 querying customer 2

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ============================================================================
  // 3. Account Details Retrieval (FR-09, NFR-03)
  // ============================================================================
  describe('3. Account Details Retrieval (FR-09)', () => {
    it('should allow Employee to retrieve account details by account ID', async () => {
      const res = await request(app)
        .get('/api/accounts/1')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const acc = res.body.data;
      assert.equal(acc.accountId, 1);
      assert.equal(acc.accountNumber, 'ACC-T1');
      assert.equal(acc.customerId, 1);
      assert.equal(acc.customerName, 'Test Customer One');
      assert.equal(acc.balance, 10000.00);
      assert.equal(acc.status, 'ACTIVE');
    });

    it('should allow Customer to view details of their own account (ACC-T1, ID 1)', async () => {
      const res = await request(app)
        .get('/api/accounts/1')
        .set('Cookie', customerCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.accountNumber, 'ACC-T1');
    });

    it('should reject Customer attempt to view another customer account with AUTH_002 (403) (NFR-03, TC-16)', async () => {
      // Account 2 (ACC-T2) belongs to Customer 2
      const res = await request(app)
        .get('/api/accounts/2')
        .set('Cookie', customerCookie); // Customer 1

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should return ACC_002 (404) for nonexistent account ID', async () => {
      const res = await request(app)
        .get('/api/accounts/999999')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'ACC_002');
    });

    it('should reject malformed account ID with VAL_001 (400)', async () => {
      const badIds = ['12abc', '1.5', '0', '-5', '9007199254740992'];
      for (const id of badIds) {
        const res = await request(app)
          .get(`/api/accounts/${id}`)
          .set('Cookie', employeeCookie);

        assert.equal(res.status, 400);
        assert.equal(res.body.errorCode, 'VAL_001');
      }
    });
  });

  // ============================================================================
  // 4. Account Status Management (FR-10)
  // ============================================================================
  describe('4. Account Status Management (FR-10)', () => {
    let testAccountId = null;

    before(async () => {
      // Create a dedicated account for status testing
      const createRes = await request(app)
        .post('/api/accounts')
        .set('Cookie', employeeCookie)
        .send({ customerId: 1, accountType: 'SAVINGS' });

      assert.equal(createRes.status, 201);
      testAccountId = createRes.body.data.accountId;
      createdAccountIds.push(testAccountId);
    });

    it('should allow Employee to freeze an active account (status -> FROZEN)', async () => {
      const res = await request(app)
        .patch(`/api/accounts/${testAccountId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'FROZEN', reason: 'Security investigation' });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'FROZEN');
      assert.equal(res.body.data.balance, 0.00);

      // Verify persistence via GET
      const verifyRes = await request(app)
        .get(`/api/accounts/${testAccountId}`)
        .set('Cookie', employeeCookie);
      assert.equal(verifyRes.body.data.status, 'FROZEN');
    });

    it('should allow Employee to unfreeze an account (status -> ACTIVE)', async () => {
      const res = await request(app)
        .patch(`/api/accounts/${testAccountId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'ACTIVE', reason: 'Investigation concluded' });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'ACTIVE');
    });

    it('should allow Employee to deactivate an account (status -> INACTIVE)', async () => {
      const res = await request(app)
        .patch(`/api/accounts/${testAccountId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'INACTIVE', reason: 'Customer requested closure' });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'INACTIVE');
    });

    it('should allow Employee to reactivate an inactive account (status -> ACTIVE)', async () => {
      const res = await request(app)
        .patch(`/api/accounts/${testAccountId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'ACTIVE' });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'ACTIVE');
    });

    it('should never modify the balance during status updates', async () => {
      // Baseline account 1 (ACC-T1) has balance 10,000.00
      const res = await request(app)
        .patch('/api/accounts/1/status')
        .set('Cookie', employeeCookie)
        .send({ status: 'ACTIVE' });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.balance, 10000.00);
    });

    it('should reject attempts to manipulate balance via status endpoint with VAL_001 (400)', async () => {
      const res = await request(app)
        .patch(`/api/accounts/${testAccountId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'ACTIVE', balance: 999999.00 });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject invalid status values with VAL_001 (400)', async () => {
      const res = await request(app)
        .patch(`/api/accounts/${testAccountId}/status`)
        .set('Cookie', employeeCookie)
        .send({ status: 'CLOSED_PERMANENTLY' });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should return ACC_002 (404) for status update on nonexistent account', async () => {
      const res = await request(app)
        .patch('/api/accounts/999999/status')
        .set('Cookie', employeeCookie)
        .send({ status: 'FROZEN' });

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'ACC_002');
    });

    it('should reject status update by unauthorized roles (CUSTOMER, ADMIN) with AUTH_002 (403)', async () => {
      const custRes = await request(app)
        .patch(`/api/accounts/${testAccountId}/status`)
        .set('Cookie', customerCookie)
        .send({ status: 'ACTIVE' });
      assert.equal(custRes.status, 403);
      assert.equal(custRes.body.errorCode, 'AUTH_002');

      const adminRes = await request(app)
        .patch(`/api/accounts/${testAccountId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'ACTIVE' });
      assert.equal(adminRes.status, 403);
      assert.equal(adminRes.body.errorCode, 'AUTH_002');
    });
  });

  // ============================================================================
  // 5. Account Eligibility and Transaction Status Enforcement (FR-11, TC-08)
  // ============================================================================
  describe('5. Transaction Status Enforcement Helper (FR-11, TC-08)', () => {
    it('should verify ACTIVE account successfully for transaction processing', async () => {
      // ACC-T1 (ID 1) is ACTIVE
      const acc = await verifyAccountEligibility(1);
      assert.equal(acc.account_id, 1);
      assert.equal(acc.status, 'ACTIVE');
    });

    it('should reject FROZEN account (ACC-T3, ID 3) with ACC_001 (409)', async () => {
      await assert.rejects(
        async () => {
          await verifyAccountEligibility(3);
        },
        (err) => {
          assert.equal(err.code, 'ACC_001');
          assert.equal(err.statusCode, 409);
          assert.equal(err.accountStatus, 'FROZEN');
          return true;
        }
      );
    });

    it('should reject INACTIVE account (ACC-T4, ID 4) with ACC_001 (409)', async () => {
      await assert.rejects(
        async () => {
          await verifyAccountEligibility(4);
        },
        (err) => {
          assert.equal(err.code, 'ACC_001');
          assert.equal(err.statusCode, 409);
          assert.equal(err.accountStatus, 'INACTIVE');
          return true;
        }
      );
    });

    it('should reject nonexistent account with ACC_002 (404)', async () => {
      await assert.rejects(
        async () => {
          await verifyAccountEligibility(999999);
        },
        (err) => {
          assert.equal(err.code, 'ACC_002');
          assert.equal(err.statusCode, 404);
          return true;
        }
      );
    });
  });

  // ============================================================================
  // 6. Registered Customer Lookup Directory (FR-05, FR-07 support)
  // ============================================================================
  describe('6. Registered Customer Lookup Directory (FR-05)', () => {
    it('should allow Employee to list registered customers for account creation', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 2);

      const c1 = res.body.data.find(c => c.customerId === 1);
      assert.ok(c1);
      assert.equal(c1.fullName, 'Test Customer One');
      assert.equal(c1.email, 'test.customer1@example.com');
      assert.equal(c1.phone, '555-0201');
    });

    it('should allow Admin to list registered customers', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    });

    it('should support customer search by text query (?search=Customer)', async () => {
      const res = await request(app)
        .get('/api/customers?search=Customer One')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.data.length >= 1);
      assert.equal(res.body.data[0].fullName, 'Test Customer One');
    });

    it('should reject Customer role from enumerating customer directory with AUTH_002 (403)', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Cookie', customerCookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject unauthenticated request to customer directory with AUTH_003 (401)', async () => {
      const res = await request(app)
        .get('/api/customers');

      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });
  });
});
