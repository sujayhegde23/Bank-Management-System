# Database Design — Complete Schema and Relationship Analysis

**Project:** Bank Management System  
**Academic Level:** DBMS Level 3 Project Deliverable  
**Document Purpose:** Definitive Relational Schema & Cross-Database Analysis for Entity-Relationship (ER) Modeling  
**Target File:** `docs/dbms/database_schema_analysis.md`  
**Analysis Date:** November 6, 2026  
**Status:** Verified against Live MySQL Database (`bank_management_system`) & MongoDB (`bank_fraud_detection`)

---

## 1. Database Overview

The Bank Management System utilizes a **polyglot persistence architecture** separating authoritative transactional banking operations from real-time fraud monitoring:

```
+----------------------------------------------------------------------------------------------------+
|                                    POLYGLOT PERSISTENCE OVERVIEW                                   |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ MySQL 8.0 (InnoDB Engine) ]                       [ MongoDB 7.0+ ]                              |
|  Authoritative Financial Ledger                      Asynchronous Fraud Detection Engine           |
|  - ACID Banking Transactions                         - Transaction Risk Assessments                |
|  - User Identity & RBAC Profiles                     - High / Critical Fraud Alerts                |
|  - Customers, Employees, Accounts                    - Dynamic Rule Configurations                 |
|  - Transactional Outbox Pattern                      - Case Investigation Lifecycle                |
|  - Immutable Audit Logs                              - Embedded Note Logs & Timelines              |
|                                                                                                    |
|                +-------------------------------------------------------+                           |
|                |   MySQL Transactional Outbox Worker (Async Polling)   |                           |
|                |   bank_transactions  --->  fraud_outbox_events        |                           |
|                |                              |                        |                           |
|                |                              v                        |                           |
|                |                     evaluateTransaction()             |                           |
|                |                              |                        |                           |
|                |                              v                        |                           |
|                |   transaction_risk_assessments / fraud_alerts         |                           |
|                +-------------------------------------------------------+                           |
+----------------------------------------------------------------------------------------------------+
```

### Primary Database: MySQL 8.0 (InnoDB)
- **Database Name:** `bank_management_system`
- **Character Set / Collation:** `utf8mb4` / `utf8mb4_unicode_ci`
- **Storage Engine:** InnoDB (guaranteeing strict ACID transactions, row-level locking via `SELECT ... FOR UPDATE`, and referential integrity enforcement).
- **Core Role:** System of record for all banking identities, accounts, ledger entries, and outbox event publishing.

### Secondary Database: MongoDB
- **Database Name:** `bank_fraud_detection`
- **Document Engine:** MongoDB with JSON Schema collection validators (`validationLevel: 'moderate'`, `validationAction: 'warn'`).
- **Core Role:** Evaluates completed transactions asynchronously, computes cumulative risk scores based on active rules, records immutable risk assessments, and manages investigation case files.

---

## 2. Complete MySQL Entity List

The MySQL relational database contains exactly **7 tables** (`BASE TABLE`):

| # | Entity / Table Name | Architectural Role | High-Level Purpose |
|:---:|:---|:---|:---|
| 1 | `users` | Core Identity & Security | System-wide authentication, hashed credentials, role classification (`CUSTOMER`, `EMPLOYEE`, `ADMIN`), and account activation state. |
| 2 | `customers` | Domain Profile | Customer demographic profile linked 1-to-1 with a `users` record; owns one or more bank accounts. |
| 3 | `employees` | Domain Profile | Bank branch and operations staff profile linked 1-to-1 with a `users` record. |
| 4 | `accounts` | Core Banking Entity | Financial bank accounts owned by a customer, tracking current balance with non-negative constraints. |
| 5 | `bank_transactions` | Authoritative Financial Ledger | Append-only ledger recording all successful financial operations (`DEPOSIT`, `WITHDRAWAL`, `TRANSFER`). |
| 6 | `audit_logs` | Security & Compliance | Centralized administrative, authentication, and operational activity trail with polymorphic target tracking. |
| 7 | `fraud_outbox_events` | Integration / Infrastructure | MySQL transactional outbox queue ensuring dual-write resilience between MySQL banking commits and MongoDB fraud evaluations. |

---

## 3. Attributes and Data Types for Every Entity

### 3.1 Table: `users`
**Purpose:** Central authentication store for all system users across all roles.

| Column | Data Type | Primary Key | Foreign Key | Nullable | Default | Description |
|---|---|---|---|---|---|---|
| `user_id` | `BIGINT` | Yes | No | No | `NULL` (Auto Increment) | Surrogate primary key for internal identity references. |
| `username` | `VARCHAR(50)` | No | No | No | `NULL` | Unique system login name (case-insensitive in collation). |
| `password_hash` | `VARCHAR(255)` | No | No | No | `NULL` | Secure salted password hash (e.g., bcrypt `$2b$10$...`). Plaintext passwords are never stored. |
| `role` | `ENUM('CUSTOMER', 'EMPLOYEE', 'ADMIN')` | No | No | No | `NULL` | Role-based access control discriminator. |
| `status` | `ENUM('ACTIVE', 'INACTIVE')` | No | No | No | `'ACTIVE'` | Account authorization lifecycle status. |
| `created_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP` | Timestamp of account registration. |
| `updated_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | Timestamp of last profile or status update. |

- **Indexes:**
  - `PRIMARY KEY (`user_id`)`
  - `UNIQUE KEY `username` (`username`)`
  - `KEY `idx_users_username` (`username`)`
  - `KEY `idx_users_role` (`role`)`
  - `KEY `idx_users_status` (`status`)`

---

### 3.2 Table: `customers`
**Purpose:** Stores personal identity, contact, and address data for bank customers.

| Column | Data Type | Primary Key | Foreign Key | Nullable | Default | Description |
|---|---|---|---|---|---|---|
| `customer_id` | `BIGINT` | Yes | No | No | `NULL` (Auto Increment) | Surrogate primary key for customer profile. |
| `user_id` | `BIGINT` | No | Yes (`users.user_id`) | No | `NULL` | Reference to authentication login; enforces strict 1:1 relationship via UNIQUE constraint. |
| `full_name` | `VARCHAR(100)` | No | No | No | `NULL` | Customer legal full name. |
| `date_of_birth` | `DATE` | No | No | No | `NULL` | Customer birth date for identity and KYC compliance. |
| `phone` | `VARCHAR(20)` | No | No | No | `NULL` | Contact telephone number. |
| `email` | `VARCHAR(100)` | No | No | No | `NULL` | Contact and statement notification email address. |
| `address` | `VARCHAR(255)` | No | No | No | `NULL` | Customer residential address. |
| `created_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP` | Profile creation timestamp. |
| `updated_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | Profile last update timestamp. |

