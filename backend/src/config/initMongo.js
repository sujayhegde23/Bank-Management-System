/**
 * ==============================================================================
 * MongoDB Fraud Detection Database Initializer (Phase 1)
 * ==============================================================================
 * Creates collections, JSON schema validators, indexes, and baseline rule seeds
 * for the bank_fraud_detection database.
 *
 * Designed to be safe, repeatable, and idempotent.
 * Does NOT drop collections or delete existing documents.
 * ==============================================================================
 */

const { connectMongo, getDb, closeMongo, DEFAULT_DB_NAME } = require('./mongo');

// Default baseline fraud detection rules (Phase 4 calibrated weights: total 100)
const DEFAULT_FRAUD_RULES = [
  {
    ruleCode: 'HIGH_AMOUNT',
    name: 'Unusually High Transaction Amount',
    description: 'Flags transactions exceeding configured monetary threshold (e.g. ₹50,000 = 5,000,000 paise)',
    enabled: true,
    threshold: 5000000, // Stored in integer paise (5,000,000 paise = ₹50,000.00)
    weight: 30
  },
  {
    ruleCode: 'HIGH_VELOCITY',
    name: 'High-Velocity Transaction Frequency',
    description: 'Flags multiple transactions initiated within a short time window (e.g., >3 transactions in 2 minutes)',
    enabled: true,
    threshold: 3,
    weight: 25,
    config: {
      windowMinutes: 2
    }
  },
  {
    ruleCode: 'NEW_BENEFICIARY',
    name: 'First-Time Beneficiary Transfer',
    description: 'Flags transfers directed to a recipient account that has not previously received funds from sender',
    enabled: true,
    threshold: 0,
    weight: 25
  },
  {
    ruleCode: 'UNUSUAL_HOUR',
    name: 'Unusual Banking Hour Activity',
    description: 'Flags transactions executed during unusual off-hours (e.g., 01:00 - 05:00)',
    enabled: true,
    threshold: 0,
    weight: 20,
    config: {
      startHour: 1,
      endHour: 5,
      timezone: 'Asia/Kolkata'
    }
  }
];

