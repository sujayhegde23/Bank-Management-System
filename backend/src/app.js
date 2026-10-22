/**
 * ==============================================================================
 * Express Application Configuration
 * ==============================================================================
 * Configures Express middlewares, CORS, JSON parsing, API routes,
 * 404 handlers, and centralized error handling.
 * ==============================================================================
 */

require('./config/env');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
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

// Session configuration
// Default 15-minute sliding inactivity timeout per Architecture Specification §6.2
let sessionMaxAgeMinutes = parseInt(process.env.SESSION_MAX_AGE_MINUTES, 10);
if (isNaN(sessionMaxAgeMinutes) || sessionMaxAgeMinutes <= 0) {
  sessionMaxAgeMinutes = 15;
}

const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.SESSION_SECRET;
const KNOWN_PLACEHOLDERS = [
  'replace_with_a_secure_random_string',
  'your_session_secret_here',
  'placeholder',
  'changeme',
  'secret'
];

const isPlaceholder = !rawSecret || KNOWN_PLACEHOLDERS.some(p => rawSecret.toLowerCase().includes(p));

if (isProduction && isPlaceholder) {
  throw new Error('Fatal: SESSION_SECRET environment variable must be set to a secure, non-placeholder value in production.');
}

if (!isProduction && isPlaceholder && process.env.NODE_ENV !== 'test') {
  console.warn('Notice: SESSION_SECRET is unset or using a development placeholder. Ensure a strong secret is configured for production.');
}

const sessionSecret = rawSecret || 'dev-session-secret-bms-academic-prototype';

app.use(session({
  name: 'bms.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset session expiration on every request (sliding inactivity timeout)
  cookie: {
    httpOnly: true,
    secure: isProduction, // false for local HTTP development; true in production (HTTPS required)
    sameSite: 'lax',
    maxAge: sessionMaxAgeMinutes * 60 * 1000 // 15-minute sliding inactivity timeout
  }
}));

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
