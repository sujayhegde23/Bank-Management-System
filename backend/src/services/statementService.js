/**
 * ==============================================================================
 * Customer Bank Account Statement Service (Feature 3)
 * ==============================================================================
 * Generates authoritative bank account statements over specified date ranges.
 * Implements deterministic historical balance reconstruction, account-specific
 * transfer perspectives, running balances, and CSV export.
 * ==============================================================================
 */

const { query } = require('../config/db');

/**
 * Format currency into Indian Rupees (INR)
 */
function formatINR(val) {
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
 * Generate an authoritative account statement for a given account and date range.
 *
 * @param {object} params
 * @param {number} params.accountId - Primary key of account
 * @param {object} params.user - Authenticated requester { userId, role, customerId }
 * @param {string} [params.from] - Start date (YYYY-MM-DD or ISO string)
 * @param {string} [params.to] - End date (YYYY-MM-DD or ISO string)
 * @param {string} [params.preset] - '7d' | '30d' | '90d' | 'all' | 'custom'
 * @param {number|string} [params.page] - Optional page number for large statements
 * @param {number|string} [params.limit] - Optional page size for large statements
 * @returns {Promise<object>} Structured statement object
 */
async function generateAccountStatement({ accountId, user, from, to, preset, page, limit }) {
  if (!accountId || !Number.isSafeInteger(Number(accountId)) || Number(accountId) <= 0) {
    const error = new Error('Invalid account ID');
    error.statusCode = 400;
    error.code = 'VAL_001';
    throw error;
  }

  const numericAccId = Number(accountId);

  // 1. Retrieve account and customer details
  const accRows = await query(
    `SELECT 
      a.account_id,
      a.account_number,
      a.customer_id,
      a.account_type,
      a.balance,
      a.status,
      a.opened_at,
      c.full_name AS customer_name,
      c.email AS customer_email,
      c.phone AS customer_phone,
      u.username AS customer_username
    FROM accounts a
    JOIN customers c ON a.customer_id = c.customer_id
    JOIN users u ON c.user_id = u.user_id
    WHERE a.account_id = ?
    LIMIT 1`,
    [numericAccId]
  );

  if (!accRows || accRows.length === 0) {
    const error = new Error('Account not found');
    error.statusCode = 404;
    error.code = 'ACC_002';
    error.safeMessage = 'Account not found';
    throw error;
  }

  const account = accRows[0];

  // 2. Authorization check: Customer can only access their own account
  if (user && user.role === 'CUSTOMER') {
    if (Number(user.customerId) !== Number(account.customer_id)) {
      const error = new Error('Access forbidden: You can only view statements for your own accounts');
      error.statusCode = 403;
      error.code = 'AUTH_002';
      error.safeMessage = 'Access forbidden';
      throw error;
    }
  }

  // 3. Resolve and validate date range
  let startDate = null;
  let endDate = null;
  let resolvedPreset = preset || 'all';

  const now = new Date();

  if (preset === '7d') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  } else if (preset === '30d') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  } else if (preset === '90d') {
    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  } else if (preset === 'all') {
    startDate = null;
    endDate = null;
  } else {
    // Custom range
    if (from) {
      startDate = new Date(from);
      if (isNaN(startDate.getTime())) {
        const error = new Error('Invalid start date format');
        error.statusCode = 400;
        error.code = 'VAL_001';
        throw error;
      }
      if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from.trim())) {
        startDate.setHours(0, 0, 0, 0);
      }
      resolvedPreset = 'custom';
    }
    if (to) {
      endDate = new Date(to);
      if (isNaN(endDate.getTime())) {
        const error = new Error('Invalid end date format');
        error.statusCode = 400;
        error.code = 'VAL_001';
        throw error;
      }
      if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to.trim())) {
        endDate.setHours(23, 59, 59, 999);
      }
      resolvedPreset = 'custom';
    }
  }

  // Date range order validation
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    const error = new Error('Start date cannot be after end date');
    error.statusCode = 400;
    error.code = 'VAL_001';
    throw error;
  }

  // 4. Calculate opening balance before startDate
  // If startDate is specified, query all transactions prior to startDate
  const currentLiveBalance = Number(account.balance);
  let openingBalance = 0;

  if (startDate) {
    const priorRows = await query(
      `SELECT 
        SUM(CASE 
          WHEN destination_account_id = ? THEN amount 
          WHEN source_account_id = ? THEN -amount 
          ELSE 0 
        END) AS priorDelta
      FROM bank_transactions
      WHERE (source_account_id = ? OR destination_account_id = ?)
        AND created_at < ?`,
      [numericAccId, numericAccId, numericAccId, numericAccId, startDate]
    );

    openingBalance = Number(Number(priorRows[0]?.priorDelta || 0).toFixed(2));
  } else {
    // All history from account inception
    openingBalance = 0;
  }

  // 5. Query transactions within the statement period in chronological order
  const whereClauses = ['(t.source_account_id = ? OR t.destination_account_id = ?)'];
  const queryParams = [numericAccId, numericAccId];

  if (startDate) {
    whereClauses.push('t.created_at >= ?');
    queryParams.push(startDate);
  }
  if (endDate) {
    whereClauses.push('t.created_at <= ?');
    queryParams.push(endDate);
  }

  const txnSql = `
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
      da.account_number AS destination_account_number,
      u.username AS performer_username
    FROM bank_transactions t
    LEFT JOIN accounts sa ON t.source_account_id = sa.account_id
    LEFT JOIN accounts da ON t.destination_account_id = da.account_id
    LEFT JOIN users u ON t.performed_by_user_id = u.user_id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY t.created_at ASC, t.transaction_id ASC
  `;

  const rows = await query(txnSql, queryParams);

  // 6. Aggregate statement metrics and classify transactions
  let totalDeposits = 0;
  let depositCount = 0;
  let totalWithdrawals = 0;
  let withdrawalCount = 0;
  let totalTransfersIn = 0;
  let transferInCount = 0;
  let totalTransfersOut = 0;
  let transferOutCount = 0;

  const intermediateTransactions = [];

  for (const r of rows) {
    const amt = Number(r.amount);
    const isDest = Number(r.destination_account_id) === numericAccId;
    const isSrc = Number(r.source_account_id) === numericAccId;

    let direction = 'UNKNOWN';
    let statementType = r.type;
    let description = r.remarks || '';

    if (r.type === 'DEPOSIT') {
      direction = 'CREDIT';
      statementType = 'CASH DEPOSIT';
      description = r.remarks || 'Cash deposit at branch counter';
      totalDeposits += amt;
      depositCount += 1;
    } else if (r.type === 'WITHDRAWAL') {
      direction = 'DEBIT';
      statementType = 'CASH WITHDRAWAL';
      description = r.remarks || 'Cash withdrawal';
      totalWithdrawals += amt;
      withdrawalCount += 1;
    } else if (r.type === 'TRANSFER') {
      if (isDest) {
        direction = 'CREDIT';
        statementType = 'TRANSFER IN';
        description = r.source_account_number
          ? `Transfer from ${r.source_account_number}${r.remarks ? ` - ${r.remarks}` : ''}`
          : `Incoming transfer${r.remarks ? ` - ${r.remarks}` : ''}`;
        totalTransfersIn += amt;
        transferInCount += 1;
      } else if (isSrc) {
        direction = 'DEBIT';
        statementType = 'TRANSFER OUT';
        description = r.destination_account_number
          ? `Transfer to ${r.destination_account_number}${r.remarks ? ` - ${r.remarks}` : ''}`
          : `Outgoing transfer${r.remarks ? ` - ${r.remarks}` : ''}`;
        totalTransfersOut += amt;
        transferOutCount += 1;
      }
    }

    intermediateTransactions.push({
      transactionId: r.transaction_id,
      transactionRef: r.transaction_ref,
      rawType: r.type,
      type: statementType,
      direction,
      amount: amt,
      debit: direction === 'DEBIT' ? amt : null,
      credit: direction === 'CREDIT' ? amt : null,
      description,
      remarks: r.remarks || null,
      counterpartyAccount: isDest ? r.source_account_number : (isSrc ? r.destination_account_number : null),
      performer: r.performer_username || null,
      timestamp: r.created_at,
      createdAt: r.created_at
    });
  }

  const totalCredits = Number((totalDeposits + totalTransfersIn).toFixed(2));
  const totalDebits = Number((totalWithdrawals + totalTransfersOut).toFixed(2));
  const netChange = Number((totalCredits - totalDebits).toFixed(2));

  // 7. Calculate closing balance: Closing = Opening + NetChange
  const closingBalance = Number((openingBalance + netChange).toFixed(2));

  // 8. Compute running balance for each transaction starting from openingBalance
  let running = openingBalance;
  const finalizedTransactions = intermediateTransactions.map((tx) => {
    if (tx.direction === 'CREDIT') {
      running += tx.amount;
    } else if (tx.direction === 'DEBIT') {
      running -= tx.amount;
    }
    return {
      ...tx,
      runningBalance: Number(running.toFixed(2)),
      runningBalanceFormatted: formatINR(running)
    };
  });

  const generatedTimestamp = new Date().toISOString();

  return {
    header: {
      institutionName: 'CORE BANK',
      documentTitle: 'ACCOUNT STATEMENT',
      generatedAt: generatedTimestamp,
      generatedAtFormatted: new Date(generatedTimestamp).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'medium'
      })
    },
    customer: {
      customerId: account.customer_id,
      customerName: account.customer_name,
      email: account.customer_email,
      phone: account.customer_phone,
      username: account.customer_username
    },
    account: {
      accountId: account.account_id,
      accountNumber: account.account_number,
      accountType: account.account_type,
      status: account.status,
      openedAt: account.opened_at,
      currentBalance: currentLiveBalance,
      currentBalanceFormatted: formatINR(currentLiveBalance)
    },
    period: {
      preset: resolvedPreset,
      from: startDate ? startDate.toISOString() : null,
      to: endDate ? endDate.toISOString() : null,
      fromFormatted: startDate
        ? startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Earliest Recorded',
      toFormatted: endDate
        ? endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Latest Recorded'
    },
    summary: {
      openingBalance,
      openingBalanceFormatted: formatINR(openingBalance),
      totalDeposits: Number(totalDeposits.toFixed(2)),
      totalDepositsFormatted: formatINR(totalDeposits),
      depositCount,
      totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
      totalWithdrawalsFormatted: formatINR(totalWithdrawals),
      withdrawalCount,
      totalTransfersIn: Number(totalTransfersIn.toFixed(2)),
      totalTransfersInFormatted: formatINR(totalTransfersIn),
      transferInCount,
      totalTransfersOut: Number(totalTransfersOut.toFixed(2)),
      totalTransfersOutFormatted: formatINR(totalTransfersOut),
      transferOutCount,
      incomingTransfers: Number(totalTransfersIn.toFixed(2)),
      incomingTransfersFormatted: formatINR(totalTransfersIn),
      outgoingTransfers: Number(totalTransfersOut.toFixed(2)),
      outgoingTransfersFormatted: formatINR(totalTransfersOut),
      totalCredits,
      totalCreditsFormatted: formatINR(totalCredits),
      totalDebits,
      totalDebitsFormatted: formatINR(totalDebits),
      netChange,
      netChangeFormatted: `${netChange >= 0 ? '+' : ''}${formatINR(netChange)}`,
      closingBalance,
      closingBalanceFormatted: formatINR(closingBalance),
      transactionCount: finalizedTransactions.length,
      currency: 'INR'
    },
    // Top-level direct properties for Section 4 convenience
    accountNumber: account.account_number,
    accountType: account.account_type,
    customerName: account.customer_name,
    statementPeriod: {
      preset: resolvedPreset,
      from: startDate ? startDate.toISOString() : null,
      to: endDate ? endDate.toISOString() : null,
      fromFormatted: startDate
        ? startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Earliest Recorded',
      toFormatted: endDate
        ? endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Latest Recorded'
    },
    openingBalance,
    totalDeposits: Number(totalDeposits.toFixed(2)),
    totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
    incomingTransfers: Number(totalTransfersIn.toFixed(2)),
    outgoingTransfers: Number(totalTransfersOut.toFixed(2)),
    closingBalance,
    pagination: {
      page: page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      limit: limit ? Math.max(1, Math.min(100, parseInt(limit, 10) || 10)) : finalizedTransactions.length,
      total: finalizedTransactions.length,
      totalPages: limit ? Math.ceil(finalizedTransactions.length / Math.max(1, Math.min(100, parseInt(limit, 10) || 10))) || 1 : 1
    },
    transactions: (page || limit)
      ? finalizedTransactions.slice(
          ((Math.max(1, parseInt(page, 10) || 1)) - 1) * Math.max(1, Math.min(100, parseInt(limit, 10) || 10)),
          ((Math.max(1, parseInt(page, 10) || 1)) - 1) * Math.max(1, Math.min(100, parseInt(limit, 10) || 10)) + Math.max(1, Math.min(100, parseInt(limit, 10) || 10))
        )
      : finalizedTransactions,
    allTransactions: finalizedTransactions
  };
}