- **Constraints & Foreign Keys:**
  - `CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- **Indexes:**
  - `PRIMARY KEY (`customer_id`)`
  - `UNIQUE KEY `user_id` (`user_id`)`
  - `KEY `idx_customers_phone` (`phone`)`
  - `KEY `idx_customers_email` (`email`)`

---

### 3.3 Table: `employees`
**Purpose:** Stores professional contact and identification details for bank branch staff and system administrators.

| Column | Data Type | Primary Key | Foreign Key | Nullable | Default | Description |
|---|---|---|---|---|---|---|
| `employee_id` | `BIGINT` | Yes | No | No | `NULL` (Auto Increment) | Surrogate primary key for employee profile. |
| `user_id` | `BIGINT` | No | Yes (`users.user_id`) | No | `NULL` | Reference to authentication login; enforces strict 1:1 relationship via UNIQUE constraint. |
| `full_name` | `VARCHAR(100)` | No | No | No | `NULL` | Staff member full name. |
| `email` | `VARCHAR(100)` | No | No | No | `NULL` | Official corporate email address. |
| `phone` | `VARCHAR(20)` | No | No | No | `NULL` | Official telephone contact. |
| `created_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP` | Profile creation timestamp. |
| `updated_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | Profile last update timestamp. |

- **Constraints & Foreign Keys:**
  - `CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- **Indexes:**
  - `PRIMARY KEY (`employee_id`)`
  - `UNIQUE KEY `user_id` (`user_id`)`
  - `KEY `idx_employees_email` (`email`)`

---

### 3.4 Table: `accounts`
**Purpose:** Represents depository accounts holding customer funds.

| Column | Data Type | Primary Key | Foreign Key | Nullable | Default | Description |
|---|---|---|---|---|---|---|
| `account_id` | `BIGINT` | Yes | No | No | `NULL` (Auto Increment) | Surrogate primary key for the bank account. |
| `account_number` | `VARCHAR(30)` | No | No | No | `NULL` | Unique formatted public account identifier (e.g. `ACC-T1`, `ACC-SB-83198732`). |
| `customer_id` | `BIGINT` | No | Yes (`customers.customer_id`) | No | `NULL` | Owning customer reference. |
| `account_type` | `VARCHAR(20)` | No | No | No | `'SAVINGS'` | Account scheme/product category (`SAVINGS`, `CHECKING`, etc.). |
| `balance` | `DECIMAL(15,2)` | No | No | No | `'0.00'` | Current liquid balance in Indian Rupees. |
| `status` | `ENUM('ACTIVE', 'INACTIVE', 'FROZEN')` | No | No | No | `'ACTIVE'` | Account operational state (transactions are blocked if not `ACTIVE`). |
| `opened_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP` | Date and time account was opened. |
| `updated_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | Date and time of last balance or status modification. |

- **Check Constraints:**
  - `CONSTRAINT chk_account_balance CHECK (balance >= 0.00)` (Strict overdraft prevention at database engine level).
- **Constraints & Foreign Keys:**
  - `CONSTRAINT fk_accounts_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- **Indexes:**
  - `PRIMARY KEY (`account_id`)`
  - `UNIQUE KEY `account_number` (`account_number`)`
  - `KEY `idx_accounts_customer_id` (`customer_id`)`
  - `KEY `idx_accounts_account_number` (`account_number`)`
  - `KEY `idx_accounts_status` (`status`)`

---

### 3.5 Table: `bank_transactions`
**Purpose:** Append-only financial ledger of all completed monetary operations. Modifying or deleting rows is strictly prohibited.

| Column | Data Type | Primary Key | Foreign Key | Nullable | Default | Description |
|---|---|---|---|---|---|---|
| `transaction_id` | `BIGINT` | Yes | No | No | `NULL` (Auto Increment) | Surrogate primary key and sequential ledger sequence. |
| `transaction_ref` | `VARCHAR(64)` | No | No | No | `NULL` | Cryptographically unique business reference (e.g., `TXN-DEP-8F7F7DC36CF5`). |
| `type` | `ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER')` | No | No | No | `NULL` | Financial transaction classification. |
| `amount` | `DECIMAL(15,2)` | No | No | No | `NULL` | Transacted monetary sum in Indian Rupees. |
| `source_account_id` | `BIGINT` | No | Yes (`accounts.account_id`) | Yes | `NULL` | Debited account ID (NULL for `DEPOSIT`). |
| `destination_account_id` | `BIGINT` | No | Yes (`accounts.account_id`) | Yes | `NULL` | Credited account ID (NULL for `WITHDRAWAL`). |
| `performed_by_user_id` | `BIGINT` | No | Yes (`users.user_id`) | No | `NULL` | ID of the authenticated user who initiated the transaction. |
| `remarks` | `VARCHAR(255)` | No | No | Yes | `NULL` | Optional memo, purpose, or branch teller remarks. |
| `created_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP` | Immutable timestamp of transaction execution. |

- **Check Constraints:**
  - `CONSTRAINT chk_transaction_amount CHECK (amount > 0.00)` (Strict positive monetary value).
  - `CONSTRAINT chk_transaction_type_accounts CHECK (`
    ```sql
    (type = 'DEPOSIT' AND source_account_id IS NULL AND destination_account_id IS NOT NULL) OR
    (type = 'WITHDRAWAL' AND source_account_id IS NOT NULL AND destination_account_id IS NULL) OR
    (type = 'TRANSFER' AND source_account_id IS NOT NULL AND destination_account_id IS NOT NULL AND source_account_id <> destination_account_id)
    ```
    `)` (Enforces structural account integrity corresponding to each operation type).
