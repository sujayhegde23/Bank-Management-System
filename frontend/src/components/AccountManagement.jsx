import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  getAccounts,
  getAccount,
  createAccount,
  updateAccountStatus,
  getCustomers,
  depositFunds,
  withdrawFunds,
  getAccountTransactions
} from '../services/api';
import './AccountManagement.css';

/* ==============================================================================
   Lucide-style Inline SVG Icons (Project-compatible, zero-dependency)
   ============================================================================== */

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

function IconCheckCircle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconPauseCircle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="10" y1="15" x2="10" y2="9" />
      <line x1="14" y1="15" x2="14" y2="9" />
    </svg>
  );
}

function IconSnowflake({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="12" y1="8" x2="9" y2="5" />
      <line x1="12" y1="8" x2="15" y2="5" />
      <line x1="12" y1="16" x2="9" y2="19" />
      <line x1="12" y1="16" x2="15" y2="19" />
      <line x1="20" y1="7" x2="4" y2="17" />
      <line x1="4" y1="7" x2="20" y2="17" />
    </svg>
  );
}

function IconPlus({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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

function IconShieldAlert({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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


function IconArrowDownCircle({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 12 16 16 12" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  );
}

function IconArrowUpCircle({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 12 12 8 8 12" />
      <line x1="12" y1="16" x2="12" y2="8" />
    </svg>
  );
}

function IconHistory({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
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

/* ==============================================================================
   Currency Formatter (INR - ₹)
   ============================================================================== */
function formatINR(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/* ==============================================================================
   Main Component: AccountManagement
   ============================================================================== */
export default function AccountManagement({ currentUser, initialAction = null, onActionConsumed }) {
  const isEmployee = currentUser?.role === 'EMPLOYEE';
  const isAdmin = currentUser?.role === 'ADMIN';

  // Data state
  const [accounts, setAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE, FROZEN
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, SAVINGS, CURRENT

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Create Account Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerId: '',
    accountType: 'SAVINGS'
  });
  const [createErrors, setCreateErrors] = useState({});

  // View Details Modal
  const [viewingAccount, setViewingAccount] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Status Change Dialog
  const [statusDialog, setStatusDialog] = useState(null);

  // Transaction Modals (Issue #8)
  const [depositDialog, setDepositDialog] = useState(null);
  const [withdrawDialog, setWithdrawDialog] = useState(null);
  const [accountTransactions, setAccountTransactions] = useState([]);

  // References
  const isMountedRef = useRef(true);
  const activeRequestIdRef = useRef(0);
  const createModalRef = useRef(null);
  const viewModalRef = useRef(null);
  const statusModalRef = useRef(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleOpenDeposit = useCallback((account = null) => {
    const target = account || accounts.find((a) => a.status === 'ACTIVE') || accounts[0] || null;
    setDepositDialog({
      account: target,
      amount: '',
      remarks: '',
      error: null,
      isSubmitting: false
    });
  }, [accounts]);

  const handleOpenWithdraw = useCallback((account = null) => {
    const target = account || accounts.find((a) => a.status === 'ACTIVE') || accounts[0] || null;
    setWithdrawDialog({
      account: target,
      amount: '',
      remarks: '',
      error: null,
      isSubmitting: false
    });
  }, [accounts]);

  // Handle direct navigation to deposit/withdraw from sidebar
  useEffect(() => {
    if (!isEmployee || !initialAction || accounts.length === 0) return;

    const timer = setTimeout(() => {
      const active = accounts.find((a) => a.status === 'ACTIVE') || accounts[0];
      if (initialAction === 'deposit') {
        handleOpenDeposit(active);
      } else if (initialAction === 'withdraw') {
        handleOpenWithdraw(active);
      }
      if (onActionConsumed) onActionConsumed();
    }, 0);

    return () => clearTimeout(timer);
  }, [isEmployee, initialAction, accounts, onActionConsumed, handleOpenDeposit, handleOpenWithdraw]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch accounts from the backend API.
   */
  const fetchAccounts = useCallback(async (isSilent = false) => {
    const requestId = ++activeRequestIdRef.current;
    if (!isSilent) setLoading(true);
    setFetchError(null);

    try {
      const data = await getAccounts();
      if (!isMountedRef.current || requestId !== activeRequestIdRef.current) return;
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!isMountedRef.current || requestId !== activeRequestIdRef.current) return;
      console.error('Failed to fetch accounts:', err);
      setFetchError(err.message || 'Unable to load bank accounts. Please check server connectivity.');
    } finally {
      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        if (!isSilent) setLoading(false);
      }
    }
  }, []);

  /**
   * Fetch registered customers directory for lookup in Create Account modal.
   */
  const fetchCustomerDirectory = useCallback(async () => {
    try {
      const data = await getCustomers();
      if (isMountedRef.current) {
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Could not pre-load customer directory:', err.message);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore && isMountedRef.current) {
        fetchAccounts().catch(() => {});
        if (isEmployee || isAdmin) {
          fetchCustomerDirectory().catch(() => {});
        }
      }
    });
    return () => {
      ignore = true;
    };
  }, [fetchAccounts, fetchCustomerDirectory, isEmployee, isAdmin]);

  // Escape key handler for accessible modal closing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (depositDialog && !depositDialog.isSubmitting) setDepositDialog(null);
        else if (withdrawDialog && !withdrawDialog.isSubmitting) setWithdrawDialog(null);
        else if (statusDialog) setStatusDialog(null);
        else if (viewingAccount) setViewingAccount(null);
        else if (showCreateModal) setShowCreateModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [depositDialog, withdrawDialog, statusDialog, viewingAccount, showCreateModal]);

  /**
   * Dynamically calculated summary cards from real accounts
   */
  const statistics = useMemo(() => {
    const total = accounts.length;
    let active = 0;
    let inactive = 0;
    let frozen = 0;

    for (const acc of accounts) {
      if (acc.status === 'ACTIVE') active++;
      else if (acc.status === 'INACTIVE') inactive++;
      else if (acc.status === 'FROZEN') frozen++;
    }

    return { total, active, inactive, frozen };
  }, [accounts]);

  /**
   * Real-time filtered accounts based on search query, status, and type
   */
  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return accounts.filter((acc) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && acc.status !== statusFilter) {
        return false;
      }

      // 2. Account Type Filter
      if (typeFilter !== 'ALL' && acc.accountType !== typeFilter) {
        return false;
      }

      // 3. Search Query
      if (!q) return true;

      const numMatch = String(acc.accountNumber || '').toLowerCase().includes(q);
      const nameMatch = String(acc.customerName || '').toLowerCase().includes(q);
      const emailMatch = String(acc.customerEmail || '').toLowerCase().includes(q);
      const phoneMatch = String(acc.customerPhone || '').toLowerCase().includes(q);
      const idMatch = String(acc.customerId || '').includes(q);

      return numMatch || nameMatch || emailMatch || phoneMatch || idMatch;
    });
  }, [accounts, searchQuery, statusFilter, typeFilter]);

  /**
   * Handle opening View Details modal (fetches fresh record from API)
   */
  const handleOpenDetails = async (accountId) => {
    setViewLoading(true);
    setViewingAccount({ accountId }); // placeholder with ID while fetching
    setAccountTransactions([]);
    try {
      const [fresh, txnsData] = await Promise.all([
        getAccount(accountId),
        getAccountTransactions(accountId, { page: 1, size: 10 }).catch(() => null)
      ]);
      if (isMountedRef.current) {
        setViewingAccount(fresh);
        if (txnsData?.transactions) {
          setAccountTransactions(txnsData.transactions);
        }
      }
    } catch (err) {
      console.error('Error fetching account details:', err);
      setToast({
        type: 'error',
        message: `Failed to load details: ${err.message}`
      });
      setViewingAccount(null);
    } finally {
      if (isMountedRef.current) {
        setViewLoading(false);
      }
    }
  };



  /**
   * Execute Cash Deposit (FR-12, FR-18, FR-19, TC-05)
   */
  const handleExecuteDeposit = async (e) => {
    e.preventDefault();
    if (!depositDialog?.account?.accountId) {
      setDepositDialog((prev) => ({ ...prev, error: 'Please select an eligible active account.' }));
      return;
    }
    const amtStr = String(depositDialog.amount).trim();
    if (!amtStr || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(amtStr) || Number(amtStr) <= 0) {
      setDepositDialog((prev) => ({ ...prev, error: 'Please enter a valid positive monetary amount (e.g. 500.00).' }));
      return;
    }

    setDepositDialog((prev) => ({ ...prev, isSubmitting: true, error: null }));
    try {
      const res = await depositFunds(depositDialog.account.accountId, amtStr, depositDialog.remarks);
      setToast({
        type: 'success',
        message: `Deposit of ${formatINR(amtStr)} completed! Ref: ${res.transactionReference || res.transaction_reference || 'COMPLETED'}. New balance: ${formatINR(res.newBalance || res.new_balance)}`
      });
      setDepositDialog(null);
      await fetchAccounts(true);
      if (viewingAccount?.accountId === depositDialog.account.accountId) {
        handleOpenDetails(depositDialog.account.accountId);
      }
    } catch (err) {
      console.error('Deposit execution error:', err);
      setDepositDialog((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Deposit failed. Please check the amount and try again.'
      }));
    }
  };



  /**
   * Execute Cash Withdrawal (FR-13, FR-14, FR-18, FR-19, TC-06, TC-15)
   */
  const handleExecuteWithdraw = async (e) => {
    e.preventDefault();
    if (!withdrawDialog?.account?.accountId) {
      setWithdrawDialog((prev) => ({ ...prev, error: 'Please select an eligible active account.' }));
      return;
    }
    const amtStr = String(withdrawDialog.amount).trim();
    if (!amtStr || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(amtStr) || Number(amtStr) <= 0) {
      setWithdrawDialog((prev) => ({ ...prev, error: 'Please enter a valid positive monetary amount (e.g. 500.00).' }));
      return;
    }
    const currentBal = Number(withdrawDialog.account.balance) || 0;
    if (Number(amtStr) > currentBal) {
      setWithdrawDialog((prev) => ({
        ...prev,
        error: `Insufficient balance. Maximum available for withdrawal is ${formatINR(currentBal)} (FR-14).`
      }));
      return;
    }

    setWithdrawDialog((prev) => ({ ...prev, isSubmitting: true, error: null }));
    try {
      const res = await withdrawFunds(withdrawDialog.account.accountId, amtStr, withdrawDialog.remarks);
      setToast({
        type: 'success',
        message: `Withdrawal of ${formatINR(amtStr)} completed! Ref: ${res.transactionReference || res.transaction_reference || 'COMPLETED'}. Remaining balance: ${formatINR(res.newBalance || res.new_balance)}`
      });
      setWithdrawDialog(null);
      await fetchAccounts(true);
      if (viewingAccount?.accountId === withdrawDialog.account.accountId) {
        handleOpenDetails(withdrawDialog.account.accountId);
      }
    } catch (err) {
      console.error('Withdrawal execution error:', err);
      setWithdrawDialog((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Withdrawal failed. Please check the amount and try again.'
      }));
    }
  };

  /**
   * Handle Create Account Form Validation & Submission
   */
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!createForm.customerId) {
      errors.customerId = 'Please select a registered customer.';
    }

    if (!createForm.accountType) {
      errors.accountType = 'Please select an account type.';
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    setCreateErrors({});
    setActionLoading(true);

    try {
      const created = await createAccount({
        customerId: Number(createForm.customerId),
        accountType: createForm.accountType
      });

      setShowCreateModal(false);
      setCreateForm({ customerId: '', accountType: 'SAVINGS' });

      setToast({
        type: 'success',
        message: `Account ${created.accountNumber} successfully created for ${created.customerName}!`
      });

      // Refresh accounts list
      await fetchAccounts(true);
    } catch (err) {
      console.error('Account creation error:', err);
      if (err.details && Array.isArray(err.details)) {
        const fieldErrMap = {};
        err.details.forEach((item) => {
          if (item.field) fieldErrMap[item.field] = item.issue;
        });
        setCreateErrors(fieldErrMap);
      } else {
        setToast({
          type: 'error',
          message: err.message || 'Failed to create account. Please verify input.'
        });
      }
    } finally {
      if (isMountedRef.current) {
        setActionLoading(false);
      }
    }
  };

  /**
   * Handle Status Change Dialog Confirm
   */
  const handleConfirmStatusChange = async () => {
    if (!statusDialog?.account?.accountId || !statusDialog.targetStatus) return;

    setActionLoading(true);
    const { account, targetStatus, reason } = statusDialog;

    try {
      await updateAccountStatus(account.accountId, targetStatus, reason);

      setToast({
        type: 'success',
        message: `Account ${account.accountNumber} status updated to ${targetStatus}.`
      });

      setStatusDialog(null);
      if (viewingAccount?.accountId === account.accountId) {
        // Also update view modal if open
        setViewingAccount((prev) => (prev ? { ...prev, status: targetStatus } : null));
      }

      // Refresh list
      await fetchAccounts(true);
    } catch (err) {
      console.error('Status update failed:', err);
      setToast({
        type: 'error',
        message: err.message || 'Failed to update account status.'
      });
    } finally {
      if (isMountedRef.current) {
        setActionLoading(false);
      }
    }
  };

  // Role-Based Clearance Guard (FR-03, AUTH_002)
  if (!isEmployee && !isAdmin) {
    return (
      <div className="account-mgmt-container">
        <div className="empty-state-box" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <IconShieldAlert size={44} className="text-warning" style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: '#f8fafc', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Access Restricted (FR-03)</h3>
          <p style={{ color: '#94a3b8', maxWidth: '460px', margin: '0 auto', lineHeight: 1.5 }}>
            Branch Account Administration and Counter Cash Operations are strictly restricted to authorized bank employees. Customers cannot perform counter cash operations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-mgmt-container">
      {/* Toast Notification Container */}
      {toast && (
        <div className={`toast-alert-banner toast-${toast.type}`} role="alert">
          <div className="toast-icon">
            {toast.type === 'success' ? <IconCheckCircle size={18} /> : <IconAlertCircle size={18} />}
          </div>
          <div className="toast-message">{toast.message}</div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setToast(null)}
            aria-label="Close notification"
          >
            <IconX size={15} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="emp-page-header">
        <div>
          <h1 className="emp-page-title">Account Management</h1>
          <p className="emp-page-subtitle">
            Create bank accounts, review balances, and manage account status.
          </p>
        </div>
        <div className="header-actions-row">
          <button
            type="button"
            className="btn-secondary-custom"
            onClick={() => fetchAccounts()}
            disabled={loading}
            title="Refresh accounts list from MySQL"
          >
            <IconRefreshCw size={15} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          {isEmployee && (
            <>
              <button
                id="quick-deposit-btn"
                type="button"
                className="btn-action-deposit header-btn-deposit"
                onClick={() => handleOpenDeposit()}
                title="Quick cash deposit into an active account (FR-12)"
              >
                <IconArrowDownCircle size={15} />
                <span>Deposit Cash</span>
              </button>
              <button
                id="quick-withdraw-btn"
                type="button"
                className="btn-action-withdraw header-btn-withdraw"
                onClick={() => handleOpenWithdraw()}
                title="Quick cash withdrawal from an active account (FR-13)"
              >
                <IconArrowUpCircle size={15} />
                <span>Withdraw Cash</span>
              </button>
              <button
                id="create-account-btn"
                type="button"
                className="btn-primary-custom"
                onClick={() => {
                  fetchCustomerDirectory();
                  setShowCreateModal(true);
                }}
              >
                <IconPlus size={16} />
                <span>Create Account</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Statistics Cards */}
      <div className="emp-stats-grid">
        <div className="emp-stat-card">
          <div className="stat-icon-wrapper total-icon">
            <IconLandmark size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Total Accounts</span>
            <span className="stat-value">{statistics.total}</span>
            <span className="stat-desc">All customer accounts</span>
          </div>
        </div>

        <div className="emp-stat-card">
          <div className="stat-icon-wrapper active-icon">
            <IconCheckCircle size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Active Accounts</span>
            <span className="stat-value text-success">{statistics.active}</span>
            <span className="stat-desc">Eligible for transactions</span>
          </div>
        </div>

        <div className="emp-stat-card">
          <div className="stat-icon-wrapper inactive-icon">
            <IconPauseCircle size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Inactive Accounts</span>
            <span className="stat-value text-warning">{statistics.inactive}</span>
            <span className="stat-desc">Transactions blocked (FR-11)</span>
          </div>
        </div>

        <div className="emp-stat-card">
          <div className="stat-icon-wrapper frozen-icon">
            <IconSnowflake size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Frozen Accounts</span>
            <span className="stat-value text-danger">{statistics.frozen}</span>
            <span className="stat-desc">Locked for compliance</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="table-controls-card">
        <div className="search-input-wrapper">
          <IconSearch size={16} className="search-icon" />
          <input
            id="account-search-input"
            type="text"
            className="search-input"
            placeholder="Search by account number, customer name, email, or ID..."
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

        <div className="filter-pills-row">
          <div className="filter-group">
            <span className="filter-label">Status:</span>
            {['ALL', 'ACTIVE', 'INACTIVE', 'FROZEN'].map((st) => (
              <button
                key={st}
                type="button"
                className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>

          <div className="filter-group">
            <span className="filter-label">Type:</span>
            {['ALL', 'SAVINGS', 'CURRENT'].map((tp) => (
              <button
                key={tp}
                type="button"
                className={`filter-pill ${typeFilter === tp ? 'active' : ''}`}
                onClick={() => setTypeFilter(tp)}
              >
                {tp === 'ALL' ? 'All' : tp}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table / State Render */}
      <div className="emp-table-card">
        {loading ? (
          /* Loading Skeleton Shimmer */
          <div className="table-skeleton-container">
            <div className="skeleton-row header-skeleton" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : fetchError ? (
          /* Error State */
          <div className="error-state-box">
            <IconAlertCircle size={32} className="error-state-icon" />
            <h3>Unable to Load Accounts</h3>
            <p>{fetchError}</p>
            <button
              type="button"
              className="btn-primary-custom"
              onClick={() => fetchAccounts()}
            >
              Retry Connection
            </button>
          </div>
        ) : filteredAccounts.length === 0 ? (
          /* Empty or No-Results State */
          <div className="empty-state-box">
            <IconCreditCard size={36} className="empty-state-icon" />
            {accounts.length === 0 ? (
              <>
                <h3>No Bank Accounts Found</h3>
                <p>No accounts currently exist in the database. Use "+ Create Account" to create the first account.</p>
                {isEmployee && (
                  <button
                    type="button"
                    className="btn-primary-custom"
                    onClick={() => setShowCreateModal(true)}
                  >
                    + Create First Account
                  </button>
                )}
              </>
            ) : (
              <>
                <h3>No Matching Accounts</h3>
                <p>No accounts match the active search criteria or filters.</p>
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setTypeFilter('ALL');
                  }}
                >
                  Reset Filters
                </button>
              </>
            )}
          </div>
        ) : (
          /* Real Data Table */
          <div className="table-responsive-wrapper">
            <table className="emp-table-custom">
              <thead>
                <tr>
                  <th>Account Number</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Current Balance</th>
                  <th>Status</th>
                  <th>Opened Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((acc) => {
                  const isAccActive = acc.status === 'ACTIVE';
                  const isAccFrozen = acc.status === 'FROZEN';
                  const isAccInactive = acc.status === 'INACTIVE';

                  return (
                    <tr key={acc.accountId} className="table-data-row">
                      {/* Account Number */}
                      <td>
                        <div className="account-number-cell">
                          <span className="acc-number-text">{acc.accountNumber}</span>
                          <span className="acc-id-sub">ID #{acc.accountId}</span>
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td>
                        <div className="customer-info-cell">
                          <span className="customer-name-text">{acc.customerName}</span>
                          <span className="customer-contact-text">
                            CID #{acc.customerId} &bull; {acc.customerPhone || acc.customerEmail}
                          </span>
                        </div>
                      </td>

                      {/* Account Type */}
                      <td>
                        <span className={`acc-type-pill ${acc.accountType === 'SAVINGS' ? 'type-savings' : 'type-current'}`}>
                          {acc.accountType}
                        </span>
                      </td>

                      {/* Balance (Formatted in INR ₹) */}
                      <td>
                        <span className="acc-balance-text">
                          {formatINR(acc.balance)}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td>
                        <span className={`status-badge-custom badge-${acc.status.toLowerCase()}`}>
                          <span className="status-dot" />
                          <span>{acc.status}</span>
                        </span>
                      </td>

                      {/* Opening Date */}
                      <td>
                        <span className="date-text">
                          {acc.openedAt ? new Date(acc.openedAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : '—'}
                        </span>
                      </td>

                      {/* Action Menu / Buttons */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions-row">
                          <button
                            type="button"
                            className="btn-action-view"
                            onClick={() => handleOpenDetails(acc.accountId)}
                            title="View account balance and details"
                          >
                            <IconEye size={14} />
                            <span>View</span>
                          </button>

                          {isEmployee && (
                            <div className="status-action-dropdown">
                              {isAccActive && (
                                <>
                                  <button
                                    type="button"
                                    className="btn-action-deposit"
                                    onClick={() => handleOpenDeposit(acc)}
                                    title="Deposit cash into account (FR-12)"
                                  >
                                    <IconArrowDownCircle size={13} />
                                    <span>Deposit</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-action-withdraw"
                                    onClick={() => handleOpenWithdraw(acc)}
                                    title="Withdraw cash from account (FR-13)"
                                  >
                                    <IconArrowUpCircle size={13} />
                                    <span>Withdraw</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-action-warn"
                                    onClick={() => setStatusDialog({
                                      account: acc,
                                      targetStatus: 'FROZEN',
                                      reason: ''
                                    })}
                                    title="Freeze account to prevent transactions (FR-11)"
                                  >
                                    Freeze
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-action-danger"
                                    onClick={() => setStatusDialog({
                                      account: acc,
                                      targetStatus: 'INACTIVE',
                                      reason: ''
                                    })}
                                    title="Deactivate account"
                                  >
                                    Deactivate
                                  </button>
                                </>
                              )}

                              {isAccFrozen && (
                                <button
                                  type="button"
                                  className="btn-action-success"
                                  onClick={() => setStatusDialog({
                                    account: acc,
                                    targetStatus: 'ACTIVE',
                                    reason: ''
                                  })}
                                  title="Unfreeze account to restore transaction capability"
                                >
                                  Unfreeze
                                </button>
                              )}

                              {isAccInactive && (
                                <button
                                  type="button"
                                  className="btn-action-success"
                                  onClick={() => setStatusDialog({
                                    account: acc,
                                    targetStatus: 'ACTIVE',
                                    reason: ''
                                  })}
                                  title="Reactivate account"
                                >
                                  Activate
                                </button>
                              )}
                            </div>
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

      {/* ========================================================================
          CREATE ACCOUNT MODAL (FR-07, FR-08)
          ======================================================================== */}
      {showCreateModal && createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div className="modal-card" ref={createModalRef}>
            <div className="modal-header">
              <div className="modal-title-box">
                <IconCreditCard size={20} className="modal-header-icon" />
                <h3 id="create-modal-title">Open New Bank Account</h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close dialog"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-form">
              {/* Customer Selector */}
              <div className="form-group">
                <label htmlFor="create-customer-select" className="form-label">
                  Registered Customer <span className="req-star">*</span>
                </label>
                <select
                  id="create-customer-select"
                  className={`form-input select-input ${createErrors.customerId ? 'input-error' : ''}`}
                  value={createForm.customerId}
                  onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
                  disabled={actionLoading}
                  required
                >
                  <option value="">-- Select Customer Profile --</option>
                  {customers.map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      CID #{c.customerId} &bull; {c.fullName} ({c.email})
                    </option>
                  ))}
                </select>
                {createErrors.customerId && (
                  <span className="field-error-text">{createErrors.customerId}</span>
                )}
                <span className="field-hint">
                  Only registered customer profiles can own bank accounts (FR-07).
                </span>
              </div>

              {/* Account Type Selector */}
              <div className="form-group">
                <label htmlFor="create-account-type" className="form-label">
                  Account Type <span className="req-star">*</span>
                </label>
                <select
                  id="create-account-type"
                  className={`form-input select-input ${createErrors.accountType ? 'input-error' : ''}`}
                  value={createForm.accountType}
                  onChange={(e) => setCreateForm({ ...createForm, accountType: e.target.value })}
                  disabled={actionLoading}
                >
                  <option value="SAVINGS">Savings Account (SAVINGS - Standard Individual)</option>
                  <option value="CURRENT">Current Account (CURRENT - Commercial/Business)</option>
                </select>
                {createErrors.accountType && (
                  <span className="field-error-text">{createErrors.accountType}</span>
                )}
              </div>

              {/* Opening Balance (Enforced 0.00) */}
              <div className="form-group">
                <label className="form-label">Initial Opening Balance</label>
                <div className="initial-balance-box">
                  <span className="initial-balance-value">₹0.00</span>
                  <span className="initial-balance-tag">Enforced by Bank Policy (FR-07)</span>
                </div>
                <span className="field-hint">
                  Opening deposits must be performed through the subsequent Cash Deposit workflow (FR-12).
                </span>
              </div>

              {/* Unique Number Notice */}
              <div className="info-notice-card">
                <IconLandmark size={18} className="notice-icon" />
                <div className="notice-content">
                  <strong>Automated Account Number Allocation</strong>
                  <p>
                    A unique 16-character account number (e.g. <code>ACC-SB-XXXXXXXX</code>) will be generated by the secure backend generator on creation.
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setShowCreateModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-custom"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Allocating Account...' : 'Confirm & Open Account'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================
          VIEW ACCOUNT DETAILS MODAL (FR-09)
          ======================================================================== */}
      {viewingAccount && createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingAccount(null);
          }}
        >
          <div className="modal-card view-modal-card" ref={viewModalRef}>
            <div className="modal-header">
              <div className="modal-title-box">
                <IconCreditCard size={20} className="modal-header-icon" />
                <h3 id="view-modal-title">
                  Account Details: {viewingAccount.accountNumber || `ID #${viewingAccount.accountId}`}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setViewingAccount(null)}
                aria-label="Close dialog"
              >
                <IconX size={18} />
              </button>
            </div>

            {viewLoading ? (
              <div className="modal-loading-box">
                <IconRefreshCw size={24} className="spin-icon" />
                <p>Retrieving verified account ledger details...</p>
              </div>
            ) : (
              <div className="view-modal-content">
                {/* Balance Hero Box */}
                <div className="balance-hero-box">
                  <div className="balance-hero-left">
                    <span className="hero-balance-label">Current Ledger Balance</span>
                    <span className="hero-balance-value">{formatINR(viewingAccount.balance)}</span>
                  </div>
                  <div className="balance-hero-right">
                    <span className={`status-badge-custom badge-${String(viewingAccount.status).toLowerCase()}`}>
                      <span className="status-dot" />
                      <span>{viewingAccount.status}</span>
                    </span>
                    <span className="hero-acc-type">{viewingAccount.accountType}</span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="details-fields-grid">
                  <div className="detail-item">
                    <span className="detail-label">Public Account Number</span>
                    <span className="detail-value font-mono">{viewingAccount.accountNumber}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Internal System ID</span>
                    <span className="detail-value">#{viewingAccount.accountId}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Account Owner</span>
                    <span className="detail-value">{viewingAccount.customerName}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Customer ID</span>
                    <span className="detail-value">CID #{viewingAccount.customerId}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Contact Email</span>
                    <span className="detail-value">{viewingAccount.customerEmail || '—'}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Contact Phone</span>
                    <span className="detail-value">{viewingAccount.customerPhone || '—'}</span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Opening Date</span>
                    <span className="detail-value">
                      {viewingAccount.openedAt ? new Date(viewingAccount.openedAt).toLocaleString() : '—'}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Last Updated</span>
                    <span className="detail-value">
                      {viewingAccount.updatedAt ? new Date(viewingAccount.updatedAt).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>


                {/* Cash & Counter Operations for Staff (Issue #8) */}
                {isEmployee && (
                  <div className="modal-status-actions-box">
                    <span className="box-title">Counter Operations (Deposit / Withdrawal)</span>
                    <div className="actions-button-group">
                      <button
                        type="button"
                        className="btn-action-deposit"
                        disabled={viewingAccount.status !== 'ACTIVE'}
                        onClick={() => setDepositDialog({
                          account: viewingAccount,
                          amount: '',
                          remarks: '',
                          error: null
                        })}
                        title={viewingAccount.status === 'ACTIVE' ? 'Deposit funds into this account' : 'Deposits blocked for non-active account (FR-11)'}
                      >
                        <IconArrowDownCircle size={14} />
                        <span>Deposit Cash</span>
                      </button>

                      <button
                        type="button"
                        className="btn-action-withdraw"
                        disabled={viewingAccount.status !== 'ACTIVE'}
                        onClick={() => setWithdrawDialog({
                          account: viewingAccount,
                          amount: '',
                          remarks: '',
                          error: null
                        })}
                        title={viewingAccount.status === 'ACTIVE' ? 'Withdraw funds from this account' : 'Withdrawals blocked for non-active account (FR-11)'}
                      >
                        <IconArrowUpCircle size={14} />
                        <span>Withdraw Cash</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Account Transaction Ledger (FR-20, FR-21) */}
                <div className="view-modal-ledger-section">
                  <div className="ledger-header-row">
                    <div className="ledger-title-group">
                      <IconHistory size={16} className="text-info" />
                      <span className="box-title" style={{ margin: 0 }}>Recent Account Ledger</span>
                    </div>
                    <span className="ledger-count-tag">{accountTransactions.length} records</span>
                  </div>

                  {accountTransactions.length === 0 ? (
                    <div className="empty-ledger-box">
                      <span>No recorded transactions for this account yet.</span>
                    </div>
                  ) : (
                    <div className="table-responsive-wrapper mini-ledger-table-wrap">
                      <table className="emp-table-custom mini-ledger-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Reference</th>
                            <th>Amount</th>
                            <th>Date &amp; Time</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountTransactions.map((tx) => (
                            <tr key={tx.transactionId || tx.transactionRef}>
                              <td>
                                <span className={`txn-type-badge type-${tx.type?.toLowerCase()}`}>
                                  {tx.type}
                                </span>
                              </td>
                              <td>
                                <span className="font-mono text-muted" style={{ fontSize: '0.75rem' }}>
                                  {tx.transactionRef}
                                </span>
                              </td>
                              <td>
                                <span className={`txn-amt-text ${tx.direction === 'CREDIT' || tx.type === 'DEPOSIT' ? 'text-credit' : 'text-debit'}`}>
                                  {tx.direction === 'CREDIT' || tx.type === 'DEPOSIT' ? '+' : '-'} {formatINR(tx.amount)}
                                </span>
                              </td>
                              <td>
                                <span className="date-text" style={{ fontSize: '0.75rem' }}>
                                  {new Date(tx.timestamp).toLocaleString('en-IN', {
                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  })}
                                </span>
                              </td>
                              <td>
                                <span className="remarks-text" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                  {tx.remarks || '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Quick Status Modifiers for Staff */}
                {isEmployee && (
                  <div className="modal-status-actions-box">
                    <span className="box-title">Change Operational Status</span>
                    <div className="actions-button-group">
                      {viewingAccount.status !== 'ACTIVE' && (
                        <button
                          type="button"
                          className="btn-action-success"
                          onClick={() => setStatusDialog({
                            account: viewingAccount,
                            targetStatus: 'ACTIVE',
                            reason: ''
                          })}
                        >
                          Activate / Unfreeze
                        </button>
                      )}
                      {viewingAccount.status !== 'FROZEN' && (
                        <button
                          type="button"
                          className="btn-action-warn"
                          onClick={() => setStatusDialog({
                            account: viewingAccount,
                            targetStatus: 'FROZEN',
                            reason: ''
                          })}
                        >
                          Freeze Account
                        </button>
                      )}
                      {viewingAccount.status !== 'INACTIVE' && (
                        <button
                          type="button"
                          className="btn-action-danger"
                          onClick={() => setStatusDialog({
                            account: viewingAccount,
                            targetStatus: 'INACTIVE',
                            reason: ''
                          })}
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="modal-actions-row">
                  <button
                    type="button"
                    className="btn-secondary-custom"
                    onClick={() => setViewingAccount(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================
          STATUS CHANGE CONFIRMATION DIALOG (FR-10, FR-11)
          ======================================================================== */}
      {statusDialog && createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setStatusDialog(null);
          }}
        >
          <div className="modal-card status-modal-card" ref={statusModalRef}>
            <div className="modal-header">
              <div className="modal-title-box">
                <IconShieldAlert
                  size={22}
                  className={`modal-header-icon ${
                    statusDialog.targetStatus === 'ACTIVE'
                      ? 'text-success'
                      : statusDialog.targetStatus === 'FROZEN'
                      ? 'text-info'
                      : 'text-warning'
                  }`}
                />
                <h3 id="status-dialog-title">
                  Confirm Account Status Change: {statusDialog.targetStatus}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setStatusDialog(null)}
                aria-label="Close dialog"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="status-modal-content">
              <p className="status-impact-desc">
                You are about to change the status of account{' '}
                <strong>{statusDialog.account.accountNumber}</strong> (owned by{' '}
                <strong>{statusDialog.account.customerName}</strong>) from{' '}
                <span className="badge-current-status">{statusDialog.account.status}</span> to{' '}
                <span className={`badge-target-status status-${statusDialog.targetStatus.toLowerCase()}`}>
                  {statusDialog.targetStatus}
                </span>.
              </p>

              {/* Policy explanation banner */}
              <div className="policy-alert-card">
                <IconAlertCircle size={18} className="policy-icon" />
                <div className="policy-text">
                  {statusDialog.targetStatus === 'FROZEN' && (
                    <span>
                      <strong>FR-11 Enforcement:</strong> Freezing this account will immediately block all cash deposits, withdrawals, and fund transfers. Account details and balances will remain visible.
                    </span>
                  )}
                  {statusDialog.targetStatus === 'INACTIVE' && (
                    <span>
                      <strong>FR-11 Enforcement:</strong> Deactivating this account marks it dormant. No deposits, withdrawals, or transfers will be permitted until reactivated.
                    </span>
                  )}
                  {statusDialog.targetStatus === 'ACTIVE' && (
                    <span>
                      <strong>Restoring Clearance:</strong> Activating this account restores full operational clearance for deposits, withdrawals, and customer transfers.
                    </span>
                  )}
                </div>
              </div>

              {/* Optional reason input */}
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label htmlFor="status-reason-input" className="form-label">
                  Reason for Status Transition (Optional Audit Note)
                </label>
                <input
                  id="status-reason-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Compliance lock, KYC review, customer request..."
                  value={statusDialog.reason || ''}
                  onChange={(e) => setStatusDialog({ ...statusDialog, reason: e.target.value })}
                  disabled={actionLoading}
                />
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setStatusDialog(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn-primary-custom ${
                    statusDialog.targetStatus === 'INACTIVE'
                      ? 'btn-danger'
                      : statusDialog.targetStatus === 'FROZEN'
                      ? 'btn-warn'
                      : 'btn-success'
                  }`}
                  onClick={handleConfirmStatusChange}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Updating Status...' : `Confirm ${statusDialog.targetStatus}`}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* ========================================================================
          DEPOSIT CASH MODAL (FR-12, FR-18, FR-19, TC-05)
          ======================================================================== */}
      {depositDialog && createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deposit-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !depositDialog.isSubmitting) {
              setDepositDialog(null);
            }
          }}
        >
          <div className="modal-card txn-modal-card">
            <div className="modal-header">
              <div className="modal-title-box">
                <IconArrowDownCircle size={22} className="modal-header-icon text-success" />
                <h3 id="deposit-dialog-title">Counter Cash Deposit</h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setDepositDialog(null)}
                disabled={depositDialog.isSubmitting}
                aria-label="Close dialog"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteDeposit}>
              <div className="txn-modal-body">
                {/* Account Selector / Information */}
                <div className="txn-form-group">
                  <label htmlFor="deposit-account-select" className="txn-form-label">
                    <span>Destination Account</span>
                    <span className="text-danger">*</span>
                  </label>
                  {accounts.filter((a) => a.status === 'ACTIVE').length > 1 ? (
                    <select
                      id="deposit-account-select"
                      className="txn-select-input"
                      value={depositDialog.account?.accountId || ''}
                      onChange={(e) => {
                        const sel = accounts.find((a) => String(a.accountId) === e.target.value);
                        setDepositDialog((prev) => ({
                          ...prev,
                          account: sel || null,
                          error: null
                        }));
                      }}
                      disabled={depositDialog.isSubmitting}
                    >
                      {accounts
                        .filter((a) => a.status === 'ACTIVE')
                        .map((a) => (
                          <option key={a.accountId} value={a.accountId}>
                            {a.accountNumber} ({a.accountType}) — {a.customerName} • Bal: {formatINR(a.balance)}
                          </option>
                        ))}
                    </select>
                  ) : depositDialog.account ? (
                    <div className="txn-account-summary-box">
                      <div className="summary-left">
                        <span className="summary-acc-num font-mono">{depositDialog.account.accountNumber}</span>
                        <span className="summary-acc-owner">{depositDialog.account.customerName} &bull; {depositDialog.account.accountType}</span>
                      </div>
                      <div className="summary-right">
                        <span className="summary-label">Current Balance</span>
                        <span className="summary-balance-val text-success">{formatINR(depositDialog.account.balance)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-box-warning">No active accounts available for deposit.</div>
                  )}
                </div>

                {/* Amount Input with Flex Container (NO overlap possible) */}
                <div className="txn-form-group">
                  <label htmlFor="deposit-amount-input" className="txn-form-label">
                    <span>Deposit Amount</span>
                    <span className="text-danger">*</span>
                  </label>
                  <div className="currency-input-container">
                    <span className="currency-prefix-sign">₹</span>
                    <input
                      id="deposit-amount-input"
                      type="text"
                      inputMode="decimal"
                      className="currency-number-input"
                      placeholder="0.00"
                      value={depositDialog.amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                          setDepositDialog((prev) => ({ ...prev, amount: val, error: null }));
                        }
                      }}
                      disabled={depositDialog.isSubmitting}
                      autoFocus
                    />
                  </div>

                  {/* Clean Single-Row Quick Chips */}
                  <div className="quick-chips-row">
                    <span className="quick-chips-label">Quick select:</span>
                    {[500, 1000, 2500, 5000, 10000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className="quick-chip-btn"
                        onClick={() => setDepositDialog((prev) => ({ ...prev, amount: amt.toString(), error: null }))}
                        disabled={depositDialog.isSubmitting}
                      >
                        +{amt >= 1000 ? `₹${amt / 1000}k` : `₹${amt}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Projected Balance Calculation */}
                {depositDialog.account && Number(depositDialog.amount) > 0 && (
                  <div className="projected-balance-card deposit-projection">
                    <div className="proj-label">
                      <span>Current: <strong>{formatINR(depositDialog.account.balance)}</strong></span>
                      <span className="text-success">+ Deposit: <strong>{formatINR(depositDialog.amount)}</strong></span>
                    </div>
                    <div className="proj-val text-success">
                      {formatINR(Number(depositDialog.account.balance) + Number(depositDialog.amount))}
                    </div>
                  </div>
                )}

                {/* Remarks */}
                <div className="txn-form-group">
                  <label htmlFor="deposit-remarks-input" className="txn-form-label">
                    <span>Audit Remarks / Deposit Slip #</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>(Optional)</span>
                  </label>
                  <input
                    id="deposit-remarks-input"
                    type="text"
                    className="txn-text-input"
                    placeholder="e.g. Counter cash deposit, Slip #DEP-4821"
                    value={depositDialog.remarks}
                    onChange={(e) => setDepositDialog((prev) => ({ ...prev, remarks: e.target.value }))}
                    disabled={depositDialog.isSubmitting}
                    maxLength={255}
                  />
                </div>

                {/* Error Banner */}
                {depositDialog.error && (
                  <div className="field-error-banner" role="alert">
                    <IconAlertCircle size={16} />
                    <span>{depositDialog.error}</span>
                  </div>
                )}
              </div>

              <div className="txn-modal-actions">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setDepositDialog(null)}
                  disabled={depositDialog.isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-action-deposit"
                  style={{ padding: '0.65rem 1.35rem', fontSize: '0.875rem', fontWeight: 600 }}
                  disabled={depositDialog.isSubmitting || !depositDialog.account || !depositDialog.amount || Number(depositDialog.amount) <= 0}
                >
                  {depositDialog.isSubmitting ? (
                    <>
                      <IconRefreshCw size={15} className="spin-icon" />
                      <span>Processing Deposit...</span>
                    </>
                  ) : (
                    <>
                      <IconArrowDownCircle size={16} />
                      <span>Confirm Deposit {Number(depositDialog.amount) > 0 ? formatINR(depositDialog.amount) : ''}</span>
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
          WITHDRAW CASH MODAL (FR-13, FR-14, FR-18, FR-19, TC-06, TC-15)
          ======================================================================== */}
      {withdrawDialog && createPortal(
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !withdrawDialog.isSubmitting) {
              setWithdrawDialog(null);
            }
          }}
        >
          <div className="modal-card txn-modal-card">
            <div className="modal-header">
              <div className="modal-title-box">
                <IconArrowUpCircle size={22} className="modal-header-icon text-info" />
                <h3 id="withdraw-dialog-title">Counter Cash Withdrawal</h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setWithdrawDialog(null)}
                disabled={withdrawDialog.isSubmitting}
                aria-label="Close dialog"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteWithdraw}>
              <div className="txn-modal-body">
                {/* Account Selector / Information */}
                <div className="txn-form-group">
                  <label htmlFor="withdraw-account-select" className="txn-form-label">
                    <span>Source Account</span>
                    <span className="text-danger">*</span>
                  </label>
                  {accounts.filter((a) => a.status === 'ACTIVE').length > 1 ? (
                    <select
                      id="withdraw-account-select"
                      className="txn-select-input"
                      value={withdrawDialog.account?.accountId || ''}
                      onChange={(e) => {
                        const sel = accounts.find((a) => String(a.accountId) === e.target.value);
                        setWithdrawDialog((prev) => ({
                          ...prev,
                          account: sel || null,
                          error: null
                        }));
                      }}
                      disabled={withdrawDialog.isSubmitting}
                    >
                      {accounts
                        .filter((a) => a.status === 'ACTIVE')
                        .map((a) => (
                          <option key={a.accountId} value={a.accountId}>
                            {a.accountNumber} ({a.accountType}) — {a.customerName} • Avail: {formatINR(a.balance)}
                          </option>
                        ))}
                    </select>
                  ) : withdrawDialog.account ? (
                    <div className="txn-account-summary-box">
                      <div className="summary-left">
                        <span className="summary-acc-num font-mono">{withdrawDialog.account.accountNumber}</span>
                        <span className="summary-acc-owner">{withdrawDialog.account.customerName} &bull; {withdrawDialog.account.accountType}</span>
                      </div>
                      <div className="summary-right">
                        <span className="summary-label">Available Balance</span>
                        <span className="summary-balance-val font-mono" style={{ color: '#38bdf8' }}>
                          {formatINR(withdrawDialog.account.balance)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-box-warning">No active accounts available for withdrawal.</div>
                  )}
                </div>

                {/* Amount Input with Flex Container */}
                <div className="txn-form-group">
                  <label htmlFor="withdraw-amount-input" className="txn-form-label">
                    <span>Withdrawal Amount</span>
                    <span className="text-danger">*</span>
                  </label>
                  <div className="currency-input-container">
                    <span className="currency-prefix-sign">₹</span>
                    <input
                      id="withdraw-amount-input"
                      type="text"
                      inputMode="decimal"
                      className="currency-number-input"
                      placeholder="0.00"
                      value={withdrawDialog.amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                          setWithdrawDialog((prev) => ({ ...prev, amount: val, error: null }));
                        }
                      }}
                      disabled={withdrawDialog.isSubmitting}
                      autoFocus
                    />
                  </div>

                  {/* Clean Single-Row Quick Chips */}
                  <div className="quick-chips-row">
                    <span className="quick-chips-label">Quick select:</span>
                    {[500, 1000, 2500, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className="quick-chip-btn"
                        onClick={() => setWithdrawDialog((prev) => ({ ...prev, amount: amt.toString(), error: null }))}
                        disabled={withdrawDialog.isSubmitting || (withdrawDialog.account && amt > Number(withdrawDialog.account.balance))}
                      >
                        {amt >= 1000 ? `₹${amt / 1000}k` : `₹${amt}`}
                      </button>
                    ))}
                    {withdrawDialog.account && Number(withdrawDialog.account.balance) > 0 && (
                      <button
                        type="button"
                        className="quick-chip-btn chip-max"
                        onClick={() => setWithdrawDialog((prev) => ({ ...prev, amount: String(withdrawDialog.account.balance), error: null }))}
                        disabled={withdrawDialog.isSubmitting}
                        title="Withdraw entire account balance down to 0.00"
                      >
                        Max Balance ({formatINR(withdrawDialog.account.balance)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Overdraft Warning Banner (FR-14) */}
                {withdrawDialog.account && Number(withdrawDialog.amount) > Number(withdrawDialog.account.balance) && (
                  <div className="insufficient-funds-warning" role="alert">
                    <IconAlertCircle size={16} />
                    <span>
                      <strong>Insufficient Funds:</strong> Requested amount of {formatINR(withdrawDialog.amount)} exceeds available balance of {formatINR(withdrawDialog.account.balance)}. Overdrafts are prohibited (FR-14).
                    </span>
                  </div>
                )}

                {/* Live Projected Balance Calculation */}
                {withdrawDialog.account && Number(withdrawDialog.amount) > 0 && Number(withdrawDialog.amount) <= Number(withdrawDialog.account.balance) && (
                  <div className="projected-balance-card withdraw-projection">
                    <div className="proj-label">
                      <span>Current: <strong>{formatINR(withdrawDialog.account.balance)}</strong></span>
                      <span className="text-danger">- Withdrawal: <strong>{formatINR(withdrawDialog.amount)}</strong></span>
                    </div>
                    <div className="proj-val" style={{ color: '#38bdf8' }}>
                      {formatINR(Number(withdrawDialog.account.balance) - Number(withdrawDialog.amount))}
                    </div>
                  </div>
                )}

                {/* Remarks */}
                <div className="txn-form-group">
                  <label htmlFor="withdraw-remarks-input" className="txn-form-label">
                    <span>Audit Remarks / Voucher #</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>(Optional)</span>
                  </label>
                  <input
                    id="withdraw-remarks-input"
                    type="text"
                    className="txn-text-input"
                    placeholder="e.g. Counter cash withdrawal, Voucher #WTH-1092"
                    value={withdrawDialog.remarks}
                    onChange={(e) => setWithdrawDialog((prev) => ({ ...prev, remarks: e.target.value }))}
                    disabled={withdrawDialog.isSubmitting}
                    maxLength={255}
                  />
                </div>

                {/* Error Banner */}
                {withdrawDialog.error && (
                  <div className="field-error-banner" role="alert">
                    <IconAlertCircle size={16} />
                    <span>{withdrawDialog.error}</span>
                  </div>
                )}
              </div>

              <div className="txn-modal-actions">
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={() => setWithdrawDialog(null)}
                  disabled={withdrawDialog.isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-action-withdraw"
                  style={{ padding: '0.65rem 1.35rem', fontSize: '0.875rem', fontWeight: 600 }}
                  disabled={
                    withdrawDialog.isSubmitting ||
                    !withdrawDialog.account ||
                    !withdrawDialog.amount ||
                    Number(withdrawDialog.amount) <= 0 ||
                    Number(withdrawDialog.amount) > Number(withdrawDialog.account.balance)
                  }
                >
                  {withdrawDialog.isSubmitting ? (
                    <>
                      <IconRefreshCw size={15} className="spin-icon" />
                      <span>Processing Withdrawal...</span>
                    </>
                  ) : (
                    <>
                      <IconArrowUpCircle size={16} />
                      <span>Confirm Withdrawal {Number(withdrawDialog.amount) > 0 ? formatINR(withdrawDialog.amount) : ''}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}