// Collection Schema Validators (MongoDB JSON Schema)
const SCHEMAS = {
  transaction_risk_assessments: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'transactionId',
        'customerId',
        'accountId',
        'transactionType',
        'amount',
        'riskScore',
        'riskLevel',
        'decision',
        'assessedAt'
      ],
      properties: {
        transactionId: {
          bsonType: ['int', 'long', 'double'],
          description: 'Unique reference to MySQL bank_transactions.transaction_id'
        },
        customerId: {
          bsonType: ['int', 'long', 'double'],
          description: 'Reference to MySQL customers.customer_id'
        },
        accountId: {
          bsonType: ['int', 'long', 'double'],
          description: 'Reference to MySQL accounts.account_id'
        },
        transactionType: {
          bsonType: 'string',
          description: 'Banking transaction type (TRANSFER, WITHDRAWAL, DEPOSIT)'
        },
        amount: {
          bsonType: ['int', 'long', 'double', 'decimal'],
          minimum: 0,
          description: 'Transaction monetary value in integer paise (1 INR = 100 paise)'
        },
        riskScore: {
          bsonType: ['int', 'long', 'double'],
          minimum: 0,
          maximum: 100,
          description: 'Calculated fraud risk score (0-100)'
        },
        riskLevel: {
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          description: 'Categorical risk classification'
        },
        triggeredRules: {
          bsonType: 'array',
          description: 'List of rule evaluations that contributed to risk score',
          items: {
            bsonType: 'object',
            required: ['ruleCode'],
            properties: {
              ruleCode: { bsonType: 'string' },
              points: { bsonType: ['int', 'long', 'double'] },
              description: { bsonType: 'string' }
            }
          }
        },
        decision: {
          enum: ['APPROVED', 'FLAGGED', 'REVIEW_REQUIRED', 'REJECTED'],
          description: 'Automated policy decision'
        },
        assessedAt: {
          bsonType: 'date',
          description: 'Timestamp of risk assessment execution'
        }
      }
    }
  },

  fraud_alerts: {
    $jsonSchema: {
      bsonType: 'object',
      required: [
        'transactionId',
        'customerId',
        'accountId',
        'riskScore',
        'riskLevel',
        'status',
        'createdAt',
        'updatedAt'
      ],
      properties: {
        transactionId: {
          bsonType: ['int', 'long', 'double'],
          description: 'Unique reference to MySQL bank_transactions.transaction_id'
        },
        customerId: {
          bsonType: ['int', 'long', 'double'],
          description: 'Reference to MySQL customers.customer_id'
        },
        accountId: {
          bsonType: ['int', 'long', 'double'],
          description: 'Reference to MySQL accounts.account_id'
        },
        riskScore: {
          bsonType: ['int', 'long', 'double'],
          minimum: 0,
          maximum: 100,
          description: 'Calculated fraud risk score'
        },
        riskLevel: {
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          description: 'Categorical risk classification'
        },
        status: {
          enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE'],
          description: 'Lifecycle alert state'
        },
        reasons: {
          bsonType: 'array',
          description: 'Human-readable reasons for alert generation',
          items: { bsonType: 'string' }
        },
        createdAt: {
          bsonType: 'date',
          description: 'Alert creation timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Alert last modification timestamp'
        }
      }
    }
  },

  fraud_rules: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['ruleCode', 'name', 'enabled', 'weight', 'createdAt', 'updatedAt'],
      properties: {
        ruleCode: {
          bsonType: 'string',
          description: 'Unique alphanumeric rule identifier'
        },
        name: {
          bsonType: 'string',
          description: 'Display name for fraud rule'
        },
        description: {
          bsonType: 'string',
          description: 'Detailed explanation of rule condition'
        },
        enabled: {
          bsonType: 'bool',
          description: 'Whether rule actively participates in risk assessment'
        },
        threshold: {
          bsonType: ['int', 'long', 'double', 'decimal'],
          description: 'Configurable trigger threshold (monetary rules use integer paise: 1 INR = 100 paise)'
        },
        weight: {
          bsonType: ['int', 'long', 'double'],
          minimum: 0,
          maximum: 100,
          description: 'Risk score weight points added on rule match'
        },
        config: {
          bsonType: 'object',
          description: 'Rule-specific configuration options (e.g. windowMinutes, startHour, endHour, timezone)'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Rule creation timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Rule update timestamp'
        }
      }
    }
  },

  fraud_investigations: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['transactionId', 'status', 'createdAt', 'updatedAt'],
      properties: {
        alertId: {
          description: 'Reference to fraud_alerts document ID'
        },
        transactionId: {
          bsonType: ['int', 'long', 'double'],
          description: 'Reference to MySQL bank_transactions.transaction_id'
        },
        assignedEmployeeId: {
          bsonType: ['int', 'long', 'double', 'null'],
          description: 'Reference to MySQL employees.employee_id'
        },
        status: {
          enum: ['OPEN', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE', 'CLOSED'],
          description: 'Investigation case status'
        },
        notes: {
          bsonType: 'array',
          description: 'Investigator operational log entries'
        },
        resolution: {
          description: 'Final investigation outcome or closing notes'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Investigation creation timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Investigation last modification timestamp'
        }
      }
    }
  }
};

/**
 * Initialize MongoDB collections, validators, indexes, and baseline rules.
 * Idempotent: safe to run multiple times without data loss or duplicate indexes.
 *
 * @param {import('mongodb').Db} [targetDb] - Optional Db instance override
 * @returns {Promise<{ success: boolean, collections: string[], indexes: Record<string, string[]>, rulesSeeded: number }>}
 */
