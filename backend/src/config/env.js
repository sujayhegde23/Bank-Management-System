/**
 * ==============================================================================
 * Environment Variables Loader
 * ==============================================================================
 * Prioritizes backend/.env, then falls back to root repository .env.
 * Ensures consistent environment loading across server, CLI tools, and tests.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Prioritize local backend/.env, fallback to root repository .env
const localEnv = path.join(__dirname, '..', '..', '.env');
const rootEnv = path.join(__dirname, '..', '..', '..', '.env');

if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

module.exports = process.env;
