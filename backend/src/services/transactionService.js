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
  // Pre-validate amount before opening database transaction to minimize lock hold duration (NFR-07)
  const normalizedAmount = validateMonetaryAmount(amount);

  return await withTransaction(async (conn) => {
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
      balanceAfter,
      timestamp: new Date().toISOString()
    };
  });
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
  // Pre-validate amount before opening database transaction
  const normalizedAmount = validateMonetaryAmount(amount);

  return await withTransaction(async (conn) => {
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
      balanceAfter,
      timestamp: new Date().toISOString()
    };
  });
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
  if (user && user.role === 'CUSTOMER' && Number(user.customerId) !== Number(account.customer_id)) {
    const error = new Error('You are not authorized to view transactions for this account');
    error.statusCode = 403;
    error.code = 'AUTH_002';
    error.safeMessage = 'You are not authorized to perform this operation';
    throw error;
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
  _testFailurePoint = null
}) {
  // 1. Validate monetary amount (NFR-04, TXN_002)
  const normalizedAmount = validateMonetaryAmount(amount);

  // 2. Validate source account ID parameter
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

  return await withTransaction(async (conn) => {
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
      if (Number(sourceAccount.customer_id) !== Number(sessionCustomerId)) {
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
}

module.exports = {
  validateMonetaryAmount,
  generateUniqueTransactionRef,
  executeDeposit,
  executeWithdrawal,
  getAccountTransactions,
  listBankTransactions,
  executeTransfer,
  TRANSACTION_TYPE_PREFIXES
};
