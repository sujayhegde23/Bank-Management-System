-- ==============================================================================
-- Bank Management System - Baseline Academic Dummy Seed Data
-- For local development and demonstration only.
-- NO REAL PERSONAL DATA OR REAL CREDENTIALS.
-- Mapped to Phase 1 Test Plan Baseline (test_plan.md Section 5)
-- ==============================================================================

USE bank_management_system;

-- Disable foreign key checks during clean reset
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE bank_transactions;
TRUNCATE TABLE accounts;
TRUNCATE TABLE customers;
TRUNCATE TABLE employees;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------------------
-- 1. Insert Dummy Users
-- Dummy password hashes represent placeholder bcrypt hashes for '<valid password>'.
-- ------------------------------------------------------------------------------
INSERT INTO users (user_id, username, password_hash, role, status) VALUES
(1, 'test.admin1', '$2b$10$wT8K8U1yH4CqN0Xq7Z3CWeG5yH0bN2zL4pQ8vR6tS2uW1xY9zA3B.', 'ADMIN', 'ACTIVE'),
(2, 'test.employee1', '$2b$10$wT8K8U1yH4CqN0Xq7Z3CWeG5yH0bN2zL4pQ8vR6tS2uW1xY9zA3B.', 'EMPLOYEE', 'ACTIVE'),
(3, 'test.employee2', '$2b$10$wT8K8U1yH4CqN0Xq7Z3CWeG5yH0bN2zL4pQ8vR6tS2uW1xY9zA3B.', 'EMPLOYEE', 'ACTIVE'),
(4, 'test.customer1', '$2b$10$wT8K8U1yH4CqN0Xq7Z3CWeG5yH0bN2zL4pQ8vR6tS2uW1xY9zA3B.', 'CUSTOMER', 'ACTIVE'),
(5, 'test.customer2', '$2b$10$wT8K8U1yH4CqN0Xq7Z3CWeG5yH0bN2zL4pQ8vR6tS2uW1xY9zA3B.', 'CUSTOMER', 'ACTIVE');

-- ------------------------------------------------------------------------------
-- 2. Insert Dummy Employee Profiles
-- ------------------------------------------------------------------------------
INSERT INTO employees (employee_id, user_id, full_name, email, phone) VALUES
(1, 2, 'Test Employee One', 'test.employee1@example.com', '555-0101'),
(2, 3, 'Test Employee Two', 'test.employee2@example.com', '555-0102');

-- ------------------------------------------------------------------------------
-- 3. Insert Dummy Customer Profiles
-- ------------------------------------------------------------------------------
INSERT INTO customers (customer_id, user_id, full_name, date_of_birth, phone, email, address) VALUES
(1, 4, 'Test Customer One', '1990-01-01', '555-0201', 'test.customer1@example.com', '101 Prototype Way, Campus City'),
(2, 5, 'Test Customer Two', '1992-05-15', '555-0202', 'test.customer2@example.com', '102 Prototype Way, Campus City');

-- ------------------------------------------------------------------------------
-- 4. Insert Baseline Bank Accounts (test_plan.md Section 5)
-- ACC-T1: C1, Active, 10,000.00
-- ACC-T4: C1, Inactive, 1,000.00
-- ACC-T2: C2, Active, 5,000.00
-- ACC-T3: C2, Frozen, 2,000.00
-- ------------------------------------------------------------------------------
INSERT INTO accounts (account_id, account_number, customer_id, account_type, balance, status) VALUES
(1, 'ACC-T1', 1, 'SAVINGS', 10000.00, 'ACTIVE'),
(2, 'ACC-T2', 2, 'SAVINGS', 5000.00, 'ACTIVE'),
(3, 'ACC-T3', 2, 'SAVINGS', 2000.00, 'FROZEN'),
(4, 'ACC-T4', 1, 'SAVINGS', 1000.00, 'INACTIVE');

-- ------------------------------------------------------------------------------
-- 5. Insert Sample Initial Transaction Records
-- ------------------------------------------------------------------------------
INSERT INTO bank_transactions (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks) VALUES
(1, 'TXN-INIT-001', 'DEPOSIT', 10000.00, NULL, 1, 2, 'Baseline account opening deposit'),
(2, 'TXN-INIT-002', 'DEPOSIT', 5000.00, NULL, 2, 2, 'Baseline account opening deposit'),
(3, 'TXN-INIT-003', 'DEPOSIT', 2000.00, NULL, 3, 2, 'Baseline account opening deposit'),
(4, 'TXN-INIT-004', 'DEPOSIT', 1000.00, NULL, 4, 3, 'Baseline account opening deposit');
