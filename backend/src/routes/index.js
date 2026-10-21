/**
 * ==============================================================================
 * Master API Router
 * ==============================================================================
 * Mounts all sub-routers under the /api prefix.
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const healthRouter = require('./health');

// Root API information endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'Bank Management System API',
      version: '1.0.0',
      description: 'REST API backend for Customer, Employee, and Administrator banking operations',
      phase: 'Phase 1 - Scaffold & Database Foundation',
      endpoints: {
        health: 'GET /api/health'
      }
    }
  });
});

// Health check routes
router.use('/', healthRouter);

module.exports = router;
