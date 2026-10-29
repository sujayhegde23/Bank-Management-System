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
 * Transfer funds between bank accounts (FR-15, FR-16, FR-17, AC-1, AC-4).
 * Initiated by authenticated customer from an account they own.
 * @param {{ sourceAccountId: number|string, destinationAccountId?: number|string, destinationAccountNumber?: string, amount: number|string, remarks?: string }} data
 * @returns {Promise<any>}
 */
export async function transferFunds(data) {
  const response = await apiRequest('/transfers', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return response?.data || response;
}
