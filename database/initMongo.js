/**
 * ==============================================================================
 * Bank Management System - MongoDB Fraud Detection Database Initializer
 * ==============================================================================
 * Usage:
 *   node database/initMongo.js
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// Ensure modules in backend/node_modules can be resolved if run from workspace root
const backendNodeModules = path.join(__dirname, '..', 'backend', 'node_modules');
if (fs.existsSync(backendNodeModules)) {
  module.paths.push(backendNodeModules);
}

// Delegate to backend/src/config/initMongo.js
const { initializeMongoDatabase } = require('../backend/src/config/initMongo');
const { closeMongo } = require('../backend/src/config/mongo');

async function run() {
  console.log('====================================================');
  console.log(' Bank Management System - MongoDB Fraud Initializer');
  console.log('====================================================');

  try {
    const result = await initializeMongoDatabase();
    console.log(`✓ Connected to MongoDB database: ${result.database}`);
    console.log(`✓ Collections verified (${result.collections.length}):`);
    result.collections.forEach((c) => console.log(`   - ${c}`));
    console.log('✓ Collection indexes verified:');
    Object.entries(result.indexes).forEach(([coll, idxs]) => {
      console.log(`   [${coll}]: ${idxs.join(', ')}`);
    });
    console.log(`✓ Seeded default fraud rules: ${result.totalRulesConfigured} rules active.`);
    console.log('====================================================');
    console.log('MongoDB fraud database initialization complete!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n✖ MongoDB initialization failed:');
    console.error(`  ${err.message}\n`);
    process.exit(1);
  } finally {
    await closeMongo().catch(() => {});
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };

