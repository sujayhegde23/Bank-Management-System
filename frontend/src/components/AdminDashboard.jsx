import { useState, useEffect, useCallback } from 'react';
import { getAdminDashboard } from '../services/api';
import './AdminDashboard.css';

/* ==============================================================================
   Lucide-Style Inline SVG Icons (Zero External Dependencies)
   ============================================================================== */
function IconLayoutDashboard({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

function IconUsers({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconLandmark({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  );
}

function IconCreditCard({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function IconTrendingUp({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconRefresh({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconAlertTriangle({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconArrowRight({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconShieldCheck({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconInfo({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

/* ==============================================================================
   Formatters
   ============================================================================== */
function formatCurrency(val) {
  const num = Number(val || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(isoStr);
  }
}

/**
 * Main Administrator Executive Dashboard Component
 * Feature 1 — Admin Dashboard and Executive Overview
 */
export default function AdminDashboard({ currentUser, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('7d'); // 'today' | '7d' | '30d' | 'all'
  const [dashboardData, setDashboardData] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const data = await getAdminDashboard({ period });
        if (!ignore) {
          setDashboardData(data);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load admin dashboard:', err);
          setError(err.message || 'Unable to fetch dashboard metrics. Please verify backend connectivity.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, [period, refreshTrigger]);

  const summary = dashboardData?.summary;
  const accountsOverview = dashboardData?.accountsOverview;
  const activity = dashboardData?.transactionActivity;
  const recentTransactions = dashboardData?.recentTransactions || [];
  const attentionItems = dashboardData?.attentionItems;

  // Account Type Calculations for Distribution Bar
  const savingsCount = accountsOverview?.byType?.SAVINGS?.count || 0;
  const currentCount = accountsOverview?.byType?.CURRENT?.count || 0;
  const totalTypeCount = savingsCount + currentCount;
  const savingsPercent = totalTypeCount > 0 ? Math.round((savingsCount / totalTypeCount) * 100) : 50;
  const currentPercent = totalTypeCount > 0 ? (100 - savingsPercent) : 50;

  // Period Volume Breakdown Proportions
  const periodVol = Number(activity?.periodStats?.totalVolume || 0);
  const depVol = Number(activity?.periodStats?.deposits?.volume || 0);
  const withVol = Number(activity?.periodStats?.withdrawals?.volume || 0);

  const depPercent = periodVol > 0 ? Math.round((depVol / periodVol) * 100) : 0;
  const withPercent = periodVol > 0 ? Math.round((withVol / periodVol) * 100) : 0;
  const trfPercent = periodVol > 0 ? Math.max(0, 100 - depPercent - withPercent) : 0;

  return (
    <div className="admin-dashboard-container" id="admin-dashboard-view">
      {/* --------------------------------------------------------------------
          1. Dashboard Header
          -------------------------------------------------------------------- */}
      <div className="dash-header-card">
        <div className="dash-header-main">
          <div className="dash-title-block">
            <div className="dash-badge">
              <IconShieldCheck size={14} />
              <span>Administrator Portal &bull; System Monitoring &bull; Executive Overview</span>
            </div>
            <h1 className="dash-title">Executive Banking Overview</h1>
            <p className="dash-subtitle">
              Welcome back, <strong>{currentUser?.displayName || currentUser?.username}</strong>. Live core banking intelligence across customers, accounts, and transaction activity.
            </p>
          </div>

          <div className="dash-header-actions">
            <button
              type="button"
              className="dash-refresh-btn"
              onClick={handleRefresh}
              disabled={loading}
              title="Refresh dashboard metrics"
            >
              <IconRefresh size={16} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="dash-error-banner">
          <div className="error-text">
            <strong>Dashboard Error:</strong> {error}
          </div>
          <button type="button" className="retry-btn" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !dashboardData && (
        <div className="dash-loading-skeleton">
          <div className="skeleton-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
          <p className="loading-label">Gathering live banking metrics...</p>
        </div>
      )}

      {summary && (
        <>
          {/* ------------------------------------------------------------------
              2. Section A: Summary Cards (8 Key Indicators)
              ------------------------------------------------------------------ */}
          <div className="dash-summary-grid">
            {/* 1. Total Customers */}
            <div className="summary-card" onClick={() => onNavigate && onNavigate('customers')}>
              <div className="card-top">
                <span className="card-label">Total Customers</span>
                <span className="card-icon-pill icon-blue">
                  <IconUsers size={18} />
                </span>
              </div>
              <div className="card-value">{summary.totalCustomers}</div>
              <div className="card-subline">
                <span className="badge-active-pill">{summary.activeCustomers} Active</span>
                {summary.inactiveCustomers > 0 && (
                  <span className="badge-inactive-pill">{summary.inactiveCustomers} Inactive</span>
                )}
              </div>
            </div>

            {/* 2. Active Customers */}
            <div className="summary-card" onClick={() => onNavigate && onNavigate('customers')}>
              <div className="card-top">
                <span className="card-label">Active Customers</span>
                <span className="card-icon-pill icon-emerald">
                  <IconShieldCheck size={18} />
                </span>
              </div>
              <div className="card-value text-emerald">{summary.activeCustomers}</div>
              <div className="card-subline">
                <span className="muted-text">Verified account owners</span>
              </div>
            </div>

            {/* 3. Total Bank Accounts */}
            <div className="summary-card" onClick={() => onNavigate && onNavigate('accounts')}>
              <div className="card-top">
                <span className="card-label">Total Accounts</span>
                <span className="card-icon-pill icon-purple">
                  <IconLandmark size={18} />
                </span>
              </div>
              <div className="card-value">{summary.totalAccounts}</div>
              <div className="card-subline">
                <span className="pill-tag">{savingsCount} Savings</span>
                <span className="pill-tag">{currentCount} Current</span>
              </div>
            </div>

            {/* 4. Active Accounts */}
            <div className="summary-card" onClick={() => onNavigate && onNavigate('accounts')}>
              <div className="card-top">
                <span className="card-label">Active Accounts</span>
                <span className="card-icon-pill icon-emerald">
                  <IconLandmark size={18} />
                </span>
              </div>
              <div className="card-value text-emerald">{summary.activeAccounts}</div>
              <div className="card-subline">
                <span className="muted-text">Eligible for transactions</span>
              </div>
            </div>

            {/* 5. Total System Balance */}
            <div className="summary-card card-highlight" onClick={() => onNavigate && onNavigate('accounts')}>
              <div className="card-top">
                <span className="card-label">Total System Balance</span>
                <span className="card-icon-pill icon-amber">
                  <IconTrendingUp size={18} />
                </span>
              </div>
              <div className="card-value text-emerald font-mono">
                {formatCurrency(summary.totalSystemBalance)}
              </div>
              <div className="card-subline">
                <span className="muted-text">
                  Avg: {formatCurrency(summary.averageAccountBalance)} / account
                </span>
              </div>
            </div>

            {/* 6. Transactions Today */}
            <div className="summary-card" onClick={() => onNavigate && onNavigate('transactions')}>
              <div className="card-top">
                <span className="card-label">Transactions Today</span>
                <span className="card-icon-pill icon-blue">
                  <IconCreditCard size={18} />
                </span>
              </div>
              <div className="card-value">{summary.transactionsToday.count}</div>
              <div className="card-subline">
                <span className="pill-tag font-mono">
                  Vol: {formatCurrency(summary.transactionsToday.totalVolume)}
                </span>
              </div>
            </div>

            {/* 7. Frozen Accounts */}
            <div
              className={`summary-card ${summary.frozenAccounts > 0 ? 'card-warning' : ''}`}
              onClick={() => onNavigate && onNavigate('accounts')}
            >
              <div className="card-top">
                <span className="card-label">Frozen Accounts</span>
                <span className="card-icon-pill icon-amber">
                  <IconAlertTriangle size={18} />
                </span>
              </div>
              <div className={`card-value ${summary.frozenAccounts > 0 ? 'text-amber' : ''}`}>
                {summary.frozenAccounts}
              </div>
              <div className="card-subline">
                <span className={summary.frozenAccounts > 0 ? 'badge-warning-pill' : 'muted-text'}>
                  {summary.frozenAccounts > 0 ? 'Compliance review required' : 'No frozen accounts'}
                </span>
              </div>
            </div>

            {/* 8. Inactive Accounts */}
            <div className="summary-card" onClick={() => onNavigate && onNavigate('accounts')}>
              <div className="card-top">
                <span className="card-label">Inactive Accounts</span>
                <span className="card-icon-pill icon-gray">
                  <IconLandmark size={18} />
                </span>
              </div>
              <div className="card-value text-muted">{summary.inactiveAccounts}</div>
              <div className="card-subline">
                <span className="muted-text">Dormant or closed accounts</span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------
              Attention Banner (If frozen accounts exist)
              ------------------------------------------------------------------ */}
          {summary.frozenAccounts > 0 && attentionItems?.frozenAccounts?.length > 0 && (
            <div className="dash-alert-card">
              <div className="alert-header">
                <div className="alert-title-row">
                  <IconAlertTriangle size={18} className="text-amber" />
                  <span className="alert-heading">
                    Attention Required: {summary.frozenAccounts} Account(s) Currently Frozen
                  </span>
                </div>
                <button
                  type="button"
                  className="alert-action-btn"
                  onClick={() => onNavigate && onNavigate('accounts')}
                >
                  Manage in Accounts Console <IconArrowRight size={14} />
                </button>
              </div>
              <div className="frozen-accounts-list">
                {attentionItems.frozenAccounts.map((acc) => (
                  <div key={acc.accountId} className="frozen-item-card">
                    <div className="frozen-item-main">
                      <span className="frozen-acc-number font-mono">{acc.accountNumber}</span>
                      <span className="pill-tag">{acc.accountType}</span>
                      <span className="frozen-holder">{acc.customerName}</span>
                    </div>
                    <div className="frozen-item-right">
                      <span className="font-mono text-emerald font-semibold">
                        {formatCurrency(acc.balance)}
                      </span>
                      <span className="cell-muted text-xs">
                        Updated {formatDateTime(acc.updatedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------
              3. Section B & C: Transaction Activity and Account Overview
              ------------------------------------------------------------------ */}
          <div className="dash-split-grid">
            {/* Section B: Transaction Activity */}
            <div className="dash-section-panel">
              <div className="panel-header-row">
                <div className="panel-title-block">
                  <h2 className="panel-title">
                    <IconCreditCard size={18} />
                    <span>Transaction Activity</span>
                  </h2>
                  <p className="panel-subtitle">Deposits, withdrawals, and customer transfers</p>
                </div>

                {/* Time Filter Pills */}
                <div className="time-filter-pills">
                  <button
                    type="button"
                    className={`time-pill ${period === 'today' ? 'active' : ''}`}
                    onClick={() => setPeriod('today')}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`time-pill ${period === '7d' ? 'active' : ''}`}
                    onClick={() => setPeriod('7d')}
                  >
                    7 Days
                  </button>
                  <button
                    type="button"
                    className={`time-pill ${period === '30d' ? 'active' : ''}`}
                    onClick={() => setPeriod('30d')}
                  >
                    30 Days
                  </button>
                  <button
                    type="button"
                    className={`time-pill ${period === 'all' ? 'active' : ''}`}
                    onClick={() => setPeriod('all')}
                  >
                    All Time
                  </button>
                </div>
              </div>

              {/* Volume Breakdown Cards */}
              <div className="activity-stats-row">
                <div className="activity-stat-box">
                  <span className="activity-label">Total Volume</span>
                  <span className="activity-value font-mono text-emerald">
                    {formatCurrency(activity?.periodStats?.totalVolume)}
                  </span>
                  <span className="activity-sub">{activity?.periodStats?.totalCount || 0} operations</span>
                </div>
                <div className="activity-stat-box">
                  <span className="activity-label">Deposits</span>
                  <span className="activity-value font-mono text-blue">
                    {formatCurrency(activity?.periodStats?.deposits?.volume)}
                  </span>
                  <span className="activity-sub">{activity?.periodStats?.deposits?.count || 0} deposits</span>
                </div>
                <div className="activity-stat-box">
                  <span className="activity-label">Withdrawals</span>
                  <span className="activity-value font-mono text-amber">
                    {formatCurrency(activity?.periodStats?.withdrawals?.volume)}
                  </span>
                  <span className="activity-sub">{activity?.periodStats?.withdrawals?.count || 0} withdrawals</span>
                </div>
                <div className="activity-stat-box">
                  <span className="activity-label">Transfers</span>
                  <span className="activity-value font-mono text-purple">
                    {formatCurrency(activity?.periodStats?.transfers?.volume)}
                  </span>
                  <span className="activity-sub">{activity?.periodStats?.transfers?.count || 0} transfers</span>
                </div>
              </div>

              {/* Visual Proportion Bar */}
              {periodVol > 0 && (
                <div className="volume-bar-container">
                  <div className="bar-labels">
                    <span>Deposit: {depPercent}%</span>
                    <span>Withdrawal: {withPercent}%</span>
                    <span>Transfer: {trfPercent}%</span>
                  </div>
                  <div className="multi-bar">
                    <div className="bar-segment bar-dep" style={{ width: `${depPercent}%` }} />
                    <div className="bar-segment bar-with" style={{ width: `${withPercent}%` }} />
                    <div className="bar-segment bar-trf" style={{ width: `${trfPercent}%` }} />
                  </div>
                </div>
              )}

              {/* Single-Count Transfer Callout */}
              <div className="transfer-integrity-note">
                <IconInfo size={15} />
                <span>
                  <strong>Accounting Integrity:</strong> Transfers are counted <em>exactly once</em> in total transactions and volume metrics.
                </span>
              </div>

              {/* Daily Activity Mini-Table */}
              <div className="daily-activity-block">
                <span className="subhead-label">Recent Daily Breakdown</span>
                {(!activity?.dailyActivity || activity.dailyActivity.length === 0) ? (
                  <div className="empty-substate">No transaction records in this window.</div>
                ) : (
                  <div className="daily-table-wrap">
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Deposits</th>
                          <th>Withdrawals</th>
                          <th>Transfers</th>
                          <th className="text-right">Day Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activity.dailyActivity.slice(-5).reverse().map((day) => (
                          <tr key={day.date}>
                            <td className="font-mono">{day.date}</td>
                            <td>{day.depositsCount} ({formatCurrency(day.depositsVolume)})</td>
                            <td>{day.withdrawalsCount} ({formatCurrency(day.withdrawalsVolume)})</td>
                            <td>{day.transfersCount} ({formatCurrency(day.transfersVolume)})</td>
                            <td className="text-right font-mono font-semibold text-emerald">
                              {formatCurrency(day.totalVolume)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Section C: Account Overview */}
            <div className="dash-section-panel">
              <div className="panel-header-row">
                <div className="panel-title-block">
                  <h2 className="panel-title">
                    <IconLandmark size={18} />
                    <span>Account Overview</span>
                  </h2>
                  <p className="panel-subtitle">Types, operational status, and deposit shares</p>
                </div>
              </div>

              {/* Type Distribution */}
              <div className="account-dist-block">
                <span className="subhead-label">Savings vs Current Distribution</span>
                <div className="type-split-cards">
                  <div className="type-card">
                    <div className="type-card-head">
                      <span className="type-name">SAVINGS</span>
                      <span className="pill-tag">{savingsPercent}%</span>
                    </div>
                    <div className="type-count">{savingsCount} Accounts</div>
                    <div className="type-balance font-mono">
                      {formatCurrency(accountsOverview?.byType?.SAVINGS?.balance)}
                    </div>
                  </div>

                  <div className="type-card">
                    <div className="type-card-head">
                      <span className="type-name">CURRENT</span>
                      <span className="pill-tag">{currentPercent}%</span>
                    </div>
                    <div className="type-count">{currentCount} Accounts</div>
                    <div className="type-balance font-mono">
                      {formatCurrency(accountsOverview?.byType?.CURRENT?.balance)}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="account-progress-bar">
                  <div className="bar-segment bar-savings" style={{ width: `${savingsPercent}%` }} />
                  <div className="bar-segment bar-current" style={{ width: `${currentPercent}%` }} />
                </div>
              </div>

              {/* Operational Status Breakdown */}
              <div className="account-status-block">
                <span className="subhead-label">Operational Status Breakdown</span>
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Accounts</th>
                      <th className="text-right">Total Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <span className="badge-active-pill">ACTIVE</span>
                      </td>
                      <td>{accountsOverview?.byStatus?.ACTIVE || 0}</td>
                      <td className="text-right font-mono text-emerald">
                        Operational
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className="badge-warning-pill">FROZEN</span>
                      </td>
                      <td>{accountsOverview?.byStatus?.FROZEN || 0}</td>
                      <td className="text-right font-mono text-amber">
                        Compliance Locked
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className="badge-inactive-pill">INACTIVE</span>
                      </td>
                      <td>{accountsOverview?.byStatus?.INACTIVE || 0}</td>
                      <td className="text-right font-mono text-muted">
                        Dormant
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Quick Navigation Links */}
              <div className="dash-quick-links">
                <span className="subhead-label">Administrative Actions</span>
                <div className="quick-buttons-row">
                  <button
                    type="button"
                    className="quick-link-btn"
                    onClick={() => onNavigate && onNavigate('accounts')}
                  >
                    <IconLandmark size={15} />
                    <span>Open Accounts Console</span>
                  </button>
                  <button
                    type="button"
                    className="quick-link-btn"
                    onClick={() => onNavigate && onNavigate('reports')}
                  >
                    <IconLayoutDashboard size={15} />
                    <span>Full Analytics Reports</span>
                  </button>
                  <button
                    type="button"
                    className="quick-link-btn"
                    onClick={() => onNavigate && onNavigate('audit-logs')}
                  >
                    <IconShieldCheck size={15} />
                    <span>Centralized Audit Logs</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------
              4. Section D & E: Recent Transactions and System Activities
              ------------------------------------------------------------------ */}
          <div className="dash-split-grid">
            {/* Section D: Recent Transactions */}
            <div className="dash-section-panel">
              <div className="panel-header-row">
                <div className="panel-title-block">
                  <h2 className="panel-title">
                    <IconTrendingUp size={18} />
                    <span>Recent Transactions</span>
                  </h2>
                  <p className="panel-subtitle">Latest bank-wide monetary movements</p>
                </div>
                <button
                  type="button"
                  className="dash-link-action"
                  onClick={() => onNavigate && onNavigate('transactions')}
                >
                  View Complete Ledger <IconArrowRight size={14} />
                </button>
              </div>

              {recentTransactions.length === 0 ? (
                <div className="empty-substate">No transactions recorded yet.</div>
              ) : (
                <div className="table-responsive">
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Type</th>
                        <th>Flow</th>
                        <th className="text-right">Amount</th>
                        <th>Performer</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTransactions.map((tx) => (
                        <tr key={tx.transactionId}>
                          <td className="font-mono text-xs font-semibold">{tx.transactionRef}</td>
                          <td>
                            <span
                              className={`badge-type-pill ${
                                tx.type === 'DEPOSIT'
                                  ? 'badge-deposit'
                                  : tx.type === 'WITHDRAWAL'
                                  ? 'badge-withdrawal'
                                  : 'badge-transfer'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="font-mono text-xs">
                            {tx.type === 'DEPOSIT' && `→ ${tx.destinationAccountNumber}`}
                            {tx.type === 'WITHDRAWAL' && `${tx.sourceAccountNumber} →`}
                            {tx.type === 'TRANSFER' &&
                              `${tx.sourceAccountNumber} → ${tx.destinationAccountNumber}`}
                          </td>
                          <td className="text-right font-mono font-bold text-emerald">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td>
                            <span className="performer-name">{tx.performedBy?.name}</span>
                            <span className="performer-role text-xs text-muted">
                              ({tx.performedBy?.role})
                            </span>
                          </td>
                          <td className="cell-muted text-xs">{formatDateTime(tx.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section E: Staff & System Operations */}
            <div className="dash-section-panel">
              <div className="panel-header-row">
                <div className="panel-title-block">
                  <h2 className="panel-title">
                    <IconUsers size={18} />
                    <span>Staff Counter Operations</span>
                  </h2>
                  <p className="panel-subtitle">Audit trail of branch teller deposits and withdrawals</p>
                </div>
                <button
                  type="button"
                  className="dash-link-action"
                  onClick={() => onNavigate && onNavigate('employees')}
                >
                  Manage Employees <IconArrowRight size={14} />
                </button>
              </div>

              {(!attentionItems?.recentStaffOperations || attentionItems.recentStaffOperations.length === 0) ? (
                <div className="empty-substate">No staff counter transactions recorded yet.</div>
              ) : (
                <div className="table-responsive">
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Type</th>
                        <th>Account</th>
                        <th className="text-right">Amount</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attentionItems.recentStaffOperations.map((op) => (
                        <tr key={op.transactionId}>
                          <td>
                            <span className="font-semibold">{op.staffName}</span>
                            <span className="cell-muted text-xs block">@{op.staffUsername}</span>
                          </td>
                          <td>
                            <span
                              className={`badge-type-pill ${
                                op.type === 'DEPOSIT' ? 'badge-deposit' : 'badge-withdrawal'
                              }`}
                            >
                              {op.type}
                            </span>
                          </td>
                          <td className="font-mono text-xs">{op.accountNumber || '—'}</td>
                          <td className="text-right font-mono font-bold text-emerald">
                            {formatCurrency(op.amount)}
                          </td>
                          <td className="cell-muted text-xs">{formatDateTime(op.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
