/**
 * ==============================================================================
 * Frontend API Service Client
 * ==============================================================================
 * Centralized fetch client for interacting with the backend REST API.
 * Uses VITE_API_BASE_URL (defaults to /api via Vite dev proxy or http://localhost:5000/api).
 * ==============================================================================
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Perform an HTTP request to the backend API.
 * @param {string} endpoint - API path (e.g. '/health')
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  const config = {
    credentials: 'include',
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error?.message || `Request failed with status ${response.status}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.code = data?.errorCode || data?.error?.code;
      err.details = data?.error?.details || data?.fields;
      throw err;
    }

    return data;
  } catch (error) {
    if (endpoint !== '/auth/me' || error.status !== 401) {
      console.error(`API Request Error [${endpoint}]:`, error.message);
    }
    throw error;
  }
}

/**
 * Fetch system health and database diagnostic status.
 * Unwraps data envelope if present for direct access to diagnostic properties.
 * @returns {Promise<any>}
 */
export async function getSystemHealth() {
  const response = await apiRequest('/health');
  return response?.data || response;
}

/**
 * Authenticate user with username and password.
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<any>} Authenticated user safe profile
 */
export async function login(credentials) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
  return response?.data || response;
}

/**
 * Terminate active session and clear cookie.
 * @returns {Promise<any>}
 */
export async function logout() {
  const response = await apiRequest('/auth/logout', {
    method: 'POST'
  });
  return response?.data || response;
}

/**
 * Retrieve active session safe profile if authenticated.
 * Returns null if no active session (401).
 * @returns {Promise<any|null>}
 */
export async function getCurrentUser() {
  try {
    const response = await apiRequest('/auth/me');
    return response?.data || response;
  } catch (error) {
    if (error.status === 401) {
      return null;
    }
    throw error;
  }
}

/**
 * ==============================================================================
 * Employee Management API (Admin-Only)
 * ==============================================================================
 */

/**
 * Fetch list of all registered employee records.
 * @returns {Promise<Array<any>>}
 */
export async function getEmployees() {
  const response = await apiRequest('/employees');
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  return response?.data?.employees || response?.employees || (Array.isArray(response) ? response : []);
}

/**
 * Fetch a single employee record by ID.
 * @param {string|number} employeeId
 * @returns {Promise<any>}
 */
export async function getEmployee(employeeId) {
  const response = await apiRequest(`/employees/${employeeId}`);
  return response?.data?.employee || response?.employee || response?.data || response;
}

/**
 * Retrieve high-level employee management overview metrics (Feature 3).
 * @returns {Promise<{ totalStaff: number, activeStaff: number, inactiveStaff: number, recentlyAdded: number, loggedInToday: number }>}
 */
export async function getEmployeeOverview() {
  const response = await apiRequest('/employees/overview');
  return response?.data || response;
}

/**
 * Retrieve recent audited activity logs for an employee (Feature 3).
 * @param {string|number} employeeId
 * @param {number} [limit=15]
 * @returns {Promise<Array<any>>}
 */
export async function getEmployeeActivities(employeeId, limit = 15) {
  const response = await apiRequest(`/employees/${employeeId}/activities?limit=${limit}`);
  return Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
}

/**
 * Revoke all active sessions for an employee (Feature 3).
 * @param {string|number} employeeId
 * @returns {Promise<any>}
 */
export async function revokeEmployeeSessions(employeeId) {
  const response = await apiRequest(`/employees/${employeeId}/revoke-sessions`, {
    method: 'POST'
  });
  return response?.data || response;
}

/**
 * Create a new employee record and linked user account in an atomic transaction.
 * @param {{ username: string, password: string, fullName: string, email: string, phone: string }} data
 * @returns {Promise<any>}
 */
