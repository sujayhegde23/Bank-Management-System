/**
 * ==============================================================================
 * Administrator Reports Router (Issue #12)
 * ==============================================================================
 * Implements SRS FR-25, NFR-03, NFR-06, NFR-12, and TC-19.
 *
 * Endpoints:
 * - GET /api/reports/overview      (Executive KPI summary across customers, accounts, transactions)
 * - GET /api/reports/customers     (Customer counts, status distribution, registration trends)
 * - GET /api/reports/accounts      (Account counts by type/status, balances, average balance)
 * - GET /api/reports/transactions  (Transaction counts and volumes by type with date range filtering)
 *
 * Security:
 * - All reporting endpoints strictly require authentication and ADMIN role (requireAuth, requireRole('ADMIN')).
 * - Non-admin roles (CUSTOMER, EMPLOYEE) rejected with HTTP 403 AUTH_002.
 * - Unauthenticated requests rejected with HTTP 401 AUTH_003.
 *
 * Performance & Data Integrity:
 * - All calculations computed via database-level SQL aggregate functions (COUNT, SUM, AVG, MIN, MAX).
 * - Read-only queries with zero mutations.
 * - Parameterized SQL statements preventing injection.
 * - Transfer operations counted EXACTLY ONCE in global transaction metrics.
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { query } = require('../config/db');
const {
  getTodayYMD,
  generateCustomerCsv,
  generateAccountCsv,
  generateTransactionCsv,
  generateOverviewCsv
} = require('../services/reportExportService');
const { recordAuditEvent } = require('../services/auditService');

// Enforce Admin-only access across all report endpoints
router.use(requireAuth, requireRole('ADMIN'));

/**
 * Validate YYYY-MM-DD date string.
 * @param {string} str
 * @returns {boolean}
 */
function isValidDateString(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }
  const [year, month, day] = str.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Parse and validate optional startDate and endDate query parameters.
 * @param {object} queryParams
 * @returns {{ valid: boolean, startDate?: string, endDate?: string, error?: object }}
 */
function parseDateRange(queryParams) {
  const { startDate, endDate, from, to, period } = queryParams || {};
  let start = startDate || from;
  let end = endDate || to;

  // Handle preset period strings if start/end dates are not explicitly supplied
  if (period && (!start && !end)) {
    const today = new Date();
    const formatYMD = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (period === 'today') {
      start = formatYMD(today);
      end = formatYMD(today);
    } else if (period === '7d' || period === 'week') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      start = formatYMD(past7);
      end = formatYMD(today);
    } else if (period === '30d' || period === 'month') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      start = formatYMD(past30);
      end = formatYMD(today);
    } else if (period === 'all') {
      start = null;
      end = null;
    }
  }

  if (start !== undefined && start !== null && start !== '') {
    if (!isValidDateString(start)) {
      return {
        valid: false,
        error: {
          status: 400,
          errorCode: 'VAL_001',
          message: 'Invalid startDate parameter. Format must be YYYY-MM-DD.'
        }
      };
    }
  }

  if (end !== undefined && end !== null && end !== '') {
    if (!isValidDateString(end)) {
      return {
        valid: false,
        error: {
          status: 400,
          errorCode: 'VAL_001',
          message: 'Invalid endDate parameter. Format must be YYYY-MM-DD.'
        }
      };
    }
  }

  if (start && end && start > end) {
    return {
      valid: false,
      error: {
        status: 400,
        errorCode: 'VAL_001',
        message: 'startDate cannot be after endDate.'
      }
    };
  }

  return {
    valid: true,
    startDate: start || null,
    endDate: end || null
  };
}

