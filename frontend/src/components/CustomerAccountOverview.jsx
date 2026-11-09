import { useState, useMemo, useCallback } from 'react';
import './CustomerAccountOverview.css';

/* ==============================================================================
   Zero-dependency Inline SVG Icons
   ============================================================================== */
function IconLandmark({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="21" x2="21" y2="21" />
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

function IconCheckCircle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconAlertCircle({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconAlertTriangle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconXCircle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function IconSearch({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconRefresh({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  );
}

function IconSend({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconHistory({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 14 14" />
    </svg>
  );
}

function IconCopy({ size = 13, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck({ size = 13, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconLock({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconX({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * Safe Indian Rupee currency formatter
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
 * CustomerAccountOverview Component (Feature 1 Redesign)
 *
 * Provides:
 * 1. Compact 5-metric portfolio summary (Total accounts, Active, Frozen, Inactive, Total ledger balance).
 * 2. Instant account filters (Type, Status, Monospace account search) with active counter and reset.
 * 3. Responsive CSS Grid of account cards with safe monospace numbers, non-clipped balances,
 *    clear ledger vs available distinctions, and symmetric 2-button action rows.
 * 4. Proper loading skeletons and empty/no-match states.
 */
export default function CustomerAccountOverview({
  accounts = [],
  loading = false,
  error = null,
  onRefresh,
  onViewStatement,
  onTransfer,
  currentUser = null
}) {
  // Filter state
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedAccId, setCopiedAccId] = useState(null);

  // 1. Calculate portfolio-wide summary KPIs (strictly from full accounts list; invariant to filters)
  const portfolioSummary = useMemo(() => {
    const list = Array.isArray(accounts) ? accounts : [];
    const totalCount = list.length;
    let activeCount = 0;
    let frozenCount = 0;
    let inactiveCount = 0;
    let totalLedgerBalance = 0;

    for (const acc of list) {
      const bal = Number(acc.balance) || 0;
      totalLedgerBalance += bal;
      if (acc.status === 'ACTIVE') {
        activeCount += 1;
      } else if (acc.status === 'FROZEN') {
        frozenCount += 1;
      } else if (acc.status === 'INACTIVE') {
        inactiveCount += 1;
      }
    }

    return {
      totalCount,
      activeCount,
      frozenCount,
      inactiveCount,
      totalLedgerBalance
    };
  }, [accounts]);

  // 2. Filter accounts for card grid display
  const filteredAccounts = useMemo(() => {
    const list = Array.isArray(accounts) ? accounts : [];
    return list.filter((acc) => {
      // Type filter
      if (typeFilter !== 'ALL' && acc.accountType !== typeFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && acc.status !== statusFilter) {
        return false;
      }
      // Search term filter (account number or customer name)
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const accNum = String(acc.accountNumber || '').toLowerCase();
        if (!accNum.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [accounts, typeFilter, statusFilter, searchTerm]);

  // Active filter indicator flag
  const isFilterActive = typeFilter !== 'ALL' || statusFilter !== 'ALL' || searchTerm.trim() !== '';

  // Reset filters handler
  const handleResetFilters = useCallback(() => {
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setSearchTerm('');
  }, []);

  // Copy account number handler with clipboard feedback
  const handleCopyAccount = useCallback((accNumber, accId) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(accNumber).then(() => {
        setCopiedAccId(accId);
        setTimeout(() => setCopiedAccId(null), 2000);
      }).catch(() => {
        // Fallback silent fail
      });
    }
  }, []);

  return (
    <div className="cust-overview-container" id="customer-account-overview-root">
      {/* Page Header */}
      <div className="cust-page-header">
        <div className="cust-header-text">
          <div className="cust-header-badge">
            <IconLandmark size={13} />
            <span>CORE BANK • RETAIL LEDGER</span>
          </div>
          <h2 className="cust-header-title">Account Overview</h2>
          <p className="cust-header-subtitle">
            Live account balances, status oversight, and retail banking operations.
            {currentUser?.displayName && (
              <span className="cust-holder-tag">
                Primary Holder: <strong>{currentUser.displayName}</strong>
                {currentUser?.customerId && ` • Cust #${currentUser.customerId}`}
              </span>
            )}
          </p>
        </div>

        <div className="cust-header-actions">
          {onRefresh && (
            <button
              id="cust-overview-refresh-btn"
              type="button"
              className="btn-secondary-custom cust-refresh-btn"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh ledger balances from database"
            >
              <IconRefresh size={14} className={loading ? 'cust-spin' : ''} />
              <span>{loading ? 'Refreshing...' : 'Refresh Balance'}</span>
            </button>
          )}
          {onTransfer && (
            <button
              id="cust-overview-quick-transfer-btn"
              type="button"
              className="btn-primary-custom cust-quick-transfer-btn"
              onClick={() => onTransfer(null)}
              disabled={loading || portfolioSummary.activeCount === 0}
              title={
                portfolioSummary.activeCount === 0
                  ? 'No active accounts available to initiate transfers'
                  : 'Initiate fund transfer between accounts'
              }
            >
              <IconSend size={14} />
              <span>Transfer Funds</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="cust-error-banner" role="alert">
          <IconAlertTriangle size={18} className="cust-error-icon" />
          <div className="cust-error-content">
            <strong>Unable to load accounts:</strong> {error}
          </div>
          {onRefresh && (
            <button type="button" className="cust-error-retry-btn" onClick={onRefresh}>
              Retry
            </button>
          )}
        </div>
      )}

      {/* 1. Account Summary Section (Compact 5-Metric Portfolio Overview) */}
      <section className="cust-summary-section" aria-label="Account Portfolio Summary">
        <div className="cust-summary-grid">
          {/* Total Accounts */}
          <div className="cust-summary-card">
            <div className="cust-summary-icon total">
              <IconCreditCard size={20} />
            </div>
            <div className="cust-summary-body">
              <span className="cust-summary-label">Total Accounts</span>
              {loading ? (
                <div className="cust-skeleton-text cust-skeleton-number" />
              ) : (
                <span className="cust-summary-value" id="kpi-total-accounts">
                  {portfolioSummary.totalCount}
                </span>
              )}
              <span className="cust-summary-subtext">Registered bank accounts</span>
            </div>
          </div>

          {/* Active Accounts */}
          <div className="cust-summary-card active-card">
            <div className="cust-summary-icon active">
              <IconCheckCircle size={20} />
            </div>
            <div className="cust-summary-body">
              <span className="cust-summary-label">Active Accounts</span>
              {loading ? (
                <div className="cust-skeleton-text cust-skeleton-number" />
              ) : (
                <span className="cust-summary-value text-emerald" id="kpi-active-accounts">
                  {portfolioSummary.activeCount}
                </span>
              )}
              <span className="cust-summary-subtext">Full operational status</span>
            </div>
          </div>

          {/* Frozen Accounts */}
          <div className="cust-summary-card frozen-card">
            <div className="cust-summary-icon frozen">
              <IconAlertTriangle size={20} />
            </div>
            <div className="cust-summary-body">
              <span className="cust-summary-label">Frozen Accounts</span>
              {loading ? (
                <div className="cust-skeleton-text cust-skeleton-number" />
              ) : (
                <span className="cust-summary-value text-amber" id="kpi-frozen-accounts">
                  {portfolioSummary.frozenCount}
                </span>
              )}
              <span className="cust-summary-subtext">Transfers restricted</span>
            </div>
          </div>

          {/* Inactive Accounts */}
          <div className="cust-summary-card inactive-card">
            <div className="cust-summary-icon inactive">
              <IconXCircle size={20} />
            </div>
            <div className="cust-summary-body">
              <span className="cust-summary-label">Inactive Accounts</span>
              {loading ? (
                <div className="cust-skeleton-text cust-skeleton-number" />
              ) : (
                <span className="cust-summary-value text-rose" id="kpi-inactive-accounts">
                  {portfolioSummary.inactiveCount}
                </span>
              )}
              <span className="cust-summary-subtext">Dormant or closed</span>
            </div>
          </div>

          {/* Total Ledger Balance */}
          <div className="cust-summary-card balance-card">
            <div className="cust-summary-icon balance">
              <IconLandmark size={20} />
            </div>
            <div className="cust-summary-body">
              <span className="cust-summary-label">Total Portfolio Balance</span>
              {loading ? (
                <div className="cust-skeleton-text cust-skeleton-balance" />
              ) : (
                <span className="cust-summary-value font-mono text-cyan" id="kpi-total-balance">
                  {formatINR(portfolioSummary.totalLedgerBalance)}
                </span>
              )}
              <span className="cust-summary-subtext">Combined ledger balance</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Account Filters Section */}
      <section className="cust-filter-section" aria-label="Account Filters">
        <div className="cust-filter-bar">
          {/* Search Box */}
          <div className="cust-search-wrapper">
            <IconSearch size={15} className="cust-search-icon" />
            <input
              id="cust-account-search-input"
              type="text"
              className="cust-search-input"
              placeholder="Search by account number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search by account number"
            />
            {searchTerm && (
              <button
                type="button"
                className="cust-search-clear-btn"
                onClick={() => setSearchTerm('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <IconX size={13} />
              </button>
            )}
          </div>

          {/* Type Filter Pills */}
          <div className="cust-filter-group" role="group" aria-label="Account Type Filter">
            <span className="cust-filter-group-label">Type:</span>
            <button
              type="button"
              id="filter-type-all"
              className={`cust-filter-pill ${typeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setTypeFilter('ALL')}
            >
              All Types
            </button>
            <button
              type="button"
              id="filter-type-savings"
              className={`cust-filter-pill ${typeFilter === 'SAVINGS' ? 'active' : ''}`}
              onClick={() => setTypeFilter('SAVINGS')}
            >
              Savings
            </button>
            <button
              type="button"
              id="filter-type-current"
              className={`cust-filter-pill ${typeFilter === 'CURRENT' ? 'active' : ''}`}
              onClick={() => setTypeFilter('CURRENT')}
            >
              Current
            </button>
          </div>

          {/* Status Filter Pills */}
          <div className="cust-filter-group" role="group" aria-label="Account Status Filter">
            <span className="cust-filter-group-label">Status:</span>
            <button
              type="button"
              id="filter-status-all"
              className={`cust-filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All
            </button>
            <button
              type="button"
              id="filter-status-active"
              className={`cust-filter-pill status-active ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ACTIVE')}
            >
              Active
            </button>
            <button
              type="button"
              id="filter-status-frozen"
              className={`cust-filter-pill status-frozen ${statusFilter === 'FROZEN' ? 'active' : ''}`}
              onClick={() => setStatusFilter('FROZEN')}
            >
              Frozen
            </button>
            <button
              type="button"
              id="filter-status-inactive"
              className={`cust-filter-pill status-inactive ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('INACTIVE')}
            >
              Inactive
            </button>
          </div>

          {/* Reset Filters Button */}
          {isFilterActive && (
            <button
              id="cust-reset-filters-btn"
              type="button"
              className="cust-reset-filters-btn"
              onClick={handleResetFilters}
              title="Clear all active filters"
            >
              <IconX size={13} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Filter Count Counter */}
        {!loading && accounts.length > 0 && (
          <div className="cust-filter-status-row">
            <span className="cust-filter-count-badge">
              Showing <strong>{filteredAccounts.length}</strong> of <strong>{accounts.length}</strong> {accounts.length === 1 ? 'account' : 'accounts'}
            </span>
            {isFilterActive && (
              <span className="cust-filter-active-hint">
                Filters active ({[
                  typeFilter !== 'ALL' ? `Type: ${typeFilter}` : null,
                  statusFilter !== 'ALL' ? `Status: ${statusFilter}` : null,
                  searchTerm.trim() ? `Search: "${searchTerm.trim()}"` : null
                ].filter(Boolean).join(' • ')})
              </span>
            )}
          </div>
        )}
      </section>

      {/* 3. Account Cards Grid / Skeleton / Empty States */}
      <section className="cust-cards-section" aria-label="Customer Bank Accounts">
        {loading ? (
          /* Loading Skeletons */
          <div className="cust-accounts-grid" id="cust-accounts-loading-skeleton">
            {[1, 2, 3].map((n) => (
              <div key={n} className="cust-account-card skeleton-card">
                <div className="cust-card-header">
                  <div className="cust-skeleton-pill" style={{ width: '130px' }} />
                  <div className="cust-skeleton-pill" style={{ width: '65px' }} />
                </div>
                <div className="cust-skeleton-pill" style={{ width: '180px', height: '26px', margin: '1rem 0' }} />
                <div className="cust-card-balance-block">
                  <div className="cust-skeleton-line" style={{ width: '120px' }} />
                  <div className="cust-skeleton-line" style={{ width: '160px', height: '24px', margin: '0.4rem 0' }} />
                </div>
                <div className="cust-card-actions">
                  <div className="cust-skeleton-btn" />
                  <div className="cust-skeleton-btn" />
                </div>
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          /* No Accounts Registered State */
          <div className="cust-empty-state-box" id="cust-no-accounts-box">
            <div className="cust-empty-icon-circle">
              <IconCreditCard size={36} />
            </div>
            <h3 className="cust-empty-title">No Bank Accounts Linked</h3>
            <p className="cust-empty-desc">
              Your customer profile is active, but there are no accounts registered under your profile yet.
              Please visit a local branch or contact customer support to open a savings or current account.
            </p>
            {onRefresh && (
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={onRefresh}
                style={{ marginTop: '1rem' }}
              >
                <IconRefresh size={14} />
                <span>Check Again</span>
              </button>
            )}
          </div>
        ) : filteredAccounts.length === 0 ? (
          /* No Accounts Match Filter State */
          <div className="cust-empty-state-box" id="cust-no-filter-match-box">
            <div className="cust-empty-icon-circle warning">
              <IconSearch size={32} />
            </div>
            <h3 className="cust-empty-title">No Accounts Match Your Filters</h3>
            <p className="cust-empty-desc">
              None of your {accounts.length} registered accounts match the selected criteria.
              Try adjusting your account type, status, or search terms.
            </p>
            <button
              id="cust-empty-reset-btn"
              type="button"
              className="btn-primary-custom"
              onClick={handleResetFilters}
              style={{ marginTop: '1rem', gap: '0.4rem' }}
            >
              <IconX size={14} />
              <span>Reset All Filters</span>
            </button>
          </div>
        ) : (
          /* Live Responsive Account Cards Grid */
          <div className="cust-accounts-grid" id="cust-accounts-live-grid">
            {filteredAccounts.map((acc) => {
              const isActive = acc.status === 'ACTIVE';
              const isFrozen = acc.status === 'FROZEN';
              const isInactive = acc.status === 'INACTIVE';
              const currentBalNum = Number(acc.currentBalance !== undefined ? acc.currentBalance : acc.balance) || 0;
              const formattedCurrentBalance = formatINR(currentBalNum);
              const availBalNum = acc.availableBalance !== undefined
                ? Number(acc.availableBalance) || 0
                : (isActive ? currentBalNum : 0);
              const formattedAvailableBalance = formatINR(availBalNum);
              const isCopied = copiedAccId === acc.accountId;

              // Small explanation when transactions are unavailable (Feature 2 Section 5)
              const restrictionExplanation = !isActive
                ? 'Transactions are currently unavailable for this account.'
                : null;

              // Status badge details
              const badgeClass = isActive
                ? 'badge-active'
                : isFrozen
                ? 'badge-frozen'
                : 'badge-inactive';

              const badgeLabel = isActive
                ? 'Active'
                : isFrozen
                ? 'Frozen'
                : 'Inactive';

              // Transfer tooltip
              const transferTooltip = isActive
                ? 'Transfer funds from this account'
                : isFrozen
                ? 'Transfers are unavailable while this account is frozen. Please contact your branch.'
                : 'Transfers are unavailable because this account is inactive or closed.';

              return (
                <div
                  key={acc.accountId}
                  id={`cust-account-card-${acc.accountId}`}
                  className={`cust-account-card status-${String(acc.status).toLowerCase()}`}
                >
                  {/* Card Header: Type Badge & Status */}
                  <div className="cust-card-header">
                    <div className="cust-type-badge">
                      <IconLandmark size={14} className="cust-type-icon" />
                      <span className="cust-type-text">{acc.accountType} ACCOUNT</span>
                    </div>

                    <span
                      id={`cust-status-badge-${acc.accountId}`}
                      className={`cust-status-badge ${badgeClass}`}
                      title={`Account status: ${acc.status}`}
                    >
                      <span className="cust-status-dot" />
                      <span>{badgeLabel}</span>
                    </span>
                  </div>

                  {/* Account Number with Safe Monospace Wrap and Copy Action */}
                  <div className="cust-card-number-wrapper">
                    <div className="cust-number-label">ACCOUNT NUMBER</div>
                    <div className="cust-number-row">
                      <code
                        className="cust-account-number font-mono"
                        id={`cust-acc-num-${acc.accountId}`}
                        title={acc.accountNumber}
                      >
                        {acc.accountNumber}
                      </code>
                      <button
                        type="button"
                        className={`cust-copy-btn ${isCopied ? 'copied' : ''}`}
                        onClick={() => handleCopyAccount(acc.accountNumber, acc.accountId)}
                        title={isCopied ? 'Copied to clipboard!' : 'Copy account number'}
                        aria-label="Copy account number"
                      >
                        {isCopied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        <span className="cust-copy-text">{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Dual Balance Section (Feature 2 Sections 3, 4, 5) */}
                  <div className="cust-card-balance-block">
                    {/* Primary: Current Balance */}
                    <div className="cust-balance-row primary">
                      <span className="cust-balance-label">Current Balance</span>
                      <span
                        className="cust-balance-value font-mono"
                        id={`cust-current-bal-${acc.accountId}`}
                      >
                        {formattedCurrentBalance}
                      </span>
                    </div>

                    {/* Secondary: Available Balance */}
                    <div className="cust-balance-row secondary">
                      <span className="cust-avail-label">Available Balance</span>
                      <span
                        className={`cust-avail-value font-mono ${!isActive ? 'restricted' : 'available'}`}
                        id={`cust-avail-bal-${acc.accountId}`}
                      >
                        {formattedAvailableBalance}
                      </span>
                    </div>
                  </div>

                  {/* Status Restriction Notice (Feature 2 Section 5) */}
                  {restrictionExplanation && (
                    <div
                      className={`cust-card-restriction-notice ${isFrozen ? 'notice-frozen' : isInactive ? 'notice-inactive' : 'notice-restricted'}`}
                      id={`cust-card-notice-${acc.accountId}`}
                    >
                      <IconAlertCircle size={13} className="cust-notice-icon" />
                      <span>{restrictionExplanation}</span>
                    </div>
                  )}

                  {/* Symmetric 2-Button Action Footer */}
                  <div className="cust-card-actions">
                    {/* Statement Button (Always Active) */}
                    <button
                      id={`cust-btn-statement-${acc.accountId}`}
                      type="button"
                      className="btn-secondary-custom cust-btn-action"
                      onClick={() => onViewStatement && onViewStatement(acc)}
                      title="View transaction history and generate account statement"
                    >
                      <IconHistory size={14} />
                      <span>Statement</span>
                    </button>

                    {/* Transfer Button (Active only when status is ACTIVE) */}
                    <button
                      id={`cust-btn-transfer-${acc.accountId}`}
                      type="button"
                      className={`btn-primary-custom cust-btn-action ${!isActive ? 'cust-btn-disabled' : ''}`}
                      onClick={() => isActive && onTransfer && onTransfer(acc.accountId)}
                      disabled={!isActive}
                      title={transferTooltip}
                      aria-disabled={!isActive}
                    >
                      {isActive ? <IconSend size={14} /> : <IconLock size={14} />}
                      <span>{isActive ? 'Transfer' : 'Restricted'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