export async function createEmployee(data) {
  const response = await apiRequest('/employees', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response?.data?.employee || response?.employee || response?.data || response;
}

/**
 * Update permitted profile fields for an existing employee.
 * Protected fields (role, username, user_id, password) are rejected by the backend.
 * @param {string|number} employeeId
 * @param {{ fullName: string, email: string, phone?: string }} data
 * @returns {Promise<any>}
 */
export async function updateEmployee(employeeId, data) {
  const response = await apiRequest(`/employees/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return response?.data?.employee || response?.employee || response?.data || response;
}

/**
 * Activate or deactivate an employee account.
 * Deactivation immediately revokes user access on their next authenticated request.
 * @param {string|number} employeeId
 * @param {'ACTIVE'|'INACTIVE'} status
 * @returns {Promise<any>}
 */
export async function updateEmployeeStatus(employeeId, status) {
  const response = await apiRequest(`/employees/${employeeId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  return response?.data?.employee || response?.employee || response?.data || response;
}

/**
 * ==============================================================================
 * Customer Directory API (Issue #7 Support)
 * ==============================================================================
 */

/**
 * Fetch registered customers directory for account creation lookup.
 * @param {{ search?: string }} [params]
 * @returns {Promise<Array<any>>}
 */
export async function getCustomers(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  const endpoint = `/customers${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await apiRequest(endpoint);
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  return Array.isArray(response) ? response : [];
}

/**
 * ==============================================================================
 * Bank Account Management API (Issue #7)
 * ==============================================================================
 */

/**
 * Fetch list of bank accounts (filtered by customerId, status, accountType, or search).
 * @param {{ customerId?: number, status?: string, accountType?: string, search?: string }} [filters]
 * @returns {Promise<Array<any>>}
 */
export async function getAccounts(filters = {}) {
  const query = new URLSearchParams();
  if (filters.customerId) query.append('customerId', filters.customerId);
  if (filters.status) query.append('status', filters.status);
  if (filters.accountType) query.append('accountType', filters.accountType);
  if (filters.search) query.append('search', filters.search);

  const endpoint = `/accounts${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await apiRequest(endpoint);
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  return Array.isArray(response) ? response : [];
}

/**
 * Fetch account portfolio summary (Current balance, Available balance, and status breakdown).
 * @param {{ customerId?: number }} [filters]
 * @returns {Promise<any>}
 */
export async function getAccountsSummary(filters = {}) {
  const query = new URLSearchParams();
  if (filters.customerId) query.append('customerId', filters.customerId);
  const endpoint = `/accounts/summary${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await apiRequest(endpoint);
  return response?.data || response;
}

/**
 * Fetch a single bank account details and current balance.
 * @param {string|number} accountId
 * @returns {Promise<any>}
 */
export async function getAccount(accountId) {
  const response = await apiRequest(`/accounts/${accountId}`);
  return response?.data || response;
}

/**
 * Create a new bank account for an existing registered customer.
 * Server allocates unique account number and enforces zero initial balance.
 * @param {{ customerId: number, accountType: 'SAVINGS'|'CURRENT' }} data
 * @returns {Promise<any>}
 */
export async function createAccount(data) {
  const response = await apiRequest('/accounts', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response?.data || response;
}

/**
 * Update the status of a bank account (ACTIVE, INACTIVE, FROZEN).
 * @param {string|number} accountId
 * @param {'ACTIVE'|'INACTIVE'|'FROZEN'} status
 * @param {string} [reason]
 * @returns {Promise<any>}
 */
export async function updateAccountStatus(accountId, status, reason = '') {
  const response = await apiRequest(`/accounts/${accountId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason })
  });
  return response?.data || response;
}

/**
 * ==============================================================================
 * Transaction Management API (Issue #8)
 * ==============================================================================
 */

/**
 * Deposit funds into an active bank account (FR-12, AC-1).
 * @param {string|number} accountId - Target account ID
 * @param {number|string} amount - Monetary amount to deposit
 * @param {string} [remarks] - Optional audit note
 * @returns {Promise<any>}
 */
export async function depositFunds(accountId, amount, remarks = '') {
  const response = await apiRequest(`/accounts/${accountId}/deposits`, {
    method: 'POST',
    body: JSON.stringify({ amount, remarks })
  });
  return response?.data || response;
}

/**
 * Withdraw funds from an active bank account (FR-13, FR-14, AC-2, AC-4).
 * @param {string|number} accountId - Source account ID
 * @param {number|string} amount - Monetary amount to withdraw
 * @param {string} [remarks] - Optional audit note
 * @returns {Promise<any>}
 */
export async function withdrawFunds(accountId, amount, remarks = '') {
  const response = await apiRequest(`/accounts/${accountId}/withdrawals`, {
    method: 'POST',
    body: JSON.stringify({ amount, remarks })
  });
  return response?.data || response;
}

/**
 * Retrieve authoritative transaction receipt proof (Feature 2).
 * @param {string|number} transactionId - Transaction ID or transaction reference
 * @returns {Promise<any>}
 */
export async function getTransactionReceipt(transactionId) {
  const response = await apiRequest(`/transactions/${encodeURIComponent(transactionId)}/receipt`);
  return response?.data || response;
}

/**
 * Fetch transaction history for a specific bank account (FR-20, FR-21).
 * @param {string|number} accountId
 * @param {{ page?: number, size?: number }} [params]
 * @returns {Promise<any>}
 */
export async function getAccountTransactions(accountId, params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.size) query.append('size', params.size);
  if (params.limit) query.append('limit', params.limit);
  if (params.type) query.append('type', params.type);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);

  const endpoint = `/accounts/${accountId}/transactions${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await apiRequest(endpoint);
  return response?.data || response;
}

/**
 * Retrieve customer bank account statement with running balance (Feature 3).
 * @param {string|number} accountId
 * @param {{ from?: string, to?: string, preset?: string }} [params]
 * @returns {Promise<any>}
 */
export async function getAccountStatement(accountId, params = {}) {
  const query = new URLSearchParams();
  if (params.from) query.append('from', params.from);
  if (params.to) query.append('to', params.to);
  if (params.preset) query.append('preset', params.preset);
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);

  const endpoint = `/accounts/${accountId}/statement${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await apiRequest(endpoint);
  return response?.data || response;
}

