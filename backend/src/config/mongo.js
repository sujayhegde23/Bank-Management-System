/**
 * ==============================================================================
 * MongoDB Connection Configuration for Fraud Detection (Phase 1)
 * ==============================================================================
 * Connects to MongoDB using the official mongodb Node.js driver.
 * MongoDB is used exclusively for fraud detection data (risk assessments,
 * fraud alerts, fraud rules, and investigations).
 *
 * MySQL remains the primary database for all core banking transactions.
 * ==============================================================================
 */

require('./env');
const { MongoClient } = require('mongodb');

const DEFAULT_DB_NAME = 'bank_fraud_detection';
const DEFAULT_URI = 'mongodb://127.0.0.1:27017/bank_fraud_detection';

// Singleton connection state
let client = null;
let connectingPromise = null;
let activeDb = null;
let connectionState = {
  connected: false,
  database: null,
  error: null,
  lastChecked: null
};

/**
 * Resolve the MongoDB connection URI from environment variables with safe local fallback.
 * @returns {string}
 */
function getMongoUri() {
  return process.env.MONGODB_URI || DEFAULT_URI;
}

/**
 * Initialize or retrieve the active MongoDB connection.
 * Thread-safe singleton pattern preventing duplicate connections.
 *
 * @param {string} [customUri] - Optional override URI for testing or specific configs
 * @param {object} [customOptions] - Optional MongoClientOptions overrides
 * @returns {Promise<MongoClient>}
 */
async function connectMongo(customUri, customOptions = {}) {
  // If custom URI is provided and differs from currently connected client, close existing client first
  if (customUri && client && customUri !== getMongoUri()) {
    await closeMongo(true).catch(() => {});
  }

  // Return existing healthy client if already connected
  if (client) {
    try {
      await client.db().admin().ping();
      connectionState.connected = true;
      connectionState.error = null;
      return client;
    } catch {
      await closeMongo(true).catch(() => {});
    }
  }

  // If a connection attempt is already in flight, reuse the promise
  if (connectingPromise) {
    return connectingPromise;
  }

  const uri = customUri || getMongoUri();

  const clientOptions = {
    serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 5000,
    maxPoolSize: 10,
    minPoolSize: 1,
    ...customOptions
  };

  connectingPromise = (async () => {
    try {
      const newClient = new MongoClient(uri, clientOptions);
      await newClient.connect();

      await newClient.db().admin().ping();

      client = newClient;
      activeDb = newClient.db();

      connectionState = {
        connected: true,
        database: activeDb.databaseName || DEFAULT_DB_NAME,
        error: null,
        lastChecked: new Date()
      };

      return client;
    } catch (err) {
      connectionState = {
        connected: false,
        database: null,
        error: err.message,
        lastChecked: new Date()
      };
      client = null;
      activeDb = null;
      throw err;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

/**
 * Retrieve the active MongoDB database instance.
 * @param {string} [dbName] - Optional database name override
 * @returns {import('mongodb').Db}
 * @throws {Error} If MongoDB is not connected
 */
function getDb(dbName) {
  if (!client) {
    throw new Error('MongoDB is not connected. Call connectMongo() first.');
  }
  return dbName ? client.db(dbName) : activeDb || client.db(DEFAULT_DB_NAME);
}

/**
 * Retrieve the raw MongoClient instance.
 * @returns {MongoClient|null}
 */
function getMongoClient() {
  return client;
}

/**
 * Check whether MongoDB is currently connected.
 * @returns {boolean}
 */
function isMongoConnected() {
  return connectionState.connected && client !== null;
}

/**
 * Test the MongoDB database connectivity without throwing unhandled exceptions.
 * Follows the convention of testConnection() in db.js.
 *
 * @param {string} [customUri] - Optional URI to test
 * @returns {Promise<{ connected: boolean, database?: string, error?: string }>}
 */
async function testMongoConnection(customUri) {
  try {
    if (customUri) {
      const probeClient = new MongoClient(customUri, {
        serverSelectionTimeoutMS: 800,
        connectTimeoutMS: 1000
      });
      await probeClient.connect();
      await probeClient.db().admin().ping();
      const dbName = probeClient.db().databaseName;
      await probeClient.close().catch(() => {});
      return { connected: true, database: dbName };
    }

    if (!client) {
      await connectMongo();
    } else {
      await client.db().admin().ping();
    }

    const db = getDb();
    connectionState.connected = true;
    connectionState.database = db.databaseName;
    connectionState.error = null;
    connectionState.lastChecked = new Date();

    return {
      connected: true,
      database: db.databaseName
    };
  } catch (error) {
    if (!customUri) {
      connectionState.connected = false;
      connectionState.error = error.message;
      connectionState.lastChecked = new Date();
    }

    return {
      connected: false,
      error: error.message
    };
  }
}

/**
 * Gracefully close the MongoDB client connection.
 * Safe to call multiple times or when not connected.
 *
 * @param {boolean} [force=false]
 * @returns {Promise<void>}
 */
async function closeMongo(force = false) {
  if (client) {
    const clientToClose = client;
    client = null;
    activeDb = null;
    connectionState.connected = false;
    connectionState.database = null;
    connectionState.error = null;
    try {
      await clientToClose.close(force);
    } catch {
      // Ignore close errors
    }
  }
}

module.exports = {
  connectMongo,
  getDb,
  getMongoClient,
  isMongoConnected,
  testMongoConnection,
  closeMongo,
  DEFAULT_DB_NAME,
  getMongoUri
};
