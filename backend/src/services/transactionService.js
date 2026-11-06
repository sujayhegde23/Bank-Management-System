/**
 * ==============================================================================
 * Transaction Domain Service (Issue #8)
 * ==============================================================================
 * Implements core banking business logic and ACID guarantees for financial transactions:
 * - FR-11: Prevent transactions on inactive or frozen accounts.
 * - FR-12: Cash/fund deposit into active bank accounts.
 * - FR-13: Cash/fund withdrawal from active bank accounts.
 * - FR-14: Insufficient balance rejection (overdraft protection).
 * - FR-18: Unique cryptographic transaction reference allocation (NFR-16).
 * - FR-19: Insert-only audit ledger recording in `bank_transactions` (NFR-10).
 * - NFR-04, NFR-18: Strict monetary input validation with exact DECIMAL handling.
 * - NFR-08, NFR-09, NFR-17: Atomic balance updates with row-level locking (SELECT ... FOR UPDATE).
 * ==============================================================================
 */

const crypto = require('crypto');
const { query, withTransaction } = require('../config/db');
const { recordAuditEvent } = require('./auditService');
const { recordOutboxEvent } = require('./fraud/outboxRepository');

// Type prefixes for human-readable transaction references
const TRANSACTION_TYPE_PREFIXES = {
  DEPOSIT: 'DEP',
  WITHDRAWAL: 'WTH',
  TRANSFER: 'TRF'
};

/**
 * Validates a monetary transaction amount according to strict banking rules.
 * - Must be present and non-empty.
 * - Must be a positive number greater than zero.
 * - Must have at most 2 decimal places (cents/paise).
 * - Must not exceed maximum allowed transaction limit (999,999,999.99).
 * - Formats to fixed 2-decimal string for exact DECIMAL SQL binding without float rounding errors.
 *
 * @param {any} amount - Input amount to validate
 * @returns {string} Normalized 2-decimal string (e.g. "2500.00")
 * @throws {Error} Throws TXN_002 (400) if invalid
 */
function validateMonetaryAmount(amount) {
  if (amount === undefined || amount === null || amount === '') {
    const error = new Error('Amount is required');
    error.statusCode = 400;
    error.code = 'TXN_002';
    error.safeMessage = 'Invalid amount';
    throw error;
  }

  const str = String(amount).trim();

  // Pattern: positive integer or decimal with 1-2 decimal places, no trailing garbage
  const validPattern = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
  if (!validPattern.test(str)) {
    const error = new Error('Amount must be a positive number with at most 2 decimal places');
    error.statusCode = 400;
    error.code = 'TXN_002';
    error.safeMessage = 'Invalid amount';
    throw error;
  }

  const num = Number(str);
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    const error = new Error('Amount must be greater than zero');
    error.statusCode = 400;
    error.code = 'TXN_002';
    error.safeMessage = 'Invalid amount';
    throw error;
  }

  // Maximum single transaction limit: ₹999,999,999.99
  if (num > 999999999.99) {
    const error = new Error('Amount exceeds maximum transaction limit of 999,999,999.99');
    error.statusCode = 400;
    error.code = 'TXN_002';
    error.safeMessage = 'Invalid amount';
    throw error;
  }

  return num.toFixed(2);
}

/**
 * Generates a unique, cryptographically secure transaction reference (FR-18, NFR-16).
 * Format: TXN-<TYPE_PREFIX>-<HEX_STRING>, e.g. TXN-DEP-A4B7C91E5D8F
 * Verifies uniqueness in bank_transactions with bounded collision retry loop.
 *
 * @param {'DEPOSIT'|'WITHDRAWAL'|'TRANSFER'} type - Transaction category
 * @param {import('mysql2/promise').Connection} [dbConn] - Optional active transaction connection
 * @param {number} [maxAttempts=5] - Maximum collision retry attempts
 * @returns {Promise<string>} Unique transaction reference
 */
async function generateUniqueTransactionRef(type = 'DEPOSIT', dbConn = null, maxAttempts = 5) {
  const typeKey = (type || 'DEPOSIT').toUpperCase();
  const typePrefix = TRANSACTION_TYPE_PREFIXES[typeKey] || 'TXN';
  const queryExecutor = dbConn ? (sql, params) => dbConn.execute(sql, params).then(([r]) => r) : query;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Generate 6 random bytes (12 uppercase hex characters)
    const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
    const candidateRef = `TXN-${typePrefix}-${randomHex}`;

    const existing = await queryExecutor(
      'SELECT transaction_id FROM bank_transactions WHERE transaction_ref = ? LIMIT 1',
      [candidateRef]
    );

    if (!existing || existing.length === 0) {
      return candidateRef;
    }
  }

  const error = new Error('Failed to generate a unique transaction reference. Please retry.');
  error.statusCode = 500;
  error.code = 'SYS_001';
  throw error;
}

/**
 * Execute an atomic cash/fund deposit into a bank account (FR-12, AC-1).
 *
 * Transaction flow:
 * 1. Acquire exclusive row lock on the target account: `SELECT ... FOR UPDATE`.
 * 2. Verify account exists (`ACC_002` if not found).
 * 3. Verify account status is 'ACTIVE' (`ACC_001` if FROZEN or INACTIVE per FR-11).
 * 4. Validate monetary amount (`TXN_002`).
 * 5. Update account balance using exact SQL DECIMAL addition: `balance = balance + ?`.
 * 6. Generate collision-free `transaction_ref` (`TXN-DEP-...`).
 * 7. Insert audit ledger record into `bank_transactions` (FR-19, NFR-10).
 * 8. Commit transaction and return updated state.
 *
 * Concurrency & Rollback:
 * If any error occurs or a failure point triggers, MySQL transaction automatically rolls back,
 * leaving balances and ledger records unaltered (NFR-08, NFR-09, NFR-17).
 *
 * @param {object} params
 * @param {number} params.accountId - Internal ID of target account
 * @param {number|string} params.amount - Deposit amount
 * @param {string} [params.remarks] - Optional audit note
 * @param {number} params.performedByUserId - User ID of executing employee
 * @param {string} [params._testFailurePoint] - Test hook to simulate mid-transaction failure for TC-10
 * @returns {Promise<object>} Created transaction and updated account balance
 */
