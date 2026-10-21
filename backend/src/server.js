/**
 * ==============================================================================
 * Backend Server Entry Point
 * ==============================================================================
 * Loads environment variables, initiates database check, and starts HTTP server.
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
const { testConnection } = require('./config/db');

const PORT = parseInt(process.env.PORT, 10) || 5000;

const server = app.listen(PORT, async () => {
  console.log('====================================================');
  console.log(` Bank Management System - Backend API Server`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Server URL : http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log('====================================================');

  // Diagnostic database connection test
  const dbStatus = await testConnection();
  if (dbStatus.connected) {
    console.log('✓ MySQL Database: Connected successfully.');
  } else {
    console.warn('! MySQL Database: Not connected (' + dbStatus.error + ').');
    console.warn('  Ensure MySQL is running and your .env configuration is set.');
  }
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully shutting down HTTP server...`);
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = server;