/**
 * Convert structured statement object into formatted CSV text
 *
 * @param {object} statement
 * @returns {string} CSV text with BOM and proper escaping
 */
function statementToCsv(statement) {
  const { header, customer, account, period, summary } = statement;
  const transactions = statement.allTransactions || statement.transactions || [];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = [];

  // Bank & Statement Title
  lines.push(`${escapeCsv(header.institutionName)},${escapeCsv(header.documentTitle)}`);
  lines.push(`"Generated At",${escapeCsv(header.generatedAtFormatted)}`);
  lines.push('');

  // Account Information
  lines.push('"ACCOUNT DETAILS"');
  lines.push(`"Customer Name",${escapeCsv(customer.customerName)},"Customer ID",${escapeCsv(customer.customerId)}`);
  lines.push(`"Account Number",${escapeCsv(account.accountNumber)},"Account Type",${escapeCsv(account.accountType)}`);
  lines.push(`"Account Status",${escapeCsv(account.status)},"Statement Period",${escapeCsv(`${period.fromFormatted} to ${period.toFormatted}`)}`);
  lines.push('');

  // Financial Summary
  lines.push('"STATEMENT SUMMARY"');
  lines.push(`"Opening Balance",${summary.openingBalance.toFixed(2)},"Closing Balance",${summary.closingBalance.toFixed(2)}`);
  lines.push(`"Total Credits",${summary.totalCredits.toFixed(2)},"Total Debits",${summary.totalDebits.toFixed(2)}`);
  lines.push(`"Total Deposits (${summary.depositCount})",${summary.totalDeposits.toFixed(2)},"Total Withdrawals (${summary.withdrawalCount})",${summary.totalWithdrawals.toFixed(2)}`);
  lines.push(`"Transfers In (${summary.transferInCount})",${summary.totalTransfersIn.toFixed(2)},"Transfers Out (${summary.transferOutCount})",${summary.totalTransfersOut.toFixed(2)}`);
  lines.push(`"Net Flow",${summary.netChange.toFixed(2)},"Total Transactions",${summary.transactionCount}`);
  lines.push('');

  // Transaction Ledger Table
  lines.push('"TRANSACTION LEDGER"');
  lines.push('"Date & Time","Reference","Type","Description","Debit (INR)","Credit (INR)","Running Balance (INR)"');

  if (transactions.length === 0) {
    lines.push('"No transactions recorded for the selected statement period",,,,,');
  } else {
    for (const tx of transactions) {
      const dt = new Date(tx.timestamp).toLocaleString('en-IN', {
        dateStyle: 'short',
        timeStyle: 'medium'
      });
      const debitStr = tx.debit !== null ? tx.debit.toFixed(2) : '';
      const creditStr = tx.credit !== null ? tx.credit.toFixed(2) : '';
      const balanceStr = tx.runningBalance.toFixed(2);

      lines.push(
        `${escapeCsv(dt)},${escapeCsv(tx.transactionRef)},${escapeCsv(tx.type)},${escapeCsv(tx.description)},${debitStr},${creditStr},${balanceStr}`
      );
    }
  }

  // Prepend UTF-8 BOM for Microsoft Excel compatibility
  return '\uFEFF' + lines.join('\r\n');
}

module.exports = {
  generateAccountStatement,
  statementToCsv,
  exportAccountStatementCSV: statementToCsv
};
