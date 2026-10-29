/**
 * ==============================================================================
 * Customer Directory & Profile Management Routes (Issue #6)
 * ==============================================================================
 * Implements SRS Customer Management:
 * - FR-04: Customer registration by authorized bank employees (UC-10, NFR-16, NFR-18)
 * - FR-05: View customer details by Employee, Admin, or own Customer (UC-11, UC-22)
 * - FR-06: Update customer information with role-specific access (UC-06, UC-12, A-06)
 * - NFR-03: Horizontal isolation & customer privacy protection
 * - NFR-04: Input validation across all fields
 * - NFR-18: Data integrity & duplicate prevention
 *
 * Endpoints:
 * - GET    /api/customers              (Search/List registered customers; Employee & Admin)
 * - GET    /api/customers/:customerId  (View customer details; Employee, Admin, Customer own)
 * - POST   /api/customers              (Register new customer; Employee & Admin)
 * - PUT    /api/customers/:customerId  (Update customer profile; Employee, Admin, Customer permitted)
 * - PATCH  /api/customers/:customerId  (Alias for PUT)
 * ==============================================================================
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Strict input validation regex constants
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,50}$/;
const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Strict positive integer validator for customer ID.
 * @param {string} rawId
 * @returns {number|null}
 */
function parseStrictCustomerId(rawId) {
  if (typeof rawId !== 'string') return null;
  if (!/^[1-9]\d*$/.test(rawId)) return null;
  const parsed = Number(rawId);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Format a Date or date string to YYYY-MM-DD in local calendar time (avoids UTC timezone shift).
 * @param {Date|string|null} val
 * @returns {string|null}
 */
function formatDateOnly(val) {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(val).slice(0, 10);
}

/**
 * Validates date of birth string (YYYY-MM-DD), ensuring it's a valid calendar date strictly in the past.
 * @param {string} dobStr
 * @returns {{ valid: boolean, error?: string }}
 */
function validateDateOfBirth(dobStr) {
  if (!dobStr || typeof dobStr !== 'string' || !DOB_REGEX.test(dobStr.trim())) {
    return { valid: false, error: 'Date of birth must be in YYYY-MM-DD format' };
  }
  const [yearStr, monthStr, dayStr] = dobStr.trim().split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12) {
    return { valid: false, error: 'Month in date of birth must be between 01 and 12' };
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return { valid: false, error: `Day in date of birth must be between 01 and ${daysInMonth} for month ${monthStr}` };
  }

  const dobDate = new Date(`${yearStr}-${monthStr}-${dayStr}T00:00:00Z`);
  const now = new Date();
  if (dobDate >= now) {
    return { valid: false, error: 'Date of birth must be in the past' };
  }

  // Sanity check: age shouldn't exceed 150 years
  const minYear = now.getUTCFullYear() - 150;
  if (year < minYear) {
    return { valid: false, error: 'Date of birth year is outside valid historical range' };
  }

  return { valid: true };
}

/**
 * GET /api/customers
 * List and search registered customers.
 * Access: Authenticated EMPLOYEE and ADMIN (FR-05).
 */
