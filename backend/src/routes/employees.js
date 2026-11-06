/**
 * ==============================================================================
 * Employee Administration Routes (Issue #11 & Feature 3 Enhancements)
 * ==============================================================================
 * Implements SRS FR-23, FR-24, NFR-01, NFR-02, NFR-03, NFR-04, NFR-16, NFR-18,
 * and Feature 3 Employee Management and Access Oversight:
 * - Summary overview metrics (total, active, inactive, recently added, logged in today)
 * - Enhanced employee table data including last login tracking from audit logs
 * - Employee recent activity history trail
 * - Explicit session revocation via centralized session store
 * - Immediate session invalidation upon deactivation
 * - Reactivation with full access restoration
 * - Protection against privilege escalation and administrator self-deactivation
 *
 * All endpoints require an authenticated Administrator (ADMIN role).
 * Endpoints:
 * - GET   /api/employees                     (List all employees with last login & summary)
 * - GET   /api/employees/overview            (Dedicated staff overview summary metrics)
 * - GET   /api/employees/:employeeId         (Get single employee by ID with last login)
 * - GET   /api/employees/:employeeId/activities (Recent audited activities for employee)
 * - POST  /api/employees                     (Create new employee + user account in transaction)
 * - PUT   /api/employees/:employeeId         (Update permitted employee details)
 * - PATCH /api/employees/:employeeId/status  (Activate or deactivate employee account)
 * - POST  /api/employees/:employeeId/revoke-sessions (Revoke active sessions for employee)
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordAuditEvent } = require('../services/auditService');
const { revokeSessionsByUserId } = require('../config/sessionStore');

// Protected fields that must NEVER be modified via employee update endpoints
const PROTECTED_FIELDS = [
  'role',
  'username',
  'user_id',
  'userId',
  'password',
  'initialPassword',
  'password_hash',
  'passwordHash',
  'status',
  'employee_id',
  'employeeId'
];

// Permitted fields that can be updated via PUT /api/employees/:employeeId
const PERMITTED_UPDATE_FIELDS = ['fullName', 'email', 'phone'];

// Common validation patterns
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s+\-().]{5,20}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,50}$/;

/**
 * Strict validator for employee ID route parameter.
 * Accepts only positive safe integers without trailing characters, decimals, or signs.
 * Rejects values like "12abc", "1.5", "0", "-5", or values outside Number.isSafeInteger.
 *
 * @param {string} rawId - The raw request parameter string
 * @returns {number|null} Parsed positive integer if valid, or null if invalid
 */
