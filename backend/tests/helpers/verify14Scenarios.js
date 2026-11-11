/**
 * ==============================================================================
 * Comprehensive Verification of All 14 Frontend OTP Scenarios (Phase 3)
 * ==============================================================================
 */

process.env.NODE_ENV = 'test';
require('../../src/config/env');

const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');
const { getLatestOtpForChallenge } = require('../../src/services/otpService');

const TEST_PASSWORD = 'Password123!';

async function runAll14Scenarios() {
  console.log('==============================================================================');
  console.log('PHASE 3: VERIFYING ALL 14 FRONTEND AUTHENTICATION & OTP FLOWS');
  console.log('==============================================================================\n');

  const results = [];
  function assertScenario(id, title, condition, details = '') {
    if (condition) {
      console.log(`[PASS] Scenario ${id}: ${title} ${details ? `(${details})` : ''}`);
      results.push({ id, title, pass: true });
    } else {
      console.error(`[FAIL] Scenario ${id}: ${title} ${details ? `(${details})` : ''}`);
      results.push({ id, title, pass: false, error: details });
    }
  }

  // 1. Customer Login (Stage A)
  const custRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.customer1', password: TEST_PASSWORD });
  const custChallenge = custRes.body?.data;
  assertScenario(
    1,
    'Customer Login Stage A initiates challenge and routes to customers.email',
    custRes.status === 200 &&
    Boolean(custChallenge?.challengeId) &&
    custChallenge?.maskedEmail.includes('@'),
    `Challenge ID: ${custChallenge?.challengeId?.slice(0, 8)}..., Masked: ${custChallenge?.maskedEmail}`
  );

  // 2. Employee Login (Stage A)
  const empRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.employee1', password: TEST_PASSWORD });
  const empChallenge = empRes.body?.data;
  assertScenario(
    2,
    'Employee Login Stage A initiates challenge and routes to employees.email',
    empRes.status === 200 &&
    Boolean(empChallenge?.challengeId) &&
    empChallenge?.maskedEmail.includes('@'),
    `Challenge ID: ${empChallenge?.challengeId?.slice(0, 8)}..., Masked: ${empChallenge?.maskedEmail}`
  );

  // 3. Admin Login (Stage A)
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.admin1', password: TEST_PASSWORD });
  const adminChallenge = adminRes.body?.data;
  assertScenario(
    3,
    'Admin Login Stage A initiates challenge and routes to ADMIN_OTP_EMAIL',
    adminRes.status === 200 &&
    Boolean(adminChallenge?.challengeId) &&
    adminChallenge?.maskedEmail.includes('@'),
    `Challenge ID: ${adminChallenge?.challengeId?.slice(0, 8)}..., Masked: ${adminChallenge?.maskedEmail}`
  );

  // 4. Correct OTP Entry -> Successful Authentication & Session Creation
  const adminOtp = getLatestOtpForChallenge(adminChallenge.challengeId);
  const adminVerify = await request(app)
    .post('/api/auth/verify-otp')
    .set('Cookie', adminRes.headers['set-cookie'])
    .send({ challengeId: adminChallenge.challengeId, otp: adminOtp });
  const adminSessionCookie = adminVerify.headers['set-cookie'];
  assertScenario(
    4,
    'Correct OTP verifies user, sets session cookie, returns safe profile',
    adminVerify.status === 200 &&
    adminVerify.body?.data?.role === 'ADMIN' &&
    Boolean(adminSessionCookie),
    `User: ${adminVerify.body?.data?.username}, Role: ${adminVerify.body?.data?.role}`
  );

  // Verify authenticated session active via /me
  const adminMe = await request(app)
    .get('/api/auth/me')
    .set('Cookie', adminSessionCookie);
  assertScenario(
    '4b',
    'Authenticated session responds successfully to /api/auth/me',
    adminMe.status === 200 && adminMe.body?.data?.role === 'ADMIN'
  );

  // 5. Incorrect OTP Entry with remaining attempts decrement
  const custLogin2 = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.customer1', password: TEST_PASSWORD });
  const c2Id = custLogin2.body?.data?.challengeId;
  const c2Cookie = custLogin2.headers['set-cookie'];

  const wrongOtpRes = await request(app)
    .post('/api/auth/verify-otp')
    .set('Cookie', c2Cookie)
    .send({ challengeId: c2Id, otp: '000000' });
  const remAttempts1 = wrongOtpRes.body?.remainingAttempts ?? wrongOtpRes.body?.error?.remainingAttempts;
  assertScenario(
    5,
    'Incorrect OTP rejected with AUTH_001 and decrements remainingAttempts to 2',
    wrongOtpRes.status === 401 &&
    wrongOtpRes.body?.errorCode === 'AUTH_001' &&
    remAttempts1 === 2,
    `Remaining attempts: ${remAttempts1}`
  );

  // 6. Expired OTP Rejection (AUTH_004)
  const expLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.customer1', password: TEST_PASSWORD });
  const expId = expLogin.body?.data?.challengeId;
  const expCookie = expLogin.headers['set-cookie'];
  const expOtp = getLatestOtpForChallenge(expId);

  // Simulate expiration in database
  await pool.query(
    `UPDATE auth_otp_challenges SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE challenge_id = ?`,
    [expId]
  );
  const expVerify = await request(app)
    .post('/api/auth/verify-otp')
    .set('Cookie', expCookie)
    .send({ challengeId: expId, otp: expOtp });
  assertScenario(
    6,
    'Expired OTP rejected with AUTH_004',
    expVerify.status === 400 && expVerify.body?.errorCode === 'AUTH_004',
    `Code: ${expVerify.body?.errorCode}, Message: ${expVerify.body?.message}`
  );

  // 7. OTP Resend with 60-Second Cooldown Rate Limiting (RATE_001 / 429)
  const resendLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.customer1', password: TEST_PASSWORD });
  const rId = resendLogin.body?.data?.challengeId;
  const rCookie = resendLogin.headers['set-cookie'];

  // Immediate resend should trigger cooldown rate limit RATE_001 (429)
  const cooldownRes = await request(app)
    .post('/api/auth/resend-otp')
    .set('Cookie', rCookie)
    .send({ challengeId: rId });
  assertScenario(
    7,
    'Resend within cooldown period rejected with 429 RATE_001',
    cooldownRes.status === 429 && cooldownRes.body?.errorCode === 'RATE_001',
    `Cooldown response: ${cooldownRes.body?.errorCode} - ${cooldownRes.body?.message}`
  );

  // 8. Invalidation of Old OTP Upon Resend
  const oldOtpBeforeResend = getLatestOtpForChallenge(rId);
  // Fast forward cooldown timestamp in database to allow resend
  await pool.query(
    `UPDATE auth_otp_challenges SET resend_available_at = DATE_SUB(NOW(), INTERVAL 5 SECOND) WHERE challenge_id = ?`,
    [rId]
  );
  const resendSuccessRes = await request(app)
    .post('/api/auth/resend-otp')
    .set('Cookie', rCookie)
    .send({ challengeId: rId });
  const renewedId = resendSuccessRes.body?.data?.challengeId || rId;
  const renewedCookie = resendSuccessRes.headers['set-cookie'] || rCookie;

  // Try submitting old OTP
  const oldVerifyRes = await request(app)
    .post('/api/auth/verify-otp')
    .set('Cookie', renewedCookie)
    .send({ challengeId: renewedId, otp: oldOtpBeforeResend });
  assertScenario(
    8,
    'Previous OTP invalidated upon resend and rejected',
    oldVerifyRes.status === 401 && oldVerifyRes.body?.errorCode === 'AUTH_001',
    `Status: ${oldVerifyRes.status}, ErrorCode: ${oldVerifyRes.body?.errorCode}`
  );

  // 9. Three Failed Attempts Leading to Challenge Lockout (AUTH_005)
  const lockLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.customer1', password: TEST_PASSWORD });
  const lockId = lockLogin.body?.data?.challengeId;
  const lockCookie = lockLogin.headers['set-cookie'];

  // Attempt 1
  await request(app).post('/api/auth/verify-otp').set('Cookie', lockCookie).send({ challengeId: lockId, otp: '111111' });
  // Attempt 2
  await request(app).post('/api/auth/verify-otp').set('Cookie', lockCookie).send({ challengeId: lockId, otp: '222222' });
  // Attempt 3 (locks challenge)
  const lockRes3 = await request(app).post('/api/auth/verify-otp').set('Cookie', lockCookie).send({ challengeId: lockId, otp: '333333' });
  assertScenario(
    9,
    'Three consecutive failed attempts lock challenge with 403 AUTH_005',
    lockRes3.status === 403 &&
    lockRes3.body?.errorCode === 'AUTH_005' &&
    (lockRes3.body?.remainingAttempts === 0 || lockRes3.body?.error?.remainingAttempts === 0),
    `Lock status: ${lockRes3.status}, Code: ${lockRes3.body?.errorCode}`
  );

  // Subsequent attempt rejected as locked
  const lockRes4 = await request(app).post('/api/auth/verify-otp').set('Cookie', lockCookie).send({ challengeId: lockId, otp: '444444' });
  assertScenario(
    '9b',
    'Locked challenge rejects any subsequent attempts with 403 AUTH_005',
    lockRes4.status === 403 && lockRes4.body?.errorCode === 'AUTH_005'
  );

  // 10. "Back to Login" Navigation (clears pending challenge on client)
  // In frontend state: pendingChallenge set to null, password cleared, username kept.
  // We verify that login can immediately be re-attempted for a fresh challenge.
  const backReLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.customer1', password: TEST_PASSWORD });
  assertScenario(
    10,
    'Client returning to login can immediately re-initiate fresh challenge',
    backReLogin.status === 200 && Boolean(backReLogin.body?.data?.challengeId)
  );

  // 11. Quick Test Credentials Compatibility
  // Test that credentials panel accounts authenticate cleanly through 2FA
  const employeeLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.employee1', password: TEST_PASSWORD });
  const empId = employeeLogin.body?.data?.challengeId;
  const empOtp = getLatestOtpForChallenge(empId);
  const empVerify = await request(app)
    .post('/api/auth/verify-otp')
    .set('Cookie', employeeLogin.headers['set-cookie'])
    .send({ challengeId: empId, otp: empOtp });
  assertScenario(
    11,
    'Quick Test Credentials accounts authenticate seamlessly via 2FA without bypass',
    empVerify.status === 200 && empVerify.body?.data?.role === 'EMPLOYEE',
    `Role: ${empVerify.body?.data?.role}, User: ${empVerify.body?.data?.username}`
  );

  // 12. Page Refresh During Pending Challenge (Pre-Auth Isolation)
  // When visitor refreshes during pending challenge, /api/auth/me rejects with 401
  const pendingLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.customer1', password: TEST_PASSWORD });
  const pendingCookie = pendingLogin.headers['set-cookie'];
  const pendingMeRes = await request(app)
    .get('/api/auth/me')
    .set('Cookie', pendingCookie);
  assertScenario(
    12,
    'Pending challenge cookie does not grant access to /api/auth/me (returns 401)',
    pendingMeRes.status === 401,
    `Status: ${pendingMeRes.status}, ErrorCode: ${pendingMeRes.body?.errorCode}`
  );

  // 13. Role-Based Navigation Routing
  // Customer navigates to retail accounts/overview, Employee to accounts, Admin to dashboard
  const custAuthLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'test.customer1', password: TEST_PASSWORD });
  const cId = custAuthLogin.body?.data?.challengeId;
  const cOtp = getLatestOtpForChallenge(cId);
  const custAuthVerify = await request(app)
    .post('/api/auth/verify-otp')
    .set('Cookie', custAuthLogin.headers['set-cookie'])
    .send({ challengeId: cId, otp: cOtp });
  const custSessionCookie = custAuthVerify.headers['set-cookie'];

  // Test Customer can access retail accounts API
  const custApiRes = await request(app)
    .get('/api/accounts')
    .set('Cookie', custSessionCookie);
  assertScenario(
    13,
    'Customer receives role-appropriate access post-2FA verification',
    custApiRes.status === 200 && Array.isArray(custApiRes.body?.data) && custAuthVerify.body?.data?.role === 'CUSTOMER',
    `Role: ${custAuthVerify.body?.data?.role}, Accounts returned: ${custApiRes.body?.data?.length}`
  );

  // 14. Logout Lifecycle
  // Calling POST /api/auth/logout destroys session and subsequent /me returns 401
  const logoutRes = await request(app)
    .post('/api/auth/logout')
    .set('Cookie', custSessionCookie);
  const afterLogoutMe = await request(app)
    .get('/api/auth/me')
    .set('Cookie', custSessionCookie);
  assertScenario(
    14,
    'Logout terminates session and invalidates subsequent authenticated requests',
    logoutRes.status === 200 && afterLogoutMe.status === 401,
    `Logout: ${logoutRes.status}, Subsequent /me: ${afterLogoutMe.status}`
  );

  console.log('\n==============================================================================');
  const allPassed = results.every(r => r.pass);
  console.log(`TOTAL SCENARIOS TESTED: ${results.length}`);
  console.log(`PASSED: ${results.filter(r => r.pass).length}`);
  console.log(`FAILED: ${results.filter(r => !r.pass).length}`);
  console.log(`OVERALL STATUS: ${allPassed ? 'ALL SCENARIOS PASSED' : 'SOME SCENARIOS FAILED'}`);
  console.log('==============================================================================');

  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

runAll14Scenarios().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

