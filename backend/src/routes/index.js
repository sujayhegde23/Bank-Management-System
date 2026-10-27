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
const authRouter = require('./auth');
const employeesRouter = require('./employees');
const { requireAuth, requireRole } = require('../middleware/auth');

// Root API information endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'Bank Management System API',
      version: '1.0.0',
      description: 'REST API backend for Customer, Employee, and Administrator banking operations',
      phase: 'Phase 1 - Employee Administration & Authentication Foundation',
      endpoints: {
        health: 'GET /api/health',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me',
        employees: 'GET /api/employees, POST /api/employees, PUT /api/employees/:id, PATCH /api/employees/:id/status'
      }
    }
  });
});

// Authentication routes
router.use('/auth', authRouter);

// Employee administration routes (Issue #11)
router.use('/employees', employeesRouter);

// Health check routes
router.use('/', healthRouter);

// Focused test-only routes to verify requireAuth and requireRole middleware without implementing premature banking functionality
router.get('/test/protected', requireAuth, (req, res) => {
  res.status(200).json({ success: true, data: { message: 'Authenticated access granted', user: req.user } });
});

router.get('/test/customer-only', requireAuth, requireRole('CUSTOMER'), (req, res) => {
  res.status(200).json({ success: true, data: { message: 'Customer access granted', user: req.user } });
});

router.get('/test/employee-only', requireAuth, requireRole('EMPLOYEE'), (req, res) => {
  res.status(200).json({ success: true, data: { message: 'Employee access granted', user: req.user } });
});

router.get('/test/admin-only', requireAuth, requireRole('ADMIN'), (req, res) => {
  res.status(200).json({ success: true, data: { message: 'Admin access granted', user: req.user } });
});

module.exports = router;
