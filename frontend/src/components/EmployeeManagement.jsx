import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus
} from '../services/api';
import './EmployeeManagement.css';

/**
 * Common phone format validation regex matching backend requirements.
 * 5 to 20 characters containing digits, spaces, hyphens, plus, parentheses, dots.
 */
const PHONE_REGEX = /^[\d\s+\-().]{5,20}$/;

/**
 * ==============================================================================
 * Employee Management Component (Admin-Only)
 * ==============================================================================
 * Allows Administrators to:
 * - List all employee records with operational status and credentials metadata
 * - Provision new employee accounts (strictly EMPLOYEE role, salted bcrypt)
 * - Update permitted employee contact information (fullName, email, phone)
 * - Activate / Deactivate employee accounts with instant session revocation
 * ==============================================================================
 */
export default function EmployeeManagement({ currentUser }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreatePanel, setShowCreatePanel] = useState(true);

  // New employee form state
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    password: ''
  });

  // Edit employee modal state
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: ''
  });

  // Status toggle confirmation dialog
  const [statusDialog, setStatusDialog] = useState(null);

  // Lifecycle and accessibility refs
  const isMountedRef = useRef(true);
  const activeRequestIdRef = useRef(0);
  const triggerElementRef = useRef(null);
  const editNameInputRef = useRef(null);
  const statusConfirmBtnRef = useRef(null);
  const editModalRef = useRef(null);
  const statusModalRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch employee list from backend API.
   * Handles component cleanup, request racing, and error propagation.
   */
  const loadEmployees = useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const list = await getEmployees();
      if (!isMountedRef.current || requestId !== activeRequestIdRef.current) {
        return list;
      }
      setEmployees(Array.isArray(list) ? list : []);
      return list;
    } catch (err) {
      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        setError(err.message || 'Failed to load employees list.');
      }
      throw err;
    } finally {
      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial data load when mounted for an Admin user
  useEffect(() => {
    let ignore = false;
    if (currentUser?.role === 'ADMIN') {
      // Defer to microtask to prevent synchronous setState within effect body
      Promise.resolve().then(() => {
        if (!ignore && isMountedRef.current) {
          loadEmployees().catch(() => {
            // Error is captured in component state by loadEmployees
          });
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [currentUser, loadEmployees]);

  // Derived metrics
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === 'ACTIVE').length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [employees]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(
      (e) =>
        e.fullName?.toLowerCase().includes(q) ||
        e.username?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.phone?.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // Handle new employee form input
  const handleCreateInputChange = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  // Submit create employee
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side validations conforming to backend & database constraints
    if (!createForm.fullName.trim()) {
      setError('Employee full name is required.');
      return;
    }
    if (!createForm.email.trim() || !/\S+@\S+\.\S+/.test(createForm.email.trim())) {
      setError('A valid employee email address is required.');
      return;
    }
    if (!createForm.phone.trim()) {
      setError('Employee phone number is required.');
      return;
    }
    if (!PHONE_REGEX.test(createForm.phone.trim())) {
      setError('Phone number must be between 5 and 20 characters and contain valid digits/symbols.');
      return;
    }
    if (!createForm.username.trim() || createForm.username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!createForm.password || createForm.password.length < 8) {
      setError('Initial password must be at least 8 characters long.');
      return;
    }

    setActionLoading(true);
    let created = null;

    try {
      created = await createEmployee({
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim().toLowerCase(),
        phone: createForm.phone.trim(),
        username: createForm.username.trim().toLowerCase(),
        password: createForm.password
      });

      setCreateForm({
        fullName: '',
        email: '',
        phone: '',
        username: '',
        password: ''
      });
    } catch (err) {
      if (err.code === 'VAL_002') {
        setError(`Username "${createForm.username}" is already taken. Please choose another username.`);
      } else {
        setError(err.message || 'Failed to create employee account.');
      }
      setActionLoading(false);
      return;
    }

    // Provisioning succeeded: refresh listing and provide clear mutation feedback
    try {
      await loadEmployees();
      setSuccess(`Employee account for "${created.fullName}" (username: ${created.username}) created successfully.`);
    } catch (refreshErr) {
      setError(null);
      setSuccess(
        `Employee account for "${created.fullName}" was created successfully, but refreshing the employee list failed (${refreshErr.message || 'network error'}). Please click "↻ Refresh List".`
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Open edit modal and track triggering element for focus return
  const handleOpenEdit = (emp, e) => {
    triggerElementRef.current = e?.currentTarget || document.activeElement;
    setEditingEmployee(emp);
    setEditForm({
      fullName: emp.fullName || '',
      email: emp.email || '',
      phone: emp.phone || ''
    });
    setError(null);
  };

  // Close edit modal and restore focus
  const handleCloseEdit = useCallback(() => {
    setEditingEmployee(null);
    setEditForm({ fullName: '', email: '', phone: '' });
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  }, []);

  // Save edit changes
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setError(null);
    setSuccess(null);

    if (!editForm.fullName.trim()) {
      setError('Full name cannot be empty.');
      return;
    }
    if (!editForm.email.trim() || !/\S+@\S+\.\S+/.test(editForm.email.trim())) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!editForm.phone.trim()) {
      setError('Phone number cannot be empty.');
      return;
    }
    if (!PHONE_REGEX.test(editForm.phone.trim())) {
      setError('Phone number must be between 5 and 20 characters and contain valid digits/symbols.');
      return;
    }

    setActionLoading(true);
    let updated = null;

    try {
      updated = await updateEmployee(editingEmployee.employeeId, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim()
      });
      handleCloseEdit();
    } catch (err) {
      setError(err.message || 'Failed to update employee details.');
      setActionLoading(false);
      return;
    }

    // Profile update succeeded: refresh list and provide clear mutation feedback
    try {
      await loadEmployees();
      setSuccess(`Employee profile "${updated.fullName}" updated successfully.`);
    } catch (refreshErr) {
      setError(null);
      setSuccess(
        `Employee profile "${updated.fullName}" was updated successfully, but refreshing the employee list failed (${refreshErr.message || 'network error'}). Please click "↻ Refresh List".`
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Open status confirmation dialog and track triggering element for focus return
  const handleOpenStatusDialog = (emp, targetStatus, e) => {
    triggerElementRef.current = e?.currentTarget || document.activeElement;
    setStatusDialog({
      employee: emp,
      nextStatus: targetStatus
    });
    setError(null);
  };

  // Close status dialog and restore focus
  const handleCloseStatusDialog = useCallback(() => {
    setStatusDialog(null);
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  }, []);

  // Confirm status toggle
  const handleConfirmStatusChange = async () => {
    if (!statusDialog) return;
    const { employee, nextStatus } = statusDialog;
    const actionWord = nextStatus === 'ACTIVE' ? 'activated' : 'deactivated';

    setError(null);
    setSuccess(null);
    setActionLoading(true);

    try {
      await updateEmployeeStatus(employee.employeeId, nextStatus);
      handleCloseStatusDialog();
    } catch (err) {
      setError(err.message || 'Failed to update employee account status.');
      setActionLoading(false);
      return;
    }

    // Status toggle succeeded: refresh list and provide clear mutation feedback
    try {
      await loadEmployees();
      setSuccess(`Employee account for "${employee.fullName}" has been ${actionWord}.`);
    } catch (refreshErr) {
      setError(null);
      setSuccess(
        `Employee account for "${employee.fullName}" was ${actionWord}, but refreshing the employee list failed (${refreshErr.message || 'network error'}). Please click "↻ Refresh List".`
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Keyboard accessibility: Escape key listener for open modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (editingEmployee && !actionLoading) {
          handleCloseEdit();
        } else if (statusDialog && !actionLoading) {
          handleCloseStatusDialog();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingEmployee, statusDialog, actionLoading, handleCloseEdit, handleCloseStatusDialog]);

  // Focus management: initial focus on modal open
  useEffect(() => {
    if (editingEmployee) {
      editNameInputRef.current?.focus();
    }
  }, [editingEmployee]);

  useEffect(() => {
    if (statusDialog) {
      statusConfirmBtnRef.current?.focus();
    }
  }, [statusDialog]);

  // Focus trap inside active modal dialog
  const handleDialogKeyDown = (e, modalRef) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusableElements = modalRef.current.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusableElements.length) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  };

  if (currentUser?.role !== 'ADMIN') {
    return null;
  }

  return (
    <section className="emp-management-section" id="employee-management-panel" aria-label="Employee Account and Access Management">
      {/* Header */}
      <div className="emp-header">
        <div className="emp-header-left">
          <h2>
            Employee Account & Access Management
            <span className="badge badge-danger">ADMIN ONLY</span>
          </h2>
          <p>
            Provision bank staff credentials, update authorized profiles, and manage operational access.
          </p>
        </div>
        <div className="emp-header-actions">
          <button
            id="emp-toggle-create-btn"
            className="btn-primary"
            onClick={() => setShowCreatePanel(!showCreatePanel)}
          >
            {showCreatePanel ? 'Hide Provisioning Form' : '+ Provision New Employee'}
          </button>
          <button
            id="emp-refresh-btn"
            className="btn-secondary"
            onClick={() => loadEmployees().catch(() => {})}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '↻ Refresh List'}
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="emp-stats-bar">
        <div className="emp-stat-card">
          <span className="stat-label">Total Staff</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="emp-stat-card stat-active">
          <span className="stat-label">Active Staff</span>
          <span className="stat-value">{stats.active}</span>
        </div>
        <div className="emp-stat-card stat-inactive">
          <span className="stat-label">Deactivated Staff</span>
          <span className="stat-value">{stats.inactive}</span>
        </div>
      </div>

      {/* Feedback Banners */}
      {error && (
        <div className="auth-error-banner" id="emp-error-banner" role="alert" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️</span>
          <span style={{ flex: 1 }}>{error}</span>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {success && !error && (
        <div
          className="auth-error-banner"
          id="emp-success-banner"
          role="status"
          style={{
            marginBottom: '1.5rem',
            background: 'var(--success-bg)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
            color: '#6ee7b7'
          }}
        >
          <span>✓</span>
          <span style={{ flex: 1 }}>{success}</span>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setSuccess(null)}
            aria-label="Dismiss success message"
          >
            &times;
          </button>
        </div>
      )}

      {/* Provisioning Form Card */}
      {showCreatePanel && (
        <div className="emp-create-panel" id="emp-create-panel">
          <h3>
            <span>👤</span>
            <span>Provision New Employee Account</span>
          </h3>
          <p className="panel-subtitle">
            Creates an atomic linked record in <code>users</code> and <code>employees</code> tables within a single database transaction.
          </p>

          <div className="emp-form-info-callout">
            🔒 <strong>Strict RBAC Enforcement:</strong> Accounts created here are automatically assigned the{' '}
            <code>EMPLOYEE</code> role and <code>ACTIVE</code> status. Callers cannot choose privileged roles, and passwords are salted and hashed with bcrypt (cost 10).
          </div>

          <form onSubmit={handleCreateSubmit} id="create-employee-form">
            <div className="emp-create-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="new-emp-name">Full Legal Name *</label>
                <input
                  id="new-emp-name"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Eleanor Vance"
                  value={createForm.fullName}
                  onChange={(e) => handleCreateInputChange('fullName', e.target.value)}
                  disabled={actionLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-emp-email">Email Address *</label>
                <input
                  id="new-emp-email"
                  className="form-input"
                  type="email"
                  placeholder="e.g. eleanor.vance@bank.com"
                  value={createForm.email}
                  onChange={(e) => handleCreateInputChange('email', e.target.value)}
                  disabled={actionLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-emp-phone">Phone Number *</label>
                <input
                  id="new-emp-phone"
                  className="form-input"
                  type="tel"
                  placeholder="e.g. +1-555-0144"
                  value={createForm.phone}
                  onChange={(e) => handleCreateInputChange('phone', e.target.value)}
                  disabled={actionLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-emp-username">Username *</label>
                <input
                  id="new-emp-username"
                  className="form-input"
                  type="text"
                  placeholder="e.g. eleanor.vance"
                  value={createForm.username}
                  onChange={(e) => handleCreateInputChange('username', e.target.value)}
                  autoComplete="off"
                  disabled={actionLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-emp-password">Initial Password *</label>
                <input
                  id="new-emp-password"
                  className="form-input"
                  type="password"
                  placeholder="Min 8 characters"
                  value={createForm.password}
                  onChange={(e) => handleCreateInputChange('password', e.target.value)}
                  autoComplete="new-password"
                  disabled={actionLoading}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setCreateForm({
                    fullName: '',
                    email: '',
                    phone: '',
                    username: '',
                    password: ''
                  })
                }
                disabled={actionLoading}
              >
                Clear
              </button>
              <button
                id="create-employee-submit-btn"
                type="submit"
                className="btn-primary"
                disabled={actionLoading}
              >
                {actionLoading ? 'Provisioning...' : 'Provision Employee Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toolbar: Search and Counters */}
      <div className="emp-toolbar">
        <div className="emp-search-input-wrapper">
          <span className="emp-search-icon">🔍</span>
          <input
            id="emp-search-input"
            className="emp-search-input"
            type="search"
            placeholder="Search by name, username, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredEmployees.length}</strong> of <strong>{employees.length}</strong> employees
        </div>
      </div>

      {/* Employees Table */}
      <div className="emp-table-container">
        {loading && employees.length === 0 ? (
          <div className="emp-empty-state">
            <div className="emp-empty-icon">⏳</div>
            <p>Loading employee records from secure backend...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="emp-empty-state">
            <div className="emp-empty-icon">📂</div>
            <p>No employee records found matching your query.</p>
          </div>
        ) : (
          <table className="emp-table" id="emp-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Staff Member</th>
                <th>Username</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const isActive = emp.status === 'ACTIVE';
                return (
                  <tr key={emp.employeeId} id={`emp-row-${emp.employeeId}`}>
                    <td>
                      <code style={{ color: 'var(--text-muted)' }}>#{emp.employeeId}</code>
                    </td>
                    <td>
                      <div className="emp-name-cell">{emp.fullName}</div>
                      <div className="emp-email-sub">{emp.email}</div>
                    </td>
                    <td>
                      <code style={{ color: '#93c5fd' }}>{emp.username}</code>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: emp.phone ? 'var(--text-main)' : 'var(--text-subtle)' }}>
                        {emp.phone || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                        {emp.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}
                        id={`emp-status-badge-${emp.employeeId}`}
                      >
                        {emp.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.785rem', color: 'var(--text-subtle)' }}>
                        {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td>
                      <div className="emp-actions-cell" style={{ justifyContent: 'flex-end' }}>
                        <button
                          id={`edit-emp-btn-${emp.employeeId}`}
                          className="btn-sm btn-action-edit"
                          onClick={(e) => handleOpenEdit(emp, e)}
                          disabled={actionLoading}
                          title="Edit permitted profile fields"
                        >
                          ✎ Edit
                        </button>
                        {isActive ? (
                          <button
                            id={`deactivate-emp-btn-${emp.employeeId}`}
                            className="btn-sm btn-action-deactivate"
                            onClick={(e) => handleOpenStatusDialog(emp, 'INACTIVE', e)}
                            disabled={actionLoading}
                            title="Deactivate employee access"
                          >
                            ⊘ Deactivate
                          </button>
                        ) : (
                          <button
                            id={`activate-emp-btn-${emp.employeeId}`}
                            className="btn-sm btn-action-activate"
                            onClick={(e) => handleOpenStatusDialog(emp, 'ACTIVE', e)}
                            disabled={actionLoading}
                            title="Activate employee access"
                          >
                            ✓ Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              handleCloseEdit();
            }
          }}
        >
          <div
            ref={editModalRef}
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dialog-title"
            aria-describedby="edit-dialog-desc"
            onKeyDown={(e) => handleDialogKeyDown(e, editModalRef)}
          >
            <div className="modal-header">
              <h3 id="edit-dialog-title">Edit Employee Details</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseEdit}
                aria-label="Close dialog"
                disabled={actionLoading}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                {/* Protected fields notice */}
                <div
                  id="edit-dialog-desc"
                  className="emp-form-info-callout"
                  style={{ marginBottom: '1.25rem', fontSize: '0.78rem' }}
                >
                  🛡️ <strong>Security Safeguard:</strong> Protected fields (<code>username</code>,{' '}
                  <code>role</code>, <code>password</code>, <code>user_id</code>) are immutable via this interface and will be rejected by the backend if submitted.
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="edit-username-readonly">Username (Immutable)</label>
                  <div className="readonly-box" id="edit-username-readonly">
                    {editingEmployee.username} (User ID: {editingEmployee.userId})
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="edit-emp-name">Full Name *</label>
                  <input
                    ref={editNameInputRef}
                    id="edit-emp-name"
                    className="form-input"
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    disabled={actionLoading}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="edit-emp-email">Email Address *</label>
                  <input
                    id="edit-emp-email"
                    className="form-input"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    disabled={actionLoading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-emp-phone">Phone Number *</label>
                  <input
                    id="edit-emp-phone"
                    className="form-input"
                    type="tel"
                    placeholder="e.g. +1-555-0144"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                    disabled={actionLoading}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseEdit}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  id="save-employee-edit-btn"
                  type="submit"
                  className="btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Toggle Confirmation Modal */}
      {statusDialog && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              handleCloseStatusDialog();
            }
          }}
        >
          <div
            ref={statusModalRef}
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-dialog-title"
            aria-describedby="status-dialog-desc"
            onKeyDown={(e) => handleDialogKeyDown(e, statusModalRef)}
          >
            <div className="modal-header">
              <h3 id="status-dialog-title">
                {statusDialog.nextStatus === 'ACTIVE'
                  ? 'Reactivate Employee Account'
                  : 'Deactivate Employee Account'}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseStatusDialog}
                aria-label="Close dialog"
                disabled={actionLoading}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" id="status-dialog-desc">
              {statusDialog.nextStatus === 'INACTIVE' ? (
                <div style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  <p style={{ marginBottom: '0.75rem' }}>
                    Are you sure you want to deactivate employee{' '}
                    <strong>{statusDialog.employee.fullName}</strong> (<code>{statusDialog.employee.username}</code>)?
                  </p>
                  <div
                    className="emp-form-info-callout"
                    style={{
                      borderLeftColor: 'var(--danger)',
                      background: 'var(--danger-bg)',
                      color: '#fca5a5'
                    }}
                  >
                    ⚠️ <strong>Immediate Session Invalidation:</strong> Deactivation updates{' '}
                    <code>users.status = &apos;INACTIVE&apos;</code>. The employee will be immediately denied access on their next request, and their active session cookie will be invalidated.
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                  <p>
                    Reactivate employee account for{' '}
                    <strong>{statusDialog.employee.fullName}</strong> (<code>{statusDialog.employee.username}</code>)?
                  </p>
                  <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                    The employee will be able to sign in and perform employee-authorized operations again.
                  </p>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseStatusDialog}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                ref={statusConfirmBtnRef}
                id="confirm-status-toggle-btn"
                type="button"
                className={statusDialog.nextStatus === 'ACTIVE' ? 'btn-primary' : 'btn-sm btn-action-deactivate'}
                style={statusDialog.nextStatus !== 'ACTIVE' ? { padding: '0.6rem 1.25rem', fontSize: '0.875rem' } : {}}
                onClick={handleConfirmStatusChange}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Updating...'
                  : statusDialog.nextStatus === 'ACTIVE'
                  ? 'Confirm Activation'
                  : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