/**
 * Fetch recent transaction records across the bank (Employee/Admin oversight).
 * @param {{ page?: number, limit?: number, size?: number, accountNumber?: string, accountId?: string|number, type?: string, startDate?: string, endDate?: string, search?: string }} [params]
 * @returns {Promise<any>}
 */
export async function getRecentTransactions(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.size) query.append('size', params.size);
  if (params.accountNumber) query.append('accountNumber', params.accountNumber);
  if (params.accountId) query.append('accountId', params.accountId);
  if (params.type) query.append('type', params.type);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.search) query.append('search', params.search);

  const endpoint = `/transactions${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await apiRequest(endpoint);
  return response?.data || response;
}

/**
 * ==============================================================================
 * Customer Fund Transfer API (Issue #9)
 * ==============================================================================
 */

/**
 * Verify destination beneficiary account details prior to fund transfer (Feature 3).
 * @param {{ destinationAccount: string|number, destinationAccountNumber?: string, destinationAccountId?: number|string, sourceAccountId?: number|string }} params
 * @returns {Promise<{ beneficiaryName: string, maskedAccountNumber: string, accountType: string, verificationStatus: string }>}
 */
export async function verifyBeneficiary(params) {
  const response = await apiRequest('/transfers/verify-beneficiary', {
    method: 'POST',
    body: JSON.stringify(params)
  });
  return response?.data || response;
}

/**
 * Transfer funds between bank accounts (FR-15, FR-16, FR-17, AC-1, AC-4, Feature 3).
 * Initiated by authenticated customer from an account they own.
 * @param {{ sourceAccountId: number|string, destinationAccountId?: number|string, destinationAccountNumber?: string, amount: number|string, remarks?: string, idempotencyKey?: string }} data
 * @param {object} [options]
 * @returns {Promise<any>}
 */
export async function transferFunds(data, options = {}) {
  const headers = {};
  const effectiveKey = data?.idempotencyKey || options?.idempotencyKey;
  if (effectiveKey) {
    headers['Idempotency-Key'] = effectiveKey;
  }
  const response = await apiRequest('/transfers', {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  return response?.data || response;
}


/**
 * ==============================================================================
 * Customer Registration and Profile Management API (Issue #6)
 * ==============================================================================
 */

/**
 * Fetch a single customer profile by customerId (FR-05).
 * @param {number|string} customerId
 * @returns {Promise<any>}
 */
export async function getCustomer(customerId) {
  const response = await apiRequest(`/customers/${customerId}`);
  return response?.data || response;
}

/**
 * Register a new customer with login credentials (FR-04).
 * @param {{ fullName: string, dateOfBirth: string, phone: string, email: string, address: string, username: string, password: string }} customerData
 * @returns {Promise<any>}
 */
export async function registerCustomer(customerData) {
  return await apiRequest('/customers', {
    method: 'POST',
    body: JSON.stringify(customerData)
  });
}

/**
 * Update permitted customer profile information (FR-06).
 * @param {number|string} customerId
 * @param {{ fullName?: string, dateOfBirth?: string, phone?: string, email?: string, address?: string }} updateData
 * @returns {Promise<any>}
 */
export async function updateCustomer(customerId, updateData) {
  return await apiRequest(`/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData)
  });
}