async function executeDeposit({ accountId, amount, remarks = null, performedByUserId, _testFailurePoint = null }) {
  try {
    // Pre-validate amount before opening database transaction to minimize lock hold duration (NFR-07)
    const normalizedAmount = validateMonetaryAmount(amount);

    const result = await withTransaction(async (conn) => {
      // 1. Lock account row with SELECT ... FOR UPDATE (prevents concurrent status/balance races)
      const [rows] = await conn.execute(
        `SELECT account_id, account_number, customer_id, account_type, balance, status
         FROM accounts
         WHERE account_id = ?
         FOR UPDATE`,
        [accountId]
      );

      if (!rows || rows.length === 0) {
        const error = new Error('Account not found');
        error.statusCode = 404;
        error.code = 'ACC_002';
        error.safeMessage = 'Account not found';
        throw error;
      }

      const account = rows[0];

      // 2. Account status check under lock (FR-11)
      if (account.status !== 'ACTIVE') {
        const error = new Error('Account is frozen or inactive');
        error.statusCode = 409;
        error.code = 'ACC_001';
        error.safeMessage = 'Account is frozen or inactive';
        error.accountStatus = account.status;
        throw error;
      }

      // 3. Update account balance in MySQL
      await conn.execute(
        'UPDATE accounts SET balance = balance + ? WHERE account_id = ?',
        [normalizedAmount, accountId]
      );

      // Optional test hook for TC-10: Force failure after balance update but before ledger insert
      if (_testFailurePoint === 'AFTER_BALANCE_UPDATE') {
        const simError = new Error('Simulated database error after balance update (TC-10)');
        simError.statusCode = 500;
        simError.code = 'TXN_003';
        simError.safeMessage = 'Transaction failed. No money was moved.';
        throw simError;
      }

      // 4. Generate unique transaction identifier
      const transactionRef = await generateUniqueTransactionRef('DEPOSIT', conn);

      // Optional test hook for TC-10: Force failure immediately before ledger insertion
      if (_testFailurePoint === 'BEFORE_LEDGER_INSERT') {
        const simError = new Error('Simulated database failure before ledger insert (TC-10)');
        simError.statusCode = 500;
        simError.code = 'TXN_003';
        simError.safeMessage = 'Transaction failed. No money was moved.';
        throw simError;
      }

      // 5. Insert unmodifiable transaction ledger entry (NFR-10, FR-18, FR-19)
      // For DEPOSIT: source_account_id is NULL, destination_account_id is accountId
      const safeRemarks = remarks ? String(remarks).trim().substring(0, 255) : 'Cash deposit at branch';
      const [insertResult] = await conn.execute(
        `INSERT INTO bank_transactions
          (transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks)
         VALUES (?, 'DEPOSIT', ?, NULL, ?, ?, ?)`,
        [transactionRef, normalizedAmount, accountId, performedByUserId, safeRemarks]
      );

      // Phase 3: Record fraud evaluation event in the same atomic MySQL transaction
      await recordOutboxEvent(conn, {
        transactionId: insertResult.insertId,
        eventType: 'DEPOSIT',
        payload: {
          transactionId: insertResult.insertId,
          transactionRef,
          transactionType: 'DEPOSIT',
          amount: normalizedAmount,
          customerId: account.customer_id,
          accountId: account.account_id,
          destinationAccountId: null,
          performedByUserId,
          timestamp: new Date().toISOString()
        }
      });

      // Optional test hook: Force failure after ledger insert
      if (_testFailurePoint === 'AFTER_LEDGER_INSERT') {
        const simError = new Error('Simulated failure after ledger insert (TC-10)');
        simError.statusCode = 500;
        simError.code = 'TXN_003';
        simError.safeMessage = 'Transaction failed. No money was moved.';
        throw simError;
      }

      // 6. Retrieve committed balance from database
      const [balanceRows] = await conn.execute(
        'SELECT balance FROM accounts WHERE account_id = ?',
        [accountId]
      );
      const balanceAfter = balanceRows && balanceRows.length > 0 ? Number(balanceRows[0].balance) : Number(account.balance) + Number(normalizedAmount);

      return {
        transactionId: insertResult.insertId,
        transactionRef,
        transactionReference: transactionRef,
        type: 'DEPOSIT',
        accountId: account.account_id,
        accountNumber: account.account_number,
        amount: Number(normalizedAmount),
        previousBalance: Number(account.balance),
        balanceAfter,
        timestamp: new Date().toISOString()
      };
    });

    await recordAuditEvent({
      actorUserId: performedByUserId,
      actionType: 'DEPOSIT_COMPLETED',
      targetEntityType: 'ACCOUNT',
      targetEntityId: result.accountId,
      description: `Deposit of ${result.amount} completed into account ${result.accountNumber}. Reference: ${result.transactionRef}.`,
      result: 'SUCCESS',
      metadata: {
        transactionRef: result.transactionRef,
        amount: result.amount,
        accountNumber: result.accountNumber,
        balanceAfter: result.balanceAfter
      }
    });

    return result;
  } catch (error) {
    if (performedByUserId) {
      await recordAuditEvent({
        actorUserId: performedByUserId,
        actionType: 'DEPOSIT_FAILED',
        targetEntityType: 'ACCOUNT',
        targetEntityId: accountId || null,
        description: `Deposit failed for account ID ${accountId}: ${error.safeMessage || error.message}`,
        result: 'FAILURE',
        metadata: {
          amount,
          accountId,
          errorMessage: error.safeMessage || error.message
        }
      });
    }
    throw error;
  }
}

/**
 * Execute an atomic cash/fund withdrawal from a bank account (FR-13, AC-2).
 *
 * Transaction flow:
 * 1. Acquire exclusive row lock on the source account: `SELECT ... FOR UPDATE`.
 * 2. Verify account exists (`ACC_002` if not found).
 * 3. Verify account status is 'ACTIVE' (`ACC_001` if FROZEN or INACTIVE per FR-11).
 * 4. Validate monetary amount (`TXN_002`).
 * 5. Check sufficient available balance (`TXN_001` 422 if amount > balance per FR-14).
 * 6. Update account balance with conditional guard: `balance = balance - ? WHERE account_id = ? AND balance >= ?`.
 * 7. Generate collision-free `transaction_ref` (`TXN-WTH-...`).
 * 8. Insert audit ledger record into `bank_transactions` (FR-19, NFR-10).
 * 9. Commit transaction and return updated state.
 *
 * Concurrency & Rollback:
 * If two concurrent withdrawals target the same account, the first takes the X-lock.
 * The second waits on the lock, reads the updated balance, and is rejected if remaining funds
 * are insufficient. If any step fails, entire transaction rolls back cleanly (NFR-08, NFR-09, NFR-17).
 *
 * @param {object} params
 * @param {number} params.accountId - Internal ID of source account
 * @param {number|string} params.amount - Withdrawal amount
 * @param {string} [params.remarks] - Optional audit note
 * @param {number} params.performedByUserId - User ID of executing employee
 * @param {string} [params._testFailurePoint] - Test hook to simulate mid-transaction failure for TC-10
 * @returns {Promise<object>} Created transaction and updated account balance
 */
