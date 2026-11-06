/**
 * ==============================================================================
 * Clean Previous Transactions Utility
 * ==============================================================================
 * Safely removes all previous transactional data and temporary test artifacts
 * across MySQL and MongoDB, restoring the system to a clean baseline state.
 *
 * Actions performed:
 * 1. Purges all fraud outbox events from `fraud_outbox_events` (satisfies ON DELETE RESTRICT).
 * 2. Deletes all transaction records from `bank_transactions`.
 * 3. Re-establishes the 4 baseline opening deposit records (1-4) from seed.sql.
 * 4. Cleans up leftover synthetic test accounts while preserving baseline accounts
 *    (1, 2, 3, 4) and user account (184 - Shashank Arya).
 * 5. Resets account balances to their authoritative baseline amounts.
 * 6. Purges financial transaction logs from `audit_logs` while preserving administrative logs.
 * 7. Clears MongoDB fraud collections (`transaction_risk_assessments`, `fraud_alerts`,
 *    `fraud_investigations`) while preserving calibrated `fraud_rules`.
 * ==============================================================================
 */

const path = require('path');
const { pool, query } = require('../config/db');
const { connectMongo, getDb, isMongoConnected, closeMongo } = require('../config/mongo');

async function cleanPreviousTransactions() {
  console.log('==============================================================================');
  console.log('Executing Complete Previous Transactions Cleanup');
  console.log('==============================================================================\n');

  try {
    // 1. Purge fraud outbox events
    const [delOutbox] = await pool.execute('DELETE FROM fraud_outbox_events');
    console.log(`[MySQL] Cleared fraud_outbox_events: ${delOutbox.affectedRows} row(s) removed.`);

    // 2. Delete all bank transactions
    const [delTxns] = await pool.execute('DELETE FROM bank_transactions');
    console.log(`[MySQL] Cleared bank_transactions: ${delTxns.affectedRows} row(s) removed.`);

    // 3. Re-insert baseline opening deposit transactions (1-4) from seed.sql
    await pool.execute(`
      INSERT INTO bank_transactions 
        (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks)
      VALUES
        (1, 'TXN-INIT-001', 'DEPOSIT', 10000.00, NULL, 1, 2, 'Baseline account opening deposit'),
        (2, 'TXN-INIT-002', 'DEPOSIT', 5000.00, NULL, 2, 2, 'Baseline account opening deposit'),
        (3, 'TXN-INIT-003', 'DEPOSIT', 2000.00, NULL, 3, 2, 'Baseline account opening deposit'),
        (4, 'TXN-INIT-004', 'DEPOSIT', 1000.00, NULL, 4, 3, 'Baseline account opening deposit')
    `);
    await pool.execute('ALTER TABLE bank_transactions AUTO_INCREMENT = 5');
    console.log('[MySQL] Restored 4 baseline opening deposits (TXN-INIT-001 to 004); AUTO_INCREMENT reset to 5.');

    // 4. Remove leftover synthetic test accounts created by automated test runners
    const [delAccounts] = await pool.execute(
      'DELETE FROM accounts WHERE account_id NOT IN (1, 2, 3, 4, 184)'
    );
    console.log(`[MySQL] Purged synthetic test accounts: ${delAccounts.affectedRows} leftover account(s) deleted.`);

    // 5. Reset baseline account balances
    await pool.execute('UPDATE accounts SET balance = 10000.00, status = "ACTIVE" WHERE account_id = 1');
    await pool.execute('UPDATE accounts SET balance = 5000.00, status = "ACTIVE" WHERE account_id = 2');
    await pool.execute('UPDATE accounts SET balance = 2000.00, status = "FROZEN" WHERE account_id = 3');
    await pool.execute('UPDATE accounts SET balance = 1000.00, status = "INACTIVE" WHERE account_id = 4');
    await pool.execute('UPDATE accounts SET balance = 0.00, status = "ACTIVE" WHERE account_id = 184');
    console.log('[MySQL] Reset account balances:');
    console.log('        - Account 1 (ACC-T1): ₹10,000.00 [ACTIVE]');
    console.log('        - Account 2 (ACC-T2): ₹5,000.00  [ACTIVE]');
    console.log('        - Account 3 (ACC-T3): ₹2,000.00  [FROZEN]');
    console.log('        - Account 4 (ACC-T4): ₹1,000.00  [INACTIVE]');
    console.log('        - Account 184 (ACC-SB-83198732): ₹0.00 [ACTIVE]');

    // 6. Purge financial transaction audit logs
    const [delAudit] = await pool.execute(`
      DELETE FROM audit_logs 
      WHERE action_type IN (
        'DEPOSIT_COMPLETED', 'WITHDRAWAL_COMPLETED', 'TRANSFER_COMPLETED',
        'DEPOSIT_FAILED', 'WITHDRAWAL_FAILED', 'TRANSFER_FAILED',
        'FUNDS_TRANSFER', 'CASH_DEPOSIT', 'CASH_WITHDRAWAL'
      )
    `);
    console.log(`[MySQL] Purged transaction audit logs: ${delAudit.affectedRows} record(s) removed.`);

    // 7. MongoDB collections cleanup
    await connectMongo();
    const db = getDb();

    const delAssess = await db.collection('transaction_risk_assessments').deleteMany({});
    console.log(`[Mongo] Cleared transaction_risk_assessments: ${delAssess.deletedCount} document(s) deleted.`);

    const delAlerts = await db.collection('fraud_alerts').deleteMany({});
    console.log(`[Mongo] Cleared fraud_alerts: ${delAlerts.deletedCount} document(s) deleted.`);

    const delInvest = await db.collection('fraud_investigations').deleteMany({});
    console.log(`[Mongo] Cleared fraud_investigations: ${delInvest.deletedCount} document(s) deleted.`);

    const rules = await db.collection('fraud_rules').find({}).toArray();
    console.log(`[Mongo] Preserved ${rules.length} calibrated fraud detection rules:`);
    rules.forEach((r) => {
      console.log(`        - ${r.ruleCode.padEnd(16)}: Weight ${r.weight} (Enabled: ${r.enabled})`);
    });

    await closeMongo();
    await pool.end();

    console.log('\n==============================================================================');
    console.log('Database Transaction Cleanup Completed Successfully!');
    console.log('==============================================================================');
    process.exit(0);
  } catch (err) {
    console.error('Fatal cleanup error:', err);
    process.exit(1);
  }
}

cleanPreviousTransactions();

