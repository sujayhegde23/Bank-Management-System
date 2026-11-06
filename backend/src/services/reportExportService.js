/**
 * ==============================================================================
 * Administrator Report Export Service (Feature 4)
 * ==============================================================================
 * Implements RFC 4180-compliant CSV generation for banking reports:
 * - Customer Reports (Totals, Status Breakdown, Registration Trends, Directory)
 * - Account Reports (Totals, Type & Status Breakdowns, Balance Metrics, Directory)
 * - Transaction Reports (Totals, Volume, Single-Counted Transfers, Daily Breakdown, Records)
 * - Executive Overview Reports (Unified System KPI Snapshot)
 *
 * Security & Integrity Guarantees:
 * - Proper escaping of quotes, commas, CRLF per RFC 4180.
 * - Zero double-counting of fund transfers in count or volume metrics.
 * - No exposure of sensitive credentials (passwords, hashes, tokens, session IDs).
 * - Exact 2-decimal currency and balance representation.
 * - Zero database mutations (read-only analytical queries).
 * ==============================================================================
 */

const { query } = require('../config/db');

/**
 * Escapes a single CSV cell value according to RFC 4180.
 * Wraps values containing commas, double quotes, or newlines in double quotes,
 * and escapes embedded double quotes by doubling them ("").
 *
 * @param {any} val
 * @returns {string}
 */