router.get('/', requireAuth, requireRole('EMPLOYEE', 'ADMIN'), async (req, res, next) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT c.customer_id,
             c.user_id,
             c.full_name,
             c.date_of_birth,
             c.phone,
             c.email,
             c.address,
             c.created_at,
             c.updated_at,
             u.username,
             u.status AS user_status
      FROM customers c
      JOIN users u ON c.user_id = u.user_id
    `;
    const params = [];

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += ` WHERE c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR u.username LIKE ?`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY c.customer_id ASC`;

    const rows = await query(sql, params);

    const customers = rows.map((r) => ({
      customerId: r.customer_id,
      userId: r.user_id,
      username: r.username,
      fullName: r.full_name,
      dateOfBirth: formatDateOnly(r.date_of_birth),
      phone: r.phone,
      email: r.email,
      address: r.address,
      userStatus: r.user_status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/customers/:customerId
 * View details of a specific customer (FR-05).
 * Access: Employee, Admin, or the Customer requesting their own profile (NFR-03).
 */
router.get('/:customerId', requireAuth, async (req, res, next) => {
  try {
    const customerId = parseStrictCustomerId(req.params.customerId);
    if (!customerId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid customer ID format. Must be a positive integer.',
        error: {
          code: 'VAL_001',
          message: 'Invalid customer ID format. Must be a positive integer.'
        }
      });
    }

    // Role check: Customer can only access their own profile (FR-05, NFR-03)
    if (req.user.role === 'CUSTOMER' && req.user.customerId !== customerId) {
      return res.status(403).json({
        success: false,
        errorCode: 'AUTH_002',
        message: 'You are not authorized to perform this operation',
        error: {
          code: 'AUTH_002',
          message: 'You are not authorized to perform this operation'
        }
      });
    }

    const rows = await query(
      `SELECT c.customer_id,
              c.user_id,
              c.full_name,
              c.date_of_birth,
              c.phone,
              c.email,
              c.address,
              c.created_at,
              c.updated_at,
              u.username,
              u.status AS user_status
       FROM customers c
       JOIN users u ON c.user_id = u.user_id
       WHERE c.customer_id = ?
       LIMIT 1`,
      [customerId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'CUST_001',
        message: 'Customer not found',
        error: {
          code: 'CUST_001',
          message: 'Customer not found'
        }
      });
    }

    const r = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        customerId: r.customer_id,
        userId: r.user_id,
        username: r.username,
        fullName: r.full_name,
        dateOfBirth: formatDateOnly(r.date_of_birth),
        phone: r.phone,
        email: r.email,
        address: r.address,
        userStatus: r.user_status,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/customers
 * Register a new customer with login credentials (FR-04, NFR-04, NFR-16, NFR-18).
 * Access: Authorized EMPLOYEE and ADMIN. Customers cannot register accounts (Assumption A-04).
 */
router.post('/', requireAuth, requireRole('EMPLOYEE', 'ADMIN'), async (req, res, next) => {
  try {
    const {
      fullName,
      dateOfBirth,
      phone,
      email,
      address,
      username,
      password,
      initialPassword
    } = req.body || {};

    const rawPassword = password || initialPassword;
    const validationErrors = [];

    // 1. Validate fullName
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      validationErrors.push({ field: 'fullName', issue: 'Full name is required' });
    } else if (fullName.trim().length > 100) {
      validationErrors.push({ field: 'fullName', issue: 'Full name must not exceed 100 characters' });
    }

    // 2. Validate dateOfBirth
    const dobValidation = validateDateOfBirth(dateOfBirth);
    if (!dobValidation.valid) {
      validationErrors.push({ field: 'dateOfBirth', issue: dobValidation.error });
    }

    // 3. Validate phone
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      validationErrors.push({ field: 'phone', issue: 'Phone number is required' });
    } else if (!PHONE_REGEX.test(phone.trim())) {
      validationErrors.push({ field: 'phone', issue: 'Phone number must be between 7 and 20 valid characters (digits, +, hyphens)' });
    }

    // 4. Validate email
    if (!email || typeof email !== 'string' || !email.trim()) {
      validationErrors.push({ field: 'email', issue: 'Email address is required' });
    } else if (!EMAIL_REGEX.test(email.trim()) || email.trim().length > 100) {
      validationErrors.push({ field: 'email', issue: 'Valid email address is required (max 100 characters)' });
    }

    // 5. Validate address
    if (!address || typeof address !== 'string' || !address.trim()) {
      validationErrors.push({ field: 'address', issue: 'Address is required' });
    } else if (address.trim().length > 255) {
      validationErrors.push({ field: 'address', issue: 'Address must not exceed 255 characters' });
    }

    // 6. Validate username
    if (!username || typeof username !== 'string' || !username.trim()) {
      validationErrors.push({ field: 'username', issue: 'Username is required' });
    } else if (!USERNAME_REGEX.test(username.trim())) {
      validationErrors.push({ field: 'username', issue: 'Username must be 3-50 alphanumeric characters, dots, underscores, or hyphens' });
    }

    // 7. Validate password
    if (!rawPassword || typeof rawPassword !== 'string') {
      validationErrors.push({ field: 'password', issue: 'Password is required' });
    } else if (rawPassword.length < 8) {
      validationErrors.push({ field: 'password', issue: 'Password must be at least 8 characters long' });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid input. Please correct the specified fields.',
        fields: validationErrors,
        error: {
          code: 'VAL_001',
          message: 'Invalid input. Please correct the specified fields.',
          fields: validationErrors
        }
      });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedFullName = fullName.trim();
    const trimmedDob = dateOfBirth.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedAddress = address.trim();

    // Check duplicate username (NFR-16, NFR-18)
    const existingUser = await query('SELECT user_id FROM users WHERE username = ? LIMIT 1', [trimmedUsername]);
    if (existingUser && existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        errorCode: 'VAL_002',
        message: 'Username is already taken',
        fields: [{ field: 'username', issue: 'Username is already taken' }],
        error: {
          code: 'VAL_002',
          message: 'Username is already taken',
          fields: [{ field: 'username', issue: 'Username is already taken' }]
        }
      });
    }

    // Check duplicate email in customers (NFR-16, NFR-18)
    const existingEmail = await query('SELECT customer_id FROM customers WHERE LOWER(email) = ? LIMIT 1', [trimmedEmail]);
    if (existingEmail && existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        errorCode: 'VAL_002',
        message: 'Email address is already registered',
        fields: [{ field: 'email', issue: 'Email address is already registered' }],
        error: {
          code: 'VAL_002',
          message: 'Email address is already registered',
          fields: [{ field: 'email', issue: 'Email address is already registered' }]
        }
      });
    }

    // Check duplicate phone in customers (NFR-16, NFR-18)
    const existingPhone = await query('SELECT customer_id FROM customers WHERE phone = ? LIMIT 1', [trimmedPhone]);
    if (existingPhone && existingPhone.length > 0) {
      return res.status(409).json({
        success: false,
        errorCode: 'VAL_002',
        message: 'Phone number is already registered',
        fields: [{ field: 'phone', issue: 'Phone number is already registered' }],
        error: {
          code: 'VAL_002',
          message: 'Phone number is already registered',
          fields: [{ field: 'phone', issue: 'Phone number is already registered' }]
        }
      });
    }

    // Generate salted password hash (NFR-01)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    // Atomic transaction for linked user credentials and customer profile (NFR-18)
    const createdProfile = await withTransaction(async (conn) => {
      // 1. Insert into users table
      const [userResult] = await conn.execute(
        'INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, ?)',
        [trimmedUsername, passwordHash, 'CUSTOMER', 'ACTIVE']
      );
      const newUserId = userResult.insertId;

      // 2. Insert into customers table
      const [custResult] = await conn.execute(
        'INSERT INTO customers (user_id, full_name, date_of_birth, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)',
        [newUserId, trimmedFullName, trimmedDob, trimmedPhone, trimmedEmail, trimmedAddress]
      );
      const newCustomerId = custResult.insertId;

      return {
        customerId: newCustomerId,
        userId: newUserId,
        username: trimmedUsername,
        fullName: trimmedFullName,
        dateOfBirth: trimmedDob,
        phone: trimmedPhone,
        email: trimmedEmail,
        address: trimmedAddress,
        userStatus: 'ACTIVE',
        role: 'CUSTOMER'
      };
    });

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: {
        customerId: createdProfile.customerId,
        userId: createdProfile.userId,
        username: createdProfile.username,
        fullName: createdProfile.fullName,
        dateOfBirth: createdProfile.dateOfBirth,
        phone: createdProfile.phone,
        email: createdProfile.email,
        address: createdProfile.address,
        userStatus: createdProfile.userStatus,
        role: createdProfile.role,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        errorCode: 'VAL_002',
        message: 'Duplicate record detected. Value is already in use.',
        error: {
          code: 'VAL_002',
          message: 'Duplicate record detected. Value is already in use.'
        }
      });
    }
    next(error);
  }
});

