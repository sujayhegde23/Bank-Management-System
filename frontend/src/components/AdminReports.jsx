import { useState, useEffect, useCallback } from 'react';
import {
  getReportsOverview,
  getCustomerReports,
  getAccountReports,
  getTransactionReports,
  exportReportCsv
} from '../services/api';
import './AdminReports.css';

/* ==============================================================================
   Inline Lucide-Style SVG Icons
   ============================================================================== */
function IconDownload({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCheck({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconBarChart({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
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

function IconRefresh({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconCalendar({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
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

function IconTrendingUp({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconInfo({ size = 16, className = '' }) {
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

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return String(isoStr);
  }
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    return d.toLocaleString('en-IN', {
      year: 'numeric',
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
 * Main Administrator Reports Component
 */
export default function AdminReports() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'customers' | 'accounts' | 'transactions'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterActive, setFilterActive] = useState(false);

  // Report data states
  const [overviewData, setOverviewData] = useState(null);
  const [customersData, setCustomersData] = useState(null);
  const [accountsData, setAccountsData] = useState(null);
  const [transactionsData, setTransactionsData] = useState(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Report export states (Feature 4)
  const [exporting, setExporting] = useState({ active: false, reportType: null });
  const [exportNotice, setExportNotice] = useState(null);

  const handleExport = async (category) => {
    try {
      setExporting({ active: true, reportType: category });
      setExportNotice({
        type: 'loading',
        message: `Generating ${category} report CSV...`
      });

      const filters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const result = await exportReportCsv(category, filters);
      setExportNotice({
        type: 'success',
        message: `${category.charAt(0).toUpperCase() + category.slice(1)} report successfully exported as CSV.`,
        filename: result.filename
      });
    } catch (err) {
      console.error(`Export ${category} failed:`, err);
      setExportNotice({
        type: 'error',
        message: err.message || `Failed to export ${category} report.`
      });
    } finally {
      setExporting({ active: false, reportType: null });
    }
  };

  const handleExportAll = async () => {
    try {
      setExporting({ active: true, reportType: 'all' });
      setExportNotice({
        type: 'loading',
        message: 'Generating all reports (Customers, Accounts, Transactions) for download...'
      });

      const filters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      await exportReportCsv('customers', filters);
      await new Promise(r => setTimeout(r, 350));
      await exportReportCsv('accounts', filters);
      await new Promise(r => setTimeout(r, 350));
      const last = await exportReportCsv('transactions', filters);

      setExportNotice({
        type: 'success',
        message: 'All 3 administrative reports (Customers, Accounts, Transactions) successfully exported as separate CSV files.',
        filename: last.filename
      });
    } catch (err) {
      console.error('Export all failed:', err);
      setExportNotice({
        type: 'error',
        message: err.message || 'Failed to export reports.'
      });
    } finally {
      setExporting({ active: false, reportType: null });
    }
  };

  const fetchReports = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadReports() {
      setLoading(true);
      setError(null);
      try {
        const filters = {};
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;

        const promises = [getReportsOverview(filters)];

        if (activeTab === 'customers' || activeTab === 'overview') {
          promises.push(getCustomerReports());
        }
        if (activeTab === 'accounts' || activeTab === 'overview') {
          promises.push(getAccountReports());
        }
        if (activeTab === 'transactions' || activeTab === 'overview') {
          promises.push(getTransactionReports(filters));
        }

        const results = await Promise.all(promises);
        if (!ignore) {
          setOverviewData(results[0]);
          let idx = 1;
          if (activeTab === 'customers' || activeTab === 'overview') {
            setCustomersData(results[idx++]);
          }
          if (activeTab === 'accounts' || activeTab === 'overview') {
            setAccountsData(results[idx++]);
          }
          if (activeTab === 'transactions' || activeTab === 'overview') {
            setTransactionsData(results[idx++]);
          }
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load reports:', err);
          setError(err.message || 'Failed to generate administrative reports. Please verify database connectivity.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      ignore = true;
    };
  }, [activeTab, startDate, endDate, refreshTrigger]);

  // Quick Preset Handlers
  const handlePreset = (preset) => {
    const today = new Date();
    const formatYMD = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'today') {
      const todayStr = formatYMD(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setFilterActive(true);
    } else if (preset === '7d') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      setStartDate(formatYMD(past7));
      setEndDate(formatYMD(today));
      setFilterActive(true);
    } else if (preset === '30d') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      setStartDate(formatYMD(past30));
      setEndDate(formatYMD(today));
      setFilterActive(true);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      setFilterActive(false);
    }
  };

  const handleApplyFilter = (e) => {
    e.preventDefault();
    if (startDate && endDate && startDate > endDate) {
      alert('Start date cannot be after end date.');
      return;
    }
    setFilterActive(Boolean(startDate || endDate));
    fetchReports();
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    setFilterActive(false);
  };

  return (
    <div className="admin-reports-container" id="admin-reports-view">
      {/* Page Header */}
      <div className="reports-header-card">
        <div className="reports-header-top">
          <div>
            <div className="reports-badge">
              <IconShieldCheck size={14} />
              <span>Administrator Clearance &bull; Authorized Financial Summaries</span>
            </div>
            <h1 className="reports-title">Executive Reports & Analytics</h1>
            <p className="reports-subtitle">
              Comprehensive real-time reporting across registered customers, operational accounts, and transaction volume.
            </p>
          </div>
          <div className="reports-header-actions">
            <button
              type="button"
              className="reports-export-header-btn"
              onClick={handleExportAll}
              disabled={exporting.active || loading}
              title="Export all reports (Customers, Accounts, Transactions) as separate CSV files"
            >
              <IconDownload size={15} />
              <span>{exporting.active && exporting.reportType === 'all' ? 'Exporting...' : 'Export All (CSV)'}</span>
            </button>
            <button
              type="button"
              className="reports-refresh-btn"
              onClick={fetchReports}
              disabled={loading}
              title="Refresh all metrics from database"
            >
              <IconRefresh size={16} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="reports-tab-nav">
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <IconBarChart size={16} />
            <span>Executive Overview</span>
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <IconUsers size={16} />
            <span>Customer Insights</span>
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === 'accounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounts')}
          >
            <IconLandmark size={16} />
            <span>Account Distribution</span>
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
          >
            <IconCreditCard size={16} />
            <span>Transaction Activity</span>
          </button>
        </div>

        {/* Date Filter Bar */}
        <form className="reports-filter-bar" onSubmit={handleApplyFilter}>
          <div className="filter-group">
            <IconCalendar size={15} className="filter-icon" />
            <span className="filter-label">Filter Period:</span>
          </div>

          <div className="filter-presets">
            <button
              type="button"
              className={`preset-pill ${!filterActive ? 'active' : ''}`}
              onClick={() => handlePreset('all')}
            >
              All Time
            </button>
            <button
              type="button"
              className="preset-pill"
              onClick={() => handlePreset('today')}
            >
              Today
            </button>
            <button
              type="button"
              className="preset-pill"
              onClick={() => handlePreset('7d')}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className="preset-pill"
              onClick={() => handlePreset('30d')}
            >
              Last 30 Days
            </button>
          </div>

          <div className="date-input-group">
            <label htmlFor="filter-start-date">From:</label>
            <input
              id="filter-start-date"
              type="date"
              className="date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="date-input-group">
            <label htmlFor="filter-end-date">To:</label>
            <input
              id="filter-end-date"
              type="date"
              className="date-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <button type="submit" className="filter-apply-btn" disabled={loading}>
            Apply
          </button>
          {filterActive && (
            <button
              type="button"
              className="filter-clear-btn"
              onClick={handleClearFilter}
              disabled={loading}
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* Report Export Status Notification Banner (Feature 4) */}
      {exportNotice && (
        <div className={`reports-export-banner banner-${exportNotice.type}`}>
          <div className="banner-content">
            {exportNotice.type === 'success' && <IconCheck size={16} className="text-emerald" />}
            {exportNotice.type === 'loading' && <IconRefresh size={16} className="spin text-blue" />}
            {exportNotice.type === 'error' && <IconInfo size={16} className="text-rose" />}
            <span className="banner-msg">{exportNotice.message}</span>
            {exportNotice.filename && (
              <span className="export-filename-badge">{exportNotice.filename}</span>
            )}
          </div>
          <button
            type="button"
            className="banner-dismiss-btn"
            onClick={() => setExportNotice(null)}
            title="Dismiss notification"
          >
            &times;
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="reports-error-banner">
          <div className="error-text">
            <strong>Reporting Error:</strong> {error}
          </div>
          <button type="button" className="retry-btn" onClick={fetchReports}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton Indicator */}
      {loading && !overviewData && (
        <div className="reports-loading-skeleton">
          <div className="skeleton-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
          <p className="loading-label">Aggregating real-time database records...</p>
        </div>
      )}

      {/* ====================================================================
          TAB 1: EXECUTIVE OVERVIEW
          ==================================================================== */}
      {activeTab === 'overview' && overviewData && (
        <div className="reports-tab-content">
          <div className="tab-section-header">
            <div>
              <h2 className="tab-section-title">Executive Key Performance Indicators</h2>
              <p className="tab-section-subtitle">Real-time banking metrics across customers, accounts, and financial throughput.</p>
            </div>
            <div className="tab-section-actions">
              <button
                type="button"
                className="export-btn export-btn-secondary"
                onClick={() => handleExport('overview')}
                disabled={exporting.active}
                title="Export executive KPI summary as CSV"
              >
                <IconDownload size={15} />
                <span>{exporting.active && exporting.reportType === 'overview' ? 'Exporting...' : 'Export Overview (CSV)'}</span>
              </button>
              <button
                type="button"
                className="export-btn export-btn-primary"
                onClick={handleExportAll}
                disabled={exporting.active}
                title="Export all reports (Customers, Accounts, Transactions) as separate CSV files"
              >
                <IconDownload size={15} />
                <span>{exporting.active && exporting.reportType === 'all' ? 'Exporting All...' : 'Export All (CSV)'}</span>
              </button>
            </div>
          </div>
          {/* KPI Summary Cards */}
          <div className="kpi-grid">
            {/* Customers Card */}
            <div className="kpi-card" onClick={() => setActiveTab('customers')}>
              <div className="kpi-card-header">
                <span className="kpi-label">Registered Customers</span>
                <span className="kpi-icon-wrap icon-blue">
                  <IconUsers size={20} />
                </span>
              </div>
              <div className="kpi-value">{overviewData.customers.total}</div>
              <div className="kpi-subtags">
                <span className="badge-status-pill badge-active">
                  {overviewData.customers.active} Active
                </span>
                {overviewData.customers.inactive > 0 && (
                  <span className="badge-status-pill badge-inactive">
                    {overviewData.customers.inactive} Inactive
                  </span>
                )}
              </div>
            </div>

            {/* Accounts Card */}
            <div className="kpi-card" onClick={() => setActiveTab('accounts')}>
              <div className="kpi-card-header">
                <span className="kpi-label">Active Bank Accounts</span>
                <span className="kpi-icon-wrap icon-emerald">
                  <IconLandmark size={20} />
                </span>
              </div>
              <div className="kpi-value">{overviewData.accounts.total}</div>
              <div className="kpi-subtags">
                <span className="badge-sub-pill">
                  {overviewData.accounts.byType.SAVINGS?.count || 0} Savings
                </span>
                <span className="badge-sub-pill">
                  {overviewData.accounts.byType.CURRENT?.count || 0} Current
                </span>
                {overviewData.accounts.byStatus.FROZEN?.count > 0 && (
                  <span className="badge-status-pill badge-frozen">
                    {overviewData.accounts.byStatus.FROZEN.count} Frozen
                  </span>
                )}
              </div>
            </div>

            {/* Total Balance Card */}
            <div className="kpi-card" onClick={() => setActiveTab('accounts')}>
              <div className="kpi-card-header">
                <span className="kpi-label">Total System Deposits</span>
                <span className="kpi-icon-wrap icon-amber">
                  <IconTrendingUp size={20} />
                </span>
              </div>
              <div className="kpi-value">{formatCurrency(overviewData.accounts.totalBalance)}</div>
              <div className="kpi-subtags">
                <span className="kpi-metric-note">
                  Avg: {formatCurrency(overviewData.accounts.averageBalance)} / acct
                </span>
              </div>
            </div>

            {/* Transactions Card */}
            <div className="kpi-card" onClick={() => setActiveTab('transactions')}>
              <div className="kpi-card-header">
                <span className="kpi-label">
                  Transaction Volume {filterActive ? '(Period)' : '(Total)'}
                </span>
                <span className="kpi-icon-wrap icon-purple">
                  <IconCreditCard size={20} />
                </span>
              </div>
              <div className="kpi-value">{formatCurrency(overviewData.transactions.totalVolume)}</div>
              <div className="kpi-subtags">
                <span className="badge-sub-pill">
                  {overviewData.transactions.totalCount} Transactions
                </span>
                <span className="badge-sub-pill">
                  {overviewData.transactions.byType.TRANSFER?.count || 0} Transfers
                </span>
              </div>
            </div>
          </div>

          {/* Quick Distribution Summary Grids */}
          <div className="overview-split-grid">
            {/* Account Status Breakdown */}
            <div className="section-card">
              <h2 className="section-title">
                <IconLandmark size={18} />
                <span>Account Status Breakdown</span>
              </h2>
              <table className="report-table">
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
                      <span className="badge-status-pill badge-active">ACTIVE</span>
                    </td>
                    <td>{overviewData.accounts.byStatus.ACTIVE?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(overviewData.accounts.byStatus.ACTIVE?.balance)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="badge-status-pill badge-inactive">INACTIVE</span>
                    </td>
                    <td>{overviewData.accounts.byStatus.INACTIVE?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(overviewData.accounts.byStatus.INACTIVE?.balance)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="badge-status-pill badge-frozen">FROZEN</span>
                    </td>
                    <td>{overviewData.accounts.byStatus.FROZEN?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(overviewData.accounts.byStatus.FROZEN?.balance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Transaction Types Breakdown */}
            <div className="section-card">
              <h2 className="section-title">
                <IconCreditCard size={18} />
                <span>Transaction Breakdown</span>
              </h2>
              <div className="transfer-notice">
                <IconInfo size={15} />
                <span>Transfers are counted once in global totals.</span>
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Operation Type</th>
                    <th>Count</th>
                    <th className="text-right">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="badge-type-pill badge-deposit">DEPOSIT</span>
                    </td>
                    <td>{overviewData.transactions.byType.DEPOSIT?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(overviewData.transactions.byType.DEPOSIT?.volume)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="badge-type-pill badge-withdrawal">WITHDRAWAL</span>
                    </td>
                    <td>{overviewData.transactions.byType.WITHDRAWAL?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(overviewData.transactions.byType.WITHDRAWAL?.volume)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="badge-type-pill badge-transfer">TRANSFER</span>
                    </td>
                    <td>{overviewData.transactions.byType.TRANSFER?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(overviewData.transactions.byType.TRANSFER?.volume)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 2: CUSTOMER INSIGHTS
          ==================================================================== */}
      {activeTab === 'customers' && customersData && (
        <div className="reports-tab-content">
          <div className="tab-section-header">
            <div>
              <h2 className="tab-section-title">Customer Insights & Registration Trends</h2>
              <p className="tab-section-subtitle">Aggregated demographic, status, and registration volume statistics.</p>
            </div>
            <div className="tab-section-actions">
              <button
                type="button"
                className="export-btn export-btn-primary"
                onClick={() => handleExport('customers')}
                disabled={exporting.active}
                title="Export complete customer directory & summary metrics as CSV"
              >
                <IconDownload size={15} />
                <span>{exporting.active && exporting.reportType === 'customers' ? 'Exporting...' : 'Export Customers (CSV)'}</span>
              </button>
            </div>
          </div>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Total Customers</span>
              <div className="kpi-value">{customersData.totalCustomers}</div>
              <span className="kpi-subtext">Registered across all branches</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Active Users</span>
              <div className="kpi-value text-emerald">
                {customersData.statusBreakdown.ACTIVE || 0}
              </div>
              <span className="kpi-subtext">Active portal access</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Registered Today</span>
              <div className="kpi-value text-blue">
                {customersData.registrationTrends.today || 0}
              </div>
              <span className="kpi-subtext">New signups today</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Last 30 Days</span>
              <div className="kpi-value text-purple">
                {customersData.registrationTrends.last30Days || 0}
              </div>
              <span className="kpi-subtext">Monthly acquisition</span>
            </div>
          </div>

          {/* Recent Registrations Table */}
          <div className="section-card">
            <div className="section-header-row">
              <h2 className="section-title">
                <IconUsers size={18} />
                <span>Recent Customer Registrations (Latest 10)</span>
              </h2>
            </div>

            {customersData.recentRegistrations.length === 0 ? (
              <div className="empty-state-card">No customers registered yet.</div>
            ) : (
              <div className="table-responsive">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Email & Phone</th>
                      <th>Status</th>
                      <th>Accounts</th>
                      <th className="text-right">Total Balance</th>
                      <th>Registration Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersData.recentRegistrations.map((cust) => (
                      <tr key={cust.customerId}>
                        <td className="font-mono">#{cust.customerId}</td>
                        <td className="font-semibold">{cust.fullName}</td>
                        <td>
                          <div className="cell-subline">{cust.email}</div>
                          <div className="cell-muted">{cust.phone}</div>
                        </td>
                        <td>
                          <span
                            className={`badge-status-pill ${
                              cust.userStatus === 'ACTIVE' ? 'badge-active' : 'badge-inactive'
                            }`}
                          >
                            {cust.userStatus}
                          </span>
                        </td>
                        <td>{cust.accountCount} acct{cust.accountCount === 1 ? '' : 's'}</td>
                        <td className="text-right font-mono font-semibold">
                          {formatCurrency(cust.totalBalance)}
                        </td>
                        <td className="cell-muted">{formatDateTime(cust.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: ACCOUNT DISTRIBUTION
          ==================================================================== */}
      {activeTab === 'accounts' && accountsData && (
        <div className="reports-tab-content">
          <div className="tab-section-header">
            <div>
              <h2 className="tab-section-title">Account Portfolio & Balance Analysis</h2>
              <p className="tab-section-subtitle">Operational breakdowns by account type, compliance status, and balance liquidity.</p>
            </div>
            <div className="tab-section-actions">
              <button
                type="button"
                className="export-btn export-btn-primary"
                onClick={() => handleExport('accounts')}
                disabled={exporting.active}
                title="Export accounts ledger & distribution metrics as CSV"
              >
                <IconDownload size={15} />
                <span>{exporting.active && exporting.reportType === 'accounts' ? 'Exporting...' : 'Export Accounts (CSV)'}</span>
              </button>
            </div>
          </div>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Total Accounts</span>
              <div className="kpi-value">{accountsData.totalAccounts}</div>
              <span className="kpi-subtext">Savings & Current combined</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Total System Balance</span>
              <div className="kpi-value text-emerald">
                {formatCurrency(accountsData.totalBalance)}
              </div>
              <span className="kpi-subtext">Sum of all customer balances</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Average Balance</span>
              <div className="kpi-value text-blue">
                {formatCurrency(accountsData.averageBalance)}
              </div>
              <span className="kpi-subtext">Mean balance per account</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Max Balance</span>
              <div className="kpi-value text-purple">
                {formatCurrency(accountsData.maxBalance)}
              </div>
              <span className="kpi-subtext">Highest single account balance</span>
            </div>
          </div>

          <div className="overview-split-grid">
            {/* Breakdown by Account Type */}
            <div className="section-card">
              <h2 className="section-title">
                <IconLandmark size={18} />
                <span>Breakdown by Account Type</span>
              </h2>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Accounts</th>
                    <th className="text-right">Total Balance</th>
                    <th className="text-right">Average Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="badge-sub-pill font-semibold">SAVINGS</span>
                    </td>
                    <td>{accountsData.byType.SAVINGS?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(accountsData.byType.SAVINGS?.balance)}
                    </td>
                    <td className="text-right font-mono">
                      {formatCurrency(accountsData.byType.SAVINGS?.averageBalance)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="badge-sub-pill font-semibold">CURRENT</span>
                    </td>
                    <td>{accountsData.byType.CURRENT?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(accountsData.byType.CURRENT?.balance)}
                    </td>
                    <td className="text-right font-mono">
                      {formatCurrency(accountsData.byType.CURRENT?.averageBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Breakdown by Account Status */}
            <div className="section-card">
              <h2 className="section-title">
                <IconShieldCheck size={18} />
                <span>Breakdown by Operational Status</span>
              </h2>
              <table className="report-table">
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
                      <span className="badge-status-pill badge-active">ACTIVE</span>
                    </td>
                    <td>{accountsData.byStatus.ACTIVE?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(accountsData.byStatus.ACTIVE?.balance)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="badge-status-pill badge-inactive">INACTIVE</span>
                    </td>
                    <td>{accountsData.byStatus.INACTIVE?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(accountsData.byStatus.INACTIVE?.balance)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="badge-status-pill badge-frozen">FROZEN</span>
                    </td>
                    <td>{accountsData.byStatus.FROZEN?.count || 0}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(accountsData.byStatus.FROZEN?.balance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Accounts by Balance Table */}
          <div className="section-card">
            <h2 className="section-title">
              <IconTrendingUp size={18} />
              <span>Highest Balance Accounts (Top 10)</span>
            </h2>
            {accountsData.topAccounts.length === 0 ? (
              <div className="empty-state-card">No accounts found.</div>
            ) : (
              <div className="table-responsive">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Account Number</th>
                      <th>Customer</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th className="text-right">Balance</th>
                      <th>Opened Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountsData.topAccounts.map((acc) => (
                      <tr key={acc.accountId}>
                        <td className="font-mono font-semibold">{acc.accountNumber}</td>
                        <td>{acc.customerName}</td>
                        <td>
                          <span className="badge-sub-pill">{acc.accountType}</span>
                        </td>
                        <td>
                          <span
                            className={`badge-status-pill ${
                              acc.status === 'ACTIVE'
                                ? 'badge-active'
                                : acc.status === 'FROZEN'
                                ? 'badge-frozen'
                                : 'badge-inactive'
                            }`}
                          >
                            {acc.status}
                          </span>
                        </td>
                        <td className="text-right font-mono font-bold text-emerald">
                          {formatCurrency(acc.balance)}
                        </td>
                        <td className="cell-muted">{formatDate(acc.openedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 4: TRANSACTION ACTIVITY
          ==================================================================== */}
      {activeTab === 'transactions' && transactionsData && (
        <div className="reports-tab-content">
          <div className="tab-section-header">
            <div>
              <h2 className="tab-section-title">Transaction Activity & Throughput</h2>
              <p className="tab-section-subtitle">
                Detailed audit of deposits, withdrawals, and transfers
                {filterActive ? ` for period ${startDate || 'beginning'} to ${endDate || 'present'}` : ' (All Time)'}.
              </p>
            </div>
            <div className="tab-section-actions">
              <button
                type="button"
                className="export-btn export-btn-primary"
                onClick={() => handleExport('transactions')}
                disabled={exporting.active}
                title="Export transaction records & activity metrics for current date filter as CSV"
              >
                <IconDownload size={15} />
                <span>{exporting.active && exporting.reportType === 'transactions' ? 'Exporting...' : 'Export Transactions (CSV)'}</span>
              </button>
            </div>
          </div>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Total Transactions</span>
              <div className="kpi-value">{transactionsData.totalCount}</div>
              <span className="kpi-subtext">In selected reporting window</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Total Volume</span>
              <div className="kpi-value text-emerald">
                {formatCurrency(transactionsData.totalVolume)}
              </div>
              <span className="kpi-subtext">Sum of completed transactions</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Deposits</span>
              <div className="kpi-value text-blue">
                {transactionsData.byType.DEPOSIT?.count || 0}
              </div>
              <span className="kpi-subtext">
                Vol: {formatCurrency(transactionsData.byType.DEPOSIT?.volume)}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Fund Transfers</span>
              <div className="kpi-value text-purple">
                {transactionsData.byType.TRANSFER?.count || 0}
              </div>
              <span className="kpi-subtext">
                Vol: {formatCurrency(transactionsData.byType.TRANSFER?.volume)}
              </span>
            </div>
          </div>

          <div className="transfer-notice">
            <IconInfo size={16} />
            <span>
              <strong>Transfer Accounting Integrity:</strong> Every customer fund transfer is represented as a single record with source and destination accounts. Transfers are counted <em>exactly once</em> in total transactions and total volume calculations.
            </span>
          </div>

          {/* Daily Activity Summary */}
          <div className="section-card">
            <h2 className="section-title">
              <IconCalendar size={18} />
              <span>Daily Transaction Breakdown</span>
            </h2>
            {transactionsData.dailySummary.length === 0 ? (
              <div className="empty-state-card">
                No transactions recorded for the selected period.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Deposits (Cnt / Vol)</th>
                      <th>Withdrawals (Cnt / Vol)</th>
                      <th>Transfers (Cnt / Vol)</th>
                      <th className="text-right">Day Total Count</th>
                      <th className="text-right">Day Total Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsData.dailySummary.map((d) => (
                      <tr key={d.date}>
                        <td className="font-mono font-semibold">{d.date}</td>
                        <td>
                          {d.depositsCount} / {formatCurrency(d.depositsVolume)}
                        </td>
                        <td>
                          {d.withdrawalsCount} / {formatCurrency(d.withdrawalsVolume)}
                        </td>
                        <td>
                          {d.transfersCount} / {formatCurrency(d.transfersVolume)}
                        </td>
                        <td className="text-right font-mono font-semibold">
                          {d.totalCount}
                        </td>
                        <td className="text-right font-mono font-bold text-emerald">
                          {formatCurrency(d.totalVolume)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Largest Transactions in Period */}
          <div className="section-card">
            <h2 className="section-title">
              <IconTrendingUp size={18} />
              <span>High-Value Transactions in Selected Period (Top 10)</span>
            </h2>
            {transactionsData.largestTransactions.length === 0 ? (
              <div className="empty-state-card">No transactions found.</div>
            ) : (
              <div className="table-responsive">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Type</th>
                      <th>Accounts Involved</th>
                      <th className="text-right">Amount</th>
                      <th>Date & Time</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsData.largestTransactions.map((t) => (
                      <tr key={t.transactionId}>
                        <td className="font-mono">{t.transactionRef}</td>
                        <td>
                          <span
                            className={`badge-type-pill ${
                              t.type === 'DEPOSIT'
                                ? 'badge-deposit'
                                : t.type === 'WITHDRAWAL'
                                ? 'badge-withdrawal'
                                : 'badge-transfer'
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td className="font-mono text-sm">
                          {t.type === 'DEPOSIT' && `→ ${t.destinationAccountNumber}`}
                          {t.type === 'WITHDRAWAL' && `${t.sourceAccountNumber} →`}
                          {t.type === 'TRANSFER' &&
                            `${t.sourceAccountNumber} → ${t.destinationAccountNumber}`}
                        </td>
                        <td className="text-right font-mono font-bold text-emerald">
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="cell-muted">{formatDateTime(t.createdAt)}</td>
                        <td className="cell-muted text-sm">{t.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
