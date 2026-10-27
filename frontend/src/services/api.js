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
  return response?.data?.employees || response?.employees || [];
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