async function initializeMongoDatabase(targetDb) {
  let db = targetDb;
  let shouldClose = false;

  if (!db) {
    await connectMongo();
    db = getDb();
  }

  const existingCollections = await db.listCollections().toArray();
  const existingNames = new Set(existingCollections.map((c) => c.name));

  const collectionNames = [
    'transaction_risk_assessments',
    'fraud_alerts',
    'fraud_rules',
    'fraud_investigations'
  ];

  // 1. Ensure collections with JSON Schema validation
  for (const name of collectionNames) {
    const validator = SCHEMAS[name];
    if (!existingNames.has(name)) {
      await db.createCollection(name, {
        validator,
        validationLevel: 'moderate',
        validationAction: 'warn' // Log warnings on mismatch to avoid breaking early pipelines
      });
    } else if (validator) {
      try {
        await db.command({
          collMod: name,
          validator,
          validationLevel: 'moderate',
          validationAction: 'warn'
        });
      } catch {
        // Some managed environments restrict collMod; continue safely
      }
    }
  }

  // 2. Ensure Indexes
  const createdIndexes = {};

  // Collection: transaction_risk_assessments
  const riskColl = db.collection('transaction_risk_assessments');
  createdIndexes.transaction_risk_assessments = [
    await riskColl.createIndex({ transactionId: 1 }, { unique: true, name: 'uniq_assessment_transaction_id' }),
    await riskColl.createIndex({ customerId: 1 }, { name: 'idx_assessment_customer_id' }),
    await riskColl.createIndex({ riskLevel: 1 }, { name: 'idx_assessment_risk_level' }),
    await riskColl.createIndex({ assessedAt: -1 }, { name: 'idx_assessment_assessed_at' })
  ];

  // Collection: fraud_alerts
  const alertsColl = db.collection('fraud_alerts');
  createdIndexes.fraud_alerts = [
    await alertsColl.createIndex({ transactionId: 1 }, { unique: true, name: 'uniq_alert_transaction_id' }),
    await alertsColl.createIndex({ status: 1 }, { name: 'idx_alert_status' }),
    await alertsColl.createIndex({ riskLevel: 1 }, { name: 'idx_alert_risk_level' }),
    await alertsColl.createIndex({ createdAt: -1 }, { name: 'idx_alert_created_at' })
  ];

  // Collection: fraud_rules
  const rulesColl = db.collection('fraud_rules');
  createdIndexes.fraud_rules = [
    await rulesColl.createIndex({ ruleCode: 1 }, { unique: true, name: 'uniq_rule_code' }),
    await rulesColl.createIndex({ enabled: 1 }, { name: 'idx_rule_enabled' })
  ];

  // Collection: fraud_investigations
  const investColl = db.collection('fraud_investigations');
  createdIndexes.fraud_investigations = [
    await investColl.createIndex({ alertId: 1 }, { unique: true, sparse: true, name: 'uniq_investigation_alert_id' }).catch(() => investColl.createIndex({ alertId: 1 }, { name: 'idx_investigation_alert_id' })),
    await investColl.createIndex({ transactionId: 1 }, { unique: true, sparse: true, name: 'uniq_investigation_transaction_id' }).catch(() => investColl.createIndex({ transactionId: 1 }, { name: 'idx_investigation_transaction_id' })),
    await investColl.createIndex({ assignedEmployeeId: 1 }, { name: 'idx_investigation_employee_id' }),
    await investColl.createIndex({ status: 1 }, { name: 'idx_investigation_status' })
  ];

  // 3. Reconcile Legacy Rule Codes and Units (Phase 1 -> Phase 2 mapping)
  await rulesColl.updateOne(
    { ruleCode: 'HIGH_AMOUNT', threshold: 50000 },
    {
      $set: {
        threshold: 5000000, // Reconcile legacy rupees 50000 to integer paise (5,000,000 paise = ₹50,000.00)
        description: 'Flags transactions exceeding configured monetary threshold (e.g. ₹50,000 = 5,000,000 paise)',
        updatedAt: new Date()
      }
    }
  );
  await rulesColl.updateOne(
    { ruleCode: 'RAPID_TRANSFERS' },
    {
      $set: {
        ruleCode: 'HIGH_VELOCITY',
        name: 'High-Velocity Transaction Frequency',
        description: 'Flags multiple transactions initiated within a short time window (e.g., >3 transactions in 2 minutes)',
        config: { windowMinutes: 2 },
        updatedAt: new Date()
      }
    }
  );
  await rulesColl.updateOne(
    { ruleCode: 'SUSPICIOUS_HOUR' },
    {
      $set: {
        ruleCode: 'UNUSUAL_HOUR',
        name: 'Unusual Banking Hour Activity',
        description: 'Flags transactions executed during unusual off-hours (e.g., 01:00 - 05:00)',
        config: { startHour: 1, endHour: 5, timezone: 'Asia/Kolkata' },
        updatedAt: new Date()
      }
    }
  );
  await rulesColl.updateOne(
    { ruleCode: 'ZERO_BALANCE_DRAIN' },
    {
      $set: {
        ruleCode: 'NEW_BENEFICIARY',
        name: 'First-Time Beneficiary Transfer',
        description: 'Flags transfers directed to a recipient account that has not previously received funds from sender',
        updatedAt: new Date()
      }
    }
  );

  // 3b. Reconcile Calibrated Rule Weights (Phase 4 recalibration: total maximum 100)
  await rulesColl.updateOne({ ruleCode: 'HIGH_AMOUNT', weight: 25 }, { $set: { weight: 30, updatedAt: new Date() } });
  await rulesColl.updateOne({ ruleCode: 'HIGH_VELOCITY', weight: 20 }, { $set: { weight: 25, updatedAt: new Date() } });
  await rulesColl.updateOne({ ruleCode: 'NEW_BENEFICIARY', weight: 20 }, { $set: { weight: 25, updatedAt: new Date() } });
  await rulesColl.updateOne({ ruleCode: 'UNUSUAL_HOUR', weight: 15 }, { $set: { weight: 20, updatedAt: new Date() } });

  // 4. Idempotently Seed Default Fraud Rules
  let rulesSeeded = 0;
  for (const rule of DEFAULT_FRAUD_RULES) {
    const res = await rulesColl.updateOne(
      { ruleCode: rule.ruleCode },
      {
        $setOnInsert: {
          ...rule,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    if (res.upsertedCount > 0) {
      rulesSeeded++;
    }
  }

  return {
    success: true,
    database: db.databaseName,
    collections: collectionNames,
    indexes: createdIndexes,
    rulesSeeded,
    totalRulesConfigured: DEFAULT_FRAUD_RULES.length
  };
}

// Standalone CLI execution support
if (require.main === module) {
  (async () => {
    try {
      console.log('----------------------------------------------------');
      console.log('MongoDB Fraud Detection - Database Initialization');
      console.log('----------------------------------------------------');
      console.log(`Target Database: ${DEFAULT_DB_NAME}`);

      const result = await initializeMongoDatabase();

      console.log(`✓ Connected to MongoDB database: ${result.database}`);
      console.log(`✓ Collections verified/created (${result.collections.length}):`);
      result.collections.forEach((c) => console.log(`   - ${c}`));
      console.log('✓ Indexes verified/created across collections:');
      Object.entries(result.indexes).forEach(([coll, idxs]) => {
        console.log(`   [${coll}]: ${idxs.join(', ')}`);
      });
      console.log(`✓ Baseline fraud rules checked: ${result.totalRulesConfigured} rules active (${result.rulesSeeded} new seeded).`);
      console.log('----------------------------------------------------');
      console.log('MongoDB initialization completed successfully!');
      console.log('----------------------------------------------------');
      await closeMongo();
      process.exit(0);
    } catch (err) {
      console.error('\n✖ MongoDB initialization failed:');
      console.error(`  ${err.message}`);
      console.error('\nPlease verify that:');
      console.error('  1. MongoDB service is running (e.g. net start MongoDB).');
      console.error('  2. MONGODB_URI in your environment is reachable.\n');
      await closeMongo().catch(() => {});
      process.exit(1);
    }
  })();
}

module.exports = {
  initializeMongoDatabase,
  DEFAULT_FRAUD_RULES,
  SCHEMAS
};

