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
      const errorMsg = data?.error?.message || `Request failed with status ${response.status}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.code = data?.error?.code;
      err.details = data?.error?.details;
      throw err;
    }

    return data;
  } catch (error) {
    console.error(`API Request Error [${endpoint}]:`, error.message);
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
