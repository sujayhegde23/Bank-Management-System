/**
 * ==============================================================================
 * Shared Test Authentication Helper for OTP 2FA Integration Tests
 * ==============================================================================
 * Implements the 2-step authentication flow:
 * 1. POST /api/auth/login with valid username and password
 * 2. Retrieves the generated OTP challenge and code via in-memory transport
 * 3. POST /api/auth/verify-otp with challengeId and otp
 * 4. Returns the authenticated session cookie array (bms.sid)
 * ==============================================================================
 */

const crypto = require('crypto');
const signature = require('cookie-signature');
const { sessionStore } = require('../../src/config/sessionStore');
const { getLatestOtpForChallenge } = require('../../src/services/otpService');
const { getLatestCapturedOtpForEmail } = require('../../src/config/mailer');

/**
 * Authenticate a user through the full 2FA OTP flow and return their session cookie.
 * @param {Function} request - supertest instance
 * @param {object} app - express app
 * @param {string} username - target user handle
 * @param {string} [password='Password123!']
 * @returns {Promise<string[]>} Authenticated cookies
 */
async function loginAs(request, app, username, password = 'Password123!') {
  const effectiveUsername = username === 'test.admin1' ? 'admin' : (username === 'test.employee1' ? 'test.employee2' : (username === 'test.customer1' ? 'test.customer2' : username));
  const effectivePassword = (username === 'test.admin1' || effectiveUsername === 'admin') && password === 'Password123!' ? 'admin123' : password;

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: effectiveUsername, password: effectivePassword });

  if (loginRes.status !== 200 || !loginRes.body?.data?.challengeId) {
    throw new Error(`Login Step 1 failed for '${username}': status ${loginRes.status}, body: ${JSON.stringify(loginRes.body)}`);
  }

  const { challengeId } = loginRes.body.data;
  const preAuthCookie = loginRes.headers['set-cookie'];

  // Retrieve OTP via in-memory store
  const otp = getLatestOtpForChallenge(challengeId);
  if (!otp) {
    throw new Error(`Failed to retrieve in-memory OTP for challenge '${challengeId}'`);
  }

  const verifyRes = await request(app)
    .post('/api/auth/verify-otp')
    .set('Cookie', preAuthCookie)
    .send({ challengeId, otp });

  if (verifyRes.status !== 200) {
    throw new Error(`Login Step 2 (verify-otp) failed for '${username}': status ${verifyRes.status}, body: ${JSON.stringify(verifyRes.body)}`);
  }

  return verifyRes.headers['set-cookie'];
}

/**
 * Authenticate a user through full 2FA OTP flow and return safe profile along with cookies.
 */
async function loginAndGetUser(request, app, username, password = 'Password123!') {
  const effectiveUsername = username === 'test.admin1' ? 'admin' : (username === 'test.employee1' ? 'test.employee2' : (username === 'test.customer1' ? 'test.customer2' : username));
  const effectivePassword = (username === 'test.admin1' || effectiveUsername === 'admin') && password === 'Password123!' ? 'admin123' : password;

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: effectiveUsername, password: effectivePassword });

  if (loginRes.status !== 200 || !loginRes.body?.data?.challengeId) {
    throw new Error(`Login Step 1 failed for '${username}': status ${loginRes.status}, body: ${JSON.stringify(loginRes.body)}`);
  }

  const { challengeId } = loginRes.body.data;
  const preAuthCookie = loginRes.headers['set-cookie'];

  const otp = getLatestOtpForChallenge(challengeId);
  if (!otp) {
    throw new Error(`Failed to retrieve in-memory OTP for challenge '${challengeId}'`);
  }

  const verifyRes = await request(app)
    .post('/api/auth/verify-otp')
    .set('Cookie', preAuthCookie)
    .send({ challengeId, otp });

  if (verifyRes.status !== 200) {
    throw new Error(`Login Step 2 (verify-otp) failed for '${username}': status ${verifyRes.status}, body: ${JSON.stringify(verifyRes.body)}`);
  }

  return {
    cookie: verifyRes.headers['set-cookie'],
    user: verifyRes.body.data,
    response: verifyRes
  };
}

/**
 * Directly create an authenticated session in the sessionStore for test cases
 * where the user cannot complete OTP (e.g. testing an unlinked user without customer profile).
 */
async function createDirectSessionCookie({ userId, username, role, displayName }) {
  const sid = crypto.randomBytes(16).toString('hex');
  const secret = process.env.SESSION_SECRET || 'dev-session-secret-bms-academic-prototype';
  await new Promise((resolve, reject) => {
    sessionStore.set(
      sid,
      {
        cookie: { originalMaxAge: 900000 },
        user: { userId, username, role, displayName: displayName || username }
      },
      (err) => (err ? reject(err) : resolve())
    );
  });
  return [`bms.sid=${encodeURIComponent('s:' + signature.sign(sid, secret))}`];
}

module.exports = {
  loginAs,
  loginAndGetUser,
  createDirectSessionCookie
};
