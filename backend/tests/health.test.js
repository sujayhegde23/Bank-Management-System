/**
 * ==============================================================================
 * Backend Scaffold Test Suite
 * ==============================================================================
 * Verifies that the Express server initializes routes, handles 404s,
 * provides health check diagnostics, and returns standardized envelopes.
 * Uses Node.js built-in test runner ('node:test') and supertest.
 * ==============================================================================
 */

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

describe('Backend API Scaffold Tests', () => {
  after(async () => {
    await pool.end();
  });
  it('GET / should return 200 with welcome message', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.message, 'string');
    assert.equal(res.body.health, '/api/health');
  });

  it('GET /api should return 200 with API metadata', async () => {
    const res = await request(app).get('/api');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.name, 'Bank Management System API');
  });

  it('GET /api/health should return 200 with UP status and complete diagnostic metadata', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'UP');
    assert.equal(typeof res.body.data.service, 'string');
    assert.equal(typeof res.body.data.environment, 'string');
    assert.equal(typeof res.body.data.timestamp, 'string');
    assert.ok(!isNaN(Date.parse(res.body.data.timestamp)), 'timestamp must be a valid date string');
    assert.equal(typeof res.body.data.uptimeSeconds, 'number');
    assert.ok(res.body.data.database, 'Health check should report database status');
    assert.equal(typeof res.body.data.database.connected, 'boolean');
    assert.ok(['CONNECTED', 'DISCONNECTED'].includes(res.body.data.database.status));
  });

  it('Diagnostic mapping handles both enveloped and unwrapped shapes accurately', () => {
    // Function mirroring frontend diagnostic mapping logic
    const mapDiagnostic = (health) => {
      const healthData = health?.data || health;
      const isDbConnected = Boolean(
        healthData?.database?.connected ??
        (healthData?.database?.status?.toLowerCase() === 'connected')
      );
      return {
        apiStatus: healthData?.status?.toUpperCase() || 'ONLINE',
        isDbConnected,
        environment: healthData?.environment || 'development',
        hasValidTimestamp: Boolean(healthData?.timestamp && !isNaN(Date.parse(healthData.timestamp)))
      };
    };

    // Case 1: Standard backend envelope with connected database
    const envelopedConnected = {
      success: true,
      data: {
        status: 'UP',
        service: 'backend',
        environment: 'development',
        timestamp: new Date().toISOString(),
        database: { connected: true, status: 'CONNECTED' }
      }
    };
    const mapped1 = mapDiagnostic(envelopedConnected);
    assert.equal(mapped1.apiStatus, 'UP');
    assert.equal(mapped1.isDbConnected, true);
    assert.equal(mapped1.hasValidTimestamp, true);

    // Case 2: Unwrapped payload (from getSystemHealth) with disconnected database
    const unwrappedDisconnected = {
      status: 'UP',
      service: 'backend',
      environment: 'development',
      timestamp: new Date().toISOString(),
      database: { connected: false, status: 'DISCONNECTED' }
    };
    const mapped2 = mapDiagnostic(unwrappedDisconnected);
    assert.equal(mapped2.apiStatus, 'UP');
    assert.equal(mapped2.isDbConnected, false);
    assert.equal(mapped2.hasValidTimestamp, true);
  });

  it('GET /api/nonexistent-route should return 404 with structured error', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
    assert.ok(res.body.error.message);
  });
});