- **Constraints & Foreign Keys:**
  - `CONSTRAINT fk_txn_source_account FOREIGN KEY (source_account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT ON UPDATE RESTRICT`
  - `CONSTRAINT fk_txn_destination_account FOREIGN KEY (destination_account_id) REFERENCES accounts(account_id) ON DELETE RESTRICT ON UPDATE RESTRICT`
  - `CONSTRAINT fk_txn_performed_by FOREIGN KEY (performed_by_user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- **Indexes:**
  - `PRIMARY KEY (`transaction_id`)`
  - `UNIQUE KEY `transaction_ref` (`transaction_ref`)`
  - `KEY `fk_txn_performed_by` (`performed_by_user_id`)`
  - `KEY `idx_txn_source_account` (`source_account_id`, `created_at`)`
  - `KEY `idx_txn_destination_account` (`destination_account_id`, `created_at`)`
  - `KEY `idx_txn_created_at` (`created_at`)`
  - `KEY `idx_txn_ref` (`transaction_ref`)`

---

### 3.6 Table: `audit_logs`
**Purpose:** Centralized operational and compliance audit trail recording system events, security state changes, and management actions.

| Column | Data Type | Primary Key | Foreign Key | Nullable | Default | Description |
|---|---|---|---|---|---|---|
| `audit_id` | `BIGINT` | Yes | No | No | `NULL` (Auto Increment) | Surrogate primary key for audit record. |
| `actor_user_id` | `BIGINT` | No | Yes (`users.user_id`) | Yes | `NULL` | User who performed the action (NULL for automated system/background tasks). |
| `action_type` | `VARCHAR(64)` | No | No | No | `NULL` | Standardized action category (e.g. `LOGIN_SUCCESS`, `ACCOUNT_STATUS_CHANGE`, `FUNDS_TRANSFER`). |
| `target_entity_type` | `VARCHAR(32)` | No | No | Yes | `NULL` | Polymorphic target table or entity category (`ACCOUNT`, `CUSTOMER`, `USER`, `TRANSACTION`). |
| `target_entity_id` | `VARCHAR(64)` | No | No | Yes | `NULL` | Identifier of affected target entity (stored as string to support both numeric and ObjectId values). |
| `description` | `VARCHAR(500)` | No | No | No | `NULL` | Human-readable description of event context. |
| `result` | `ENUM('SUCCESS', 'FAILURE')` | No | No | No | `'SUCCESS'` | Operational outcome. |
| `metadata` | `JSON` | No | No | Yes | `NULL` | Arbitrary structured diagnostic metadata (e.g. IP address, old/new balances, error codes). |
| `created_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP` | Timestamp of logged event. |

- **Constraints & Foreign Keys:**
  - `CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE`
- **Indexes:**
  - `PRIMARY KEY (`audit_id`)`
  - `KEY `idx_audit_actor` (`actor_user_id`, `created_at`)`
  - `KEY `idx_audit_action` (`action_type`)`
  - `KEY `idx_audit_target` (`target_entity_type`, `target_entity_id`)`
  - `KEY `idx_audit_created_at` (`created_at`)`
  - `KEY `idx_audit_result` (`result`)`

---

### 3.7 Table: `fraud_outbox_events`
**Purpose:** MySQL Transactional Outbox pattern implementation. Guarantees that every completed banking transaction is eventually evaluated by the MongoDB fraud engine without dual-write hazards or distributed 2-phase commits.

| Column | Data Type | Primary Key | Foreign Key | Nullable | Default | Description |
|---|---|---|---|---|---|---|
| `event_id` | `BIGINT` | Yes | No | No | `NULL` (Auto Increment) | Surrogate primary key for outbox queuing. |
| `transaction_id` | `BIGINT` | No | Yes (`bank_transactions.transaction_id`) | No | `NULL` | Unique foreign key reference to ledger entry (enforces 1:1 outbox event allocation). |
| `event_type` | `VARCHAR(32)` | No | No | No | `NULL` | Event discriminator (`DEPOSIT`, `WITHDRAWAL`, `TRANSFER`). |
| `payload` | `JSON` | No | No | No | `NULL` | Self-contained event snapshot (amount, account IDs, timestamp, customer ID). |
| `status` | `ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')` | No | No | No | `'PENDING'` | Outbox message processing state. |
| `attempt_count` | `INT` | No | No | No | `'0'` | Number of worker evaluation processing attempts. |
| `next_attempt_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP` | Exponential backoff scheduling timestamp. |
| `locked_at` | `DATETIME` | No | No | Yes | `NULL` | Lease start timestamp for in-flight processing. |
| `locked_by` | `VARCHAR(128)` | No | No | Yes | `NULL` | Worker identifier holding active lease (prevents concurrent double processing). |
| `last_error` | `VARCHAR(1000)` | No | No | Yes | `NULL` | Sanitized diagnostic error string from failed attempts. |
| `created_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP` | Outbox event creation timestamp (co-committed with banking transaction). |
| `updated_at` | `DATETIME` | No | No | No | `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | Outbox event status update timestamp. |

- **Constraints & Foreign Keys:**
  - `CONSTRAINT fk_outbox_transaction FOREIGN KEY (transaction_id) REFERENCES bank_transactions(transaction_id) ON DELETE RESTRICT ON UPDATE CASCADE`
  *(Note: `ON DELETE RESTRICT` guarantees that financial ledger entries cannot be removed while an outbox audit record exists).*
- **Indexes:**
  - `PRIMARY KEY (`event_id`)`
  - `UNIQUE KEY `transaction_id` (`transaction_id`)`
  - `KEY `idx_outbox_poll` (`status`, `next_attempt_at`)`
  - `KEY `idx_outbox_lease` (`status`, `locked_at`)`
  - `KEY `idx_outbox_created` (`created_at`)`

---

## 4. Primary Keys and Foreign Keys Summary

### Primary Keys:
All 7 MySQL tables use synthetic surrogate primary keys (`BIGINT AUTO_INCREMENT`):
- `users`: `user_id`
- `customers`: `customer_id`
- `employees`: `employee_id`
- `accounts`: `account_id`
- `bank_transactions`: `transaction_id`
- `audit_logs`: `audit_id`
- `fraud_outbox_events`: `event_id`

### Foreign Keys Matrix:

| Constraint Name | Source Table | Source Column | Referenced Table | Referenced Column | ON DELETE | ON UPDATE | Physical Index Backing |
|---|---|---|---|---|---|---|---|
| `fk_customers_user` | `customers` | `user_id` | `users` | `user_id` | `RESTRICT` | `CASCADE` | `UNIQUE KEY user_id` |
| `fk_employees_user` | `employees` | `user_id` | `users` | `user_id` | `RESTRICT` | `CASCADE` | `UNIQUE KEY user_id` |
| `fk_accounts_customer` | `accounts` | `customer_id` | `customers` | `customer_id` | `RESTRICT` | `CASCADE` | `KEY idx_accounts_customer_id` |
| `fk_txn_source_account` | `bank_transactions` | `source_account_id` | `accounts` | `account_id` | `RESTRICT` | `RESTRICT` | `KEY idx_txn_source_account` |
| `fk_txn_destination_account` | `bank_transactions` | `destination_account_id` | `accounts` | `account_id` | `RESTRICT` | `RESTRICT` | `KEY idx_txn_destination_account` |
| `fk_txn_performed_by` | `bank_transactions` | `performed_by_user_id` | `users` | `user_id` | `RESTRICT` | `CASCADE` | `KEY fk_txn_performed_by` |
| `fk_audit_actor` | `audit_logs` | `actor_user_id` | `users` | `user_id` | `SET NULL` | `CASCADE` | `KEY idx_audit_actor` |
| `fk_outbox_transaction` | `fraud_outbox_events` | `transaction_id` | `bank_transactions` | `transaction_id` | `RESTRICT` | `CASCADE` | `UNIQUE KEY transaction_id` |

---

## 5. Relationships and Cardinalities

The following table summarizes all 8 enforced relational relationships:

| # | Source Table | Source Column | Referenced Table | Referenced Column | Cardinality | Participation (Source) | Participation (Ref) | Enforced by FK? | ON DELETE / ON UPDATE |
|:---:|---|---|---|---|:---:|:---:|:---:|:---:|---|
| **R1** | `customers` | `user_id` | `users` | `user_id` | **1:1** | Mandatory | Optional | Yes (`fk_customers_user`) | `RESTRICT` / `CASCADE` |
| **R2** | `employees` | `user_id` | `users` | `user_id` | **1:1** | Mandatory | Optional | Yes (`fk_employees_user`) | `RESTRICT` / `CASCADE` |
| **R3** | `accounts` | `customer_id` | `customers` | `customer_id` | **1:N** | Mandatory | Optional | Yes (`fk_accounts_customer`) | `RESTRICT` / `CASCADE` |
| **R4** | `bank_transactions` | `source_account_id` | `accounts` | `account_id` | **1:N** | Optional | Optional | Yes (`fk_txn_source_account`) | `RESTRICT` / `RESTRICT` |
| **R5** | `bank_transactions` | `destination_account_id` | `accounts` | `account_id` | **1:N** | Optional | Optional | Yes (`fk_txn_destination_account`) | `RESTRICT` / `RESTRICT` |
| **R6** | `bank_transactions` | `performed_by_user_id` | `users` | `user_id` | **1:N** | Mandatory | Optional | Yes (`fk_txn_performed_by`) | `RESTRICT` / `CASCADE` |
| **R7** | `audit_logs` | `actor_user_id` | `users` | `user_id` | **1:N** | Optional | Optional | Yes (`fk_audit_actor`) | `SET NULL` / `CASCADE` |
| **R8** | `fraud_outbox_events` | `transaction_id` | `bank_transactions` | `transaction_id` | **1:1** | Mandatory | Mandatory* | Yes (`fk_outbox_transaction`) | `RESTRICT` / `CASCADE` |

*\*Note on R8:* Mandatory on `bank_transactions` side at application level (every banking transaction generates an outbox row), but schema-wise optional (nullable/foreign key is hosted on the outbox table).

---

## 6. Participation Constraints

Participation constraints define whether an entity instance must participate in a relationship:

### 1. `users` $\longleftrightarrow$ `customers` (R1)
- **`customers` $\rightarrow$ `users`:** **Mandatory (Total Participation).** A customer record cannot exist without referencing an authentic `users` entry (`user_id` is `NOT NULL`).
- **`users` $\rightarrow$ `customers`:** **Optional (Partial Participation).** A `users` record may represent an `EMPLOYEE` or `ADMIN`, having no associated `customers` record.

### 2. `users` $\longleftrightarrow$ `employees` (R2)
- **`employees` $\rightarrow$ `users`:** **Mandatory (Total Participation).** An employee record cannot exist without referencing a valid `users` entry (`user_id` is `NOT NULL`).
- **`users` $\rightarrow$ `employees`:** **Optional (Partial Participation).** A `users` record may represent a `CUSTOMER` or `ADMIN`.

### 3. `customers` $\longleftrightarrow$ `accounts` (R3)
- **`accounts` $\rightarrow$ `customers`:** **Mandatory (Total Participation).** Every bank account must belong to an existing customer (`customer_id` is `NOT NULL`).
- **`customers` $\rightarrow$ `accounts`:** **Optional (Partial Participation).** A newly enrolled customer profile may exist temporarily prior to the creation of their first bank account.

### 4. `accounts` $\longleftrightarrow$ `bank_transactions` as Source (R4)
- **`bank_transactions` $\rightarrow$ `accounts` (Source):** **Optional (Partial Participation).** For `DEPOSIT` transactions, new funds enter the banking system from an external source (e.g., cash at branch counter), so `source_account_id` is `NULL`.
- **`accounts` $\rightarrow$ `bank_transactions` (Source):** **Optional (Partial Participation).** A newly created account or dormant account may have 0 outgoing transactions.

### 5. `accounts` $\longleftrightarrow$ `bank_transactions` as Destination (R5)
- **`bank_transactions` $\rightarrow$ `accounts` (Destination):** **Optional (Partial Participation).** For `WITHDRAWAL` transactions, cash leaves the banking system, so `destination_account_id` is `NULL`.
- **`accounts` $\rightarrow$ `bank_transactions` (Destination):** **Optional (Partial Participation).** An account may have 0 incoming transactions.

### 6. `users` $\longleftrightarrow$ `bank_transactions` as Performed By (R6)
- **`bank_transactions` $\rightarrow$ `users`:** **Mandatory (Total Participation).** Every financial transaction must record the authentic user identity of the initiator (`performed_by_user_id` is `NOT NULL`).
- **`users` $\rightarrow$ `bank_transactions`:** **Optional (Partial Participation).** A user (such as an administrative auditor) might never execute a financial transaction.

### 7. `users` $\longleftrightarrow$ `audit_logs` (R7)
- **`audit_logs` $\rightarrow$ `users`:** **Optional (Partial Participation).** Certain events (such as scheduled worker polling or failed unauthenticated login attempts) have no valid authenticated user, leaving `actor_user_id` as `NULL`.
- **`users` $\rightarrow$ `audit_logs`:** **Optional (Partial Participation).** A user may have no logged actions.

### 8. `bank_transactions` $\longleftrightarrow$ `fraud_outbox_events` (R8)
- **`fraud_outbox_events` $\rightarrow$ `bank_transactions`:** **Mandatory (Total Participation).** An outbox message cannot exist without an accompanying banking transaction (`transaction_id` is `NOT NULL` and `UNIQUE`).
- **`bank_transactions` $\rightarrow$ `fraud_outbox_events`:** **Mandatory (Total Participation) in application domain.** Every banking transaction committed by `transactionService.js` atomically creates an outbox record.

---

## 7. Associative Entities

An associative entity (or junction/bridge table) is used in relational database modeling to resolve many-to-many ($M:N$) relationships into two one-to-many ($1:N$) relationships, typically holding attributes associated with the relationship itself.

### Finding:
**No associative entities or Many-to-Many ($M:N$) relationships exist in the MySQL relational schema.**

### Detailed Justification:
1. **User Specialization:** `users` relates to `customers` and `employees` via strict $1:1$ relationships enforced by `UNIQUE` keys on `user_id`.
2. **Account Ownership:** `customers` relates to `accounts` via a standard $1:N$ relationship. Joint accounts ($M:N$) are not implemented in the schema; each account has exactly one owner (`customer_id` is not an associative table).
3. **Transactions:**
   - In abstract conceptual modeling, a transfer might be perceived as a relationship between a sender account and a receiver account.
   - However, in this implementation, `bank_transactions` is an **independent financial ledger entity** with its own surrogate primary key (`transaction_id`) and unique transaction reference (`transaction_ref`).
   - Furthermore, `bank_transactions` models non-transfer operations (`DEPOSIT` and `WITHDRAWAL`) where one of the accounts is `NULL`. Therefore, it functions as a primary entity rather than a pure associative bridge table.

---

## 8. Stored vs. Derived and Computed Attributes

| Entity | Attribute Name | Storage Classification | Derivation / Generation Logic |
|---|---|:---:|---|
| `accounts` | `balance` | **Stored (Materialized)** | While theoretically computable as the sum of all past credits minus debits:$$\text{Balance} = \sum \text{Credits} - \sum \text{Debits}$$in this production banking design, `balance` is **stored directly as `DECIMAL(15,2)`** to provide $O(1)$ balance inquiries and enforce the non-negative check constraint (`chk_account_balance`). It is maintained atomically under row-level locking (`SELECT ... FOR UPDATE`). |
| `bank_transactions` | `transaction_ref` | **Stored (Auto-Generated)** | Generated cryptographically in application code using random hex bytes: `TXN-<TYPE>-<12_HEX_DIGITS>` (e.g. `TXN-TRF-6A1787D3D52C`). |
| `accounts` | `account_number` | **Stored (Auto-Generated)** | Formatted business identifier generated during account opening (`ACC-<SCHEME>-<NUMBER>`). |
| `audit_logs` | `target_entity_type` + `target_entity_id` | **Stored (Polymorphic)** | Application-derived string references pointing dynamically to `accounts`, `customers`, `users`, or MongoDB ObjectIds. |
| `fraud_outbox_events` | `attempt_count` | **Stored (Computed)** | Counter incremented on each background worker execution attempt. |
| `fraud_outbox_events` | `next_attempt_at` | **Stored (Computed)** | Computed from attempt count using an exponential backoff schedule `[0s, 30s, 2m, 10m, 30m]`. |
| Reports / Statements | `openingBalance` | **Derived (Computed on Read)** | Derived dynamically by summing transactions prior to the requested statement start date:$$\text{Opening} = \sum_{t < \text{start}} \text{Credits} - \sum_{t < \text{start}} \text{Debits}$$ |
| Reports / Statements | `closingBalance` | **Derived (Computed on Read)** | Derived dynamically as:$$\text{Closing} = \text{Opening} + \text{Total Deposits} + \text{Total In Transfers} - \text{Total Withdrawals} - \text{Total Out Transfers}$$ |
| Reports / Statements | `totalDeposits`, `totalWithdrawals`, `totalTransfers` | **Derived (Aggregated)** | Computed via SQL aggregation `SUM(amount)` over the requested date range. |
| Dashboards / Receipts | `customerName` | **Derived (Retrieved via Join)** | Derived via relational query: `bank_transactions` $\rightarrow$ `accounts` $\rightarrow$ `customers(full_name)`. |

---

## 9. MongoDB Collection Documentation

The `bank_fraud_detection` MongoDB database houses **4 collections**:

### 9.1 Collection: `transaction_risk_assessments`
- **Purpose:** Permanent, immutable audit log of the fraud risk assessment executed for every banking transaction.
- **Document Structure:**

```json
{
  "_id": "ObjectId('6aecbcbad83c3d068968cea9')",
  "transactionId": 919,
  "customerId": 1,
  "accountId": 1,
  "transactionType": "DEPOSIT",
  "amount": 450000,
  "riskScore": 20,
  "riskLevel": "LOW",
  "triggeredRules": [
    {
      "ruleCode": "HIGH_VELOCITY",
      "points": 20,
      "description": "High transaction velocity: observed 16 transactions within 2-minute window (configured threshold: 3)"
    }
  ],
  "decision": "APPROVED",
  "assessedAt": "2026-11-05T17:28:26.078Z"
}
```

- **Fields & Types:**
  - `_id`: `ObjectId` (MongoDB internal primary key).
  - `transactionId`: `Number / Long` (**Required**, Unique reference to MySQL `bank_transactions.transaction_id`).
  - `customerId`: `Number / Long` (**Required**, Reference to MySQL `customers.customer_id`).
  - `accountId`: `Number / Long` (**Required**, Reference to MySQL `accounts.account_id`).
  - `transactionType`: `String` (**Required**, Enum: `TRANSFER`, `WITHDRAWAL`, `DEPOSIT`).
  - `amount`: `Number / Long` (**Required**, Integer paise, 1 INR = 100 paise; e.g. 450000 = ₹4,500.00).
  - `riskScore`: `Number` (**Required**, Integer 0 to 100).
  - `riskLevel`: `String` (**Required**, Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
  - `triggeredRules`: `Array` of embedded documents `[{ ruleCode: String, points: Number, description: String }]`.
  - `decision`: `String` (**Required**, Enum: `APPROVED`, `FLAGGED`, `REVIEW_REQUIRED`, `REJECTED`).
  - `assessedAt`: `Date` (**Required**, Assessment execution timestamp).
- **Indexes:**
  - `_id_`: Standard primary key index.
  - `uniq_assessment_transaction_id`: `{ transactionId: 1 }` (**UNIQUE**).
  - `idx_assessment_customer_id`: `{ customerId: 1 }`.
  - `idx_assessment_risk_level`: `{ riskLevel: 1 }`.
  - `idx_assessment_assessed_at`: `{ assessedAt: -1 }`.

---

### 9.2 Collection: `fraud_alerts`
- **Purpose:** Operational alert inbox for compliance officers. Created exclusively when an assessment produces `riskLevel` of `HIGH` (score 60–79) or `CRITICAL` (score 80–100).
- **Document Structure:**

```json
{
  "_id": "ObjectId('6aecbd63399c31b136958831')",
  "transactionId": 988,
  "customerId": 1,
  "accountId": 1,
  "riskScore": 65,
  "riskLevel": "HIGH",
  "status": "OPEN",
  "reasons": [
    "Transaction amount ₹75,00,000.00 strictly exceeds configured threshold ₹50,000.00",
    "High transaction velocity: observed 22 transactions within 2-minute window (configured threshold: 3)"
  ],
  "createdAt": "2026-11-05T17:31:15.561Z",
  "updatedAt": "2026-11-05T17:31:15.561Z"
}
```

- **Fields & Types:**
  - `_id`: `ObjectId` (MongoDB internal primary key).
  - `transactionId`: `Number / Long` (**Required**, Unique reference to MySQL `bank_transactions.transaction_id`).
  - `customerId`: `Number / Long` (**Required**, Reference to MySQL `customers.customer_id`).
  - `accountId`: `Number / Long` (**Required**, Reference to MySQL `accounts.account_id`).
  - `riskScore`: `Number` (**Required**, 0 to 100).
  - `riskLevel`: `String` (**Required**, Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
  - `status`: `String` (**Required**, Enum: `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `FALSE_POSITIVE`).
  - `reasons`: `Array` of human-readable explanation strings.
  - `createdAt`: `Date` (**Required**, Alert generation timestamp).
  - `updatedAt`: `Date` (**Required**, Last modification timestamp).