async function executeWithdrawal({ accountId, amount, remarks = null, performedByUserId, _testFailurePoint = null }) {
  try {
    // Pre-validate amount before opening database transaction
    const normalizedAmount = validateMonetaryAmount(amount);

    const result = await withTransaction(async (conn) => {
      // 1. Lock account row with SELECT ... FOR UPDATE
      const [rows] = await conn.execute(
        `SELECT account_id, account_number, customer_id, account_type, balance, status
         FROM accounts
         WHERE account_id = ?
         FOR UPDATE`,
        [accountId]
      );

      if (!rows || rows.length === 0) {
        const error = new Error('Account not found');
        error.statusCode = 404;
        error.code = 'ACC_002';
        error.safeMessage = 'Account not found';
        throw error;
      }

      const account = rows[0];

      // 2. Account status check under lock (FR-11)
      if (account.status !== 'ACTIVE') {
        const error = new Error('Account is frozen or inactive');
        error.statusCode = 409;
        error.code = 'ACC_001';
        error.safeMessage = 'Account is frozen or inactive';
        error.accountStatus = account.status;
        throw error;
      }

      // 3. Insufficient balance check (FR-14, TC-06, AC-4)
      const currentBalanceNum = Number(account.balance);
      const withdrawalAmountNum = Number(normalizedAmount);

      if (currentBalanceNum < withdrawalAmountNum) {
        const error = new Error('Insufficient balance');
        error.statusCode = 422;
        error.code = 'TXN_001';
        error.safeMessage = 'Insufficient balance';
        error.currentBalance = currentBalanceNum;
        error.requestedAmount = withdrawalAmountNum;
        throw error;
      }

      // 4. Update account balance with conditional overdraft guard
      const [updateResult] = await conn.execute(
        'UPDATE accounts SET balance = balance - ? WHERE account_id = ? AND balance >= ?',
        [normalizedAmount, accountId, normalizedAmount]
      );

      if (updateResult.affectedRows !== 1) {
        const error = new Error('Insufficient balance');
        error.statusCode = 422;
        error.code = 'TXN_001';
        error.safeMessage = 'Insufficient balance';
        throw error;
      }

      // Optional test hook for TC-10: Force failure after balance update
      if (_testFailurePoint === 'AFTER_BALANCE_UPDATE') {
        const simError = new Error('Simulated database error after balance update (TC-10)');
        simError.statusCode = 500;
        simError.code = 'TXN_003';
        simError.safeMessage = 'Transaction failed. No money was moved.';
        throw simError;
      }

      // 5. Generate unique transaction identifier
      const transactionRef = await generateUniqueTransactionRef('WITHDRAWAL', conn);

      // Optional test hook for TC-10: Force failure immediately before ledger insert
      if (_testFailurePoint === 'BEFORE_LEDGER_INSERT') {
        const simError = new Error('Simulated database failure before ledger insert (TC-10)');
        simError.statusCode = 500;
        simError.code = 'TXN_003';
        simError.safeMessage = 'Transaction failed. No money was moved.';
        throw simError;
      }

      // 6. Insert unmodifiable transaction ledger entry (NFR-10, FR-18, FR-19)
      // For WITHDRAWAL: source_account_id is accountId, destination_account_id is NULL
      const safeRemarks = remarks ? String(remarks).trim().substring(0, 255) : 'Cash withdrawal at branch';
      const [insertResult] = await conn.execute(
        `INSERT INTO bank_transactions
          (transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks)
         VALUES (?, 'WITHDRAWAL', ?, ?, NULL, ?, ?)`,
        [transactionRef, normalizedAmount, accountId, performedByUserId, safeRemarks]
      );

      // Phase 3: Record fraud evaluation event in the same atomic MySQL transaction
      await recordOutboxEvent(conn, {
        transactionId: insertResult.insertId,
        eventType: 'WITHDRAWAL',
        payload: {
          transactionId: insertResult.insertId,
          transactionRef,
          transactionType: 'WITHDRAWAL',
          amount: normalizedAmount,
          customerId: account.customer_id,
          accountId: account.account_id,
          destinationAccountId: null,
          performedByUserId,
          timestamp: new Date().toISOString()
        }
      });

      // Optional test hook: Force failure after ledger insert
      if (_testFailurePoint === 'AFTER_LEDGER_INSERT') {
        const simError = new Error('Simulated failure after ledger insert (TC-10)');
        simError.statusCode = 500;
        simError.code = 'TXN_003';
        simError.safeMessage = 'Transaction failed. No money was moved.';
        throw simError;
      }

      // 7. Retrieve committed balance from database
      const [balanceRows] = await conn.execute(
        'SELECT balance FROM accounts WHERE account_id = ?',
        [accountId]
      );
      const balanceAfter = balanceRows && balanceRows.length > 0 ? Number(balanceRows[0].balance) : currentBalanceNum - withdrawalAmountNum;

      return {
        transactionId: insertResult.insertId,
        transactionRef,
        transactionReference: transactionRef,
        type: 'WITHDRAWAL',
        accountId: account.account_id,
        accountNumber: account.account_number,
        amount: Number(normalizedAmount),
        previousBalance: Number(account.balance),
        balanceAfter,
        timestamp: new Date().toISOString()
      };
    });

    await recordAuditEvent({
      actorUserId: performedByUserId,
      actionType: 'WITHDRAWAL_COMPLETED',
      targetEntityType: 'ACCOUNT',
      targetEntityId: result.accountId,
      description: `Withdrawal of ${result.amount} completed from account ${result.accountNumber}. Reference: ${result.transactionRef}.`,
      result: 'SUCCESS',
      metadata: {
        transactionRef: result.transactionRef,
        amount: result.amount,
        accountNumber: result.accountNumber,
        balanceAfter: result.balanceAfter
      }
    });

    return result;
  } catch (error) {
    if (performedByUserId) {
      await recordAuditEvent({
        actorUserId: performedByUserId,
        actionType: 'WITHDRAWAL_FAILED',
        targetEntityType: 'ACCOUNT',
        targetEntityId: accountId || null,
        description: `Withdrawal failed from account ID ${accountId}: ${error.safeMessage || error.message}`,
        result: 'FAILURE',
        metadata: {
          amount,
          accountId,
          errorMessage: error.safeMessage || error.message
        }
      });
    }
    throw error;
  }
}

/**
 * Retrieve transaction history for an account with authorization and isolation rules (FR-20, FR-21).
 *
 * Authorization:
 * - Bank Employee and Admin can view transaction history for any account (FR-21).
 * - Customer can view transaction history ONLY for accounts they own (FR-20, NFR-03, TC-16).
 *
 * @param {object} params
 * @param {number} params.accountId - Internal account ID
 * @param {object} params.user - Authenticated user context (req.user)
 * @param {number} [params.page=1] - Page number (1-based)
 * @param {number} [params.size=20] - Page size
 * @returns {Promise<object>} Paginated transaction records
 */
async function getAccountTransactions({ accountId, user, page = 1, size = 20, type, startDate, endDate }) {
  // 1. Verify account exists and retrieve ownership
  const accountRows = await query(
    'SELECT account_id, account_number, account_type, balance, customer_id, status FROM accounts WHERE account_id = ? LIMIT 1',
    [accountId]
  );

  if (!accountRows || accountRows.length === 0) {
    const error = new Error('Account not found');
    error.statusCode = 404;
    error.code = 'ACC_002';
    error.safeMessage = 'Account not found';
    throw error;
  }

  const account = accountRows[0];

  // 2. Customer data isolation check (NFR-03, TC-16)
  if (user && user.role === 'CUSTOMER') {
    if (!user.customerId || Number(user.customerId) !== Number(account.customer_id)) {
      const error = new Error('You are not authorized to view transactions for this account');
      error.statusCode = 403;
      error.code = 'AUTH_002';
      error.safeMessage = 'You are not authorized to perform this operation';
      throw error;
    }
  }

  // 3. Pagination sanitization
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(size, 10) || 20));
  const offset = (pageNum - 1) * pageSize;

  // 4. Build dynamic query filters
  const whereClauses = ['(t.source_account_id = ? OR t.destination_account_id = ?)'];
  const filterParams = [accountId, accountId];

  if (type && typeof type === 'string' && type.trim() !== '') {
    const normalizedType = type.trim().toUpperCase();
    if (['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'].includes(normalizedType)) {
      whereClauses.push('t.type = ?');
      filterParams.push(normalizedType);
    }
  }

  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!isNaN(parsedStart.getTime())) {
      whereClauses.push('t.created_at >= ?');
      filterParams.push(parsedStart);
    }
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!isNaN(parsedEnd.getTime())) {
      if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
        parsedEnd.setHours(23, 59, 59, 999);
      }
      whereClauses.push('t.created_at <= ?');
      filterParams.push(parsedEnd);
    }
  }

  const whereSql = whereClauses.join(' AND ');

  // 5. Count total matching transactions
  const countSql = `SELECT COUNT(*) AS total FROM bank_transactions t WHERE ${whereSql}`;
  const countRows = await query(countSql, filterParams);
  const total = countRows[0]?.total || 0;

  // 6. Query transactions with deterministic sort (ORDER BY t.created_at DESC, t.transaction_id DESC)
  const selectSql = `
    SELECT
      t.transaction_id AS transactionId,
      t.transaction_ref AS transactionRef,
      t.type,
      t.amount,
      t.source_account_id AS sourceAccountId,
      t.destination_account_id AS destinationAccountId,
      sa.account_number AS sourceAccountNumber,
      da.account_number AS destinationAccountNumber,
      t.performed_by_user_id AS performedByUserId,
      t.remarks,
      t.created_at AS timestamp,
      t.created_at AS createdAt,
      CASE
        WHEN t.destination_account_id = ? THEN 'CREDIT'
        WHEN t.source_account_id = ? THEN 'DEBIT'
        ELSE 'UNKNOWN'
      END AS direction
    FROM bank_transactions t
    LEFT JOIN accounts sa ON t.source_account_id = sa.account_id
    LEFT JOIN accounts da ON t.destination_account_id = da.account_id
    WHERE ${whereSql}
    ORDER BY t.created_at DESC, t.transaction_id DESC
    LIMIT ? OFFSET ?
  `;

  const selectParams = [accountId, accountId, ...filterParams, pageSize, offset];
  const rows = await query(selectSql, selectParams);

  const formattedTransactions = rows.map((r) => ({
    transactionId: r.transactionId,
    transactionRef: r.transactionRef,
    transactionReference: r.transactionRef,
    type: r.type,
    amount: Number(r.amount),
    direction: r.direction,
    sourceAccountId: r.sourceAccountId,
    destinationAccountId: r.destinationAccountId,
    sourceAccountNumber: r.sourceAccountNumber,
    destinationAccountNumber: r.destinationAccountNumber,
    remarks: r.remarks,
    timestamp: r.timestamp,
    createdAt: r.createdAt
  }));

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    accountId: account.account_id,
    accountNumber: account.account_number,
    accountType: account.account_type,
    balance: Number(account.balance),
    currentBalance: Number(account.balance),
    availableBalance: account.status === 'ACTIVE' ? Number(account.balance) : 0,
    status: account.status,
    transactions: formattedTransactions,
    items: formattedTransactions,
    pagination: {
      page: pageNum,
      pageSize,
      total,
      totalItems: total,
      totalPages
    },
    page: pageNum,
    pageSize,
    total,
    totalItems: total,
    totalPages
  };
}

