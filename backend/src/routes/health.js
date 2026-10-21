/**
 * ==============================================================================
 * Health Check Route
 * ==============================================================================
 * Endpoint: GET /api/health
 * Provides service health, uptime, and database connectivity diagnostic.
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const { testConnection } = require('../config/db');

router.get('/health', async (req, res) => {
  const dbStatus = await testConnection();

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
        note: dbStatus.connected ? undefined : 'MySQL server unreachable or credentials pending configuration'
      }
    }
  });
});

module.exports = router;
