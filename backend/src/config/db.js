/**
 * ==============================================================================
 * MySQL Database Connection Pool Configuration
 * ==============================================================================
 * Connects to MySQL using mysql2/promise pool with environment variables.
 * Enforces parameterized queries and exact decimal support.
 * ==============================================================================
 */

require('./env');
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bank_management_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true // Preserve exact numbers without float conversion
};

const pool = mysql.createPool(dbConfig);

/**
 * Execute a parameterized SQL query using the connection pool.
 * @param {string} sql - Parameterized SQL query with '?' placeholders
 * @param {Array} params - Array of parameters to bind
 * @returns {Promise<Array>} Query results
 */
async function query(sql, params = []) {
  const [results] = await pool.execute(sql, params);
  return results;
}

/**
 * Test the database connectivity without throwing unhandled exceptions.
 * @returns {Promise<{ connected: boolean, error?: string }>}
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { connected: true };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

/**
 * Execute a series of database operations within an isolated database transaction.
 * Automatically handles beginTransaction, commit, rollback, and connection release.
 * @param {Function} callback - Async function receiving the active connection (conn)
 * @returns {Promise<any>} Result returned by the callback
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  let transactionStarted = false;
  let connectionDestroyed = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const result = await callback(connection);

    await connection.commit();
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original error.
        // A rollback failure requires discarding the connection so it is not returned to the pool in an unsafe state.
        try {
          connection.destroy();
        } catch {
          // Ignore destroy errors
        }
        connectionDestroyed = true;
      }
    }

    throw error;
  } finally {
    if (!connectionDestroyed) {
      connection.release();
    }
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
  testConnection
};
