/**
 * ==============================================================================
 * Health Check & Customer-Safe Connection Status Route (Feature 5 & Phase 1)
 * ==============================================================================
 * Endpoint: GET /api/health
 * Provides high-level service status and database connectivity (MySQL and MongoDB)
 * without exposing internal infrastructure, environment variables, credentials,
 * or server paths.
 *
 * Detailed diagnostics endpoints (/health/diagnostics) are restricted to ADMIN.
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const { testConnection } = require('../config/db');
const { testMongoConnection } = require('../config/mongo');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * GET /api/health
 * Public / customer-safe status probe.
 * Does NOT expose internal database credentials, connection strings, hostnames,
 * server paths, or environment variables.
 */
router.get('/health', async (req, res) => {
  const dbStatus = await testConnection();
  const mongoStatus = await testMongoConnection();

  res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      service: 'bank-management-system-backend',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        connected: dbStatus.connected,
        status: dbStatus.connected ? 'CONNECTED' : 'DISCONNECTED',
        note: dbStatus.connected ? undefined : 'Core banking database disconnected'
      },
      mongodb: {
        connected: mongoStatus.connected,
        status: mongoStatus.connected ? 'CONNECTED' : 'DISCONNECTED',
        note: mongoStatus.connected ? undefined : 'Fraud detection database unavailable'
      }
    }
  });
});

/**
 * GET /api/health/diagnostics
 * Detailed infrastructure diagnostic probe.
 * Access: Authenticated ADMIN only.
 */
router.get('/health/diagnostics', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const dbStatus = await testConnection();
  const mongoStatus = await testMongoConnection();
  const mem = process.memoryUsage();

  res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      service: 'bank-management-system-backend',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100
      },
      database: {
        connected: dbStatus.connected,
        status: dbStatus.connected ? 'CONNECTED' : 'DISCONNECTED'
      },
      mongodb: {
        connected: mongoStatus.connected,
        status: mongoStatus.connected ? 'CONNECTED' : 'DISCONNECTED',
        database: mongoStatus.database || undefined
      }
    }
  });
});

module.exports = router;
