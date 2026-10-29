import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getCustomers,
  registerCustomer,
  updateCustomer
} from '../services/api';
import './CustomerManagement.css';

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

function IconUserCheck({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
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

function IconRefreshCw({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconEye({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
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

function IconShield({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

function IconCheckCircle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
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

export default function CustomerManagement({ currentUser: _currentUser }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Registration Form State
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    dateOfBirth: '',
    phone: '',
    email: '',
    address: '',
    username: '',
    password: ''
  });
  const [registerErrors, setRegisterErrors] = useState({});
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerGeneralError, setRegisterGeneralError] = useState(null);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    fullName: '',
    dateOfBirth: '',
    phone: '',
    email: '',
    address: ''
  });
  const [editErrors, setEditErrors] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editGeneralError, setEditGeneralError] = useState(null);

  // Toast State
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // Fetch customers directory
  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      setFetchError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        loadCustomers();
      }
    });
    return () => {
      ignore = true;
    };
  }, [loadCustomers]);

  // Handle ESC key to close open modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowRegisterModal(false);
        setViewingCustomer(null);
        setEditingCustomer(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      return (
        String(c.customerId).includes(q) ||
        (c.fullName && c.fullName.toLowerCase().includes(q)) ||
        (c.username && c.username.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    });
  }, [customers, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: customers.length,
      active: customers.filter((c) => c.userStatus === 'ACTIVE').length,
      inactive: customers.filter((c) => c.userStatus !== 'ACTIVE').length
    };
  }, [customers]);

  // Handle Register Customer
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterErrors({});
    setRegisterGeneralError(null);

    const errors = {};
    if (!registerForm.fullName.trim()) errors.fullName = 'Full name is required';
    if (!registerForm.dateOfBirth.trim()) errors.dateOfBirth = 'Date of birth is required';
    if (!registerForm.phone.trim()) errors.phone = 'Phone number is required';
    if (!registerForm.email.trim()) errors.email = 'Email address is required';
    if (!registerForm.address.trim()) errors.address = 'Address is required';
    if (!registerForm.username.trim()) errors.username = 'Username is required';
    if (!registerForm.password) {
      errors.password = 'Initial password is required';
    } else if (registerForm.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (Object.keys(errors).length > 0) {
      setRegisterErrors(errors);
      return;
    }

    try {
      setRegisterSubmitting(true);
      const res = await registerCustomer(registerForm);
      showToast(`Customer registered successfully: ${res.data?.fullName || registerForm.fullName}`);
      setShowRegisterModal(false);
      setRegisterForm({
        fullName: '',
        dateOfBirth: '',
        phone: '',
        email: '',
        address: '',
        username: '',
        password: ''
      });
      loadCustomers();
    } catch (err) {
      if (err.data?.fields && Array.isArray(err.data.fields)) {
        const fieldMap = {};
        for (const f of err.data.fields) {
          fieldMap[f.field] = f.issue;
        }
        setRegisterErrors(fieldMap);
      }
      setRegisterGeneralError(err.message || 'Customer registration failed');
    } finally {
      setRegisterSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (cust) => {
    setEditingCustomer(cust);
    setEditForm({
      fullName: cust.fullName || '',
      dateOfBirth: cust.dateOfBirth ? cust.dateOfBirth.slice(0, 10) : '',
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || ''
    });
    setEditErrors({});
    setEditGeneralError(null);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditErrors({});
    setEditGeneralError(null);

    if (!editingCustomer) return;

    const errors = {};
    if (!editForm.fullName.trim()) errors.fullName = 'Full name is required';
    if (!editForm.phone.trim()) errors.phone = 'Phone number is required';
    if (!editForm.email.trim()) errors.email = 'Email address is required';
    if (!editForm.address.trim()) errors.address = 'Address is required';

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    try {
      setEditSubmitting(true);
      await updateCustomer(editingCustomer.customerId, editForm);
      showToast(`Profile updated successfully for Customer #${editingCustomer.customerId}`);
      setEditingCustomer(null);
      loadCustomers();
    } catch (err) {
      if (err.data?.fields && Array.isArray(err.data.fields)) {
        const fieldMap = {};
        for (const f of err.data.fields) {
          fieldMap[f.field] = f.issue;
        }
        setEditErrors(fieldMap);
      }
      setEditGeneralError(err.message || 'Profile update failed');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="customer-mgmt-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-alert-banner toast-${toast.type}`} role="alert">
          <div className="toast-icon">
            {toast.type === 'success' ? <IconCheckCircle size={18} /> : <IconAlertCircle size={18} />}
          </div>
          <span className="toast-message">{toast.message}</span>
          <button type="button" className="toast-close-btn" onClick={() => setToast(null)}>
            <IconX size={15} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="emp-page-header">
        <div>
          <h1 className="emp-page-title">Customer Directory &amp; Profile Management</h1>
          <p className="emp-page-subtitle">
            Register new customers, view profile records, and maintain customer contact information (FR-04, FR-05, FR-06).
          </p>
        </div>
        <div className="header-actions-row">
          <button
            type="button"
            className="btn-secondary-custom"
            onClick={loadCustomers}
            disabled={loading}
          >
            <IconRefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          <button
            id="register-customer-action-btn"
            type="button"
            className="btn-primary-custom"
            onClick={() => {
              setRegisterErrors({});
              setRegisterGeneralError(null);
              setShowRegisterModal(true);
            }}
          >
            <IconUserPlus size={16} />
            <span>+ Register Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="emp-stats-grid">
        <div className="emp-stat-card">
          <div className="stat-icon-wrapper total-icon">
            <IconUsers size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Total Customers</span>
            <span className="stat-value">{stats.total}</span>
            <span className="stat-desc">Registered profiles in ledger</span>
          </div>
        </div>

        <div className="emp-stat-card">
          <div className="stat-icon-wrapper active-icon">
            <IconUserCheck size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Active Users</span>
            <span className="stat-value text-success">{stats.active}</span>
            <span className="stat-desc">Operational retail credentials</span>
          </div>
        </div>

        <div className="emp-stat-card">
          <div className="stat-icon-wrapper info-icon">
            <IconShield size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Data Privacy</span>
            <span className="stat-value" style={{ fontSize: '1.25rem', color: '#c084fc' }}>ENFORCED</span>
            <span className="stat-desc">Horizontal isolation (NFR-03)</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="table-controls-card">
        <div className="search-input-wrapper">
          <IconSearch size={16} className="search-icon" />
          <input
            id="customer-search-input"
            type="text"
            className="search-input"
            placeholder="Search by customer name, email, phone, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <IconX size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="emp-table-card">
        {loading ? (
          <div className="table-skeleton-container" style={{ padding: '2rem' }}>
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : fetchError ? (
          <div className="empty-state-box" style={{ padding: '2.5rem' }}>
            <IconAlertCircle size={32} className="empty-state-icon text-danger" />
            <h3>Unable to Load Customers</h3>
            <p>{fetchError}</p>
            <button type="button" className="btn-primary-custom" onClick={loadCustomers} style={{ marginTop: '1rem' }}>
              Retry
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty-state-box" style={{ padding: '2.5rem' }}>
            <IconUsers size={32} className="empty-state-icon" />
            <h3>No Customers Found</h3>
            <p>{searchQuery ? 'No customer records match your search criteria.' : 'No customers have been registered yet.'}</p>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="emp-table-custom">
              <thead>
                <tr>
                  <th>Customer ID</th>
                  <th>Full Name &amp; Username</th>
                  <th>Date of Birth</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust) => (
                  <tr key={cust.customerId}>
                    <td className="font-mono" style={{ fontWeight: 600, color: '#94a3b8' }}>
                      #{cust.customerId}
                    </td>
                    <td>
                      <div className="cust-name-cell">
                        <span className="cust-primary-name">{cust.fullName}</span>
                        <span className="cust-username-tag font-mono">@{cust.username}</span>
                      </div>
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
                      {cust.dateOfBirth ? cust.dateOfBirth.slice(0, 10) : '—'}
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.825rem' }}>
                      {cust.phone}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.825rem' }}>
                      {cust.email}
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.825rem', color: '#94a3b8' }} title={cust.address}>
                      {cust.address}
                    </td>
                    <td>
                      <span className={`status-badge-custom badge-${String(cust.userStatus).toLowerCase()}`}>
                        <span className="status-dot" />
                        <span>{cust.userStatus}</span>
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell-wrapper">
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => setViewingCustomer(cust)}
                          title="View customer profile details (FR-05)"
                        >
                          <IconEye size={13} />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => openEditModal(cust)}
                          title="Update customer information (FR-06)"
                        >
                          <IconEdit size={13} />
                          <span>Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================
          PORTAL: REGISTER CUSTOMER MODAL (FR-04, NFR-04, NFR-18)
          ======================================================================== */}
      {showRegisterModal && createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-customer-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !registerSubmitting) {
              setShowRegisterModal(false);
            }
          }}
        >
          <div className="modal-card" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div className="modal-title-box">
                <IconUserPlus size={22} className="modal-header-icon" />
                <h3 id="register-customer-dialog-title">Register New Customer</h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowRegisterModal(false)}
                disabled={registerSubmitting}
                aria-label="Close dialog"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit}>
              <div className="modal-body-scrollable">
                {registerGeneralError && (
                  <div className="modal-banner-error" role="alert">
                    {registerGeneralError}
                  </div>
                )}

                <div className="form-grid-2col">
                  <div>
                    <label htmlFor="reg-fullname" className="form-label">
                      <span>Full Name</span> <span className="text-danger">*</span>
                    </label>
                    <input
                      id="reg-fullname"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Johnathan Doe"
                      value={registerForm.fullName}
                      onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                      disabled={registerSubmitting}
                      maxLength={100}
                    />
                    {registerErrors.fullName && <div className="field-error-msg">{registerErrors.fullName}</div>}
                  </div>

                  <div>
                    <label htmlFor="reg-dob" className="form-label">
                      <span>Date of Birth</span> <span className="text-danger">*</span>
                    </label>
                    <input
                      id="reg-dob"
                      type="date"
                      className="form-input"
                      value={registerForm.dateOfBirth}
                      onChange={(e) => setRegisterForm({ ...registerForm, dateOfBirth: e.target.value })}
                      disabled={registerSubmitting}
                    />
                    {registerErrors.dateOfBirth && <div className="field-error-msg">{registerErrors.dateOfBirth}</div>}
                  </div>
                </div>

                <div className="form-grid-2col">
                  <div>
                    <label htmlFor="reg-phone" className="form-label">
                      <span>Phone Number</span> <span className="text-danger">*</span>
                    </label>
                    <input
                      id="reg-phone"
                      type="text"
                      className="form-input"
                      placeholder="e.g. 9876543210"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      disabled={registerSubmitting}
                      maxLength={20}
                    />
                    {registerErrors.phone && <div className="field-error-msg">{registerErrors.phone}</div>}
                  </div>

                  <div>
                    <label htmlFor="reg-email" className="form-label">
                      <span>Email Address</span> <span className="text-danger">*</span>
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      className="form-input"
                      placeholder="e.g. customer@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      disabled={registerSubmitting}
                      maxLength={100}
                    />
                    {registerErrors.email && <div className="field-error-msg">{registerErrors.email}</div>}
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-address" className="form-label">
                    <span>Residential Address</span> <span className="text-danger">*</span>
                  </label>
                  <input
                    id="reg-address"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 42 Baker Street, Financial District, Bangalore"
                    value={registerForm.address}
                    onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                    disabled={registerSubmitting}
                    maxLength={255}
                  />
                  {registerErrors.address && <div className="field-error-msg">{registerErrors.address}</div>}
                </div>

                <div className="form-grid-2col" style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div>
                    <label htmlFor="reg-username" className="form-label">
                      <span>Portal Username</span> <span className="text-danger">*</span>
                    </label>
                    <input
                      id="reg-username"
                      type="text"
                      className="form-input"
                      placeholder="e.g. john.doe"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      disabled={registerSubmitting}
                      maxLength={50}
                    />
                    {registerErrors.username && <div className="field-error-msg">{registerErrors.username}</div>}
                  </div>

                  <div>
                    <label htmlFor="reg-password" className="form-label">
                      <span>Initial Password</span> <span className="text-danger">*</span>
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      className="form-input"
                      placeholder="Min. 8 characters"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      disabled={registerSubmitting}
                    />
                    {registerErrors.password && <div className="field-error-msg">{registerErrors.password}</div>}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setShowRegisterModal(false)}
                  disabled={registerSubmitting}
                >
                  Cancel
                </button>
                <button
                  id="confirm-register-customer-btn"
                  type="submit"
                  className="btn-primary-custom"
                  disabled={registerSubmitting}
                >
                  {registerSubmitting ? (
                    <>
                      <IconRefreshCw size={15} className="spin-icon" />
                      <span>Registering Customer...</span>
                    </>
                  ) : (
                    <>
                      <IconUserPlus size={16} />
                      <span>Register Customer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================
          PORTAL: EDIT CUSTOMER MODAL (FR-06, NFR-04, NFR-18)
          ======================================================================== */}
      {editingCustomer && createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-customer-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !editSubmitting) {
              setEditingCustomer(null);
            }
          }}
        >
          <div className="modal-card" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div className="modal-title-box">
                <IconEdit size={20} className="modal-header-icon" />
                <h3 id="edit-customer-dialog-title">Edit Customer Profile</h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setEditingCustomer(null)}
                disabled={editSubmitting}
                aria-label="Close dialog"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body-scrollable">
                {editGeneralError && (
                  <div className="modal-banner-error" role="alert">
                    {editGeneralError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', background: '#090e1a', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <span style={{ fontSize: '0.725rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Customer ID</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f8fafc' }}>#{editingCustomer.customerId}</span>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.725rem', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Username</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#60a5fa' }}>@{editingCustomer.username}</span>
                  </div>
                </div>

                <div className="form-grid-2col">
                  <div>
                    <label htmlFor="edit-fullname" className="form-label">
                      <span>Full Name</span> <span className="text-danger">*</span>
                    </label>
                    <input
                      id="edit-fullname"
                      type="text"
                      className="form-input"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      disabled={editSubmitting}
                      maxLength={100}
                    />
                    {editErrors.fullName && <div className="field-error-msg">{editErrors.fullName}</div>}
                  </div>

                  <div>
                    <label htmlFor="edit-dob" className="form-label">
                      <span>Date of Birth</span> <span className="text-danger">*</span>
                    </label>
                    <input
                      id="edit-dob"
                      type="date"
                      className="form-input"
                      value={editForm.dateOfBirth}
                      onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                      disabled={editSubmitting}
                    />
                    {editErrors.dateOfBirth && <div className="field-error-msg">{editErrors.dateOfBirth}</div>}
                  </div>
                </div>

                <div className="form-grid-2col">
                  <div>
                    <label htmlFor="edit-phone" className="form-label">
                      <span>Phone Number</span> <span className="text-danger">*</span>
                    </label>
                    <input
                      id="edit-phone"
                      type="text"
                      className="form-input"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      disabled={editSubmitting}
                      maxLength={20}
                    />
                    {editErrors.phone && <div className="field-error-msg">{editErrors.phone}</div>}
                  </div>

                  <div>
                    <label htmlFor="edit-email" className="form-label">
                      <span>Email Address</span> <span className="text-danger">*</span>
                    </label>
                    <input
                      id="edit-email"
                      type="email"
                      className="form-input"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      disabled={editSubmitting}
                      maxLength={100}
                    />
                    {editErrors.email && <div className="field-error-msg">{editErrors.email}</div>}
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-address" className="form-label">
                    <span>Residential Address</span> <span className="text-danger">*</span>
                  </label>
                  <input
                    id="edit-address"
                    type="text"
                    className="form-input"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    disabled={editSubmitting}
                    maxLength={255}
                  />
                  {editErrors.address && <div className="field-error-msg">{editErrors.address}</div>}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setEditingCustomer(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  id="confirm-edit-customer-btn"
                  type="submit"
                  className="btn-primary-custom"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? (
                    <>
                      <IconRefreshCw size={15} className="spin-icon" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <IconCheckCircle size={16} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================
          PORTAL: VIEW CUSTOMER PROFILE MODAL (FR-05)
          ======================================================================== */}
      {viewingCustomer && createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-customer-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingCustomer(null);
          }}
        >
          <div className="modal-card" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div className="modal-title-box">
                <IconEye size={20} className="modal-header-icon" />
                <h3 id="view-customer-dialog-title">Customer Profile #{viewingCustomer.customerId}</h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setViewingCustomer(null)}
                aria-label="Close dialog"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="modal-body-scrollable">
              <div className="profile-detail-grid">
                <div className="profile-detail-card">
                  <span className="profile-detail-label">Full Name</span>
                  <span className="profile-detail-value">{viewingCustomer.fullName}</span>
                </div>

                <div className="profile-detail-card">
                  <span className="profile-detail-label">Username</span>
                  <span className="profile-detail-value font-mono text-primary">@{viewingCustomer.username}</span>
                </div>

                <div className="profile-detail-card">
                  <span className="profile-detail-label">Customer ID</span>
                  <span className="profile-detail-value font-mono">#{viewingCustomer.customerId}</span>
                </div>

                <div className="profile-detail-card">
                  <span className="profile-detail-label">Date of Birth</span>
                  <span className="profile-detail-value font-mono">
                    {viewingCustomer.dateOfBirth ? viewingCustomer.dateOfBirth.slice(0, 10) : '—'}
                  </span>
                </div>

                <div className="profile-detail-card">
                  <span className="profile-detail-label">Phone</span>
                  <span className="profile-detail-value font-mono">{viewingCustomer.phone}</span>
                </div>

                <div className="profile-detail-card">
                  <span className="profile-detail-label">Email</span>
                  <span className="profile-detail-value">{viewingCustomer.email}</span>
                </div>

                <div className="profile-detail-card span-full">
                  <span className="profile-detail-label">Residential Address</span>
                  <span className="profile-detail-value">{viewingCustomer.address}</span>
                </div>

                <div className="profile-detail-card">
                  <span className="profile-detail-label">User Status</span>
                  <span className={`status-badge-custom badge-${String(viewingCustomer.userStatus).toLowerCase()}`} style={{ width: 'fit-content', marginTop: '0.2rem' }}>
                    <span className="status-dot" />
                    <span>{viewingCustomer.userStatus}</span>
                  </span>
                </div>

                <div className="profile-detail-card">
                  <span className="profile-detail-label">Registration Date</span>
                  <span className="profile-detail-value font-mono" style={{ fontSize: '0.8rem' }}>
                    {viewingCustomer.createdAt ? new Date(viewingCustomer.createdAt).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={() => setViewingCustomer(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary-custom"
                onClick={() => {
                  const target = viewingCustomer;
                  setViewingCustomer(null);
                  openEditModal(target);
                }}
              >
                <IconEdit size={15} />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
