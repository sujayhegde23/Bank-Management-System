/**
 * ==============================================================================
 * Automated Integration Test Suite: Customer Profile & Diagnostics Security (Feature 5)
 * ==============================================================================
 * Repository: sujayhegde23/Bank-Management-System
 *
 * Verifies all 11 Section 8 Scenarios:
 * 1. Customer can view their own profile (GET /api/customers/profile, /me, /:id).
 * 2. Customer cannot view another customer's profile (403 AUTH_002).
 * 3. Permitted profile fields can be updated (phone, email, address via PUT /api/customers/profile).
 * 4. Invalid profile data is rejected (invalid email, invalid phone, oversized address 400 VAL_001).
 * 5. Duplicate email/phone values are handled (409 VAL_002).
 * 6. Restricted fields cannot be modified by customer (fullName, dateOfBirth, customerId, username, role, status, balance 403 AUTH_002).
 * 7. Customer cannot access diagnostics frontend (routing isolation).
 * 8. Customer cannot call diagnostics endpoints (403 AUTH_002 on /api/diagnostics, /ping, /health/diagnostics).
 * 9. Employee cannot access administrator-only diagnostics (403 AUTH_002 on /api/diagnostics).
 * 10. Administrator diagnostics still work (200 OK with system telemetry & pool stats).
 * 11. Existing authentication & public health probes remain intact (401 AUTH_003 on unauthenticated, safe /api/health).
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { query, pool, testConnection } = require('../src/config/db');
const { closeMongo } = require('../src/config/mongo');

const TEST_PASSWORD = 'Password123!';

describe('Feature 5: Customer Profile Improvements & System Diagnostics Restriction', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customer1Cookie = null;
  let customer2Cookie = null;

  let origCust1Phone = null;
  let origCust1Email = null;
  let origCust1Address = null;

  let cust2Phone = null;
  let cust2Email = null;

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // 1. Log in as test Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.admin1', password: TEST_PASSWORD });
    assert.equal(adminRes.status, 200, 'Admin login must succeed');
    adminCookie = adminRes.headers['set-cookie'];

    // 2. Log in as test Employee
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.employee1', password: TEST_PASSWORD });
    assert.equal(empRes.status, 200, 'Employee login must succeed');
    employeeCookie = empRes.headers['set-cookie'];

    // 3. Log in as Customer 1 (customer_id: 1)
    const cust1Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(cust1Res.status, 200, 'Customer 1 login must succeed');
    customer1Cookie = cust1Res.headers['set-cookie'];

    // 4. Log in as Customer 2 (customer_id: 2)
    const cust2Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });
    assert.equal(cust2Res.status, 200, 'Customer 2 login must succeed');
    customer2Cookie = cust2Res.headers['set-cookie'];

    // 5. Cache Customer 1 original values to restore in after()
    const [c1] = await query('SELECT phone, email, address FROM customers WHERE customer_id = 1');
    origCust1Phone = c1.phone;
    origCust1Email = c1.email;
    origCust1Address = c1.address;

    // 6. Cache Customer 2 values for duplicate testing
    const [c2] = await query('SELECT phone, email FROM customers WHERE customer_id = 2');
    cust2Phone = c2.phone;
    cust2Email = c2.email;
  });

  after(async () => {
    // Restore Customer 1 original contact details
    if (origCust1Email) {
      await query(
        'UPDATE customers SET phone = ?, email = ?, address = ? WHERE customer_id = 1',
        [origCust1Phone, origCust1Email, origCust1Address]
      );
    }
    await closeMongo().catch(() => {});
    await pool.end();
  });

  // ============================================================================
  // Scenario 1: Customer can view their own profile
  // ============================================================================
  it('Scenario 1: Customer can view their own profile via /profile, /me, and /:customerId', async () => {
    // 1. GET /api/customers/profile
    const resProfile = await request(app)
      .get('/api/customers/profile')
      .set('Cookie', customer1Cookie);

    assert.equal(resProfile.status, 200);
    assert.equal(resProfile.body.success, true);
    const data = resProfile.body.data;

    assert.equal(data.customerId, 1);
    assert.equal(data.username, 'test.customer1');
    assert.ok(data.fullName, 'Full name must be present');
    assert.ok(data.dateOfBirth, 'Date of birth must be present');
    assert.ok(data.phone, 'Phone must be present');
    assert.ok(data.email, 'Email must be present');
    assert.ok(data.address, 'Address must be present');
    assert.ok(data.createdAt, 'Account registration date (createdAt) must be present');
    assert.equal(data.userStatus, 'ACTIVE');

    // 2. GET /api/customers/me
    const resMe = await request(app)
      .get('/api/customers/me')
      .set('Cookie', customer1Cookie);

    assert.equal(resMe.status, 200);
    assert.equal(resMe.body.data.customerId, 1);

    // 3. GET /api/customers/1 (own ID)
    const resOwnId = await request(app)
      .get('/api/customers/1')
      .set('Cookie', customer1Cookie);

    assert.equal(resOwnId.status, 200);
    assert.equal(resOwnId.body.data.customerId, 1);
  });

  // ============================================================================
  // Scenario 2: Customer cannot view another customer's profile
  // ============================================================================
  it("Scenario 2: Customer cannot view another customer's profile (403 AUTH_002)", async () => {
    const res = await request(app)
      .get('/api/customers/2')
      .set('Cookie', customer1Cookie);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorCode, 'AUTH_002');
  });

  // ============================================================================
  // Scenario 3: Permitted profile fields can be updated
  // ============================================================================
  it('Scenario 3: Permitted profile fields (phone, email, address) can be updated by customer', async () => {
    const updatedPhone = '+91 9123456789';
    const updatedEmail = 'test.c1.updated@corebank.local';
    const updatedAddress = '789 High Street, Floor 3, Mumbai, India';

    const res = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({
        phone: updatedPhone,
        email: updatedEmail,
        address: updatedAddress
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.phone, updatedPhone);
    assert.equal(res.body.data.email, updatedEmail);
    assert.equal(res.body.data.address, updatedAddress);

    // Verify persistence in DB
    const [c1] = await query('SELECT phone, email, address FROM customers WHERE customer_id = 1');
    assert.equal(c1.phone, updatedPhone);
    assert.equal(c1.email, updatedEmail);
    assert.equal(c1.address, updatedAddress);
  });

  // ============================================================================
  // Scenario 4: Invalid profile data is rejected
  // ============================================================================
  it('Scenario 4: Invalid profile data (email format, phone format, oversized address) is rejected', async () => {
    // 1. Invalid email format
    const resBadEmail = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ email: 'not-a-valid-email' });

    assert.equal(resBadEmail.status, 400);
    assert.equal(resBadEmail.body.errorCode, 'VAL_001');

    // 2. Invalid phone format
    const resBadPhone = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ phone: '123' }); // Too short

    assert.equal(resBadPhone.status, 400);
    assert.equal(resBadPhone.body.errorCode, 'VAL_001');

    // 3. Oversized address (>255 chars)
    const resBadAddress = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ address: 'A'.repeat(256) });

    assert.equal(resBadAddress.status, 400);
    assert.equal(resBadAddress.body.errorCode, 'VAL_001');
  });

  // ============================================================================
  // Scenario 5: Duplicate email/phone values are handled
  // ============================================================================
  it('Scenario 5: Duplicate email and phone values are rejected with 409 VAL_002', async () => {
    // 1. Attempt to steal customer 2's email
    const resDupEmail = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ email: cust2Email });

    assert.equal(resDupEmail.status, 409);
    assert.equal(resDupEmail.body.errorCode, 'VAL_002');

    // 2. Attempt to steal customer 2's phone
    const resDupPhone = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ phone: cust2Phone });

    assert.equal(resDupPhone.status, 409);
    assert.equal(resDupPhone.body.errorCode, 'VAL_002');
  });

  // ============================================================================
  // Scenario 6: Restricted fields cannot be modified by customer
  // ============================================================================
  it('Scenario 6: Restricted fields (fullName, dateOfBirth, customerId, username, role, status, balance) are strictly rejected', async () => {
    // 1. Modifying fullName
    const resName = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ fullName: 'Malicious Attacker' });

    assert.equal(resName.status, 403);
    assert.equal(resName.body.errorCode, 'AUTH_002');

    // 2. Modifying dateOfBirth
    const resDob = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ dateOfBirth: '1990-01-01' });

    assert.equal(resDob.status, 403);
    assert.equal(resDob.body.errorCode, 'AUTH_002');

    // 3. Modifying customerId
    const resCustId = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ customerId: 99 });

    assert.equal(resCustId.status, 403);
    assert.equal(resCustId.body.errorCode, 'AUTH_002');

    // 4. Modifying username
    const resUsername = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ username: 'superadmin' });

    assert.equal(resUsername.status, 403);
    assert.equal(resUsername.body.errorCode, 'AUTH_002');

    // 5. Modifying role
    const resRole = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ role: 'ADMIN' });

    assert.equal(resRole.status, 403);
    assert.equal(resRole.body.errorCode, 'AUTH_002');

    // 6. Modifying balance
    const resBalance = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ balance: 1000000.00 });

    assert.equal(resBalance.status, 403);
    assert.equal(resBalance.body.errorCode, 'AUTH_002');

    // 7. Modifying userStatus
    const resStatus = await request(app)
      .put('/api/customers/profile')
      .set('Cookie', customer1Cookie)
      .send({ status: 'ACTIVE' });

    assert.equal(resStatus.status, 403);
    assert.equal(resStatus.body.errorCode, 'AUTH_002');
  });

  // ============================================================================
  // Scenario 7: Customer cannot access diagnostics frontend
  // ============================================================================
  it('Scenario 7: Frontend route helper restricts diagnostics to ADMIN only', () => {
    const fs = require('fs');
    const appJsx = fs.readFileSync('c:/se mini project/Bank-Management-System/frontend/src/App.jsx', 'utf8');

    // Verify validCustomerRoutes does not include 'diagnostics'
    assert.ok(
      appJsx.includes("validCustomerRoutes = ['overview', 'statements', 'profile']"),
      "validCustomerRoutes must strictly be ['overview', 'statements', 'profile']"
    );

    // Verify validEmployeeRoutes does not include 'diagnostics'
    assert.ok(
      appJsx.includes("validEmployeeRoutes = ['accounts', 'overview', 'customers', 'transactions', 'my-activity']"),
      "validEmployeeRoutes must not include 'diagnostics'"
    );

    // Verify Access Restricted message for unauthorized diagnostics access
    assert.ok(
      appJsx.includes('activeNav === \'diagnostics\' && !isAdmin'),
      'App.jsx must guard diagnostics view against non-administrators'
    );
  });

  // ============================================================================
  // Scenario 8: Customer cannot call diagnostics endpoints
  // ============================================================================
  it('Scenario 8: Customer cannot call diagnostics endpoints (403 AUTH_002)', async () => {
    // 1. GET /api/diagnostics
    const res1 = await request(app)
      .get('/api/diagnostics')
      .set('Cookie', customer1Cookie);

    assert.equal(res1.status, 403);
    assert.equal(res1.body.errorCode, 'AUTH_002');

    // 2. GET /api/diagnostics/ping
    const res2 = await request(app)
      .get('/api/diagnostics/ping')
      .set('Cookie', customer1Cookie);

    assert.equal(res2.status, 403);
    assert.equal(res2.body.errorCode, 'AUTH_002');

    // 3. GET /api/health/diagnostics
    const res3 = await request(app)
      .get('/api/health/diagnostics')
      .set('Cookie', customer1Cookie);

    assert.equal(res3.status, 403);
    assert.equal(res3.body.errorCode, 'AUTH_002');
  });

  // ============================================================================
  // Scenario 9: Employee cannot access administrator-only diagnostics
  // ============================================================================
  it('Scenario 9: Employee cannot access administrator-only diagnostics (403 AUTH_002)', async () => {
    // 1. GET /api/diagnostics
    const res1 = await request(app)
      .get('/api/diagnostics')
      .set('Cookie', employeeCookie);

    assert.equal(res1.status, 403);
    assert.equal(res1.body.errorCode, 'AUTH_002');

    // 2. GET /api/diagnostics/ping
    const res2 = await request(app)
      .get('/api/diagnostics/ping')
      .set('Cookie', employeeCookie);

    assert.equal(res2.status, 403);
    assert.equal(res2.body.errorCode, 'AUTH_002');

    // 3. GET /api/health/diagnostics
    const res3 = await request(app)
      .get('/api/health/diagnostics')
      .set('Cookie', employeeCookie);

    assert.equal(res3.status, 403);
    assert.equal(res3.body.errorCode, 'AUTH_002');
  });

  // ============================================================================
  // Scenario 10: Administrator diagnostics still work
  // ============================================================================
  it('Scenario 10: Administrator diagnostics still work (200 OK with system telemetry & pool stats)', async () => {
    // 1. GET /api/diagnostics
    const res = await request(app)
      .get('/api/diagnostics')
      .set('Cookie', adminCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const d = res.body.data;

    assert.equal(d.service, 'bank-management-system-backend');
    assert.ok(typeof d.uptimeSeconds === 'number', 'uptimeSeconds must be a number');
    assert.ok(d.memory && typeof d.memory.heapUsedMB === 'number', 'memory stats must be present');
    assert.equal(d.database.status, 'CONNECTED');
    assert.ok(typeof d.tableStats.customers === 'number', 'tableStats.customers must be reported');
    assert.ok(typeof d.tableStats.accounts === 'number', 'tableStats.accounts must be reported');
    assert.ok(typeof d.tableStats.bank_transactions === 'number', 'tableStats.bank_transactions must be reported');

    // 2. GET /api/diagnostics/ping
    const resPing = await request(app)
      .get('/api/diagnostics/ping')
      .set('Cookie', adminCookie);

    assert.equal(resPing.status, 200);
    assert.equal(resPing.body.data.ping, 'PONG');
    assert.equal(resPing.body.data.databaseConnected, true);

    // 3. GET /api/health/diagnostics
    const resHealthDiag = await request(app)
      .get('/api/health/diagnostics')
      .set('Cookie', adminCookie);

    assert.equal(resHealthDiag.status, 200);
    assert.equal(resHealthDiag.body.data.status, 'UP');
  });

  // ============================================================================
  // Scenario 11: Existing authentication & public health probe remain intact
  // ============================================================================
  it('Scenario 11: Existing authentication and customer-safe /api/health remain intact', async () => {
    // 1. Public /api/health returns safe UP status without leaking DB host or credentials
    const healthRes = await request(app).get('/api/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.data.status, 'UP');
    assert.equal(healthRes.body.data.database.status, 'CONNECTED');
    // Ensure no sensitive database credentials or host leaked
    assert.equal(healthRes.body.data.database.password, undefined);
    assert.equal(healthRes.body.data.database.user, undefined);
    assert.equal(healthRes.body.data.database.host, undefined);

    // 2. Unauthenticated request to /api/customers/profile returns 401 AUTH_003
    const unauthProfile = await request(app).get('/api/customers/profile');
    assert.equal(unauthProfile.status, 401);
    assert.equal(unauthProfile.body.errorCode, 'AUTH_003');

    // 3. Unauthenticated request to /api/diagnostics returns 401 AUTH_003
    const unauthDiag = await request(app).get('/api/diagnostics');
    assert.equal(unauthDiag.status, 401);
    assert.equal(unauthDiag.body.errorCode, 'AUTH_003');

    // 4. GET /api/auth/me returns active customer session
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', customer1Cookie);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.username, 'test.customer1');
    assert.equal(meRes.body.data.role, 'CUSTOMER');
    assert.equal(meRes.body.data.customerId, 1);
  });
});
