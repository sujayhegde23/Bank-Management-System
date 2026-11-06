import { useState, useEffect, useRef, useCallback } from 'react';
import { getMyActivity } from '../services/api';
import './EmployeeActivityHistory.css';

/* ==============================================================================
   Lucide-Style Inline SVG Icons
   ============================================================================== */
function IconActivity({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconCheckCircle({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconAlertTriangle({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
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

function IconRefresh({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
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

function IconChevronLeft({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* ==============================================================================
   Formatters and Action Helpers
   ============================================================================== */
function formatTimestamp(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (_) {
    return isoString;
  }
}

function formatINR(amount) {
  const num = Number(amount);
  if (isNaN(num)) return null;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(num);
}

function getActionMeta(actionType) {
  switch (actionType) {
    case 'DEPOSIT_COMPLETED':
      return { label: 'CASH DEPOSIT', className: 'action-deposit' };
    case 'DEPOSIT_FAILED':
      return { label: 'DEPOSIT FAILED', className: 'action-deactivated' };
    case 'WITHDRAWAL_COMPLETED':
      return { label: 'CASH WITHDRAWAL', className: 'action-withdrawal' };
    case 'WITHDRAWAL_FAILED':
      return { label: 'WITHDRAWAL FAILED', className: 'action-deactivated' };
    case 'TRANSFER_COMPLETED':
      return { label: 'FUND TRANSFER', className: 'action-transfer' };
    case 'TRANSFER_FAILED':
      return { label: 'TRANSFER FAILED', className: 'action-deactivated' };
    case 'ACCOUNT_CREATED':
      return { label: 'ACCOUNT CREATED', className: 'action-account' };
    case 'ACCOUNT_FROZEN':
      return { label: 'ACCOUNT FROZEN', className: 'action-frozen' };
    case 'ACCOUNT_UNFROZEN':
      return { label: 'ACCOUNT UNFROZEN', className: 'action-account' };
    case 'ACCOUNT_DEACTIVATED':
      return { label: 'ACCOUNT DEACTIVATED', className: 'action-deactivated' };
    case 'ACCOUNT_REACTIVATED':
      return { label: 'ACCOUNT REACTIVATED', className: 'action-account' };
    case 'CUSTOMER_REGISTERED':
      return { label: 'CUSTOMER REGISTERED', className: 'action-customer' };
    case 'CUSTOMER_UPDATED':
      return { label: 'CUSTOMER UPDATED', className: 'action-customer' };
    case 'USER_LOGIN':
      return { label: 'STAFF LOGIN', className: 'action-auth' };
    case 'USER_LOGOUT':
      return { label: 'STAFF LOGOUT', className: 'action-auth' };
    default:
      return {
        label: actionType ? actionType.replace(/_/g, ' ') : 'ACTION',
        className: 'action-auth'
      };
  }
}

export default function EmployeeActivityHistory({ currentUser }) {
  const isMountedRef = useRef(true);

  // Data states
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState({ totalOperations: 0, successOperations: 0, failureOperations: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [category, setCategory] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [datePreset, setDatePreset] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle Date Preset Selection
  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'all') {
      setAppliedStartDate('');
      setAppliedEndDate('');
      setCustomStartDate('');
      setCustomEndDate('');
    } else if (preset === 'today') {
      setAppliedStartDate(todayStr);
      setAppliedEndDate(todayStr);
    } else if (preset === '7d') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setAppliedStartDate(past.toISOString().split('T')[0]);
      setAppliedEndDate(todayStr);
    } else if (preset === '30d') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setAppliedStartDate(past.toISOString().split('T')[0]);
      setAppliedEndDate(todayStr);
    }
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleApplyCustomDates = () => {
    if (!customStartDate || !customEndDate) return;
    if (customStartDate > customEndDate) {
      alert('Start date cannot be after end date');
      return;
    }
    setAppliedStartDate(customStartDate);
    setAppliedEndDate(customEndDate);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Fetch activities from API
  const fetchActivities = useCallback(async (pageToLoad = pagination.page, limitToLoad = pagination.limit) => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: pageToLoad,
        limit: limitToLoad
      };

      if (category && category !== 'ALL') params.category = category;
      if (resultFilter && resultFilter !== 'ALL') params.result = resultFilter;
      if (appliedStartDate) params.startDate = appliedStartDate;
      if (appliedEndDate) params.endDate = appliedEndDate;
      if (debouncedSearch && debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await getMyActivity(params);

      if (!isMountedRef.current) return;

      if (res && res.success && res.data) {
        setActivities(res.data.items || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      } else {
        throw new Error(res?.message || 'Failed to load activity records');
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching employee activity history:', err);
        setError(err.message || 'Could not load activity history. Please check your network connection.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [category, resultFilter, appliedStartDate, appliedEndDate, debouncedSearch, pagination.page, pagination.limit]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchActivities(pagination.page, pagination.limit);
    return () => {
      isMountedRef.current = false;
    };
  }, [category, resultFilter, appliedStartDate, appliedEndDate, debouncedSearch, pagination.page, pagination.limit, fetchActivities]);

  const handleResetFilters = () => {
    setCategory('ALL');
    setResultFilter('ALL');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setSearchTerm('');
    setDebouncedSearch('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = category !== 'ALL' || resultFilter !== 'ALL' || datePreset !== 'all' || debouncedSearch.trim().length > 0;

  return (
    <div className="emp-activity-container">
      {/* Institutional Page Header */}
      <div className="emp-activity-header">
        <div>
          <div className="emp-activity-badge">
            <IconActivity size={13} />
            <span>PERSONAL OPERATIONAL LEDGER</span>
          </div>
          <h1 className="emp-activity-title">My Activity History</h1>
          <p className="emp-activity-subtitle">
            Authoritative, read-only audit log of banking operations and customer transactions processed under your staff credentials.
          </p>
        </div>
        <div className="emp-activity-header-actions">
          <div className="staff-id-pill" title="Your verified employee session identifier">
            <span>Staff: <strong>{currentUser?.displayName || currentUser?.username}</strong></span>
            <span style={{ color: '#64748b' }}>&bull;</span>
            <span>ID #{currentUser?.employeeId || currentUser?.userId || '1'}</span>
          </div>
          <button
            type="button"
            className="btn-secondary-custom"
            onClick={() => fetchActivities(pagination.page, pagination.limit)}
            disabled={loading}
            title="Refresh activity logs"
          >
            <IconRefresh size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="emp-activity-stats-grid">
        <div className="emp-activity-stat-card">
          <div className="stat-icon-box total">
            <IconActivity size={20} />
          </div>
          <div className="stat-meta">
            <span className="stat-meta-label">Total Lifetime Operations</span>
            <span className="stat-meta-val">{summary.totalOperations}</span>
          </div>
        </div>

        <div className="emp-activity-stat-card">
          <div className="stat-icon-box success">
            <IconCheckCircle size={20} />
          </div>
          <div className="stat-meta">
            <span className="stat-meta-label">Successful Operations</span>
            <span className="stat-meta-val" style={{ color: '#34d399' }}>{summary.successOperations}</span>
          </div>
        </div>

        <div className="emp-activity-stat-card">
          <div className="stat-icon-box failure">
            <IconAlertTriangle size={20} />
          </div>
          <div className="stat-meta">
            <span className="stat-meta-label">Flagged / Failed Attempts</span>
            <span className="stat-meta-val" style={{ color: '#f87171' }}>{summary.failureOperations}</span>
          </div>
        </div>

        <div className="emp-activity-stat-card">
          <div className="stat-icon-box filtered">
            <IconSearch size={20} />
          </div>
          <div className="stat-meta">
            <span className="stat-meta-label">Matching Filter Count</span>
            <span className="stat-meta-val" style={{ color: '#c084fc' }}>{pagination.total}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="emp-activity-filter-card">
        {/* Category Pills & Search */}
        <div className="filter-row-top">
          <div className="category-pills">
            {[
              { id: 'ALL', label: 'All Activities' },
              { id: 'ACCOUNT', label: 'Account Ops' },
              { id: 'CUSTOMER', label: 'Customer Ops' },
              { id: 'DEPOSIT', label: 'Cash Deposits' },
              { id: 'WITHDRAWAL', label: 'Cash Withdrawals' },
              { id: 'TRANSFER', label: 'Fund Transfers' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`category-pill ${category === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setCategory(tab.id);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="search-box-wrapper">
            <IconSearch size={15} className="search-icon-left" />
            <input
              type="text"
              className="search-input-custom"
              placeholder="Search description, reference, target..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                <IconX size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Date presets, Result filter & Reset */}
        <div className="filter-row-bottom">
          <div className="filter-group">
            <span className="filter-label-inline">Period:</span>
            <select
              className="filter-select-sm"
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
            >
              <option value="all">All Time History</option>
              <option value="today">Today Only</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range...</option>
            </select>

            {datePreset === 'custom' && (
              <div className="custom-date-inputs">
                <input
                  type="date"
                  className="date-input-sm"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  placeholder="From"
                />
                <span className="date-separator">to</span>
                <input
                  type="date"
                  className="date-input-sm"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  placeholder="To"
                />
                <button
                  type="button"
                  className="btn-filter-apply"
                  onClick={handleApplyCustomDates}
                >
                  Apply
                </button>
              </div>
            )}
          </div>

          <div className="filter-group">
            <span className="filter-label-inline">Result:</span>
            <select
              className="filter-select-sm"
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">Success Only</option>
              <option value="FAILURE">Failed Only</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-filter-reset"
                onClick={handleResetFilters}
                title="Reset all filters"
              >
                <IconX size={13} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Activity Table Card */}
      <div className="emp-activity-table-card">
        {error ? (
          <div className="emp-activity-empty">
            <div className="empty-icon-wrapper" style={{ color: '#f87171' }}>
              <IconAlertTriangle size={28} />
            </div>
            <h3>Unable to Load Activity History</h3>
            <p>{error}</p>
            <button
              type="button"
              className="btn-secondary-custom"
              onClick={() => fetchActivities(pagination.page, pagination.limit)}
            >
              <IconRefresh size={14} />
              <span>Retry Request</span>
            </button>
          </div>
        ) : loading ? (
          <div style={{ padding: '1.5rem' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="skeleton-row" style={{ marginBottom: '0.75rem', borderRadius: '4px' }} />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="emp-activity-empty">
            <div className="empty-icon-wrapper">
              <IconActivity size={28} />
            </div>
            <h3>No Activity Records Found</h3>
            <p>
              {hasActiveFilters
                ? 'No banking operations matched your selected filter criteria. Try resetting your filters to see historical activity.'
                : 'You have not performed any audited banking operations under your staff credentials yet.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={handleResetFilters}
              >
                Reset Filter Criteria
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="emp-activity-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Date &amp; Time</th>
                  <th style={{ width: '150px' }}>Action</th>
                  <th style={{ width: '110px' }}>Target Entity</th>
                  <th style={{ width: '110px' }}>Reference</th>
                  <th style={{ width: '95px' }}>Result</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((item) => {
                  const actMeta = getActionMeta(item.actionType);
                  const isSuccess = item.result === 'SUCCESS';
                  const formattedAmount = item.metadata?.amount ? formatINR(item.metadata.amount) : null;

                  return (
                    <tr key={item.auditId}>
                      <td style={{ whiteSpace: 'nowrap', color: '#94a3b8', fontSize: '0.8rem' }}>
                        {formatTimestamp(item.createdAt)}
                      </td>
                      <td>
                        <span className={`action-badge ${actMeta.className}`}>
                          {actMeta.label}
                        </span>
                      </td>
                      <td>
                        <span className="entity-badge">
                          {item.targetEntityType || 'SYSTEM'}
                        </span>
                      </td>
                      <td>
                        {item.targetEntityId ? (
                          <span className="entity-id-code">
                            {item.targetEntityType === 'ACCOUNT' ? `ACC #${item.targetEntityId}` : `#${item.targetEntityId}`}
                          </span>
                        ) : (
                          <span style={{ color: '#64748b' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`result-badge ${isSuccess ? 'success' : 'failure'}`}>
                          {isSuccess ? <IconCheckCircle size={12} /> : <IconAlertTriangle size={12} />}
                          <span>{item.result}</span>
                        </span>
                      </td>
                      <td className="desc-cell">
                        <div>{item.description}</div>
                        {item.metadata && (
                          <div className="meta-tags-container">
                            {formattedAmount && (
                              <span className="meta-pill" style={{ color: '#34d399' }}>
                                Amount: {formattedAmount}
                              </span>
                            )}
                            {item.metadata.accountNumber && (
                              <span className="meta-pill">
                                A/C: {item.metadata.accountNumber}
                              </span>
                            )}
                            {item.metadata.transactionRef && (
                              <span className="meta-pill">
                                Ref: {item.metadata.transactionRef}
                              </span>
                            )}
                            {item.metadata.newStatus && (
                              <span className="meta-pill">
                                Status: {item.metadata.newStatus}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && activities.length > 0 && (
          <div className="emp-activity-pagination">
            <div>
              Showing <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> to{' '}
              <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{' '}
              <strong>{pagination.total}</strong> operations
            </div>

            <div className="pagination-controls">
              <button
                type="button"
                className="page-btn"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                title="Previous page"
              >
                <IconChevronLeft size={14} />
              </button>

              <span style={{ padding: '0 0.5rem', fontWeight: 600, color: '#f8fafc' }}>
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="page-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                title="Next page"
              >
                <IconChevronRight size={14} />
              </button>
            </div>

            <div className="limit-select-wrapper">
              <span>Show per page:</span>
              <select
                className="filter-select-sm"
                value={pagination.limit}
                onChange={(e) => {
                  const newLimit = parseInt(e.target.value, 10);
                  setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
                }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

