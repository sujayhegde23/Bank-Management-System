-- ==============================================================================
-- Bank Management System - Database Schema Specification
-- Phase 1 / Issue #15: Application Structure and Database Schema
-- Standard: MySQL 8.0+ (InnoDB Engine)
-- ==============================================================================

-- Create Database if it does not already exist
CREATE DATABASE IF NOT EXISTS bank_management_system
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE bank_management_system;

-- ------------------------------------------------------------------------------
-- 1. Table: users
-- Core authentication and role entities for Customers, Employees, and Admins.
-- Passwords must be salted hashes (e.g. bcrypt/Argon2); never plain text (NFR-01).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('CUSTOMER', 'EMPLOYEE', 'ADMIN') NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_username (username),
    INDEX idx_users_role (role),
    INDEX idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Table: customers
-- Customer profile linked 1-to-1 with a USER record (FR-04, FR-05, FR-06).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    customer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_customers_user FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    INDEX idx_customers_phone (phone),
    INDEX idx_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Table: employees
-- Bank staff profile linked 1-to-1 with a USER record (FR-23, FR-24).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    employee_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_employees_user FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    INDEX idx_employees_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Table: accounts
-- Bank account records belonging to a customer (FR-07, FR-08, FR-09, FR-10, FR-11).
-- Balance uses DECIMAL(15,2) with a non-negative CHECK constraint (NFR-08, FR-14).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    account_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_number VARCHAR(30) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL,
    account_type VARCHAR(20) NOT NULL DEFAULT 'SAVINGS',
    balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    status ENUM('ACTIVE', 'INACTIVE', 'FROZEN') NOT NULL DEFAULT 'ACTIVE',
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_accounts_customer FOREIGN KEY (customer_id)
        REFERENCES customers (customer_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_account_balance CHECK (balance >= 0.00),
    INDEX idx_accounts_customer_id (customer_id),
    INDEX idx_accounts_account_number (account_number),
    INDEX idx_accounts_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Table: bank_transactions
-- Insert-only ledger of all completed financial operations (NFR-10, FR-18, FR-19).
-- Named bank_transactions because TRANSACTION is a reserved SQL keyword.
-- Supports DEPOSIT, WITHDRAWAL, and TRANSFER operations consistently.
--
-- Operational & Transactional Rules (to be enforced by Backend Operations):
-- 1. Account Status Check: Backend operations must validate that involved accounts
--    are in 'ACTIVE' status (rejecting FROZEN or INACTIVE accounts per FR-11)
--    before initiating balance changes or ledger insertions.
-- 2. Transaction Atomicity: Backend operations must perform account balance updates
--    and ledger inserts within a single atomic database transaction (START TRANSACTION
--    ... COMMIT / ROLLBACK) with row-level locks (SELECT ... FOR UPDATE) to ensure
--    balance consistency and prevent lost updates (NFR-09, NFR-17).
-- 3. Idempotency & Uniqueness: `transaction_ref` enforces uniqueness at the database
--    level (FR-18). However, `transaction_ref` uniqueness alone does not guarantee
--    idempotency; application-level duplicate-request prevention and atomic
--    balance/ledger updates must be implemented in a subsequent feature task.
-- 4. Scope: Banking business workflows are not implemented in this scaffolding issue.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bank_transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_ref VARCHAR(64) NOT NULL UNIQUE,
    type ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    source_account_id BIGINT NULL,
    destination_account_id BIGINT NULL,
    performed_by_user_id BIGINT NOT NULL,
    remarks VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_txn_source_account FOREIGN KEY (source_account_id)
        REFERENCES accounts (account_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_txn_destination_account FOREIGN KEY (destination_account_id)
        REFERENCES accounts (account_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_txn_performed_by FOREIGN KEY (performed_by_user_id)
        REFERENCES users (user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_transaction_amount CHECK (amount > 0.00),
    CONSTRAINT chk_transaction_type_accounts CHECK (
        (type = 'DEPOSIT' AND source_account_id IS NULL AND destination_account_id IS NOT NULL) OR
        (type = 'WITHDRAWAL' AND source_account_id IS NOT NULL AND destination_account_id IS NULL) OR
        (type = 'TRANSFER' AND source_account_id IS NOT NULL AND destination_account_id IS NOT NULL AND source_account_id <> destination_account_id)
    ),
    INDEX idx_txn_source_account (source_account_id, created_at),
    INDEX idx_txn_destination_account (destination_account_id, created_at),
    INDEX idx_txn_created_at (created_at),
    INDEX idx_txn_ref (transaction_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
