import { useState, useEffect } from 'react';
import { getSystemHealth, login, logout, getCurrentUser } from './services/api';
import EmployeeManagement from './components/EmployeeManagement';
import './App.css';

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
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('accounts');

  // Authentication & session management state
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authSuccess, setAuthSuccess] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSystemHealth();
      setHealth(data);
    } catch (err) {
      setError(err.message || 'Could not connect to backend server');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    // Check system health diagnostic
    getSystemHealth()
      .then((data) => {
        if (!isCancelled) {
          setHealth(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err.message || 'Could not connect to backend server');
          setHealth(null);
        }
      });

    // Rehydrate active session safe profile on page refresh / initial mount
    getCurrentUser()
      .then((user) => {
        if (!isCancelled && user) {
          setCurrentUser(user);
        }
      })
      .catch(() => {
        // Unauthenticated visitors remain guest
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
    setAuthSuccess(null);

    try {
      const user = await login({ username, password });
      setCurrentUser(user);
      setPassword('');
      setAuthSuccess(`Authenticated successfully as ${user.displayName || user.username}`);
    } catch (err) {
      setAuthError(err.message || 'Invalid username or password');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      await logout();
      setCurrentUser(null);
      setUsername('');
      setPassword('');
      setAuthSuccess('Successfully logged out. Session destroyed.');
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
    setAuthSuccess(null);
  };

  const currentSchema = SCHEMA_DEFINITIONS[activeTab];
  const healthData = health?.data || health;
  const isDbConnected = Boolean(
    healthData?.database?.connected ??
    (healthData?.database?.status?.toLowerCase() === 'connected')
  );

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-icon">B</div>
          <div>
            <div className="brand-title">Bank Management System</div>
            <div className="brand-subtitle">Core Banking Foundation</div>
          </div>
        </div>
        <div className="header-badges">
          <span className="badge badge-primary">React 19 + Vite</span>
          <span className="badge badge-primary">Node.js + Express</span>
          <span className="badge badge-primary">MySQL 8.0 InnoDB</span>
          <span className="badge">Issue #11 Employee Management</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <h1 className="hero-title">Core Banking Platform Foundation</h1>
        <p className="hero-description">
          A modular, secure, and auditable architecture built for financial operations,
          strict decimal precision, ACID transaction isolation, and role-based access control.
        </p>
      </section>

      {/* User Authentication & Session Management Card */}
      <section className="auth-card" id="auth-card">
        <div className="auth-header">
          <div className="health-title-group">
            <h2>
              User Authentication & Session Control
              {currentUser ? (
                <span className="badge badge-success" id="auth-status-badge">
                  Active Session ({currentUser.role})
                </span>
              ) : (
                <span className="badge" id="auth-status-badge">
                  Unauthenticated
                </span>
              )}
            </h2>
            <p>
              Academic prototype authentication using bcryptjs salted hashing, HTTP-only cookie sessions, and server-side RBAC
            </p>
          </div>
          {currentUser && (
            <button
              id="logout-btn"
              className="btn-secondary"
              onClick={handleLogout}
              disabled={authLoading}
            >
              {authLoading ? 'Signing out...' : 'Sign Out'}
            </button>
          )}
        </div>

        {currentUser ? (
          <div className="auth-profile-box" id="auth-profile-box">
            <div className="auth-profile-details">
              <div className="profile-field">
                <span className="profile-field-label">User ID</span>
                <span className="profile-field-value">{currentUser.userId}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Username</span>
                <span className="profile-field-value">{currentUser.username}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Role</span>
                <span className="profile-field-value">
                  <span className={`badge ${currentUser.role === 'ADMIN' ? 'badge-danger' : currentUser.role === 'EMPLOYEE' ? 'badge-warning' : 'badge-primary'}`}>
                    {currentUser.role}
                  </span>
                </span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Display Name</span>
                <span className="profile-field-value">{currentUser.displayName || 'Administrator'}</span>
              </div>
              {currentUser.customerId && (
                <div className="profile-field">
                  <span className="profile-field-label">Customer ID</span>
                  <span className="profile-field-value">{currentUser.customerId}</span>
                </div>
              )}
              {currentUser.employeeId && (
                <div className="profile-field">
                  <span className="profile-field-label">Employee ID</span>
                  <span className="profile-field-value">{currentUser.employeeId}</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              🔒 Protected by <code>bms.sid</code> cookie &bull; 15-min sliding timeout
            </div>
          </div>
        ) : (
          <div>
            <form className="auth-form" onSubmit={handleLogin} id="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  className="form-input"
                  type="text"
                  placeholder="e.g. test.customer1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={authLoading}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  className="form-input"
                  type="password"
                  placeholder="Password123!"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={authLoading}
                />
              </div>
              <div className="auth-actions">
                <button
                  id="login-submit-btn"
                  className="btn-primary"
                  type="submit"
                  disabled={authLoading}
                >
                  {authLoading ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>
            </form>

            <div className="auth-quick-fill">
              <span>Quick-fill test accounts (Password: <code>Password123!</code>):</span>
              <button
                type="button"
                className="quick-fill-btn"
                onClick={() => handleQuickFill('test.customer1', 'Password123!')}
              >
                Customer (test.customer1)
              </button>
              <button
                type="button"
                className="quick-fill-btn"
                onClick={() => handleQuickFill('test.employee1', 'Password123!')}
              >
                Employee (test.employee1)
              </button>
              <button
                type="button"
                className="quick-fill-btn"
                onClick={() => handleQuickFill('test.admin1', 'Password123!')}
              >
                Admin (test.admin1)
              </button>
            </div>
          </div>
        )}

        {authError && (
          <div className="auth-error-banner" id="auth-error-banner" role="alert">
            <span>⚠️</span>
            <span>{authError}</span>
          </div>
        )}

        {authSuccess && !authError && (
          <div
            className="auth-error-banner"
            style={{
              background: 'var(--success-bg)',
              borderColor: 'rgba(16, 185, 129, 0.3)',
              color: '#6ee7b7'
            }}
            id="auth-success-banner"
          >
            <span>✓</span>
            <span>{authSuccess}</span>
          </div>
        )}
      </section>

      {/* Employee Management Console (Admin-Only) */}
      {currentUser?.role === 'ADMIN' && (
        <EmployeeManagement currentUser={currentUser} />
      )}

      {/* Diagnostic & Connection Status Card */}
      <section className="health-card" id="health-card">
        <div className="health-card-header">
          <div className="health-title-group">
            <h2>
              System Health & Connection Diagnostic
              {health ? (
                <span className="badge badge-success" id="health-status-badge">Backend Connected</span>
              ) : error ? (
                <span className="badge badge-warning" id="health-status-badge">Backend Standby</span>
              ) : (
                <span className="badge badge-primary" id="health-status-badge">Connecting...</span>
              )}
            </h2>
            <p>Monitors Express REST API uptime and MySQL InnoDB connection pool status</p>
          </div>
          <button
            id="check-health-btn"
            className="btn-primary"
            onClick={checkHealth}
            disabled={loading}
          >
            {loading ? 'Probing...' : 'Refresh Diagnostic'}
          </button>
        </div>

        {health ? (
          <div className="health-grid" id="health-grid">
            <div className="health-item">
              <div className="health-item-label">API Status</div>
              <div className="health-item-value" style={{ color: 'var(--success)' }}>
                {healthData?.status?.toUpperCase() || 'ONLINE'}
              </div>
            </div>
            <div className="health-item">
              <div className="health-item-label">Database Status</div>
              <div
                className="health-item-value"
                style={{
                  color: isDbConnected ? 'var(--success)' : 'var(--warning)'
                }}
              >
                {isDbConnected ? 'CONNECTED (InnoDB)' : 'DISCONNECTED'}
              </div>
            </div>
            <div className="health-item">
              <div className="health-item-label">Backend Environment</div>
              <div className="health-item-value">{healthData?.environment || 'development'}</div>
            </div>
            <div className="health-item">
              <div className="health-item-label">Server Timestamp</div>
              <div className="health-item-value" style={{ fontSize: '0.8rem' }}>
                {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          </div>
        ) : (
          <div className="health-item" style={{ borderLeft: '3px solid var(--warning)' }}>
            <div className="health-item-label">Diagnostic Notice</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {error ? (
                <span>
                  Backend is not yet responding ({error}). To start the backend API server, run:
                  <code style={{ marginLeft: '0.5rem', color: '#93c5fd' }}>npm run dev:backend</code> or{' '}
                  <code style={{ color: '#93c5fd' }}>cd backend && npm run dev</code>
                </span>
              ) : (
                'Connecting to backend service on port 5000...'
              )}
            </div>
          </div>
        )}
      </section>

      {/* Architectural Principles */}
      <section>
        <h2 className="section-title">Core Architectural Principles</h2>
        <p className="section-desc">Design guarantees derived directly from SRS and Phase 1 Architecture</p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">💰</div>
            <div className="feature-title">Exact Decimal Storage</div>
            <div className="feature-text">
              All currency values use <code>DECIMAL(15,2)</code> with non-negative check constraints,
              completely avoiding binary floating-point representation rounding bugs.
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <div className="feature-title">ACID Transaction Atomicity</div>
            <div className="feature-text">
              MySQL InnoDB engine provides row-level locking (<code>SELECT ... FOR UPDATE</code>)
              and strict transaction rollback to prevent lost updates or partial transfers.
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🛡️</div>
            <div className="feature-title">Parameterized SQL Security</div>
            <div className="feature-text">
              Database access is strictly abstracted through prepared statements to prevent SQL injection,
              with centralized error envelopes that never leak internal database details.
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <div className="feature-title">Role-Based Normalization</div>
            <div className="feature-text">
              Separation between authentication identities (<code>users</code>) and domain profiles
              (<code>customers</code>, <code>employees</code>) ensures clean separation of concerns and auditability.
            </div>
          </div>
        </div>
      </section>

      {/* Database Schema Explorer */}
      <section className="explorer-card" id="schema-explorer">
        <h2 className="section-title" style={{ marginBottom: '0.25rem' }}>
          Database Schema Explorer
        </h2>
        <p className="section-desc">
          Interactive table definitions from <code>database/schema.sql</code>
        </p>

        <div className="tabs-nav" role="tablist">
          {Object.keys(SCHEMA_DEFINITIONS).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          {currentSchema.description}
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="table-schema">
            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th>Key / Index</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {currentSchema.columns.map((col) => (
                <tr key={col.name}>
                  <td className="col-name">{col.name}</td>
                  <td className="col-type">{col.type}</td>
                  <td>
                    {col.key && (
                      <span className={`badge ${col.key.includes('PK') ? 'badge-primary' : col.key.includes('UK') ? 'badge-warning' : 'badge-success'}`}>
                        {col.key}
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{col.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-constraints">
          <strong>Table Constraints & Engine: </strong>
          <code>{currentSchema.constraints}</code>
        </div>
      </section>

      {/* Local Setup Quickstart Guide */}
      <section>
        <h2 className="section-title">Local Development Quickstart</h2>
        <p className="section-desc">Standard reproducible commands to run the application</p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-header">
              <div className="step-number">1</div>
              <div className="step-title">Configure Environment</div>
            </div>
            <pre className="step-code">cp backend/.env.example .env</pre>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.5rem' }}>
              Populate MySQL credentials and SESSION_SECRET in .env
            </p>
          </div>
          <div className="step-card">
            <div className="step-header">
              <div className="step-number">2</div>
              <div className="step-title">Initialize Database</div>
            </div>
            <pre className="step-code">npm run db:init:seed</pre>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.5rem' }}>
              Creates schema and seeds academic test fixtures
            </p>
          </div>
          <div className="step-card">
            <div className="step-header">
              <div className="step-number">3</div>
              <div className="step-title">Start Backend API</div>
            </div>
            <pre className="step-code">npm run dev:backend</pre>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.5rem' }}>
              Express REST server on http://localhost:5000
            </p>
          </div>
          <div className="step-card">
            <div className="step-header">
              <div className="step-number">4</div>
              <div className="step-title">Start Frontend App</div>
            </div>
            <pre className="step-code">npm run dev:frontend</pre>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.5rem' }}>
              Vite dev server on http://localhost:5173
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="app-footer">
        <p>Bank Management System &bull; Issue #5 User Authentication &bull; Traceable to SRS & Phase 1 Architecture</p>
      </footer>
    </div>
  );
}
