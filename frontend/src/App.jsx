import { useState, useEffect } from 'react';
import { getSystemHealth, login, logout, getCurrentUser } from './services/api';
import EmployeeManagement from './components/EmployeeManagement';
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

function IconLayoutDashboard({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
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

function IconClock({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// Database schema definitions preserved for Diagnostic explorer
const SCHEMA_DEFINITIONS = {
  accounts: {
    title: 'accounts',
    description: 'Core financial accounts owned by customers. Enforces non-negative balance and unique account numbers.',
    columns: [
      { name: 'account_id', type: 'BIGINT AUTO_INCREMENT', key: 'PK', desc: 'Internal surrogate identifier' },
      { name: 'account_number', type: 'VARCHAR(30)', key: 'UK', desc: 'Public alphanumeric account identifier (e.g. ACC-T1)' },
      { name: 'customer_id', type: 'BIGINT', key: 'FK', desc: 'References customers(customer_id) ON DELETE RESTRICT' },
      { name: 'account_type', type: 'VARCHAR(20)', key: '', desc: 'Savings or Checking account category' },
      { name: 'balance', type: 'DECIMAL(15,2)', key: 'CHECK', desc: 'Current balance; CHECK (balance >= 0.00)' },
      { name: 'status', type: 'ENUM("ACTIVE","INACTIVE","FROZEN")', key: '', desc: 'Account operational status' },
      { name: 'opened_at', type: 'DATETIME', key: '', desc: 'Record creation timestamp' },
      { name: 'updated_at', type: 'DATETIME', key: '', desc: 'Auto-updating modification timestamp' }
    ],
    constraints: 'PRIMARY KEY (account_id), UNIQUE KEY (account_number), FOREIGN KEY (customer_id) REFERENCES customers(customer_id), CHECK (balance >= 0.00), ENGINE=InnoDB'
  },
  bank_transactions: {
    title: 'bank_transactions',
    description: 'Immutable ledger entries capturing deposits, withdrawals, and transfers with strict referential integrity.',
    columns: [
      { name: 'transaction_id', type: 'BIGINT AUTO_INCREMENT', key: 'PK', desc: 'Internal ledger identifier' },
      { name: 'transaction_ref', type: 'VARCHAR(64)', key: 'UK', desc: 'Unique UUID/idempotency reference (TXN-...)' },
      { name: 'type', type: 'ENUM("DEPOSIT","WITHDRAWAL","TRANSFER")', key: '', desc: 'Transaction category' },
      { name: 'amount', type: 'DECIMAL(15,2)', key: 'CHECK', desc: 'Transaction value; CHECK (amount > 0.00)' },
      { name: 'source_account_id', type: 'BIGINT', key: 'FK', desc: 'NULL for DEPOSIT; references accounts(account_id)' },
      { name: 'destination_account_id', type: 'BIGINT', key: 'FK', desc: 'NULL for WITHDRAWAL; references accounts(account_id)' },
      { name: 'performed_by_user_id', type: 'BIGINT', key: 'FK', desc: 'Actor user ID; references users(user_id)' },
      { name: 'remarks', type: 'VARCHAR(255)', key: '', desc: 'Optional transaction audit remarks' },
      { name: 'created_at', type: 'DATETIME', key: '', desc: 'Immutable transaction timestamp' }
    ],
    constraints: 'PRIMARY KEY (transaction_id), UNIQUE KEY (transaction_ref), FKs to accounts and users, CHECK (amount > 0.00), ENGINE=InnoDB'
  },
  users: {
    title: 'users',
    description: 'System authentication identity records. Supports Admin, Employee, and Customer roles.',
    columns: [
      { name: 'user_id', type: 'BIGINT AUTO_INCREMENT', key: 'PK', desc: 'Surrogate user identity identifier' },
      { name: 'username', type: 'VARCHAR(50)', key: 'UK', desc: 'Unique lowercase username' },
      { name: 'password_hash', type: 'VARCHAR(255)', key: '', desc: 'Salted bcrypt hash' },
      { name: 'role', type: 'ENUM("ADMIN","EMPLOYEE","CUSTOMER")', key: '', desc: 'Role-based access classification' },
      { name: 'status', type: 'ENUM("ACTIVE","INACTIVE")', key: '', desc: 'Account authorization state' },
      { name: 'created_at', type: 'DATETIME', key: '', desc: 'Creation timestamp' },
      { name: 'updated_at', type: 'DATETIME', key: '', desc: 'Auto-updating modification timestamp' }
    ],
    constraints: 'PRIMARY KEY (user_id), UNIQUE KEY (username), ENGINE=InnoDB'
  },
  customers: {
    title: 'customers',
    description: 'Customer profile details linked 1:1 with users table.',
    columns: [
      { name: 'customer_id', type: 'BIGINT AUTO_INCREMENT', key: 'PK', desc: 'Surrogate customer identifier' },
      { name: 'user_id', type: 'BIGINT', key: 'UK, FK', desc: '1:1 relationship to users(user_id) ON DELETE RESTRICT' },
      { name: 'full_name', type: 'VARCHAR(100)', key: '', desc: 'Customer full legal name' },
      { name: 'date_of_birth', type: 'DATE', key: '', desc: 'Date of birth' },
      { name: 'phone', type: 'VARCHAR(20)', key: '', desc: 'Contact phone number' },
      { name: 'email', type: 'VARCHAR(100)', key: '', desc: 'Contact email address' },
      { name: 'address', type: 'VARCHAR(255)', key: '', desc: 'Mailing/residential address' }
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

  // Navigation tab state
  const [activeNav, setActiveNav] = useState('main'); // 'main' | 'diagnostics'

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
        }
      })
      .catch(() => {
        // Visitor remains unauthenticated
      });

    return () => {
      isCancelled = true;
    };
  }, []);

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
      setActiveNav('main');
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
      setActiveNav('main');
    } catch (err) {
      setAuthError(err.message || 'Logout failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
    setAuthError(null);
  };

  const healthData = health?.data || health;
  const isDbConnected = Boolean(
    healthData?.database?.connected ??
    (healthData?.database?.status?.toLowerCase() === 'connected')
  );

  // User avatar initials
  const userInitials = (currentUser?.displayName || currentUser?.username || 'US')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // ----------------------------------------------------------------------------
  // SCENARIO 1: UNAUTHENTICATED VISITOR (Modern Banking Login Screen)
  // ----------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="login-screen-root">
        <div className="login-screen-card">
          <div className="login-brand-header">
            <div className="login-brand-logo">
              <IconBuilding size={26} />
            </div>
            <div>
              <h2 className="login-bank-name">CORE BANK</h2>
              <p className="login-portal-subtitle">Secure Banking Portal</p>
            </div>
          </div>

          <form className="login-form" onSubmit={handleLogin} id="login-form">
            {authError && (
              <div className="login-error-alert" role="alert" id="auth-error-banner">
                <IconAlertCircle size={16} />
                <span>{authError}</span>
              </div>
            )}

            <div className="login-field-group">
              <label className="login-label" htmlFor="login-username">
                Username
              </label>
              <input
                id="login-username"
                className="login-input"
                type="text"
                placeholder="e.g. test.admin1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={authLoading}
                required
              />
            </div>

            <div className="login-field-group">
              <label className="login-label" htmlFor="login-password">
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
                className="quickfill-btn admin-quickfill"
                onClick={() => handleQuickFill('test.admin1', 'Password123!')}
              >
                <IconShield size={13} />
                <span>Admin (test.admin1) &bull; Employee Admin</span>
              </button>
              <button
                type="button"
                className="quickfill-btn employee-quickfill"
                onClick={() => handleQuickFill('test.employee1', 'Password123!')}
              >
                <IconUserCheck size={13} />
                <span>Employee (test.employee1) &bull; Branch Staff</span>
              </button>
              <button
                type="button"
                className="quickfill-btn customer-quickfill"
                onClick={() => handleQuickFill('test.customer1', 'Password123!')}
              >
                <IconUsers size={13} />
                <span>Customer (test.customer1) &bull; Account Holder</span>
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

        {/* Navigation Items */}
        <nav className="sidebar-nav" aria-label="Portal Navigation">
          <div className="sidebar-group-title">
            {isAdmin ? 'Administration' : isEmployee ? 'Branch Operations' : 'My Accounts'}
          </div>

          {/* ADMIN NAVIGATION */}
          {isAdmin && (
            <>
              <div
                className="sidebar-nav-item disabled-item"
                title="Dashboard overview module is scheduled for future release"
              >
                <IconLayoutDashboard size={17} />
                <span>Dashboard</span>
                <span className="nav-badge-pending">Soon</span>
              </div>

              <div
                className="sidebar-nav-item disabled-item"
                title="Customer management scheduled for Sprint 2"
              >
                <IconUsers size={17} />
                <span>Customers</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>

              <div
                className="sidebar-nav-item disabled-item"
                title="Account management scheduled for Sprint 2"
              >
                <IconLandmark size={17} />
                <span>Accounts</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>

              <div
                className="sidebar-nav-item disabled-item"
                title="Transaction processing scheduled for Sprint 2"
              >
                <IconCreditCard size={17} />
                <span>Transactions</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>

              {/* ACTIVE Employees Section */}
              <button
                type="button"
                className={`sidebar-nav-item active-item ${activeNav === 'main' ? 'selected' : ''}`}
                onClick={() => setActiveNav('main')}
              >
                <IconUserCheck size={17} />
                <span>Employees</span>
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
              <button
                type="button"
                className={`sidebar-nav-item active-item ${activeNav === 'main' ? 'selected' : ''}`}
                onClick={() => setActiveNav('main')}
              >
                <IconUserCheck size={17} />
                <span>Staff Overview</span>
                <span className="nav-badge-active">Active</span>
              </button>

              <div
                className="sidebar-nav-item disabled-item"
                title="Customer registration scheduled for Sprint 2 (FR-04)"
              >
                <IconUsers size={17} />
                <span>Register Customer</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>

              <div
                className="sidebar-nav-item disabled-item"
                title="Account opening and status management scheduled for Sprint 2 (FR-07)"
              >
                <IconLandmark size={17} />
                <span>Manage Accounts</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>

              <div
                className="sidebar-nav-item disabled-item"
                title="Deposit workflow scheduled for Sprint 2 (FR-12)"
              >
                <IconCreditCard size={17} />
                <span>Cash Deposit</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>

              <div
                className="sidebar-nav-item disabled-item"
                title="Withdrawal workflow scheduled for Sprint 2 (FR-13)"
              >
                <IconCreditCard size={17} />
                <span>Cash Withdrawal</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>
            </>
          )}

          {/* CUSTOMER NAVIGATION */}
          {isCustomer && (
            <>
              <button
                type="button"
                className={`sidebar-nav-item active-item ${activeNav === 'main' ? 'selected' : ''}`}
                onClick={() => setActiveNav('main')}
              >
                <IconLandmark size={17} />
                <span>Account Overview</span>
                <span className="nav-badge-active">Active</span>
              </button>

              <div
                className="sidebar-nav-item disabled-item"
                title="Account balance viewing scheduled for Sprint 2 (FR-09)"
              >
                <IconCreditCard size={17} />
                <span>My Accounts</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>

              <div
                className="sidebar-nav-item disabled-item"
                title="Fund transfer workflow scheduled for Sprint 2 (FR-15)"
              >
                <IconFileText size={17} />
                <span>Transfer Funds</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>

              <div
                className="sidebar-nav-item disabled-item"
                title="Transaction history statement scheduled for Sprint 2 (FR-20)"
              >
                <IconClock size={17} />
                <span>Statements</span>
                <span className="nav-badge-pending">Sprint 2</span>
              </div>
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
            title="Sign out of current banking session"
          >
            <IconLogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------------------
          MAIN APPLICATION VIEWPORT
          ------------------------------------------------------------------------ */}
      <div className="dashboard-main-viewport">
        {/* Top Navigation Bar */}
        <header className="dashboard-topbar">
          <div className="topbar-breadcrumb">
            <span className="breadcrumb-parent">
              {isAdmin ? 'Administration' : isEmployee ? 'Branch Operations' : 'Retail Banking'}
            </span>
            <span className="breadcrumb-divider">/</span>
            <span className="breadcrumb-current">
              {activeNav === 'diagnostics'
                ? 'System Diagnostics'
                : isAdmin
                ? 'Employees'
                : isEmployee
                ? 'Staff Overview'
                : 'Account Overview'}
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
          ) : isAdmin ? (
            /* ==================================================================
               ADMINISTRATOR: EMPLOYEE MANAGEMENT CONSOLE (Issue #11)
               ================================================================== */
            <EmployeeManagement currentUser={currentUser} />
          ) : isEmployee ? (
            /* ==================================================================
               EMPLOYEE: BRANCH OPERATIONS PORTAL
               ================================================================== */
            <div className="role-portal-view">
              <div className="portal-banner">
                <div className="portal-banner-icon icon-employee-banner">
                  <IconUserCheck size={28} />
                </div>
                <div>
                  <h1 className="portal-title">Bank Staff Operations Workspace</h1>
                  <p className="portal-subtitle">
                    Authorized terminal for <strong>{currentUser.displayName}</strong> &bull; Staff ID #{currentUser.employeeId || '2'}
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

              {/* Roadmap Notice Box */}
              <div className="roadmap-notice-box">
                <div className="roadmap-notice-header">
                  <IconShield size={18} className="roadmap-shield-icon" />
                  <h4>Role-Based Access Control Notice (SRS Section 3 &amp; Issue #11)</h4>
                </div>
                <p>
                  You are successfully authenticated into the <strong>Bank Staff Terminal</strong>. Under the system's role-based security specification (FR-03, FR-23), <strong>Employee Account and Access Management</strong> is strictly reserved for Administrators.
                </p>
                <div className="roadmap-timeline-box">
                  <span className="timeline-badge">Sprint 2 Scheduled Deliverables</span>
                  <div className="timeline-items-grid">
                    <div className="timeline-item">
                      <span className="item-req">FR-04</span>
                      <span className="item-title">Register New Customer</span>
                      <span className="item-status">Sprint 2</span>
                    </div>
                    <div className="timeline-item">
                      <span className="item-req">FR-07, FR-10</span>
                      <span className="item-title">Create &amp; Manage Accounts</span>
                      <span className="item-status">Sprint 2</span>
                    </div>
                    <div className="timeline-item">
                      <span className="item-req">FR-12, FR-13</span>
                      <span className="item-title">Cash Deposits &amp; Withdrawals</span>
                      <span className="item-status">Sprint 2</span>
                    </div>
                    <div className="timeline-item">
                      <span className="item-req">FR-21</span>
                      <span className="item-title">Audit Transaction Records</span>
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
                    <span>Sign Out &amp; Switch to Admin</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ==================================================================
               CUSTOMER: RETAIL BANKING PORTAL
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

              {/* Customer Account Snapshot Card */}
              <div className="emp-stats-grid" style={{ marginBottom: '1.75rem' }}>
                <div className="emp-stat-card">
                  <div className="stat-icon-wrapper active-icon">
                    <IconLandmark size={22} />
                  </div>
                  <div className="stat-details">
                    <span className="stat-label">Primary Account</span>
                    <span className="stat-value" style={{ fontSize: '1.25rem', color: '#34d399' }}>ACC-T1</span>
                    <span className="stat-desc">Savings Account</span>
                  </div>
                </div>

                <div className="emp-stat-card">
                  <div className="stat-icon-wrapper total-icon">
                    <IconCreditCard size={22} />
                  </div>
                  <div className="stat-details">
                    <span className="stat-label">Currency</span>
                    <span className="stat-value" style={{ fontSize: '1.25rem', color: '#f8fafc' }}>INR (₹)</span>
                    <span className="stat-desc">Exact Decimal (15,2)</span>
                  </div>
                </div>

                <div className="emp-stat-card">
                  <div className="stat-icon-wrapper active-icon">
                    <IconUserCheck size={22} />
                  </div>
                  <div className="stat-details">
                    <span className="stat-label">Account Status</span>
                    <span className="stat-value text-success" style={{ fontSize: '1.25rem' }}>ACTIVE</span>
                    <span className="stat-desc">Operational for transactions</span>
                  </div>
                </div>
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
                      <span className="item-status">Sprint 2</span>
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
                    <span>Sign Out &amp; Switch to Admin</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