/**
 * Retrieve authenticated customer's own profile (Feature 5).
 * Identity derived strictly from authenticated session cookie.
 * @returns {Promise<any>}
 */
export async function getMyProfile() {
  const response = await apiRequest('/customers/profile');
  return response?.data || response;
}

/**
 * Update authenticated customer's own permitted contact profile fields (Feature 5).
 * Identity derived strictly from authenticated session cookie.
 * @param {{ phone?: string, email?: string, address?: string }} updateData
 * @returns {Promise<any>}
 */
export async function updateMyProfile(updateData) {
  const response = await apiRequest('/customers/profile', {
    method: 'PUT',
    body: JSON.stringify(updateData)
  });
  return response?.data || response;
}

/**
 * Retrieve detailed system diagnostics (Feature 5).
 * Administrator only.
 * @returns {Promise<any>}
 */
export async function getSystemDiagnostics() {
  const response = await apiRequest('/diagnostics');
  return response?.data || response;
}

/**
 * ==============================================================================
 * Administrator Reports API Client (Issue #12, FR-25)
 * ==============================================================================
 */

/**
 * Retrieve executive admin dashboard aggregated metrics (Feature 1).
 * @param {{ period?: string, startDate?: string, endDate?: string }} [params]
 * @returns {Promise<any>}
 */
export async function getAdminDashboard(params = {}) {
  const query = new URLSearchParams();
  if (params.period) query.append('period', params.period);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const response = await apiRequest(`/reports/dashboard${qs}`);
  return response?.data || response;
}

/**
 * Retrieve executive summary reports across customers, accounts, and transactions.
 * @param {{ startDate?: string, endDate?: string }} [params]
 * @returns {Promise<any>}
 */
export async function getReportsOverview(params = {}) {
  const query = new URLSearchParams();
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const response = await apiRequest(`/reports/overview${qs}`);
  return response?.data || response;
}

/**
 * Retrieve customer reporting metrics (totals, status breakdown, registration trends).
 * @returns {Promise<any>}
 */
export async function getCustomerReports() {
  const response = await apiRequest('/reports/customers');
  return response?.data || response;
}

/**
 * Retrieve account reporting metrics (totals, by type, by status, balance metrics, top accounts).
 * @returns {Promise<any>}
 */
export async function getAccountReports() {
  const response = await apiRequest('/reports/accounts');
  return response?.data || response;
}