/**
 * Retrieve global paginated transaction records across the bank (FR-21).
 * Restricted to Bank Employees and Administrators for audit and oversight.
 * Supports filtering by account number, account ID, transaction type, date range, and search.
 *
 * @param {object} params
 * @param {number|string} [params.page=1]
 * @param {number|string} [params.limit=20]
 * @param {string} [params.accountNumber] - Filter by account number (source or destination)
 * @param {number|string} [params.accountId] - Filter by account ID (source or destination)
 * @param {string} [params.type] - Filter by type ('DEPOSIT'|'WITHDRAWAL'|'TRANSFER')
 * @param {string} [params.startDate] - Start date/time filter
 * @param {string} [params.endDate] - End date/time filter
 * @param {string} [params.search] - Search by reference or account number
 * @returns {Promise<object>} Paginated transaction records
 */
async function listBankTransactions({
  page = 1,
  limit = 20,
  accountNumber,
  accountId,
  type,
  startDate,
  endDate,
  search
} = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * pageSize;

  const whereClauses = [];
  const queryParams = [];

  if (accountNumber && typeof accountNumber === 'string' && accountNumber.trim() !== '') {
    whereClauses.push('(sa.account_number = ? OR da.account_number = ?)');
    queryParams.push(accountNumber.trim(), accountNumber.trim());
  }

  if (accountId) {
    const parsedAccId = Number(accountId);
    if (Number.isSafeInteger(parsedAccId) && parsedAccId > 0) {
      whereClauses.push('(t.source_account_id = ? OR t.destination_account_id = ?)');
      queryParams.push(parsedAccId, parsedAccId);
    }
  }

  if (type && typeof type === 'string' && type.trim() !== '') {
    const normalizedType = type.trim().toUpperCase();
    if (['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'].includes(normalizedType)) {
      whereClauses.push('t.type = ?');
      queryParams.push(normalizedType);
    }
  }

  if (startDate) {
    const parsedStart = new Date(startDate);
    if (!isNaN(parsedStart.getTime())) {
      whereClauses.push('t.created_at >= ?');
      queryParams.push(parsedStart);
    }
  }

  if (endDate) {
    const parsedEnd = new Date(endDate);
    if (!isNaN(parsedEnd.getTime())) {
      if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate.trim())) {
        parsedEnd.setHours(23, 59, 59, 999);
      }
      whereClauses.push('t.created_at <= ?');
      queryParams.push(parsedEnd);
    }
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    whereClauses.push('(t.transaction_ref LIKE ? OR sa.account_number LIKE ? OR da.account_number LIKE ?)');
    queryParams.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Count total matching transactions
  const countSql = `
    SELECT COUNT(*) AS total
    FROM bank_transactions t
    LEFT JOIN accounts sa ON t.source_account_id = sa.account_id
    LEFT JOIN accounts da ON t.destination_account_id = da.account_id
    ${whereSql}
  `;
  const countRows = await query(countSql, queryParams);
  const total = countRows[0]?.total || 0;

  // Query transactions with deterministic sort
  const selectSql = `
    SELECT
      t.transaction_id AS transactionId,
      t.transaction_ref AS transactionRef,
      t.type,
      t.amount,
      t.source_account_id AS sourceAccountId,
      t.destination_account_id AS destinationAccountId,
      sa.account_number AS sourceAccountNumber,
      da.account_number AS destinationAccountNumber,
      t.performed_by_user_id AS performedByUserId,
      u.username AS performedByUsername,
      t.remarks,
      t.created_at AS timestamp,
      t.created_at AS createdAt
    FROM bank_transactions t
    LEFT JOIN accounts sa ON t.source_account_id = sa.account_id
    LEFT JOIN accounts da ON t.destination_account_id = da.account_id
    LEFT JOIN users u ON t.performed_by_user_id = u.user_id
    ${whereSql}
    ORDER BY t.created_at DESC, t.transaction_id DESC
    LIMIT ? OFFSET ?
  `;

  const rows = await query(selectSql, [...queryParams, pageSize, offset]);

  const formattedTransactions = rows.map((r) => ({
    transactionId: r.transactionId,
    transactionRef: r.transactionRef,
    transactionReference: r.transactionRef,
    type: r.type,
    amount: Number(r.amount),
    sourceAccountId: r.sourceAccountId,
    destinationAccountId: r.destinationAccountId,
    sourceAccountNumber: r.sourceAccountNumber,
    destinationAccountNumber: r.destinationAccountNumber,
    performedByUserId: r.performedByUserId,
    performedByUsername: r.performedByUsername,
    remarks: r.remarks,
    timestamp: r.timestamp,
    createdAt: r.createdAt
  }));

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    transactions: formattedTransactions,
    items: formattedTransactions,
    pagination: {
      page: pageNum,
      limit: pageSize,
      pageSize,
      total,
      totalItems: total,
      totalPages
    },
    page: pageNum,
    limit: pageSize,
    pageSize,
    total,
    totalItems: total,
    totalPages
  };
}


// ------------------------------------------------------------------------------
// Transfer Idempotency and In-Flight Deduplication Stores (Feature 3)
// ------------------------------------------------------------------------------
const transferIdempotencyStore = new Map();
const recentTransferFingerprints = new Map();

function pruneTransferStores() {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes
  for (const [key, val] of transferIdempotencyStore.entries()) {
    if (now - val.timestamp > maxAge) {
      transferIdempotencyStore.delete(key);
    }
  }
  for (const [key, val] of recentTransferFingerprints.entries()) {
    if (now - val.timestamp > maxAge) {
      recentTransferFingerprints.delete(key);
    }
  }
}

