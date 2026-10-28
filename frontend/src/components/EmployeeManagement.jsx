import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus
} from '../services/api';
import './EmployeeManagement.css';

/* ==============================================================================
   Lucide-style Inline SVG Icons (Project-compatible, zero-dependency)
   ============================================================================== */

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

function IconUserCheck({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function IconUserX({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="8" x2="22" y2="13" />
      <line x1="22" y1="8" x2="17" y2="13" />
    </svg>
  );
}

function IconUserPlus({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
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
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function IconEdit({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconShield({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

function IconAlertTriangle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconAlertCircle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
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

function IconEye({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

/* ==============================================================================
   Validation Patterns
   ============================================================================== */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s+\-().]{5,20}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,50}$/;

export default function EmployeeManagement({ currentUser }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Add Employee Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    password: ''
  });
  const [createErrors, setCreateErrors] = useState({});

  // View / Edit Employee Modal
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: ''
  });
  const [editErrors, setEditErrors] = useState({});

  // Status Change Confirmation Dialog
  const [statusDialog, setStatusDialog] = useState(null);

  // References
  const isMountedRef = useRef(true);
  const activeRequestIdRef = useRef(0);
  const triggerElementRef = useRef(null);
  const editModalRef = useRef(null);
  const statusModalRef = useRef(null);
  const addModalRef = useRef(null);
  const addNameInputRef = useRef(null);
  const editNameInputRef = useRef(null);
  const statusConfirmBtnRef = useRef(null);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch employees list from backend API
   */
  const loadEmployees = useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;
    setLoading(true);
    setFetchError(null);

    try {
      const list = await getEmployees();
      if (!isMountedRef.current || requestId !== activeRequestIdRef.current) {
        return list;
      }
      setEmployees(Array.isArray(list) ? list : []);
      return list;
    } catch (err) {
      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        setFetchError(err.message || 'Unable to connect to employee database service.');
      }
      throw err;
    } finally {
      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    let ignore = false;
    if (currentUser?.role === 'ADMIN') {
      Promise.resolve().then(() => {
        if (!ignore && isMountedRef.current) {
          loadEmployees().catch(() => {});
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [currentUser, loadEmployees]);

  // Derived statistics
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === 'ACTIVE').length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Status filter
      if (statusFilter === 'ACTIVE' && emp.status !== 'ACTIVE') return false;
      if (statusFilter === 'INACTIVE' && emp.status !== 'INACTIVE') return false;

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const idMatch = String(emp.employeeId).includes(q) || ('#' + emp.employeeId).includes(q);
      const nameMatch = emp.fullName?.toLowerCase().includes(q);
      const usernameMatch = emp.username?.toLowerCase().includes(q);
      const emailMatch = emp.email?.toLowerCase().includes(q);
      const phoneMatch = emp.phone?.toLowerCase().includes(q);

      return idMatch || nameMatch || usernameMatch || emailMatch || phoneMatch;
    });
  }, [employees, statusFilter, searchQuery]);

  // Handle open Add Employee modal
  const handleOpenAddModal = (e) => {
    triggerElementRef.current = e?.currentTarget || document.activeElement;
    setCreateForm({
      fullName: '',
      email: '',
      phone: '',
      username: '',
      password: ''
    });
    setCreateErrors({});
    setShowCreatePassword(false);
    setShowAddModal(true);
  };

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
    setCreateErrors({});
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  }, []);

  // Validate Add Employee form
  const validateCreateForm = () => {
    const errors = {};
    if (!createForm.fullName.trim()) {
      errors.fullName = 'Full legal name is required.';
    } else if (createForm.fullName.trim().length > 100) {
      errors.fullName = 'Name cannot exceed 100 characters.';
    }

    if (!createForm.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(createForm.email.trim()) || createForm.email.trim().length > 100) {
      errors.email = 'Please provide a valid corporate email address.';
    }

    if (!createForm.phone.trim()) {
      errors.phone = 'Phone number is required.';
    } else if (!PHONE_REGEX.test(createForm.phone.trim())) {
      errors.phone = 'Phone must be 5-20 characters with valid digits and symbols.';
    }

    if (!createForm.username.trim()) {
      errors.username = 'Username is required.';
    } else if (!USERNAME_REGEX.test(createForm.username.trim())) {
      errors.username = 'Username must be 3-50 characters (letters, numbers, dots, hyphens).';
    }

    if (!createForm.password) {
      errors.password = 'Initial password is required.';
    } else if (createForm.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Add Employee
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateCreateForm()) return;

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

      handleCloseAddModal();
    } catch (err) {
      if (err.code === 'VAL_002') {
        setCreateErrors((prev) => ({
          ...prev,
          username: `Username "${createForm.username.trim().toLowerCase()}" is already taken.`
        }));
      } else {
        setCreateErrors((prev) => ({
          ...prev,
          general: err.message || 'Failed to provision employee account.'
        }));
      }
      setActionLoading(false);
      return;
    }

    // Refresh employee list
    try {
      await loadEmployees();
      setToast({
        type: 'success',
        message: `Employee account for "${created.fullName}" provisioned successfully.`
      });
    } catch (refreshErr) {
      setToast({
        type: 'warning',
        message: `Employee "${created.fullName}" created, but list refresh failed (${refreshErr.message || 'network error'}). Please click Refresh.`
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (emp, e) => {
    triggerElementRef.current = e?.currentTarget || document.activeElement;
    setEditingEmployee(emp);
    setEditForm({
      fullName: emp.fullName || '',
      email: emp.email || '',
      phone: emp.phone || ''
    });
    setEditErrors({});
  };

  const handleCloseEdit = useCallback(() => {
    setEditingEmployee(null);
    setEditErrors({});
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  }, []);

  // Validate Edit form
  const validateEditForm = () => {
    const errors = {};
    if (!editForm.fullName.trim()) {
      errors.fullName = 'Full name cannot be empty.';
    } else if (editForm.fullName.trim().length > 100) {
      errors.fullName = 'Name cannot exceed 100 characters.';
    }

    if (!editForm.email.trim()) {
      errors.email = 'Email address cannot be empty.';
    } else if (!EMAIL_REGEX.test(editForm.email.trim()) || editForm.email.trim().length > 100) {
      errors.email = 'Please provide a valid email address.';
    }

    if (!editForm.phone.trim()) {
      errors.phone = 'Phone number cannot be empty.';
    } else if (!PHONE_REGEX.test(editForm.phone.trim())) {
      errors.phone = 'Phone must be 5-20 characters with valid digits and symbols.';
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Edit form
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingEmployee || !validateEditForm()) return;

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
      setEditErrors((prev) => ({
        ...prev,
        general: err.message || 'Failed to update employee details.'
      }));
      setActionLoading(false);
      return;
    }

    try {
      await loadEmployees();
      setToast({
        type: 'success',
        message: `Profile for "${updated.fullName || editForm.fullName}" updated successfully.`
      });
    } catch (refreshErr) {
      setToast({
        type: 'warning',
        message: `Profile updated, but list refresh failed (${refreshErr.message || 'network error'}).`
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Status Dialog
  const handleOpenStatusDialog = (emp, targetStatus, e) => {
    triggerElementRef.current = e?.currentTarget || document.activeElement;
    setStatusDialog({
      employee: emp,
      nextStatus: targetStatus
    });
  };

  const handleCloseStatusDialog = useCallback(() => {
    setStatusDialog(null);
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  }, []);

  // Confirm Status Change
  const handleConfirmStatusChange = async () => {
    if (!statusDialog) return;
    const { employee, nextStatus } = statusDialog;
    const actionWord = nextStatus === 'ACTIVE' ? 'activated' : 'deactivated';

    setActionLoading(true);

    try {
      await updateEmployeeStatus(employee.employeeId, nextStatus);
      handleCloseStatusDialog();
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || `Failed to ${actionWord} employee account.`
      });
      setActionLoading(false);
      return;
    }

    try {
      await loadEmployees();
      setToast({
        type: 'success',
        message: `Account for "${employee.fullName}" has been successfully ${actionWord}.`
      });
    } catch (refreshErr) {
      setToast({
        type: 'warning',
        message: `Status changed to ${nextStatus}, but list refresh failed (${refreshErr.message || 'network error'}).`
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Focus and keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !actionLoading) {
        if (showAddModal) handleCloseAddModal();
        else if (editingEmployee) handleCloseEdit();
        else if (statusDialog) handleCloseStatusDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddModal, editingEmployee, statusDialog, actionLoading, handleCloseAddModal, handleCloseEdit, handleCloseStatusDialog]);

  useEffect(() => {
    if (showAddModal) addNameInputRef.current?.focus();
  }, [showAddModal]);

  useEffect(() => {
    if (editingEmployee) editNameInputRef.current?.focus();
  }, [editingEmployee]);

  useEffect(() => {
    if (statusDialog) statusConfirmBtnRef.current?.focus();
  }, [statusDialog]);

  // Dialog tab-trap helper
  const handleDialogKeyDown = (e, modalRef) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  };

  if (currentUser?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="emp-mgmt-root">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-container toast-${toast.type}`} role="alert">
          <div className="toast-icon">
            {toast.type === 'success' && <IconCheckCircle size={18} />}
            {toast.type === 'warning' && <IconAlertTriangle size={18} />}
            {toast.type === 'error' && <IconAlertCircle size={18} />}
          </div>
          <div className="toast-body">{toast.message}</div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToast(null)}
            aria-label="Dismiss alert"
          >
            <IconX size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="emp-page-header">
        <div>
          <h1 className="emp-page-title">Employee Management</h1>
          <p className="emp-page-subtitle">
            Manage employee accounts, access permissions, and account status.
          </p>
        </div>
        <div className="emp-page-actions">
          <button
            id="emp-refresh-btn"
            className="btn-secondary-custom"
            onClick={() => loadEmployees().catch(() => {})}
            disabled={loading}
            title="Refresh employee list"
          >
            <IconRefresh size={15} className={loading ? 'spin-icon' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            id="emp-add-btn"
            className="btn-primary-custom"
            onClick={handleOpenAddModal}
          >
            <IconUserPlus size={16} />
            <span>+ Add Employee</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="emp-stats-grid">
        <div className="emp-stat-card card-total">
          <div className="stat-icon-wrapper total-icon">
            <IconUsers size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Total Staff</span>
            <span className="stat-value">{stats.total}</span>
            <span className="stat-desc">All registered personnel</span>
          </div>
        </div>

        <div className="emp-stat-card card-active">
          <div className="stat-icon-wrapper active-icon">
            <IconUserCheck size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Active Staff</span>
            <span className="stat-value text-success">{stats.active}</span>
            <span className="stat-desc">Operational portal access</span>
          </div>
        </div>

        <div className="emp-stat-card card-inactive">
          <div className="stat-icon-wrapper inactive-icon">
            <IconUserX size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Inactive Staff</span>
            <span className="stat-value text-danger">{stats.inactive}</span>
            <span className="stat-desc">Access temporarily revoked</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Search and Filter Pills */}
      <div className="emp-filter-toolbar">
        <div className="search-box-wrapper">
          <span className="search-icon-inside">
            <IconSearch size={16} />
          </span>
          <input
            id="emp-search-input"
            type="text"
            className="search-input-field"
            placeholder="Search by name, username, email, phone, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        <div className="filter-group">
          <span className="filter-label">Status:</span>
          <div className="filter-pills">
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All ({employees.length})
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ACTIVE')}
            >
              Active ({stats.active})
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('INACTIVE')}
            >
              Inactive ({stats.inactive})
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="emp-table-card">
        {/* Error State */}
        {fetchError && (
          <div className="emp-table-error" role="alert">
            <IconAlertCircle size={28} className="error-icon" />
            <div className="error-content">
              <h4>Failed to load employee records</h4>
              <p>{fetchError}</p>
            </div>
            <button
              type="button"
              className="btn-retry"
              onClick={() => loadEmployees().catch(() => {})}
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !fetchError && (
          <div className="emp-table-skeleton">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton-cell skeleton-id" />
                <div className="skeleton-cell skeleton-name" />
                <div className="skeleton-cell skeleton-user" />
                <div className="skeleton-cell skeleton-contact" />
                <div className="skeleton-cell skeleton-status" />
                <div className="skeleton-cell skeleton-action" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State: No Employees at all */}
        {!loading && !fetchError && employees.length === 0 && (
          <div className="emp-table-empty">
            <div className="empty-icon-circle">
              <IconUsers size={32} />
            </div>
            <h3>No employee accounts found</h3>
            <p>Get started by provisioning the first bank employee record.</p>
            <button
              type="button"
              className="btn-primary-custom"
              onClick={handleOpenAddModal}
            >
              <IconUserPlus size={16} />
              <span>Provision First Employee</span>
            </button>
          </div>
        )}

        {/* Empty State: Search/Filter returned 0 */}
        {!loading && !fetchError && employees.length > 0 && filteredEmployees.length === 0 && (
          <div className="emp-table-empty">
            <div className="empty-icon-circle">
              <IconSearch size={32} />
            </div>
            <h3>No matching employees</h3>
            <p>No staff records matched your search query or status filter.</p>
            <button
              type="button"
              className="btn-secondary-custom"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Real Data Table */}
        {!loading && !fetchError && filteredEmployees.length > 0 && (
          <div className="table-responsive-wrapper">
            <table className="emp-table-custom" id="emp-data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th>Staff Member</th>
                  <th>Username</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Account Status</th>
                  <th style={{ textAlign: 'right', width: '210px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const isActive = emp.status === 'ACTIVE';
                  return (
                    <tr key={emp.employeeId} id={`emp-row-${emp.employeeId}`}>
                      <td>
                        <span className="emp-id-badge">#{emp.employeeId}</span>
                      </td>
                      <td>
                        <div className="emp-name-box">
                          <span className="emp-name-text">{emp.fullName}</span>
                          <span className="emp-email-text">{emp.email}</span>
                        </div>
                      </td>
                      <td>
                        <code className="emp-username-tag">{emp.username}</code>
                      </td>
                      <td>
                        <span className="emp-phone-text">{emp.phone || '—'}</span>
                      </td>
                      <td>
                        <span className="badge-role">
                          <IconShield size={12} />
                          <span>{emp.role}</span>
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge-status ${isActive ? 'status-active' : 'status-inactive'}`}
                          id={`emp-status-badge-${emp.employeeId}`}
                        >
                          <span className="status-dot" />
                          <span>{emp.status}</span>
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="emp-action-buttons">
                          <button
                            id={`edit-emp-btn-${emp.employeeId}`}
                            type="button"
                            className="btn-action btn-edit"
                            onClick={(e) => handleOpenEdit(emp, e)}
                            disabled={actionLoading}
                            title="View and edit employee details"
                          >
                            <IconEdit size={14} />
                            <span>View / Edit</span>
                          </button>
                          {isActive ? (
                            <button
                              id={`deactivate-emp-btn-${emp.employeeId}`}
                              type="button"
                              className="btn-action btn-deactivate"
                              onClick={(e) => handleOpenStatusDialog(emp, 'INACTIVE', e)}
                              disabled={actionLoading}
                              title="Deactivate employee access"
                            >
                              <IconUserX size={14} />
                              <span>Deactivate</span>
                            </button>
                          ) : (
                            <button
                              id={`activate-emp-btn-${emp.employeeId}`}
                              type="button"
                              className="btn-action btn-activate"
                              onClick={(e) => handleOpenStatusDialog(emp, 'ACTIVE', e)}
                              disabled={actionLoading}
                              title="Reactivate employee access"
                            >
                              <IconUserCheck size={14} />
                              <span>Activate</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==============================================================================
          ADD EMPLOYEE MODAL
          ============================================================================== */}
      {showAddModal && (
        <div
          className="custom-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              handleCloseAddModal();
            }
          }}
        >
          <div
            ref={addModalRef}
            className="custom-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-modal-title"
            onKeyDown={(e) => handleDialogKeyDown(e, addModalRef)}
          >
            <div className="custom-modal-header">
              <div className="modal-title-group">
                <div className="modal-icon-badge">
                  <IconUserPlus size={18} />
                </div>
                <div>
                  <h3 id="add-modal-title">Provision New Employee</h3>
                  <p className="modal-header-desc">
                    Create credentials and profile linked to the MySQL database.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon"
                onClick={handleCloseAddModal}
                disabled={actionLoading}
                aria-label="Close modal"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} noValidate>
              <div className="custom-modal-body">
                {createErrors.general && (
                  <div className="form-general-error" role="alert">
                    <IconAlertCircle size={16} />
                    <span>{createErrors.general}</span>
                  </div>
                )}

                <div className="form-field-group">
                  <label className="field-label" htmlFor="new-emp-name">
                    Full Legal Name <span className="required-star">*</span>
                  </label>
                  <input
                    ref={addNameInputRef}
                    id="new-emp-name"
                    type="text"
                    className={`field-input ${createErrors.fullName ? 'has-error' : ''}`}
                    placeholder="e.g. Rachel Sterling"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    disabled={actionLoading}
                  />
                  {createErrors.fullName && (
                    <span className="field-error-msg">{createErrors.fullName}</span>
                  )}
                </div>

                <div className="form-grid-two">
                  <div className="form-field-group">
                    <label className="field-label" htmlFor="new-emp-email">
                      Corporate Email <span className="required-star">*</span>
                    </label>
                    <input
                      id="new-emp-email"
                      type="email"
                      className={`field-input ${createErrors.email ? 'has-error' : ''}`}
                      placeholder="rachel.sterling@bank.com"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      disabled={actionLoading}
                    />
                    {createErrors.email && (
                      <span className="field-error-msg">{createErrors.email}</span>
                    )}
                  </div>

                  <div className="form-field-group">
                    <label className="field-label" htmlFor="new-emp-phone">
                      Phone Number <span className="required-star">*</span>
                    </label>
                    <input
                      id="new-emp-phone"
                      type="tel"
                      className={`field-input ${createErrors.phone ? 'has-error' : ''}`}
                      placeholder="555-0145"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      disabled={actionLoading}
                    />
                    {createErrors.phone && (
                      <span className="field-error-msg">{createErrors.phone}</span>
                    )}
                  </div>
                </div>

                <div className="form-grid-two">
                  <div className="form-field-group">
                    <label className="field-label" htmlFor="new-emp-username">
                      Username <span className="required-star">*</span>
                    </label>
                    <input
                      id="new-emp-username"
                      type="text"
                      className={`field-input ${createErrors.username ? 'has-error' : ''}`}
                      placeholder="rachel.sterling"
                      value={createForm.username}
                      onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                      disabled={actionLoading}
                      autoComplete="off"
                    />
                    {createErrors.username && (
                      <span className="field-error-msg">{createErrors.username}</span>
                    )}
                  </div>

                  <div className="form-field-group">
                    <label className="field-label" htmlFor="new-emp-password">
                      Initial Password <span className="required-star">*</span>
                    </label>
                    <div className="password-input-wrapper">
                      <input
                        id="new-emp-password"
                        type={showCreatePassword ? 'text' : 'password'}
                        className={`field-input with-toggle ${createErrors.password ? 'has-error' : ''}`}
                        placeholder="Minimum 8 characters"
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                        disabled={actionLoading}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                        tabIndex="-1"
                        aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                      >
                        {showCreatePassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                      </button>
                    </div>
                    {createErrors.password && (
                      <span className="field-error-msg">{createErrors.password}</span>
                    )}
                  </div>
                </div>

                <div className="security-info-box">
                  <IconShield size={16} className="shield-icon" />
                  <div className="security-text">
                    <strong>Security Standard:</strong> Salted bcrypt hashing (cost factor 10) is applied before storage. Role is strictly assigned as <code>EMPLOYEE</code> with <code>ACTIVE</code> status.
                  </div>
                </div>
              </div>

              <div className="custom-modal-footer">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={handleCloseAddModal}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  id="create-employee-submit-btn"
                  type="submit"
                  className="btn-primary-custom"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Provisioning Account...' : 'Provision Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================================
          VIEW / EDIT EMPLOYEE MODAL
          ============================================================================== */}
      {editingEmployee && (
        <div
          className="custom-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              handleCloseEdit();
            }
          }}
        >
          <div
            ref={editModalRef}
            className="custom-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
            onKeyDown={(e) => handleDialogKeyDown(e, editModalRef)}
          >
            <div className="custom-modal-header">
              <div className="modal-title-group">
                <div className="modal-icon-badge">
                  <IconEdit size={18} />
                </div>
                <div>
                  <h3 id="edit-modal-title">Employee Profile &amp; Details</h3>
                  <p className="modal-header-desc">
                    Staff ID #{editingEmployee.employeeId} &bull; {editingEmployee.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon"
                onClick={handleCloseEdit}
                disabled={actionLoading}
                aria-label="Close modal"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} noValidate>
              <div className="custom-modal-body">
                {editErrors.general && (
                  <div className="form-general-error" role="alert">
                    <IconAlertCircle size={16} />
                    <span>{editErrors.general}</span>
                  </div>
                )}

                {/* Read-Only Identity Card */}
                <div className="identity-summary-card">
                  <div className="identity-row">
                    <div className="identity-item">
                      <span className="identity-label">Staff ID</span>
                      <span className="identity-value">#{editingEmployee.employeeId}</span>
                    </div>
                    <div className="identity-item">
                      <span className="identity-label">System User ID</span>
                      <span className="identity-value">#{editingEmployee.userId}</span>
                    </div>
                    <div className="identity-item">
                      <span className="identity-label">Assigned Role</span>
                      <span className="identity-value badge-role">
                        <IconShield size={12} />
                        {editingEmployee.role}
                      </span>
                    </div>
                    <div className="identity-item">
                      <span className="identity-label">Current Status</span>
                      <span className={`badge-status ${editingEmployee.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`}>
                        <span className="status-dot" />
                        {editingEmployee.status}
                      </span>
                    </div>
                  </div>
                  <div className="identity-note">
                    🔒 System identity identifiers and roles are immutable to uphold database referential integrity.
                  </div>
                </div>

                {/* Editable Profile Inputs */}
                <div className="form-field-group">
                  <label className="field-label" htmlFor="edit-emp-name">
                    Full Legal Name <span className="required-star">*</span>
                  </label>
                  <input
                    ref={editNameInputRef}
                    id="edit-emp-name"
                    type="text"
                    className={`field-input ${editErrors.fullName ? 'has-error' : ''}`}
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    disabled={actionLoading}
                  />
                  {editErrors.fullName && (
                    <span className="field-error-msg">{editErrors.fullName}</span>
                  )}
                </div>

                <div className="form-grid-two">
                  <div className="form-field-group">
                    <label className="field-label" htmlFor="edit-emp-email">
                      Email Address <span className="required-star">*</span>
                    </label>
                    <input
                      id="edit-emp-email"
                      type="email"
                      className={`field-input ${editErrors.email ? 'has-error' : ''}`}
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      disabled={actionLoading}
                    />
                    {editErrors.email && (
                      <span className="field-error-msg">{editErrors.email}</span>
                    )}
                  </div>

                  <div className="form-field-group">
                    <label className="field-label" htmlFor="edit-emp-phone">
                      Phone Number <span className="required-star">*</span>
                    </label>
                    <input
                      id="edit-emp-phone"
                      type="tel"
                      className={`field-input ${editErrors.phone ? 'has-error' : ''}`}
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      disabled={actionLoading}
                    />
                    {editErrors.phone && (
                      <span className="field-error-msg">{editErrors.phone}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="custom-modal-footer">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={handleCloseEdit}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  id="save-employee-edit-btn"
                  type="submit"
                  className="btn-primary-custom"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================================================
          STATUS CHANGE CONFIRMATION DIALOG (ACTIVATE / DEACTIVATE)
          ============================================================================== */}
      {statusDialog && (
        <div
          className="custom-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              handleCloseStatusDialog();
            }
          }}
        >
          <div
            ref={statusModalRef}
            className="custom-modal-dialog confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-dialog-title"
            onKeyDown={(e) => handleDialogKeyDown(e, statusModalRef)}
          >
            <div className="custom-modal-header">
              <div className="modal-title-group">
                <div className={`modal-icon-badge ${statusDialog.nextStatus === 'ACTIVE' ? 'badge-icon-success' : 'badge-icon-danger'}`}>
                  {statusDialog.nextStatus === 'ACTIVE' ? (
                    <IconUserCheck size={20} />
                  ) : (
                    <IconAlertTriangle size={20} />
                  )}
                </div>
                <div>
                  <h3 id="status-dialog-title">
                    {statusDialog.nextStatus === 'ACTIVE'
                      ? 'Reactivate Employee Account'
                      : 'Deactivate Employee Account'}
                  </h3>
                  <p className="modal-header-desc">
                    Staff ID #{statusDialog.employee.employeeId} &bull; {statusDialog.employee.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon"
                onClick={handleCloseStatusDialog}
                disabled={actionLoading}
                aria-label="Close modal"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="custom-modal-body">
              {statusDialog.nextStatus === 'INACTIVE' ? (
                <div>
                  <p className="dialog-main-text">
                    Are you sure you want to deactivate the employee account for{' '}
                    <strong>{statusDialog.employee.fullName}</strong> (<code>{statusDialog.employee.username}</code>)?
                  </p>
                  <div className="deactivation-warning-callout">
                    <IconAlertTriangle size={18} className="warning-callout-icon" />
                    <div className="warning-callout-text">
                      <strong>Immediate Session Invalidation:</strong> Deactivation immediately marks{' '}
                      <code>users.status = 'INACTIVE'</code> in the database. The employee will be rejected from logging in, and any active session will be invalidated on their next request.
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="dialog-main-text">
                    Reactivate employee account for{' '}
                    <strong>{statusDialog.employee.fullName}</strong> (<code>{statusDialog.employee.username}</code>)?
                  </p>
                  <p className="dialog-sub-text">
                    The account status will be restored to <code>ACTIVE</code>. The staff member will immediately be able to authenticate and access banking operations.
                  </p>
                </div>
              )}
            </div>

            <div className="custom-modal-footer">
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={handleCloseStatusDialog}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                ref={statusConfirmBtnRef}
                id="confirm-status-toggle-btn"
                type="button"
                className={statusDialog.nextStatus === 'ACTIVE' ? 'btn-primary-custom' : 'btn-danger-custom'}
                onClick={handleConfirmStatusChange}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Updating Status...'
                  : statusDialog.nextStatus === 'ACTIVE'
                  ? 'Confirm Reactivation'
                  : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
