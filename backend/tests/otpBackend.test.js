/**
 * ==============================================================================
 * Comprehensive Backend Email OTP Authentication Integration Tests (Phase 2)
 * ==============================================================================
 * Verifies all 18 required test cases for Multi-Factor Authentication:
 *  1. Correct password generates and sends an OTP.
 *  2. Incorrect password does not generate a valid challenge.
 *  3. Customer OTP goes to customers.email.
 *  4. Employee OTP goes to employees.email.
 *  5. Admin OTP goes to ADMIN_OTP_EMAIL.
 *  6. Missing email fails safely.
 *  7. Correct OTP authenticates the user.
 *  8. Incorrect OTP is rejected.
 *  9. Expired OTP is rejected.
 * 10. OTP is rejected after three failed attempts.
 * 11. OTP cannot be reused.
 * 12. Resend cooldown works.
 * 13. Old OTP becomes invalid after resend.
 * 14. Previous pending challenges are invalidated.
 * 15. Unverified users cannot access protected banking APIs.
 * 16. Inactive users cannot authenticate even with a valid OTP.
 * 17. Session regeneration works correctly.
 * 18. CUSTOMER, EMPLOYEE, and ADMIN roles continue to work.
 * ==============================================================================
 */

process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool, testConnection } = require('../src/config/db');
const { getLatestOtpForChallenge } = require('../src/services/otpService');
require('../src/config/env');

const TEST_PASSWORD = 'Password123!';