- **Indexes:**
  - `_id_`: Standard primary key index.
  - `uniq_alert_transaction_id`: `{ transactionId: 1 }` (**UNIQUE**).
  - `idx_alert_status`: `{ status: 1 }`.
  - `idx_alert_risk_level`: `{ riskLevel: 1 }`.
  - `idx_alert_created_at`: `{ createdAt: -1 }`.

---

### 9.3 Collection: `fraud_rules`
- **Purpose:** Configurable, dynamic detection specifications loaded at runtime by the fraud detection engine.
- **Document Structure:**

```json
{
  "_id": "ObjectId('6aecac6c4c8a823d7d5ec254')",
  "ruleCode": "HIGH_AMOUNT",
  "name": "Unusually High Transaction Amount",
  "description": "Flags transactions exceeding configured monetary threshold (e.g. ₹50,000 = 5,000,000 paise)",
  "enabled": true,
  "threshold": 5000000,
  "weight": 30,
  "config": null,
  "createdAt": "2026-11-05T16:18:52.060Z",
  "updatedAt": "2026-11-05T19:41:32.481Z"
}
```

- **Fields & Types:**
  - `_id`: `ObjectId` (MongoDB internal primary key).
  - `ruleCode`: `String` (**Required**, Unique uppercase code: `HIGH_AMOUNT`, `HIGH_VELOCITY`, `NEW_BENEFICIARY`, `UNUSUAL_HOUR`).
  - `name`: `String` (**Required**, Descriptive display name).
  - `description`: `String` (Optional explanatory text).
  - `enabled`: `Boolean` (**Required**, Active state flag).
  - `threshold`: `Number / Decimal` (Optional threshold; integer paise for monetary rules, transaction count for velocity).
  - `weight`: `Number` (**Required**, Score weight points, 0 to 100).
  - `config`: `Object` (Optional embedded configuration, e.g. `{ windowMinutes: 2 }` or `{ startHour: 1, endHour: 5, timezone: 'Asia/Kolkata' }`).
  - `createdAt`: `Date` (**Required**).
  - `updatedAt`: `Date` (**Required**).
