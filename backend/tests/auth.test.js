/**
 * ==============================================================================
 * Authentication & Authorization Integration Test Suite
 * ==============================================================================
 * Implements verification for GitHub Issue #5, SRS (FR-01, FR-02, FR-03, NFR-01,
 * NFR-02, NFR-03, NFR-05), and Architecture Specification Section 6 and 10.
 *
 * Verifies all 13 required test cases against live Express routes and MySQL database:
 * 1. Successful login for customer, employee, and admin test users.
 * 2. Incorrect password returns generic AUTH_001.
 * 3. Unknown username returns the same generic AUTH_001.
 * 4. Empty or missing fields return VAL_001.
 * 5. Inactive users cannot log in and receive generic AUTH_001.
 * 6. /api/auth/me rejects unauthenticated requests and returns a safe profile for authenticated users.
 * 7. Logout destroys the session; subsequent requests using the old session are rejected with AUTH_003.
 * 8. Customer cannot access employee/admin-only operations (AUTH_002).
 * 9. Employee cannot access admin-only operations (AUTH_002).
 * 10. Unauthenticated requests to protected operations return AUTH_003.
 * 11. A user deactivated during an active session is rejected on their next protected request (AUTH_003).
 * 12. Password hashes are salted, stored securely, and never returned in responses.
 * 13. Login errors and server errors do not leak stack traces, SQL details, passwords, or hashes.
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool, query, testConnection } = require('../src/config/db');

// Shared baseline dummy test password
const TEST_PASSWORD = 'Password123!';

describe('Authentication & Authorization Suite (Issue #5)', () => {
  let isDbLive = false;
  let tempInactiveUserId = null;
  let tempDeactSessionUserId = null;

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests. Error: ${status.error}`);

    // Create temporary test users for inactive testing
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(TEST_PASSWORD, salt);

    // 1. User seeded as INACTIVE
    const [inactiveRes] = await pool.execute(
      "INSERT INTO users (username, password_hash, role, status) VALUES ('test.inactive_temp', ?, 'CUSTOMER', 'INACTIVE')",
      [hash]
    );
    tempInactiveUserId = inactiveRes.insertId;

    // 2. User initially ACTIVE to test mid-session deactivation
    const [deactRes] = await pool.execute(
      "INSERT INTO users (username, password_hash, role, status) VALUES ('test.mid_session_temp', ?, 'CUSTOMER', 'ACTIVE')",
      [hash]
    );
    tempDeactSessionUserId = deactRes.insertId;
  });

  after(async () => {
    // Cleanup temporary test fixtures
    try {
      if (tempInactiveUserId) {
        await pool.execute('DELETE FROM users WHERE user_id = ?', [tempInactiveUserId]);
      }
      if (tempDeactSessionUserId) {
        await pool.execute('DELETE FROM users WHERE user_id = ?', [tempDeactSessionUserId]);
      }
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------
  // Scenario 1: Successful login for customer, employee, and admin test users
  // ----------------------------------------------------------------------------
  describe('1. Successful Login for Customer, Employee, and Admin', () => {
    it('should log in customer (test.customer1) and return safe profile with session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.customer1', password: TEST_PASSWORD });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.username, 'test.customer1');
      assert.equal(res.body.data.role, 'CUSTOMER');
      assert.equal(res.body.data.displayName, 'Test Customer One');
      assert.ok(res.body.data.userId);
      assert.equal(res.body.data.password, undefined);
      assert.equal(res.body.data.password_hash, undefined);

      // Verify session cookie was set
      const cookies = res.headers['set-cookie'];
      assert.ok(cookies && cookies.length > 0, 'Session cookie must be set on login');
      assert.ok(cookies[0].includes('bms.sid'), 'Cookie name must be bms.sid');
      assert.ok(cookies[0].toLowerCase().includes('httponly'), 'Cookie must be httpOnly');
    });

    it('should log in employee (test.employee1) and return employee display name', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.employee1', password: TEST_PASSWORD });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.username, 'test.employee1');
      assert.equal(res.body.data.role, 'EMPLOYEE');
      assert.equal(res.body.data.displayName, 'Test Employee One');
    });

    it('should log in administrator (test.admin1) and return "Administrator" display name', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.admin1', password: TEST_PASSWORD });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.username, 'test.admin1');
      assert.equal(res.body.data.role, 'ADMIN');
      assert.equal(res.body.data.displayName, 'Administrator');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 2: Incorrect password returns generic AUTH_001
  // ----------------------------------------------------------------------------
  describe('2. Incorrect Password Rejection', () => {
    it('should reject incorrect password with generic AUTH_001 (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.customer1', password: 'WrongPassword999!' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_001');
      assert.equal(res.body.message, 'Invalid username or password');
      assert.equal(res.body.error.code, 'AUTH_001');
      assert.equal(res.body.error.message, 'Invalid username or password');
      assert.equal(res.headers['set-cookie'], undefined, 'No session cookie on failed login');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 3: Unknown username returns the same generic AUTH_001
  // ----------------------------------------------------------------------------
  describe('3. Unknown Username Enumeration Defense', () => {
    it('should return identical AUTH_001 for non-existent username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'no.such.user.exists', password: 'AnyPassword123!' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_001');
      assert.equal(res.body.message, 'Invalid username or password');
      assert.equal(res.body.error.code, 'AUTH_001');
      assert.equal(res.body.error.message, 'Invalid username or password');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 4: Empty or missing fields return VAL_001
  // ----------------------------------------------------------------------------
  describe('4. Input Validation (VAL_001)', () => {
    it('should reject missing username and password with VAL_001 (400)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.equal(res.body.message, 'Invalid input');
      assert.equal(res.body.error.code, 'VAL_001');
      assert.ok(Array.isArray(res.body.error.fields));
      assert.equal(res.body.error.fields.length, 2);
    });

    it('should reject empty or whitespace-only password with VAL_001', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.customer1', password: '   ' });

      assert.equal(res.status, 400);
      assert.equal(res.body.errorCode, 'VAL_001');
      assert.equal(res.body.error.fields[0].field, 'password');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 5: Inactive users cannot log in and receive generic AUTH_001
  // ----------------------------------------------------------------------------
  describe('5. Inactive User Login Prevention', () => {
    it('should reject login for inactive user with generic AUTH_001', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.inactive_temp', password: TEST_PASSWORD });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_001');
      assert.equal(res.body.message, 'Invalid username or password');
      assert.equal(res.headers['set-cookie'], undefined);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 6: /api/auth/me behavior (unauthenticated vs authenticated)
  // ----------------------------------------------------------------------------
  describe('6. Current Session Safe Profile (/api/auth/me)', () => {
    it('should reject unauthenticated request with AUTH_003 (401)', async () => {
      const res = await request(app).get('/api/auth/me');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.errorCode, 'AUTH_003');
      assert.equal(res.body.message, 'Please log in to continue');
    });

    it('should return safe profile for authenticated session and survive re-request', async () => {
      // 1. Login to establish session
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.customer1', password: TEST_PASSWORD });
      const cookie = loginRes.headers['set-cookie'];

      // 2. Request /api/auth/me using session cookie (simulating browser request/refresh)
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      assert.equal(meRes.status, 200);
      assert.equal(meRes.body.success, true);
      assert.equal(meRes.body.data.username, 'test.customer1');
      assert.equal(meRes.body.data.role, 'CUSTOMER');
      assert.equal(meRes.body.data.displayName, 'Test Customer One');
      assert.equal(meRes.body.data.password_hash, undefined);
      assert.equal(meRes.body.data.password, undefined);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 7: Logout destroys session; old session rejected with AUTH_003
  // ----------------------------------------------------------------------------
  describe('7. Logout and Session Destruction', () => {
    it('should reject logout without active session with AUTH_003', async () => {
      const res = await request(app).post('/api/auth/logout');
      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
    });

    it('should destroy session on logout and reject subsequent requests with old session cookie', async () => {
      // 1. Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.customer1', password: TEST_PASSWORD });
      const cookie = loginRes.headers['set-cookie'];

      // 2. Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      assert.equal(logoutRes.status, 200);
      assert.equal(logoutRes.body.success, true);
      assert.equal(logoutRes.body.data.message, 'Logged out');

      // 3. Attempt subsequent request with old session cookie
      const reMeRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      assert.equal(reMeRes.status, 401);
      assert.equal(reMeRes.body.errorCode, 'AUTH_003');
      assert.equal(reMeRes.body.message, 'Please log in to continue');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 8 & 9: Role-based Authorization (CUSTOMER, EMPLOYEE, ADMIN)
  // ----------------------------------------------------------------------------
  describe('8 & 9. Role-Based Access Control (requireRole & AUTH_002)', () => {
    let customerCookie;
    let employeeCookie;
    let adminCookie;

    before(async () => {
      const cRes = await request(app).post('/api/auth/login').send({ username: 'test.customer1', password: TEST_PASSWORD });
      customerCookie = cRes.headers['set-cookie'];

      const eRes = await request(app).post('/api/auth/login').send({ username: 'test.employee1', password: TEST_PASSWORD });
      employeeCookie = eRes.headers['set-cookie'];

      const aRes = await request(app).post('/api/auth/login').send({ username: 'test.admin1', password: TEST_PASSWORD });
      adminCookie = aRes.headers['set-cookie'];
    });

    it('CUSTOMER can access customer route, but rejected from employee and admin routes with AUTH_002', async () => {
      // Access allowed
      const allowRes = await request(app).get('/api/test/customer-only').set('Cookie', customerCookie);
      assert.equal(allowRes.status, 200);

      // Access denied to employee-only
      const empDenied = await request(app).get('/api/test/employee-only').set('Cookie', customerCookie);
      assert.equal(empDenied.status, 403);
      assert.equal(empDenied.body.errorCode, 'AUTH_002');
      assert.equal(empDenied.body.message, 'You are not authorized to perform this operation');

      // Access denied to admin-only
      const adminDenied = await request(app).get('/api/test/admin-only').set('Cookie', customerCookie);
      assert.equal(adminDenied.status, 403);
      assert.equal(adminDenied.body.errorCode, 'AUTH_002');
    });

    it('EMPLOYEE can access employee route, but rejected from admin route with AUTH_002', async () => {
      // Access allowed
      const allowRes = await request(app).get('/api/test/employee-only').set('Cookie', employeeCookie);
      assert.equal(allowRes.status, 200);

      // Access denied to admin-only
      const adminDenied = await request(app).get('/api/test/admin-only').set('Cookie', employeeCookie);
      assert.equal(adminDenied.status, 403);
      assert.equal(adminDenied.body.errorCode, 'AUTH_002');
      assert.equal(adminDenied.body.message, 'You are not authorized to perform this operation');
    });

    it('ADMIN can access admin route', async () => {
      const adminRes = await request(app).get('/api/test/admin-only').set('Cookie', adminCookie);
      assert.equal(adminRes.status, 200);
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 10: Unauthenticated requests to protected operations return AUTH_003
  // ----------------------------------------------------------------------------
  describe('10. Unauthenticated Access Protection', () => {
    it('should reject unauthenticated request to protected route with AUTH_003', async () => {
      const res = await request(app).get('/api/test/protected');
      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_003');
      assert.equal(res.body.message, 'Please log in to continue');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 11: User deactivated during active session is rejected on next request
  // ----------------------------------------------------------------------------
  describe('11. Dynamic Deactivation during Active Session (FR-24)', () => {
    it('should invalidate active session immediately when user is deactivated in database', async () => {
      // 1. Log in while active
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.mid_session_temp', password: TEST_PASSWORD });
      assert.equal(loginRes.status, 200);
      const cookie = loginRes.headers['set-cookie'];

      // 2. Verify protected access succeeds while ACTIVE
      const activeRes = await request(app)
        .get('/api/test/protected')
        .set('Cookie', cookie);
      assert.equal(activeRes.status, 200);

      // 3. Deactivate user directly in MySQL
      await pool.execute("UPDATE users SET status = 'INACTIVE' WHERE username = 'test.mid_session_temp'");

      // 4. Attempt next protected request with same session cookie
      const blockedRes = await request(app)
        .get('/api/test/protected')
        .set('Cookie', cookie);

      assert.equal(blockedRes.status, 401);
      assert.equal(blockedRes.body.errorCode, 'AUTH_003');
      assert.equal(blockedRes.body.message, 'Please log in to continue');

      // 5. Subsequent request should also fail because session was destroyed server-side
      const subsequentRes = await request(app)
        .get('/api/test/protected')
        .set('Cookie', cookie);
      assert.equal(subsequentRes.status, 401);
      assert.equal(subsequentRes.body.errorCode, 'AUTH_003');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 12: Password hashes are salted, secure, and never exposed
  // ----------------------------------------------------------------------------
  describe('12. Password Hashing Security & Hash Confidentiality', () => {
    it('should store bcrypt salted hashes with unique salts for identical test passwords', async () => {
      const [rows] = await pool.execute(
        "SELECT username, password_hash FROM users WHERE username IN ('test.customer1', 'test.employee1')"
      );

      assert.equal(rows.length, 2);
      const hash1 = rows[0].password_hash;
      const hash2 = rows[1].password_hash;

      // Both must be valid bcrypt hashes ($2b$ or $2a$)
      assert.ok(hash1.startsWith('$2b$') || hash1.startsWith('$2a$'), 'Must be valid bcrypt format');
      assert.ok(hash2.startsWith('$2b$') || hash2.startsWith('$2a$'), 'Must be valid bcrypt format');
      assert.equal(hash1.length, 60, 'Bcrypt hash must be 60 characters');
      assert.equal(hash2.length, 60, 'Bcrypt hash must be 60 characters');

      // Unique salt check: identical passwords must yield distinct hashes
      assert.notEqual(hash1, hash2, 'Salting must produce distinct hashes for identical passwords');

      // Verify each stored hash verifies against TEST_PASSWORD
      const verify1 = await bcrypt.compare(TEST_PASSWORD, hash1);
      const verify2 = await bcrypt.compare(TEST_PASSWORD, hash2);
      assert.equal(verify1, true);
      assert.equal(verify2, true);
    });

    it('should never expose password or password_hash fields in login or me responses', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test.admin1', password: TEST_PASSWORD });
      const cookie = loginRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      const loginBodyStr = JSON.stringify(loginRes.body).toLowerCase();
      const meBodyStr = JSON.stringify(meRes.body).toLowerCase();

      assert.ok(!loginBodyStr.includes('password_hash'), 'Login response must not contain password_hash');
      assert.ok(!meBodyStr.includes('password_hash'), 'Me response must not contain password_hash');
      assert.ok(!loginBodyStr.includes(TEST_PASSWORD.toLowerCase()), 'Login response must not contain plain password');
    });
  });

  // ----------------------------------------------------------------------------
  // Scenario 13: Errors do not leak stack traces, SQL, or internal details
  // ----------------------------------------------------------------------------
  describe('13. Safe Error Handling & Information Leakage Prevention', () => {
    it('should not leak SQL syntax or stack traces on SQL-like input in login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: "' OR 1=1 --", password: "' UNION SELECT * FROM users --" });

      assert.equal(res.status, 401);
      assert.equal(res.body.errorCode, 'AUTH_001');

      const bodyStr = JSON.stringify(res.body);
      assert.ok(!bodyStr.includes('sqlMessage'), 'Response must not leak sqlMessage');
      assert.ok(!bodyStr.includes('stack'), 'Response must not leak stack traces');
      assert.ok(!bodyStr.includes('SELECT'), 'Response must not leak SQL queries');
    });

    it('should handle missing routes without leaking internals', async () => {
      const res = await request(app).get('/api/auth/nonexistent');
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
      assert.ok(!JSON.stringify(res.body).includes('stack'));
    });
  });
});
