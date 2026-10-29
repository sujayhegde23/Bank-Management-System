import React, { useState, useEffect, useCallback } from 'react';
import { getRecentTransactions } from '../services/api';

/**
 * Icons (Inline SVG for zero external icon dependency issues)
 */
function IconCreditCard({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
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

function IconArrowDownCircle({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 12 16 16 12" />
      <line x1="12" x2="12" y1="8" y2="16" />
    </svg>
  );
}

function IconArrowUpCircle({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 12 12 8 8 12" />
      <line x1="12" x2="12" y1="16" y2="8" />
    </svg>
  );
}

function IconArrowRightLeft({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </svg>
  );
}

/**
 * Format ISO datetime string into human readable Indian Standard Time representation
 */
function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return isoString;
  }
}

/**
 * Format currency amount into INR (₹)
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
 * TransactionsView Component
 * Renders the bank-wide transaction audit ledger for Employees and Administrators (FR-21, NFR-10).
 */
export default function TransactionsView() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [typeFilter, setTypeFilter] = useState('');
  const [accountNumberQuery, setAccountNumberQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRecentTransactions({
        page,
        limit: pageSize,
        type: typeFilter || undefined,
        accountNumber: accountNumberQuery.trim() || undefined,
        search: searchQuery.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });

      const items = res?.transactions || res?.items || [];
      setTransactions(items);
      setTotalItems(res?.pagination?.total || res?.total || res?.totalItems || items.length);
      setTotalPages(res?.pagination?.totalPages || res?.totalPages || Math.ceil((res?.total || items.length) / pageSize) || 1);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError(err?.message || 'Failed to load transaction ledger. Please check network connection.');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, accountNumberQuery, searchQuery, startDate, endDate]);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await getRecentTransactions({
          page,
          limit: pageSize,
          type: typeFilter || undefined,
          accountNumber: accountNumberQuery.trim() || undefined,
          search: searchQuery.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        });
        if (!ignore) {
          const items = res?.transactions || res?.items || [];
          setTransactions(items);
          setTotalItems(res?.pagination?.total || res?.total || res?.totalItems || items.length);
          setTotalPages(res?.pagination?.totalPages || res?.totalPages || Math.ceil((res?.total || items.length) / pageSize) || 1);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to fetch transactions:', err);
          setError(err?.message || 'Failed to load transaction ledger. Please check network connection.');
          setTransactions([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, typeFilter, accountNumberQuery, searchQuery, startDate, endDate]);

  const handleResetFilters = () => {
    setTypeFilter('');
    setAccountNumberQuery('');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="accounts-management-view" style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* Header Banner */}
      <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '0.55rem', borderRadius: '8px', color: '#60a5fa' }}>
              <IconCreditCard size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
                Bank Transaction Ledger
              </h2>
              <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                Immutable audit trail of counter cash deposits, withdrawals, and customer transfers across accounts (FR-21, NFR-10).
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn-secondary-custom"
            onClick={fetchTransactions}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem' }}
          >
            <IconRefresh size={14} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          {/* Account Number Search */}
          <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Account Number
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="e.g. ACC-SAV-1001"
                value={accountNumberQuery}
                onChange={(e) => {
                  setAccountNumberQuery(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  background: '#090e1a',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.825rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Search Reference / Remarks */}
          <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Search Ref / Note
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="TXN-..., slip #, remark"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  background: '#090e1a',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.825rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Start Date */}
          <div style={{ flex: '0 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                background: '#090e1a',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '0.525rem 0.65rem',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>

          {/* End Date */}
          <div style={{ flex: '0 1 150px' }}>
            <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                background: '#090e1a',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#f8fafc',
                padding: '0.525rem 0.65rem',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Reset button */}
          <div style={{ alignSelf: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary-custom"
              onClick={handleResetFilters}
              style={{ fontSize: '0.8rem', padding: '0.55rem 0.9rem' }}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Transaction Type Filter Tabs */}
        <div style={{ marginTop: '0.9rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: '0.35rem' }}>
            Type:
          </span>
          {[
            { label: 'All Transactions', val: '' },
            { label: 'Deposits', val: 'DEPOSIT' },
            { label: 'Withdrawals', val: 'WITHDRAWAL' },
            { label: 'Transfers', val: 'TRANSFER' }
          ].map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => {
                setTypeFilter(tab.val);
                setPage(1);
              }}
              style={{
                background: typeFilter === tab.val ? '#2563eb' : '#1e293b',
                color: typeFilter === tab.val ? '#ffffff' : '#94a3b8',
                border: '1px solid',
                borderColor: typeFilter === tab.val ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
                padding: '0.35rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}

          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#94a3b8' }}>
            Showing <strong>{transactions.length}</strong> of <strong>{totalItems}</strong> entries
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem', color: '#f87171', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Transactions Table Card */}
      <div style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#94a3b8' }}>
            <IconRefresh size={24} className="spinning" style={{ marginBottom: '0.75rem', opacity: 0.7 }} />
            <div>Loading bank transaction records...</div>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>No Transactions Found</div>
            <div style={{ fontSize: '0.85rem' }}>No transaction records match the current search filters or date range.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="emp-table-custom" style={{ width: '100%', fontSize: '0.825rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.85rem 1rem' }}>Date &amp; Time</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Source Account</th>
                  <th>Destination Account</th>
                  <th>Performed By</th>
                  <th>Audit Remarks</th>
                  <th style={{ textAlign: 'right', paddingRight: '1rem' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const typeUpper = String(tx.type || '').toUpperCase();
                  const isDeposit = typeUpper === 'DEPOSIT';
                  const isWithdrawal = typeUpper === 'WITHDRAWAL';
                  const isTransfer = typeUpper === 'TRANSFER';

                  return (
                    <tr key={tx.transactionId || tx.transactionRef}>
                      <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                        {formatDateTime(tx.createdAt || tx.timestamp)}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#60a5fa', fontWeight: 600 }}>
                          {tx.transactionRef || tx.transactionReference || `TXN-#${tx.transactionId}`}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            background: isDeposit
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isWithdrawal
                              ? 'rgba(56, 189, 248, 0.15)'
                              : 'rgba(168, 85, 247, 0.15)',
                            color: isDeposit ? '#34d399' : isWithdrawal ? '#38bdf8' : '#c084fc',
                            border: `1px solid ${isDeposit ? 'rgba(16, 185, 129, 0.3)' : isWithdrawal ? 'rgba(56, 189, 248, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`
                          }}
                        >
                          {isDeposit && <IconArrowDownCircle size={12} />}
                          {isWithdrawal && <IconArrowUpCircle size={12} />}
                          {isTransfer && <IconArrowRightLeft size={12} />}
                          {typeUpper}
                        </span>
                      </td>
                      <td>
                        {tx.sourceAccountNumber ? (
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#e2e8f0', fontWeight: 600 }}>
                            {tx.sourceAccountNumber}
                          </span>
                        ) : (
                          <span style={{ color: '#64748b' }}>— (Counter Deposit)</span>
                        )}
                      </td>
                      <td>
                        {tx.destinationAccountNumber ? (
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#e2e8f0', fontWeight: 600 }}>
                            {tx.destinationAccountNumber}
                          </span>
                        ) : (
                          <span style={{ color: '#64748b' }}>— (Cash Out)</span>
                        )}
                      </td>
                      <td>
                        <span style={{ color: '#94a3b8' }}>{tx.performedByUsername || `User #${tx.performedByUserId || 1}`}</span>
                      </td>
                      <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8' }}>
                        {tx.remarks || '—'}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
                        {formatINR(tx.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: '#090e1a', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>Page {page} of {totalPages}</span>
            <span>&bull;</span>
            <span>Total {totalItems} transactions</span>
            <span>&bull;</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  background: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '4px',
                  padding: '0.2rem 0.4rem',
                  fontSize: '0.75rem',
                  outline: 'none'
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondary-custom"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              &larr; Previous
            </button>
            <button
              type="button"
              className="btn-secondary-custom"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
