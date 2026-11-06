import { useState, useEffect, useCallback } from 'react';
import { getAuditLogs, getAuditLogFilters } from '../services/api';
import './AuditLogs.css';

/* ==============================================================================
   Lucide-Style Inline SVG Icons
   ============================================================================== */
function IconShieldAlert({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
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

function IconFilter({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconX({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function IconCopy({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function formatAuditTimestamp(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return String(isoString);
  }
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ actionTypes: [], targetEntityTypes: [] });

  // Filters state
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const [targetEntityType, setTargetEntityType] = useState('');
  const [result, setResult] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });

  // Modal inspection state
  const [inspectItem, setInspectItem] = useState(null);
  const [copied, setCopied] = useState(false);

  // Fetch filter dropdown options once on mount
  useEffect(() => {
    let isMounted = true;
    getAuditLogFilters()
      .then((data) => {
        if (isMounted && data) {
          setFilterOptions({
            actionTypes: data.actionTypes || [],
            targetEntityTypes: data.targetEntityTypes || []
          });
        }
      })
      .catch((err) => {
        console.warn('Failed to load filter options:', err.message);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadLogs() {
      setLoading(true);
      setError(null);
      try {
        const res = await getAuditLogs({
          page,
          limit,
          actionType: actionType || undefined,
          targetEntityType: targetEntityType || undefined,
          result: result || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: search.trim() || undefined
        });

        if (!ignore) {
          setLogs(res?.items || []);
          setPagination(
            res?.pagination || {
              total: 0,
              page,
              limit,
              totalPages: 1
            }
          );
        }
      } catch (err) {
        if (!ignore) {
          console.error('Error fetching audit logs:', err);
          setError(err.message || 'Failed to retrieve system audit logs.');
          setLogs([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadLogs();

    return () => {
      ignore = true;
    };
  }, [page, limit, actionType, targetEntityType, result, startDate, endDate, search]);

  const fetchAuditLogs = useCallback(() => {
    setLoading(true);
    setError(null);
    getAuditLogs({
      page,
      limit,
      actionType: actionType || undefined,
      targetEntityType: targetEntityType || undefined,
      result: result || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: search.trim() || undefined
    })
      .then((res) => {
        setLogs(res?.items || []);
        setPagination(
          res?.pagination || {
            total: 0,
            page,
            limit,
            totalPages: 1
          }
        );
      })
      .catch((err) => {
        console.error('Error refreshing audit logs:', err);
        setError(err.message || 'Failed to retrieve system audit logs.');
        setLogs([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, limit, actionType, targetEntityType, result, startDate, endDate, search]);

  const handleResetFilters = () => {
    setSearch('');
    setActionType('');
    setTargetEntityType('');
    setResult('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleCopyJson = () => {
    if (!inspectItem) return;
    const jsonStr = JSON.stringify(
      {
        auditId: inspectItem.auditId,
        timestamp: inspectItem.createdAt,
        actor: inspectItem.actor,
        actionType: inspectItem.actionType,
        targetEntity: {
          type: inspectItem.targetEntityType,
          id: inspectItem.targetEntityId
        },
        result: inspectItem.result,
        description: inspectItem.description,
        metadata: inspectItem.metadata
      },
      null,
      2
    );
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getActionBadgeClass = (actType) => {
    if (!actType) return 'badge-neutral';
    if (actType.includes('DELETE') || actType.includes('DEACTIVATE') || actType.includes('FROZEN') || actType.includes('FAILED')) {
      return 'badge-danger';
    }
    if (actType.includes('CREATE') || actType.includes('REGISTER') || actType.includes('ACTIVE') || actType.includes('LOGIN')) {
      return 'badge-success';
    }
    if (actType.includes('TRANSFER') || actType.includes('DEPOSIT') || actType.includes('WITHDRAWAL')) {
      return 'badge-info';
    }
    return 'badge-warning';
  };

  return (
    <div className="audit-logs-container">
      {/* Header */}
      <div className="audit-logs-header">
        <div>
          <div className="audit-header-badge">
            <IconShieldAlert size={14} />
            <span>Centralized Security & Governance</span>
          </div>
          <h1>System Audit Logs</h1>
          <p className="audit-subtitle">
            Immutable administrative oversight trail tracking authenticated operations, employee lifecycle actions, customer management, and banking activities.
          </p>
        </div>
        <div className="audit-header-actions">
          <button
            type="button"
            className="audit-btn audit-btn-secondary"
            onClick={fetchAuditLogs}
            disabled={loading}
            title="Refresh current view"
          >
            <IconRefresh size={16} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="audit-summary-cards">
        <div className="audit-card">
          <span className="audit-card-label">Total Logged Events</span>
          <span className="audit-card-value">{pagination.total.toLocaleString()}</span>
          <span className="audit-card-sub">All system activities recorded</span>
        </div>
        <div className="audit-card">
          <span className="audit-card-label">Current Page Count</span>
          <span className="audit-card-value">{logs.length}</span>
          <span className="audit-card-sub">Records displayed below</span>
        </div>
        <div className="audit-card">
          <span className="audit-card-label">Successful Actions</span>
          <span className="audit-card-value text-success">
            {logs.filter((l) => l.result === 'SUCCESS').length}
          </span>
          <span className="audit-card-sub">In current result set</span>
        </div>
        <div className="audit-card">
          <span className="audit-card-label">Failed / Flagged Events</span>
          <span className="audit-card-value text-danger">
            {logs.filter((l) => l.result === 'FAILURE').length}
          </span>
          <span className="audit-card-sub">In current result set</span>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="audit-filters-bar">
        <div className="audit-filters-row">
          {/* Keyword Search */}
          <div className="audit-filter-group search-group">
            <div className="search-input-wrapper">
              <IconSearch size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search actor, description, reference, entity ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="audit-search-input"
              />
              {search && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Action Type Filter */}
          <div className="audit-filter-group">
            <select
              value={actionType}
              onChange={(e) => {
                setActionType(e.target.value);
                setPage(1);
              }}
              className="audit-select"
            >
              <option value="">All Action Types</option>
              {filterOptions.actionTypes.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Target Entity Type Filter */}
          <div className="audit-filter-group">
            <select
              value={targetEntityType}
              onChange={(e) => {
                setTargetEntityType(e.target.value);
                setPage(1);
              }}
              className="audit-select"
            >
              <option value="">All Entity Types</option>
              {filterOptions.targetEntityTypes.map((tgt) => (
                <option key={tgt} value={tgt}>
                  {tgt}
                </option>
              ))}
            </select>
          </div>

          {/* Result Outcome Filter */}
          <div className="audit-filter-group">
            <select
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                setPage(1);
              }}
              className="audit-select"
            >
              <option value="">All Outcomes</option>
              <option value="SUCCESS">Success Only</option>
              <option value="FAILURE">Failure Only</option>
            </select>
          </div>
        </div>

        {/* Date Filter Row */}
        <div className="audit-filters-row date-row">
          <div className="date-input-group">
            <span className="date-label">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="audit-date-input"
            />
          </div>

          <div className="date-input-group">
            <span className="date-label">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="audit-date-input"
            />
          </div>

          {(search || actionType || targetEntityType || result || startDate || endDate) && (
            <button
              type="button"
              className="audit-btn-link reset-btn"
              onClick={handleResetFilters}
            >
              <IconX size={14} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="audit-alert audit-alert-danger">
          <IconAlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <div className="audit-table-wrapper">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action Type</th>
              <th>Target Entity</th>
              <th>Outcome</th>
              <th>Description</th>
              <th className="text-right">Inspection</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-8">
                  <div className="table-spinner-wrapper">
                    <IconRefresh size={22} className="spinning" />
                    <span>Loading audit records...</span>
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-8 text-muted">
                  <div className="empty-state">
                    <IconFilter size={32} className="text-muted mb-2" />
                    <p className="font-medium text-lg">No audit events found</p>
                    <p className="text-sm">Try adjusting your search criteria or resetting filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((item) => (
                <tr key={item.auditId}>
                  <td className="timestamp-cell">
                    <span className="timestamp-text">{formatAuditTimestamp(item.createdAt)}</span>
                  </td>
                  <td className="actor-cell">
                    <div className="actor-info">
                      <span className="actor-name">{item.actor?.name || item.actor?.username || 'System'}</span>
                      <span className={`actor-role-badge role-${(item.actor?.role || 'SYSTEM').toLowerCase()}`}>
                        {item.actor?.role || 'SYSTEM'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`action-badge ${getActionBadgeClass(item.actionType)}`}>
                      {item.actionType}
                    </span>
                  </td>
                  <td>
                    {item.targetEntityType ? (
                      <span className="target-pill">
                        <strong className="target-type">{item.targetEntityType}</strong>
                        {item.targetEntityId && <span className="target-id">#{item.targetEntityId}</span>}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {item.result === 'SUCCESS' ? (
                      <span className="result-badge success">
                        <IconCheckCircle size={12} />
                        <span>SUCCESS</span>
                      </span>
                    ) : (
                      <span className="result-badge failure">
                        <IconAlertTriangle size={12} />
                        <span>FAILURE</span>
                      </span>
                    )}
                  </td>
                  <td className="desc-cell" title={item.description}>
                    <span className="desc-text">{item.description}</span>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="audit-btn audit-btn-small"
                      onClick={() => setInspectItem(item)}
                    >
                      <IconInfo size={14} />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="audit-pagination">
        <div className="pagination-info">
          Showing{' '}
          <strong>
            {logs.length > 0 ? (page - 1) * limit + 1 : 0}
          </strong>{' '}
          to{' '}
          <strong>
            {Math.min(page * limit, pagination.total)}
          </strong>{' '}
          of <strong>{pagination.total.toLocaleString()}</strong> events
        </div>

        <div className="pagination-controls">
          <div className="page-size-selector">
            <span>Show:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="limit-select"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="pagination-buttons">
            <button
              type="button"
              className="page-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage(1)}
              title="First Page"
            >
              &laquo;
            </button>
            <button
              type="button"
              className="page-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Previous Page"
            >
              &lsaquo; Prev
            </button>
            <span className="page-indicator">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              className="page-btn"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              title="Next Page"
            >
              Next &rsaquo;
            </button>
            <button
              type="button"
              className="page-btn"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage(pagination.totalPages)}
              title="Last Page"
            >
              &raquo;
            </button>
          </div>
        </div>
      </div>

      {/* Inspection Modal */}
      {inspectItem && (
        <div className="audit-modal-backdrop" onClick={() => setInspectItem(null)}>
          <div className="audit-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="audit-modal-header">
              <div className="modal-title-group">
                <IconShieldAlert size={18} className="modal-title-icon" />
                <h3>Audit Event #{inspectItem.auditId}</h3>
                <span className={`result-badge ${inspectItem.result === 'SUCCESS' ? 'success' : 'failure'}`}>
                  {inspectItem.result}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setInspectItem(null)}
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="audit-modal-body">
              {/* Event Attributes Grid */}
              <div className="modal-attr-grid">
                <div className="attr-item">
                  <span className="attr-label">Timestamp</span>
                  <span className="attr-value">{formatAuditTimestamp(inspectItem.createdAt)}</span>
                </div>
                <div className="attr-item">
                  <span className="attr-label">Action Category</span>
                  <span className="attr-value">
                    <span className={`action-badge ${getActionBadgeClass(inspectItem.actionType)}`}>
                      {inspectItem.actionType}
                    </span>
                  </span>
                </div>
                <div className="attr-item">
                  <span className="attr-label">Actor</span>
                  <span className="attr-value">
                    {inspectItem.actor?.name || inspectItem.actor?.username || 'System'}
                    {inspectItem.actor?.role && ` (${inspectItem.actor.role})`}
                  </span>
                </div>
                <div className="attr-item">
                  <span className="attr-label">Target Entity</span>
                  <span className="attr-value">
                    {inspectItem.targetEntityType || 'N/A'}{' '}
                    {inspectItem.targetEntityId ? `(#${inspectItem.targetEntityId})` : ''}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="modal-section">
                <h4>Description</h4>
                <p className="modal-desc">{inspectItem.description}</p>
              </div>

              {/* Metadata JSON Viewer */}
              <div className="modal-section">
                <div className="meta-section-header">
                  <h4>Event Context Metadata</h4>
                  <button
                    type="button"
                    className="copy-json-btn"
                    onClick={handleCopyJson}
                  >
                    <IconCopy size={13} />
                    <span>{copied ? 'Copied!' : 'Copy Context'}</span>
                  </button>
                </div>
                <pre className="modal-json-pre">
                  <code>
                    {inspectItem.metadata
                      ? JSON.stringify(inspectItem.metadata, null, 2)
                      : '// No additional metadata payload recorded for this event.'}
                  </code>
                </pre>
              </div>
            </div>

            <div className="audit-modal-footer">
              <span className="modal-security-note">
                Immutable audit trail record. Passwords, secrets, and session hashes are strictly omitted.
              </span>
              <button
                type="button"
                className="audit-btn audit-btn-secondary"
                onClick={() => setInspectItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