/**
 * Retrieve transaction reporting metrics and daily activity with optional date range filters.
 * @param {{ startDate?: string, endDate?: string }} [params]
 * @returns {Promise<any>}
 */
export async function getTransactionReports(params = {}) {
  const query = new URLSearchParams();
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const response = await apiRequest(`/reports/transactions${qs}`);
  return response?.data || response;
}

/**
 * ==============================================================================
 * Centralized Audit Logs API (Feature 2)
 * ==============================================================================
 */

/**
 * Retrieve paginated and filtered centralized audit logs (Feature 2).
 * Admin clearance required.
 * @param {{
 *   page?: number,
 *   limit?: number,
 *   actorUserId?: number,
 *   actionType?: string,
 *   targetEntityType?: string,
 *   result?: 'SUCCESS'|'FAILURE',
 *   startDate?: string,
 *   endDate?: string,
 *   search?: string
 * }} [params]
 * @returns {Promise<any>}
 */
export async function getAuditLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.actorUserId) query.append('actorUserId', params.actorUserId);
  if (params.actionType) query.append('actionType', params.actionType);
  if (params.targetEntityType) query.append('targetEntityType', params.targetEntityType);
  if (params.result) query.append('result', params.result);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.search) query.append('search', params.search);

  const qs = query.toString() ? `?${query.toString()}` : '';
  const response = await apiRequest(`/audit-logs${qs}`);
  return response?.data || response;
}

/**
 * Retrieve unique action types and target entity types for filter dropdowns.
 * @returns {Promise<any>}
 */
export async function getAuditLogFilters() {
  const response = await apiRequest('/audit-logs/filters');
  return response?.data || response;
}
/**
 * ==============================================================================
 * Administrator Report Export API (Feature 4)
 * ==============================================================================
 */

/**
 * Export administrative report as a CSV file attachment (Feature 4).
 * Downloads the CSV file directly to the user's browser with the server-supplied filename.
 * @param {'customers'|'accounts'|'transactions'|'overview'|'all'} reportType
 * @param {{ startDate?: string, endDate?: string, period?: string, scope?: string }} [params]
 * @returns {Promise<{ filename: string, sizeBytes: number, csv: string }>}
 */
