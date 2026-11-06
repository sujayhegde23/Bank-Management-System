import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getAccountStatement } from '../services/api';
import './CustomerStatements.css';

/* ==============================================================================
   Inline SVG Icons (Zero External Dependencies)
   ============================================================================== */
function IconFileText({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconPrinter({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  );
}

function IconDownload({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCalendar({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconBuilding({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

function IconRefresh({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function IconCheck({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconCopy({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
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
 * CustomerStatements Component (Feature 4)
 *
 * Provides a comprehensive, institutional Customer Account Statements interface.
 * Features:
 * - Account selector dropdown across all customer-owned accounts
 * - Presets (All History, 7d, 30d, 90d, Custom Date Range)
 * - Start date <= End date validation
 * - Summary KPI cards (Opening, Deposits, Withdrawals, Transfers In/Out, Credits, Debits, Net, Closing)
 * - Transaction table with chronological running balance
 * - Pagination controls for large ledger histories
 * - Export PDF (standard printable bank statement) & Export CSV (spreadsheet)
 * - Loading, empty, and error states
 */
export default function CustomerStatements({
  accounts = [],
  selectedAccountId = null,
  currentUser = null,
  onNavigateToOverview = null
}) {
  // Normalize accounts list
  const validAccounts = useMemo(() => {
    return Array.isArray(accounts) ? accounts : [];
  }, [accounts]);

  // Selected account state
  const [currentAccountId, setCurrentAccountId] = useState(() => {
    if (selectedAccountId && validAccounts.some((a) => Number(a.accountId || a.account_id) === Number(selectedAccountId))) {
      return Number(selectedAccountId);
    }
    const firstActive = validAccounts.find((a) => (a.status || '').toUpperCase() === 'ACTIVE');
    if (firstActive) return Number(firstActive.accountId || firstActive.account_id);
    return validAccounts[0] ? Number(validAccounts[0].accountId || validAccounts[0].account_id) : null;
  });

  // Keep in sync if prop selectedAccountId changes
  useEffect(() => {
    if (selectedAccountId && Number(selectedAccountId) !== currentAccountId) {
      setCurrentAccountId(Number(selectedAccountId));
    }
  }, [selectedAccountId, currentAccountId]);

  // Currently selected account object
  const activeAccount = useMemo(() => {
    return validAccounts.find((a) => Number(a.accountId || a.account_id) === Number(currentAccountId)) || null;
  }, [validAccounts, currentAccountId]);

  // Statement data state
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filter state
  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);

  // Pagination state (client-side table page)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Copy feedback
  const [copiedAccount, setCopiedAccount] = useState(false);

  const isMountedRef = useRef(true);

  // Fetch statement data from backend
  const fetchStatement = useCallback(async (accId, selectedPreset, fromDate, toDate) => {
    if (!accId) return;
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (selectedPreset === 'custom') {
        if (fromDate) params.from = fromDate;
        if (toDate) params.to = toDate;
        params.preset = 'custom';
      } else {
        params.preset = selectedPreset;
      }

      const res = await getAccountStatement(accId, params);
      if (isMountedRef.current) {
        setStatement(res);
        setPage(1); // Reset to first page on new query
      }
    } catch (err) {
      console.error('Failed to load customer statement:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Unable to generate account statement.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Trigger statement fetch on account change or initial load
  useEffect(() => {
    isMountedRef.current = true;
    if (currentAccountId) {
      fetchStatement(currentAccountId, preset, customFrom, customTo);
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [currentAccountId, preset, customFrom, customTo, fetchStatement]);

  // Handle Preset Selection
  const handleSelectPreset = (p) => {
    setPreset(p);
    if (p === 'custom') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      setCustomFrom('');
      setCustomTo('');
      fetchStatement(currentAccountId, p, '', '');
    }
  };

  // Handle Custom Range Apply
  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (!customFrom || !customTo) {
      setError('Please specify both a start date and an end date.');
      return;
    }
    if (new Date(customFrom) > new Date(customTo)) {
      setError('Start date cannot be after end date.');
      return;
    }
    setError(null);
    fetchStatement(currentAccountId, 'custom', customFrom, customTo);
  };

  // Handle Copy Account Number
  const handleCopy = (accNum) => {
    if (!accNum) return;
    navigator.clipboard.writeText(accNum).then(() => {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }).catch(() => {});
  };

  // Handle Print Statement / Export PDF
  const handlePrint = () => {
    window.print();
  };

  // Handle Export CSV
  const handleDownloadCsv = () => {
    if (!currentAccountId) return;
    const params = new URLSearchParams();
    if (preset === 'custom') {
      if (customFrom) params.append('from', customFrom);
      if (customTo) params.append('to', customTo);
      params.append('preset', 'custom');
    } else {
      params.append('preset', preset);
    }
    params.append('format', 'csv');

    const downloadUrl = `/api/accounts/${currentAccountId}/statement?${params.toString()}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `statement-${activeAccount?.accountNumber || currentAccountId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Paginated transactions
  const allTxns = useMemo(() => statement?.transactions || [], [statement?.transactions]);
  const totalTxnCount = allTxns.length;
  const totalPages = Math.ceil(totalTxnCount / pageSize) || 1;
  const paginatedTxns = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return allTxns.slice(startIndex, startIndex + pageSize);
  }, [allTxns, page, pageSize]);

  return (
    <div className="customer-statements-container" id="customer-statements-root">
      {/* Page Title & Breadcrumb (Screen Only) */}
      <div className="statements-header-bar no-print">
        <div className="header-titles">
          <div className="badge-tag">RETAIL LEDGER • FR-20</div>
          <h2 className="statements-title">
            <IconFileText size={22} className="text-primary" />
            <span>Account Statements</span>
          </h2>
          <p className="statements-subtitle">
            Generate and export official bank statements and chronological ledger transactions{currentUser?.displayName ? ` for ${currentUser.displayName}` : ''}.
          </p>
        </div>

        {/* Global Toolbar Action Buttons */}
        <div className="header-actions">
          {onNavigateToOverview && (
            <button
              type="button"
              className="btn-statement-action btn-csv"
              onClick={onNavigateToOverview}
              title="Return to customer account overview"
            >
              <span>&larr; Overview</span>
            </button>
          )}
          <button
            type="button"
            className="btn-statement-action btn-pdf"
            onClick={handlePrint}
            disabled={loading || !statement}
            title="Export official statement to PDF / Print format"
          >
            <IconPrinter size={16} />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            className="btn-statement-action btn-csv"
            onClick={handleDownloadCsv}
            disabled={loading || !statement}
            title="Download statement ledger records as CSV spreadsheet"
          >
            <IconDownload size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Account Selector Card (Screen Only) */}
      <div className="account-selector-card no-print">
        <div className="selector-control-group">
          <label htmlFor="customer-account-select" className="selector-label">
            Select Customer Account:
          </label>
          <div className="select-wrapper">
            <select
              id="customer-account-select"
              value={currentAccountId || ''}
              onChange={(e) => setCurrentAccountId(Number(e.target.value))}
              className="statement-account-select font-mono"
              disabled={loading || validAccounts.length === 0}
            >
              {validAccounts.length === 0 ? (
                <option value="">No registered accounts available</option>
              ) : (
                validAccounts.map((acc) => {
                  const id = Number(acc.accountId || acc.account_id);
                  const num = acc.accountNumber || acc.account_number || `ACC #${id}`;
                  const type = acc.accountType || acc.account_type || 'ACCOUNT';
                  const bal = formatINR(acc.balance || acc.currentBalance || 0);
                  const status = (acc.status || 'ACTIVE').toUpperCase();
                  return (
                    <option key={id} value={id}>
                      {num} — {type} ({status}) • Balance: {bal}
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>

        {/* Active Account Overview Snapshot */}
        {activeAccount && (
          <div className="selected-acc-meta">
            <div className="meta-item">
              <span className="meta-lbl">Account Number</span>
              <div className="acc-copy-row">
                <span className="meta-val font-mono text-primary font-bold">
                  {activeAccount.accountNumber || activeAccount.account_number}
                </span>
                <button
                  type="button"
                  className="btn-copy-mini"
                  onClick={() => handleCopy(activeAccount.accountNumber || activeAccount.account_number)}
                  title="Copy account number"
                >
                  {copiedAccount ? <IconCheck size={12} className="text-success" /> : <IconCopy size={12} />}
                  <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="meta-item">
              <span className="meta-lbl">Account Type</span>
              <span className="meta-val font-semibold">
                {activeAccount.accountType || activeAccount.account_type || 'SAVINGS'}
              </span>
            </div>

            <div className="meta-item">
              <span className="meta-lbl">Account Status</span>
              <span className={`status-badge status-${(activeAccount.status || 'active').toLowerCase()}`}>
                {activeAccount.status || 'ACTIVE'}
              </span>
            </div>

            <div className="meta-item">
              <span className="meta-lbl">Current Ledger Balance</span>
              <span className="meta-val font-mono font-bold text-white">
                {formatINR(activeAccount.balance || activeAccount.currentBalance || 0)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Date Filter & Presets Bar (Screen Only) */}
      <div className="statement-filter-bar no-print">
        <div className="filter-presets-row">
          <span className="filter-label">
            <IconCalendar size={15} />
            <span>Statement Period:</span>
          </span>

          {[
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: '90d', label: 'Last 90 Days' },
            { id: 'all', label: 'All History' },
            { id: 'custom', label: 'Custom Range' }
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              id={`filter-pill-${p.id}`}
              className={`filter-pill ${preset === p.id ? 'active' : ''}`}
              onClick={() => handleSelectPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Picker Sub-form */}
        {showCustomRange && (
          <form className="custom-range-row" onSubmit={handleApplyCustom}>
            <div className="date-field">
              <label htmlFor="stmt-from-date">From:</label>
              <input
                id="stmt-from-date"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="input-date"
                required
              />
            </div>

            <div className="date-field">
              <label htmlFor="stmt-to-date">To:</label>
              <input
                id="stmt-to-date"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="input-date"
                required
              />
            </div>

            <button
              type="submit"
              className="btn-apply-range"
              disabled={loading}
            >
              Apply Filter
            </button>
          </form>
        )}
      </div>

      {/* Error Alert Banner (Screen Only) */}
      {error && (
        <div className="statement-error-banner no-print" role="alert">
          <IconAlertTriangle size={18} className="text-danger" />
          <span>{error}</span>
          <button
            type="button"
            className="btn-close-error"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {/* Loading Box */}
      {loading && !statement && (
        <div className="statement-loading-box">
          <IconRefresh size={32} className="spinning text-primary" />
          <p>Reconciling transaction ledger and compiling statement...</p>
        </div>
      )}

      {/* Primary Statement Document Sheet (Rendered for Screen & Print) */}
      {statement && (
        <div className="statement-sheet-wrapper" id="printable-statement-area">
          <article className="statement-paper">
            {/* Header: Official CORE BANK Letterhead */}
            <header className="paper-header">
              <div className="bank-brand-block">
                <div className="brand-logo-title">
                  <IconBuilding size={24} className="text-primary" />
                  <span className="brand-name">{statement.header.institutionName}</span>
                </div>
                <div className="brand-meta">
                  <span>Branch: Corporate Financial District, Mumbai</span>
                  <span>IFSC / Routing: CB-MUM-001 &bull; Phone: 1800-CORE-BANK</span>
                  <span>Email: support@corebank.com</span>
                </div>
              </div>

              <div className="doc-meta-block">
                <h1 className="doc-title">{statement.header.documentTitle}</h1>
                <div className="meta-line">
                  <span className="meta-k">Generated Date:</span>
                  <span className="meta-v">{statement.header.generatedAtFormatted}</span>
                </div>
                <div className="meta-line">
                  <span className="meta-k">Statement Period:</span>
                  <span className="meta-v period-badge">
                    {statement.period.fromFormatted} to {statement.period.toFormatted}
                  </span>
                </div>
              </div>
            </header>

            {/* Account & Customer Identification Card */}
            <section className="paper-account-bar">
              <div className="info-cell">
                <span className="cell-lbl">Account Holder</span>
                <span className="cell-val font-semibold">{statement.customer.customerName}</span>
              </div>
              <div className="info-cell">
                <span className="cell-lbl">Customer ID</span>
                <span className="cell-val font-mono">CUST-#{statement.customer.customerId}</span>
              </div>
              <div className="info-cell">
                <span className="cell-lbl">Account Number</span>
                <span className="cell-val font-mono text-primary font-bold">{statement.account.accountNumber}</span>
              </div>
              <div className="info-cell">
                <span className="cell-lbl">Account Type</span>
                <span className="cell-val">{statement.account.accountType}</span>
              </div>
              <div className="info-cell">
                <span className="cell-lbl">Status</span>
                <span className={`status-pill status-${statement.account.status.toLowerCase()}`}>
                  {statement.account.status}
                </span>
              </div>
            </section>

            {/* Summary KPI Cards Grid (§4) */}
            <section className="paper-kpi-grid">
              <div className="kpi-box box-opening">
                <span className="kpi-title">Opening Balance</span>
                <span className="kpi-amount font-mono">{statement.summary.openingBalanceFormatted}</span>
                <span className="kpi-subtext">At start of period</span>
              </div>

              <div className="kpi-box box-deposits">
                <span className="kpi-title">Total Deposits</span>
                <span className="kpi-amount font-mono text-success">+{statement.summary.totalDepositsFormatted}</span>
                <span className="kpi-subtext">{statement.summary.depositCount} deposits</span>
              </div>

              <div className="kpi-box box-withdrawals">
                <span className="kpi-title">Total Withdrawals</span>
                <span className="kpi-amount font-mono text-danger">-{statement.summary.totalWithdrawalsFormatted}</span>
                <span className="kpi-subtext">{statement.summary.withdrawalCount} withdrawals</span>
              </div>

              <div className="kpi-box box-transfers-in">
                <span className="kpi-title">Incoming Transfers</span>
                <span className="kpi-amount font-mono text-success">+{statement.summary.totalTransfersInFormatted}</span>
                <span className="kpi-subtext">{statement.summary.transferInCount} transfers</span>
              </div>

              <div className="kpi-box box-transfers-out">
                <span className="kpi-title">Outgoing Transfers</span>
                <span className="kpi-amount font-mono text-danger">-{statement.summary.totalTransfersOutFormatted}</span>
                <span className="kpi-subtext">{statement.summary.transferOutCount} transfers</span>
              </div>

              <div className="kpi-box box-closing">
                <span className="kpi-title">Closing Balance</span>
                <span className="kpi-amount font-mono text-primary font-bold">{statement.summary.closingBalanceFormatted}</span>
                <span className="kpi-subtext">
                  Net Flow: {statement.summary.netChangeFormatted} ({statement.summary.transactionCount} txns)
                </span>
              </div>
            </section>

            {/* Transaction Ledger Table (§5) */}
            <section className="paper-ledger-section">
              <div className="ledger-title-bar">
                <h3 className="ledger-heading">Transaction Ledger</h3>
                <span className="ledger-count font-mono">
                  {totalTxnCount === 0
                    ? '0 transactions'
                    : `Showing ${Math.min((page - 1) * pageSize + 1, totalTxnCount)}–${Math.min(page * pageSize, totalTxnCount)} of ${totalTxnCount} record${totalTxnCount === 1 ? '' : 's'}`}
                </span>
              </div>

              {totalTxnCount === 0 ? (
                <div className="statement-empty-state">
                  <p className="empty-heading">No transactions recorded for this period</p>
                  <p className="empty-subtext">
                    The account maintained an opening balance of <strong>{statement.summary.openingBalanceFormatted}</strong> and closing balance of <strong>{statement.summary.closingBalanceFormatted}</strong> with zero debits or credits between {statement.period.fromFormatted} and {statement.period.toFormatted}.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="statement-table">
                    <thead>
                      <tr>
                        <th style={{ width: '150px' }}>Date &amp; Time</th>
                        <th style={{ width: '180px' }}>Transaction Ref</th>
                        <th style={{ width: '130px' }}>Type</th>
                        <th>Description / Counterparty</th>
                        <th style={{ textAlign: 'right', width: '115px' }}>Debit (₹)</th>
                        <th style={{ textAlign: 'right', width: '115px' }}>Credit (₹)</th>
                        <th style={{ textAlign: 'right', width: '130px' }}>Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* For print media, print all transactions; on screen, show paginated transactions */}
                      {(window.matchMedia && window.matchMedia('print').matches ? allTxns : paginatedTxns).map((tx) => {
                        const isDebit = tx.direction === 'DEBIT';
                        const isCredit = tx.direction === 'CREDIT';
                        return (
                          <tr key={tx.transactionId || tx.transactionRef}>
                            <td className="cell-date font-mono">
                              {new Date(tx.timestamp).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </td>
                            <td className="cell-ref font-mono">{tx.transactionRef}</td>
                            <td className="cell-type">
                              <span className={`type-badge badge-${tx.type.toLowerCase().replace(/\s+/g, '-')}`}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="cell-desc">
                              <span className="desc-text">{tx.description}</span>
                            </td>
                            <td className="cell-debit text-danger font-mono text-right font-semibold">
                              {isDebit ? formatINR(tx.amount) : '—'}
                            </td>
                            <td className="cell-credit text-success font-mono text-right font-semibold">
                              {isCredit ? formatINR(tx.amount) : '—'}
                            </td>
                            <td className="cell-running font-mono text-right font-bold text-white">
                              {tx.runningBalanceFormatted}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Pagination Controls (Screen Only) */}
              {totalPages > 1 && (
                <div className="statement-pagination-bar no-print">
                  <div className="pagination-info">
                    Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalTxnCount} total records)
                  </div>

                  <div className="pagination-controls">
                    <div className="page-size-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                      <span>Rows:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                        className="input-date font-mono"
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      className="btn-page-nav"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      &larr; Previous
                    </button>

                    <div className="page-numbers">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .map((p, idx, arr) => (
                          <React.Fragment key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && <span className="page-dots">...</span>}
                            <button
                              type="button"
                              className={`btn-page-number ${page === p ? 'active' : ''}`}
                              onClick={() => setPage(p)}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>

                    <button
                      type="button"
                      className="btn-page-nav"
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Legal Statement & Reconciliation Footer */}
            <footer className="paper-footer">
              <div className="reconciliation-summary-row">
                <div className="recon-item">
                  <span className="recon-label">Opening Balance</span>
                  <span className="recon-value font-mono">{statement.summary.openingBalanceFormatted}</span>
                </div>
                <span className="recon-math">+</span>
                <div className="recon-item">
                  <span className="recon-label">Total Credits</span>
                  <span className="recon-value text-success font-mono">{statement.summary.totalCreditsFormatted}</span>
                </div>
                <span className="recon-math">-</span>
                <div className="recon-item">
                  <span className="recon-label">Total Debits</span>
                  <span className="recon-value text-danger font-mono">{statement.summary.totalDebitsFormatted}</span>
                </div>
                <span className="recon-math">=</span>
                <div className="recon-item recon-highlight">
                  <span className="recon-label">Closing Balance</span>
                  <span className="recon-value text-primary font-mono font-bold">{statement.summary.closingBalanceFormatted}</span>
                </div>
              </div>

              <div className="legal-notice">
                <p>
                  This document is an authoritative computer-generated account statement issued by CORE BANK Core Banking Ledger. Financial figures are cryptographically reconciled against confirmed ledger transactions. Please report any discrepancies to branch customer support within 14 banking days.
                </p>
                <div className="stamp-line font-mono">
                  <span>CORE BANK &bull; VERIFIED LEDGER STATEMENT</span>
                  <span>DOC-REF: STMT-{statement.account.accountNumber}-{statement.summary.transactionCount}TXN</span>
                </div>
              </div>
            </footer>
          </article>
        </div>
      )}
    </div>
  );
}
