/**
 * ==============================================================================
 * Bank Management System - MySQL Fraud Outbox Table Initializer (Phase 3)
 * ==============================================================================
 * Usage:
 *   node database/initOutbox.js
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

const DDL_OUTBOX_TABLE = `
CREATE TABLE IF NOT EXISTS fraud_outbox_events (
    event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT NOT NULL UNIQUE,
    event_type VARCHAR(32) NOT NULL,
    payload JSON NOT NULL,
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at DATETIME NULL,
    locked_by VARCHAR(128) NULL,
    last_error VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_outbox_transaction FOREIGN KEY (transaction_id)
        REFERENCES bank_transactions (transaction_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    INDEX idx_outbox_poll (status, next_attempt_at),
    INDEX idx_outbox_lease (status, locked_at),
    INDEX idx_outbox_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/**
 * Ensures the fraud_outbox_events table exists in the database and uses retention-safe ON DELETE RESTRICT.
 * @param {import('mysql2/promise').Connection|import('mysql2/promise').Pool} [dbConn]
 */
async function ensureOutboxTable(dbConn) {
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
    await conn.query(DDL_OUTBOX_TABLE);

    // 2. Check if existing foreign key is CASCADE, and if so, migrate to RESTRICT
    const [fkRows] = await conn.query(`
      SELECT CONSTRAINT_NAME, DELETE_RULE
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE TABLE_NAME = 'fraud_outbox_events'
        AND CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = 'fk_outbox_transaction'
    `);

    if (fkRows.length > 0 && fkRows[0].DELETE_RULE === 'CASCADE') {
      await conn.query('ALTER TABLE fraud_outbox_events DROP FOREIGN KEY fk_outbox_transaction');
      await conn.query(`
        ALTER TABLE fraud_outbox_events ADD CONSTRAINT fk_outbox_transaction
          FOREIGN KEY (transaction_id) REFERENCES bank_transactions (transaction_id)
          ON DELETE RESTRICT
          ON UPDATE CASCADE
      `);
    }
  } finally {
    if (localPool) {
      await localPool.end().catch(() => {});
    }
  }
}

async function run() {
  console.log('====================================================');
  console.log(' Bank Management System - Fraud Outbox Initializer');
  console.log('====================================================');

  try {
    console.log(`Connecting to MySQL database '${process.env.DB_NAME || 'bank_management_system'}'...`);
    await ensureOutboxTable();
    console.log('✓ Successfully ensured table: fraud_outbox_events');
    console.log('✓ Foreign key: fk_outbox_transaction -> bank_transactions(transaction_id) ON DELETE RESTRICT');
    console.log('✓ Retention Policy: RESTRICT (Deletions of bank_transactions with outbox entries are prevented)');
    console.log('✓ Indexes verified: idx_outbox_poll, idx_outbox_lease, idx_outbox_created');
    console.log('====================================================');
    console.log('MySQL outbox table initialization complete!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n✖ Outbox table initialization failed:');
    console.error(`  ${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  ensureOutboxTable,
  DDL_OUTBOX_TABLE,
  run
};
