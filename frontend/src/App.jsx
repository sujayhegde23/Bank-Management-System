import { useState, useEffect, useCallback } from 'react';
import { getSystemHealth, login, verifyOtp, resendOtp, logout, getCurrentUser, getAccounts } from './services/api';
import EmployeeManagement from './components/EmployeeManagement';
import AccountManagement from './components/AccountManagement';
import CustomerTransferModal from './components/CustomerTransferModal';
import TransactionsView from './components/TransactionsView';
import CustomerManagement from './components/CustomerManagement';
import AdminReports from './components/AdminReports';
import AdminDashboard from './components/AdminDashboard';
import AuditLogs from './components/AuditLogs';
import EmployeeActivityHistory from './components/EmployeeActivityHistory';
import CustomerAccountOverview from './components/CustomerAccountOverview';
import CustomerStatements from './components/CustomerStatements';
import CustomerProfile from './components/CustomerProfile';
import AccountStatementModal from './components/AccountStatementModal';
import FraudDashboard from './components/FraudDashboard';
import OtpVerification from './components/OtpVerification';
import './App.css';

/* ==============================================================================
   Lucide-style Inline SVG Icons for Navigation & Dashboard Layout
   ============================================================================== */

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

function IconShieldAlert({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
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


function IconMenu({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
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
    description: 'Core financial accounts owned by customers. Enforces non-negative balance and unique account numbers.',
    columns: [
      { name: 'account_id', type: 'BIGINT AUTO_INCREMENT', key: 'PK', desc: 'Internal surrogate identifier' },
      { name: 'account_number', type: 'VARCHAR(30)', key: 'UK', desc: 'Public alphanumeric account identifier (e.g. ACC-SB-XXXXXXXX)' },
      { name: 'customer_id', type: 'BIGINT', key: 'FK', desc: 'References customers(customer_id) ON DELETE RESTRICT' },
      { name: 'account_type', type: 'VARCHAR(20)', key: '', desc: 'Savings or Current account category' },
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

function getPersistedNav(role) {
  if (typeof window === 'undefined') return 'dashboard';
  const rawHash = (window.location.hash || '').replace(/^#\/?/, '').trim();
  const validAdminRoutes = ['dashboard', 'employees', 'customers', 'accounts', 'transactions', 'reports', 'audit-logs', 'diagnostics'];
  const validEmployeeRoutes = ['accounts', 'overview', 'customers', 'transactions', 'my-activity'];
  const validCustomerRoutes = ['overview', 'statements', 'profile'];
  const allowedAdminRoutes = [...validAdminRoutes, 'fraud'];
  const allowedEmployeeRoutes = [...validEmployeeRoutes, 'fraud'];

  let stored = null;
  try {
    stored = sessionStorage.getItem('bms_active_nav');
  } catch {}

  if (role === 'ADMIN') {
    if (allowedAdminRoutes.includes(rawHash)) return rawHash;
    if (stored && allowedAdminRoutes.includes(stored)) return stored;
    return 'dashboard';
  } else if (role === 'EMPLOYEE') {
    if (allowedEmployeeRoutes.includes(rawHash)) return rawHash;
    if (stored && allowedEmployeeRoutes.includes(stored)) return stored;
    return 'accounts';
  } else if (role === 'CUSTOMER') {
    if (validCustomerRoutes.includes(rawHash)) return rawHash;
    if (stored && validCustomerRoutes.includes(stored)) return stored;
    return 'overview';
  }
  return rawHash || 'dashboard';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Two-Stage OTP Authentication State (Phase 3)
  const [pendingChallenge, setPendingChallenge] = useState(null);

  // Navigation tab state: 'accounts' | 'employees' | 'diagnostics' | 'overview' | 'statements'
  const [activeNav, setActiveNav] = useState('accounts');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleNavChange = useCallback((tab) => {
    setActiveNav(tab);
    setMobileNavOpen(false);
    try {
      sessionStorage.setItem('bms_active_nav', tab);
      if (window.location.hash !== `#${tab}`) {
        window.history.replaceState(null, '', `#${tab}`);
      }
    } catch {}
  }, []);
  const [accountAction, setAccountAction] = useState(null);
  const [customerStatementModal, setCustomerStatementModal] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedTransferSourceId, setSelectedTransferSourceId] = useState(null);
  const [selectedStatementAccountId, setSelectedStatementAccountId] = useState(null);




  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && customerStatementModal) {
        setCustomerStatementModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [customerStatementModal]);

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
          // Set persisted or default navigation based on role (Feature 5)
          const initialNav = getPersistedNav(user.role);
          setActiveNav(initialNav);
          try {
            sessionStorage.setItem('bms_active_nav', initialNav);
            window.history.replaceState(null, '', `#${initialNav}`);
          } catch {}
        }
      })
      .catch(() => {
        // Visitor remains unauthenticated
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Hash synchronization listener for browser forward/back buttons (Feature 5)
  useEffect(() => {
    const handleHash = () => {
      if (currentUser) {
        const validated = getPersistedNav(currentUser.role);
        if (validated && validated !== activeNav) {
          setActiveNav(validated);
        }
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [currentUser, activeNav]);

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
      const challengeData = await login({ username: username.trim(), password });
      if (challengeData?.challengeId) {
        setPendingChallenge({
          challengeId: challengeData.challengeId,
          maskedEmail: challengeData.maskedEmail || 'registered email',
          expiresInSeconds: challengeData.expiresInSeconds || 300,
          resendAvailableInSeconds: challengeData.resendAvailableInSeconds || 60,
          username: username.trim()
        });
        setPassword('');
      } else {
        throw new Error('Unexpected authentication response from server.');
      }
    } catch (err) {
      setAuthError(err.message || 'Invalid username or password');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (otp) => {
    if (!pendingChallenge?.challengeId) {
      setAuthError('No active verification challenge. Please sign in again.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);

    try {
      const user = await verifyOtp({
        challengeId: pendingChallenge.challengeId,
        otp
      });
      setCurrentUser(user);
      setPendingChallenge(null);
      setPassword('');
      const initialNav = getPersistedNav(user.role);
      setActiveNav(initialNav);
      try {
        sessionStorage.setItem('bms_active_nav', initialNav);
        window.history.replaceState(null, '', `#${initialNav}`);
      } catch {}
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingChallenge?.challengeId) {
      throw new Error('No active verification challenge.');
    }
    const updated = await resendOtp({ challengeId: pendingChallenge.challengeId });
    if (updated) {
      setPendingChallenge((prev) => ({
        ...prev,
        challengeId: updated.challengeId || prev?.challengeId,
        maskedEmail: updated.maskedEmail || prev?.maskedEmail,
        expiresInSeconds: updated.expiresInSeconds || 300,
        resendAvailableInSeconds: updated.resendAvailableInSeconds || 60
      }));
      return updated;
    }
    throw new Error('Failed to dispatch new verification code.');
  };

  const handleBackToLogin = () => {
    setPendingChallenge(null);
    setAuthError(null);
    setPassword('');
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      await logout();
      setCurrentUser(null);
      setPendingChallenge(null);
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

  // Diagnostic mapping
  const healthData = health?.data || health;
  const isDbConnected = Boolean(
    healthData?.database?.connected ??
    (healthData?.database?.status?.toLowerCase() === 'connected')
  );

  // ----------------------------------------------------------------------------
  // SCENARIO 1: UNAUTHENTICATED (Login Screen & OTP Screen)
  // ----------------------------------------------------------------------------
  if (!currentUser) {
    if (pendingChallenge) {
      return (
        <OtpVerification
          challenge={pendingChallenge}
          onVerify={handleVerifyOtp}
          onResend={handleResendOtp}
          onBack={handleBackToLogin}
          loading={authLoading}
        />
      );
    }

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
                placeholder="Enter username"
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
      {mobileNavOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`dashboard-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
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
          <button
            type="button"
            className="mobile-sidebar-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav-menu">
          {/* ADMINISTRATOR NAVIGATION */}
          {isAdmin ? (
            <>
              {/* SECTION 1: OVERVIEW */}
              <div className="sidebar-group-title">Overview</div>
              <button
                id="nav-admin-dashboard-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'dashboard' ? 'selected' : ''}`}
                onClick={() => handleNavChange('dashboard')}
                title="Executive banking dashboard and real-time overview"
              >
                <IconLayoutDashboard size={17} />
                <span>Dashboard</span>
              </button>

              {/* SECTION 2: MANAGEMENT */}
              <div className="sidebar-group-title" style={{ marginTop: '1.25rem' }}>Management</div>
              <button
                id="nav-admin-employees-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'employees' ? 'selected' : ''}`}
                onClick={() => handleNavChange('employees')}
                title="Manage staff credentials, permissions, and operational status"
              >
                <IconUserCheck size={17} />
                <span>Employee Management</span>
              </button>

              <button
                id="nav-admin-customers-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'customers' ? 'selected' : ''}`}
                onClick={() => handleNavChange('customers')}
                title="Register and manage customer profiles"
              >
                <IconUsers size={17} />
                <span>Customer Management</span>
              </button>

              <button
                id="nav-admin-accounts-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'accounts' ? 'selected' : ''}`}
                onClick={() => handleNavChange('accounts')}
                title="Oversee bank account lifecycle, balances, and operational status"
              >
                <IconLandmark size={17} />
                <span>Account Management</span>
              </button>

              {/* SECTION 3: MONITORING */}
              <div className="sidebar-group-title" style={{ marginTop: '1.25rem' }}>Monitoring</div>
              <button
                id="nav-admin-transactions-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'transactions' ? 'selected' : ''}`}
                onClick={() => handleNavChange('transactions')}
                title="Audit bank-wide financial transactions"
              >
                <IconCreditCard size={17} />
                <span>Transaction Ledger</span>
              </button>

              <button
                id="nav-admin-reports-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'reports' ? 'selected' : ''}`}
                onClick={() => handleNavChange('reports')}
                title="Executive reports, KPI analytics, and statement summaries"
              >
                <IconFileText size={17} />
                <span>Reports &amp; Analytics</span>
              </button>

              <button
                id="nav-admin-audit-logs-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'audit-logs' ? 'selected' : ''}`}
                onClick={() => handleNavChange('audit-logs')}
                title="Centralized system audit logs and activity monitoring"
              >
                <IconShield size={17} />
                <span>Audit Logs</span>
              </button>

              <button
                id="nav-admin-fraud-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'fraud' ? 'selected' : ''}`}
                onClick={() => handleNavChange('fraud')}
                title="Fraud detection alerts, investigations, and rule management"
              >
                <IconShieldAlert size={17} />
                <span>Fraud Monitoring</span>
              </button>

              {/* SECTION 4: SYSTEM */}
              <div className="sidebar-group-title" style={{ marginTop: '1.25rem' }}>System</div>
              <button
                id="nav-admin-diagnostics-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'diagnostics' ? 'selected' : ''}`}
                onClick={() => handleNavChange('diagnostics')}
                title="Database health diagnostics, connection pool status & schema"
              >
                <IconActivity size={17} />
                <span>System Diagnostics</span>
              </button>
            </>
          ) : (
            <div className="sidebar-group-title">
              {isEmployee ? 'Branch Operations' : 'Account Services'}
            </div>
          )}

          {/* EMPLOYEE NAVIGATION */}
          {isEmployee && (
            <>
              <button
                id="nav-manage-accounts-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'accounts' && !accountAction ? 'selected' : ''}`}
                onClick={() => handleNavChange('accounts')}
              >
                <IconLandmark size={17} />
                <span>Manage Accounts</span>
              </button>

              <button
                id="nav-employee-profile-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'overview' ? 'selected' : ''}`}
                onClick={() => handleNavChange('overview')}
                title="View your staff profile and operational credentials"
              >
                <IconUserCheck size={17} />
                <span>My Profile</span>
              </button>

              <button
                id="nav-employee-activity-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'my-activity' ? 'selected' : ''}`}
                onClick={() => handleNavChange('my-activity')}
                title="Review your personal banking operations and activity history"
              >
                <IconHistory size={17} />
                <span>My Activity</span>
              </button>

              <button
                id="nav-employee-customers-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'customers' ? 'selected' : ''}`}
                onClick={() => handleNavChange('customers')}
                title="Register and manage customers"
              >
                <IconUsers size={17} />
                <span>Customers</span>
              </button>

              <button
                id="nav-cash-deposit-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'accounts' && accountAction === 'deposit' ? 'selected' : ''}`}
                onClick={() => {
                  setActiveNav('accounts');
                  setAccountAction('deposit');
                  setMobileNavOpen(false);
                }}
                title="Deposit cash into customer accounts"
              >
                <IconArrowDownCircle size={17} />
                <span>Cash Deposit</span>
              </button>

              <button
                id="nav-cash-withdrawal-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'accounts' && accountAction === 'withdraw' ? 'selected' : ''}`}
                onClick={() => {
                  setActiveNav('accounts');
                  setAccountAction('withdraw');
                  setMobileNavOpen(false);
                }}
                title="Withdraw cash from customer accounts"
              >
                <IconArrowUpCircle size={17} />
                <span>Cash Withdrawal</span>
              </button>

              <button
                id="nav-employee-transactions-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'transactions' ? 'selected' : ''}`}
                onClick={() => handleNavChange('transactions')}
                title="View customer transactions and audit ledger"
              >
                <IconCreditCard size={17} />
                <span>Transactions</span>
              </button>

              <button
                id="nav-employee-fraud-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'fraud' ? 'selected' : ''}`}
                onClick={() => handleNavChange('fraud')}
                title="View fraud alerts, investigation cases, and risk metrics"
              >
                <IconShieldAlert size={17} />
                <span>Fraud Monitoring</span>
              </button>
            </>
          )}

          {/* CUSTOMER NAVIGATION */}
          {isCustomer && (
            <>
              <button
                type="button"
                className={`sidebar-nav-item ${activeNav === 'overview' ? 'selected' : ''}`}
                onClick={() => handleNavChange('overview')}
              >
                <IconLandmark size={17} />
                <span>Account Overview</span>
              </button>

              <button
                id="nav-customer-transfer-btn"
                type="button"
                className={`sidebar-nav-item ${transferModalOpen ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTransferSourceId(null);
                  setTransferModalOpen(true);
                  setMobileNavOpen(false);
                }}
                title="Transfer money from your bank account to another registered account"
              >
                <IconSend size={17} />
                <span>Transfer Funds</span>
              </button>

              <button
                id="nav-customer-profile-btn"
                type="button"
                className={`sidebar-nav-item ${activeNav === 'profile' ? 'selected' : ''}`}
                onClick={() => handleNavChange('profile')}
                title="View and update your contact details"
              >
                <IconUserCheck size={17} />
                <span>My Profile</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeNav === 'statements' ? 'selected' : ''}`}
                onClick={() => handleNavChange('statements')}
                title="View bank account statements and ledger records"
              >
                <IconHistory size={17} />
                <span>Statements</span>
              </button>
            </>
          )}
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
          <div className="topbar-left-cluster">
            <button
              type="button"
              className="mobile-sidebar-toggle"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              <IconMenu size={20} />
            </button>
            <div className="topbar-breadcrumb">
              <span className="breadcrumb-root">
                {isAdmin ? 'Administration' : isEmployee ? 'Branch Operations' : 'Retail Banking'}
              </span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">
                {activeNav === 'profile'
                  ? 'My Profile'
                  : activeNav === 'diagnostics'
                  ? 'System Diagnostics'
                  : activeNav === 'dashboard'
                  ? 'Executive Dashboard'
                  : activeNav === 'accounts'
                  ? 'Account Management'
                  : activeNav === 'employees'
                  ? 'Employee Management'
                  : activeNav === 'transactions'
                  ? 'Transaction Ledger'
                  : activeNav === 'reports'
                  ? 'Reports & Analytics'
                : activeNav === 'audit-logs'
                ? 'System Audit Logs'
                : isEmployee && activeNav === 'my-activity'
                ? 'My Activity History'
                : isEmployee && activeNav === 'overview'
                ? 'My Profile'
                : 'Workspace Overview'}
            </span>
          </div>
        </div>

          <div className="topbar-right-controls">
            {/* Live API & Database Status Pill */}
            <div className="topbar-status-pill">
              <span className={`status-pulse-dot ${isDbConnected ? 'pulse-green' : 'pulse-amber'}`} />
              <span className="status-pill-text">
                {isDbConnected ? (isCustomer ? 'System Online' : 'MySQL Connected') : (isCustomer ? 'Service Offline' : 'DB Standby')}
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
          {activeNav === 'diagnostics' && isAdmin ? (
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
          ) : isCustomer && activeNav === 'profile' ? (
            /* ==================================================================
               CUSTOMER: MY PROFILE PAGE (Feature 5, FR-05, FR-06, A-06)
               ================================================================== */
            <div className="role-portal-view">
              <CustomerProfile
                currentUser={currentUser}
                onNavigateToOverview={() => handleNavChange('overview')}
              />
            </div>
          ) : isCustomer && activeNav === 'statements' ? (
            /* ==================================================================
               CUSTOMER: ACCOUNT STATEMENTS PAGE (Feature 4, FR-20)
               ================================================================== */
            <div className="role-portal-view">
              <CustomerStatements
                accounts={customerAccounts}
                selectedAccountId={selectedStatementAccountId}
                currentUser={currentUser}
                onNavigateToOverview={() => handleNavChange('overview')}
              />
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

              {/* Customer Account Overview Redesign (Feature 1) */}
              <CustomerAccountOverview
                accounts={customerAccounts}
                loading={custAccountsLoading}
                onRefresh={loadCustomerAccounts}
                currentUser={currentUser}
                onViewStatement={(acc) => {
                  setSelectedStatementAccountId(acc.accountId || acc.account_id);
                  handleNavChange('statements');
                }}
                onTransfer={(sourceAccountId) => {
                  setSelectedTransferSourceId(sourceAccountId || null);
                  setTransferModalOpen(true);
                }}
              />

              {/* Customer Roadmap Notice Box */}
              <div className="roadmap-notice-box">
                <div className="roadmap-notice-header">
                  <IconShield size={18} className="roadmap-shield-icon" />
                  <h4>Online Banking Notice &bull; Cash Counter Clearance Policy</h4>
                </div>
                <p>
                  You are securely logged into your personal <strong>Retail Banking Portal</strong>. Under bank security policy, cash counter deposits and cash withdrawals must be processed in-person at a branch teller window by an authorized bank employee.
                </p>
              </div>
            </div>
          ) : activeNav === 'diagnostics' && !isAdmin ? (
            <div className="empty-state-box" style={{ padding: '3rem', textAlign: 'center' }}>
              <IconAlertCircle size={40} className="text-danger" style={{ marginBottom: '1rem' }} />
              <h2>Access Restricted</h2>
              <p style={{ color: '#94a3b8', maxWidth: '480px', margin: '0.5rem auto 1.5rem' }}>
                System Diagnostics is restricted to Administrators only. Retail banking customers and branch operations staff cannot access system telemetry or database diagnostics.
              </p>
              <button
                type="button"
                className="btn-primary-custom"
                onClick={() => handleNavChange(isEmployee ? 'accounts' : 'overview')}
              >
                Return to Workspace
              </button>
            </div>
          ) : activeNav === 'dashboard' && isAdmin ? (
            /* ==================================================================
               ADMINISTRATOR: EXECUTIVE DASHBOARD (Feature 1)
               ================================================================== */
            <AdminDashboard currentUser={currentUser} onNavigate={(tab) => handleNavChange(tab)} />
          ) : activeNav === 'customers' && (isEmployee || isAdmin) ? (
            /* ==================================================================
               CUSTOMER DIRECTORY & MANAGEMENT (Issue #6, FR-04, FR-05, FR-06)
               ================================================================== */
            <CustomerManagement currentUser={currentUser} />
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
          ) : activeNav === 'reports' && isAdmin ? (
            /* ==================================================================
               ADMINISTRATOR: REPORTS & ANALYTICS (Issue #12, FR-25, TC-19)
               ================================================================== */
            <AdminReports currentUser={currentUser} />
          ) : activeNav === 'audit-logs' && isAdmin ? (
            /* ==================================================================
               ADMINISTRATOR: CENTRALIZED AUDIT LOGS (Feature 2)
               ================================================================== */
            <AuditLogs currentUser={currentUser} />
          ) : activeNav === 'fraud' && (isAdmin || isEmployee) ? (
            /* ==================================================================
               FRAUD MONITORING DASHBOARD (Phase 4)
               ================================================================== */
            <FraudDashboard currentUser={currentUser} />
          ) : isEmployee && activeNav === 'my-activity' ? (
            /* ==================================================================
               EMPLOYEE: PERSONAL ACTIVITY HISTORY (Feature 4)
               ================================================================== */
            <EmployeeActivityHistory currentUser={currentUser} />
          ) : isEmployee && activeNav === 'overview' ? (
            /* ==================================================================
               EMPLOYEE: MY PROFILE (FEATURE 1 §4)
               ================================================================== */
            <div className="role-portal-view">
              <div className="portal-banner">
                <div className="portal-banner-icon icon-employee-banner">
                  <IconUserCheck size={28} />
                </div>
                <div>
                  <h1 className="portal-title">My Employee Profile</h1>
                  <p className="portal-subtitle">
                    Operational staff profile for <strong>{currentUser.displayName}</strong> &bull; Staff ID #{currentUser.employeeId || '1'}
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
                    <span className="stat-value" style={{ fontSize: '1.25rem', color: '#60a5fa' }}>{currentUser.role}</span>
                    <span className="stat-desc">Branch Operations Staff</span>
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
                    <span className="stat-value text-success" style={{ fontSize: '1.25rem' }}>{currentUser.status || 'ACTIVE'}</span>
                    <span className="stat-desc">Active authenticated session</span>
                  </div>
                </div>
              </div>

              {/* Detailed Profile Summary */}
              <div className="emp-table-card" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '1rem' }}>Employee Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: '#090e1a', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Employee Name</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.25rem' }}>{currentUser.displayName}</div>
                  </div>
                  <div style={{ background: '#090e1a', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Staff Identifier</div>
                    <div className="font-mono" style={{ fontSize: '0.95rem', fontWeight: 600, color: '#60a5fa', marginTop: '0.25rem' }}>#{currentUser.employeeId || '1'}</div>
                  </div>
                  <div style={{ background: '#090e1a', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Account Creation Date</div>
                    <div className="font-mono" style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
                      {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'System Default'}
                    </div>
                  </div>
                  <div style={{ background: '#090e1a', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Security Clearance</div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>Branch Operational Role &bull; Read-Only Profile</div>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem', fontStyle: 'italic' }}>
                  * Employee role assignments, operational statuses, and security permissions are strictly managed by Bank Administrators.
                </p>
              </div>

              {/* Quick Jump Navigation */}
              <div className="roadmap-notice-box">
                <div className="roadmap-notice-header">
                  <IconLandmark size={20} style={{ color: '#38bdf8' }} />
                  <h4>Branch Operational Workspaces</h4>
                </div>
                <p>
                  Access your core banking modules below for opening accounts, registering customers, processing counter transactions, and reviewing the ledger.
                </p>
                <div className="roadmap-actions-row">
                  <button
                    type="button"
                    className="btn-primary-custom"
                    onClick={() => handleNavChange('accounts')}
                  >
                    <IconLandmark size={16} />
                    <span>Manage Accounts</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-custom"
                    onClick={() => handleNavChange('customers')}
                  >
                    <IconUsers size={15} />
                    <span>Customer Directory</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary-custom"
                    onClick={() => handleNavChange('transactions')}
                  >
                    <IconCreditCard size={15} />
                    <span>Transaction Ledger</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary-custom"
                    onClick={() => handleNavChange('my-activity')}
                  >
                    <IconHistory size={15} />
                    <span>My Activity</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ==================================================================
               DEFAULT / WORKSPACE ROUTE FALLBACK
               ================================================================== */
            <div className="role-portal-view">
              <div className="empty-state-box" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                <IconLandmark size={44} className="text-primary" style={{ marginBottom: '1rem', opacity: 0.8 }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
                  Select an Operational View
                </h2>
                <p style={{ color: '#94a3b8', maxWidth: '440px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
                  Choose a module from the navigation sidebar to access your core banking workspace.
                </p>
                <button
                  type="button"
                  className="btn-primary-custom"
                  onClick={() => handleNavChange(isAdmin ? 'dashboard' : isEmployee ? 'accounts' : 'overview')}
                >
                  Go to Primary Workspace
                </button>
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




      {/* Customer Account Statement Modal (Feature 4 / Feature 3 Authoritative Modal) */}
      {customerStatementModal && (
        <AccountStatementModal
          accountId={customerStatementModal.accountId || customerStatementModal.account_id}
          accountData={customerStatementModal}
          onClose={() => setCustomerStatementModal(null)}
        />
      )}
    </div>
  );
}