- **Indexes:**
  - `_id_`: Standard primary key index.
  - `uniq_rule_code`: `{ ruleCode: 1 }` (**UNIQUE**).
  - `idx_rule_enabled`: `{ enabled: 1 }`.

---

### 9.4 Collection: `fraud_investigations`
- **Purpose:** Case management workflow for compliance officers and bank investigators to document notes, track actions, and record final dispositions.
- **Document Structure:**

```json
{
  "_id": "ObjectId('6aecd54b8930b12e88a38832')",
  "alertId": "ObjectId('6aecd514b3ad845aa65651c9')",
  "transactionId": 1499,
  "assignedEmployeeId": 1,
  "status": "RESOLVED",
  "notes": [
    {
      "noteId": "note-1",
      "authorEmployeeId": 1,
      "authorName": "Test Employee One",
      "text": "Contacted customer; customer confirmed authorization of ₹75,000 transfer.",
      "createdAt": "2026-11-05T19:13:20.000Z"
    }
  ],
  "history": [
    {
      "action": "CREATED",
      "fromStatus": null,
      "toStatus": "OPEN",
      "assignedEmployeeId": null,
      "changedBy": "Administrator",
      "changedAt": "2026-11-05T19:13:15.526Z"
    },
    {
      "action": "STATUS_CHANGE",
      "fromStatus": "OPEN",
      "toStatus": "RESOLVED",
      "assignedEmployeeId": 1,
      "changedBy": "Test Employee One",
      "changedAt": "2026-11-05T19:13:31.440Z"
    }
  ],
  "resolution": "Customer verified genuine high-value transfer via phone OTP.",
  "createdAt": "2026-11-05T19:13:15.526Z",
  "updatedAt": "2026-11-05T19:13:31.440Z"
}
```

