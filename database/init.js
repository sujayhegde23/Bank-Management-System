/**
 * ==============================================================================
 * Bank Management System - Database Initialization Script
 * ==============================================================================
 * Usage:
 *   node database/init.js          # Initializes schema only
 *   node database/init.js --seed   # Initializes schema and populates dummy seed data
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// Ensure modules in backend/node_modules can be resolved if run from workspace root
const backendNodeModules = path.join(__dirname, '..', 'backend', 'node_modules');
if (fs.existsSync(backendNodeModules)) {
  module.paths.push(backendNodeModules);
}

const mysql = require('mysql2/promise');

// Load environment variables from backend/.env or root .env
const envPaths = [
  path.join(__dirname, '..', 'backend', '.env'),
  path.join(__dirname, '..', '.env')
];

let loadedEnv = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    loadedEnv = true;
    break;
  }
}

if (!loadedEnv) {
  require('dotenv').config();
}

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

const shouldSeed = process.argv.includes('--seed');

async function run() {
  console.log('----------------------------------------------------');
  console.log('Bank Management System - Database Initialization');
  console.log('----------------------------------------------------');
  console.log(`Connecting to MySQL host: ${config.host}:${config.port} as user: ${config.user}...`);

  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✓ Successfully connected to MySQL server.');

    // 1. Run schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`Reading schema DDL from: ${path.basename(schemaPath)}...`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema DDL statements...');
    await connection.query(schemaSql);
    console.log('✓ Database schema created and initialized successfully.');

    // 2. Optionally run seed.sql
    if (shouldSeed) {
      const seedPath = path.join(__dirname, 'seed.sql');
      if (fs.existsSync(seedPath)) {
        console.log(`Reading seed data from: ${path.basename(seedPath)}...`);
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        console.log('Populating baseline academic dummy seed records...');
        await connection.query(seedSql);
        console.log('✓ Baseline dummy data loaded successfully.');
      }
    }

    console.log('----------------------------------------------------');
    console.log('Database initialization completed successfully!');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('\n✖ Database initialization failed:');
    console.error(`  ${error.message}`);
    console.error('\nPlease verify that:');
    console.error('  1. MySQL service is running.');
    console.error('  2. Your .env file exists with DB_HOST, DB_PORT, DB_USER, and DB_PASSWORD set.');
    console.error('  3. The configured MySQL user has permissions to CREATE and ALTER databases.\n');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();