/**
 * Mask an account number for beneficiary verification privacy (Feature 3).
 * Keeps standard prefix and last 4 characters, masking sensitive middle digits.
 * E.g., 'ACC-SB-25838103' -> 'ACC-SB-****8103'
 *       'ACC-CA-77245049' -> 'ACC-CA-****5049'
 *       'ACC-T2'          -> 'AC****T2'
 * @param {string} accountNumber
 * @returns {string}
 */
function maskAccountNumber(accountNumber) {
  if (!accountNumber || typeof accountNumber !== 'string') return '';
  const trimmed = accountNumber.trim();
  const parts = trimmed.split('-');
  if (parts.length === 3) {
    const lastPart = parts[2];
    const maskedLast = lastPart.length > 4 ? '****' + lastPart.slice(-4) : '****';
    return `${parts[0]}-${parts[1]}-${maskedLast}`;
  }
  if (trimmed.length <= 4) {
    return '****' + trimmed.slice(-2);
  }
  if (trimmed.length <= 8) {
    return trimmed.slice(0, 2) + '****' + trimmed.slice(-2);
  }
  return trimmed.slice(0, 4) + '****' + trimmed.slice(-4);
}

/**
 * Verify a destination beneficiary account before initiating fund transfer (Feature 3).
 *
 * Requirements:
 * - Find destination account by ID or account number.
 * - Verify account exists.
 * - Verify account is ACTIVE (reject FROZEN or INACTIVE with 409 ACC_001).
 * - Verify destination is not identical to source account (if source provided).
 * - Return ONLY minimum info: beneficiaryName, maskedAccountNumber, accountType, verificationStatus.
 *
 * @param {object} params
 * @param {string|number} params.destinationAccount - Destination account ID or number
 * @param {number} [params.sourceAccountId] - Optional source account ID to ensure source !== destination
 * @param {number} [params.sessionCustomerId] - Verified customer ID from authenticated session
 * @returns {Promise<object>} Beneficiary verification payload
 */
async function verifyBeneficiary({
  destinationAccount,
  sourceAccountId = null,
  sessionCustomerId = null
}) {
  if (destinationAccount === undefined || destinationAccount === null || String(destinationAccount).trim() === '') {
    const error = new Error('Destination account is required');
    error.statusCode = 400;
    error.code = 'VAL_001';
    error.safeMessage = 'Destination account is required';
    throw error;
  }

  const destStr = String(destinationAccount).trim();
  let matchedAccount = null;

  // 1. If purely numeric digits, check direct account_id lookup first
  if (/^[1-9]\d*$/.test(destStr)) {
    const candidateId = Number(destStr);
    const idCheck = await query(
      `SELECT a.account_id, a.account_number, a.account_type, a.status, a.customer_id, c.full_name
       FROM accounts a
       JOIN customers c ON a.customer_id = c.customer_id
       WHERE a.account_id = ?
       LIMIT 1`,
      [candidateId]
    );
    if (idCheck && idCheck.length > 0) {
      matchedAccount = idCheck[0];
    }
  }

  // 2. Lookup by account_number
  if (!matchedAccount) {
    const numCheck = await query(
      `SELECT a.account_id, a.account_number, a.account_type, a.status, a.customer_id, c.full_name
       FROM accounts a
       JOIN customers c ON a.customer_id = c.customer_id
       WHERE a.account_number = ?
       LIMIT 1`,
      [destStr]
    );
    if (numCheck && numCheck.length > 0) {
      matchedAccount = numCheck[0];
    }
  }

  // 3. Destination account does not exist
  if (!matchedAccount) {
    const error = new Error('Destination account not found');
    error.statusCode = 404;
    error.code = 'ACC_002';
    error.safeMessage = 'Destination account not found';
    throw error;
  }

  // 4. Same account check (if sourceAccountId provided)
  if (sourceAccountId !== undefined && sourceAccountId !== null && sourceAccountId !== '') {
    const srcId = Number(sourceAccountId);
    if (matchedAccount.account_id === srcId) {
      const error = new Error('Source and destination accounts must be different');
      error.statusCode = 400;
      error.code = 'TXN_002';
      error.safeMessage = 'Source and destination accounts must be different';
      throw error;
    }
  }

  // 5. Account status validation
  if (matchedAccount.status !== 'ACTIVE') {
    const error = new Error('Destination account is frozen or inactive');
    error.statusCode = 409;
    error.code = 'ACC_001';
    error.safeMessage = 'Destination account is frozen or inactive';
    error.accountStatus = matchedAccount.status;
    throw error;
  }

  return {
    beneficiaryName: matchedAccount.full_name,
    maskedAccountNumber: maskAccountNumber(matchedAccount.account_number),
    accountType: matchedAccount.account_type,
    verificationStatus: 'VERIFIED'
  };
}

/**
 * Clear deduplication stores for testing purposes.
 */
function _resetTransferDeduplicationStores() {
  transferIdempotencyStore.clear();
  recentTransferFingerprints.clear();
}

/**
 * Execute an atomic customer fund transfer between two bank accounts (FR-15, FR-16, FR-17, Issue #9).
 *
 * Transaction flow:
 * 1. Validate monetary amount (NFR-04, TXN_002).
 * 2. Pre-verify source and destination IDs are distinct (TXN_002).
 * 3. Open MySQL InnoDB transaction boundary with `withTransaction` (NFR-09).
 * 4. Resolve destination account ID if passed as account number.
 * 5. Deadlock-free row-level locking: Acquire exclusive X-locks (SELECT ... FOR UPDATE)
 *    in strictly increasing numerical order of account_id (AC-4, NFR-17).
 * 6. Verify source and destination accounts exist (ACC_002).
 * 7. Enforce customer ownership on source account: session customer must own source (AC-1, NFR-03).
 * 8. Verify operational status of both source and destination accounts is 'ACTIVE' (FR-11, ACC_001).
 * 9. Verify sufficient source balance: reject overdrafts with TXN_001 (FR-14, FR-16).
 * 10. Atomic debit on sender account: UPDATE accounts SET balance = balance - ? (FR-17).
 * 11. Atomic credit on recipient account: UPDATE accounts SET balance = balance + ? (FR-17).
 * 12. Generate collision-resistant transaction reference TXN-TRF-... (FR-18).
 * 13. Insert immutable ledger record into `bank_transactions` (FR-19, NFR-10).
 * 14. Commit transaction and return updated state with customer isolation (AC-2, NFR-03).
 *
 * Concurrency & Deadlock Strategy:
 * When locking multiple rows, sorting account IDs ascending ensures that two concurrent transfers
 * between the same pair of accounts (A -> B and B -> A) lock accounts in identical order (min(A,B) then max(A,B)),
 * mathematically preventing circular wait deadlocks.
 *
 * @param {object} params
 * @param {number} params.sourceAccountId - Source internal account ID
 * @param {number|string} [params.destinationAccountId] - Destination internal account ID or account number
 * @param {string} [params.destinationAccountNumber] - Optional explicit destination account number
 * @param {number|string} params.amount - Transfer amount
 * @param {string} [params.remarks] - Optional transfer memo
 * @param {number} params.performedByUserId - User ID of executing customer/user
 * @param {number} [params.sessionCustomerId] - Verified customer ID from authenticated session
 * @param {string} [params._testFailurePoint] - Test hook to simulate failure at various stages (TC-10)
 * @returns {Promise<object>} Created transfer transaction details
 */