/**
 * Helper to safely format decimal currency numbers to 2 decimal places.
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
 * GET /api/reports/dashboard
 * Executive Admin Dashboard aggregated summary (Feature 1).
 * Returns summary cards, period activity, account distribution,
 * recent transactions with performer context, and administrative attention items.
 * Enforces ADMIN-only access, parameterized SQL, exact decimal math, and zero transfer double-counting.
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const dateRange = parseDateRange(req.query);
    if (!dateRange.valid) {
      return res.status(dateRange.error.status).json({
        success: false,
        errorCode: dateRange.error.errorCode,
        message: dateRange.error.message,
        error: {
          code: dateRange.error.errorCode,
          message: dateRange.error.message
        }
      });
    }

    // 1. Customer metrics
    const custSummaryPromise = query(`
      SELECT 
        COUNT(*) AS totalCustomers,
        SUM(CASE WHEN u.status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeCustomers,
        SUM(CASE WHEN u.status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactiveCustomers
      FROM customers c
      JOIN users u ON c.user_id = u.user_id
    `);

    // 2. Account summary & operational status breakdown
    const accSummaryPromise = query(`
      SELECT 
        COUNT(*) AS totalAccounts,
        COALESCE(SUM(balance), 0.00) AS totalBalance,
        COALESCE(AVG(balance), 0.00) AS averageBalance,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS activeAccounts,
        SUM(CASE WHEN status = 'FROZEN' THEN 1 ELSE 0 END) AS frozenAccounts,
        SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactiveAccounts
      FROM accounts
    `);

    // 3. Account type breakdown
    const accTypePromise = query(`
      SELECT 
        account_type AS accountType,
        COUNT(*) AS count,
        COALESCE(SUM(balance), 0.00) AS balanceSum
      FROM accounts
      GROUP BY account_type
    `);

    // 4. Today's transactions
    const txnsTodayPromise = query(`
      SELECT 
        COUNT(*) AS countToday,
        COALESCE(SUM(amount), 0.00) AS volumeToday,
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0.00) AS depositsToday,
        COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0.00) AS withdrawalsToday,
        COALESCE(SUM(CASE WHEN type = 'TRANSFER' THEN amount ELSE 0 END), 0.00) AS transfersToday
      FROM bank_transactions
      WHERE DATE(created_at) = CURRENT_DATE()
    `);

    // 5. Activity for the selected period
    const txnParams = [];
    const txnWhere = [];
    if (dateRange.startDate) {
      txnWhere.push('created_at >= ?');
      txnParams.push(`${dateRange.startDate} 00:00:00`);
    }
    if (dateRange.endDate) {
      txnWhere.push('created_at <= ?');
      txnParams.push(`${dateRange.endDate} 23:59:59`);
    }
    const whereSql = txnWhere.length > 0 ? `WHERE ${txnWhere.join(' AND ')}` : '';

    const periodTxnStatsPromise = query(`
      SELECT 
        COUNT(*) AS totalCount,
        COALESCE(SUM(amount), 0.00) AS totalVolume,
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0.00) AS depositVolume,
        COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount ELSE 0 END), 0.00) AS withdrawalVolume,
        COALESCE(SUM(CASE WHEN type = 'TRANSFER' THEN amount ELSE 0 END), 0.00) AS transferVolume,
        SUM(CASE WHEN type = 'DEPOSIT' THEN 1 ELSE 0 END) AS depositCount,
        SUM(CASE WHEN type = 'WITHDRAWAL' THEN 1 ELSE 0 END) AS withdrawalCount,
        SUM(CASE WHEN type = 'TRANSFER' THEN 1 ELSE 0 END) AS transferCount
      FROM bank_transactions
      ${whereSql}
    `, txnParams);

    // 6. Daily activity breakdown for timeline
    const dailyTxnPromise = query(`
      SELECT 
        DATE(created_at) AS txnDate,
        type,
        COUNT(*) AS count,
        COALESCE(SUM(amount), 0.00) AS volume
      FROM bank_transactions
      ${whereSql}
      GROUP BY DATE(created_at), type
      ORDER BY txnDate ASC
    `, txnParams);

    // 7. Recent transactions (latest 8)
    const recentTxnsPromise = query(`
      SELECT 
        t.transaction_id AS transactionId,
        t.transaction_ref AS transactionRef,
        t.type,
        t.amount,
        t.created_at AS createdAt,
        t.remarks,
        src.account_number AS sourceAccountNumber,
        dst.account_number AS destinationAccountNumber,
        u.username AS performedByUsername,
        u.role AS performedByRole,
        COALESCE(emp.full_name, cust.full_name, u.username) AS performedByName
      FROM bank_transactions t
      LEFT JOIN accounts src ON t.source_account_id = src.account_id
      LEFT JOIN accounts dst ON t.destination_account_id = dst.account_id
      JOIN users u ON t.performed_by_user_id = u.user_id
      LEFT JOIN employees emp ON u.user_id = emp.user_id
      LEFT JOIN customers cust ON u.user_id = cust.user_id
      ORDER BY t.created_at DESC, t.transaction_id DESC
      LIMIT 8
    `);

    // 8. Administrative attention items:
    // a) Frozen accounts requiring compliance review
    const frozenAccsPromise = query(`
      SELECT 
        a.account_id AS accountId,
        a.account_number AS accountNumber,
        a.account_type AS accountType,
        a.balance,
        a.updated_at AS updatedAt,
        c.full_name AS customerName,
        c.customer_id AS customerId
      FROM accounts a
      JOIN customers c ON a.customer_id = c.customer_id
      WHERE a.status = 'FROZEN'
      ORDER BY a.updated_at DESC
      LIMIT 5
    `);

    // b) Recent staff/teller operations
    const staffOpsPromise = query(`
      SELECT 
        t.transaction_id AS transactionId,
        t.transaction_ref AS transactionRef,
        t.type,
        t.amount,
        t.created_at AS createdAt,
        t.remarks,
        u.username AS staffUsername,
        COALESCE(emp.full_name, u.username) AS staffName,
        COALESCE(dst.account_number, src.account_number) AS accountNumber
      FROM bank_transactions t
      JOIN users u ON t.performed_by_user_id = u.user_id
      LEFT JOIN employees emp ON u.user_id = emp.user_id
      LEFT JOIN accounts src ON t.source_account_id = src.account_id
      LEFT JOIN accounts dst ON t.destination_account_id = dst.account_id
      WHERE u.role IN ('EMPLOYEE', 'ADMIN')
      ORDER BY t.created_at DESC
      LIMIT 5
    `);

    // Concurrently execute all queries
    const [
      custRows,
      accSummaryRows,
      accTypeRows,
      txnsTodayRows,
      periodStatsRows,
      dailyRows,
      recentTxnRows,
      frozenRows,
      staffOpsRows
    ] = await Promise.all([
      custSummaryPromise,
      accSummaryPromise,
      accTypePromise,
      txnsTodayPromise,
      periodTxnStatsPromise,
      dailyTxnPromise,
      recentTxnsPromise,
      frozenAccsPromise,
      staffOpsPromise
    ]);

    // Format metrics
    const totalCustomers = Number(custRows[0]?.totalCustomers || 0);
    const activeCustomers = Number(custRows[0]?.activeCustomers || 0);
    const inactiveCustomers = Number(custRows[0]?.inactiveCustomers || 0);

    const totalAccounts = Number(accSummaryRows[0]?.totalAccounts || 0);
    const activeAccounts = Number(accSummaryRows[0]?.activeAccounts || 0);
    const frozenAccounts = Number(accSummaryRows[0]?.frozenAccounts || 0);
    const inactiveAccounts = Number(accSummaryRows[0]?.inactiveAccounts || 0);
    const totalBalance = formatDecimal(accSummaryRows[0]?.totalBalance);
    const averageBalance = formatDecimal(accSummaryRows[0]?.averageBalance);

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

    const transactionsToday = {
      count: Number(txnsTodayRows[0]?.countToday || 0),
      totalVolume: formatDecimal(txnsTodayRows[0]?.volumeToday),
      deposits: formatDecimal(txnsTodayRows[0]?.depositsToday),
      withdrawals: formatDecimal(txnsTodayRows[0]?.withdrawalsToday),
      transfers: formatDecimal(txnsTodayRows[0]?.transfersToday)
    };

    const periodStats = {
      totalCount: Number(periodStatsRows[0]?.totalCount || 0),
      totalVolume: formatDecimal(periodStatsRows[0]?.totalVolume),
      deposits: {
        count: Number(periodStatsRows[0]?.depositCount || 0),
        volume: formatDecimal(periodStatsRows[0]?.depositVolume)
      },
      withdrawals: {
        count: Number(periodStatsRows[0]?.withdrawalCount || 0),
        volume: formatDecimal(periodStatsRows[0]?.withdrawalVolume)
      },
      transfers: {
        count: Number(periodStatsRows[0]?.transferCount || 0),
        volume: formatDecimal(periodStatsRows[0]?.transferVolume)
      }
    };

    // Format daily timeline
    const dailyMap = new Map();
    dailyRows.forEach(row => {
      const dateKey = row.txnDate instanceof Date
        ? `${row.txnDate.getFullYear()}-${String(row.txnDate.getMonth() + 1).padStart(2, '0')}-${String(row.txnDate.getDate()).padStart(2, '0')}`
        : String(row.txnDate);

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          depositsCount: 0,
          depositsVolume: 0,
          withdrawalsCount: 0,
          withdrawalsVolume: 0,
          transfersCount: 0,
          transfersVolume: 0,
          totalCount: 0,
          totalVolume: 0
        });
      }

      const day = dailyMap.get(dateKey);
      const rowCount = Number(row.count);
      const rowVol = Number(row.volume);
      day.totalCount += rowCount;
      day.totalVolume += rowVol;

      if (row.type === 'DEPOSIT') {
        day.depositsCount += rowCount;
        day.depositsVolume += rowVol;
      } else if (row.type === 'WITHDRAWAL') {
        day.withdrawalsCount += rowCount;
        day.withdrawalsVolume += rowVol;
      } else if (row.type === 'TRANSFER') {
        day.transfersCount += rowCount;
        day.transfersVolume += rowVol;
      }
    });

    const dailyActivity = Array.from(dailyMap.values()).map(d => ({
      date: d.date,
      depositsCount: d.depositsCount,
      depositsVolume: formatDecimal(d.depositsVolume),
      withdrawalsCount: d.withdrawalsCount,
      withdrawalsVolume: formatDecimal(d.withdrawalsVolume),
      transfersCount: d.transfersCount,
      transfersVolume: formatDecimal(d.transfersVolume),
      totalCount: d.totalCount,
      totalVolume: formatDecimal(d.totalVolume)
    }));

    const recentTransactions = recentTxnRows.map(t => ({
      transactionId: t.transactionId,
      transactionRef: t.transactionRef,
      type: t.type,
      amount: formatDecimal(t.amount),
      createdAt: t.createdAt,
      remarks: t.remarks || null,
      sourceAccountNumber: t.sourceAccountNumber || null,
      destinationAccountNumber: t.destinationAccountNumber || null,
      performedBy: {
        username: t.performedByUsername,
        role: t.performedByRole,
        name: t.performedByName
      }
    }));

    const frozenAccountsList = frozenRows.map(f => ({
      accountId: f.accountId,
      accountNumber: f.accountNumber,
      accountType: f.accountType,
      balance: formatDecimal(f.balance),
      updatedAt: f.updatedAt,
      customerName: f.customerName,
      customerId: f.customerId
    }));

    const recentStaffOperations = staffOpsRows.map(s => ({
      transactionId: s.transactionId,
      transactionRef: s.transactionRef,
      type: s.type,
      amount: formatDecimal(s.amount),
      createdAt: s.createdAt,
      remarks: s.remarks || null,
      staffUsername: s.staffUsername,
      staffName: s.staffName,
      accountNumber: s.accountNumber || null
    }));

    return res.status(200).json({
      success: true,
      data: {
        filter: {
          period: req.query.period || null,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        },
        summary: {
          totalCustomers,
          activeCustomers,
          inactiveCustomers,
          totalAccounts,
          activeAccounts,
          frozenAccounts,
          inactiveAccounts,
          totalSystemBalance: totalBalance,
          averageAccountBalance: averageBalance,
          transactionsToday
        },
        accountsOverview: {
          byType: accountsByType,
          byStatus: {
            ACTIVE: activeAccounts,
            FROZEN: frozenAccounts,
            INACTIVE: inactiveAccounts
          }
        },
        transactionActivity: {
          periodStats,
          dailyActivity
        },
        recentTransactions,
        attentionItems: {
          frozenAccounts: frozenAccountsList,
          recentStaffOperations
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/overview
 * Executive summary KPI combining customer, account, and transaction metrics.
 * Supports optional date range filtering for transaction activity.
 */