export async function exportReportCsv(reportType, params = {}) {
  const query = new URLSearchParams();
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.period) query.append('period', params.period);
  if (params.scope) query.append('scope', params.scope);
  query.append('format', 'csv');

  const qs = query.toString() ? `?${query.toString()}` : '';
  const url = `${API_BASE_URL}/reports/export/${reportType}${qs}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/csv'
    },
    credentials: 'include'
  });

  if (!response.ok) {
    let errData;
    try {
      errData = await response.json();
    } catch {
      errData = { message: `Export failed with HTTP status ${response.status}` };
    }
    const err = new Error(errData.message || errData.error?.message || 'Report export failed');
    err.status = response.status;
    err.errorCode = errData.errorCode || errData.error?.code;
    throw err;
  }

  // Extract filename from Content-Disposition header
  const disposition = response.headers.get('content-disposition');
  let filename = `bank-${reportType}-report.csv`;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/);
    if (match && match[1]) {
      filename = match[1].trim();
    }
  }

  const csv = await response.text();

  // Trigger client-side file download in browser
  if (typeof window !== 'undefined' && window.document) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }

  return { filename, sizeBytes: csv.length, csv };
}

/**
 * ==============================================================================
 * Employee Personal Activity History API (Feature 4)
 * ==============================================================================
 */

/**
 * Retrieve personal operational activity history for the currently logged-in employee.
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.category] - 'ALL' | 'ACCOUNT' | 'CUSTOMER' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER'
 * @param {string} [params.actionType]
 * @param {string} [params.result] - 'ALL' | 'SUCCESS' | 'FAILURE'
 * @param {string} [params.startDate] - 'YYYY-MM-DD'
 * @param {string} [params.endDate] - 'YYYY-MM-DD'
 * @param {string} [params.search]
 * @returns {Promise<{ items: Array, summary: object, pagination: object }>}
 */
export async function getMyActivity(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.category && params.category !== 'ALL') query.append('category', params.category);
  if (params.actionType) query.append('actionType', params.actionType);
  if (params.result && params.result !== 'ALL') query.append('result', params.result);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.search) query.append('search', params.search);

  const qs = query.toString();
  return apiRequest(`/audit-logs/my-activity${qs ? `?${qs}` : ''}`);
}

/**
 * ==============================================================================
 * Fraud Monitoring Dashboard API Client (Phase 4)
 * ==============================================================================
 */

/**
 * Retrieve system-wide fraud overview statistics.
 * @returns {Promise<any>}
 */
export async function getFraudStats() {
  const response = await apiRequest('/fraud/dashboard/stats');
  return response?.data || response;
}

/**
 * Retrieve paginated fraud alerts with filtering.
 * @param {object} [params]
 * @returns {Promise<any>}
 */
export async function getFraudAlerts(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.riskLevel && params.riskLevel !== 'ALL') query.append('riskLevel', params.riskLevel);
  if (params.status && params.status !== 'ALL') query.append('status', params.status);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.transactionId) query.append('transactionId', params.transactionId);
  if (params.sortField) query.append('sortField', params.sortField);
  if (params.sortOrder) query.append('sortOrder', params.sortOrder);

  const qs = query.toString();
  const response = await apiRequest(`/fraud/alerts${qs ? `?${qs}` : ''}`);
  return response?.data || response;
}

/**
 * Retrieve full details for a specific fraud alert.
 * @param {string|number} id - Alert ObjectId or transactionId
 * @returns {Promise<any>}
 */
export async function getFraudAlertDetails(id) {
  const response = await apiRequest(`/fraud/alerts/${id}`);
  return response?.data || response;
}

/**
 * Create an investigation for a fraud alert.
 * @param {string|number} alertId
 * @param {{ notes?: string, assignedEmployeeId?: number }} data
 * @returns {Promise<any>}
 */
export async function createInvestigation(alertId, data = {}) {
  const response = await apiRequest(`/fraud/alerts/${alertId}/investigations`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response?.data || response;
}

/**
 * List paginated fraud investigations.
 * @param {object} [params]
 * @returns {Promise<any>}
 */
export async function getFraudInvestigations(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.status && params.status !== 'ALL') query.append('status', params.status);
  if (params.assignedEmployeeId) query.append('assignedEmployeeId', params.assignedEmployeeId);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.sortField) query.append('sortField', params.sortField);
  if (params.sortOrder) query.append('sortOrder', params.sortOrder);

  const qs = query.toString();
  const response = await apiRequest(`/fraud/investigations${qs ? `?${qs}` : ''}`);
  return response?.data || response;
}

/**
 * Retrieve details for a specific investigation.
 * @param {string} id - Investigation ObjectId
 * @returns {Promise<any>}
 */
export async function getFraudInvestigationDetails(id) {
  const response = await apiRequest(`/fraud/investigations/${id}`);
  return response?.data || response;
}

/**
 * Update an investigation's status, notes, assignment, or resolution.
 * @param {string} id - Investigation ObjectId
 * @param {object} data
 * @returns {Promise<any>}
 */
export async function updateInvestigation(id, data = {}) {
  const response = await apiRequest(`/fraud/investigations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
  return response?.data || response;
}

/**
 * Retrieve list of all configurable fraud rules.
 * @returns {Promise<any>}
 */
export async function getFraudRules() {
  const response = await apiRequest('/fraud/rules');
  return response?.data?.rules || response?.data || response;
}

/**
 * Update a fraud rule's configuration (Admin only).
 * @param {string} id - Rule ObjectId or ruleCode
 * @param {object} data
 * @returns {Promise<any>}
 */
export async function updateFraudRule(id, data = {}) {
  const response = await apiRequest(`/fraud/rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
  return response?.data?.rule || response?.data || response;
}