- **Fields & Types:**
  - `_id`: `ObjectId` (MongoDB internal primary key).
  - `alertId`: `ObjectId / String` (Optional reference to MongoDB `fraud_alerts._id`).
  - `transactionId`: `Number / Long` (**Required**, Reference to MySQL `bank_transactions.transaction_id`).
  - `assignedEmployeeId`: `Number / Long / Null` (Optional reference to MySQL `employees.employee_id`).
  - `status`: `String` (**Required**, Enum: `OPEN`, `UNDER_REVIEW`, `IN_PROGRESS`, `RESOLVED`, `FALSE_POSITIVE`, `CLOSED`).
  - `notes`: `Array` of embedded note objects (`noteId`, `authorEmployeeId`, `authorName`, `text`, `createdAt`).
  - `history`: `Array` of audit lifecycle transition objects (`action`, `fromStatus`, `toStatus`, `assignedEmployeeId`, `changedBy`, `changedAt`).
  - `resolution`: `String / Null` (Closing summary or notes).
  - `createdAt`: `Date` (**Required**).
  - `updatedAt`: `Date` (**Required**).
- **Indexes:**
  - `_id_`: Standard primary key index.
  - `idx_investigation_alert_id`: `{ alertId: 1 }`.
  - `idx_investigation_transaction_id`: `{ transactionId: 1 }`.
  - `idx_investigation_employee_id`: `{ assignedEmployeeId: 1 }`.
  - `idx_investigation_status`: `{ status: 1 }`.
  - `uniq_investigation_alert_id`: `{ alertId: 1 }` (**UNIQUE, SPARSE**).
  - `uniq_investigation_transaction_id`: `{ transactionId: 1 }` (**UNIQUE, SPARSE**).