async function executeTransfer({
  sourceAccountId,
  destinationAccountId,
  destinationAccountNumber,
  amount,
  remarks = null,
  performedByUserId,
  sessionCustomerId,
  idempotencyKey = null,
  _testFailurePoint = null
}) {
  pruneTransferStores();

  // 1. Check explicit idempotency key if provided
  const trimmedIdempKey = idempotencyKey ? String(idempotencyKey).trim() : null;
  if (trimmedIdempKey) {
    const existingEntry = transferIdempotencyStore.get(trimmedIdempKey);
    if (existingEntry) {
      if (existingEntry.status === 'PENDING') {
        const error = new Error('A transfer request with this idempotency key is currently processing');
        error.statusCode = 409;
        error.code = 'TXN_004';
        error.safeMessage = 'A transfer request with this idempotency key is currently processing';
        throw error;
      }
      if (existingEntry.status === 'COMPLETED') {
        return {
          ...existingEntry.result,
          isIdempotentReplay: true
        };
      }
    }
  }

  // 2. Validate monetary amount (NFR-04, TXN_002)
  const normalizedAmount = validateMonetaryAmount(amount);

  // 3. Validate source account ID parameter
  const srcId = Number(sourceAccountId);
  if (!Number.isSafeInteger(srcId) || srcId <= 0) {
    const error = new Error('Invalid source account ID');
    error.statusCode = 400;
    error.code = 'VAL_001';
    error.safeMessage = 'Invalid source account ID';
    throw error;
  }

  // Determine raw destination target
  const rawDest = destinationAccountId !== undefined && destinationAccountId !== null && destinationAccountId !== ''
    ? destinationAccountId
    : destinationAccountNumber;

  if (rawDest === undefined || rawDest === null || String(rawDest).trim() === '') {
    const error = new Error('Destination account is required');
    error.statusCode = 400;
    error.code = 'VAL_001';
    error.safeMessage = 'Destination account is required';
    throw error;
  }

  const now = Date.now();
  // Register in-flight idempotency lock if idempotencyKey is supplied
  if (trimmedIdempKey) {
    transferIdempotencyStore.set(trimmedIdempKey, { status: 'PENDING', timestamp: now });
  }

  try {
    const result = await withTransaction(async (conn) => {
    // 3. Resolve destination account ID if passed as account number or string
    let resolvedDestId = null;
    const destStr = String(rawDest).trim();

    // If destination is purely numeric digits, try direct ID lookup first
    if (/^[1-9]\d*$/.test(destStr)) {
      const candidateId = Number(destStr);
      const [idCheck] = await conn.execute(
        'SELECT account_id FROM accounts WHERE account_id = ? LIMIT 1',
        [candidateId]
      );
      if (idCheck && idCheck.length > 0) {
        resolvedDestId = candidateId;
      }
    }

    // If not found by ID or if destination is an account number string (e.g. ACC-T2)
    if (!resolvedDestId) {
      const [numCheck] = await conn.execute(
        'SELECT account_id FROM accounts WHERE account_number = ? LIMIT 1',
        [destStr]
      );
      if (numCheck && numCheck.length > 0) {
        resolvedDestId = numCheck[0].account_id;
      }
    }

    // If destination account does not exist (AC-2, ACC_002 404)
    if (!resolvedDestId) {
      const error = new Error('Destination account not found');
      error.statusCode = 404;
      error.code = 'ACC_002';
      error.safeMessage = 'Destination account not found';
      throw error;
    }

    // 4. Verify source and destination are different accounts (AC-2, TXN_002 400)
    if (srcId === resolvedDestId) {
      const error = new Error('Source and destination accounts must be different');
      error.statusCode = 400;
      error.code = 'TXN_002';
      error.safeMessage = 'Source and destination accounts must be different';
      throw error;
    }

    // 5. Deadlock-free row-level exclusive locking (AC-4, NFR-17)
    // Acquire locks in consistent numerical order of account_id
    const [firstLockId, secondLockId] = [srcId, resolvedDestId].sort((a, b) => a - b);

    const [rows1] = await conn.execute(
      `SELECT account_id, account_number, customer_id, account_type, balance, status
       FROM accounts
       WHERE account_id = ?
       FOR UPDATE`,
      [firstLockId]
    );

    const [rows2] = await conn.execute(
      `SELECT account_id, account_number, customer_id, account_type, balance, status
       FROM accounts
       WHERE account_id = ?
       FOR UPDATE`,
      [secondLockId]
    );

    // Map locked account records
    const allLocked = [...(rows1 || []), ...(rows2 || [])];
    const sourceAccount = allLocked.find((a) => a.account_id === srcId);
    const destAccount = allLocked.find((a) => a.account_id === resolvedDestId);

    if (!sourceAccount) {
      const error = new Error('Source account not found');
      error.statusCode = 404;
      error.code = 'ACC_002';
      error.safeMessage = 'Source account not found';
      throw error;
    }

    if (!destAccount) {
      const error = new Error('Destination account not found');
      error.statusCode = 404;
      error.code = 'ACC_002';
      error.safeMessage = 'Destination account not found';
      throw error;
    }

    // 6. Customer ownership authorization check (AC-1, NFR-03)
    if (sessionCustomerId !== undefined && sessionCustomerId !== null) {
      if (!sessionCustomerId || Number(sourceAccount.customer_id) !== Number(sessionCustomerId)) {
        const error = new Error('You are not authorized to transfer from this account');
        error.statusCode = 403;
        error.code = 'AUTH_002';
        error.safeMessage = 'You are not authorized to perform this operation';
        throw error;
      }
    }

    // 7. Source account status check (AC-2, FR-11, TC-08)
    if (sourceAccount.status !== 'ACTIVE') {
      const error = new Error('Source account is frozen or inactive');
      error.statusCode = 409;
      error.code = 'ACC_001';
      error.safeMessage = 'Source account is frozen or inactive';
      error.accountStatus = sourceAccount.status;
      throw error;
    }

    // 8. Destination account status check (AC-2, FR-11, TC-08)
    if (destAccount.status !== 'ACTIVE') {
      const error = new Error('Destination account is frozen or inactive');
      error.statusCode = 409;
      error.code = 'ACC_001';
      error.safeMessage = 'Destination account is frozen or inactive';
      error.accountStatus = destAccount.status;
      throw error;
    }

    // 9. Available balance and overdraft check (AC-3, FR-14, FR-16, TC-06)
    const currentSrcBal = Number(sourceAccount.balance);
    const transferAmt = Number(normalizedAmount);

    if (currentSrcBal < transferAmt) {
      const error = new Error('Insufficient balance');
      error.statusCode = 422;
      error.code = 'TXN_001';
      error.safeMessage = 'Insufficient balance';
      error.currentBalance = currentSrcBal;
      error.requestedAmount = transferAmt;
      throw error;
    }

    // 10. Atomic debit on sender account (AC-4, FR-17)
    const [debitResult] = await conn.execute(
      'UPDATE accounts SET balance = balance - ? WHERE account_id = ? AND balance >= ?',
      [normalizedAmount, srcId, normalizedAmount]
    );

    if (debitResult.affectedRows !== 1) {
      const error = new Error('Insufficient balance');
      error.statusCode = 422;
      error.code = 'TXN_001';
      error.safeMessage = 'Insufficient balance';
      throw error;
    }

    // Optional test hook for TC-10: Force failure after sender debit
    if (_testFailurePoint === 'AFTER_DEBIT') {
      const simError = new Error('Simulated failure after sender debit (TC-10)');
      simError.statusCode = 500;
      simError.code = 'TXN_003';
      simError.safeMessage = 'Transaction failed. No money was moved.';
      throw simError;
    }

    // 11. Atomic credit on recipient account (AC-4, FR-17)
    const [creditResult] = await conn.execute(
      'UPDATE accounts SET balance = balance + ? WHERE account_id = ?',
      [normalizedAmount, resolvedDestId]
    );

    if (creditResult.affectedRows !== 1) {
      const error = new Error('Failed to credit destination account');
      error.statusCode = 500;
      error.code = 'TXN_003';
      error.safeMessage = 'Transaction failed. No money was moved.';
      throw error;
    }

    // Optional test hook for TC-10: Force failure after recipient credit
    if (_testFailurePoint === 'AFTER_CREDIT') {
      const simError = new Error('Simulated failure after recipient credit (TC-10)');
      simError.statusCode = 500;
      simError.code = 'TXN_003';
      simError.safeMessage = 'Transaction failed. No money was moved.';
      throw simError;
    }

    // 12. Generate unique cryptographic transaction reference (FR-18)
    const transactionRef = await generateUniqueTransactionRef('TRANSFER', conn);

    // Optional test hook for TC-10: Force failure immediately before ledger insert
    if (_testFailurePoint === 'BEFORE_LEDGER_INSERT') {
      const simError = new Error('Simulated failure before ledger insert (TC-10)');
      simError.statusCode = 500;
      simError.code = 'TXN_003';
      simError.safeMessage = 'Transaction failed. No money was moved.';
      throw simError;
    }

    // 13. Insert unmodifiable transaction ledger entry (AC-5, FR-19, NFR-10)
    const safeRemarks = remarks ? String(remarks).trim().substring(0, 255) : 'Customer fund transfer';
    const [insertResult] = await conn.execute(
      `INSERT INTO bank_transactions
        (transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks)
       VALUES (?, 'TRANSFER', ?, ?, ?, ?, ?)`,
      [transactionRef, normalizedAmount, srcId, resolvedDestId, performedByUserId, safeRemarks]
    );

    // Phase 3: Record fraud evaluation event in the same atomic MySQL transaction
    await recordOutboxEvent(conn, {
      transactionId: insertResult.insertId,
      eventType: 'TRANSFER',
      payload: {
        transactionId: insertResult.insertId,
        transactionRef,
        transactionType: 'TRANSFER',
        amount: normalizedAmount,
        customerId: sourceAccount.customer_id,
        accountId: sourceAccount.account_id,
        destinationAccountId: resolvedDestId,
        performedByUserId,
        timestamp: new Date().toISOString()
      }
    });

    // Optional test hook for TC-10: Force failure after ledger insert
    if (_testFailurePoint === 'AFTER_LEDGER_INSERT') {
      const simError = new Error('Simulated failure after ledger insert (TC-10)');
      simError.statusCode = 500;
      simError.code = 'TXN_003';
      simError.safeMessage = 'Transaction failed. No money was moved.';
      throw simError;
    }

    // 14. Query final source account balance
    const [balanceRows] = await conn.execute(
      'SELECT balance FROM accounts WHERE account_id = ?',
      [srcId]
    );
    const sourceBalanceAfter = balanceRows && balanceRows.length > 0
      ? Number(balanceRows[0].balance)
      : currentSrcBal - transferAmt;

    return {
      transactionId: insertResult.insertId,
      transactionRef,
      transactionReference: transactionRef,
      type: 'TRANSFER',
      sourceAccountId: sourceAccount.account_id,
      sourceAccountNumber: sourceAccount.account_number,
      destinationAccountId: destAccount.account_id,
      destinationAccountNumber: destAccount.account_number,
      amount: Number(normalizedAmount),
      sourceBalanceAfter,
      timestamp: new Date().toISOString()
    };
  });

  await recordAuditEvent({
    actorUserId: performedByUserId,
    actionType: 'TRANSFER_COMPLETED',
    targetEntityType: 'ACCOUNT',
    targetEntityId: result.sourceAccountId,
    description: `Fund transfer of ${result.amount} completed from account ${result.sourceAccountNumber} to account ${result.destinationAccountNumber}. Reference: ${result.transactionRef}.`,
    result: 'SUCCESS',
    metadata: {
      transactionRef: result.transactionRef,
      amount: result.amount,
      sourceAccountNumber: result.sourceAccountNumber,
      destinationAccountNumber: result.destinationAccountNumber,
      sourceBalanceAfter: result.sourceBalanceAfter
    }
  });

  // Save successful result to deduplication store if idempotencyKey supplied
  if (trimmedIdempKey) {
    transferIdempotencyStore.set(trimmedIdempKey, { status: 'COMPLETED', result, timestamp: Date.now() });
  }

  return result;
} catch (error) {
  // Release in-flight lock on error
  if (trimmedIdempKey) {
    transferIdempotencyStore.delete(trimmedIdempKey);
  }
  if (performedByUserId) {
    await recordAuditEvent({
      actorUserId: performedByUserId,
      actionType: 'TRANSFER_FAILED',
      targetEntityType: 'ACCOUNT',
      targetEntityId: sourceAccountId || null,
      description: `Fund transfer failed from account ID ${sourceAccountId}: ${error.safeMessage || error.message}`,
      result: 'FAILURE',
      metadata: {
        amount,
        sourceAccountId,
        destinationAccountId,
        destinationAccountNumber,
        errorMessage: error.safeMessage || error.message
      }
    });
  }
  throw error;
}
}