router.get('/overview', async (req, res, next) => {
  try {
    const dateRange = parseDateRange(req.query);
    if (!dateRange.valid) {
      return res.status(dateRange.error.status).json({
        success: false,
        errorCode: dateRange.error.errorCode,
        message: dateRange.error.message,
        error: {
          code: dateRange.error.errorCode,
          message: dateRange.error.message
        }
      });
    }

    // 1. Customer metrics
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

    const totalCustomers = Number(custRows[0]?.totalCustomers || 0);
    const activeCustomers = Number(custRows[0]?.activeCustomers || 0);
    const inactiveCustomers = Number(custRows[0]?.inactiveCustomers || 0);

    // 2. Account metrics
    const [accStatsRows, accStatusRows, accTypeRows] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) AS totalAccounts,
          COALESCE(SUM(balance), 0.00) AS totalBalance,
          COALESCE(AVG(balance), 0.00) AS averageBalance
        FROM accounts
      `),
      query(`
        SELECT status, COUNT(*) AS count, COALESCE(SUM(balance), 0.00) AS balanceSum
        FROM accounts
        GROUP BY status
      `),
      query(`
        SELECT account_type AS accountType, COUNT(*) AS count, COALESCE(SUM(balance), 0.00) AS balanceSum
        FROM accounts
        GROUP BY account_type
      `)
    ]);

    const totalAccounts = Number(accStatsRows[0]?.totalAccounts || 0);
    const totalBalance = formatDecimal(accStatsRows[0]?.totalBalance);
    const averageBalance = formatDecimal(accStatsRows[0]?.averageBalance);

    const accountsByStatus = {
      ACTIVE: { count: 0, balance: '0.00' },
      INACTIVE: { count: 0, balance: '0.00' },
      FROZEN: { count: 0, balance: '0.00' }
    };
    accStatusRows.forEach(row => {
      if (accountsByStatus[row.status]) {
        accountsByStatus[row.status] = {
          count: Number(row.count),
          balance: formatDecimal(row.balanceSum)
        };
      }
    });

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

    // 3. Transaction metrics (with optional date filtering)
    const txnParams = [];
    const txnWhere = [];

    if (dateRange.startDate) {
      txnWhere.push('created_at >= ?');
      txnParams.push(`${dateRange.startDate} 00:00:00`);
    }
    if (dateRange.endDate) {
      txnWhere.push('created_at <= ?');
      txnParams.push(`${dateRange.endDate} 23:59:59`);
    }

    const whereClause = txnWhere.length > 0 ? `WHERE ${txnWhere.join(' AND ')}` : '';

    const [txnStatsRows, txnTypeRows] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) AS totalTransactions,
          COALESCE(SUM(amount), 0.00) AS totalVolume
        FROM bank_transactions
        ${whereClause}
      `, txnParams),
      query(`
        SELECT 
          type,
          COUNT(*) AS count,
          COALESCE(SUM(amount), 0.00) AS volume
        FROM bank_transactions
        ${whereClause}
        GROUP BY type
      `, txnParams)
    ]);

    const totalTransactions = Number(txnStatsRows[0]?.totalTransactions || 0);
    const totalVolume = formatDecimal(txnStatsRows[0]?.totalVolume);

    const transactionsByType = {
      DEPOSIT: { count: 0, volume: '0.00' },
      WITHDRAWAL: { count: 0, volume: '0.00' },
      TRANSFER: { count: 0, volume: '0.00' }
    };
    txnTypeRows.forEach(row => {
      if (transactionsByType[row.type]) {
        transactionsByType[row.type] = {
          count: Number(row.count),
          volume: formatDecimal(row.volume)
        };
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        filter: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        },
        customers: {
          total: totalCustomers,
          active: activeCustomers,
          inactive: inactiveCustomers
        },
        accounts: {
          total: totalAccounts,
          totalBalance,
          averageBalance,
          byStatus: accountsByStatus,
          byType: accountsByType
        },
        transactions: {
          totalCount: totalTransactions,
          totalVolume,
          byType: transactionsByType
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/customers
 * Customer metrics: total registered customers, status breakdown, registration trends over time.
 * Note: Never includes passwords or sensitive credentials.
 */
router.get('/customers', async (req, res, next) => {
  try {
    const [custStats, statusBreakdownRows, regTrendsRows, recentRegistrations] = await Promise.all([
      query(`
        SELECT COUNT(*) AS totalCustomers FROM customers
      `),
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
        ORDER BY c.created_at DESC, c.customer_id DESC
        LIMIT 10
      `)
    ]);

    const totalCustomers = Number(custStats[0]?.totalCustomers || 0);

    const statusCounts = {
      ACTIVE: 0,
      INACTIVE: 0
    };
    statusBreakdownRows.forEach(row => {
      statusCounts[row.status] = Number(row.count);
    });

    const trends = {
      today: Number(regTrendsRows[0]?.registeredToday || 0),
      last7Days: Number(regTrendsRows[0]?.registeredLast7Days || 0),
      last30Days: Number(regTrendsRows[0]?.registeredLast30Days || 0)
    };

    const formattedRecent = recentRegistrations.map(c => ({
      customerId: c.customerId,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      createdAt: c.createdAt,
      userStatus: c.userStatus,
      accountCount: Number(c.accountCount || 0),
      totalBalance: formatDecimal(c.totalBalance)
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        statusBreakdown: statusCounts,
        registrationTrends: trends,
        recentRegistrations: formattedRecent,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/accounts
 * Account metrics: total accounts, accounts by type and status, balances, average balance, and top accounts.
 */
router.get('/accounts', async (req, res, next) => {
  try {
    const [accStatsRows, accTypeRows, accStatusRows, topAccountsRows] = await Promise.all([
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
        ORDER BY a.balance DESC, a.account_id ASC
        LIMIT 10
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

    const topAccounts = topAccountsRows.map(a => ({
      accountId: a.accountId,
      accountNumber: a.accountNumber,
      accountType: a.accountType,
      balance: formatDecimal(a.balance),
      status: a.status,
      openedAt: a.openedAt,
      customerName: a.customerName,
      customerId: a.customerId
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalAccounts,
        totalBalance,
        averageBalance,
        minBalance,
        maxBalance,
        byType,
        byStatus,
        topAccounts,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/transactions
 * Transaction activity and volume metrics with optional date range filters.
 *
 * NOTE ON TRANSFER AGGREGATION (AC-3, TC-19):
 * In bank_transactions, each fund transfer is stored as a single row with:
 *   type = 'TRANSFER', source_account_id != NULL, destination_account_id != NULL, amount = X.
 * Grouping bank_transactions by type counts and sums each transfer EXACTLY ONCE.
 * Neither source nor destination ledger view duplicates the global record.
 */
router.get('/transactions', async (req, res, next) => {
  try {
    const dateRange = parseDateRange(req.query);
    if (!dateRange.valid) {
      return res.status(dateRange.error.status).json({
        success: false,
        errorCode: dateRange.error.errorCode,
        message: dateRange.error.message,
        error: {
          code: dateRange.error.errorCode,
          message: dateRange.error.message
        }
      });
    }

    const whereClauses = [];
    const params = [];

    if (dateRange.startDate) {
      whereClauses.push('created_at >= ?');
      params.push(`${dateRange.startDate} 00:00:00`);
    }
    if (dateRange.endDate) {
      whereClauses.push('created_at <= ?');
      params.push(`${dateRange.endDate} 23:59:59`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [summaryRows, typeRows, dailyRows, largestRows] = await Promise.all([
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
        ORDER BY t.amount DESC, t.transaction_id DESC
        LIMIT 10
      `, params)
    ]);

    const totalCount = Number(summaryRows[0]?.totalCount || 0);
    const totalVolume = formatDecimal(summaryRows[0]?.totalVolume);

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

    // Group daily activity rows by date
    const dailyMap = new Map();
    dailyRows.forEach(row => {
      // Format date as YYYY-MM-DD
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

    const largestTransactions = largestRows.map(t => ({
      transactionId: t.transactionId,
      transactionRef: t.transactionRef,
      type: t.type,
      amount: formatDecimal(t.amount),
      createdAt: t.createdAt,
      remarks: t.remarks,
      sourceAccountNumber: t.sourceAccountNumber || null,
      destinationAccountNumber: t.destinationAccountNumber || null
    }));

    return res.status(200).json({
      success: true,
      data: {
        filter: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        },
        totalCount,
        totalVolume,
        byType,
        dailySummary,
        largestTransactions,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ==============================================================================
 * Report Export Endpoints (Feature 4 - Administrator Report Export)
 * ==============================================================================
 * Supports CSV report exports for:
 * - Customer Reports (Totals, Status Breakdown, Registration Trends, Directory)
 * - Account Reports (Totals, Type & Status Breakdown, Balance Metrics, Directory)
 * - Transaction Reports (Totals, Volume, Single-Counted Transfers, Daily Breakdown, Records)
 * - Executive Overview Reports (Combined KPI Snapshot)
 * - Export All Reports (Aggregated or multi-category download)
 *
 * Enforces:
 * - Strict ADMIN-only access (via router-level middleware).
 * - RFC 4180 CSV escaping for special characters (quotes, commas, newlines).
 * - Precise date range validation and filtering.
 * - Single-counting of fund transfers (zero double-counting).
 * - Immutability: Zero database mutations (read-only analytical queries).
 * - Audit logging of report export actions.
 * ==============================================================================
 */

/**
 * Common handler to process CSV export requests.
 * @param {string} category - 'customers' | 'accounts' | 'transactions' | 'overview' | 'all'
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function handleExportRequest(category, req, res, next) {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    if (format !== 'csv') {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Unsupported export format. Currently only CSV format is supported.',
        error: {
          code: 'VAL_001',
          message: 'Unsupported export format. Currently only CSV format is supported.'
        }
      });
    }

    const dateRange = parseDateRange(req.query);
    if (!dateRange.valid) {
      return res.status(dateRange.error.status).json({
        success: false,
        errorCode: dateRange.error.errorCode,
        message: dateRange.error.message,
        error: {
          code: dateRange.error.errorCode,
          message: dateRange.error.message
        }
      });
    }

    const scope = (req.query.scope || req.query.view || 'full').toLowerCase();
    let result;

    switch (category) {
      case 'customers':
      case 'customer':
        result = await generateCustomerCsv({ scope });
        break;

      case 'accounts':
      case 'account':
        result = await generateAccountCsv({ scope });
        break;

      case 'transactions':
      case 'transaction':
        result = await generateTransactionCsv({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          scope
        });
        break;

      case 'overview':
      case 'dashboard':
        result = await generateOverviewCsv({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        });
        break;

      case 'all': {
        const custRes = await generateCustomerCsv({ scope });
        const accRes = await generateAccountCsv({ scope });
        const txnRes = await generateTransactionCsv({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          scope
        });
        const combinedCsv = [
          '# ==============================================================================#',
          '# BANK MANAGEMENT SYSTEM - ALL ADMINISTRATIVE REPORTS EXPORT',
          '# ==============================================================================#',
          '# SECTION 1: CUSTOMER REPORT',
          custRes.csv,
          '',
          '# SECTION 2: ACCOUNT REPORT',
          accRes.csv,
          '',
          '# SECTION 3: TRANSACTION REPORT',
          txnRes.csv
        ].join('\r\n');

        const filterSuffix = dateRange.startDate && dateRange.endDate
          ? `${dateRange.startDate}-to-${dateRange.endDate}`
          : getTodayYMD();

        result = {
          csv: combinedCsv,
          filename: `bank-all-reports-${filterSuffix}.csv`
        };
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          errorCode: 'VAL_001',
          message: `Unknown report category '${category}'. Supported categories: customers, accounts, transactions, overview, all.`,
          error: {
            code: 'VAL_001',
            message: `Unknown report category '${category}'. Supported categories: customers, accounts, transactions, overview, all.`
          }
        });
    }

    // Record audit event for compliance
    if (recordAuditEvent && req.user) {
      await recordAuditEvent({
        actorUserId: req.user.userId,
        actionType: 'REPORT_EXPORTED',
        targetEntityType: 'REPORT',
        targetEntityId: category.toUpperCase(),
        description: `Administrator '${req.user.username}' exported ${category} report as CSV`,
        result: 'SUCCESS',
        metadata: {
          category,
          format: 'CSV',
          filename: result.filename,
          filter: {
            period: req.query.period || null,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          }
        }
      }).catch(err => {
        console.error('Audit event recording warning on report export:', err.message);
      });
    }

    // Set correct response headers and transmit CSV payload
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.csv);
  } catch (err) {
    next(err);
  }
}

// Dedicated export routes: /api/reports/export/:reportType
router.get('/export/:reportType', (req, res, next) => {
  return handleExportRequest(req.params.reportType.toLowerCase(), req, res, next);
});

// Generic export route: /api/reports/export?type=...
router.get('/export', (req, res, next) => {
  const category = (req.query.type || req.query.category || req.query.report || req.query.name || 'overview').toLowerCase();
  return handleExportRequest(category, req, res, next);
});

// Category-specific aliases: /api/reports/customers/export, /api/reports/accounts/export, /api/reports/transactions/export, /api/reports/overview/export
router.get('/customers/export', (req, res, next) => handleExportRequest('customers', req, res, next));
router.get('/accounts/export', (req, res, next) => handleExportRequest('accounts', req, res, next));
router.get('/transactions/export', (req, res, next) => handleExportRequest('transactions', req, res, next));
router.get('/overview/export', (req, res, next) => handleExportRequest('overview', req, res, next));

module.exports = router;