---

## 10. MySQL–MongoDB Integration Architecture

```
+----------------------------------------------------------------------------------------------------+
|                                  CROSS-DATABASE INTEGRATION PIPELINE                               |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ MySQL DATABASE ]                                                                                |
|  1. executeDeposit / executeTransfer                                                               |
|     BEGIN TRANSACTION;                                                                             |
|       UPDATE accounts SET balance = ...                                                            |
|       INSERT INTO bank_transactions (transaction_id, ...)                                          |
|       INSERT INTO fraud_outbox_events (transaction_id, status='PENDING')                           |
|     COMMIT;                                                                                        |
|                                                                                                    |
|  2. Asynchronous Background Worker (fraudOutboxWorker.js)                                          |
|     - Queries MySQL: SELECT ... FROM fraud_outbox_events WHERE status='PENDING' FOR UPDATE SKIP LOCKED |
|     - Queries MySQL: buildTransactionContext(transaction_id) -> authoritative MySQL context        |
|                                                                                                    |
|  [ ASYNCHRONOUS ENGINE EVALUATION ]                                                                |
|  3. fraudDetectionService.evaluateTransaction()                                                    |
|     - Reads active rules from MongoDB: fraud_rules                                                 |
|     - Computes risk score (0 to 100)                                                               |
|                                                                                                    |
|  [ MongoDB DATABASE ]                                                                              |
|  4. Persists assessment:                                                                           |
|     -> INSERT INTO transaction_risk_assessments (transactionId: 1520, ...)                         |
|     If score >= 60 (HIGH or CRITICAL):                                                             |
|     -> INSERT INTO fraud_alerts (transactionId: 1520, ...)                                         |
|                                                                                                    |
|  [ DASHBOARD HYDRATION ]                                                                           |
|  5. fraudDashboardService.js (listAlerts / getAlertDetails)                                        |
|     - Fetches alert documents from MongoDB fraud_alerts                                            |
|     - Hydrates live banking details from MySQL: WHERE transaction_id IN (...) (Zero N+1)           |
|     - Resilient Fallback: If MySQL row was purged/archived, recovers snapshot details from        |
|       MongoDB transaction_risk_assessments                                                         |
+----------------------------------------------------------------------------------------------------+
```

### Distinction of Cross-Database References:
1. **Physical MySQL Foreign Keys:** Enforced strictly by InnoDB engine constraints (`RESTRICT`, `CASCADE`, `SET NULL`). Guaranteed at disk write time.
2. **Logical Cross-Database References (MySQL $\longleftrightarrow$ MongoDB):**
   - MongoDB documents store plain scalar numbers (`transactionId`, `customerId`, `accountId`, `assignedEmployeeId`) matching the primary keys of MySQL tables.
   - **No foreign key constraints can exist between MySQL and MongoDB**; data consistency is maintained programmatically by the outbox worker and dashboard hydration services.
3. **Intra-MongoDB Relationships:**
   - `fraud_investigations.alertId` references `fraud_alerts._id` (enforced by application state machine and indexed via unique sparse index).
   - `fraud_alerts.transactionId` references `transaction_risk_assessments.transactionId` (1:1 logical relationship).

---

## 11. Recommended ER Diagram Scope

To ensure academic and professional accuracy for the **DBMS Level 3 project submission**, entities must be partitioned appropriately:

```
+----------------------------------------------------------------------------------------------------+
|                                    RECOMMENDED ER DIAGRAM SCOPE                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ PRIMARY ER DIAGRAM: Core Banking Business Domain ]                                              |
|  Includes the 5 fundamental business entities:                                                     |
|                                                                                                    |
|     +-------------+         (1:1)         +---------------+                                        |
|     |    users    |-----------------------|   customers   |                                        |
|     +-------------+                       +---------------+                                        |
|          |    |                                   |                                                |
|    (1:1) |    | (1:N Performed By)                | (1:N Owns)                                     |
|          |    |                                   |                                                |
|     +-------------+                       +---------------+                                        |
|     |  employees  |                       |   accounts    |                                        |
|     +-------------+                       +---------------+                                        |
|                                               |       |                                            |
|                                     (1:N Src) |       | (1:N Dest)                                 |
|                                               v       v                                            |
|                                         +-------------------+                                      |
|                                         | bank_transactions |                                      |
|                                         +-------------------+                                      |
|                                                                                                    |
|  [ SUPPLEMENTARY / ARCHITECTURAL DIAGRAM: Infrastructure & Auditing ]                             |
|  Covers system resilience and logging:                                                             |
|                                                                                                    |
|     +-------------+         (1:N)         +---------------+                                        |
|     |    users    |-----------------------|  audit_logs   |                                        |
|     +-------------+                       +---------------+                                        |
|                                                                                                    |
|     +-------------------+   (1:1)         +---------------------+                                  |
|     | bank_transactions |-----------------| fraud_outbox_events |                                  |
|     +-------------------+                 +---------------------+                                  |
|                                                                                                    |
|  [ EXCLUDED FROM RELATIONAL ER DIAGRAM ]                                                           |
|  - MongoDB Collections: transaction_risk_assessments, fraud_alerts, fraud_rules,                   |
|    fraud_investigations. (Must NOT be drawn as relational SQL entities; they belong to a separate  |
|    Document Store / NoSQL schema specification).                                                   |
+----------------------------------------------------------------------------------------------------+
```

### Recommendations:
1. **Primary Business ER Diagram:** Present `users`, `customers`, `employees`, `accounts`, and `bank_transactions`. This captures the complete business domain required by core banking standards.
2. **Infrastructure / Relational Schema Diagram:** Include `audit_logs` and `fraud_outbox_events` alongside the 5 core tables when presenting the physical DDL relational schema.
3. **MongoDB Document Models:** Model separately using document schema diagrams or JSON Schema specifications.

---

## 12. Schema Discrepancies and Unresolved Questions

A line-by-line comparison between [`database/schema.sql`](file:///c:/se%20mini%20project/Bank-Management-System/database/schema.sql) and the live MySQL instance confirmed **100% schema parity**. All tables, column types, default values, check constraints, foreign keys, and indexes match.

### Observations & Clarifications:
1. **Outbox Deletion Rule Refinement (`ON DELETE RESTRICT`):**
   - In earlier draft specifications, `fraud_outbox_events.transaction_id` had `ON DELETE CASCADE`.
   - In the live database and [`database/schema.sql`](file:///c:/se%20mini%20project/Bank-Management-System/database/schema.sql#L198-L201), it is configured as `ON DELETE RESTRICT`.
   - *Impact:* Deleting a `bank_transactions` ledger entry is strictly prevented by MySQL if an outbox record references it. This satisfies financial audit retention requirements.
2. **Account Balances Materialization vs. Pure Ledger Calculation:**
   - In pure double-entry bookkeeping, an account balance is strictly derived by summing all ledger transactions.
   - In this implementation, `accounts.balance` is stored directly as `DECIMAL(15,2)` and protected with `chk_account_balance CHECK (balance >= 0.00)`.
   - *Recommendation for ER Submission:* Document `accounts.balance` as a **materialized derived attribute** maintained atomically by transactional operations.
3. **Admin User Profile:**
   - System administrators exist as rows in `users` with `role = 'ADMIN'`, but have no corresponding rows in `customers` or `employees`. There is no dedicated `admins` table.
4. **Polymorphic Reference in `audit_logs`:**
   - `audit_logs` tracks `target_entity_type` and `target_entity_id` as generic text fields without SQL foreign keys to allow referencing multiple entity types (including MongoDB ObjectIds).

---

## Summary of Database Inventory

| Category | Discovered Count | Details |
|---|:---:|---|
| **MySQL Tables** | **7** | `users`, `customers`, `employees`, `accounts`, `bank_transactions`, `audit_logs`, `fraud_outbox_events` |
| **MongoDB Collections** | **4** | `transaction_risk_assessments`, `fraud_alerts`, `fraud_rules`, `fraud_investigations` |
| **MySQL Primary Keys** | **7** | `BIGINT AUTO_INCREMENT` on every MySQL table (`user_id`, `customer_id`, `employee_id`, `account_id`, `transaction_id`, `audit_id`, `event_id`) |
| **MySQL Foreign Key Constraints** | **8** | `fk_customers_user`, `fk_employees_user`, `fk_accounts_customer`, `fk_txn_source_account`, `fk_txn_destination_account`, `fk_txn_performed_by`, `fk_audit_actor`, `fk_outbox_transaction` |
| **MySQL Check Constraints** | **3** | `chk_account_balance` (accounts), `chk_transaction_amount` (bank_transactions), `chk_transaction_type_accounts` (bank_transactions) |
| **MySQL Unique Constraints** | **6** | `users.username`, `customers.user_id`, `employees.user_id`, `accounts.account_number`, `bank_transactions.transaction_ref`, `fraud_outbox_events.transaction_id` |
| **Relational Relationships** | **8** | Three 1:1 relationships (`users-customers`, `users-employees`, `bank_transactions-fraud_outbox`), Five 1:N relationships (`customers-accounts`, `accounts-bank_transactions[src]`, `accounts-bank_transactions[dest]`, `users-bank_transactions`, `users-audit_logs`) |
| **Associative Entities ($M:N$)** | **0** | No many-to-many junction tables exist in the schema |
| **Cross-Database Logical Links** | **6** | Logical references from MongoDB to MySQL: `transactionId` (assessments, alerts, investigations), `customerId` (assessments, alerts), `accountId` (assessments, alerts), `assignedEmployeeId` (investigations) |