/**
 * Handler for updating customer profile (FR-06, NFR-04, NFR-18).
 * Supports both PUT and PATCH.
 */
async function handleUpdateCustomer(req, res, next) {
  try {
    const customerId = parseStrictCustomerId(req.params.customerId);
    if (!customerId) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid customer ID format. Must be a positive integer.',
        error: {
          code: 'VAL_001',
          message: 'Invalid customer ID format. Must be a positive integer.'
        }
      });
    }

    // Verify customer exists
    const existingCustRows = await query(
      `SELECT c.customer_id, c.user_id, c.full_name, c.date_of_birth, c.phone, c.email, c.address, u.username, u.status AS user_status
       FROM customers c
       JOIN users u ON c.user_id = u.user_id
       WHERE c.customer_id = ?
       LIMIT 1`,
      [customerId]
    );

    if (!existingCustRows || existingCustRows.length === 0) {
      return res.status(404).json({
        success: false,
        errorCode: 'CUST_001',
        message: 'Customer not found',
        error: {
          code: 'CUST_001',
          message: 'Customer not found'
        }
      });
    }

    const currentCust = existingCustRows[0];
    const isCustomer = req.user.role === 'CUSTOMER';
    const isStaff = req.user.role === 'EMPLOYEE' || req.user.role === 'ADMIN';

    // Horizontal access control: Customer can only update their own profile (NFR-03)
    if (isCustomer && req.user.customerId !== customerId) {
      return res.status(403).json({
        success: false,
        errorCode: 'AUTH_002',
        message: 'You are not authorized to perform this operation',
        error: {
          code: 'AUTH_002',
          message: 'You are not authorized to perform this operation'
        }
      });
    }

    // Role-specific field restriction (SRS Assumption A-06 & FR-06):
    // "permitted customer information" that a Customer may update is limited to contact details (address, phone number, email).
    // Identity details (such as name and date of birth) may be changed only by a Bank Employee.
    if (isCustomer) {
      if (req.body.fullName !== undefined || req.body.dateOfBirth !== undefined) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_002',
          message: 'Customers may only update contact details (address, phone, email). Identity details may only be changed by bank staff.',
          error: {
            code: 'AUTH_002',
            message: 'Customers may only update contact details (address, phone, email). Identity details may only be changed by bank staff.'
          }
        });
      }
    }

    const { fullName, dateOfBirth, phone, email, address } = req.body || {};
    const validationErrors = [];
    const fieldsToUpdate = {};

    // 1. Full Name (Staff only)
    if (fullName !== undefined) {
      if (!isStaff) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_002',
          message: 'You are not authorized to modify customer identity details',
          error: { code: 'AUTH_002', message: 'You are not authorized to modify customer identity details' }
        });
      }
      if (typeof fullName !== 'string' || !fullName.trim()) {
        validationErrors.push({ field: 'fullName', issue: 'Full name must not be empty' });
      } else if (fullName.trim().length > 100) {
        validationErrors.push({ field: 'fullName', issue: 'Full name must not exceed 100 characters' });
      } else {
        fieldsToUpdate.full_name = fullName.trim();
      }
    }

    // 2. Date of Birth (Staff only)
    if (dateOfBirth !== undefined) {
      if (!isStaff) {
        return res.status(403).json({
          success: false,
          errorCode: 'AUTH_002',
          message: 'You are not authorized to modify customer identity details',
          error: { code: 'AUTH_002', message: 'You are not authorized to modify customer identity details' }
        });
      }
      const dobValidation = validateDateOfBirth(dateOfBirth);
      if (!dobValidation.valid) {
        validationErrors.push({ field: 'dateOfBirth', issue: dobValidation.error });
      } else {
        fieldsToUpdate.date_of_birth = dateOfBirth.trim();
      }
    }

    // 3. Phone (Customer or Staff)
    if (phone !== undefined) {
      if (typeof phone !== 'string' || !phone.trim()) {
        validationErrors.push({ field: 'phone', issue: 'Phone number must not be empty' });
      } else if (!PHONE_REGEX.test(phone.trim())) {
        validationErrors.push({ field: 'phone', issue: 'Phone number must be between 7 and 20 valid characters' });
      } else {
        const trimmedPhone = phone.trim();
        // Check uniqueness across other customers
        const dupPhone = await query(
          'SELECT customer_id FROM customers WHERE phone = ? AND customer_id != ? LIMIT 1',
          [trimmedPhone, customerId]
        );
        if (dupPhone && dupPhone.length > 0) {
          return res.status(409).json({
            success: false,
            errorCode: 'VAL_002',
            message: 'Phone number is already registered to another customer',
            fields: [{ field: 'phone', issue: 'Phone number is already registered to another customer' }],
            error: {
              code: 'VAL_002',
              message: 'Phone number is already registered to another customer',
              fields: [{ field: 'phone', issue: 'Phone number is already registered to another customer' }]
            }
          });
        }
        fieldsToUpdate.phone = trimmedPhone;
      }
    }

    // 4. Email (Customer or Staff)
    if (email !== undefined) {
      if (typeof email !== 'string' || !email.trim()) {
        validationErrors.push({ field: 'email', issue: 'Email address must not be empty' });
      } else if (!EMAIL_REGEX.test(email.trim()) || email.trim().length > 100) {
        validationErrors.push({ field: 'email', issue: 'Valid email address is required (max 100 characters)' });
      } else {
        const trimmedEmail = email.trim().toLowerCase();
        // Check uniqueness across other customers
        const dupEmail = await query(
          'SELECT customer_id FROM customers WHERE LOWER(email) = ? AND customer_id != ? LIMIT 1',
          [trimmedEmail, customerId]
        );
        if (dupEmail && dupEmail.length > 0) {
          return res.status(409).json({
            success: false,
            errorCode: 'VAL_002',
            message: 'Email address is already registered to another customer',
            fields: [{ field: 'email', issue: 'Email address is already registered to another customer' }],
            error: {
              code: 'VAL_002',
              message: 'Email address is already registered to another customer',
              fields: [{ field: 'email', issue: 'Email address is already registered to another customer' }]
            }
          });
        }
        fieldsToUpdate.email = trimmedEmail;
      }
    }

    // 5. Address (Customer or Staff)
    if (address !== undefined) {
      if (typeof address !== 'string' || !address.trim()) {
        validationErrors.push({ field: 'address', issue: 'Address must not be empty' });
      } else if (address.trim().length > 255) {
        validationErrors.push({ field: 'address', issue: 'Address must not exceed 255 characters' });
      } else {
        fieldsToUpdate.address = address.trim();
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'Invalid input. Please correct the specified fields.',
        fields: validationErrors,
        error: {
          code: 'VAL_001',
          message: 'Invalid input. Please correct the specified fields.',
          fields: validationErrors
        }
      });
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        errorCode: 'VAL_001',
        message: 'At least one valid field must be provided for update',
        error: {
          code: 'VAL_001',
          message: 'At least one valid field must be provided for update'
        }
      });
    }

    // Build update query dynamically with parameterized values
    const setClauses = [];
    const updateValues = [];
    for (const [col, val] of Object.entries(fieldsToUpdate)) {
      setClauses.push(`${col} = ?`);
      updateValues.push(val);
    }
    updateValues.push(customerId);

    await query(`UPDATE customers SET ${setClauses.join(', ')} WHERE customer_id = ?`, updateValues);

    // Retrieve updated customer record
    const updatedRows = await query(
      `SELECT c.customer_id, c.user_id, c.full_name, c.date_of_birth, c.phone, c.email, c.address, c.created_at, c.updated_at, u.username, u.status AS user_status
       FROM customers c
       JOIN users u ON c.user_id = u.user_id
       WHERE c.customer_id = ?
       LIMIT 1`,
      [customerId]
    );

    const r = updatedRows[0];
    return res.status(200).json({
      success: true,
      message: 'Customer profile updated successfully',
      data: {
        customerId: r.customer_id,
        userId: r.user_id,
        username: r.username,
        fullName: r.full_name,
        dateOfBirth: formatDateOnly(r.date_of_birth),
        phone: r.phone,
        email: r.email,
        address: r.address,
        userStatus: r.user_status,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        errorCode: 'VAL_002',
        message: 'Duplicate record detected. Value is already in use.',
        error: {
          code: 'VAL_002',
          message: 'Duplicate record detected. Value is already in use.'
        }
      });
    }
    next(error);
  }
}

router.put('/:customerId', requireAuth, handleUpdateCustomer);
router.patch('/:customerId', requireAuth, handleUpdateCustomer);

module.exports = router;
