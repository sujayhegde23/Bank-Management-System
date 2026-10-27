/**
 * ==============================================================================
 * Employee Administration Integration Test Suite (Issue #11)
 * ==============================================================================
 * Verifies SRS FR-23, FR-24, NFR-01, NFR-02, NFR-03, NFR-04, NFR-16, NFR-18,
 * and Architecture Specification §4 (CMP-07), §9 (Endpoints 17, 18, 19), §10.
 *
 * Verifies:
 * 1. Admin can create an employee with valid credentials.
 * 2. Non-admin and unauthenticated requests are rejected.
 * 3. Callers cannot elevate roles (role is strictly EMPLOYEE).
 * 4. Duplicate usernames are rejected with VAL_002 (409).
 * 5. Invalid and missing fields are rejected with VAL_001 (400).
 * 6. Passwords are securely hashed with bcrypt and never exposed.
 * 7. Admin can retrieve employee listing and individual records.
 * 8. Admin can update permitted fields (fullName, email, phone).
 * 9. Attempts to update protected fields (role, username, user_id, password_hash) are rejected.
 * 10. Admin can deactivate and reactivate an employee.
 * 11. A deactivated employee's existing active session is immediately rejected on protected requests.
 * 12. Deactivated employee cannot log in (AUTH_001).
 * 13. Failed employee creation rolls back both database inserts (transaction atomicity).
 * 14. Nonexistent employee IDs return EMP_001 (404).
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool, query, testConnection, withTransaction } = require('../src/config/db');

const TEST_PASSWORD = 'Password123!';

describe('Employee Administration Suite (Issue #11)', () => {
  let isDbLive = false;
  let adminCookie = null;
  let employeeCookie = null;
  let customerCookie = null;

  // Track created user and employee IDs for teardown
  const createdUserIds = [];
  const createdEmployeeIds = [];

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // Log in as Admin (test.admin1) to capture admin session cookie
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.admin1', password: TEST_PASSWORD });
    assert.equal(adminRes.status, 200);
    adminCookie = adminRes.headers['set-cookie'];

    // Log in as Employee (test.employee1) to capture employee session cookie
    const empRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.employee1', password: TEST_PASSWORD });
    assert.equal(empRes.status, 200);
    employeeCookie = empRes.headers['set-cookie'];

    // Log in as Customer (test.customer1) to capture customer session cookie
    const custRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer1', password: TEST_PASSWORD });
    assert.equal(custRes.status, 200);
    customerCookie = custRes.headers['set-cookie'];
  });

  after(async () => {
    // Clean up all temporary records created during tests
    try {
      if (createdEmployeeIds.length > 0) {
        const placeholders = createdEmployeeIds.map(() => '?').join(',');
        await pool.execute(`DELETE FROM employees WHERE employee_id IN (${placeholders})`, createdEmployeeIds);
      }
      if (createdUserIds.length > 0) {
        const placeholders = createdUserIds.map(() => '?').join(',');
        await pool.execute(`DELETE FROM users WHERE user_id IN (${placeholders})`, createdUserIds);
      }
      // Clean up test-specific usernames in case an assertion failed before IDs could be registered
      const testUsernames = [
        'test.staff_alpha',
        'test.hijack_attempt',
        'test.update_staff',
        'test.deact_staff',
        'test.rollback_probe',
        'test.emp_insert_fail_probe',
        'test.txn_fail_user'
      ];
      const placeholders = testUsernames.map(() => '?').join(',');
      await pool.execute(
        `DELETE FROM employees WHERE user_id IN (SELECT user_id FROM users WHERE username IN (${placeholders}))`,
        testUsernames
      );
      await pool.execute(
        `DELETE FROM users WHERE username IN (${placeholders})`,
        testUsernames
      );
    } catch (err) {
      console.error('Error during test cleanup:', err.message);
    } finally {
      // Conforms to repository test lifecycle convention (health.test.js, auth.test.js)
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------
  // Scenario 1: Authorization & Role Enforcement
  // ----------------------------------------------------------------------------
  describe('1. Authorization & Role Enforcement', () => {
    it('should reject unauthenticated request to GET /api/employees with AUTH_003 (401)', async () => {
      const res = await request(app).get('/api/employees');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should reject Customer role from accessing GET /api/employees with AUTH_002 (403)', async () => {
      const res = await request(app)
        .get('/api/employees')
        .set('Cookie', customerCookie);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject Employee role from accessing GET /api/employees with AUTH_002 (403)', async () => {
      const res = await request(app)
        .get('/api/employees')
        .set('Cookie', employeeCookie);
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });

    it('should reject Employee role from creating employees with AUTH_002 (403)', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Cookie', employeeCookie)
        .send({
          fullName: 'Unauthorized Employee',
          email: 'unauth@example.com',
          phone: '555-0000',
          username: 'test.unauth',
          initialPassword: TEST_PASSWORD
        });
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_002');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 2: Employee Creation & Transaction Atomicity
  // ----------------------------------------------------------------------------
  describe('2. Employee Creation by Administrator (FR-23)', () => {
    let createdEmp = null;

    it('should allow Admin to create a new employee account in a transaction', async () => {
      const newEmpPayload = {
        fullName: 'Test Staff Alpha',
        email: 'alpha.staff@example.com',
        phone: '555-0199',
        username: 'test.staff_alpha',
        initialPassword: TEST_PASSWORD
      };

      const res = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send(newEmpPayload);

      // Track created records as early as practical before assertions run
      if (res.body?.data?.userId) createdUserIds.push(res.body.data.userId);
      if (res.body?.data?.employeeId) createdEmployeeIds.push(res.body.data.employeeId);

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.employeeId);
      assert.ok(res.body.data.userId);
      assert.equal(res.body.data.username, 'test.staff_alpha');
      assert.equal(res.body.data.fullName, 'Test Staff Alpha');
      assert.equal(res.body.data.email, 'alpha.staff@example.com');
      assert.equal(res.body.data.phone, '555-0199');
      assert.equal(res.body.data.role, 'EMPLOYEE');
      assert.equal(res.body.data.status, 'ACTIVE');

      // Crucial security check: password must not be returned
      assert.equal(res.body.data.password, undefined);
      assert.equal(res.body.data.password_hash, undefined);
      assert.equal(res.body.data.initialPassword, undefined);

      createdEmp = res.body.data;

      // Verify in database directly
      const [userRow] = await query('SELECT user_id, username, password_hash, role, status FROM users WHERE user_id = ?', [createdEmp.userId]);
      assert.ok(userRow);
      assert.equal(userRow.role, 'EMPLOYEE');
      assert.equal(userRow.status, 'ACTIVE');
      assert.ok(userRow.password_hash.startsWith('$2b$10$'));

      const [empRow] = await query('SELECT employee_id, user_id, full_name, email, phone FROM employees WHERE employee_id = ?', [createdEmp.employeeId]);
      assert.ok(empRow);
      assert.equal(empRow.user_id, createdEmp.userId);
      assert.equal(empRow.full_name, 'Test Staff Alpha');
    });

    it('should allow the newly created employee to log in successfully', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.staff_alpha', password: TEST_PASSWORD });

      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.success, true);
      assert.equal(loginRes.body.data.role, 'EMPLOYEE');
      assert.equal(loginRes.body.data.displayName, 'Test Staff Alpha');
    });

    it('should enforce role EMPLOYEE even if request specifies ADMIN or CUSTOMER', async () => {
      const payload = {
        fullName: 'Role Hijack Attempt',
        email: 'hijack@example.com',
        phone: '555-0198',
        username: 'test.hijack_attempt',
        initialPassword: TEST_PASSWORD,
        role: 'ADMIN' // Malicious attempt to create an admin
      };

      const res = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send(payload);

      // Track created records immediately
      if (res.body?.data?.userId) createdUserIds.push(res.body.data.userId);
      if (res.body?.data?.employeeId) createdEmployeeIds.push(res.body.data.employeeId);

      assert.equal(res.status, 201);
      assert.equal(res.body.data.role, 'EMPLOYEE'); // Strictly enforced as EMPLOYEE

      // Check DB directly
      const [row] = await query('SELECT role FROM users WHERE user_id = ?', [res.body.data.userId]);
      assert.equal(row.role, 'EMPLOYEE');
    });

    it('should reject duplicate username with VAL_002 (409)', async () => {
      const duplicatePayload = {
        fullName: 'Duplicate Staff',
        email: 'dup@example.com',
        phone: '555-0197',
        username: 'test.staff_alpha', // Already exists
        initialPassword: TEST_PASSWORD
      };

      const res = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send(duplicatePayload);

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VAL_002');
    });

    it('should roll back user record if employee creation transaction fails', async () => {
      const testUsername = 'test.rollback_probe';

      // Test withTransaction atomicity by ensuring that an error in the callback rolls back the user insert
      await assert.rejects(async () => {
        await withTransaction(async (conn) => {
          const [uRes] = await conn.execute(
            "INSERT INTO users (username, password_hash, role, status) VALUES (?, 'dummy_hash', 'EMPLOYEE', 'ACTIVE')",
            [testUsername]
          );
          createdUserIds.push(uRes.insertId);
          // Simulate an unexpected downstream failure before commit
          throw new Error('Simulated transaction abort');
        });
      });

      // Verify user was NOT committed in MySQL
      const rows = await query('SELECT user_id FROM users WHERE username = ?', [testUsername]);
      assert.equal(rows.length, 0, 'Rolled back user must not exist in users table');
    });

    it('should roll back preceding user insert if employee-table insert fails in transaction', async () => {
      let createdUserId = null;
      const testUsername = 'test.emp_insert_fail_probe';

      await assert.rejects(
        async () => {
          await withTransaction(async (conn) => {
            const [userResult] = await conn.execute(
              'INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)',
              [testUsername, 'dummy_hash', 'EMPLOYEE', 'ACTIVE']
            );
            createdUserId = userResult.insertId;
            createdUserIds.push(createdUserId);

            // Intentionally violate NOT NULL constraint on employees.full_name to trigger failure
            await conn.execute(
              'INSERT INTO employees (user_id, full_name, email, phone) VALUES (?, NULL, ?, ?)',
              [createdUserId, 'test.fail@example.com', '555-0100']
            );
          });
        },
        (err) => {
          assert.ok(
            err.message.includes('cannot be null') || err.code === 'ER_BAD_NULL_ERROR',
            `Expected NOT NULL violation error, got: ${err.message}`
          );
          return true;
        }
      );

      // Confirm that the preceding users insert was rolled back
      const [rows] = await pool.execute('SELECT * FROM users WHERE user_id = ?', [createdUserId]);
      assert.equal(rows.length, 0, 'User record must be rolled back when employee insert fails');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 3: Input Validation (VAL_001)
  // ----------------------------------------------------------------------------
  describe('3. Employee Input Validation (VAL_001)', () => {
    it('should reject missing full name with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send({
          fullName: '   ',
          email: 'valid@example.com',
          phone: '555-0123',
          username: 'test.val_user1',
          initialPassword: TEST_PASSWORD
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'fullName'));
    });

    it('should reject invalid email format with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Valid Name',
          email: 'not-an-email',
          phone: '555-0123',
          username: 'test.val_user2',
          initialPassword: TEST_PASSWORD
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'email'));
    });

    it('should reject invalid phone format with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Valid Name',
          email: 'valid@example.com',
          phone: '12', // Too short
          username: 'test.val_user3',
          initialPassword: TEST_PASSWORD
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'phone'));
    });

    it('should reject password shorter than 8 characters with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Valid Name',
          email: 'valid@example.com',
          phone: '555-0123',
          username: 'test.val_user4',
          initialPassword: 'short' // < 8 chars
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'initialPassword'));
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 4: Retrieve Employee Records
  // ----------------------------------------------------------------------------
  describe('4. Retrieve Employee Records', () => {
    it('should return list of all employees for Administrator', async () => {
      const res = await request(app)
        .get('/api/employees')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 2, 'Should include baseline seeded employees');

      const emp1 = res.body.data.find((e) => e.username === 'test.employee1');
      assert.ok(emp1);
      assert.equal(emp1.role, 'EMPLOYEE');
      assert.equal(emp1.status, 'ACTIVE');
      assert.equal(emp1.fullName, 'Test Employee One');
      assert.equal(emp1.password, undefined);
      assert.equal(emp1.password_hash, undefined);
    });

    it('should return a specific employee by ID', async () => {
      const res = await request(app)
        .get('/api/employees/1')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.employeeId, 1);
      assert.equal(res.body.data.username, 'test.employee1');
    });

    it('should return EMP_001 (404) for nonexistent employee ID', async () => {
      const res = await request(app)
        .get('/api/employees/999999')
        .set('Cookie', adminCookie);

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'EMP_001');
    });

    it('should reject malformed employee ID in GET request with VAL_001 (400)', async () => {
      const invalidIds = ['12abc', '1.5', '0', '-5', '9007199254740992'];
      for (const id of invalidIds) {
        const res = await request(app)
          .get(`/api/employees/${id}`)
          .set('Cookie', adminCookie);

        assert.equal(res.status, 400, `Expected 400 for GET id "${id}"`);
        assert.equal(res.body.success, false);
        assert.equal(res.body.errorCode, 'VAL_001');
      }
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 5: Update Permitted Details & Protected Fields Rejection
  // ----------------------------------------------------------------------------
  describe('5. Update Permitted Employee Details', () => {
    let targetEmployeeId = null;

    before(async () => {
      // Create a test employee to update
      const res = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Update Target Staff',
          email: 'target.staff@example.com',
          phone: '555-0300',
          username: 'test.update_staff',
          initialPassword: TEST_PASSWORD
        });

      if (res.body?.data?.userId) createdUserIds.push(res.body.data.userId);
      if (res.body?.data?.employeeId) createdEmployeeIds.push(res.body.data.employeeId);

      assert.equal(res.status, 201);
      targetEmployeeId = res.body.data.employeeId;
    });

    it('should update permitted fields (fullName, email, phone) successfully', async () => {
      const updatePayload = {
        fullName: 'Updated Staff Name',
        email: 'updated.staff@example.com',
        phone: '555-0399'
      };

      const res = await request(app)
        .put(`/api/employees/${targetEmployeeId}`)
        .set('Cookie', adminCookie)
        .send(updatePayload);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.fullName, 'Updated Staff Name');
      assert.equal(res.body.data.email, 'updated.staff@example.com');
      assert.equal(res.body.data.phone, '555-0399');

      // Verify persistence via GET
      const getRes = await request(app)
        .get(`/api/employees/${targetEmployeeId}`)
        .set('Cookie', adminCookie);
      assert.equal(getRes.body.data.fullName, 'Updated Staff Name');
      assert.equal(getRes.body.data.email, 'updated.staff@example.com');
      assert.equal(getRes.body.data.phone, '555-0399');
    });

    it('should reject attempts to update protected field "role" with VAL_001 (400)', async () => {
      const res = await request(app)
        .put(`/api/employees/${targetEmployeeId}`)
        .set('Cookie', adminCookie)
        .send({ role: 'ADMIN' });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'role'));
    });

    it('should reject attempts to update protected field "username" with VAL_001 (400)', async () => {
      const res = await request(app)
        .put(`/api/employees/${targetEmployeeId}`)
        .set('Cookie', adminCookie)
        .send({ username: 'hacked.username' });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'username'));
    });

    it('should reject attempts to update protected field "password_hash" with VAL_001 (400)', async () => {
      const res = await request(app)
        .put(`/api/employees/${targetEmployeeId}`)
        .set('Cookie', adminCookie)
        .send({ password_hash: 'plain_or_fake_hash' });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject update if no permitted fields are provided', async () => {
      const res = await request(app)
        .put(`/api/employees/${targetEmployeeId}`)
        .set('Cookie', adminCookie)
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should reject update request containing unsupported fields with VAL_001 (400)', async () => {
      const res = await request(app)
        .put(`/api/employees/${targetEmployeeId}`)
        .set('Cookie', adminCookie)
        .send({ department: 'Finance' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'department'));
    });

    it('should not silently ignore unsupported fields when valid fields are present', async () => {
      // Capture employee state before the rejected update request
      const beforeRes = await request(app)
        .get(`/api/employees/${targetEmployeeId}`)
        .set('Cookie', adminCookie);
      assert.equal(beforeRes.status, 200);
      const existingData = beforeRes.body.data;

      const res = await request(app)
        .put(`/api/employees/${targetEmployeeId}`)
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Attempted Valid Name',
          department: 'Executive Operations'
        });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.ok(res.body.fields.some((f) => f.field === 'department'));

      // Verify that the employee's existing data remains completely unchanged
      const afterRes = await request(app)
        .get(`/api/employees/${targetEmployeeId}`)
        .set('Cookie', adminCookie);
      assert.equal(afterRes.status, 200);
      assert.equal(afterRes.body.data.fullName, existingData.fullName, 'fullName must remain unchanged');
      assert.equal(afterRes.body.data.email, existingData.email, 'email must remain unchanged');
      assert.equal(afterRes.body.data.phone, existingData.phone, 'phone must remain unchanged');
    });

    it('should reject malformed employee ID in PUT request with VAL_001 (400)', async () => {
      const invalidIds = ['12abc', '1.5', '0', '-5', '9007199254740992'];
      for (const id of invalidIds) {
        const res = await request(app)
          .put(`/api/employees/${id}`)
          .set('Cookie', adminCookie)
          .send({ fullName: 'Valid Name' });

        assert.equal(res.status, 400, `Expected 400 for PUT id "${id}"`);
        assert.equal(res.body.success, false);
        assert.equal(res.body.errorCode, 'VAL_001');
      }
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 6: Activation, Deactivation, and Session Revocation (FR-24)
  // ----------------------------------------------------------------------------
  describe('6. Activation, Deactivation & Session Invalidation (FR-24)', () => {
    let deactEmpId = null;
    let deactUserId = null;
    let deactEmpCookie = null;

    before(async () => {
      // Create employee specifically for deactivation test
      const res = await request(app)
        .post('/api/employees')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Deactivate Target Staff',
          email: 'deact.staff@example.com',
          phone: '555-0400',
          username: 'test.deact_staff',
          initialPassword: TEST_PASSWORD
        });

      if (res.body?.data?.userId) createdUserIds.push(res.body.data.userId);
      if (res.body?.data?.employeeId) createdEmployeeIds.push(res.body.data.employeeId);

      assert.equal(res.status, 201);
      deactEmpId = res.body.data.employeeId;
      deactUserId = res.body.data.userId;

      // Log in as the new employee to establish an active session
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.deact_staff', password: TEST_PASSWORD });
      assert.equal(loginRes.status, 200);
      deactEmpCookie = loginRes.headers['set-cookie'];

      // Verify active session works initially
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', deactEmpCookie);
      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.data.username, 'test.deact_staff');
    });

    it('should allow Admin to deactivate an employee account', async () => {
      const res = await request(app)
        .patch(`/api/employees/${deactEmpId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'INACTIVE' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'INACTIVE');

      // Check DB directly
      const [uRow] = await query('SELECT status FROM users WHERE user_id = ?', [deactUserId]);
      assert.equal(uRow.status, 'INACTIVE');
    });

    it('should immediately invalidate active session of deactivated employee on subsequent protected request (FR-24)', async () => {
      // Attempt to access /api/auth/me using the previously established session cookie
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', deactEmpCookie);

      assert.equal(meRes.status, 401);
      assert.equal(meRes.body.success, false);
      assert.equal(meRes.body.errorCode, 'AUTH_003');
    });

    it('should prevent deactivated employee from logging in (AUTH_001)', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.deact_staff', password: TEST_PASSWORD });

      assert.equal(loginRes.status, 401);
      assert.equal(loginRes.body.errorCode, 'AUTH_001');
      assert.equal(loginRes.body.message, 'Invalid username or password');
    });

    it('should allow Admin to reactivate an employee account', async () => {
      const res = await request(app)
        .patch(`/api/employees/${deactEmpId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'ACTIVE' });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'ACTIVE');

      // Verify reactivated employee can log in again
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.deact_staff', password: TEST_PASSWORD });
      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.data.role, 'EMPLOYEE');
    });

    it('should reject invalid status with VAL_001 (400)', async () => {
      const res = await request(app)
        .patch(`/api/employees/${deactEmpId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: 'SUSPENDED' }); // Invalid status

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
    });

    it('should return EMP_001 (404) when deactivating nonexistent employee', async () => {
      const res = await request(app)
        .patch('/api/employees/999999/status')
        .set('Cookie', adminCookie)
        .send({ status: 'INACTIVE' });

      assert.equal(res.status, 404);
      assert.equal(res.body.errorCode, 'EMP_001');
    });

    it('should reject malformed employee ID in PATCH status request with VAL_001 (400)', async () => {
      const invalidIds = ['12abc', '1.5', '0', '-5', '9007199254740992'];
      for (const id of invalidIds) {
        const res = await request(app)
          .patch(`/api/employees/${id}/status`)
          .set('Cookie', adminCookie)
          .send({ status: 'INACTIVE' });

        assert.equal(res.status, 400, `Expected 400 for PATCH id "${id}"`);
        assert.equal(res.body.success, false);
        assert.equal(res.body.errorCode, 'VAL_001');
      }
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 7: Transaction Helper (withTransaction) Resilience
  // ----------------------------------------------------------------------------
  describe('7. Transaction Helper (withTransaction) Resilience', () => {
    it('should rollback and preserve original error when transaction callback fails', async () => {
      let rolledBackUserId = null;
      await assert.rejects(
        async () => {
          await withTransaction(async (conn) => {
            const [res] = await conn.execute(
              'INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)',
              ['test.txn_fail_user', 'mock_hash', 'EMPLOYEE', 'ACTIVE']
            );
            rolledBackUserId = res.insertId;
            createdUserIds.push(rolledBackUserId);
            throw new Error('Simulated transaction operation failure');
          });
        },
        /Simulated transaction operation failure/
      );

      // Verify that the user insert was completely rolled back
      const [rows] = await pool.execute('SELECT * FROM users WHERE user_id = ?', [rolledBackUserId]);
      assert.equal(rows.length, 0, 'Rolled back record must not exist in users table');
    });

    it('should preserve original error, destroy connection, and not release it if rollback fails', async () => {
      let destroyCalled = false;
      let releaseCalled = false;

      await assert.rejects(
        async () => {
          await withTransaction(async (conn) => {
            const origDestroy = conn.destroy.bind(conn);
            const origRelease = conn.release.bind(conn);

            conn.destroy = () => {
              destroyCalled = true;
              return origDestroy();
            };

            conn.release = () => {
              releaseCalled = true;
              return origRelease();
            };

            // Mock conn.rollback on this dedicated connection instance to simulate a fatal rollback failure
            conn.rollback = async () => {
              throw new Error('Fatal socket failure during rollback');
            };

            throw new Error('Initial query failure before rollback');
          });
        },
        /Initial query failure before rollback/
      );

      assert.equal(destroyCalled, true, 'conn.destroy() must be called when rollback fails');
      assert.equal(releaseCalled, false, 'conn.release() must NOT be called on a destroyed connection');
    });
  });
});