function parseStrictEmployeeId(rawId) {
  if (typeof rawId !== 'string') return null;
  // Must consist solely of digits 0-9 and not start with '0'
  if (!/^[1-9]\d*$/.test(rawId)) {
    return null;
  }
  const parsed = Number(rawId);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

/**
 * Compute staff overview summary metrics from MySQL database.
 * @returns {Promise<{ totalStaff: number, activeStaff: number, inactiveStaff: number, recentlyAdded: number, loggedInToday: number }>}
 */
async function getEmployeeOverviewStats() {
  const countRows = await query(`
    SELECT
      COUNT(*) AS total_staff,
      SUM(CASE WHEN u.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_staff,
      SUM(CASE WHEN u.status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive_staff,
      SUM(CASE WHEN e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS recently_added
    FROM employees e
    JOIN users u ON e.user_id = u.user_id
  `);

  const loginRows = await query(`
    SELECT COUNT(DISTINCT e.employee_id) AS logged_in_today
    FROM employees e
    JOIN audit_logs a ON e.user_id = a.actor_user_id
    WHERE a.action_type = 'USER_LOGIN'
      AND a.result = 'SUCCESS'
      AND a.created_at >= CURDATE()
  `);

  const total = Number(countRows?.[0]?.total_staff) || 0;
  const active = Number(countRows?.[0]?.active_staff) || 0;
  const inactive = Number(countRows?.[0]?.inactive_staff) || 0;
  const recentlyAdded = Number(countRows?.[0]?.recently_added) || 0;
  const loggedInToday = Number(loginRows?.[0]?.logged_in_today) || 0;

  return {
    totalStaff: total,
    activeStaff: active,
    inactiveStaff: inactive,
    recentlyAdded,
    loggedInToday
  };
}

// Enforce ADMIN role across all employee management routes
router.use(requireAuth, requireRole('ADMIN'));

/**
 * GET /api/employees/overview
 * Dedicated summary metrics endpoint for the Administrator overview cards.
 */
router.get('/overview', async (req, res) => {
  try {
    const stats = await getEmployeeOverviewStats();
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching employee overview stats:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

/**
 * GET /api/employees
 * Retrieve all employee records with their user account status, last login, and summary metrics.
 */
router.get('/', async (req, res) => {
  try {
    const rows = await query(`
      SELECT e.employee_id,
        e.user_id,
        e.full_name,
        e.email,
        e.phone,
        e.created_at,
        e.updated_at,
        u.username,
        u.role,
        u.status,
        (
          SELECT MAX(a.created_at)
          FROM audit_logs a
          WHERE a.actor_user_id = e.user_id
            AND a.action_type = 'USER_LOGIN'
            AND a.result = 'SUCCESS'
        ) AS last_login
      FROM employees e
      JOIN users u ON e.user_id = u.user_id
      ORDER BY e.employee_id ASC
    `);

    const employees = rows.map((row) => ({
      employeeId: row.employee_id,
      userId: row.user_id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      status: row.status,
      lastLogin: row.last_login || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const summary = await getEmployeeOverviewStats();

    return res.status(200).json({
      success: true,
      data: employees,
      summary: summary
    });
  } catch (error) {
    console.error('Error fetching employees:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

/**
 * GET /api/employees/:employeeId/activities
 * Retrieve recent audited activity history for a specific employee.
 */
router.get('/:employeeId/activities', async (req, res) => {
  const employeeId = parseStrictEmployeeId(req.params.employeeId);
  if (!employeeId) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Invalid employee ID',
      error: {
        code: 'VAL_001',
        message: 'Invalid employee ID'
      }
    });
  }

  let limit = 15;
  if (req.query.limit) {
    const parsedLimit = parseInt(req.query.limit, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
      limit = parsedLimit;
    }
  }

  try {
    const empRows = await query(
      'SELECT e.employee_id, e.user_id, e.full_name, u.username FROM employees e JOIN users u ON e.user_id = u.user_id WHERE e.employee_id = ?',
      [employeeId]
    );

    if (!empRows || empRows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'EMP_001',
        message: 'Employee not found',
        error: {
          code: 'EMP_001',
          message: 'Employee not found'
        }
      });
    }

    const emp = empRows[0];
    const rows = await query(
      `SELECT a.audit_id,
              a.actor_user_id,
              a.action_type,
              a.target_entity_type,
              a.target_entity_id,
              a.description,
              a.result,
              a.metadata,
              a.created_at
       FROM audit_logs a
       WHERE a.actor_user_id = ?
          OR (a.target_entity_type = 'EMPLOYEE' AND a.target_entity_id = ?)
       ORDER BY a.created_at DESC, a.audit_id DESC
       LIMIT ?`,
      [emp.user_id, String(employeeId), limit]
    );

    const activities = rows.map((r) => {
      let parsedMeta = null;
      if (r.metadata) {
        if (typeof r.metadata === 'string') {
          try {
            parsedMeta = JSON.parse(r.metadata);
          } catch (_) {
            parsedMeta = r.metadata;
          }
        } else {
          parsedMeta = r.metadata;
        }
      }
      return {
        auditId: r.audit_id,
        actorUserId: r.actor_user_id,
        actionType: r.action_type,
        targetEntityType: r.target_entity_type,
        targetEntityId: r.target_entity_id,
        description: r.description,
        result: r.result,
        metadata: parsedMeta,
        createdAt: r.created_at
      };
    });

    return res.status(200).json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching employee activities:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

/**
 * GET /api/employees/:employeeId
 * Retrieve a specific employee record by ID with last login.
 */
router.get('/:employeeId', async (req, res) => {
  const employeeId = parseStrictEmployeeId(req.params.employeeId);
  if (!employeeId) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Invalid employee ID',
      error: {
        code: 'VAL_001',
        message: 'Invalid employee ID'
      }
    });
  }

  try {
    const rows = await query(
      `
      SELECT e.employee_id,
        e.user_id,
        e.full_name,
        e.email,
        e.phone,
        e.created_at,
        e.updated_at,
        u.username,
        u.role,
        u.status,
        (
          SELECT MAX(a.created_at)
          FROM audit_logs a
          WHERE a.actor_user_id = e.user_id
            AND a.action_type = 'USER_LOGIN'
            AND a.result = 'SUCCESS'
        ) AS last_login
      FROM employees e
      JOIN users u ON e.user_id = u.user_id
      WHERE e.employee_id = ?
      `,
      [employeeId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'EMP_001',
        message: 'Employee not found',
        error: {
          code: 'EMP_001',
          message: 'Employee not found'
        }
      });
    }

    const row = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        employeeId: row.employee_id,
        userId: row.user_id,
        username: row.username,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        status: row.status,
        lastLogin: row.last_login || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (error) {
    console.error('Error retrieving employee:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

/**
 * POST /api/employees
 * Create an employee account and associated user credentials in an atomic transaction.
 */
router.post('/', async (req, res) => {
  const { fullName, email, phone, username, initialPassword, password } = req.body || {};
  const rawPassword = initialPassword || password;

  const validationErrors = [];

  // 1. Validate fullName
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    validationErrors.push({ field: 'fullName', issue: 'Full name is required' });
  } else if (fullName.trim().length > 100) {
    validationErrors.push({ field: 'fullName', issue: 'Full name must not exceed 100 characters' });
  }

  // 2. Validate email
  if (!email || typeof email !== 'string' || !email.trim()) {
    validationErrors.push({ field: 'email', issue: 'Email address is required' });
  } else if (!EMAIL_REGEX.test(email.trim()) || email.trim().length > 100) {
    validationErrors.push({ field: 'email', issue: 'Valid email address is required (max 100 characters)' });
  }

  // 3. Validate phone
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    validationErrors.push({ field: 'phone', issue: 'Phone number is required' });
  } else if (!PHONE_REGEX.test(phone.trim())) {
    validationErrors.push({ field: 'phone', issue: 'Phone number must be between 5 and 20 characters and contain valid digits/symbols' });
  }

  // 4. Validate username
  if (!username || typeof username !== 'string' || !username.trim()) {
    validationErrors.push({ field: 'username', issue: 'Username is required' });
  } else if (!USERNAME_REGEX.test(username.trim())) {
    validationErrors.push({ field: 'username', issue: 'Username must be 3-50 alphanumeric characters, dots, underscores, or hyphens' });
  }

  // 5. Validate initialPassword
  if (!rawPassword || typeof rawPassword !== 'string') {
    validationErrors.push({ field: 'initialPassword', issue: 'Initial password is required' });
  } else if (rawPassword.length < 8) {
    validationErrors.push({ field: 'initialPassword', issue: 'Password must be at least 8 characters long' });
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Invalid input',
      fields: validationErrors,
      error: {
        code: 'VAL_001',
        message: 'Invalid input',
        fields: validationErrors
      }
    });
  }

  const trimmedUsername = username.trim().toLowerCase();
  const trimmedFullName = fullName.trim();
  const trimmedEmail = email.trim();
  const trimmedPhone = phone.trim();

  try {
    // Check if username is already taken (NFR-16, VAL_002)
    const existingUser = await query('SELECT user_id FROM users WHERE username = ?', [trimmedUsername]);
    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        errorCode: 'VAL_002',
        message: 'Value already in use',
        fields: [{ field: 'username', issue: 'Username is already taken' }],
        error: {
          code: 'VAL_002',
          message: 'Username is already taken',
          fields: [{ field: 'username', issue: 'Username is already taken' }]
        }
      });
    }

    // Hash the password with bcrypt (cost factor 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    // Atomic transaction for linked users and employees records
    const createdEmployee = await withTransaction(async (conn) => {
      // 1. Insert into users table (enforcing role EMPLOYEE and status ACTIVE)
      const [userResult] = await conn.execute(
        'INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)',
        [trimmedUsername, passwordHash, 'EMPLOYEE', 'ACTIVE']
      );
      const newUserId = userResult.insertId;

      // 2. Insert into employees table
      const [empResult] = await conn.execute(
        'INSERT INTO employees (user_id, full_name, email, phone) VALUES (?, ?, ?, ?)',
        [newUserId, trimmedFullName, trimmedEmail, trimmedPhone]
      );
      const newEmployeeId = empResult.insertId;

      return {
        employeeId: newEmployeeId,
        userId: newUserId,
        username: trimmedUsername,
        fullName: trimmedFullName,
        email: trimmedEmail,
        phone: trimmedPhone,
        role: 'EMPLOYEE',
        status: 'ACTIVE'
      };
    });

    await recordAuditEvent({
      actorUserId: req.user.userId,
      actionType: 'EMPLOYEE_CREATED',
      targetEntityType: 'EMPLOYEE',
      targetEntityId: createdEmployee.employeeId,
      description: `Employee '${createdEmployee.fullName}' (${createdEmployee.username}) created by administrator '${req.user.username}'.`,
      result: 'SUCCESS',
      metadata: {
        employeeId: createdEmployee.employeeId,
        userId: createdEmployee.userId,
        username: createdEmployee.username,
        email: createdEmployee.email
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        employeeId: createdEmployee.employeeId,
        userId: createdEmployee.userId,
        username: createdEmployee.username,
        fullName: createdEmployee.fullName,
        email: createdEmployee.email,
        phone: createdEmployee.phone,
        role: createdEmployee.role,
        status: createdEmployee.status,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        errorCode: 'VAL_002',
        message: 'Value already in use',
        fields: [{ field: 'username', issue: 'Username is already taken' }],
        error: {
          code: 'VAL_002',
          message: 'Username is already taken',
          fields: [{ field: 'username', issue: 'Username is already taken' }]
        }
      });
    }

    console.error('Error creating employee:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

/**
 * PUT /api/employees/:employeeId
 * Update permitted employee details (fullName, email, phone).
 * Explicitly rejects modification of protected fields (role, username, user_id, password_hash).
 */
router.put('/:employeeId', async (req, res) => {
  const employeeId = parseStrictEmployeeId(req.params.employeeId);
  if (!employeeId) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Invalid employee ID',
      error: {
        code: 'VAL_001',
        message: 'Invalid employee ID'
      }
    });
  }

  const payload = req.body || {};
  const payloadKeys = Object.keys(payload);

  // 1. Check for attempts to modify protected fields first
  const attemptedProtectedKeys = payloadKeys.filter((key) =>
    PROTECTED_FIELDS.includes(key)
  );

  if (attemptedProtectedKeys.length > 0) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Invalid input: modification of protected fields is not permitted',
      fields: attemptedProtectedKeys.map((k) => ({
        field: k,
        issue: 'Field is protected and cannot be modified'
      })),
      error: {
        code: 'VAL_001',
        message: 'Invalid input: modification of protected fields is not permitted',
        fields: attemptedProtectedKeys.map((k) => ({
          field: k,
          issue: 'Field is protected and cannot be modified'
        }))
      }
    });
  }

  // 2. Explicitly reject any fields that are not among the permitted editable fields
  const unsupportedKeys = payloadKeys.filter(
    (key) => !PERMITTED_UPDATE_FIELDS.includes(key)
  );

  if (unsupportedKeys.length > 0) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Invalid input: unsupported fields provided for update',
      fields: unsupportedKeys.map((k) => ({
        field: k,
        issue: `Field '${k}' is not permitted for update. Permitted fields: ${PERMITTED_UPDATE_FIELDS.join(', ')}`
      })),
      error: {
        code: 'VAL_001',
        message: 'Invalid input: unsupported fields provided for update',
        fields: unsupportedKeys.map((k) => ({
          field: k,
          issue: `Field '${k}' is not permitted for update. Permitted fields: ${PERMITTED_UPDATE_FIELDS.join(', ')}`
        }))
      }
    });
  }

  const { fullName, email, phone } = payload;
  const validationErrors = [];

  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || !fullName.trim()) {
      validationErrors.push({ field: 'fullName', issue: 'Full name must not be empty' });
    } else if (fullName.trim().length > 100) {
      validationErrors.push({ field: 'fullName', issue: 'Full name must not exceed 100 characters' });
    }
  }

  if (email !== undefined) {
    if (typeof email !== 'string' || !email.trim()) {
      validationErrors.push({ field: 'email', issue: 'Email must not be empty' });
    } else if (!EMAIL_REGEX.test(email.trim()) || email.trim().length > 100) {
      validationErrors.push({ field: 'email', issue: 'Valid email address is required (max 100 characters)' });
    }
  }

  if (phone !== undefined) {
    if (typeof phone !== 'string' || !phone.trim()) {
      validationErrors.push({ field: 'phone', issue: 'Phone must not be empty' });
    } else if (!PHONE_REGEX.test(phone.trim())) {
      validationErrors.push({ field: 'phone', issue: 'Phone must be between 5 and 20 characters and contain valid digits/symbols' });
    }
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Invalid input',
      fields: validationErrors,
      error: {
        code: 'VAL_001',
        message: 'Invalid input',
        fields: validationErrors
      }
    });
  }

  // Ensure at least one permitted field is being updated
  if (fullName === undefined && email === undefined && phone === undefined) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'No permitted fields provided for update',
      error: {
        code: 'VAL_001',
        message: 'No permitted fields provided for update'
      }
    });
  }

  try {
    // Verify employee exists
    const existingRows = await query(
      `
      SELECT e.employee_id, e.user_id, e.full_name, e.email, e.phone, u.username, u.role, u.status
      FROM employees e
      JOIN users u ON e.user_id = u.user_id
      WHERE e.employee_id = ?
      `,
      [employeeId]
    );

    if (!existingRows || existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'EMP_001',
        message: 'Employee not found',
        error: {
          code: 'EMP_001',
          message: 'Employee not found'
        }
      });
    }

    const current = existingRows[0];
    const updatedFullName = fullName !== undefined ? fullName.trim() : current.full_name;
    const updatedEmail = email !== undefined ? email.trim() : current.email;
    const updatedPhone = phone !== undefined ? phone.trim() : current.phone;

    await query(
      `
      UPDATE employees
      SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = ?
      `,
      [updatedFullName, updatedEmail, updatedPhone, employeeId]
    );

    await recordAuditEvent({
      actorUserId: req.user.userId,
      actionType: 'EMPLOYEE_UPDATED',
      targetEntityType: 'EMPLOYEE',
      targetEntityId: employeeId,
      description: `Employee ID #${employeeId} (${current.username}) profile updated by administrator '${req.user.username}'.`,
      result: 'SUCCESS',
      metadata: {
        employeeId,
        updatedFields: {
          fullName: updatedFullName,
          email: updatedEmail,
          phone: updatedPhone
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        employeeId: employeeId,
        userId: current.user_id,
        username: current.username,
        fullName: updatedFullName,
        email: updatedEmail,
        phone: updatedPhone,
        role: current.role,
        status: current.status,
        message: 'Employee details updated successfully'
      }
    });
  } catch (error) {
    console.error('Error updating employee:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

/**
 * PATCH /api/employees/:employeeId/status
 * Activate or deactivate an employee account.
 * Updates users.status, revokes active sessions on deactivation, and prevents self/last-admin lockout.
 */
router.patch('/:employeeId/status', async (req, res) => {
  const employeeId = parseStrictEmployeeId(req.params.employeeId);
  if (!employeeId) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Invalid employee ID',
      error: {
        code: 'VAL_001',
        message: 'Invalid employee ID'
      }
    });
  }

  const { status } = req.body || {};
  if (!status || typeof status !== 'string' || !['ACTIVE', 'INACTIVE'].includes(status.toUpperCase())) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: "Status must be either 'ACTIVE' or 'INACTIVE'",
      error: {
        code: 'VAL_001',
        message: "Status must be either 'ACTIVE' or 'INACTIVE'"
      }
    });
  }

  const newStatus = status.toUpperCase();

  try {
    // Verify employee exists and retrieve linked user_id and role
    const rows = await query(
      `
      SELECT e.employee_id, e.user_id, u.username, u.role, u.status
      FROM employees e
      JOIN users u ON e.user_id = u.user_id
      WHERE e.employee_id = ?
      `,
      [employeeId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'EMP_001',
        message: 'Employee not found',
        error: {
          code: 'EMP_001',
          message: 'Employee not found'
        }
      });
    }

    const { user_id, username, role, status: previousStatus } = rows[0];

    // Security Guard: Prevent administrator from deactivating their own account
    if (user_id === req.user.userId && newStatus === 'INACTIVE') {
      return res.status(400).json({
        success: false,
        errorCode: 'SEC_001',
        message: 'Administrators cannot deactivate their own account',
        error: {
          code: 'SEC_001',
          message: 'Administrators cannot deactivate their own account'
        }
      });
    }

    // Security Guard: Prevent deactivating the last active administrator account
    if (role === 'ADMIN' && newStatus === 'INACTIVE') {
      const adminCountRows = await query(
        "SELECT COUNT(*) AS active_admins FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'"
      );
      const activeAdminCount = Number(adminCountRows?.[0]?.active_admins) || 0;
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          errorCode: 'SEC_002',
          message: 'Cannot deactivate the last active administrator account',
          error: {
            code: 'SEC_002',
            message: 'Cannot deactivate the last active administrator account'
          }
        });
      }
    }

    // Update status in users table
    await query(
      'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [newStatus, user_id]
    );

    // If deactivating, immediately revoke active sessions in the session store
    let revokedCount = 0;
    if (newStatus === 'INACTIVE') {
      revokedCount = await revokeSessionsByUserId(user_id);
    }

    const actionType = newStatus === 'ACTIVE' ? 'EMPLOYEE_REACTIVATED' : 'EMPLOYEE_DEACTIVATED';
    const sessionNote = newStatus === 'INACTIVE' ? (' (' + revokedCount + ' active session(s) revoked)') : '';
    await recordAuditEvent({
      actorUserId: req.user.userId,
      actionType,
      targetEntityType: 'EMPLOYEE',
      targetEntityId: employeeId,
      description: `Employee ID #${employeeId} (${username}) ${newStatus === 'ACTIVE' ? 'reactivated' : 'deactivated'} by administrator '${req.user.username}'.` + sessionNote,
      result: 'SUCCESS',
      metadata: {
        employeeId,
        userId: user_id,
        previousStatus,
        newStatus,
        revokedSessionsCount: revokedCount
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        employeeId: employeeId,
        userId: user_id,
        username: username,
        status: newStatus,
        revokedSessionsCount: revokedCount,
        message: `Employee account has been successfully ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`
      }
    });
  } catch (error) {
    console.error('Error changing employee status:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

/**
 * POST /api/employees/:employeeId/revoke-sessions
 * Explicitly revoke all active sessions for an employee.
 * Accessible exclusively by Administrators for access oversight.
 */
router.post('/:employeeId/revoke-sessions', async (req, res) => {
  const employeeId = parseStrictEmployeeId(req.params.employeeId);
  if (!employeeId) {
    return res.status(400).json({
      success: false,
      errorCode: 'VAL_001',
      message: 'Invalid employee ID',
      error: {
        code: 'VAL_001',
        message: 'Invalid employee ID'
      }
    });
  }

  try {
    const rows = await query(
      `
      SELECT e.employee_id, e.user_id, u.username, u.role, u.status
      FROM employees e
      JOIN users u ON e.user_id = u.user_id
      WHERE e.employee_id = ?
      `,
      [employeeId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'EMP_001',
        message: 'Employee not found',
        error: {
          code: 'EMP_001',
          message: 'Employee not found'
        }
      });
    }

    const { user_id, username } = rows[0];

    // Security guard: prevent revoking own active session via employee panel
    if (user_id === req.user.userId) {
      return res.status(400).json({
        success: false,
        errorCode: 'SEC_001',
        message: 'Cannot revoke your own active administrator session via employee access oversight',
        error: {
          code: 'SEC_001',
          message: 'Cannot revoke your own active administrator session via employee access oversight'
        }
      });
    }

    const revokedCount = await revokeSessionsByUserId(user_id);

    await recordAuditEvent({
      actorUserId: req.user.userId,
      actionType: 'EMPLOYEE_SESSIONS_REVOKED',
      targetEntityType: 'EMPLOYEE',
      targetEntityId: employeeId,
      description: `Active sessions for employee ID #${employeeId} (${username}) were revoked by administrator '${req.user.username}'. (${revokedCount} session(s) terminated)`,
      result: 'SUCCESS',
      metadata: {
        employeeId,
        userId: user_id,
        username,
        revokedSessionsCount: revokedCount
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        userId: user_id,
        username,
        revokedSessionsCount: revokedCount,
        message: `All active sessions for ${username} have been successfully revoked.`
      }
    });
  } catch (error) {
    console.error('Error revoking employee sessions:', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SYS_001',
      message: 'Something went wrong. Please try again later.',
      error: {
        code: 'SYS_001',
        message: 'Something went wrong. Please try again later.'
      }
    });
  }
});

module.exports = router;
