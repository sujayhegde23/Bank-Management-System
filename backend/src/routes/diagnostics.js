/**
 * ==============================================================================
 * System Diagnostics Routes (Feature 5 & Phase 1 & Phase 3)
 * ==============================================================================
 * Endpoint: /api/diagnostics
 * Restricts detailed system infrastructure, database connection pool metrics,
 * MySQL schema telemetry, MongoDB fraud collection statistics, and MySQL
 * outbox queue telemetry strictly to authenticated ADMINISTRATORS.
 *
 * Explicitly forbids access to retail CUSTOMERS and branch EMPLOYEES (AUTH_002).
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const { query, testConnection, pool } = require('../config/db');
const { testMongoConnection, getDb, isMongoConnected } = require('../config/mongo');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getOutboxMetrics, fraudOutboxWorker } = require('../services/fraud');

/**
 * GET /api/diagnostics
 * Detailed system diagnostics and dual-database infrastructure oversight.
 * Access: Authenticated ADMIN only.
 */
router.get('/', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const dbStatus = await testConnection();
    const mongoStatus = await testMongoConnection();

    // MySQL Table row counts for administrator oversight
    const tableCounts = {};
    const tables = ['users', 'customers', 'employees', 'accounts', 'bank_transactions', 'audit_logs', 'fraud_outbox_events'];

    for (const table of tables) {
      try {
        const rows = await query(`SELECT COUNT(*) AS total FROM \`${table}\``);
        tableCounts[table] = rows[0]?.total || 0;
      } catch {
        tableCounts[table] = 'N/A';
      }
    }

    // MongoDB Fraud Collection counts (if connected)
    const mongoStats = {
      connected: mongoStatus.connected,
      status: mongoStatus.connected ? 'CONNECTED' : 'DISCONNECTED',
      database: mongoStatus.database || undefined,
      collectionStats: {}
    };

    if (mongoStatus.connected) {
      try {
        const mongoDb = getDb();
        const fraudCollections = [
          'transaction_risk_assessments',
          'fraud_alerts',
          'fraud_rules',
          'fraud_investigations'
        ];

        for (const colName of fraudCollections) {
          try {
            const count = await mongoDb.collection(colName).countDocuments();
            mongoStats.collectionStats[colName] = count;
          } catch {
            mongoStats.collectionStats[colName] = 'N/A';
          }
        }
      } catch {
        // Safe fallback if collection enumeration encounters issues
      }
    }

    // Phase 3 Fraud Outbox queue and worker metrics
    let outboxMetrics = null;
    try {
      const metrics = await getOutboxMetrics();
      const workerStatus = fraudOutboxWorker.getWorkerStatus();
      outboxMetrics = {
        ...metrics,
        worker: workerStatus
      };
    } catch (outboxErr) {
      outboxMetrics = { error: outboxErr.message };
    }

    const mem = process.memoryUsage();

    return res.status(200).json({
      success: true,
      data: {
        service: 'bank-management-system-backend',
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        memory: {
          heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
          heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
          rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100
        },
        database: {
          connected: dbStatus.connected,
          status: dbStatus.connected ? 'CONNECTED' : 'DISCONNECTED',
          poolTotalConnections: pool?.pool?._allConnections?.length || undefined,
          poolFreeConnections: pool?.pool?._freeConnections?.length || undefined
        },
        mongodb: mongoStats,
        fraudOutbox: outboxMetrics,
        tableStats: tableCounts
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/diagnostics/ping
 * Quick diagnostics ping for administrator console.
 * Access: Authenticated ADMIN only.
 */
router.get('/ping', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const dbStatus = await testConnection();
    const mongoStatus = await testMongoConnection();
    return res.status(200).json({
      success: true,
      data: {
        ping: 'PONG',
        timestamp: new Date().toISOString(),
        databaseConnected: dbStatus.connected,
        mongoConnected: mongoStatus.connected
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
