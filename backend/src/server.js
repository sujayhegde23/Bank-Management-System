/**
 * ==============================================================================
 * Backend Server Entry Point
 * ==============================================================================
 * Loads environment variables, initiates database checks, and starts HTTP server.
 * Supports dual-database architecture:
 *   - MySQL (Primary core banking operations)
 *   - MongoDB (Fraud detection system - Phase 1)
 * Integrates asynchronous outbox worker for fraud detection (Phase 3).
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// Prioritize local backend/.env, fallback to root .env
const localEnv = path.join(__dirname, '..', '.env');
const rootEnv = path.join(__dirname, '..', '..', '.env');

if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv });
} else if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else {
  require('dotenv').config();
}

const app = require('./app');
const { testConnection, pool } = require('./config/db');
const { testMongoConnection, closeMongo } = require('./config/mongo');
const { fraudOutboxWorker } = require('./services/fraud');

const PORT = parseInt(process.env.PORT, 10) || 5000;

const server = app.listen(PORT, async () => {
  console.log('====================================================');
  console.log(` Bank Management System - Backend API Server`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Server URL : http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log('====================================================');

  // 1. Diagnostic MySQL database connection test (Primary Banking Database)
  const dbStatus = await testConnection();
  if (dbStatus.connected) {
    console.log('✓ MySQL Database: Connected successfully.');
  } else {
    console.warn('! MySQL Database: Not connected (' + dbStatus.error + ').');
    console.warn('  Ensure MySQL is running and your .env configuration is set.');
  }

  // 2. Diagnostic MongoDB connection test (Fraud Detection Foundation - Phase 1)
  // Non-blocking: MongoDB unavailability must NOT crash or prevent core banking operations
  try {
    const mongoStatus = await testMongoConnection();
    if (mongoStatus.connected) {
      console.log(`✓ MongoDB (Fraud Detection): Connected successfully to '${mongoStatus.database}'.`);
    } else {
      console.warn(`! MongoDB (Fraud Detection): Not connected (${mongoStatus.error}).`);
      console.warn('  Fraud detection database is offline. Core banking operations remain fully functional.');
    }
  } catch (mongoErr) {
    console.warn(`! MongoDB (Fraud Detection): Error during startup probe (${mongoErr.message}).`);
  }

  // 3. Start Fraud Outbox Background Worker (Phase 3)
  if (process.env.FRAUD_WORKER_ENABLED !== 'false' && process.env.NODE_ENV !== 'test') {
    fraudOutboxWorker.start();
  }
});

// Graceful shutdown handling
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully shutting down HTTP server and connections...`);
  
  // Stop background worker before closing database connections
  try {
    await fraudOutboxWorker.stop();
  } catch (workerErr) {
    console.warn('Error stopping fraud outbox worker:', workerErr.message);
  }

  server.close(async () => {
    try {
      await pool.end().catch(() => {});
      await closeMongo().catch(() => {});
      console.log('Database connections closed cleanly.');
    } catch (err) {
      console.error('Error during connection cleanup:', err.message);
    } finally {
      console.log('HTTP server closed. Exiting process.');
      process.exit(0);
    }
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = server;
