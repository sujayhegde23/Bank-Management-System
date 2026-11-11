/**
 * ==============================================================================
 * Bank Management System - MySQL OTP Challenges Table Initializer (Phase 1)
 * ==============================================================================
 * Usage:
 *   node database/initOtp.js
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// Ensure modules in backend/node_modules can be resolved if run from workspace root
const backendNodeModules = path.join(__dirname, '..', 'backend', 'node_modules');
if (fs.existsSync(backendNodeModules)) {
  module.paths.push(backendNodeModules);
}

const mysql = require('mysql2/promise');

// Load environment variables from backend/.env or root .env
const envPaths = [
  path.join(__dirname, '..', 'backend', '.env'),
  path.join(__dirname, '..', '.env')
];

let loadedEnv = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    loadedEnv = true;
    break;
  }
}

if (!loadedEnv) {
  require('dotenv').config();
}

const DDL_OTP_CHALLENGES_TABLE = `
CREATE TABLE IF NOT EXISTS auth_otp_challenges (
    challenge_id VARCHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    otp_salt VARCHAR(64) NULL,
    attempts_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    status ENUM('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED') NOT NULL DEFAULT 'PENDING',
    expires_at DATETIME NOT NULL,
    resend_available_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_otp_challenges_user FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_otp_attempts CHECK (attempts_count >= 0 AND max_attempts > 0),
    INDEX idx_otp_challenges_user (user_id, created_at),
    INDEX idx_otp_challenges_status_expires (status, expires_at),
    INDEX idx_otp_challenges_lookup (challenge_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/**
 * Ensures the auth_otp_challenges table exists in the database with correct constraints.
 * @param {import('mysql2/promise').Connection|import('mysql2/promise').Pool} [dbConn]
 */
async function ensureOtpChallengesTable(dbConn) {
  let localPool = null;
  const conn = dbConn || (localPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bank_management_system'
  }));

  try {
    // 1. Ensure table exists
    await conn.query(DDL_OTP_CHALLENGES_TABLE);

    // 2. Validate table structure
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_NAME = 'auth_otp_challenges'
        AND TABLE_SCHEMA = DATABASE()
      ORDER BY ORDINAL_POSITION
    `);

    // 3. Validate indexes
    const [indexes] = await conn.query(`
      SELECT DISTINCT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
      FROM information_schema.STATISTICS
      WHERE TABLE_NAME = 'auth_otp_challenges'
        AND TABLE_SCHEMA = DATABASE()
    `);

    // 4. Validate foreign keys
    const [foreignKeys] = await conn.query(`
      SELECT CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE TABLE_NAME = 'auth_otp_challenges'
        AND CONSTRAINT_SCHEMA = DATABASE()
    `);

    return {
      tableCreated: true,
      columnsCount: columns.length,
      columns: columns.map(c => ({ name: c.COLUMN_NAME, type: c.COLUMN_TYPE })),
      indexes: indexes.map(i => ({ name: i.INDEX_NAME, column: i.COLUMN_NAME })),
      foreignKeys: foreignKeys.map(f => ({ name: f.CONSTRAINT_NAME, deleteRule: f.DELETE_RULE }))
    };
  } finally {
    if (localPool) {
      await localPool.end();
    }
  }
}

// Standalone execution support
if (require.main === module) {
  (async () => {
    console.log('----------------------------------------------------');
    console.log('Bank Management System - OTP Challenges Table Setup');
    console.log('----------------------------------------------------');
    try {
      const result = await ensureOtpChallengesTable();
      console.log('✓ Successfully ensured auth_otp_challenges table in MySQL.');
      console.log(`  Columns initialized: ${result.columnsCount}`);
      console.log(`  Indexes registered: ${result.indexes.length}`);
      console.log(`  Foreign key constraints: ${result.foreignKeys.length}`);
      console.log('----------------------------------------------------');
      process.exit(0);
    } catch (err) {
      console.error('✖ Failed to initialize auth_otp_challenges table:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  ensureOtpChallengesTable,
  DDL_OTP_CHALLENGES_TABLE
};