function escapeCsvCell(val) {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts a 2D array of cells into an RFC 4180-compliant CSV string using CRLF row delimiters.
 *
 * @param {Array<Array<any>>} rows
 * @returns {string}
 */
function toCsv(rows) {
  return rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
}

/**
 * Formats a date/timestamp to consistent YYYY-MM-DD HH:mm:ss.
 *
 * @param {Date|string|number|null} d
 * @returns {string}
 */
function formatTimestamp(d) {
  if (!d) return 'N/A';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return String(d);
  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const DD = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

/**
 * Formats a Date to YYYY-MM-DD string.
 *
 * @param {Date} [d=new Date()]
 * @returns {string}
 */
function getTodayYMD(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Helper to safely format numbers to 2 decimal places.
 *
 * @param {number|string|null} val
 * @returns {string}
 */
function formatDecimal(val) {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '0.00';
  }
  return Number(val).toFixed(2);
}

/**
 * Generate Customer Report CSV.
 * Includes total customers, active/inactive counts, registration trends, and customer records.
 *
 * @param {object} [options]
 * @param {'full'|'records'|'summary'} [options.scope='full']
 * @returns {Promise<{ csv: string, filename: string }>}
 */
async function generateCustomerCsv(options = {}) {
  const scope = options.scope || 'full';
  const todayYMD = getTodayYMD();

  const [custStats, statusBreakdownRows, regTrendsRows, customersList] = await Promise.all([
    query('SELECT COUNT(*) AS totalCustomers FROM customers'),
    query(`
      SELECT 
        u.status,
        COUNT(*) AS count
      FROM customers c
      JOIN users u ON c.user_id = u.user_id
      GROUP BY u.status
    `),
    query(`
      SELECT 
        SUM(CASE WHEN DATE(c.created_at) = CURRENT_DATE() THEN 1 ELSE 0 END) AS registeredToday,
        SUM(CASE WHEN c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS registeredLast7Days,
        SUM(CASE WHEN c.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS registeredLast30Days
      FROM customers c
    `),
    query(`
      SELECT 
        c.customer_id AS customerId,
        c.full_name AS fullName,
        c.email,
        c.phone,
        c.created_at AS createdAt,
        u.status AS userStatus,
        (SELECT COUNT(*) FROM accounts a WHERE a.customer_id = c.customer_id) AS accountCount,
        (SELECT COALESCE(SUM(a.balance), 0.00) FROM accounts a WHERE a.customer_id = c.customer_id) AS totalBalance
      FROM customers c
      JOIN users u ON c.user_id = u.user_id
      ORDER BY c.customer_id ASC
    `)
  ]);

  const totalCustomers = Number(custStats[0]?.totalCustomers || 0);

  const statusCounts = { ACTIVE: 0, INACTIVE: 0 };
  statusBreakdownRows.forEach(row => {
    statusCounts[row.status] = Number(row.count);
  });

  const trends = {
    today: Number(regTrendsRows[0]?.registeredToday || 0),
    last7Days: Number(regTrendsRows[0]?.registeredLast7Days || 0),
    last30Days: Number(regTrendsRows[0]?.registeredLast30Days || 0)
  };

  const recordsHeaders = [
    'Customer ID',
    'Full Name',
    'Email',
    'Phone',
    'Status',
    'Linked Accounts',
    'Total Balance (INR)',
    'Registration Date'
  ];

  const recordRows = customersList.map(c => [
    c.customerId,
    c.fullName,
    c.email,
    c.phone,
    c.userStatus,
    Number(c.accountCount || 0),
    formatDecimal(c.totalBalance),
    formatTimestamp(c.createdAt)
  ]);

  const summaryRows = [
    ['Customer Summary Metric', 'Value'],
    ['Total Registered Customers', totalCustomers],
    ['Active Customers', statusCounts.ACTIVE],
    ['Inactive Customers', statusCounts.INACTIVE],
    ['Registrations Today', trends.today],
    ['Registrations Last 7 Days', trends.last7Days],
    ['Registrations Last 30 Days', trends.last30Days]
  ];

  let outputRows = [];
  if (scope === 'summary') {
    outputRows = summaryRows;
  } else if (scope === 'records') {
    outputRows = [recordsHeaders, ...recordRows];
  } else {
    // Full report: Record table first (for strict CSV header readers), followed by summary metrics block
    outputRows = [recordsHeaders, ...recordRows, [], ...summaryRows];
  }

  const csv = toCsv(outputRows);
  const filename = `bank-customer-report-${todayYMD}.csv`;

  return { csv, filename };
}

/**
 * Generate Account Report CSV.
 * Includes total accounts, type and status breakdowns, balance sums, averages, and account records.
 *
 * @param {object} [options]
 * @param {'full'|'records'|'summary'} [options.scope='full']
 * @returns {Promise<{ csv: string, filename: string }>}
 */
async function generateAccountCsv(options = {}) {
  const scope = options.scope || 'full';
  const todayYMD = getTodayYMD();

  const [accStatsRows, accTypeRows, accStatusRows, accountsList] = await Promise.all([
    query(`
      SELECT 
        COUNT(*) AS totalAccounts,
        COALESCE(SUM(balance), 0.00) AS totalBalance,
        COALESCE(AVG(balance), 0.00) AS averageBalance,
        COALESCE(MIN(balance), 0.00) AS minBalance,
        COALESCE(MAX(balance), 0.00) AS maxBalance
      FROM accounts
    `),
    query(`
      SELECT 
        account_type AS accountType,
        COUNT(*) AS count,
        COALESCE(SUM(balance), 0.00) AS balanceSum,
        COALESCE(AVG(balance), 0.00) AS balanceAvg
      FROM accounts
      GROUP BY account_type
      ORDER BY account_type ASC
    `),
    query(`
      SELECT 
        status,
        COUNT(*) AS count,
        COALESCE(SUM(balance), 0.00) AS balanceSum
      FROM accounts
      GROUP BY status
      ORDER BY status ASC
    `),
    query(`
      SELECT 
        a.account_id AS accountId,
        a.account_number AS accountNumber,
        a.account_type AS accountType,
        a.balance,
        a.status,
        a.opened_at AS openedAt,
        c.full_name AS customerName,
        c.customer_id AS customerId
      FROM accounts a
      JOIN customers c ON a.customer_id = c.customer_id
      ORDER BY a.account_id ASC
    `)
  ]);

  const totalAccounts = Number(accStatsRows[0]?.totalAccounts || 0);
  const totalBalance = formatDecimal(accStatsRows[0]?.totalBalance);
  const averageBalance = formatDecimal(accStatsRows[0]?.averageBalance);
  const minBalance = formatDecimal(accStatsRows[0]?.minBalance);
  const maxBalance = formatDecimal(accStatsRows[0]?.maxBalance);

  const byType = {
    SAVINGS: { count: 0, balance: '0.00', averageBalance: '0.00' },
    CURRENT: { count: 0, balance: '0.00', averageBalance: '0.00' }
  };
  accTypeRows.forEach(row => {
    byType[row.accountType] = {
      count: Number(row.count),
      balance: formatDecimal(row.balanceSum),
      averageBalance: formatDecimal(row.balanceAvg)
    };
  });

  const byStatus = {
    ACTIVE: { count: 0, balance: '0.00' },
    INACTIVE: { count: 0, balance: '0.00' },
    FROZEN: { count: 0, balance: '0.00' }
  };
  accStatusRows.forEach(row => {
    if (byStatus[row.status]) {
      byStatus[row.status] = {
        count: Number(row.count),
        balance: formatDecimal(row.balanceSum)
      };
    }
  });

  const recordsHeaders = [
    'Account Number',
    'Customer ID',
    'Customer Name',
    'Account Type',
    'Status',
    'Balance (INR)',
    'Opened Date'
  ];

  const recordRows = accountsList.map(a => [
    a.accountNumber,
    a.customerId,
    a.customerName,
    a.accountType,
    a.status,
    formatDecimal(a.balance),
    formatTimestamp(a.openedAt)
  ]);

  const summaryRows = [
    ['Account Summary Metric', 'Value'],
    ['Total Accounts', totalAccounts],
    ['Total System Balance (INR)', totalBalance],
    ['Average Balance (INR)', averageBalance],
    ['Minimum Balance (INR)', minBalance],
    ['Maximum Balance (INR)', maxBalance],
    ['Savings Accounts Count', byType.SAVINGS.count],
    ['Savings Accounts Balance (INR)', byType.SAVINGS.balance],
    ['Savings Accounts Average Balance (INR)', byType.SAVINGS.averageBalance],
    ['Current Accounts Count', byType.CURRENT.count],
    ['Current Accounts Balance (INR)', byType.CURRENT.balance],
    ['Current Accounts Average Balance (INR)', byType.CURRENT.averageBalance],
    ['Active Accounts Count', byStatus.ACTIVE.count],
    ['Active Accounts Balance (INR)', byStatus.ACTIVE.balance],
    ['Frozen Accounts Count', byStatus.FROZEN.count],
    ['Frozen Accounts Balance (INR)', byStatus.FROZEN.balance],
    ['Inactive Accounts Count', byStatus.INACTIVE.count],
    ['Inactive Accounts Balance (INR)', byStatus.INACTIVE.balance]
  ];

  let outputRows = [];
  if (scope === 'summary') {
    outputRows = summaryRows;
  } else if (scope === 'records') {
    outputRows = [recordsHeaders, ...recordRows];
  } else {
    outputRows = [recordsHeaders, ...recordRows, [], ...summaryRows];
  }

  const csv = toCsv(outputRows);
  const filename = `bank-account-report-${todayYMD}.csv`;

  return { csv, filename };
}

/**
 * Generate Transaction Report CSV.
 * Includes total transactions, total volume, single-counted transfers (zero double-counting),
 * daily breakdown, and filtered transaction records.
 *
 * @param {object} [options]
 * @param {string|null} [options.startDate] - YYYY-MM-DD
 * @param {string|null} [options.endDate] - YYYY-MM-DD
 * @param {'full'|'records'|'summary'} [options.scope='full']
 * @returns {Promise<{ csv: string, filename: string }>}
 */
async function generateTransactionCsv(options = {}) {
  const { startDate = null, endDate = null, scope = 'full' } = options;
  const todayYMD = getTodayYMD();

  const whereClauses = [];
  const params = [];

  if (startDate) {
    whereClauses.push('created_at >= ?');
    params.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    whereClauses.push('created_at <= ?');
    params.push(`${endDate} 23:59:59`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [txnSummaryRows, typeRows, dailyRows, transactionList] = await Promise.all([
    query(`
      SELECT 
        COUNT(*) AS totalCount,
        COALESCE(SUM(amount), 0.00) AS totalVolume
      FROM bank_transactions
      ${whereSql}
    `, params),
    query(`
      SELECT 
        type,
        COUNT(*) AS count,
        COALESCE(SUM(amount), 0.00) AS volume
      FROM bank_transactions
      ${whereSql}
      GROUP BY type
    `, params),
    query(`
      SELECT 
        DATE(created_at) AS txnDate,
        type,
        COUNT(*) AS count,
        COALESCE(SUM(amount), 0.00) AS volume
      FROM bank_transactions
      ${whereSql}
      GROUP BY DATE(created_at), type
      ORDER BY txnDate DESC
    `, params),
    query(`
      SELECT 
        t.transaction_id AS transactionId,
        t.transaction_ref AS transactionRef,
        t.type,
        t.amount,
        t.created_at AS createdAt,
        t.remarks,
        src.account_number AS sourceAccountNumber,
        dst.account_number AS destinationAccountNumber
      FROM bank_transactions t
      LEFT JOIN accounts src ON t.source_account_id = src.account_id
      LEFT JOIN accounts dst ON t.destination_account_id = dst.account_id
      ${whereSql.replace(/created_at/g, 't.created_at')}
      ORDER BY t.created_at DESC, t.transaction_id DESC
    `, params)
  ]);

  const totalCount = Number(txnSummaryRows[0]?.totalCount || 0);
  const totalVolume = formatDecimal(txnSummaryRows[0]?.totalVolume);

  const byType = {
    DEPOSIT: { count: 0, volume: '0.00' },
    WITHDRAWAL: { count: 0, volume: '0.00' },
    TRANSFER: { count: 0, volume: '0.00' }
  };
  typeRows.forEach(row => {
    if (byType[row.type]) {
      byType[row.type] = {
        count: Number(row.count),
        volume: formatDecimal(row.volume)
      };
    }
  });

  // Build daily breakdown
  const dailyMap = new Map();
  dailyRows.forEach(row => {
    const dateKey = row.txnDate instanceof Date
      ? `${row.txnDate.getFullYear()}-${String(row.txnDate.getMonth() + 1).padStart(2, '0')}-${String(row.txnDate.getDate()).padStart(2, '0')}`
      : String(row.txnDate);

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        date: dateKey,
        totalCount: 0,
        totalVolume: 0,
        depositsCount: 0,
        depositsVolume: 0,
        withdrawalsCount: 0,
        withdrawalsVolume: 0,
        transfersCount: 0,
        transfersVolume: 0
      });
    }

    const dayObj = dailyMap.get(dateKey);
    const rowCount = Number(row.count);
    const rowVolume = Number(row.volume);

    dayObj.totalCount += rowCount;
    dayObj.totalVolume += rowVolume;

    if (row.type === 'DEPOSIT') {
      dayObj.depositsCount += rowCount;
      dayObj.depositsVolume += rowVolume;
    } else if (row.type === 'WITHDRAWAL') {
      dayObj.withdrawalsCount += rowCount;
      dayObj.withdrawalsVolume += rowVolume;
    } else if (row.type === 'TRANSFER') {
      dayObj.transfersCount += rowCount;
      dayObj.transfersVolume += rowVolume;
    }
  });

  const dailySummary = Array.from(dailyMap.values()).map(d => ({
    date: d.date,
    totalCount: d.totalCount,
    totalVolume: formatDecimal(d.totalVolume),
    depositsCount: d.depositsCount,
    depositsVolume: formatDecimal(d.depositsVolume),
    withdrawalsCount: d.withdrawalsCount,
    withdrawalsVolume: formatDecimal(d.withdrawalsVolume),
    transfersCount: d.transfersCount,
    transfersVolume: formatDecimal(d.transfersVolume)
  }));

  const recordsHeaders = [
    'Transaction Reference',
    'Date & Time',
    'Type',
    'Amount (INR)',
    'Source Account',
    'Destination Account',
    'Remarks'
  ];

  const recordRows = transactionList.map(t => [
    t.transactionRef,
    formatTimestamp(t.createdAt),
    t.type,
    formatDecimal(t.amount),
    t.sourceAccountNumber || 'N/A',
    t.destinationAccountNumber || 'N/A',
    t.remarks || 'None'
  ]);

  const filterPeriodLabel = startDate && endDate
    ? (startDate === endDate ? startDate : `${startDate} to ${endDate}`)
    : (startDate ? `From ${startDate}` : (endDate ? `Until ${endDate}` : 'All Time'));

  const summaryRows = [
    ['Transaction Summary Metric', 'Value'],
    ['Filter Period', filterPeriodLabel],
    ['Total Transactions', totalCount],
    ['Total Volume (INR)', totalVolume],
    ['Deposits Count', byType.DEPOSIT.count],
    ['Deposits Volume (INR)', byType.DEPOSIT.volume],
    ['Withdrawals Count', byType.WITHDRAWAL.count],
    ['Withdrawals Volume (INR)', byType.WITHDRAWAL.volume],
    ['Transfers Count', byType.TRANSFER.count],
    ['Transfers Volume (INR)', byType.TRANSFER.volume]
  ];

  const dailyTableRows = [];
  if (dailySummary.length > 0) {
    dailyTableRows.push([]);
    dailyTableRows.push(['Daily Activity Breakdown']);
    dailyTableRows.push([
      'Date',
      'Deposits Count',
      'Deposits Volume (INR)',
      'Withdrawals Count',
      'Withdrawals Volume (INR)',
      'Transfers Count',
      'Transfers Volume (INR)',
      'Total Count',
      'Total Volume (INR)'
    ]);
    dailySummary.forEach(d => {
      dailyTableRows.push([
        d.date,
        d.depositsCount,
        d.depositsVolume,
        d.withdrawalsCount,
        d.withdrawalsVolume,
        d.transfersCount,
        d.transfersVolume,
        d.totalCount,
        d.totalVolume
      ]);
    });
  }

  let outputRows = [];
  if (scope === 'summary') {
    outputRows = [...summaryRows, ...dailyTableRows];
  } else if (scope === 'records') {
    outputRows = [recordsHeaders, ...recordRows];
  } else {
    outputRows = [recordsHeaders, ...recordRows, [], ...summaryRows, ...dailyTableRows];
  }

  const csv = toCsv(outputRows);

  let filename;
  if (startDate && endDate) {
    filename = startDate === endDate
      ? `bank-transaction-report-${startDate}.csv`
      : `bank-transaction-report-${startDate}-to-${endDate}.csv`;
  } else if (startDate) {
    filename = `bank-transaction-report-from-${startDate}.csv`;
  } else if (endDate) {
    filename = `bank-transaction-report-to-${endDate}.csv`;
  } else {
    filename = `bank-transaction-report-${todayYMD}.csv`;
  }

  return { csv, filename };
}

/**
 * Generate Executive Overview Report CSV.
 * Combines high-level customer, account, and transaction metrics into a single summary sheet.
 *
 * @param {object} [options]
 * @param {string|null} [options.startDate]
 * @param {string|null} [options.endDate]
 * @returns {Promise<{ csv: string, filename: string }>}
 */
async function generateOverviewCsv(options = {}) {
  const { startDate = null, endDate = null } = options;
  const todayYMD = getTodayYMD();

  // 1. Customers
  const [custRows] = await Promise.all([
    query(`
      SELECT 
        COUNT(*) AS totalCustomers,
        SUM(CASE WHEN u.status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeCustomers,
        SUM(CASE WHEN u.status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactiveCustomers
      FROM customers c
      JOIN users u ON c.user_id = u.user_id
    `)
  ]);

  // 2. Accounts
  const [accStatsRows, accTypeRows, accStatusRows] = await Promise.all([
    query(`
      SELECT 
        COUNT(*) AS totalAccounts,
        COALESCE(SUM(balance), 0.00) AS totalBalance,
        COALESCE(AVG(balance), 0.00) AS averageBalance
      FROM accounts
    `),
    query(`
      SELECT account_type AS accountType, COUNT(*) AS count, COALESCE(SUM(balance), 0.00) AS balanceSum
      FROM accounts
      GROUP BY account_type
    `),
    query(`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(balance), 0.00) AS balanceSum
      FROM accounts
      GROUP BY status
    `)
  ]);

  // 3. Transactions
  const txnParams = [];
  const txnWhere = [];
  if (startDate) {
    txnWhere.push('created_at >= ?');
    txnParams.push(`${startDate} 00:00:00`);
  }
  if (endDate) {
    txnWhere.push('created_at <= ?');
    txnParams.push(`${endDate} 23:59:59`);
  }
  const whereSql = txnWhere.length > 0 ? `WHERE ${txnWhere.join(' AND ')}` : '';

  const [txnStatsRows, txnTypeRows] = await Promise.all([
    query(`
      SELECT 
        COUNT(*) AS totalTransactions,
        COALESCE(SUM(amount), 0.00) AS totalVolume
      FROM bank_transactions
      ${whereSql}
    `, txnParams),
    query(`
      SELECT 
        type,
        COUNT(*) AS count,
        COALESCE(SUM(amount), 0.00) AS volume
      FROM bank_transactions
      ${whereSql}
      GROUP BY type
    `, txnParams)
  ]);

  const totalCustomers = Number(custRows[0]?.totalCustomers || 0);
  const activeCustomers = Number(custRows[0]?.activeCustomers || 0);
  const inactiveCustomers = Number(custRows[0]?.inactiveCustomers || 0);

  const totalAccounts = Number(accStatsRows[0]?.totalAccounts || 0);
  const totalBalance = formatDecimal(accStatsRows[0]?.totalBalance);
  const averageBalance = formatDecimal(accStatsRows[0]?.averageBalance);

  const accountsByType = {
    SAVINGS: { count: 0, balance: '0.00' },
    CURRENT: { count: 0, balance: '0.00' }
  };
  accTypeRows.forEach(row => {
    accountsByType[row.accountType] = {
      count: Number(row.count),
      balance: formatDecimal(row.balanceSum)
    };
  });

  const accountsByStatus = {
    ACTIVE: { count: 0, balance: '0.00' },
    FROZEN: { count: 0, balance: '0.00' },
    INACTIVE: { count: 0, balance: '0.00' }
  };
  accStatusRows.forEach(row => {
    if (accountsByStatus[row.status]) {
      accountsByStatus[row.status] = {
        count: Number(row.count),
        balance: formatDecimal(row.balanceSum)
      };
    }
  });

  const totalTransactions = Number(txnStatsRows[0]?.totalTransactions || 0);
  const totalTxnVolume = formatDecimal(txnStatsRows[0]?.totalVolume);

  const txnsByType = {
    DEPOSIT: { count: 0, volume: '0.00' },
    WITHDRAWAL: { count: 0, volume: '0.00' },
    TRANSFER: { count: 0, volume: '0.00' }
  };
  txnTypeRows.forEach(row => {
    if (txnsByType[row.type]) {
      txnsByType[row.type] = {
        count: Number(row.count),
        volume: formatDecimal(row.volume)
      };
    }
  });

  const filterPeriodLabel = startDate && endDate
    ? (startDate === endDate ? startDate : `${startDate} to ${endDate}`)
    : (startDate ? `From ${startDate}` : (endDate ? `Until ${endDate}` : 'All Time'));

  const rows = [
    ['Category', 'Metric', 'Value', 'Notes'],
    // Customer Metrics
    ['Customers', 'Total Registered Customers', totalCustomers, 'Total client base'],
    ['Customers', 'Active Customers', activeCustomers, 'Eligible for active banking'],
    ['Customers', 'Inactive Customers', inactiveCustomers, 'Deactivated profiles'],
    // Account Metrics
    ['Accounts', 'Total Accounts', totalAccounts, 'Total opened accounts'],
    ['Accounts', 'Total System Balance (INR)', totalBalance, 'Combined ledger total'],
    ['Accounts', 'Average Account Balance (INR)', averageBalance, 'System-wide mean'],
    ['Accounts', 'Savings Accounts Count', accountsByType.SAVINGS.count, `Balance: ${accountsByType.SAVINGS.balance} INR`],
    ['Accounts', 'Current Accounts Count', accountsByType.CURRENT.count, `Balance: ${accountsByType.CURRENT.balance} INR`],
    ['Accounts', 'Active Accounts Count', accountsByStatus.ACTIVE.count, `Balance: ${accountsByStatus.ACTIVE.balance} INR`],
    ['Accounts', 'Frozen Accounts Count', accountsByStatus.FROZEN.count, `Compliance locked (${accountsByStatus.FROZEN.balance} INR)`],
    ['Accounts', 'Inactive Accounts Count', accountsByStatus.INACTIVE.count, `Closed (${accountsByStatus.INACTIVE.balance} INR)`],
    // Transaction Metrics
    ['Transactions', 'Filter Period', filterPeriodLabel, 'Date evaluation window'],
    ['Transactions', 'Total Transactions', totalTransactions, 'Single-counted transactions'],
    ['Transactions', 'Total Transaction Volume (INR)', totalTxnVolume, 'Total volume'],
    ['Transactions', 'Deposits Count', txnsByType.DEPOSIT.count, `Volume: ${txnsByType.DEPOSIT.volume} INR`],
    ['Transactions', 'Withdrawals Count', txnsByType.WITHDRAWAL.count, `Volume: ${txnsByType.WITHDRAWAL.volume} INR`],
    ['Transactions', 'Transfers Count', txnsByType.TRANSFER.count, `Volume: ${txnsByType.TRANSFER.volume} INR (Single-counted)`]
  ];

  const csv = toCsv(rows);
  const filename = `bank-executive-overview-${todayYMD}.csv`;

  return { csv, filename };
}

module.exports = {
  escapeCsvCell,
  toCsv,
  formatTimestamp,
  formatDecimal,
  getTodayYMD,
  generateCustomerCsv,
  generateAccountCsv,
  generateTransactionCsv,
  generateOverviewCsv
};
