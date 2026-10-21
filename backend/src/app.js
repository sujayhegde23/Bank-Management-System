/**
 * ==============================================================================
 * Express Application Configuration
 * ==============================================================================
 * Configures Express middlewares, CORS, JSON parsing, API routes,
 * 404 handlers, and centralized error handling.
 * ==============================================================================
 */

const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS configuration
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: clientUrl,
  credentials: true
}));

// Body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development diagnostics)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Root welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the Bank Management System API',
    documentation: '/api',
    health: '/api/health'
  });
});

// API master routes
app.use('/api', apiRouter);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist.`
    }
  });
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
