import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getAccountStatement } from '../services/api';
import './AccountStatementModal.css';

/* ==============================================================================
   Inline SVG Icons (Zero-dependency)
   ============================================================================== */
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

function IconX({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function IconBuilding({ size = 18, className = '' }) {
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

function IconFileText({ size = 16, className = '' }) {
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

/**
 * Format currency to Indian Rupees
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
 * AccountStatementModal Component (Feature 3)
 *
 * Renders an authoritative Customer Bank Account Statement for a selected account.
 * Supports presets (7d, 30d, 90d, all, custom), live summary cards, running balance table,
 * browser printing, and CSV export.
 *
 * @param {object} props
 * @param {number|string} props.accountId - Target bank account ID
 * @param {object} [props.accountData] - Initial account metadata
 * @param {Function} props.onClose - Modal close handler
 */
export default function AccountStatementModal({ accountId, accountData, onClose }) {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = Newest first (default), 'asc' = Chronological

  const isMountedRef = useRef(true);

  // Fetch statement data from backend
  const fetchStatement = useCallback(async (selectedPreset, fromDate, toDate) => {
    if (!accountId) return;
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

      const res = await getAccountStatement(accountId, params);
      if (isMountedRef.current) {
        setStatement(res);
      }
    } catch (err) {
      console.error('Failed to load account statement:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Unable to generate account statement.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [accountId]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchStatement('30d', '', '');

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchStatement, onClose]);

  // Handle Preset Selection
  const handleSelectPreset = (p) => {
    setPreset(p);
    if (p === 'custom') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
      fetchStatement(p, '', '');
    }
  };

  // Handle Custom Range Apply
  const handleApplyCustom = (e) => {
    e.preventDefault();
    if (customFrom && customTo && new Date(customFrom) > new Date(customTo)) {
      setError('Start date cannot be after end date');
      return;
    }
    fetchStatement('custom', customFrom, customTo);
  };

  // Handle Print Action
  const handlePrint = () => {
    window.print();
  };

  // Handle CSV Download
  const handleDownloadCsv = () => {
    const params = new URLSearchParams();
    if (preset === 'custom') {
      if (customFrom) params.append('from', customFrom);
      if (customTo) params.append('to', customTo);
      params.append('preset', 'custom');
    } else {
      params.append('preset', preset);
    }
    params.append('format', 'csv');

    const downloadUrl = `/api/accounts/${accountId}/statement?${params.toString()}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `statement-${accountData?.accountNumber || accountId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return createPortal(
    <div
      className="modal-overlay statement-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="statement-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="statement-dialog-card">
        {/* Controls Header (Screen Only) */}
        <div className="statement-screen-toolbar no-print">
          <div className="toolbar-left">
            <IconFileText size={18} className="text-primary" />
            <span id="statement-title" className="toolbar-title">
              Account Statement &bull; {accountData?.accountNumber || `ACC #${accountId}`}
            </span>
          </div>

          <div className="toolbar-right">
            <button
              type="button"
              className="btn-toolbar-action btn-print"
              onClick={handlePrint}
              disabled={loading || !statement}
              title="Print standard A4 statement"
            >
              <IconPrinter size={15} />
              <span>Print Statement</span>
            </button>

            <button
              type="button"
              className="btn-toolbar-action btn-csv"
              onClick={handleDownloadCsv}
              disabled={loading || !statement}
              title="Download statement as CSV spreadsheet"
            >
              <IconDownload size={15} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              className="btn-toolbar-close"
              onClick={onClose}
              aria-label="Close statement preview"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Date Filter Bar (Screen Only) */}
        <div className="statement-filter-bar no-print">
          <div className="preset-pills-row">
            <span className="filter-label">
              <IconCalendar size={14} />
              <span>Period:</span>
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
                className={`preset-pill ${preset === p.id ? 'active' : ''}`}
                onClick={() => handleSelectPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {showCustomRange && (
            <form className="custom-range-form" onSubmit={handleApplyCustom}>
              <div className="form-group-inline">
                <label htmlFor="custom-from">From:</label>
                <input
                  id="custom-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="date-input-custom"
                  required
                />
              </div>

              <div className="form-group-inline">
                <label htmlFor="custom-to">To:</label>
                <input
                  id="custom-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="date-input-custom"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary-custom btn-apply"
                disabled={loading}
              >
                Apply Range
              </button>
            </form>
          )}
        </div>

        {/* Error Banner (Screen Only) */}
        {error && (
          <div className="statement-error-banner no-print" role="alert">
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Statement Paper Container */}
        <div className="statement-scroll-wrapper">
          {loading && !statement ? (
            <div className="statement-loading-box">
              <IconRefresh size={28} className="spinning text-primary" />
              <p>Reconciling ledger and generating statement...</p>
            </div>
          ) : statement ? (
            <div className="statement-sheet" id="printable-statement">
              {/* Statement Institutional Header */}
              <header className="sheet-header">
                <div className="sheet-bank-info">
                  <div className="bank-logo-row">
                    <IconBuilding size={22} className="text-primary" />
                    <span className="bank-name">{statement.header.institutionName}</span>
                  </div>
                  <div className="branch-meta">
                    <span>Branch: Main Financial District, Mumbai</span>
                    <span>IFSC / Routing: CB-MUM-001 &bull; Support: support@corebank.com</span>
                  </div>
                </div>

                <div className="sheet-title-info">
                  <h2 className="statement-doc-title">{statement.header.documentTitle}</h2>
                  <div className="statement-meta-row">
                    <span className="text-muted">Generated:</span>
                    <span className="font-semibold">{statement.header.generatedAtFormatted}</span>
                  </div>
                  <div className="statement-meta-row">
                    <span className="text-muted">Period:</span>
                    <span className="period-badge">{statement.period.fromFormatted} to {statement.period.toFormatted}</span>
                  </div>
                </div>
              </header>

              {/* Account and Customer Identification Banner */}
              <section className="sheet-account-card">
                <div className="acc-field">
                  <span className="field-lbl">Customer Name</span>
                  <span className="field-val font-semibold">{statement.customer.customerName}</span>
                </div>
                <div className="acc-field">
                  <span className="field-lbl">Customer ID</span>
                  <span className="field-val font-mono">CUST-#{statement.customer.customerId}</span>
                </div>
                <div className="acc-field">
                  <span className="field-lbl">Account Number</span>
                  <span className="field-val font-mono text-primary font-bold">{statement.account.accountNumber}</span>
                </div>
                <div className="acc-field">
                  <span className="field-lbl">Account Type</span>
                  <span className="field-val">{statement.account.accountType}</span>
                </div>
                <div className="acc-field">
                  <span className="field-lbl">Account Status</span>
                  <span className={`status-pill status-${statement.account.status.toLowerCase()}`}>
                    {statement.account.status}
                  </span>
                </div>
              </section>

              {/* Financial Summary KPI Cards */}
              <section className="sheet-kpi-grid">
                <div className="kpi-card card-opening">
                  <span className="kpi-lbl">Opening Balance</span>
                  <span className="kpi-val font-mono">{statement.summary.openingBalanceFormatted}</span>
                  <span className="kpi-desc">At period start</span>
                </div>

                <div className="kpi-card card-credits">
                  <span className="kpi-lbl">Total Credits</span>
                  <span className="kpi-val font-mono text-success">+{statement.summary.totalCreditsFormatted}</span>
                  <span className="kpi-desc">
                    {statement.summary.depositCount} deposits, {statement.summary.transferInCount} transfers in
                  </span>
                </div>

                <div className="kpi-card card-debits">
                  <span className="kpi-lbl">Total Debits</span>
                  <span className="kpi-val font-mono text-danger">-{statement.summary.totalDebitsFormatted}</span>
                  <span className="kpi-desc">
                    {statement.summary.withdrawalCount} withdrawals, {statement.summary.transferOutCount} transfers out
                  </span>
                </div>

                <div className="kpi-card card-net">
                  <span className="kpi-lbl">Net Flow</span>
                  <span className={`kpi-val font-mono ${statement.summary.netChange >= 0 ? 'text-success' : 'text-danger'}`}>
                    {statement.summary.netChangeFormatted}
                  </span>
                  <span className="kpi-desc">{statement.summary.transactionCount} transactions</span>
                </div>

                <div className="kpi-card card-closing">
                  <span className="kpi-lbl">Closing Balance</span>
                  <span className="kpi-val font-mono text-primary font-bold">{statement.summary.closingBalanceFormatted}</span>
                  <span className="kpi-desc">At period close</span>
                </div>
              </section>

              {/* Transaction Ledger Table */}
              <section className="sheet-table-section">
                <div className="table-heading-row">
                  <h3 className="section-title">Transaction Ledger</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {statement.transactions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                        className="no-print"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.45rem',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          color: '#475569',
                          cursor: 'pointer'
                        }}
                        title="Toggle sort order (Newest first / Chronological)"
                      >
                        {sortOrder === 'desc' ? '↓ Newest First' : '↑ Oldest First'}
                      </button>
                    )}
                    <span className="tx-count-text">
                      Showing {statement.transactions.length} record{statement.transactions.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {statement.transactions.length === 0 ? (
                  <div className="statement-empty-table">
                    <p className="empty-title">No transactions recorded during this period</p>
                    <p className="empty-desc">
                      The account maintained an opening balance of <strong>{statement.summary.openingBalanceFormatted}</strong> and closing balance of <strong>{statement.summary.closingBalanceFormatted}</strong> without activity between {statement.period.fromFormatted} and {statement.period.toFormatted}.
                    </p>
                  </div>
                ) : (
                  <table className="statement-ledger-table">
                    <thead>
                      <tr>
                        <th style={{ width: '135px' }}>Date &amp; Time</th>
                        <th style={{ width: '175px' }}>Reference</th>
                        <th style={{ width: '125px' }}>Type</th>
                        <th>Description / Remarks</th>
                        <th style={{ textAlign: 'right', width: '110px' }}>Debit (₹)</th>
                        <th style={{ textAlign: 'right', width: '110px' }}>Credit (₹)</th>
                        <th style={{ textAlign: 'right', width: '120px' }}>Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sortOrder === 'desc' ? [...statement.transactions].reverse() : statement.transactions).map((tx) => {
                        const isDebit = tx.direction === 'DEBIT';
                        const isCredit = tx.direction === 'CREDIT';
                        return (
                          <tr key={tx.transactionId || tx.transactionRef}>
                            <td className="cell-date">
                              {new Date(tx.timestamp).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </td>
                            <td className="cell-ref font-mono">
                              {tx.transactionRef}
                            </td>
                            <td className="cell-type">
                              <span className={`statement-badge badge-${tx.type.toLowerCase().replace(/\s+/g, '-')}`}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="cell-desc">
                              <span className="desc-main">{tx.description}</span>
                            </td>
                            <td className="cell-amt text-danger text-right font-mono">
                              {isDebit ? formatINR(tx.amount) : '—'}
                            </td>
                            <td className="cell-amt text-success text-right font-mono">
                              {isCredit ? formatINR(tx.amount) : '—'}
                            </td>
                            <td className="cell-running text-right font-mono font-semibold">
                              {tx.runningBalanceFormatted}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Statement Reconciliation Footer */}
              <footer className="sheet-footer">
                <div className="footer-reconciliation-box">
                  <div className="recon-step">
                    <span>Opening: <strong>{statement.summary.openingBalanceFormatted}</strong></span>
                  </div>
                  <span className="recon-op">+</span>
                  <div className="recon-step">
                    <span>Credits: <strong className="text-success">{statement.summary.totalCreditsFormatted}</strong></span>
                  </div>
                  <span className="recon-op">-</span>
                  <div className="recon-step">
                    <span>Debits: <strong className="text-danger">{statement.summary.totalDebitsFormatted}</strong></span>
                  </div>
                  <span className="recon-op">=</span>
                  <div className="recon-step recon-final">
                    <span>Closing: <strong className="text-primary">{statement.summary.closingBalanceFormatted}</strong></span>
                  </div>
                </div>

                <div className="footer-legal">
                  <p>
                    This statement is an official computer-generated record from CORE BANK core ledger. It is verified against the authoritative database state. In case of any discrepancies, please notify the branch within 14 days of generation.
                  </p>
                  <div className="footer-stamp-row">
                    <span>CORE BANK &bull; ELECTRONICALLY VERIFIED</span>
                    <span>Document ID: STMT-{statement.account.accountNumber}-{statement.summary.transactionCount}TXN</span>
                  </div>
                </div>
              </footer>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

