/**
 * ==============================================================================
 * Customer Registration and Profile Management Test Suite (Issue #6)
 * ==============================================================================
 * Traceability:
 * - FR-04: Register new customer (UC-10, NFR-16, NFR-18)
 * - FR-05: View customer details (UC-11, UC-22, NFR-03)
 * - FR-06: Update customer information (UC-06, UC-12, Assumption A-06)
 * - NFR-01: Secure password hashing (bcrypt salt factor 10, no plaintext)
 * - NFR-02: Role-based access control
 * - NFR-03: Horizontal isolation & customer privacy protection
 * - NFR-04: Comprehensive input validation
 * - NFR-18: Data integrity, uniqueness, and atomic transactions
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool, query, testConnection, withTransaction } = require('../src/config/db');

const TEST_PASSWORD = 'Password123!';

describe('Customer Registration and Profile Management Suite (Issue #6)', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customer1Cookie = null;
  let customer2Cookie = null;

  // Track created user and customer IDs for teardown
  const createdUserIds = [];
  const createdCustomerIds = [];

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // Log in as Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.admin1', password: TEST_PASSWORD });
    assert.equal(adminRes.status, 200);
    adminCookie = adminRes.headers['set-cookie'];

    // Log in as Employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.employee1', password: TEST_PASSWORD });
    assert.equal(empRes.status, 200);
    employeeCookie = empRes.headers['set-cookie'];

    // Log in as Customer 1 (customer_id: 1)
    const cust1Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(cust1Res.status, 200);
    customer1Cookie = cust1Res.headers['set-cookie'];

    // Log in as Customer 2 (customer_id: 2)
    const cust2Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });
    assert.equal(cust2Res.status, 200);
    customer2Cookie = cust2Res.headers['set-cookie'];
  });

  after(async () => {
    try {
      if (createdCustomerIds.length > 0) {
        const placeholders = createdCustomerIds.map(() => '?').join(',');
        await query(`DELETE FROM customers WHERE customer_id IN (${placeholders})`, createdCustomerIds);
      }
      if (createdUserIds.length > 0) {
        const placeholders = createdUserIds.map(() => '?').join(',');
        await query(`DELETE FROM users WHERE user_id IN (${placeholders})`, createdUserIds);
      }
    } catch (err) {
      console.error('Error during customer test teardown:', err.message);
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------
  // 1. Customer Registration (FR-04, AC-1, NFR-04, NFR-18)
  // ----------------------------------------------------------------------------
  describe('1. Customer Registration (FR-04, AC-1)', () => {
    it('should allow an authorized employee to register a new customer', async () => {
      const timestamp = Date.now();
      const newCustData = {
        fullName: `Registered Customer ${timestamp}`,
        dateOfBirth: '1992-05-15',
        phone: `987${String(timestamp).slice(-7)}`,
        email: `cust_${timestamp}@bankexample.com`,
        address: '42 Baker Street, Financial District, Bangalore',
        username: `regcust_${timestamp}`,
        password: 'ValidPassword123!'
      };

      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send(newCustData);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.customerId > 0);
      assert.ok(res.body.data.userId > 0);
      assert.equal(res.body.data.username, newCustData.username);
      assert.equal(res.body.data.fullName, newCustData.fullName);
      assert.equal(res.body.data.dateOfBirth, newCustData.dateOfBirth);
      assert.equal(res.body.data.phone, newCustData.phone);
      assert.equal(res.body.data.email, newCustData.email.toLowerCase());
      assert.equal(res.body.data.address, newCustData.address);
      assert.equal(res.body.data.role, 'CUSTOMER');
      assert.equal(res.body.data.userStatus, 'ACTIVE');
      assert.equal(res.body.data.password, undefined);
      assert.equal(res.body.data.password_hash, undefined);

      createdCustomerIds.push(res.body.data.customerId);
      createdUserIds.push(res.body.data.userId);

      // Verify records in MySQL
      const [userDb] = await query('SELECT * FROM users WHERE user_id = ?', [res.body.data.userId]);
      assert.ok(userDb);
      assert.equal(userDb.role, 'CUSTOMER');
      assert.equal(userDb.status, 'ACTIVE');

      // Verify bcrypt password hash (NFR-01)
      const isMatch = await bcrypt.compare(newCustData.password, userDb.password_hash);
      assert.ok(isMatch, 'Stored password must be a valid bcrypt hash matching the input password');

      // Verify new customer can immediately log in
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: newCustData.username, password: newCustData.password });
      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.data.role, 'CUSTOMER');

      // Verify NO bank accounts were auto-created (AC-1)
      const accountsDb = await query('SELECT * FROM accounts WHERE customer_id = ?', [res.body.data.customerId]);
      assert.equal(accountsDb.length, 0, 'No bank accounts should be automatically created during registration');
    });

    it('should allow an Administrator to register a customer', async () => {
      const timestamp = Date.now() + 1;
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Admin Registered Customer',
          dateOfBirth: '1988-11-20',
          phone: `911${String(timestamp).slice(-7)}`,
          email: `admin_reg_${timestamp}@bankexample.com`,
          address: '100 MG Road, Bangalore',
          username: `admreg_${timestamp}`,
          password: 'StrongPassword456!'
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      createdCustomerIds.push(res.body.data.customerId);
      createdUserIds.push(res.body.data.userId);
    });

    it('should reject registration attempts by unauthorized CUSTOMER role with AUTH_002 (403)', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', customer1Cookie)
        .send({
          fullName: 'Attacker Attempt',
          dateOfBirth: '1995-01-01',
          phone: '9998887776',
          email: 'attacker@example.com',
          address: 'Anywhere',
          username: 'attacker_user',
          password: 'Password123!'
        });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject unauthenticated registration attempts with AUTH_003 (401)', async () => {
      const res = await request(app)
        .post('/api/customers')
        .send({
          fullName: 'Anonymous User',
          dateOfBirth: '1995-01-01',
          phone: '9998887775',
          email: 'anon@example.com',
          address: 'Anywhere',
          username: 'anon_user',
          password: 'Password123!'
        });

      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should prevent privilege escalation: client cannot supply role or status', async () => {
      const timestamp = Date.now() + 2;
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Privilege Escalation Test',
          dateOfBirth: '1990-01-01',
          phone: `922${String(timestamp).slice(-7)}`,
          email: `priv_${timestamp}@bankexample.com`,
          address: 'Privilege Test Lane',
          username: `priv_${timestamp}`,
          password: 'Password123!',
          role: 'ADMIN', // Tampering attempt
          status: 'INACTIVE',
          userId: 9999,
          customerId: 8888
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.role, 'CUSTOMER');
      assert.equal(res.body.data.userStatus, 'ACTIVE');

      createdCustomerIds.push(res.body.data.customerId);
      createdUserIds.push(res.body.data.userId);

      const [userDb] = await query('SELECT * FROM users WHERE user_id = ?', [res.body.data.userId]);
      assert.equal(userDb.role, 'CUSTOMER', 'Role must strictly remain CUSTOMER');
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Input Validation & Duplicate Handling (AC-2, NFR-04, NFR-18)
  // ----------------------------------------------------------------------------
  describe('2. Input Validation and Duplicate Prevention (AC-2, NFR-04, NFR-18)', () => {
    it('should reject missing mandatory fields with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields && res.body.fields.length >= 6);
    });

    it('should reject malformed email format with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Valid Name',
          dateOfBirth: '1990-01-01',
          phone: '9876543210',
          email: 'invalid-email-no-at-sign',
          address: '123 Test Rd',
          username: 'valid_user_1',
          password: 'Password123!'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'email'));
    });

    it('should reject malformed phone numbers with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Valid Name',
          dateOfBirth: '1990-01-01',
          phone: 'abc', // invalid
          email: 'valid@example.com',
          address: '123 Test Rd',
          username: 'valid_user_2',
          password: 'Password123!'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'phone'));
    });

    it('should reject date of birth that is in the future with VAL_001 (400)', async () => {
      const futureYear = new Date().getFullYear() + 2;
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Future Born',
          dateOfBirth: `${futureYear}-01-01`,
          phone: '9876543211',
          email: 'future@example.com',
          address: '123 Test Rd',
          username: 'future_user',
          password: 'Password123!'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'dateOfBirth'));
    });

    it('should reject invalid calendar date of birth (e.g. Feb 30) with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Invalid Date Person',
          dateOfBirth: '1995-02-30', // Feb 30 never exists
          phone: '9876543212',
          email: 'feb30@example.com',
          address: '123 Test Rd',
          username: 'feb30_user',
          password: 'Password123!'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'dateOfBirth'));
    });

    it('should reject short password (< 8 chars) with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Valid Name',
          dateOfBirth: '1990-01-01',
          phone: '9876543213',
          email: 'shortpass@example.com',
          address: '123 Test Rd',
          username: 'shortpass_user',
          password: '123'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'password'));
    });

    it('should reject duplicate username with VAL_002 (409)', async () => {
      // test.customer1 already exists in seed
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Duplicate Username User',
          dateOfBirth: '1990-01-01',
          phone: '9876543214',
          email: 'unique_email_1@example.com',
          address: '123 Test Rd',
          username: 'test.customer1', // Taken
          password: 'Password123!'
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'VAL_002');
    });

    it('should reject duplicate email with VAL_002 (409)', async () => {
      // customer1 seed has email test.customer1@example.com
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Duplicate Email User',
          dateOfBirth: '1990-01-01',
          phone: '9876543215',
          email: 'test.customer1@example.com', // Taken
          address: '123 Test Rd',
          username: 'unique_user_email_test',
          password: 'Password123!'
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'VAL_002');
    });

    it('should reject duplicate phone with VAL_002 (409)', async () => {
      // customer1 seed has phone 555-0201
      const res = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Duplicate Phone User',
          dateOfBirth: '1990-01-01',
          phone: '555-0201', // Taken
          email: 'unique_phone_test@example.com',
          address: '123 Test Rd',
          username: 'unique_phone_user',
          password: 'Password123!'
        });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'VAL_002');
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Search and Profile Viewing (FR-05, AC-3, NFR-03)
  // ----------------------------------------------------------------------------
  describe('3. Search and Profile Viewing (FR-05, AC-3, NFR-03)', () => {
    it('should allow Employee to list all customers', async () => {
      const res = await request(app)
        .get('/api/customers')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 2);

      // Verify no sensitive fields in response
      for (const cust of res.body.data) {
        assert.equal(cust.password, undefined);
        assert.equal(cust.password_hash, undefined);
      }
    });

    it('should allow Employee to filter customers by search query', async () => {
      const res = await request(app)
        .get('/api/customers?search=test.customer1')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.some((c) => c.username === 'test.customer1'));
    });

    it('should allow Employee to view single customer details by ID', async () => {
      const res = await request(app)
        .get('/api/customers/1')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.customerId, 1);
      assert.equal(res.body.data.username, 'test.customer1');
      assert.ok(res.body.data.fullName);
      assert.ok(res.body.data.email);
    });

    it('should allow Customer to view their own profile (NFR-03)', async () => {
      const res = await request(app)
        .get('/api/customers/1')
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.customerId, 1);
      assert.equal(res.body.data.username, 'test.customer1');
    });

    it('should REJECT Customer attempt to view another customer profile with AUTH_002 (403)', async () => {
      const res = await request(app)
        .get('/api/customers/2') // Customer 1 trying to view Customer 2
        .set('Cookie', customer1Cookie);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should return 404 CUST_001 for nonexistent customer ID', async () => {
      const res = await request(app)
        .get('/api/customers/999999')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'CUST_001');
    });

    it('should return 400 VAL_001 for malformed customer ID', async () => {
      const res = await request(app)
        .get('/api/customers/abc12')
        .set('Cookie', employeeCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Customer Profile Updates (FR-06, AC-4, AC-5, SRS A-06)
  // ----------------------------------------------------------------------------
  describe('4. Customer Profile Updates (FR-06, AC-4, AC-5)', () => {
    let testCustomerId = null;
    let testUserId = null;
    let testCustCookie = null;

    before(async () => {
      // Create a dedicated customer for update testing
      const timestamp = Date.now() + 3;
      const username = `upd_test_${timestamp}`;
      const password = 'Password123!';
      const regRes = await request(app)
        .post('/api/customers')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Update Test Subject',
          dateOfBirth: '1994-06-25',
          phone: `933${String(timestamp).slice(-7)}`,
          email: `upd_${timestamp}@example.com`,
          address: 'Original Address 100',
          username,
          password
        });
      assert.equal(regRes.status, 201);
      testCustomerId = regRes.body.data.customerId;
      testUserId = regRes.body.data.userId;
      createdCustomerIds.push(testCustomerId);
      createdUserIds.push(testUserId);

      // Log in as this test customer
      const logRes = await request(app)
        .post('/api/auth/login')
        .send({ username, password });
      assert.equal(logRes.status, 200);
      testCustCookie = logRes.headers['set-cookie'];
    });

    it('should allow Employee to update identity & contact details (FR-06)', async () => {
      const updatedData = {
        fullName: 'Updated Name by Employee',
        dateOfBirth: '1993-07-20',
        phone: '9441112233',
        email: 'emp_updated@example.com',
        address: '500 Corporate Boulevard, Suite 10'
      };

      const res = await request(app)
        .put(`/api/customers/${testCustomerId}`)
        .set('Cookie', employeeCookie)
        .send(updatedData);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.fullName, updatedData.fullName);
      assert.equal(res.body.data.dateOfBirth, updatedData.dateOfBirth);
      assert.equal(res.body.data.phone, updatedData.phone);
      assert.equal(res.body.data.email, updatedData.email);
      assert.equal(res.body.data.address, updatedData.address);

      // Verify in DB
      const [dbRow] = await query('SELECT * FROM customers WHERE customer_id = ?', [testCustomerId]);
      assert.equal(dbRow.full_name, updatedData.fullName);
    });

    it('should allow Customer to update their own contact details (phone, email, address) (SRS A-06)', async () => {
      const contactUpdate = {
        phone: '9552223344',
        email: 'customer_self_updated@example.com',
        address: '77 Residential Colony, Flat 4B'
      };

      const res = await request(app)
        .put(`/api/customers/${testCustomerId}`)
        .set('Cookie', testCustCookie)
        .send(contactUpdate);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.phone, contactUpdate.phone);
      assert.equal(res.body.data.email, contactUpdate.email);
      assert.equal(res.body.data.address, contactUpdate.address);
      // Identity remains unchanged
      assert.equal(res.body.data.fullName, 'Updated Name by Employee');
    });

    it('should FORBID Customer from modifying identity details (fullName or DOB) with AUTH_002 (403) (SRS A-06)', async () => {
      const illegalIdentityChange = {
        fullName: 'Hacked Identity Name',
        phone: '9552223344'
      };

      const res = await request(app)
        .put(`/api/customers/${testCustomerId}`)
        .set('Cookie', testCustCookie)
        .send(illegalIdentityChange);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
      assert.ok(res.body.message.includes('contact details'));
    });

    it('should FORBID Customer from modifying dateOfBirth with AUTH_002 (403) (SRS A-06)', async () => {
      const illegalDobChange = {
        dateOfBirth: '2000-01-01'
      };

      const res = await request(app)
        .put(`/api/customers/${testCustomerId}`)
        .set('Cookie', testCustCookie)
        .send(illegalDobChange);

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should FORBID Customer from updating another customer profile with AUTH_002 (403)', async () => {
      const res = await request(app)
        .put('/api/customers/2') // testCustomer trying to edit Customer 2
        .set('Cookie', testCustCookie)
        .send({ address: 'Hacked Address' });

      assert.equal(res.status, 403);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject email update if already taken by another customer with VAL_002 (409)', async () => {
      // test.customer1 has email test.customer1@example.com
      const res = await request(app)
        .put(`/api/customers/${testCustomerId}`)
        .set('Cookie', employeeCookie)
        .send({ email: 'test.customer1@example.com' });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'VAL_002');
    });

    it('should reject phone update if already taken by another customer with VAL_002 (409)', async () => {
      // test.customer1 has phone 555-0201
      const res = await request(app)
        .put(`/api/customers/${testCustomerId}`)
        .set('Cookie', employeeCookie)
        .send({ phone: '555-0201' });

      assert.equal(res.status, 409);
      assert.equal(res.body.errorCode, 'VAL_002');
    });

    it('should reject update with empty payload with VAL_001 (400)', async () => {
      const res = await request(app)
        .put(`/api/customers/${testCustomerId}`)
        .set('Cookie', employeeCookie)
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should return 404 CUST_001 when updating nonexistent customer', async () => {
      const res = await request(app)
        .put('/api/customers/999999')
        .set('Cookie', employeeCookie)
        .send({ address: 'Some Address' });

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'CUST_001');
    });
  });
});