/**
 * Helper to format Indian Rupee currency safely
 */
function formatCurrencyINR(val) {
  const num = Number(val);
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Retrieve authoritative transaction receipt proof for cash deposits, cash withdrawals, and transfers (Feature 2).
 * Verifies existence, enforces role-based customer data isolation (AUTH_002),
 * and reconstructs exact historical balance figures.
 *
 * @param {object} params
 * @param {string|number} params.transactionIdentifier - Transaction ID or Transaction Reference (TXN-...)
 * @param {object} params.user - Authenticated requester { userId, role, customerId, employeeId }
 * @returns {Promise<object>} Structured receipt proof
 */
async function getTransactionReceipt({ transactionIdentifier, user }) {
  if (!transactionIdentifier) {
    const error = new Error('Transaction identifier is required');
    error.statusCode = 400;
    error.code = 'VAL_001';
    throw error;
  }

  // 1. Authoritative lookup from MySQL (support numeric transaction_id or string transaction_ref)
  const isNumeric = /^\d+$/.test(String(transactionIdentifier).trim());
  const lookupSql = `
    SELECT 
      t.transaction_id,
      t.transaction_ref,
      t.type,
      t.amount,
      t.source_account_id,
      t.destination_account_id,
      t.performed_by_user_id,
      t.remarks,
      t.created_at,
      sa.account_number AS source_account_number,
      sa.account_type AS source_account_type,
      sa.customer_id AS source_customer_id,
      sa.balance AS source_current_balance,
      sa.status AS source_status,
      sc.full_name AS source_customer_name,
      sc.email AS source_customer_email,
      da.account_number AS destination_account_number,
      da.account_type AS destination_account_type,
      da.customer_id AS destination_customer_id,
      da.balance AS destination_current_balance,
      da.status AS destination_status,
      dc.full_name AS destination_customer_name,
      dc.email AS destination_customer_email,
      u.username AS performer_username,
      u.role AS performer_role,
      e.full_name AS employee_name,
      e.employee_id AS employee_staff_id
    FROM bank_transactions t
    LEFT JOIN accounts sa ON t.source_account_id = sa.account_id
    LEFT JOIN customers sc ON sa.customer_id = sc.customer_id
    LEFT JOIN accounts da ON t.destination_account_id = da.account_id
    LEFT JOIN customers dc ON da.customer_id = dc.customer_id
    LEFT JOIN users u ON t.performed_by_user_id = u.user_id
    LEFT JOIN employees e ON u.user_id = e.user_id
    WHERE ${isNumeric ? 't.transaction_id = ? OR t.transaction_ref = ?' : 't.transaction_ref = ?'}
    LIMIT 1
  `;

  const lookupParams = isNumeric
    ? [Number(transactionIdentifier), String(transactionIdentifier).trim()]
    : [String(transactionIdentifier).trim()];

  const rows = await query(lookupSql, lookupParams);

  if (!rows || rows.length === 0) {
    const error = new Error('Transaction not found');
    error.statusCode = 404;
    error.code = 'TXN_004';
    error.safeMessage = 'Transaction not found';
    throw error;
  }

  const txn = rows[0];

  // 2. Identify primary associated account
  // For DEPOSIT: destination_account
  // For WITHDRAWAL: source_account
  // For TRANSFER: prefer source_account (or destination if customer owns destination)
  let primaryAcc = null;
  const isDeposit = txn.type === 'DEPOSIT';
  const isWithdrawal = txn.type === 'WITHDRAWAL';
  const isTransfer = txn.type === 'TRANSFER';

  if (isDeposit) {
    primaryAcc = {
      accountId: txn.destination_account_id,
      accountNumber: txn.destination_account_number,
      accountType: txn.destination_account_type,
      customerId: txn.destination_customer_id,
      customerName: txn.destination_customer_name,
      customerEmail: txn.destination_customer_email,
      currentBalance: Number(txn.destination_current_balance),
      status: txn.destination_status
    };
  } else if (isWithdrawal) {
    primaryAcc = {
      accountId: txn.source_account_id,
      accountNumber: txn.source_account_number,
      accountType: txn.source_account_type,
      customerId: txn.source_customer_id,
      customerName: txn.source_customer_name,
      customerEmail: txn.source_customer_email,
      currentBalance: Number(txn.source_current_balance),
      status: txn.source_status
    };
  } else {
    // For transfer, check customer role if requester is customer
    if (user && user.role === 'CUSTOMER' && user.customerId === txn.destination_customer_id) {
      primaryAcc = {
        accountId: txn.destination_account_id,
        accountNumber: txn.destination_account_number,
        accountType: txn.destination_account_type,
        customerId: txn.destination_customer_id,
        customerName: txn.destination_customer_name,
        customerEmail: txn.destination_customer_email,
        currentBalance: Number(txn.destination_current_balance),
        status: txn.destination_status
      };
    } else {
      primaryAcc = {
        accountId: txn.source_account_id,
        accountNumber: txn.source_account_number,
        accountType: txn.source_account_type,
        customerId: txn.source_customer_id,
        customerName: txn.source_customer_name,
        customerEmail: txn.source_customer_email,
        currentBalance: Number(txn.source_current_balance),
        status: txn.source_status
      };
    }
  }

  // 3. Authorization check (Criteria 6, 7, 8)
  // Admins and Employees have access to counter receipts
  // Customers may only access receipts for their own account
  if (user && user.role === 'CUSTOMER') {
    const custId = user.customerId ? Number(user.customerId) : null;
    const isOwner = Boolean(
      custId && (
        Number(txn.source_customer_id) === custId ||
        Number(txn.destination_customer_id) === custId
      )
    );
    if (!isOwner) {
      const error = new Error('Access forbidden: You can only view receipts for your own transactions');
      error.statusCode = 403;
      error.code = 'AUTH_002';
      error.safeMessage = 'You are not authorized to perform this operation';
      throw error;
    }
  }

  // 4. Deterministic balance calculation from subsequent ledger records
  const subsequentSql = `
    SELECT type, amount, source_account_id, destination_account_id
    FROM bank_transactions
    WHERE (source_account_id = ? OR destination_account_id = ?)
      AND (created_at > ? OR (created_at = ? AND transaction_id > ?))
    ORDER BY created_at ASC, transaction_id ASC
  `;
  const subsequentTxns = await query(subsequentSql, [
    primaryAcc.accountId,
    primaryAcc.accountId,
    txn.created_at,
    txn.created_at,
    txn.transaction_id
  ]);

  let subsequentDelta = 0;
  if (subsequentTxns && subsequentTxns.length > 0) {
    for (const sub of subsequentTxns) {
      const subAmt = Number(sub.amount);
      if (sub.destination_account_id === primaryAcc.accountId) {
        subsequentDelta += subAmt;
      }
      if (sub.source_account_id === primaryAcc.accountId) {
        subsequentDelta -= subAmt;
      }
    }
  }

  const txnAmountNum = Number(txn.amount);
  const balanceAfter = primaryAcc.currentBalance - subsequentDelta;
  let previousBalance;

  if (isDeposit || (isTransfer && primaryAcc.accountId === txn.destination_account_id)) {
    previousBalance = balanceAfter - txnAmountNum;
  } else {
    previousBalance = balanceAfter + txnAmountNum;
  }

  // Performer information
  let performerName = txn.employee_name || 'Bank Staff';
  if (!txn.employee_name && txn.performer_role === 'ADMIN') {
    performerName = 'System Administrator';
  } else if (!txn.employee_name && txn.performer_username) {
    performerName = txn.performer_username;
  }
  const performerStaffId = txn.employee_staff_id ? `Staff ID #${txn.employee_staff_id}` : (txn.performer_username ? `@${txn.performer_username}` : 'Branch Counter');

  const displayType = isDeposit ? 'CASH DEPOSIT' : (isWithdrawal ? 'CASH WITHDRAWAL' : 'FUND TRANSFER');

  return {
    bank: {
      institutionName: 'CORE BANK',
      branchName: 'Main Branch',
      branchCode: 'CB-MUM-001',
      address: 'Corporate Headquarters, Financial District',
      city: 'Mumbai, Maharashtra',
      contact: '+91 22 5550 1900 | support@corebank.com',
      receiptTitle: 'Official Counter Transaction Proof'
    },
    transaction: {
      transactionId: txn.transaction_id,
      transactionRef: txn.transaction_ref,
      type: txn.type,
      transactionType: displayType,
      status: 'SUCCESS',
      amount: txnAmountNum,
      amountFormatted: formatCurrencyINR(txnAmountNum),
      remarks: txn.remarks || null,
      createdAt: txn.created_at,
      timestamp: txn.created_at
    },
    account: {
      accountId: primaryAcc.accountId,
      accountNumber: primaryAcc.accountNumber,
      accountType: primaryAcc.accountType,
      status: primaryAcc.status,
      customerName: primaryAcc.customerName,
      customerEmail: primaryAcc.customerEmail || null,
      sourceAccountNumber: txn.source_account_number || null,
      destinationAccountNumber: txn.destination_account_number || null
    },
    balance: {
      previousBalance: Number(previousBalance.toFixed(2)),
      previousBalanceFormatted: formatCurrencyINR(previousBalance),
      transactionAmount: txnAmountNum,
      transactionAmountFormatted: formatCurrencyINR(txnAmountNum),
      updatedBalance: Number(balanceAfter.toFixed(2)),
      updatedBalanceFormatted: formatCurrencyINR(balanceAfter),
      currency: 'INR'
    },
    employee: {
      name: performerName,
      employeeId: performerStaffId,
      username: txn.performer_username || 'teller',
      role: txn.performer_role || 'EMPLOYEE'
    }
  };
}

module.exports = {
  validateMonetaryAmount,
  generateUniqueTransactionRef,
  executeDeposit,
  executeWithdrawal,
  getAccountTransactions,
  listBankTransactions,
  executeTransfer,
  getTransactionReceipt,
  TRANSACTION_TYPE_PREFIXES,
  maskAccountNumber,
  verifyBeneficiary,
  _resetTransferDeduplicationStores
};
