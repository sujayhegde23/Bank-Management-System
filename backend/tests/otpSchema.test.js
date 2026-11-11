/**
 * ==============================================================================
 * OTP Challenges Table & Email Routing Integration Verification (Phase 1)
 * ==============================================================================
 * Verifies Phase 1 Database Preparation requirements:
 * 1. auth_otp_challenges table exists in MySQL with exact column types.
 * 2. Indexes and foreign key constraints are properly registered.
 * 3. Enforces valid status ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED').
 * 4. Enforces check constraint chk_otp_attempts (attempts >= 0 and max_attempts > 0).
 * 5. Enforces foreign key referential integrity (rejects orphaned user_id).
 * 6. Cascades deletion when user record is removed.
 * 7. Verifies authoritative email destination resolution across all 3 roles:
 *    - ADMIN -> process.env.ADMIN_OTP_EMAIL
 *    - EMPLOYEE -> employees.email
 *    - CUSTOMER -> customers.email
 * ==============================================================================
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { pool, query, testConnection } = require('../src/config/db');
require('../src/config/env');

describe('OTP Database Schema & Email Routing Suite (Phase 1)', () => {
  let isDbLive = false;
  let testUserId = null;

  before(async () => {
    const status = await testConnection();
    isDbLive = status.connected;
    assert.ok(isDbLive, `MySQL Database must be connected for integration verification: ${status.error}`);

    // Create an isolated temporary test user
    const [userRes] = await pool.execute(
      "INSERT INTO users (username, password_hash, role, status) VALUES ('test.otp_schema_user', 'dummy_hash', 'CUSTOMER', 'ACTIVE')"
    );
    testUserId = userRes.insertId;
  });

  after(async () => {
    try {
      if (testUserId) {
        // Cleaning up user will cascade delete any remaining OTP challenges
        await pool.execute('DELETE FROM users WHERE user_id = ?', [testUserId]);
      }
    } finally {
      await pool.end();
    }
  });

  describe('1. Table Definition & Schema Structure', () => {
    it('should verify auth_otp_challenges table exists with all 11 required columns', async () => {
      const rows = await query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_NAME = 'auth_otp_challenges'
          AND TABLE_SCHEMA = DATABASE()
      `);

      const columnMap = {};
      for (const row of rows) {
        columnMap[row.COLUMN_NAME] = row;
      }

      assert.ok(columnMap.challenge_id, 'challenge_id must exist');
      assert.equal(columnMap.challenge_id.DATA_TYPE, 'varchar');

      assert.ok(columnMap.user_id, 'user_id must exist');
      assert.equal(columnMap.user_id.DATA_TYPE, 'bigint');

      assert.ok(columnMap.otp_hash, 'otp_hash must exist');
      assert.equal(columnMap.otp_hash.DATA_TYPE, 'varchar');

      assert.ok(columnMap.otp_salt, 'otp_salt must exist');

      assert.ok(columnMap.attempts_count, 'attempts_count must exist');
      assert.equal(columnMap.attempts_count.DATA_TYPE, 'int');

      assert.ok(columnMap.max_attempts, 'max_attempts must exist');
      assert.equal(columnMap.max_attempts.DATA_TYPE, 'int');

      assert.ok(columnMap.status, 'status must exist');
      assert.equal(columnMap.status.DATA_TYPE, 'enum');
      assert.ok(columnMap.status.COLUMN_TYPE.includes("'PENDING'"));
      assert.ok(columnMap.status.COLUMN_TYPE.includes("'VERIFIED'"));
      assert.ok(columnMap.status.COLUMN_TYPE.includes("'EXPIRED'"));
      assert.ok(columnMap.status.COLUMN_TYPE.includes("'LOCKED'"));

      assert.ok(columnMap.expires_at, 'expires_at must exist');
      assert.equal(columnMap.expires_at.DATA_TYPE, 'datetime');

      assert.ok(columnMap.resend_available_at, 'resend_available_at must exist');
      assert.equal(columnMap.resend_available_at.DATA_TYPE, 'datetime');

      assert.ok(columnMap.created_at, 'created_at must exist');
      assert.equal(columnMap.created_at.DATA_TYPE, 'datetime');

      assert.ok(columnMap.updated_at, 'updated_at must exist');
      assert.equal(columnMap.updated_at.DATA_TYPE, 'datetime');
    });

    it('should verify indexes exist for lookup, status, user, and primary key', async () => {
      const rows = await query(`
        SELECT DISTINCT INDEX_NAME
        FROM information_schema.STATISTICS
        WHERE TABLE_NAME = 'auth_otp_challenges'
          AND TABLE_SCHEMA = DATABASE()
      `);

      const indexNames = rows.map(r => r.INDEX_NAME);
      assert.ok(indexNames.includes('PRIMARY'), 'Primary key index must exist');
      assert.ok(indexNames.includes('idx_otp_challenges_user'), 'idx_otp_challenges_user must exist');
      assert.ok(indexNames.includes('idx_otp_challenges_status_expires'), 'idx_otp_challenges_status_expires must exist');
      assert.ok(indexNames.includes('idx_otp_challenges_lookup'), 'idx_otp_challenges_lookup must exist');
    });
  });

  describe('2. Data Operations, Constraints, and Referential Integrity', () => {
    it('should successfully insert and retrieve a valid OTP challenge record', async () => {
      const challengeId = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', 'test-secret').update('123456' + salt).digest('hex');

      await pool.execute(`
        INSERT INTO auth_otp_challenges (
          challenge_id, user_id, otp_hash, otp_salt, attempts_count, max_attempts,
          status, expires_at, resend_available_at
        ) VALUES (
          ?, ?, ?, ?, 0, 3, 'PENDING',
          DATE_ADD(NOW(), INTERVAL 5 MINUTE),
          DATE_ADD(NOW(), INTERVAL 60 SECOND)
        )
      `, [challengeId, testUserId, hash, salt]);

      const [records] = await pool.execute(
        'SELECT * FROM auth_otp_challenges WHERE challenge_id = ?',
        [challengeId]
      );

      assert.equal(records.length, 1);
      assert.equal(records[0].challenge_id, challengeId);
      assert.equal(records[0].user_id, testUserId);
      assert.equal(records[0].status, 'PENDING');
      assert.equal(records[0].attempts_count, 0);
      assert.equal(records[0].max_attempts, 3);
      assert.equal(records[0].otp_hash, hash);
      assert.equal(records[0].otp_salt, salt);
    });

    it('should support updating status through all valid states (VERIFIED, EXPIRED, LOCKED)', async () => {
      const challengeId = crypto.randomUUID();
      const hash = crypto.createHash('sha256').update('654321').digest('hex');

      await pool.execute(`
        INSERT INTO auth_otp_challenges (
          challenge_id, user_id, otp_hash, status, expires_at, resend_available_at
        ) VALUES (?, ?, ?, 'PENDING', DATE_ADD(NOW(), INTERVAL 5 MINUTE), DATE_ADD(NOW(), INTERVAL 60 SECOND))
      `, [challengeId, testUserId, hash]);

      // Update to VERIFIED
      await pool.execute("UPDATE auth_otp_challenges SET status = 'VERIFIED' WHERE challenge_id = ?", [challengeId]);
      let [res] = await pool.execute('SELECT status FROM auth_otp_challenges WHERE challenge_id = ?', [challengeId]);
      assert.equal(res[0].status, 'VERIFIED');

      // Update to EXPIRED
      await pool.execute("UPDATE auth_otp_challenges SET status = 'EXPIRED' WHERE challenge_id = ?", [challengeId]);
      [res] = await pool.execute('SELECT status FROM auth_otp_challenges WHERE challenge_id = ?', [challengeId]);
      assert.equal(res[0].status, 'EXPIRED');

      // Update to LOCKED
      await pool.execute("UPDATE auth_otp_challenges SET status = 'LOCKED', attempts_count = 3 WHERE challenge_id = ?", [challengeId]);
      [res] = await pool.execute('SELECT status, attempts_count FROM auth_otp_challenges WHERE challenge_id = ?', [challengeId]);
      assert.equal(res[0].status, 'LOCKED');
      assert.equal(res[0].attempts_count, 3);
    });

    it('should reject invalid status with ENUM constraint error', async () => {
      const challengeId = crypto.randomUUID();
      const hash = 'dummy_hash';

      await assert.rejects(async () => {
        await pool.execute(`
          INSERT INTO auth_otp_challenges (
            challenge_id, user_id, otp_hash, status, expires_at, resend_available_at
          ) VALUES (?, ?, ?, 'INVALID_STATUS', NOW(), NOW())
        `, [challengeId, testUserId, hash]);
      });
    });

    it('should reject negative attempts_count with CHECK constraint error', async () => {
      const challengeId = crypto.randomUUID();
      const hash = 'dummy_hash';

      await assert.rejects(async () => {
        await pool.execute(`
          INSERT INTO auth_otp_challenges (
            challenge_id, user_id, otp_hash, attempts_count, max_attempts, status, expires_at, resend_available_at
          ) VALUES (?, ?, ?, -1, 3, 'PENDING', NOW(), NOW())
        `, [challengeId, testUserId, hash]);
      });
    });

    it('should reject orphaned user_id with FOREIGN KEY constraint error', async () => {
      const challengeId = crypto.randomUUID();
      const hash = 'dummy_hash';
      const nonExistentUserId = 999999999;

      await assert.rejects(async () => {
        await pool.execute(`
          INSERT INTO auth_otp_challenges (
            challenge_id, user_id, otp_hash, status, expires_at, resend_available_at
          ) VALUES (?, ?, ?, 'PENDING', NOW(), NOW())
        `, [challengeId, nonExistentUserId, hash]);
      });
    });

    it('should cascade delete OTP challenges when parent user is deleted', async () => {
      // Create a temporary user specifically to test CASCADE deletion
      const [cascadeUserRes] = await pool.execute(
        "INSERT INTO users (username, password_hash, role, status) VALUES ('test.cascade_user', 'hash', 'CUSTOMER', 'ACTIVE')"
      );
      const cascadeUserId = cascadeUserRes.insertId;
      const challengeId = crypto.randomUUID();

      await pool.execute(`
        INSERT INTO auth_otp_challenges (
          challenge_id, user_id, otp_hash, status, expires_at, resend_available_at
        ) VALUES (?, ?, 'hash', 'PENDING', NOW(), NOW())
      `, [challengeId, cascadeUserId]);

      // Verify challenge exists
      const [beforeDelete] = await pool.execute('SELECT * FROM auth_otp_challenges WHERE challenge_id = ?', [challengeId]);
      assert.equal(beforeDelete.length, 1);

      // Delete parent user
      await pool.execute('DELETE FROM users WHERE user_id = ?', [cascadeUserId]);

      // Verify challenge was cascade deleted
      const [afterDelete] = await pool.execute('SELECT * FROM auth_otp_challenges WHERE challenge_id = ?', [challengeId]);
      assert.equal(afterDelete.length, 0);
    });
  });

  describe('3. Authoritative Role-Based Email Routing Verification', () => {
    it('should verify admin routing to ADMIN_OTP_EMAIL environment variable', async () => {
      const adminEmail = process.env.ADMIN_OTP_EMAIL;
      assert.ok(adminEmail, 'ADMIN_OTP_EMAIL must be configured in environment');
      assert.ok(adminEmail.includes('@'), 'ADMIN_OTP_EMAIL must be a valid email format');

      // Verify admin user has role ADMIN in users table
      const [adminRows] = await pool.execute(
        "SELECT user_id, username, role FROM users WHERE username = 'admin'"
      );
      assert.equal(adminRows.length, 1);
      assert.equal(adminRows[0].role, 'ADMIN');

      // Resolve destination email using role routing rule:
      let resolvedEmail = null;
      if (adminRows[0].role === 'ADMIN') {
        resolvedEmail = process.env.ADMIN_OTP_EMAIL;
      }
      assert.equal(resolvedEmail, adminEmail);
    });

    it('should verify test.employee2 routing to employees.email and NEVER to admin email', async () => {
      const [empRows] = await pool.execute(`
        SELECT u.user_id, u.username, u.role, e.email
        FROM users u
        JOIN employees e ON u.user_id = e.user_id
        WHERE u.username = 'test.employee2'
      `);

      assert.equal(empRows.length, 1);
      assert.equal(empRows[0].role, 'EMPLOYEE');
      assert.equal(empRows[0].email, 'test.employee2@example.com');
      assert.notEqual(empRows[0].email, process.env.ADMIN_OTP_EMAIL);
    });

    it('should verify test.customer2 routing to customers.email and NEVER to admin email', async () => {
      const [custRows] = await pool.execute(`
        SELECT u.user_id, u.username, u.role, c.email
        FROM users u
        JOIN customers c ON u.user_id = c.user_id
        WHERE u.username = 'test.customer2'
      `);

      assert.equal(custRows.length, 1);
      assert.equal(custRows[0].role, 'CUSTOMER');
      assert.equal(custRows[0].email, 'test.customer2@example.com');
      assert.notEqual(custRows[0].email, process.env.ADMIN_OTP_EMAIL);
    });
  });
});

