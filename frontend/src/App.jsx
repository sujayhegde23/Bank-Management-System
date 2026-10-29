import { useState, useEffect, useCallback } from 'react';
import { getSystemHealth, login, logout, getCurrentUser, getAccounts, getAccountTransactions } from './services/api';
import EmployeeManagement from './components/EmployeeManagement';
import AccountManagement from './components/AccountManagement';
import CustomerTransferModal from './components/CustomerTransferModal';
import TransactionsView from './components/TransactionsView';
import './App.css';

/* ==============================================================================
   Lucide-style Inline SVG Icons for Navigation & Dashboard Layout
   ============================================================================== */

function IconBuilding({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

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

function IconUserCheck({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function IconFileText({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconActivity({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconLogOut({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconShield({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconLock({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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

function IconArrowDownCircle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 12 16 16 12" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  );
}

function IconArrowUpCircle({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 12 12 8 8 12" />
      <line x1="12" y1="16" x2="12" y2="8" />
    </svg>
  );
}

function IconSend({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconHistory({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

// Database schema definitions preserved for Diagnostic explorer
const SCHEMA_DEFINITIONS = {
  accounts: {
    title: 'accounts',
    description: 'Core financial accounts owned by customers. Enforces non-negative balance and unique account numbers (FR-07, FR-08, FR-11).',
    columns: [
      { name: 'account_id', type: 'BIGINT AUTO_INCREMENT', key: 'PK', desc: 'Internal surrogate identifier' },
      { name: 'account_number', type: 'VARCHAR(30)', key: 'UK', desc: 'Public alphanumeric account identifier (e.g. ACC-SB-XXXXXXXX)' },
      { name: 'customer_id', type: 'BIGINT', key: 'FK', desc: 'References customers(customer_id) ON DELETE RESTRICT' },
      { name: 'account_type', type: 'VARCHAR(20)', key: '', desc: 'Savings or Current account category' },
      { name: 'balance', type: 'DECIMAL(15,2)', key: 'CHECK', desc: 'Current balance; CHECK (balance >= 0.00)' },
      { name: 'status', type: 'ENUM("ACTIVE","INACTIVE","FROZEN")', key: '', desc: 'Account operational status (FR-10, FR-11)' },
      { name: 'opened_at', type: 'DATETIME', key: '', desc: 'Record creation timestamp' },
      { name: 'updated_at', type: 'DATETIME', key: '', desc: 'Auto-updating modification timestamp' }
    ],
    constraints: 'PRIMARY KEY (account_id), UNIQUE KEY (account_number), FOREIGN KEY (customer_id) REFERENCES customers(customer_id), CHECK (balance >= 0.00), ENGINE=InnoDB'
  },
  bank_transactions: {
    title: 'bank_transactions',
    description: 'Immutable ledger entries capturing deposits, withdrawals, and transfers with strict referential integrity.',
    columns: [
      { name: 'transaction_id', type: 'BIGINT AUTO_INCREMENT', key: 'PK', desc: 'Surrogate ledger transaction ID' },
      { name: 'transaction_ref', type: 'VARCHAR(64)', key: 'UK', desc: 'Unique transaction identifier (e.g. TXN-INIT-001)' },
      { name: 'type', type: 'ENUM("DEPOSIT","WITHDRAWAL","TRANSFER")', key: '', desc: 'Financial transaction category' },
      { name: 'amount', type: 'DECIMAL(15,2)', key: 'CHECK', desc: 'Positive monetary amount; CHECK (amount > 0.00)' },
      { name: 'source_account_id', type: 'BIGINT', key: 'FK', desc: 'Debit account for withdrawals & transfers' },
      { name: 'destination_account_id', type: 'BIGINT', key: 'FK', desc: 'Credit account for deposits & transfers' },
      { name: 'performed_by_user_id', type: 'BIGINT', key: 'FK', desc: 'Staff or customer initiating the transaction' },
      { name: 'remarks', type: 'VARCHAR(255)', key: '', desc: 'Optional audit remarks' },
      { name: 'created_at', type: 'DATETIME', key: '', desc: 'Ledger insertion timestamp' }
    ],
    constraints: 'PRIMARY KEY (transaction_id), UNIQUE KEY (transaction_ref), FOREIGN KEY (source_account_id, destination_account_id), CHECK (amount > 0.00), ENGINE=InnoDB'
  },
  employees: {
    title: 'employees',
    description: 'Bank staff profile linked 1-to-1 with a USER record.',
    columns: [
      { name: 'employee_id', type: 'BIGINT AUTO_INCREMENT', key: 'PK', desc: 'Surrogate staff ID' },
      { name: 'user_id', type: 'BIGINT', key: 'UK / FK', desc: 'Links to users(user_id) ON DELETE RESTRICT' },
      { name: 'full_name', type: 'VARCHAR(100)', key: '', desc: 'Employee legal name' },
      { name: 'email', type: 'VARCHAR(100)', key: 'INDEX', desc: 'Official staff email address' },
      { name: 'phone', type: 'VARCHAR(20)', key: '', desc: 'Contact telephone' },
      { name: 'created_at', type: 'DATETIME', key: '', desc: 'Creation timestamp' },
      { name: 'updated_at', type: 'DATETIME', key: '', desc: 'Last update timestamp' }
    ],
    constraints: 'PRIMARY KEY (employee_id), UNIQUE KEY (user_id), FOREIGN KEY (user_id) REFERENCES users(user_id), ENGINE=InnoDB'
  },
  users: {
    title: 'users',
    description: 'System authentication credentials, roles, and account statuses.',
    columns: [
      { name: 'user_id', type: 'BIGINT AUTO_INCREMENT', key: 'PK', desc: 'Surrogate user identifier' },
      { name: 'username', type: 'VARCHAR(50)', key: 'UK', desc: 'Unique login handle' },
      { name: 'password_hash', type: 'VARCHAR(255)', key: '', desc: 'Salted bcrypt one-way hash (cost factor 10)' },
      { name: 'role', type: 'ENUM("CUSTOMER","EMPLOYEE","ADMIN")', key: 'INDEX', desc: 'RBAC authorization level' },
      { name: 'status', type: 'ENUM("ACTIVE","INACTIVE")', key: 'INDEX', desc: 'Account authorization state' },
      { name: 'created_at', type: 'DATETIME', key: '', desc: 'Account creation date' },
      { name: 'updated_at', type: 'DATETIME', key: '', desc: 'Last modification date' }
    ],
    constraints: 'PRIMARY KEY (user_id), UNIQUE KEY (username), ENGINE=InnoDB'
  },
  customers: {
    title: 'customers',
    description: 'Customer profiles linked 1-to-1 with user logins.',
    columns: [
      { name: 'customer_id', type: 'BIGINT AUTO_INCREMENT', key: 'PK', desc: 'Surrogate customer identifier' },
      { name: 'user_id', type: 'BIGINT', key: 'UK / FK', desc: 'Links to users(user_id)' },
      { name: 'full_name', type: 'VARCHAR(100)', key: '', desc: 'Customer full name' },
      { name: 'date_of_birth', type: 'DATE', key: '', desc: 'Customer birth date' },
      { name: 'phone', type: 'VARCHAR(20)', key: 'INDEX', desc: 'Phone contact' },
      { name: 'email', type: 'VARCHAR(100)', key: 'INDEX', desc: 'Email contact' },
      { name: 'address', type: 'VARCHAR(255)', key: '', desc: 'Residential address' }
    ],
    constraints: 'PRIMARY KEY (customer_id), UNIQUE KEY (user_id), FOREIGN KEY (user_id) REFERENCES users(user_id), ENGINE=InnoDB'
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Navigation tab state: 'accounts' | 'employees' | 'diagnostics' | 'overview' | 'statements'
  const [activeNav, setActiveNav] = useState('accounts');
  const [accountAction, setAccountAction] = useState(null);
  const [customerStatementModal, setCustomerStatementModal] = useState(null);
  const [custStatementTxns, setCustStatementTxns] = useState([]);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedTransferSourceId, setSelectedTransferSourceId] = useState(null);
  const [custStatementLoading, setCustStatementLoading] = useState(false);
  const [custStatementPage, setCustStatementPage] = useState(1);
  const [custStatementTotalPages, setCustStatementTotalPages] = useState(1);
  const [custStatementTotal, setCustStatementTotal] = useState(0);
  const [custStatementType, setCustStatementType] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && customerStatementModal) {
        setCustomerStatementModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [customerStatementModal]);

  const loadCustomerStatement = async (account, page = 1, type = '') => {
    if (!account) return;
    setCustomerStatementModal(account);
    setCustStatementLoading(true);
    setCustStatementPage(page);
    setCustStatementType(type);
    try {
      const res = await getAccountTransactions(account.accountId, {
        page,
        size: 10,
        type: type || undefined
      });
      const txns = res?.transactions || res?.items || [];
      setCustStatementTxns(txns);
      setCustStatementTotal(res?.pagination?.total || res?.total || txns.length);
      setCustStatementTotalPages(res?.pagination?.totalPages || res?.totalPages || Math.ceil((res?.total || txns.length) / 10) || 1);
    } catch (err) {
      console.error('Failed to load statement transactions:', err);
      setCustStatementTxns([]);
      setCustStatementTotal(0);
      setCustStatementTotalPages(1);
    } finally {
      setCustStatementLoading(false);
    }
  };

  // Customer retail accounts state (FR-09)
  const [customerAccounts, setCustomerAccounts] = useState([]);
  const [custAccountsLoading, setCustAccountsLoading] = useState(false);

  // Diagnostic state
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState(null);
  const [activeSchemaTab, setActiveSchemaTab] = useState('accounts');

  const checkHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await getSystemHealth();
      setHealth(data);
    } catch (err) {
      setHealthError(err.message || 'Could not connect to backend server');
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  // Fetch customer accounts for retail banking view (FR-09)
  const loadCustomerAccounts = useCallback(async () => {
    setCustAccountsLoading(true);
    try {
      const data = await getAccounts();
      setCustomerAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not load customer accounts:', err.message);
    } finally {
      setCustAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    // Probe backend health
    getSystemHealth()
      .then((data) => {
        if (!isCancelled) {
          setHealth(data);
          setHealthError(null);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setHealthError(err.message || 'Backend server offline');
          setHealth(null);
        }
      });

    // Rehydrate active session safe profile on page load
    getCurrentUser()
      .then((user) => {
        if (!isCancelled && user) {
          setCurrentUser(user);
          // Set sensible initial navigation based on role
          if (user.role === 'ADMIN') {
            setActiveNav('employees');
          } else if (user.role === 'EMPLOYEE') {
            setActiveNav('accounts');
          } else {
            setActiveNav('overview');
          }
        }
      })
      .catch(() => {
        // Visitor remains unauthenticated
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // When active user is Customer, fetch their accounts live (FR-09)
  useEffect(() => {
    let ignore = false;
    if (currentUser?.role === 'CUSTOMER') {
      Promise.resolve().then(() => {
        if (!ignore) {
          loadCustomerAccounts().catch(() => {});
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [currentUser, loadCustomerAccounts]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim()) {
      setAuthError('Please enter both username and password.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);

    try {
      const user = await login({ username, password });
      setCurrentUser(user);
      setPassword('');
      if (user.role === 'ADMIN') {
        setActiveNav('employees');
      } else if (user.role === 'EMPLOYEE') {
        setActiveNav('accounts');
      } else {
        setActiveNav('overview');
      }
    } catch (err) {
      setAuthError(err.message || 'Invalid username or password');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      await logout();
      setCurrentUser(null);
      setUsername('');
      setPassword('');
      setActiveNav('accounts');
      setCustomerAccounts([]);
      setTransferModalOpen(false);
      setSelectedTransferSourceId(null);
      setCustomerStatementModal(null);
      setCustStatementTxns([]);
    } catch (err) {
      setAuthError(err.message || 'Logout failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Quick fill testing helper
  const handleQuickFill = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setAuthError(null);
  };

  // Diagnostic mapping
  const healthData = health?.data || health;
  const isDbConnected = Boolean(
    healthData?.database?.connected ??
    (healthData?.database?.status?.toLowerCase() === 'connected')
  );

  // ----------------------------------------------------------------------------
  // SCENARIO 1: UNAUTHENTICATED (Login Screen)
  // ----------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="login-screen-root">
        <div className="login-screen-card">
          <div className="login-brand-header">
            <div className="login-brand-logo">
              <IconBuilding size={24} />
            </div>
            <div>
              <h1 className="login-bank-name">CORE BANK</h1>
              <p className="login-portal-subtitle">Bank Management System</p>
            </div>
          </div>

          {authError && (
            <div className="login-error-alert" role="alert">
              <IconAlertCircle size={16} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field-group">
              <label htmlFor="login-username" className="login-label">
                Username
              </label>
              <input
                id="login-username"
                className="login-input"
                type="text"
                placeholder="e.g. test.employee1 or test.admin1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={authLoading}
                required
              />
            </div>

            <div className="login-field-group">
              <label htmlFor="login-password" className="login-label">
                Password
              </label>
              <input
                id="login-password"
                className="login-input"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={authLoading}
                required
              />
            </div>

            <button
              id="login-submit-btn"
              className="login-submit-btn"
              type="submit"
              disabled={authLoading}
            >
              {authLoading ? 'Verifying Credentials...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Quick-fill testing helpers */}
          <div className="login-quickfill-box">
            <span className="quickfill-title">Quick Test Credentials (Password: <code>Password123!</code>):</span>
            <div className="quickfill-buttons-grid">
              <button
                type="button"
                className="quickfill-btn employee-quickfill"
                onClick={() => handleQuickFill('test.employee1', 'Password123!')}
              >
                <IconUserCheck size={13} />
                <span>Employee (test.employee1) &bull; Bank Accounts (Issue #7)</span>
              </button>
              <button
                type="button"
                className="quickfill-btn admin-quickfill"
                onClick={() => handleQuickFill('test.admin1', 'Password123!')}
              >
                <IconShield size={13} />
                <span>Admin (test.admin1) &bull; Employee Admin (Issue #11)</span>
              </button>
              <button
                type="button"
                className="quickfill-btn customer-quickfill"
                onClick={() => handleQuickFill('test.customer1', 'Password123!')}
              >
                <IconUsers size={13} />
                <span>Customer (test.customer1) &bull; Retail View (FR-09)</span>
              </button>
            </div>
          </div>

          <div className="login-security-notice">
            <IconLock size={13} />
            <span>Encrypted with HTTP-only session cookies &amp; sliding 15-min timeout.</span>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // SCENARIO 2: AUTHENTICATED DASHBOARD (Role-Adapted Experience)
  // ----------------------------------------------------------------------------
  const isAdmin = currentUser.role === 'ADMIN';
  const isEmployee = currentUser.role === 'EMPLOYEE';
  const isCustomer = currentUser.role === 'CUSTOMER';

  const userInitials = (currentUser.displayName || currentUser.username)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="dashboard-layout-root">
      {/* ------------------------------------------------------------------------
          SIDEBAR (Adapts cleanly based on Role)
          ------------------------------------------------------------------------ */}
      <aside className="dashboard-sidebar">
        {/* Brand */}
        <div className="sidebar-brand-box">
          <div className="sidebar-brand-icon">
            <IconBuilding size={20} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-bank-title">CORE BANK</span>
            <span className="sidebar-bank-sub">
              {isAdmin ? 'Admin Console' : isEmployee ? 'Staff Terminal' : 'Retail Banking'}
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav-menu">
          <div className="sidebar-group-title">
            {isAdmin ? 'Administration' : isEmployee ? 'Branch Operations' : 'Account Services'}
          </div>

          {/* ADMINISTRATOR NAVIGATION */}
          {isAdmin && (
            <>
              {/* Employee Management (Issue #11) */}
              <button
                type="button"
                className={`sidebar-nav-item active-item ${activeNav === 'employees' ? 'selected' : ''}`}
                onClick={() => setActiveNav('employees')}
              >
                <IconUserCheck size={17} />
                <span>Employees</span>
                <span className="nav-badge-active">Active</span>
              </button>

              {/* Bank Accounts Oversight (Issue #7) */}
              <button
                type="button"
                className={`sidebar-nav-item active-item ${activeNav === 'accounts' ? 'selected' : ''}`}
                onClick={() => setActiveNav('accounts')}
              >
                <IconLandmark size={17} />
                <span>Bank Accounts</span>
                <span className="nav-badge-active">Active</span>
              </button>

              <div
                className="sidebar-nav-item disabled-item"
                title="Customer management scheduled for Sprint 2"
              >
                <IconUsers size={17} />
                <span>Customers</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>

              <button
                id="nav-admin-transactions-btn"
                type="button"
                className={`sidebar-nav-item active-item ${activeNav === 'transactions' ? 'selected' : ''}`}
                onClick={() => setActiveNav('transactions')}
                title="Audit bank-wide transaction records (FR-21)"
              >
                <IconCreditCard size={17} />
                <span>Transactions</span>
                <span className="nav-badge-active">Active</span>
              </button>

              <div
                className="sidebar-nav-item disabled-item"
                title="Reporting module scheduled for Sprint 2"
              >
                <IconFileText size={17} />
                <span>Reports</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>
            </>
          )}

          {/* EMPLOYEE NAVIGATION */}
          {isEmployee && (
            <>
              {/* Manage Accounts (Issue #7 — Primary Functional Module) */}
              <button
                id="nav-manage-accounts-btn"
                type="button"
                className={`sidebar-nav-item active-item ${activeNav === 'accounts' ? 'selected' : ''}`}
                onClick={() => setActiveNav('accounts')}
              >
                <IconLandmark size={17} />
                <span>Manage Accounts</span>
                <span className="nav-badge-active">Active</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeNav === 'overview' ? 'selected' : ''}`}
                onClick={() => setActiveNav('overview')}
              >
                <IconUserCheck size={17} />
                <span>Staff Overview</span>
              </button>

              <div
                className="sidebar-nav-item disabled-item"
                title="Customer registration scheduled for Sprint 2 (FR-04)"
              >
                <IconUsers size={17} />
                <span>Register Customer</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>

              <button
                id="nav-cash-deposit-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'accounts' && accountAction === 'deposit' ? 'selected' : ''}`}
                onClick={() => {
                  setActiveNav('accounts');
                  setAccountAction('deposit');
                }}
                title="Deposit cash into customer accounts (FR-12)"
              >
                <IconArrowDownCircle size={17} />
                <span>Cash Deposit</span>
                <span className="nav-badge-active" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>Active</span>
              </button>

              <button
                id="nav-cash-withdrawal-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'accounts' && accountAction === 'withdraw' ? 'selected' : ''}`}
                onClick={() => {
                  setActiveNav('accounts');
                  setAccountAction('withdraw');
                }}
                title="Withdraw cash from customer accounts (FR-13)"
              >
                <IconArrowUpCircle size={17} />
                <span>Cash Withdrawal</span>
                <span className="nav-badge-active" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>Active</span>
              </button>

              <button
                id="nav-employee-transactions-btn"
                type="button"
                className={`sidebar-nav-item active-item ${activeNav === 'transactions' ? 'selected' : ''}`}
                onClick={() => setActiveNav('transactions')}
                title="View customer transactions and audit ledger (FR-21)"
              >
                <IconCreditCard size={17} />
                <span>Transactions</span>
                <span className="nav-badge-active">Active</span>
              </button>
            </>
          )}

          {/* CUSTOMER NAVIGATION */}
          {isCustomer && (
            <>
              <button
                type="button"
                className={`sidebar-nav-item active-item ${activeNav === 'overview' ? 'selected' : ''}`}
                onClick={() => setActiveNav('overview')}
              >
                <IconLandmark size={17} />
                <span>Account Overview</span>
                <span className="nav-badge-active">Active</span>
              </button>

              <button
                id="nav-customer-transfer-btn"
                type="button"
                className={`sidebar-nav-item ${transferModalOpen ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTransferSourceId(null);
                  setTransferModalOpen(true);
                }}
                title="Transfer money from your bank account to another account (FR-15)"
              >
                <IconSend size={17} />
                <span>Transfer Funds</span>
                <span className="nav-badge-active" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>Active</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeNav === 'statements' ? 'selected' : ''}`}
                onClick={() => {
                  setActiveNav('statements');
                  if (customerAccounts.length > 0) {
                    loadCustomerStatement(customerAccounts[0], 1, '');
                  }
                }}
                title="View bank account statements and ledger records (FR-20)"
              >
                <IconHistory size={17} />
                <span>Statements</span>
                <span className="nav-badge-active">Active</span>
              </button>
            </>
          )}

          <div className="sidebar-group-title" style={{ marginTop: '1.25rem' }}>
            System Tools
          </div>

          {/* Diagnostics View (Functional preservation of health/schema tools) */}
          <button
            type="button"
            className={`sidebar-nav-item ${activeNav === 'diagnostics' ? 'selected' : ''}`}
            onClick={() => setActiveNav('diagnostics')}
          >
            <IconActivity size={17} />
            <span>System Diagnostics</span>
          </button>
        </nav>

        {/* Sidebar Footer: Profile & Logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className={`user-avatar-circle ${isAdmin ? 'avatar-admin' : isEmployee ? 'avatar-employee' : 'avatar-customer'}`}>
              {userInitials}
            </div>
            <div className="user-text-info">
              <span className="user-display-name">{currentUser.displayName || currentUser.username}</span>
              <span className={`user-role-badge ${isAdmin ? 'role-admin' : isEmployee ? 'role-employee' : 'role-customer'}`}>
                {currentUser.role}
              </span>
            </div>
          </div>
          <button
            id="sidebar-logout-btn"
            type="button"
            className="sidebar-logout-btn"
            onClick={handleLogout}
            disabled={authLoading}
            title="Terminate session and sign out"
          >
            <IconLogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------------------
          MAIN VIEWPORT & TOPBAR
          ------------------------------------------------------------------------ */}
      <div className="dashboard-main-viewport">
        {/* Top Navigation Bar */}
        <header className="dashboard-topbar">
          <div className="topbar-breadcrumb">
            <span className="breadcrumb-root">
              {isAdmin ? 'Administration' : isEmployee ? 'Branch Operations' : 'Retail Banking'}
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">
              {activeNav === 'diagnostics'
                ? 'System Diagnostics'
                : activeNav === 'accounts'
                ? 'Account Management'
                : activeNav === 'employees'
                ? 'Employee Management'
                : activeNav === 'transactions'
                ? 'Transaction Ledger'
                : 'Workspace Overview'}
            </span>
          </div>

          <div className="topbar-right-controls">
            {/* Live API & Database Status Pill */}
            <div className="topbar-status-pill">
              <span className={`status-pulse-dot ${isDbConnected ? 'pulse-green' : 'pulse-amber'}`} />
              <span className="status-pill-text">
                {isDbConnected ? 'MySQL Connected' : 'DB Standby'}
              </span>
            </div>

            {/* User identity pill */}
            <div className="topbar-admin-profile">
              <div className={`topbar-avatar ${isAdmin ? 'avatar-admin' : isEmployee ? 'avatar-employee' : 'avatar-customer'}`}>
                {userInitials}
              </div>
              <span className="topbar-admin-name">{currentUser.displayName || currentUser.username}</span>
              <span className={`badge-admin-tag ${isAdmin ? 'tag-admin' : isEmployee ? 'tag-employee' : 'tag-customer'}`}>
                {currentUser.role}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="dashboard-content-area">
          {activeNav === 'diagnostics' ? (
            /* ==================================================================
               DIAGNOSTICS VIEW (Preserves Health & Schema Tools)
               ================================================================== */
            <div className="diagnostics-view-container">
              <div className="emp-page-header">
                <div>
                  <h1 className="emp-page-title">System Health &amp; Diagnostics</h1>
                  <p className="emp-page-subtitle">
                    Monitor Express API uptime, MySQL connection pool status, and database schema definitions.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary-custom"
                  onClick={checkHealth}
                  disabled={healthLoading}
                >
                  {healthLoading ? 'Testing...' : 'Ping Diagnostics'}
                </button>
              </div>

              {/* Diagnostic Box */}
              <div className="diag-health-box">
                <div className="diag-item">
                  <span className="diag-label">API Server Status</span>
                  <span className="diag-value text-success">
                    {health ? 'ONLINE (UP)' : healthError ? 'ERROR' : 'CHECKING...'}
                  </span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">MySQL Database Status</span>
                  <span className={`diag-value ${isDbConnected ? 'text-success' : 'text-danger'}`}>
                    {isDbConnected ? 'CONNECTED (InnoDB)' : 'DISCONNECTED'}
                  </span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Uptime Seconds</span>
                  <span className="diag-value">
                    {healthData?.uptimeSeconds !== undefined ? `${healthData.uptimeSeconds}s` : '—'}
                  </span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Timestamp</span>
                  <span className="diag-value">
                    {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : '—'}
                  </span>
                </div>
              </div>

              {/* Schema Inspector */}
              <div className="schema-tabs-header">
                {Object.keys(SCHEMA_DEFINITIONS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`schema-tab-btn ${activeSchemaTab === key ? 'active' : ''}`}
                    onClick={() => setActiveSchemaTab(key)}
                  >
                    <code>{key}</code>
                  </button>
                ))}
              </div>

              <div className="schema-explorer-card">
                <h3>{SCHEMA_DEFINITIONS[activeSchemaTab].title} Table</h3>
                <p className="schema-table-desc">
                  {SCHEMA_DEFINITIONS[activeSchemaTab].description}
                </p>
                <table className="emp-table-custom">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Data Type</th>
                      <th>Key Constraint</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCHEMA_DEFINITIONS[activeSchemaTab].columns.map((col) => (
                      <tr key={col.name}>
                        <td><code>{col.name}</code></td>
                        <td><span className="emp-phone-text">{col.type}</span></td>
                        <td>
                          {col.key ? (
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                              {col.key}
                            </span>
                          ) : '—'}
                        </td>
                        <td><span style={{ color: '#94a3b8' }}>{col.desc}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : isCustomer ? (
            /* ==================================================================
               CUSTOMER: RETAIL BANKING PORTAL (FR-09 Live Account Overview)
               Strictly isolates retail customers from staff administration
               ================================================================== */
            <div className="role-portal-view">
              <div className="portal-banner">
                <div className="portal-banner-icon icon-customer-banner">
                  <IconLandmark size={28} />
                </div>
                <div>
                  <h1 className="portal-title">Personal Online Banking Portal</h1>
                  <p className="portal-subtitle">
                    Account Holder: <strong>{currentUser.displayName}</strong> &bull; Customer ID #{currentUser.customerId || '1'}
                  </p>
                </div>
              </div>

              {/* Verified Accounts Live Ledger Section (FR-09) */}
              <div className="customer-accounts-section" style={{ marginBottom: '2rem' }}>
                <div className="emp-page-header" style={{ marginBottom: '1rem' }}>
                  <div>
                    <h2 className="emp-page-title" style={{ fontSize: '1.25rem' }}>Your Bank Accounts</h2>
                    <p className="emp-page-subtitle">
                      Live account balances and operational status from the core banking ledger (FR-09).
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn-secondary-custom"
                      onClick={loadCustomerAccounts}
                      disabled={custAccountsLoading}
                    >
                      <IconCreditCard size={15} />
                      <span>{custAccountsLoading ? 'Refreshing...' : 'Refresh Balance'}</span>
                    </button>
                    <button
                      id="customer-header-transfer-btn"
                      type="button"
                      className="btn-primary-custom"
                      onClick={() => {
                        setSelectedTransferSourceId(null);
                        setTransferModalOpen(true);
                      }}
                      disabled={customerAccounts.filter((a) => a.status === 'ACTIVE').length === 0}
                      style={{ gap: '0.45rem', fontSize: '0.85rem' }}
                      title="Initiate fund transfer between accounts (FR-15)"
                    >
                      <IconSend size={15} />
                      <span>Transfer Funds</span>
                    </button>
                  </div>
                </div>

                {custAccountsLoading ? (
                  <div className="table-skeleton-container" style={{ padding: '1rem' }}>
                    <div className="skeleton-row" />
                    <div className="skeleton-row" />
                  </div>
                ) : customerAccounts.length === 0 ? (
                  <div className="empty-state-box" style={{ padding: '2rem' }}>
                    <IconCreditCard size={32} className="empty-state-icon" />
                    <h3>No Bank Accounts Linked</h3>
                    <p>Please contact branch staff to open a savings or current account for your customer profile.</p>
                  </div>
                ) : (
                  <div className="emp-stats-grid">
                    {customerAccounts.map((acc) => {
                      const numVal = Number(acc.balance) || 0;
                      const formatted = new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        minimumFractionDigits: 2
                      }).format(numVal);

                      return (
                        <div key={acc.accountId} className="emp-stat-card" style={{ padding: '1.25rem 1.5rem' }}>
                          <div className="stat-icon-wrapper active-icon">
                            <IconLandmark size={22} />
                          </div>
                          <div className="stat-details" style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="stat-label">{acc.accountType} ACCOUNT</span>
                              <span className={`status-badge-custom badge-${String(acc.status).toLowerCase()}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                                <span className="status-dot" />
                                <span>{acc.status}</span>
                              </span>
                            </div>
                            <span className="stat-value font-mono" style={{ fontSize: '1.4rem', color: '#60a5fa', margin: '0.35rem 0' }}>
                              {acc.accountNumber}
                            </span>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
                              <span className="stat-desc">Available Balance</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '1.25rem', color: '#f8fafc' }}>
                                {formatted}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                              <button
                                type="button"
                                className="btn-secondary-custom"
                                style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', gap: '0.4rem', padding: '0.4rem 0.65rem' }}
                                onClick={async () => {
                                  loadCustomerStatement(acc, 1, '');
                                }}
                              >
                                <IconHistory size={14} />
                                <span>Statement</span>
                              </button>
                              {acc.status === 'ACTIVE' && (
                                <button
                                  type="button"
                                  className="btn-primary-custom"
                                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', gap: '0.4rem', padding: '0.4rem 0.65rem' }}
                                  onClick={() => {
                                    setSelectedTransferSourceId(acc.accountId);
                                    setTransferModalOpen(true);
                                  }}
                                  title="Transfer funds from this account (FR-15)"
                                >
                                  <IconSend size={14} />
                                  <span>Transfer</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Customer Roadmap Notice Box */}
              <div className="roadmap-notice-box">
                <div className="roadmap-notice-header">
                  <IconShield size={18} className="roadmap-shield-icon" />
                  <h4>Online Banking Notice &bull; Cash Counter Clearance Policy</h4>
                </div>
                <p>
                  You are securely logged into your personal <strong>Retail Banking Portal</strong>. Under bank security policy (FR-03, AUTH_002), cash counter deposits and cash withdrawals must be processed in-person at a branch teller window by an authorized <strong>Bank Employee</strong>.
                </p>
              </div>
            </div>
          ) : activeNav === 'accounts' ? (
            /* ==================================================================
               ACCOUNT MANAGEMENT CONSOLE (Issue #7 & Issue #8)
               Accessible to Bank Employees (and Admin oversight)
               ================================================================== */
            <AccountManagement currentUser={currentUser} initialAction={accountAction} onActionConsumed={() => setAccountAction(null)} />
          ) : activeNav === 'employees' && isAdmin ? (
            /* ==================================================================
               ADMINISTRATOR: EMPLOYEE MANAGEMENT CONSOLE (Issue #11)
               ================================================================== */
            <EmployeeManagement currentUser={currentUser} />
          ) : activeNav === 'transactions' && (isEmployee || isAdmin) ? (
            /* ==================================================================
               TRANSACTION AUDIT LEDGER (Issue #10, FR-21, NFR-10, TC-19)
               ================================================================== */
            <TransactionsView user={currentUser} />
          ) : isEmployee && activeNav === 'overview' ? (
            /* ==================================================================
               EMPLOYEE: BRANCH OPERATIONS OVERVIEW
               ================================================================== */
            <div className="role-portal-view">
              <div className="portal-banner">
                <div className="portal-banner-icon icon-employee-banner">
                  <IconUserCheck size={28} />
                </div>
                <div>
                  <h1 className="portal-title">Bank Staff Operations Workspace</h1>
                  <p className="portal-subtitle">
                    Authorized terminal for <strong>{currentUser.displayName}</strong> &bull; Staff ID #{currentUser.employeeId || '1'}
                  </p>
                </div>
              </div>

              {/* Identity Snapshot Card */}
              <div className="emp-stats-grid" style={{ marginBottom: '1.75rem' }}>
                <div className="emp-stat-card">
                  <div className="stat-icon-wrapper active-icon">
                    <IconShield size={22} />
                  </div>
                  <div className="stat-details">
                    <span className="stat-label">Assigned Role</span>
                    <span className="stat-value" style={{ fontSize: '1.25rem', color: '#60a5fa' }}>EMPLOYEE</span>
                    <span className="stat-desc">Branch staff clearance</span>
                  </div>
                </div>

                <div className="emp-stat-card">
                  <div className="stat-icon-wrapper total-icon">
                    <IconUsers size={22} />
                  </div>
                  <div className="stat-details">
                    <span className="stat-label">System Username</span>
                    <span className="stat-value" style={{ fontSize: '1.2rem', color: '#f8fafc' }}>{currentUser.username}</span>
                    <span className="stat-desc">User ID #{currentUser.userId}</span>
                  </div>
                </div>

                <div className="emp-stat-card">
                  <div className="stat-icon-wrapper active-icon">
                    <IconUserCheck size={22} />
                  </div>
                  <div className="stat-details">
                    <span className="stat-label">Operational Status</span>
                    <span className="stat-value text-success" style={{ fontSize: '1.25rem' }}>ACTIVE</span>
                    <span className="stat-desc">Valid session established</span>
                  </div>
                </div>
              </div>

              {/* Action Jump to Accounts */}
              <div className="roadmap-notice-box">
                <div className="roadmap-notice-header">
                  <IconLandmark size={20} style={{ color: '#38bdf8' }} />
                  <h4>Bank Account Creation &amp; Access Management (Issue #7 Ready)</h4>
                </div>
                <p>
                  As an authorized Bank Employee, you have full clearance to open bank accounts for registered customers, inspect account balances, and toggle account operational status (Active, Inactive, Frozen) in accordance with bank policy (FR-07, FR-08, FR-09, FR-10, FR-11).
                </p>
                <div className="roadmap-actions-row">
                  <button
                    type="button"
                    className="btn-primary-custom"
                    onClick={() => setActiveNav('accounts')}
                  >
                    <IconLandmark size={16} />
                    <span>Open Account Management Dashboard</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-custom"
                    onClick={() => setActiveNav('diagnostics')}
                  >
                    <IconActivity size={15} />
                    <span>System Diagnostics</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ==================================================================
               CUSTOMER: RETAIL BANKING PORTAL (FR-09 Live Account Overview)
               ================================================================== */
            <div className="role-portal-view">
              <div className="portal-banner">
                <div className="portal-banner-icon icon-customer-banner">
                  <IconLandmark size={28} />
                </div>
                <div>
                  <h1 className="portal-title">Personal Online Banking Portal</h1>
                  <p className="portal-subtitle">
                    Account Holder: <strong>{currentUser.displayName}</strong> &bull; Customer ID #{currentUser.customerId || '1'}
                  </p>
                </div>
              </div>

              {/* Verified Accounts Live Ledger Section (FR-09) */}
              <div className="customer-accounts-section" style={{ marginBottom: '2rem' }}>
                <div className="emp-page-header" style={{ marginBottom: '1rem' }}>
                  <div>
                    <h2 className="emp-page-title" style={{ fontSize: '1.25rem' }}>Your Bank Accounts</h2>
                    <p className="emp-page-subtitle">
                      Live account balances and operational status from the core banking ledger (FR-09).
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn-secondary-custom"
                      onClick={loadCustomerAccounts}
                      disabled={custAccountsLoading}
                    >
                      <IconCreditCard size={15} />
                      <span>{custAccountsLoading ? 'Refreshing...' : 'Refresh Balance'}</span>
                    </button>
                    <button
                      id="customer-header-transfer-btn"
                      type="button"
                      className="btn-primary-custom"
                      onClick={() => {
                        setSelectedTransferSourceId(null);
                        setTransferModalOpen(true);
                      }}
                      disabled={customerAccounts.filter((a) => a.status === 'ACTIVE').length === 0}
                      style={{ gap: '0.45rem', fontSize: '0.85rem' }}
                      title="Initiate fund transfer between accounts (FR-15)"
                    >
                      <IconSend size={15} />
                      <span>Transfer Funds</span>
                    </button>
                  </div>
                </div>

                {custAccountsLoading ? (
                  <div className="table-skeleton-container" style={{ padding: '1rem' }}>
                    <div className="skeleton-row" />
                    <div className="skeleton-row" />
                  </div>
                ) : customerAccounts.length === 0 ? (
                  <div className="empty-state-box" style={{ padding: '2rem' }}>
                    <IconCreditCard size={32} className="empty-state-icon" />
                    <h3>No Bank Accounts Linked</h3>
                    <p>Please contact branch staff to open a savings or current account for your customer profile.</p>
                  </div>
                ) : (
                  <div className="emp-stats-grid">
                    {customerAccounts.map((acc) => {
                      const numVal = Number(acc.balance) || 0;
                      const formatted = new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        minimumFractionDigits: 2
                      }).format(numVal);

                      return (
                        <div key={acc.accountId} className="emp-stat-card" style={{ padding: '1.25rem 1.5rem' }}>
                          <div className="stat-icon-wrapper active-icon">
                            <IconLandmark size={22} />
                          </div>
                          <div className="stat-details" style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="stat-label">{acc.accountType} ACCOUNT</span>
                              <span className={`status-badge-custom badge-${String(acc.status).toLowerCase()}`} style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                                <span className="status-dot" />
                                <span>{acc.status}</span>
                              </span>
                            </div>
                            <span className="stat-value font-mono" style={{ fontSize: '1.4rem', color: '#60a5fa', margin: '0.35rem 0' }}>
                              {acc.accountNumber}
                            </span>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem' }}>
                              <span className="stat-desc">Available Balance</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '1.25rem', color: '#f8fafc' }}>
                                {formatted}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                              <button
                                type="button"
                                className="btn-secondary-custom"
                                style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', gap: '0.4rem', padding: '0.4rem 0.65rem' }}
                                onClick={async () => {
                                  setCustomerStatementModal(acc);
                                  setCustStatementLoading(true);
                                  try {
                                    const res = await getAccountTransactions(acc.accountId, { page: 1, size: 20 });
                                    setCustStatementTxns(res?.transactions || []);
                                  } catch {
                                    setCustStatementTxns([]);
                                  } finally {
                                    setCustStatementLoading(false);
                                  }
                                }}
                              >
                                <IconHistory size={14} />
                                <span>Statement</span>
                              </button>
                              {acc.status === 'ACTIVE' && (
                                <button
                                  type="button"
                                  className="btn-primary-custom"
                                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.78rem', gap: '0.4rem', padding: '0.4rem 0.65rem' }}
                                  onClick={() => {
                                    setSelectedTransferSourceId(acc.accountId);
                                    setTransferModalOpen(true);
                                  }}
                                  title="Transfer funds from this account (FR-15)"
                                >
                                  <IconSend size={14} />
                                  <span>Transfer</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Customer Roadmap Notice Box */}
              <div className="roadmap-notice-box">
                <div className="roadmap-notice-header">
                  <IconShield size={18} className="roadmap-shield-icon" />
                  <h4>Online Banking Roadmap Notice (SRS Section 3 &amp; Sprint 2)</h4>
                </div>
                <p>
                  You are securely logged into your personal <strong>Retail Banking Portal</strong>. Under the system's role-based security specification (FR-03, NFR-02), administrative modules like <strong>Employee Account Management</strong> are inaccessible to customers.
                </p>
                <div className="roadmap-timeline-box">
                  <span className="timeline-badge">Sprint 2 Customer Banking Features</span>
                  <div className="timeline-items-grid">
                    <div className="timeline-item">
                      <span className="item-req">FR-09</span>
                      <span className="item-title">View Balance &amp; Details</span>
                      <span className="item-status" style={{ color: '#10b981' }}>Live (Implemented)</span>
                    </div>
                    <div className="timeline-item">
                      <span className="item-req">FR-15, FR-17</span>
                      <span className="item-title">Direct Fund Transfer</span>
                      <span className="item-status">Sprint 2</span>
                    </div>
                    <div className="timeline-item">
                      <span className="item-req">FR-20</span>
                      <span className="item-title">Transaction History Statements</span>
                      <span className="item-status">Sprint 2</span>
                    </div>
                    <div className="timeline-item">
                      <span className="item-req">FR-06, FR-22</span>
                      <span className="item-title">Profile Update &amp; Password</span>
                      <span className="item-status">Sprint 2</span>
                    </div>
                  </div>
                </div>
                <div className="roadmap-actions-row">
                  <button
                    type="button"
                    className="btn-secondary-custom"
                    onClick={() => setActiveNav('diagnostics')}
                  >
                    <IconActivity size={15} />
                    <span>View System Diagnostics</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary-custom"
                    onClick={handleLogout}
                  >
                    <IconLogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      {/* Customer Fund Transfer Modal (Issue #9) */}
      <CustomerTransferModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        accounts={customerAccounts}
        initialSourceAccountId={selectedTransferSourceId}
        onTransferSuccess={() => {
          loadCustomerAccounts().catch(() => {});
        }}
      />

      {/* Customer Account Statement Modal */}
      {customerStatementModal && (
        <div className="modal-overlay" onClick={() => setCustomerStatementModal(null)}>
          <div className="modal-card" style={{ maxWidth: '840px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-box">
                <IconHistory size={22} className="modal-header-icon text-info" />
                <h3>Account Statement: {customerStatementModal.accountNumber}</h3>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setCustomerStatementModal(null)}
                aria-label="Close statement"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="modal-body-content" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
              {/* Multi-Account Selector if Customer has more than 1 account */}
              {customerAccounts.length > 1 && (
                <div style={{ marginBottom: '1rem', background: '#090e1a', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <label htmlFor="statement-account-select" style={{ display: 'block', fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem', fontWeight: 700 }}>
                    Switch Account Statement
                  </label>
                  <select
                    id="statement-account-select"
                    value={customerStatementModal.accountId}
                    onChange={(e) => {
                      const selected = customerAccounts.find((a) => String(a.accountId) === e.target.value);
                      if (selected) {
                        loadCustomerStatement(selected, 1, custStatementType);
                      }
                    }}
                    style={{
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#f8fafc',
                      borderRadius: '6px',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.825rem',
                      width: '100%',
                      outline: 'none'
                    }}
                  >
                    {customerAccounts.map((acc) => (
                      <option key={acc.accountId} value={acc.accountId}>
                        {acc.accountNumber} ({acc.accountType}) — Available: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(acc.balance) || 0)} [{acc.status}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Account Summary Banner */}
              <div className="txn-account-summary-box" style={{ background: '#090e1a', padding: '0.85rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <div style={{ color: '#60a5fa', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{customerStatementModal.accountNumber}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {customerStatementModal.accountType} Account • Status: <span style={{ color: customerStatementModal.status === 'ACTIVE' ? '#34d399' : '#f87171', fontWeight: 600 }}>{customerStatementModal.status}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Available Balance</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.2rem', color: '#f8fafc' }}>
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(customerStatementModal.balance) || 0)}
                  </div>
                </div>
              </div>

              {/* Header & Filter Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Transaction History (FR-20)
                </h4>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {[
                    { label: 'All', val: '' },
                    { label: 'Deposits', val: 'DEPOSIT' },
                    { label: 'Withdrawals', val: 'WITHDRAWAL' },
                    { label: 'Transfers', val: 'TRANSFER' }
                  ].map((f) => (
                    <button
                      key={f.label}
                      type="button"
                      onClick={() => loadCustomerStatement(customerStatementModal, 1, f.val)}
                      style={{
                        background: custStatementType === f.val ? '#2563eb' : '#1e293b',
                        color: custStatementType === f.val ? '#ffffff' : '#94a3b8',
                        border: '1px solid',
                        borderColor: custStatementType === f.val ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '9999px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {custStatementLoading ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>Loading statement ledger...</div>
              ) : custStatementTxns.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                  No transaction records found for this account.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="emp-table-custom" style={{ width: '100%', fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Reference</th>
                        <th>Type</th>
                        <th>Transaction Flow</th>
                        <th>Remarks</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custStatementTxns.map((tx) => {
                        const typeUpper = String(tx.type || tx.transaction_type || '').toUpperCase();
                        const isCredit = tx.direction === 'CREDIT' || (typeUpper === 'DEPOSIT');
                        
                        let flowDesc = '—';
                        if (typeUpper === 'DEPOSIT') {
                          flowDesc = 'Cash Deposit at Branch';
                        } else if (typeUpper === 'WITHDRAWAL') {
                          flowDesc = 'Counter Cash Withdrawal';
                        } else if (typeUpper === 'TRANSFER') {
                          if (isCredit) {
                            flowDesc = `Transfer from ${tx.sourceAccountNumber || 'account'}`;
                          } else {
                            flowDesc = `Transfer to ${tx.destinationAccountNumber || 'recipient'}`;
                          }
                        }

                        return (
                          <tr key={tx.transaction_id || tx.transactionId || tx.transactionRef}>
                            <td style={{ whiteSpace: 'nowrap', color: '#94a3b8' }}>
                              {new Date(tx.created_at || tx.createdAt || tx.timestamp).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: '#60a5fa' }}>
                              {tx.transaction_ref || tx.transactionRef || tx.transactionReference}
                            </td>
                            <td>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  background: typeUpper === 'DEPOSIT'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : typeUpper === 'WITHDRAWAL'
                                    ? 'rgba(56, 189, 248, 0.15)'
                                    : 'rgba(168, 85, 247, 0.15)',
                                  color: typeUpper === 'DEPOSIT' ? '#34d399' : typeUpper === 'WITHDRAWAL' ? '#38bdf8' : '#c084fc',
                                  border: `1px solid ${typeUpper === 'DEPOSIT' ? 'rgba(16, 185, 129, 0.3)' : typeUpper === 'WITHDRAWAL' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`
                                }}
                              >
                                {typeUpper}
                              </span>
                            </td>
                            <td style={{ color: '#e2e8f0', fontWeight: 500 }}>
                              {flowDesc}
                            </td>
                            <td style={{ color: '#94a3b8', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tx.remarks || '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isCredit ? '#34d399' : '#f87171' }}>
                              {isCredit ? '+ ' : '- '}
                              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(tx.amount))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Statement Pagination Controls */}
              {custStatementTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Page {custStatementPage} of {custStatementTotalPages} ({custStatementTotal} total)
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn-secondary-custom"
                      disabled={custStatementPage <= 1 || custStatementLoading}
                      onClick={() => loadCustomerStatement(customerStatementModal, custStatementPage - 1, custStatementType)}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                    >
                      &larr; Prev
                    </button>
                    <button
                      type="button"
                      className="btn-secondary-custom"
                      disabled={custStatementPage >= custStatementTotalPages || custStatementLoading}
                      onClick={() => loadCustomerStatement(customerStatementModal, custStatementPage + 1, custStatementType)}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                    >
                      Next &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-secondary-custom"
                onClick={() => setCustomerStatementModal(null)}
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