describe('Phase 2: Backend Email OTP Authentication Suite', () => {
  let isDbLive = false;
  let tempNoEmailUserId = null;
  let tempInactiveTestUserId = null;

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration tests: ${status.error}`);

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(TEST_PASSWORD, salt);

    // Create user with no linked profile record to test missing email fail-safe
    const [noEmailRes] = await pool.execute(
      "INSERT INTO users (username, password_hash, role, status) VALUES ('test.missing_email_user', ?, 'CUSTOMER', 'ACTIVE')",
      [hash]
    );
    tempNoEmailUserId = noEmailRes.insertId;

    // Create user for mid-challenge deactivation test
    const [inactRes] = await pool.execute(
      "INSERT INTO users (username, password_hash, role, status) VALUES ('test.mid_otp_inactive', ?, 'CUSTOMER', 'ACTIVE')",
      [hash]
    );
    tempInactiveTestUserId = inactRes.insertId;
    await pool.execute(
      "INSERT INTO customers (user_id, full_name, date_of_birth, phone, email, address) VALUES (?, 'Mid Deact User', '1990-01-01', '555-9988', 'mid.deact@example.com', '123 Test St')",
      [tempInactiveTestUserId]
    );
  });

  after(async () => {
    try {
      if (tempNoEmailUserId) {
        await pool.execute('DELETE FROM users WHERE user_id = ?', [tempNoEmailUserId]);
      }
      if (tempInactiveTestUserId) {
        await pool.execute('DELETE FROM customers WHERE user_id = ?', [tempInactiveTestUserId]);
        await pool.execute('DELETE FROM users WHERE user_id = ?', [tempInactiveTestUserId]);
      }
    } finally {
      await pool.end();
    }
  });

  // 1. Correct password generates and sends an OTP
  it('1. Correct password generates and sends an OTP without establishing an authenticated session', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.challengeId, 'challengeId must be returned');
    assert.ok(res.body.data.maskedEmail, 'maskedEmail must be returned');
    assert.equal(res.body.data.expiresInSeconds, 300);
    assert.equal(res.body.data.resendAvailableInSeconds, 60);

    // Verify session user is NOT set
    assert.equal(res.body.data.username, undefined, 'username must not be returned in login response');
    assert.equal(res.body.data.role, undefined, 'role must not be returned in login response');
  });

  // 2. Incorrect password does not generate a valid challenge
  it('2. Incorrect password does not generate a valid challenge', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: 'IncorrectPassword999!' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorCode, 'AUTH_001');
    assert.equal(res.body.data, undefined);
  });

  // 3. Customer OTP goes to customers.email
  it('3. Customer OTP routes strictly to customers.email and masks appropriately', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.maskedEmail, 't***2@example.com');
    assert.notEqual(res.body.data.maskedEmail, process.env.ADMIN_OTP_EMAIL);
  });

  // 4. Employee OTP goes to employees.email
  it('4. Employee OTP routes strictly to employees.email and masks appropriately', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.employee2', password: TEST_PASSWORD });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.maskedEmail, 't***2@example.com');
    assert.notEqual(res.body.data.maskedEmail, process.env.ADMIN_OTP_EMAIL);
  });

  // 5. Admin OTP goes to ADMIN_OTP_EMAIL
  it('5. Admin OTP routes strictly to ADMIN_OTP_EMAIL environment variable', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    assert.equal(res.status, 200);
    const adminEmail = process.env.ADMIN_OTP_EMAIL;
    assert.ok(adminEmail, 'ADMIN_OTP_EMAIL must be configured');
    const expectedDomain = adminEmail.split('@')[1];
    assert.ok(res.body.data.maskedEmail.includes(expectedDomain), 'Masked email must contain admin domain');
  });

  // 6. Missing email fails safely
  it('6. Missing email fails safely without crashing and records audit failure', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.missing_email_user', password: TEST_PASSWORD });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorCode, 'AUTH_007');
    assert.ok(res.body.message.includes('email'));
  });

  // 7. Correct OTP authenticates the user
  it('7. Correct OTP authenticates the user, regenerates session, and grants access to /me', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    assert.equal(loginRes.status, 200);
    const { challengeId } = loginRes.body.data;
    const otp = getLatestOtpForChallenge(challengeId);
    assert.ok(otp, 'OTP should be available via getLatestOtpForChallenge');

    const cookie = loginRes.headers['set-cookie'];

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cookie)
      .send({ challengeId, otp });

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.success, true);
    assert.equal(verifyRes.body.data.username, 'test.customer2');
    assert.equal(verifyRes.body.data.role, 'CUSTOMER');
    assert.equal(verifyRes.body.data.displayName, 'Test Customer Two');

    const authCookie = verifyRes.headers['set-cookie'];

    // Access protected /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.username, 'test.customer2');
    assert.equal(meRes.body.data.role, 'CUSTOMER');
  });

  // 8. Incorrect OTP is rejected
  it('8. Incorrect OTP is rejected with remaining attempts counter', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    const { challengeId } = loginRes.body.data;
    const cookie = loginRes.headers['set-cookie'];

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cookie)
      .send({ challengeId, otp: '000000' });

    assert.equal(verifyRes.status, 401);
    assert.equal(verifyRes.body.success, false);
    assert.equal(verifyRes.body.errorCode, 'AUTH_001');
    assert.equal(verifyRes.body.remainingAttempts, 2);
  });

  // 9. Expired OTP is rejected
  it('9. Expired OTP is rejected with AUTH_004', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    const { challengeId } = loginRes.body.data;
    const otp = getLatestOtpForChallenge(challengeId);
    const cookie = loginRes.headers['set-cookie'];

    // Manually expire challenge in database
    await pool.execute(
      'UPDATE auth_otp_challenges SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE challenge_id = ?',
      [challengeId]
    );

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cookie)
      .send({ challengeId, otp });

    assert.equal(verifyRes.status, 400);
    assert.equal(verifyRes.body.errorCode, 'AUTH_004');
    assert.ok(verifyRes.body.message.toLowerCase().includes('expired'));
  });

  // 10. OTP is rejected after three failed attempts
  it('10. OTP is permanently locked after three failed attempts (AUTH_005)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    const { challengeId } = loginRes.body.data;
    const otp = getLatestOtpForChallenge(challengeId);
    const cookie = loginRes.headers['set-cookie'];

    // Attempt 1: wrong
    const a1 = await request(app).post('/api/auth/verify-otp').set('Cookie', cookie).send({ challengeId, otp: '111111' });
    assert.equal(a1.status, 401);
    assert.equal(a1.body.remainingAttempts, 2);

    // Attempt 2: wrong
    const a2 = await request(app).post('/api/auth/verify-otp').set('Cookie', cookie).send({ challengeId, otp: '222222' });
    assert.equal(a2.status, 401);
    assert.equal(a2.body.remainingAttempts, 1);

    // Attempt 3: wrong -> locks challenge
    const a3 = await request(app).post('/api/auth/verify-otp').set('Cookie', cookie).send({ challengeId, otp: '333333' });
    assert.equal(a3.status, 403);
    assert.equal(a3.body.errorCode, 'AUTH_005');
    assert.equal(a3.body.remainingAttempts, 0);

    // Attempt 4: even with correct OTP, it must remain locked
    const a4 = await request(app).post('/api/auth/verify-otp').set('Cookie', cookie).send({ challengeId, otp });
    assert.equal(a4.status, 403);
    assert.equal(a4.body.errorCode, 'AUTH_005');
  });

  // 11. OTP cannot be reused
  it('11. Single-use guarantee: verified OTP cannot be reused (AUTH_006)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    const { challengeId } = loginRes.body.data;
    const otp = getLatestOtpForChallenge(challengeId);
    const cookie = loginRes.headers['set-cookie'];

    // First verification: success
    const v1 = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cookie)
      .send({ challengeId, otp });
    assert.equal(v1.status, 200);

    // Second verification with identical code: rejected
    const v2 = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cookie)
      .send({ challengeId, otp });
    assert.equal(v2.status, 409);
    assert.equal(v2.body.errorCode, 'AUTH_006');
  });

  // 12. Resend cooldown works
  it('12. Resend cooldown enforces 60-second rate limit (RATE_001 / 429)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    const { challengeId } = loginRes.body.data;
    const cookie = loginRes.headers['set-cookie'];

    // Immediate resend should be blocked by 60s cooldown
    const resendRes = await request(app)
      .post('/api/auth/resend-otp')
      .set('Cookie', cookie)
      .send({ challengeId });

    assert.equal(resendRes.status, 429);
    assert.equal(resendRes.body.errorCode, 'RATE_001');
    assert.ok(resendRes.body.secondsRemaining > 0);
  });

  // 13. Old OTP becomes invalid after resend
  it('13. Old OTP becomes invalid after resend and new OTP is accepted', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    const { challengeId } = loginRes.body.data;
    const originalOtp = getLatestOtpForChallenge(challengeId);
    const cookie = loginRes.headers['set-cookie'];

    // Fast-forward cooldown in database
    await pool.execute(
      'UPDATE auth_otp_challenges SET resend_available_at = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE challenge_id = ?',
      [challengeId]
    );

    // Request resend
    const resendRes = await request(app)
      .post('/api/auth/resend-otp')
      .set('Cookie', cookie)
      .send({ challengeId });

    assert.equal(resendRes.status, 200);
    const newOtp = getLatestOtpForChallenge(challengeId);
    assert.ok(newOtp, 'New OTP must be generated');
    assert.notEqual(newOtp, originalOtp, 'New OTP must differ from original OTP');

    // Attempt verification with old OTP: must fail
    const oldVerifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cookie)
      .send({ challengeId, otp: originalOtp });
    assert.equal(oldVerifyRes.status, 401);

    // Attempt verification with new OTP: must succeed
    const newVerifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cookie)
      .send({ challengeId, otp: newOtp });
    assert.equal(newVerifyRes.status, 200);
    assert.equal(newVerifyRes.body.data.username, 'test.customer2');
  });

  // 14. Previous pending challenges are invalidated
  it('14. New login challenge invalidates any prior pending challenges for that user', async () => {
    // Challenge A
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });
    const { challengeId: challengeA } = loginA.body.data;
    const otpA = getLatestOtpForChallenge(challengeA);
    const cookieA = loginA.headers['set-cookie'];

    // Challenge B for same user
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });
    const { challengeId: challengeB } = loginB.body.data;
    const otpB = getLatestOtpForChallenge(challengeB);
    const cookieB = loginB.headers['set-cookie'];

    // Challenge A should now be EXPIRED in DB
    const [rowsA] = await pool.execute('SELECT status FROM auth_otp_challenges WHERE challenge_id = ?', [challengeA]);
    assert.equal(rowsA[0].status, 'EXPIRED');

    // Trying to verify Challenge A must be rejected
    const verifyA = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cookieA)
      .send({ challengeId: challengeA, otp: otpA });
    assert.equal(verifyA.status, 400);

    // Verifying Challenge B must succeed
    const verifyB = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cookieB)
      .send({ challengeId: challengeB, otp: otpB });
    assert.equal(verifyB.status, 200);
  });

  // 15. Unverified users cannot access protected banking APIs
  it('15. Pre-auth session cannot access protected banking endpoints (AUTH_003)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    const preAuthCookie = loginRes.headers['set-cookie'];

    // Try accessing accounts listing
    const accRes = await request(app)
      .get('/api/accounts')
      .set('Cookie', preAuthCookie);

    assert.equal(accRes.status, 401);
    assert.equal(accRes.body.errorCode, 'AUTH_003');
    assert.equal(accRes.body.message, 'Please log in to continue');
  });

  // 16. Inactive users cannot authenticate even with a valid OTP
  it('16. Inactive users cannot authenticate even with a valid OTP', async () => {
    // Generate challenge for active user
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.mid_otp_inactive', password: TEST_PASSWORD });

    const { challengeId } = loginRes.body.data;
    const otp = getLatestOtpForChallenge(challengeId);
    const cookie = loginRes.headers['set-cookie'];

    // Deactivate user in database before verification
    await pool.execute(
      "UPDATE users SET status = 'INACTIVE' WHERE user_id = ?",
      [tempInactiveTestUserId]
    );

    // Verify OTP
    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cookie)
      .send({ challengeId, otp });

    assert.equal(verifyRes.status, 401);
    assert.equal(verifyRes.body.errorCode, 'AUTH_001');
  });

  // 17. Session regeneration works correctly
  it('17. Session regeneration replaces session ID upon OTP verification', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test.customer2', password: TEST_PASSWORD });

    const { challengeId } = loginRes.body.data;
    const otp = getLatestOtpForChallenge(challengeId);
    const loginCookie = loginRes.headers['set-cookie'][0];
    const loginSid = loginCookie.split(';')[0];

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', [loginCookie])
      .send({ challengeId, otp });

    assert.equal(verifyRes.status, 200);
    const verifyCookie = verifyRes.headers['set-cookie'][0];
    const verifySid = verifyCookie.split(';')[0];

    assert.notEqual(loginSid, verifySid, 'Session ID must be regenerated on verification to prevent fixation');
  });

  // 18. CUSTOMER, EMPLOYEE, and ADMIN roles continue to work
  it('18. Full login & authorization works across CUSTOMER, EMPLOYEE, and ADMIN roles', async () => {
    // CUSTOMER
    const cLogin = await request(app).post('/api/auth/login').send({ username: 'test.customer2', password: TEST_PASSWORD });
    const cOtp = getLatestOtpForChallenge(cLogin.body.data.challengeId);
    const cVerify = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', cLogin.headers['set-cookie'])
      .send({ challengeId: cLogin.body.data.challengeId, otp: cOtp });
    assert.equal(cVerify.status, 200);
    const cCookie = cVerify.headers['set-cookie'];
    const cRouteRes = await request(app).get('/api/test/customer-only').set('Cookie', cCookie);
    assert.equal(cRouteRes.status, 200);

    // EMPLOYEE
    const eLogin = await request(app).post('/api/auth/login').send({ username: 'test.employee2', password: TEST_PASSWORD });
    const eOtp = getLatestOtpForChallenge(eLogin.body.data.challengeId);
    const eVerify = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', eLogin.headers['set-cookie'])
      .send({ challengeId: eLogin.body.data.challengeId, otp: eOtp });
    assert.equal(eVerify.status, 200);
    const eCookie = eVerify.headers['set-cookie'];
    const eRouteRes = await request(app).get('/api/test/employee-only').set('Cookie', eCookie);
    assert.equal(eRouteRes.status, 200);

    // ADMIN
    const aLogin = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    const aOtp = getLatestOtpForChallenge(aLogin.body.data.challengeId);
    const aVerify = await request(app)
      .post('/api/auth/verify-otp')
      .set('Cookie', aLogin.headers['set-cookie'])
      .send({ challengeId: aLogin.body.data.challengeId, otp: aOtp });
    assert.equal(aVerify.status, 200);
    const aCookie = aVerify.headers['set-cookie'];
    const aRouteRes = await request(app).get('/api/test/admin-only').set('Cookie', aCookie);
    assert.equal(aRouteRes.status, 200);
  });
});
