# Software Test Plan

## Bank Management System with Rule-Driven Fraud Detection

| Item | Details |
|---|---|
| Document | Software Test Plan |
| Project | Bank Management System with MongoDB-Based Rule-Driven Fraud Detection |
| Phase | Formal Testing, Verification & Validation |
| Version | 1.3 |
| Date | 08 November 2026 |
| Standard followed | IEEE Std 829-2008 structure, aligned with ISO/IEC/IEEE 29119-3 |
| Related documents | [SRS](SRS.md), [Architecture & Design Specification](architecture_design.md), [Test Cases](test_cases.md), [RTM](rtm.md) |

### Revision History

| Version | Date | Description | Author |
|---|---|---|---|
| 1.0 | 29 Sep 2026 | Baseline IEEE-style Software Test Plan for Phase 1 requirements. All test cases in planned/Not Executed state. | Quality Assurance Team |
| 1.1 | 21 Oct 2026 | Technology stack alignment with React/Vite, Node.js/Express, and MySQL InnoDB; corrected Section 4.12 review cross-references. | Quality Assurance Team |
| 1.2 | 22 Oct 2026 | Task/Issue #13: Test plan execution tracking and RTM alignment following application scaffold (Issue #15) and user authentication (Issue #5). Recorded actual results for 26 automated backend tests, frontend build/lint verification, and manual browser testing. | Quality Assurance Team |
| 1.3 | 08 Nov 2026 | Major revision for formal testing phase. Expanded test plan scope to encompass the entire dual-datastore system (MySQL InnoDB and MongoDB 6/7), rule-driven fraud detection engine, asynchronous transactional outbox worker, customer data isolation, employee administration, and report exports. Synchronized with 28 automated integration test suites comprising 630 automated test cases in `backend/tests/`. Established standalone [Test Case Specification](test_cases.md) (TC-01 through TC-46), resolved historical test status contradictions, verified security checks SV-01 through SV-10, and updated requirement traceability. Explicitly clarified fraud classifications as post-transaction analytical risk assessments. | Quality Assurance Team |

> **Current Implementation & Execution State:**  
> The Bank Management System and its MongoDB-based fraud detection subsystem are fully implemented. The test harness consists of **28 automated integration test suites** containing **630 automated test cases** executed via the native Node.js test runner (`node --test --test-concurrency=1`). All 630 automated backend tests pass with a 100% success rate. Code and branch coverage is measured using native Node.js v24 coverage tooling (`--experimental-test-coverage`). Frontend code quality is verified via static analysis (`oxlint`) and bundle compilation (`vite build`), while role-specific UI navigation is validated through structured manual browser walkthroughs (`TC-21`). Detailed individual test specifications are formalized in the dedicated [Test Case Specification](test_cases.md).

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Test Items](#2-test-items)
3. [Features to be Tested](#3-features-to-be-tested)
4. [Test Approach](#4-test-approach)
5. [Test Environment and Security Validation](#5-test-environment-and-security-validation)
6. [Entry and Exit Criteria](#6-entry-and-exit-criteria)
7. [Test Deliverables](#7-test-deliverables)
8. [Test Cases & Master Summary](#8-test-cases--master-summary)
9. [Test Traceability Matrix](#9-test-traceability-matrix)
10. [Roles, Schedule and Risks](#10-roles-schedule-and-risks)

---

## 1. Introduction

### 1.1 Purpose
This software test plan prescribes the scope, approach, environment, security checks, test case catalog, and traceability for the formal testing phase of the **Bank Management System with MongoDB-Based Rule-Driven Fraud Detection**. It ensures that every requirement defined in the [Software Requirements Specification](SRS.md) and all design commitments in the [Architecture and Design Specification](architecture_design.md) are rigorously verified across the dual-datastore architecture before final system demonstration and release.

### 1.2 Scope
Testing encompasses:
- Exactly 25 Functional Requirements (`FR-01` to `FR-25`) defined in [SRS Section 3](SRS.md#3-functional-requirements).
- Exactly 18 Non-Functional Requirements (`NFR-01` to `NFR-18`) defined in [SRS Section 4](SRS.md#4-non-functional-requirements).
- Five fraud monitoring and investigation use cases (`UC-27` to `UC-31`) defined in [Actors and Use Cases](actors_usecases.md).
- Three authorized actor roles: **Customer**, **Bank Employee**, and **Administrator**.
- Dual-datastore persistence spanning MySQL InnoDB relational storage (user credentials, accounts, financial ledger, outbox) and MongoDB document storage (fraud rules, risk assessments, alerts, investigations).

Testing is performed in a controlled local test environment using synthesized test data. Out-of-scope features (UPI, credit/debit card processing, third-party payment gateways, loans, multi-currency foreign exchange, and automated frontend UI browser automation) are excluded from the test harness.

### 1.3 Objectives
1. **Requirements Verification:** Verify that every functional requirement behaves in exact compliance with its acceptance criteria across all three actor roles.
2. **Security & Data Isolation:** Verify that authentication, role-based authorization, customer horizontal data isolation (IDOR defense), and bcrypt password hashing protect system assets (`SO-01` to `SO-04`, `SV-01` to `SV-10`).
3. **Financial Ledger ACID Integrity:** Verify that cash deposits, cash withdrawals, and customer fund transfers maintain zero-sum conservation, atomic commit/rollback behavior, and strict row-level locking.
4. **Fraud Analytics Decoupling:** Verify that the asynchronous outbox worker polls and claims events via `SKIP LOCKED`, executes 4 fraud detection rules (`HIGH_AMOUNT`, `HIGH_VELOCITY`, `NEW_BENEFICIARY`, `UNUSUAL_HOUR`), and records analytical assessments in MongoDB without blocking or rolling back banking ledger transactions.
5. **Investigation Lifecycle & Rule Reconfiguration:** Verify that administrators can dynamically adjust rule thresholds, inspect risk scores, and transition investigation statuses across the state machine.
6. **Defect Tracking & Comprehensive Traceability:** Maintain 100% bidirectional traceability from requirements to automated test suites in the [RTM](rtm.md).

### 1.4 References
1. IEEE Std 829-2008, *IEEE Standard for Software and System Test Documentation*.
2. ISO/IEC/IEEE 29119-3:2021, *Software and systems engineering — Software testing — Part 3: Test documentation*.
3. [Software Requirements Specification (SRS)](SRS.md)
4. [Software Architecture and Design Specification (SAD)](architecture_design.md)
5. [Actors and Use Cases](actors_usecases.md)
6. [Test Case Specification](test_cases.md)
7. [Requirement Traceability Matrix (RTM)](rtm.md)
8. [Feasibility Study](feasibility_study.md)

### 1.5 Definitions

| Term | Definition in this Project |
|---|---|
| **Analytical Assessment Decoupling** | Architectural separation where fraud detection runs asynchronously post-transaction; assessment statuses (`APPROVED`, `REVIEW_REQUIRED`, `FLAGGED`) are risk classifications for monitoring and do not block banking transactions. |
| **Transactional Outbox** | A design pattern where financial ledger updates and outgoing fraud evaluation events are committed atomically inside the same MySQL database transaction. |
| **Worker Leasing** | Distributed locking mechanism using `FOR UPDATE SKIP LOCKED`, assigning a 60-second processing lease with 20-second heartbeat renewal to eliminate duplicate processing. |
| **Integer Paise Precision** | Representing currency amounts in integer paise (1 INR = 100 paise) to eliminate IEEE 754 floating-point rounding errors during threshold comparisons. |
| **Sliding Window** | Dynamic time-window evaluation (e.g. 60 minutes) counting all transactions on an account up to the exact millisecond of the current transaction. |
| **Horizontal Data Isolation** | Enforcing customer ownership checks so Customer A cannot view, query, or transact upon Customer B's accounts or records (IDOR defense). |
| **Test Case (TC)** | A structured specification containing unique ID, requirement mappings, preconditions, inputs, steps, expected results, and actual execution evidence. |

---

## 2. Test Items

Test items represent the logical and physical modules of the Bank Management System, as defined in [Architecture Specification Section 4](architecture_design.md#4-component-architecture).

| Test Item | Component & Technology | Target Requirements | Target Test Cases |
|---|---|---|---|
| **Web User Interface** | React 18 SPA built with Vite; role-adapted views | NFR-11, NFR-12, NFR-13 | TC-21 |
| **Authentication & Session** | Node.js Express service, bcrypt, MySQL session store | FR-01, FR-02, FR-03, FR-22, NFR-01, NFR-02, NFR-05 | TC-01, TC-02, TC-03, TC-09, TC-13, TC-17 |
| **Customer Administration** | Customer Service, atomic user-customer transactions | FR-04, FR-05, FR-06 | TC-04, TC-20 |
| **Customer Data Isolation** | Horizontal authorization middleware, ownership verification | NFR-01, NFR-03 | TC-16, TC-22, TC-23, TC-27 |
| **Account Management** | Account Service, account number generator, status engine | FR-07, FR-08, FR-09, FR-10, FR-11 | TC-08, TC-14, TC-22, TC-30 |
| **Cash Operations** | Transaction Service (cash deposits and withdrawals) | FR-11, FR-12, FR-13, FR-14, FR-18, FR-19 | TC-05, TC-06, TC-15, TC-26 |
| **Fund Transfers** | Transaction Service, two-phase balance update, beneficiary checks | FR-15, FR-16, FR-17, FR-18, FR-19, NFR-08, NFR-10 | TC-07, TC-10, TC-24 |
| **History & Statements** | Transaction query service, date filtering, pagination | FR-19, FR-20, FR-21 | TC-16, TC-19, TC-25 |
| **Employee Administration** | Employee Service, CRUD, immediate session revocation | FR-23, FR-24, NFR-02 | TC-18, TC-29 |
| **Administrative Reporting** | Reporting Service, SQL aggregations, RFC 4180 CSV export | FR-25, NFR-03, NFR-06 | TC-11, TC-19, TC-31, TC-32 |
| **Audit Trail Logging** | Centralized audit logger, append-only MySQL storage | NFR-02, NFR-03 | TC-28, TC-29 |
| **MongoDB Foundation** | MongoDB collections, JSON Schema validators, compound indexes | UC-27 to UC-31 | TC-33 |
| **Fraud Detection Engine** | 4 analytical rules, paise evaluation, risk scoring (0–100) | UC-27, UC-28, UC-30, NFR-08 | TC-34, TC-35, TC-36, TC-37, TC-38 |
| **Transactional Outbox Worker** | Asynchronous polling worker, `SKIP LOCKED`, heartbeat, retries | UC-27, NFR-09 | TC-39, TC-40, TC-41 |
| **Fraud Dashboard & Cases** | Fraud monitoring API, alert policy, case state machine | UC-27, UC-29, UC-30, UC-31 | TC-42, TC-43, TC-44, TC-45 |
| **End-to-End Pipeline** | Banking-to-fraud integration regression harness | All FRs, UC-27 to UC-31 | TC-46 |

---

## 3. Features to be Tested

### 3.1 Functional Features

| Feature Domain | Requirements | Scope & Verification Highlights | Primary Test Cases |
|---|---|---|---|
| **User Authentication** | FR-01, FR-02, FR-03 | Login for 3 roles, session cookie establishment, logout invalidation, RBAC middleware | TC-01, TC-02, TC-03, TC-13 |
| **Customer Profile Management** | FR-04, FR-05, FR-06 | Customer registration, unique customer ID, profile search, permitted updates | TC-04, TC-20 |
| **Account Lifecycle** | FR-07, FR-08, FR-09, FR-10 | Account opening (SAVINGS/CURRENT), unique number generation, status toggling | TC-08, TC-14, TC-22, TC-30 |
| **Status Restrictions** | FR-10, FR-11 | Preventing deposits, withdrawals, and transfers on FROZEN or INACTIVE accounts | TC-08, TC-22 |
| **Cash Ledger Operations** | FR-12, FR-13, FR-14 | Cash deposits, cash withdrawals, overdraft rejection, zero-balance boundary | TC-05, TC-06, TC-15, TC-26 |
| **Customer Fund Transfers** | FR-15, FR-16, FR-17 | Two-phase balance update, beneficiary masking, self-transfer block, balance checks | TC-07, TC-24 |
| **Ledger Records & Receipts** | FR-18, FR-19 | Unique transaction references (`TXN-...`), append-only ledger, digital receipts | TC-05, TC-07, TC-15, TC-26 |
| **Customer Statements & History** | FR-20 | Chronological history, descending order, monthly statement calculation | TC-16, TC-25 |
| **Global Transaction Audit** | FR-21 | Multi-parameter transaction ledger query for employees and administrators | TC-19 |
| **Password Management** | FR-22 | Self-service password modification (scheduled) and profile password update | TC-17 |
| **Employee Staff Management** | FR-23, FR-24 | Staff creation, role assignment, deactivation, and immediate session termination | TC-18, TC-29 |
| **Administrative Reports** | FR-25 | Overview metrics, customer distribution, transaction sums, RFC 4180 CSV export | TC-11, TC-19, TC-31, TC-32 |
| **Fraud Alert Monitoring** | UC-27 | 100% alert generation policy for triggered rules, alert hydration, severity tagging | TC-39, TC-42 |
| **Risk Assessment Review** | UC-28 | Post-transaction analytical risk classification (`APPROVED`, `REVIEW_REQUIRED`, `FLAGGED`) | TC-38 |
| **Fraud Investigation Workflow** | UC-29 | Investigation lifecycle (`UNDER_INVESTIGATION` $	o$ `CONFIRMED_FRAUD` / `FALSE_POSITIVE`) | TC-43 |
| **Fraud Rule Configuration** | UC-30 | Dynamic rule enabling/disabling, threshold and weight updates with schema validation | TC-44 |
| **Fraud Analytics Dashboard** | UC-31 | Real-time statistics aggregation, risk distribution, alert breakdown across date windows | TC-45 |

### 3.2 Non-Functional Features

| Feature Domain | Requirements | Scope & Verification Highlights | Primary Test Cases / Reviews |
|---|---|---|---|
| **Password Security** | NFR-01 | Bcrypt salted hashes (cost 10), unique salts, no plain-text in DB, logs, or responses | TC-09, TC-17 |
| **Role-Based Access Control** | NFR-02 | Route-level middleware intercepts unauthorized actions with HTTP 403 `AUTH_002` | TC-03, TC-18, TC-28 |
| **Data Access Isolation** | NFR-03 | Customer horizontal isolation (IDOR defense); staff/admin endpoint protection | TC-16, TC-20, TC-23, TC-27 |
| **Server-Side Input Validation** | NFR-04, NFR-18 | Rejection of negative amounts, >2 decimals, invalid formats, SQLi payloads | TC-04, TC-12, TC-14 |
| **Pre-Operation Authentication** | NFR-05 | Rejection of unauthenticated requests with HTTP 401 `AUTH_003` | TC-01, TC-03, TC-13 |
| **System Performance** | NFR-06, NFR-07 | SQL aggregation query execution under 25ms; SLA compliance benchmarking | TC-11, TC-19 |
| **Ledger Consistency** | NFR-08, NFR-17 | Zero-sum conservation across transfers; balance equals opening + credits - debits | TC-07, TC-10, TC-25 |
| **Transaction Atomicity** | NFR-09 | Full InnoDB rollback on mid-transaction failure; atomic outbox event staging | TC-10, TC-39 |
| **Audit Ledger Accuracy** | NFR-10 | Append-only immutability; exactly one record per cash event, two per transfer | TC-05, TC-07, TC-15, TC-28 |
| **Role-Specific Navigation** | NFR-11, NFR-13 | Role-adapted navigation menus; core actions accessible within $\le$ 3 clicks | TC-21 (Manual UI Walkthrough) |
| **Safe Error Reporting** | NFR-12 | Standardized JSON envelopes (`AUTH_xxx`, `VAL_xxx`, `TXN_xxx`) without stack traces | TC-02, TC-06, TC-12 |
| **Architecture & Code Quality** | NFR-14, NFR-15 | Modular service layers, consistent naming, JSDoc annotations, Oxlint compliance | REV-01, REV-02 |
| **Unique Identifiers** | NFR-16 | Collision-resistant formatting for accounts (`ACC-...`) and transactions (`TXN-...`) | TC-04, TC-14, TC-18, REV-03 |

### 3.3 Features Not to be Tested

| Feature | Justification |
|---|---|
| **External Payment Gateways & UPI** | Out of project scope as an internal core banking prototype ([SRS Section 1.2](SRS.md#12-scope)). |
| **Credit Cards, Loans & Forex** | Deferred to subsequent development phases. |
| **High-Volume Multi-Node Concurrency** | Prototype runs on local single-node instance; high-throughput distributed stress testing is excluded. |
| **Automated Frontend UI Browser Automation** | `frontend/package.json` contains no browser automation framework (e.g. Playwright or Cypress); UI verification is performed via static analysis (`oxlint`), bundle checks (`vite build`), and structured manual browser walkthroughs (`TC-21`). |

---

## 4. Test Approach

Testing follows a layered, automated-first verification approach across the React frontend, Node.js/Express backend API, MySQL relational database, and MongoDB document store.

### 4.1 Frontend Testing (React with Vite)
- **Static Analysis & Linting:** Executed via `npm run lint` (`oxlint`) across all React components, verifying syntax, prop types, unused variables, and code hygiene.
- **Bundle Compilation:** Executed via `npm run build` (`vite build`), confirming error-free TypeScript/JSX compilation, asset resolution, and tree-shaking.
- **Manual UI Walkthroughs:** Structured manual verification ([TC-21](test_cases.md#tc-21--role-specific-ui-navigation--accessibility)) validating that the navigation bar dynamically renders role-specific menus, isolates unauthorized views, and delivers primary actions within $\le$ 3 clicks.
- *Note:* Automated UI testing (Vitest / Playwright) is not configured in the repository; documentation strictly avoids claiming automated frontend UI execution.

### 4.2 Backend & REST API Testing (Node.js with Express)
- **Test Harness:** Built on Node.js native test runner (`node:test`) and Supertest (`^7.0.0`), running with `--test-concurrency=1` to guarantee isolated test execution without cross-test database collisions.
- **Code Coverage:** Measured via Node.js v24 native coverage tooling (`node --test --experimental-test-coverage`), providing file-by-file line and branch coverage metrics.
- **Integration Test Execution:** 28 automated integration test suites verify endpoints across HTTP status codes, structured response envelopes, and session cookie lifecycle.

### 4.3 Database Interaction & Persistence Testing (MySQL & MongoDB)
- **MySQL InnoDB Engine:** Verifies parameterized SQL queries, foreign key constraints, `CHECK (balance >= 0)` constraints, and row-level locking (`SELECT ... FOR UPDATE`).
- **MongoDB Document Engine:** Verifies schema validation (BSON types, required fields, enum boundaries), compound indexes for fast filtering, and MongoDB aggregation pipelines.

### 4.4 Authorization, Privilege Boundaries & Data Isolation
- **Role Barriers:** Verifies that Express middleware (`requireAuth`, `requireRole`) intercepts unauthorized role attempts with HTTP 403 `AUTH_002` across Customer, Employee, and Administrator boundaries.
- **Horizontal Data Isolation (IDOR Defense):** Dedicated test suite (`customerAccountIsolation.test.js`) verifies that customers cannot query or transact upon other customers' accounts.
- **Diagnostics Restriction:** Dedicated tests (`customerProfileSecurity.test.js`) verify that internal diagnostic routes (`/api/health/system`, `/api/diagnostics`) are accessible strictly to Administrators.

### 4.5 Financial Ledger Integrity & ACID Concurrency
- **Atomicity & Consistency:** Deposits, withdrawals, and transfers commit ledger records and balance changes atomically inside a single database transaction. Mid-transaction failures trigger clean rollbacks ([TC-10](test_cases.md#tc-10--failed-transaction-atomicity--rollback-guarantees)).
- **Deadlock Prevention:** Multi-account transfers sort account IDs in ascending alphanumeric order before acquiring row locks (`SELECT ... FOR UPDATE`), eliminating circular lock deadlocks.

### 4.6 Asynchronous Outbox Worker & Distributed Leasing Testing
- **Atomic Outbox Staging:** Verifies that banking transactions atomically insert an event into the MySQL `fraud_outbox` table in the same transaction as the ledger record ([TC-39](test_cases.md#tc-39--transactional-outbox-atomic-staging--mysql-state-preservation)).
- **Distributed Leasing:** Tests verify that the worker claims batches using `FOR UPDATE SKIP LOCKED`, sets a 60-second lease, periodically issues 20-second heartbeat updates, and reclaims stale abandoned leases ([TC-40](test_cases.md#tc-40--outbox-polling-worker-leasing-heartbeat--stale-recovery)).
- **Exponential Retry Backoff:** Verifies that transient failures increment retry count, apply exponential backoff delays, and transition events to `FAILED` with captured diagnostics upon reaching max retries ([TC-41](test_cases.md#tc-41--outbox-worker-exponential-retry-backoff--failure-capture)).

### 4.7 Rule-Driven Fraud Detection Engine & Analytical Risk Assessment Testing
- **Rule Verification:** Verifies all 4 analytical rules:
  1. `HIGH_AMOUNT`: Strict inequality (`amount > threshold_paise`) using integer paise precision ([TC-34](test_cases.md#tc-34--fraud-detection-rule-engine-high_amount-evaluation)).
  2. `HIGH_VELOCITY`: Sliding-window counting across all debits and credits on the account ([TC-35](test_cases.md#tc-35--fraud-detection-rule-engine-high_velocity-evaluation)).
  3. `NEW_BENEFICIARY`: Zero prior completed transfers to recipient account ([TC-36](test_cases.md#tc-36--fraud-detection-rule-engine-new_beneficiary-evaluation)).
  4. `UNUSUAL_HOUR`: Localized Asia/Kolkata timezone night-window evaluation (default 23:00–06:00) ([TC-37](test_cases.md#tc-37--fraud-detection-rule-engine-unusual_hour-evaluation)).
- **Analytical Assessment Decoupling:** Verifies that risk scores (0–100) and classifications (`APPROVED`, `REVIEW_REQUIRED`, `FLAGGED`) are recorded in MongoDB as post-transaction analytical assessments and do not alter or reverse banking transactions ([TC-38](test_cases.md#tc-38--fraud-risk-scoring-weight-calibration--analytical-classification)).

### 4.8 Fraud Case Management & Dashboard Analytics Testing
- **Alert Generation Guarantee:** Verifies that 100% of transactions triggering rules produce open alerts in MongoDB ([TC-42](test_cases.md#tc-42--fraud-alert-generation-policy-guarantee)).
- **Investigation State Machine:** Verifies case lifecycle transitions (`UNDER_INVESTIGATION` $	o$ `CONFIRMED_FRAUD` / `FALSE_POSITIVE` / `RESOLVED_NO_ACTION`) and audit notes ([TC-43](test_cases.md#tc-43--fraud-investigation-lifecycle-management--state-machine)).
- **Dynamic Rule Reconfiguration:** Verifies administrative updating of rule thresholds, weights, and enabled flags with input schema validation ([TC-44](test_cases.md#tc-44--fraud-dynamic-rule-configuration--threshold-management)).
- **Analytics Aggregations:** Verifies dashboard metric calculations matching MongoDB document pipelines ([TC-45](test_cases.md#tc-45--fraud-analytics--aggregations-dashboard)).

### 4.9 Integration & End-to-End Regression Testing
- **Cross-Subsystem Pipeline:** Comprehensive 12-point end-to-end regression test suite (`tests/fraudRegressionDebugging.test.js`, [TC-46](test_cases.md#tc-46--end-to-end-banking-to-fraud-integration-regression)) validating the complete flow: Login $	o$ High-value transfer $	o$ MySQL balance debit/credit $	o$ Outbox row staged $	o$ Worker polls $	o$ Rule engine evaluation $	o$ MongoDB assessment/alert created $	o$ Dashboard analytics updated $	o$ Administrator manages case.

### 4.10 Code Reviews & Architectural Inspections

| Review ID | Target Scope | Focus Area | Status | Evidence |
|---|---|---|---|---|
| **REV-01** | Modular Architecture | Separation of routing, service, validation, and data access layers | **Passed** | Verified against [Architecture Specification](architecture_design.md#4-component-architecture); clear controller-service-DAL separation. |
| **REV-02** | Code Quality & Hygiene | Variable naming conventions, error envelopes, Oxlint rules, JSDoc | **Passed** | Verified via `npm run lint` (`oxlint`) with zero syntax or stylistic errors. |
| **REV-03** | Database Schema Integrity | Primary keys, foreign keys, constraints, and MongoDB JSON Schema | **Passed** | Verified via MySQL schema inspection and `mongoFoundation.test.js`. |

---

## 5. Test Environment and Security Validation

**Physical & Software Test Environment**

| Environment Parameter | Specification |
|---|---|
| **Client / Browser** | Google Chrome (latest), Mozilla Firefox (latest), Microsoft Edge (latest) |
| **Application Runtime** | Node.js v24.16.0 (supporting native test runner and `--experimental-test-coverage`) |
| **Relational Datastore** | MySQL Community Edition 8.x (InnoDB engine with ACID transaction isolation) on port 3306 |
| **Document Datastore** | MongoDB 6.x / 7.x Community Edition (supporting JSON Schema validators and compound indexes) on port 27017 |
| **Operating System** | Microsoft Windows 11 / Linux (Ubuntu 22.04 LTS / 24.04 LTS) |
| **Test Libraries** | Native Node.js `node:test`, Supertest `^7.0.0`, Oxlint (frontend linter), Vite 5 (frontend bundler) |

**Baseline Test Data Fixtures**

Before each integration test suite executes, the test database is reset to a deterministic baseline state:

| Fixture ID | Entity Type | Details & Preconditions |
|---|---|---|
| **`C1`** | Customer | Username `test.customer1`; owns **ACC-T1** (Active, balance 10,000.00 INR) and **ACC-T4** (Inactive, balance 1,000.00 INR). |
| **`C2`** | Customer | Username `test.customer2`; owns **ACC-T2** (Active, balance 5,000.00 INR) and **ACC-T3** (Frozen, balance 2,000.00 INR). |
| **`E1`** | Employee | Username `test.employee1`; active staff member with banking permissions. |
| **`E2`** | Employee | Username `test.employee2`; active staff member used for deactivation tests. |
| **`A1`** | Administrator | Username `test.admin1`; active administrator with full administrative access. |
| **Passwords** | Credentials | Standard test password `Password123!` hashed via bcrypt cost 10 (`$2b$10$...`) with unique salts. |
| **Fraud Rules** | MongoDB Rules | 4 baseline rules in `fraud_rules`: HIGH_AMOUNT (threshold 200,000 INR, weight 40), HIGH_VELOCITY (5 tx / 60 min, weight 30), NEW_BENEFICIARY (weight 20), UNUSUAL_HOUR (23:00–06:00, weight 15). |

### 5.1 Security Validation (SV-01 to SV-10)

All 10 security validation checks defined in [SRS Section 5.2](SRS.md#52-security-requirements) have been executed and verified against automated integration test suites:

| Check ID | Security Objective | Validation Method | Expected Result | Requirement | Verifying Test Suite | Status |
|---|---|---|---|---|---|---|
| **SV-01** | Login Authentication | Authenticate valid credentials for Customer, Employee, Admin | HTTP 200, authenticated session cookie issued | FR-01, NFR-05 | `tests/auth.test.js` (Scenario 1) | **Passed** |
| **SV-02** | Invalid Credential Defense | Attempt login with wrong password, bad username, inactive user | Generic HTTP 401 `AUTH_001`, constant-time hashing | FR-01, FR-24, NFR-03, NFR-12 | `tests/auth.test.js` (Scenarios 2–5) | **Passed** |
| **SV-03** | Role-Based Access Control | Attempt cross-role operations across all 3 roles | HTTP 403 `AUTH_002` returned, zero state modification | FR-03, NFR-02 | `tests/auth.test.js`, `tests/employees.test.js`, `tests/transfers.test.js`, `tests/fraudDashboard.test.js` | **Passed** |
| **SV-04** | Unauthenticated Access | Call protected endpoints without valid session cookie | HTTP 401 `AUTH_003` returned | NFR-05, FR-02 | `tests/auth.test.js` (Scenarios 6–10) | **Passed** |
| **SV-05** | Password Storage Security | Inspect database records, responses, and log streams | Salted bcrypt hashes (`$2b$10$...`), zero plain text | NFR-01 | `tests/auth.test.js` (Scenario 12) | **Passed** |
| **SV-06** | Server Input Validation | Submit negative amounts, fractions, invalid dates, SQLi payloads | HTTP 400 `VAL_001` or `TXN_002` returned | NFR-04, NFR-18 | `tests/auth.test.js`, `tests/accounts.test.js`, `tests/transactions.test.js`, `tests/customers.test.js` | **Passed** |
| **SV-07** | Protected Ledger Operations | Attempt deposit, withdrawal, or transfer without session | HTTP 401 `AUTH_003` returned | NFR-05 | `tests/transfers.test.js`, `tests/transactions.test.js` | **Passed** |
| **SV-08** | Account Status Enforcement | Attempt transactions on FROZEN or INACTIVE accounts | HTTP 409 `ACC_001` returned, balances unchanged | FR-11 | `tests/accounts.test.js`, `tests/transactions.test.js` | **Passed** |
| **SV-09** | Horizontal Customer Isolation | Customer A queries or transacts on Customer B's account (IDOR) | HTTP 403 `AUTH_002` returned, zero data leakage | NFR-01, NFR-03 | `tests/customerAccountIsolation.test.js` (25 tests) | **Passed** |
| **SV-10** | Safe Structured Errors | Force validation, auth, and database internal errors | Standardized JSON envelopes, zero stack traces/SQL leaked | NFR-12 | `tests/health.test.js`, `tests/auth.test.js`, `tests/transactions.test.js` | **Passed** |

### 5.2 Data Integrity Validation
Automated database integrity assertions executed across all financial suites confirm:
1. **Conservation of Balance:** In every completed fund transfer, the sender balance decreases by the exact transfer amount, and the recipient balance increases by the exact transfer amount ($\Delta 	ext{Sender} + \Delta 	ext{Receiver} = 0$).
2. **Identifier Uniqueness:** Every account number (`ACC-...`) and transaction reference (`TXN-...`) satisfies global unique database constraints.
3. **Absence of Orphan Records:** When transactions fail or are rejected, zero ledger records, zero partial debits, and zero outbox events persist in the database.

---

## 6. Entry and Exit Criteria

### 6.1 Entry Criteria
Formal testing execution commenced when:
1. SRS, Architecture Specification, and Test Plan were aligned and baselined.
2. MySQL schema migrations and MongoDB collections were initialized with schemas and indexes.
3. Application build and lint checks (`oxlint`, `vite build`) passed with zero errors.
4. Test runner harness and automated integration test suites were configured in `backend/package.json`.

### 6.2 Exit Criteria
The formal testing phase is concluded when:
1. All 46 test cases (`TC-01` to `TC-46`) and architectural code reviews (`REV-01` to `REV-03`) are executed or formally accounted for.
2. All 10 security validation checks (`SV-01` to `SV-10`) pass with automated evidence.
3. Backend automated integration test suite achieves a **100% pass rate** (630 out of 630 automated tests passing).
4. No unresolved Critical or High severity defects exist in the codebase.
5. Bidirectional traceability in the [RTM](rtm.md) maps 100% of functional requirements (`FR-01` to `FR-25`) and non-functional requirements (`NFR-01` to `NFR-18`).

### 6.3 Suspension and Resumption Criteria
- **Suspension:** Testing is suspended if database migration scripts fail, if the MySQL or MongoDB test service becomes unavailable, or if core authentication crashes preventing test session establishment.
- **Resumption:** Testing resumes after database connectivity is restored, baseline fixtures are reseeded, and health check endpoint `GET /api/health` returns HTTP 200 OK.

### 6.4 Defect Severity Classification

| Severity Level | Definition | Impact on Release | Example from Project |
|---|---|---|---|
| **Critical** | Security vulnerability, data loss, balance inconsistency, or crash. | Release Blocker | Balance alteration during a failed transfer; customer IDOR bypass. |
| **High** | Core business workflow failure without a viable workaround. | Release Blocker | Outbox worker fails to claim events; deposit endpoint throws unhandled exception. |
| **Medium** | Functional defect with an available operational workaround. | Review Required | Self-service password change route pending; CSV report column ordering deviation. |
| **Low** | Minor cosmetic defect, formatting inconsistency, or typo. | Non-blocking | Discrepancy in error envelope explanatory text; UI button alignment. |

---

## 7. Test Deliverables

| Deliverable Artifact | Repository Path | Description |
|---|---|---|
| **Software Test Plan** | `docs/phase1/test_plan.md` | Master testing strategy, environment, approach, criteria, and execution directory. |
| **Test Case Specification** | `docs/phase1/test_cases.md` | Authoritative IEEE 829 test case catalog containing detailed specifications for TC-01 to TC-46. |
| **Requirement Traceability Matrix** | `docs/phase1/rtm.md` | Bidirectional mapping between FRs/NFRs, architecture components, test cases, and statuses. |
| **Automated Integration Test Suites** | `backend/tests/*.test.js` | 28 automated integration test suites comprising 630 test cases executed via `node:test`. |
| **Test Execution & Coverage Log** | `docs/phase1/test_execution_report.md` | Formal test run results and Node.js v24 experimental coverage data (prepared post-execution). |

---

## 8. Test Cases & Master Summary

The detailed specifications for all test cases—including preconditions, exact operational steps, test input vectors, expected outcomes, actual empirical execution evidence, and verification methods—are maintained in the dedicated [Test Case Specification](test_cases.md).

The table below summarizes the master directory of all 46 test cases, resolving historical Sprint 1 contradictions and reflecting the actual execution status of the system:

| Test ID | Title | Target Requirements | Verification Method | Automated Test Suite File | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Valid User Login | FR-01, FR-03, NFR-05 | Automated Integration Test | `tests/auth.test.js` | **Passed** |
| **TC-02** | Invalid User Login & Enumeration Defense | FR-01, NFR-03, NFR-12 | Automated Integration Test | `tests/auth.test.js` | **Passed** |
| **TC-03** | Role-Based Access Control | FR-03, NFR-02, NFR-03, NFR-05 | Automated Integration Test | `tests/auth.test.js`, `tests/employees.test.js` | **Passed** |
| **TC-04** | Customer Registration by Staff | FR-04, NFR-01, NFR-04 | Automated Integration Test | `tests/customers.test.js` | **Passed** |
| **TC-05** | Successful Cash Deposit | FR-12, FR-18, FR-19, NFR-10 | Automated Integration Test | `tests/transactions.test.js` | **Passed** |
| **TC-06** | Withdrawal Insufficient Balance Rejection | FR-14, NFR-12 | Automated Integration Test | `tests/transactions.test.js` | **Passed** |
| **TC-07** | Successful Customer Fund Transfer | FR-15, FR-16, FR-17, FR-18, FR-19, NFR-08, NFR-10 | Automated Integration Test | `tests/transfers.test.js`, `tests/secureTransfers.test.js` | **Passed** |
| **TC-08** | Transaction Block on Frozen/Inactive Account | FR-10, FR-11 | Automated Integration Test | `tests/accounts.test.js`, `tests/transactions.test.js` | **Passed** |
| **TC-09** | Password Security & Salted Bcrypt Storage | NFR-01 | Automated & Code Inspection | `tests/auth.test.js` | **Passed** |
| **TC-10** | Failed Transaction Atomicity & Rollback | NFR-09, NFR-17, NFR-12 | Automated Integration Test | `tests/transactions.test.js`, `tests/transfers.test.js` | **Passed** |
| **TC-11** | Reporting Performance & Aggregation SLA | NFR-06, NFR-07 | Automated Benchmark | `tests/reports.test.js` | **Partially Verified** |
| **TC-12** | Server-Side Input Validation & Sanitization | NFR-04, NFR-18 | Automated Integration Test | `tests/auth.test.js`, `tests/accounts.test.js`, `tests/transactions.test.js` | **Passed** |
| **TC-13** | Logout & Session Invalidation | FR-02, NFR-05 | Automated Integration Test | `tests/auth.test.js` | **Passed** |
| **TC-14** | Bank Account Creation with Unique Numbers | FR-07, FR-08, NFR-16 | Automated Integration Test | `tests/accounts.test.js` | **Passed** |
| **TC-15** | Successful Cash Withdrawal & Zero Boundary | FR-13, FR-18, FR-19, NFR-10 | Automated Integration Test | `tests/transactions.test.js` | **Passed** |
| **TC-16** | Customer Account Details & History Access | FR-09, FR-20, NFR-03 | Automated Integration Test | `tests/history.test.js`, `tests/customerOverview.test.js` | **Passed** |
| **TC-17** | Self-Service Customer Password Change | FR-22, NFR-01 | Code Inspection | `tests/customerProfileSecurity.test.js` | **Pending Implementation** |
| **TC-18** | Employee Administration & Session Revocation | FR-23, FR-24, NFR-02 | Automated Integration Test | `tests/employees.test.js` | **Passed** |
| **TC-19** | Global Transaction Ledger Multi-Filtering | FR-21, NFR-03, NFR-06 | Automated Integration Test | `tests/history.test.js`, `tests/reports.test.js` | **Passed** |
| **TC-20** | Customer Information Viewing and Updates | FR-05, FR-06, NFR-02 | Automated Integration Test | `tests/customers.test.js` | **Passed** |
| **TC-21** | Role-Specific UI Navigation Accessibility | NFR-11, NFR-13 | Manual UI Walkthrough | Manual Browser Walkthrough | **Passed (Manual UI Walkthrough)** |
| **TC-22** | Customer Balance Display & Status Clarity | FR-11 | Automated Integration Test | `tests/customerBalanceDisplay.test.js` | **Passed** |
| **TC-23** | Customer Horizontal Data Isolation (IDOR) | NFR-01, NFR-03 | Automated Integration Test | `tests/customerAccountIsolation.test.js` | **Passed** |
| **TC-24** | Beneficiary Masking & Self-Transfer Block | FR-15, FR-16, FR-17 | Automated Integration Test | `tests/secureTransfers.test.js` | **Passed** |
| **TC-25** | Customer Monthly Statement Generation | FR-19, FR-20 | Automated Integration Test | `tests/accountStatements.test.js` | **Passed** |
| **TC-26** | Transaction Digital Receipt Generation | FR-12, FR-13 | Automated Integration Test | `tests/transactionReceipts.test.js` | **Passed** |
| **TC-27** | Customer Profile Security & Diagnostics | NFR-01, NFR-03 | Automated Integration Test | `tests/customerProfileSecurity.test.js` | **Passed** |
| **TC-28** | Centralized Audit Logging & Immutability | NFR-02, NFR-03 | Automated Integration Test | `tests/audit.test.js` | **Passed** |
| **TC-29** | Employee Personal Activity History Isolation | FR-23, NFR-01 | Automated Integration Test | `tests/employeeActivity.test.js` | **Passed** |
| **TC-30** | Employee Banking Operations Console | FR-09, FR-10 | Automated Integration Test | `tests/employeeConsole.test.js` | **Passed** |
| **TC-31** | Administrative Executive Dashboard Metrics | FR-25, NFR-03 | Automated Integration Test | `tests/dashboard.test.js` | **Passed** |
| **TC-32** | Administrative RFC 4180 CSV Export | FR-25, NFR-01 | Automated Integration Test | `tests/reportExports.test.js` | **Passed** |
| **TC-33** | MongoDB Foundation & Schema Validation | UC-27 to UC-31 | Automated Integration Test | `tests/mongoFoundation.test.js` | **Passed** |
| **TC-34** | Fraud Rule: HIGH_AMOUNT (Paise Precision) | UC-27, UC-30 | Automated Integration Test | `tests/fraudEngine.test.js`, `tests/fraudPipelineBugInvestigation.test.js` | **Passed** |
| **TC-35** | Fraud Rule: HIGH_VELOCITY (Sliding Window) | UC-27, UC-30 | Automated Integration Test | `tests/fraudEngine.test.js`, `tests/fraudPipelineBugInvestigation.test.js` | **Passed** |
| **TC-36** | Fraud Rule: NEW_BENEFICIARY Evaluation | UC-27, UC-30 | Automated Integration Test | `tests/fraudEngine.test.js` | **Passed** |
| **TC-37** | Fraud Rule: UNUSUAL_HOUR (Timezone Night) | UC-27, UC-30 | Automated Integration Test | `tests/fraudEngine.test.js` | **Passed** |
| **TC-38** | Fraud Risk Scoring & Analytical Classification | UC-28, NFR-08 | Automated Integration Test | `tests/fraudEngine.test.js` | **Passed** |
| **TC-39** | Outbox Event Staging & MySQL Atomicity | UC-27, NFR-09 | Automated Integration Test | `tests/fraudOutboxIntegration.test.js` | **Passed** |
| **TC-40** | Outbox Worker Leasing (`SKIP LOCKED`) | UC-27, NFR-09 | Automated Integration Test | `tests/fraudOutboxIntegration.test.js` | **Passed** |
| **TC-41** | Outbox Worker Retry Backoff & Failure DLQ | UC-27, NFR-09 | Automated Integration Test | `tests/fraudOutboxIntegration.test.js` | **Passed** |
| **TC-42** | Fraud Alert 100% Generation Policy | UC-27 | Automated Integration Test | `tests/fraudAlertPolicyCorrection.test.js` | **Passed** |
| **TC-43** | Fraud Investigation State Machine & Notes | UC-29 | Automated Integration Test | `tests/fraudDashboard.test.js` | **Passed** |
| **TC-44** | Fraud Dynamic Rule Configuration & RBAC | UC-30 | Automated Integration Test | `tests/fraudDashboard.test.js` | **Passed** |
| **TC-45** | Fraud Analytics & Aggregations Dashboard | UC-31 | Automated Integration Test | `tests/fraudDashboard.test.js` | **Passed** |
| **TC-46** | End-to-End Banking-to-Fraud Integration | All FRs, UC-27 to UC-31 | Automated Integration Test | `tests/fraudRegressionDebugging.test.js` | **Passed** |

---

## 9. Test Traceability Matrix

Verification Types: **T** = Automated Test Execution, **I** = Code/Schema Inspection, **A** = Database/Logic Analysis, **D** = Manual UI Walkthrough / Demonstration.

### 9.1 Functional Requirements Traceability (FR-01 to FR-25)

| Requirement ID | Requirement Summary | Target Test Cases | Type | Verifying Test Suite File(s) | Verification Status |
|---|---|---|:---:|---|---|
| **FR-01** | Authenticate user credentials | [TC-01](test_cases.md#tc-01--valid-user-login), [TC-02](test_cases.md#tc-02--invalid-user-login--enumeration-defense) | T | `tests/auth.test.js` | **Passed** |
| **FR-02** | User logout and session invalidation | [TC-13](test_cases.md#tc-13--user-logout-and-immediate-session-invalidation) | T | `tests/auth.test.js` | **Passed** |
| **FR-03** | Role-based feature authorization | [TC-01](test_cases.md#tc-01--valid-user-login), [TC-03](test_cases.md#tc-03--role-based-access-control--privilege-boundaries) | T | `tests/auth.test.js`, `tests/employees.test.js`, `tests/fraudDashboard.test.js` | **Passed** |
| **FR-04** | Customer registration by staff | [TC-04](test_cases.md#tc-04--customer-registration-by-authorized-staff) | T | `tests/customers.test.js` | **Passed** |
| **FR-05** | View customer details and records | [TC-20](test_cases.md#tc-20--customer-information-viewing-and-profile-modification) | T | `tests/customers.test.js` | **Passed** |
| **FR-06** | Update customer profile details | [TC-20](test_cases.md#tc-20--customer-information-viewing-and-profile-modification) | T | `tests/customers.test.js` | **Passed** |
| **FR-07** | Create new bank account | [TC-14](test_cases.md#tc-14--bank-account-creation-with-unique-account-numbers) | T | `tests/accounts.test.js` | **Passed** |
| **FR-08** | Generate unique account numbers | [TC-14](test_cases.md#tc-14--bank-account-creation-with-unique-account-numbers) | T, A | `tests/accounts.test.js` | **Passed** |
| **FR-09** | View account details and balance | [TC-16](test_cases.md#tc-16--customer-account-details-and-history-retrieval), [TC-22](test_cases.md#tc-22--customer-account-balance-display--status-clarity), [TC-30](test_cases.md#tc-30--employee-banking-operations-console) | T | `tests/customerOverview.test.js`, `tests/accounts.test.js`, `tests/employeeConsole.test.js` | **Passed** |
| **FR-10** | Manage account status (Active/Frozen/Inactive) | [TC-08](test_cases.md#tc-08--transaction-prevention-on-frozen-or-inactive-accounts), [TC-30](test_cases.md#tc-30--employee-banking-operations-console) | T | `tests/accounts.test.js`, `tests/employeeConsole.test.js` | **Passed** |
| **FR-11** | Block transactions on frozen/inactive accounts | [TC-08](test_cases.md#tc-08--transaction-prevention-on-frozen-or-inactive-accounts), [TC-22](test_cases.md#tc-22--customer-account-balance-display--status-clarity) | T | `tests/accounts.test.js`, `tests/transactions.test.js`, `tests/customerBalanceDisplay.test.js` | **Passed** |
| **FR-12** | Deposit cash into bank account | [TC-05](test_cases.md#tc-05--successful-cash-deposit), [TC-26](test_cases.md#tc-26--transaction-digital-receipt-generation) | T | `tests/transactions.test.js`, `tests/transactionReceipts.test.js` | **Passed** |
| **FR-13** | Withdraw cash from bank account | [TC-15](test_cases.md#tc-15--successful-cash-withdrawal--zero-balance-boundary), [TC-26](test_cases.md#tc-26--transaction-digital-receipt-generation) | T | `tests/transactions.test.js`, `tests/transactionReceipts.test.js` | **Passed** |
| **FR-14** | Reject withdrawal exceeding balance | [TC-06](test_cases.md#tc-06--withdrawal-with-insufficient-balance--overdraft-prevention) | T | `tests/transactions.test.js` | **Passed** |
| **FR-15** | Transfer funds between accounts | [TC-07](test_cases.md#tc-07--successful-customer-fund-transfer--balance-ledger-update), [TC-24](test_cases.md#tc-24--secure-customer-fund-transfer--beneficiary-verification) | T | `tests/transfers.test.js`, `tests/secureTransfers.test.js` | **Passed** |
| **FR-16** | Balance check prior to fund transfer | [TC-07](test_cases.md#tc-07--successful-customer-fund-transfer--balance-ledger-update), [TC-24](test_cases.md#tc-24--secure-customer-fund-transfer--beneficiary-verification) | T | `tests/transfers.test.js`, `tests/secureTransfers.test.js` | **Passed** |
| **FR-17** | Atomic update of sender and receiver balances | [TC-07](test_cases.md#tc-07--successful-customer-fund-transfer--balance-ledger-update), [TC-24](test_cases.md#tc-24--secure-customer-fund-transfer--beneficiary-verification) | T, A | `tests/transfers.test.js`, `tests/secureTransfers.test.js` | **Passed** |
| **FR-18** | Unique transaction reference generation | [TC-05](test_cases.md#tc-05--successful-cash-deposit), [TC-07](test_cases.md#tc-07--successful-customer-fund-transfer--balance-ledger-update), [TC-15](test_cases.md#tc-15--successful-cash-withdrawal--zero-balance-boundary) | T, A | `tests/transactions.test.js`, `tests/transfers.test.js` | **Passed** |
| **FR-19** | Record completed transactions in ledger | [TC-05](test_cases.md#tc-05--successful-cash-deposit), [TC-07](test_cases.md#tc-07--successful-customer-fund-transfer--balance-ledger-update), [TC-25](test_cases.md#tc-25--customer-account-statement-generation) | T | `tests/transactions.test.js`, `tests/accountStatements.test.js` | **Passed** |
| **FR-20** | Customer transaction history retrieval | [TC-16](test_cases.md#tc-16--customer-account-details-and-history-retrieval), [TC-25](test_cases.md#tc-25--customer-account-statement-generation) | T | `tests/history.test.js`, `tests/accountStatements.test.js` | **Passed** |
| **FR-21** | Global staff/admin transaction query | [TC-19](test_cases.md#tc-19--global-transaction-records-query--multi-parameter-filtering) | T | `tests/history.test.js`, `tests/reports.test.js` | **Passed** |
| **FR-22** | User password modification | [TC-17](test_cases.md#tc-17--self-service-customer-password-change) | I | `tests/customerProfileSecurity.test.js` | **Pending Implementation** |
| **FR-23** | Admin employee account management | [TC-18](test_cases.md#tc-18--employee-account-lifecycle-management--session-revocation), [TC-29](test_cases.md#tc-29--employee-personal-activity-history-isolation) | T | `tests/employees.test.js`, `tests/employeeActivity.test.js` | **Passed** |
| **FR-24** | Employee deactivation and session revocation | [TC-18](test_cases.md#tc-18--employee-account-lifecycle-management--session-revocation) | T | `tests/employees.test.js` | **Passed** |
| **FR-25** | System overview and fraud metrics reports | [TC-19](test_cases.md#tc-19--global-transaction-records-query--multi-parameter-filtering), [TC-31](test_cases.md#tc-31--administrative-executive-dashboard-overview), [TC-32](test_cases.md#tc-32--administrative-rfc-4180-csv-report-export--injection-defense), [TC-45](test_cases.md#tc-45--fraud-analytics--aggregations-dashboard) | T | `tests/reports.test.js`, `tests/dashboard.test.js`, `tests/reportExports.test.js`, `tests/fraudDashboard.test.js` | **Passed** |

### 9.2 Non-Functional Requirements Traceability (NFR-01 to NFR-18)

| Requirement ID | Area / Objective | Target Test Cases / Reviews | Type | Verifying Test Suite File(s) | Verification Status |
|---|---|---|:---:|---|---|
| **NFR-01** | Password storage security | [TC-09](test_cases.md#tc-09--password-security--salted-bcrypt-storage), [TC-17](test_cases.md#tc-17--self-service-customer-password-change), [TC-23](test_cases.md#tc-23--customer-horizontal-data-isolation--idor-defense), [TC-27](test_cases.md#tc-27--customer-profile-security--diagnostics-restriction) | I, T | `tests/auth.test.js`, `tests/customerAccountIsolation.test.js`, `tests/customerProfileSecurity.test.js` | **Passed** |
| **NFR-02** | Role-based privilege boundaries | [TC-03](test_cases.md#tc-03--role-based-access-control--privilege-boundaries), [TC-18](test_cases.md#tc-18--employee-account-lifecycle-management--session-revocation), [TC-20](test_cases.md#tc-20--customer-information-viewing-and-profile-modification), [TC-28](test_cases.md#tc-28--centralized-audit-trail-logging--immutability) | T | `tests/auth.test.js`, `tests/employees.test.js`, `tests/audit.test.js` | **Passed** |
| **NFR-03** | Data access security & horizontal isolation | [TC-02](test_cases.md#tc-02--invalid-user-login--enumeration-defense), [TC-03](test_cases.md#tc-03--role-based-access-control--privilege-boundaries), [TC-16](test_cases.md#tc-16--customer-account-details-and-history-retrieval), [TC-23](test_cases.md#tc-23--customer-horizontal-data-isolation--idor-defense), [TC-27](test_cases.md#tc-27--customer-profile-security--diagnostics-restriction) | T | `tests/customerAccountIsolation.test.js`, `tests/customerProfileSecurity.test.js`, `tests/history.test.js` | **Passed** |
| **NFR-04** | Server-side request validation | [TC-04](test_cases.md#tc-04--customer-registration-by-authorized-staff), [TC-12](test_cases.md#tc-12--server-side-input-validation--sanitization) | T | `tests/auth.test.js`, `tests/accounts.test.js`, `tests/transactions.test.js`, `tests/customers.test.js` | **Passed** |
| **NFR-05** | Pre-operation authentication | [TC-01](test_cases.md#tc-01--valid-user-login), [TC-03](test_cases.md#tc-03--role-based-access-control--privilege-boundaries), [TC-13](test_cases.md#tc-13--user-logout-and-immediate-session-invalidation) | T | `tests/auth.test.js`, `tests/health.test.js` | **Passed** |
| **NFR-06** | Reporting query performance (< 3s SLA) | [TC-11](test_cases.md#tc-11--reporting-performance--aggregation-efficiency), [TC-19](test_cases.md#tc-19--global-transaction-records-query--multi-parameter-filtering) | T, A | `tests/reports.test.js` | **Partially Verified** |
| **NFR-07** | Transaction throughput (100 tx/sec SLA) | [TC-11](test_cases.md#tc-11--reporting-performance--aggregation-efficiency) | T, A | `tests/reports.test.js` | **Partially Verified** |
| **NFR-08** | Ledger balance consistency & risk scoring | [TC-07](test_cases.md#tc-07--successful-customer-fund-transfer--balance-ledger-update), [TC-10](test_cases.md#tc-10--failed-transaction-atomicity--rollback-guarantees), [TC-38](test_cases.md#tc-38--fraud-risk-scoring-weight-calibration--analytical-classification) | T, A | `tests/transfers.test.js`, `tests/fraudEngine.test.js` | **Passed** |
| **NFR-09** | Financial & outbox atomicity on failure | [TC-10](test_cases.md#tc-10--failed-transaction-atomicity--rollback-guarantees), [TC-39](test_cases.md#tc-39--transactional-outbox-atomic-staging--mysql-state-preservation), [TC-40](test_cases.md#tc-40--outbox-polling-worker-leasing-heartbeat--stale-recovery), [TC-41](test_cases.md#tc-41--outbox-worker-exponential-retry-backoff--failure-capture) | T | `tests/transactions.test.js`, `tests/transfers.test.js`, `tests/fraudOutboxIntegration.test.js` | **Passed** |
| **NFR-10** | Immutable ledger record accuracy | [TC-05](test_cases.md#tc-05--successful-cash-deposit), [TC-07](test_cases.md#tc-07--successful-customer-fund-transfer--balance-ledger-update), [TC-15](test_cases.md#tc-15--successful-cash-withdrawal--zero-balance-boundary), [TC-28](test_cases.md#tc-28--centralized-audit-trail-logging--immutability) | T, I | `tests/transactions.test.js`, `tests/transfers.test.js`, `tests/audit.test.js` | **Passed** |
| **NFR-11** | Role-specific UI navigation menus | [TC-21](test_cases.md#tc-21--role-specific-ui-navigation--accessibility) | D | Manual Browser Walkthrough | **Passed (Manual UI Walkthrough)** |
| **NFR-12** | Standardized, safe error messages | [TC-02](test_cases.md#tc-02--invalid-user-login--enumeration-defense), [TC-06](test_cases.md#tc-06--withdrawal-with-insufficient-balance--overdraft-prevention), [TC-10](test_cases.md#tc-10--failed-transaction-atomicity--rollback-guarantees), [TC-12](test_cases.md#tc-12--server-side-input-validation--sanitization) | T | `tests/auth.test.js`, `tests/transactions.test.js`, `errorHandler.js` | **Passed** |
| **NFR-13** | Navigation efficiency (<= 3 clicks) | [TC-21](test_cases.md#tc-21--role-specific-ui-navigation--accessibility) | D | Manual Browser Walkthrough | **Passed (Manual UI Walkthrough)** |
| **NFR-14** | Modular architecture & service layering | REV-01 | I | Architectural Inspection of codebase | **Passed** |
| **NFR-15** | Code formatting, naming, and linter clean | REV-02 | I | `oxlint` & static code inspection | **Passed** |
| **NFR-16** | Uniqueness of system identifiers | [TC-04](test_cases.md#tc-04--customer-registration-by-authorized-staff), [TC-14](test_cases.md#tc-14--bank-account-creation-with-unique-account-numbers), REV-03 | T, I | `tests/accounts.test.js`, `tests/customers.test.js`, MySQL constraints | **Passed** |
| **NFR-17** | Mathematical ledger reconciliation | [TC-10](test_cases.md#tc-10--failed-transaction-atomicity--rollback-guarantees), [TC-25](test_cases.md#tc-25--customer-account-statement-generation) | T, A | `tests/accountStatements.test.js`, `tests/transactions.test.js` | **Passed** |
| **NFR-18** | Prevention of invalid data persistence | [TC-04](test_cases.md#tc-04--customer-registration-by-authorized-staff), [TC-12](test_cases.md#tc-12--server-side-input-validation--sanitization), REV-03 | T, I | `tests/customers.test.js`, `tests/accounts.test.js`, schema `CHECK` constraints | **Passed** |

---

## 10. Roles, Schedule and Risks

### 10.1 Roles and Responsibilities

| Role | Responsibilities | Assigned Individual / Entity |
|---|---|---|
| **Test Lead** | Owns the Software Test Plan, coordinates execution, tracks defects, and author reports. | Quality Assurance Lead |
| **Automation Engineer** | Implements and maintains integration test suites in `backend/tests/`, configures coverage tooling. | Backend Engineering Team |
| **Security & Compliance Tester** | Validates security checks SV-01 through SV-10, verifies IDOR defense and audit logging. | Security Engineering |
| **Frontend QA Inspector** | Executes static analysis (`oxlint`), bundle checks (`vite build`), and manual browser UI walkthroughs. | Frontend Engineering Team |
| **Database Administrator** | Verifies MySQL schema constraints, InnoDB transactions, and MongoDB JSON Schema validators. | Data Architecture Team |

### 10.2 Testing Schedule & Phase Milestones

| Milestone | Target Dates | Scope & Deliverables | Status |
|---|---|---|---|
| **Sprint 1 (Baseline)** | 29 Sep – 22 Oct 2026 | App scaffold, MySQL schema, authentication, session lifecycle (26 tests). | **Completed** |
| **Sprint 2 (Banking Ledger)** | 23 Oct – 29 Oct 2026 | Accounts, deposits, withdrawals, fund transfers, transaction history (170 tests). | **Completed** |
| **Sprint 3 (Security & Audit)** | 30 Oct – 05 Nov 2026 | Customer data isolation, receipts, statements, audit logs, employee admin (190 tests). | **Completed** |
| **Phase 1–4 (Fraud Subsystem)** | 05 Nov – 06 Nov 2026 | MongoDB foundation, 4 fraud rules, outbox worker, alert policy, fraud dashboard (220 tests). | **Completed** |
| **Phase 7 (Investigation & E2E)**| 06 Nov – 07 Nov 2026 | Integer paise precision, velocity window fixes, 12-point regression suite (24 tests). | **Completed** |
| **Formal Testing Audit** | 08 Nov 2026 | IEEE 829 test plan update, standalone test cases catalog, RTM synchronization. | **Current Milestone** |

### 10.3 Risks and Contingencies

| Identified Risk | Severity | Mitigation Strategy Implemented in Project |
|---|:---:|---|
| **Cross-Test Database Collisions** | High | Test runner enforces `--test-concurrency=1`, and suites execute deterministic fixture cleanups before/after runs. |
| **Outbox Worker Race Conditions** | High | Worker implements `FOR UPDATE SKIP LOCKED`, 60-second leases, and 20-second heartbeats to prevent duplicate processing. |
| **Floating-Point Rounding in Fraud Rules** | Medium | All monetary threshold comparisons use integer paise (`amount_paise`), eliminating IEEE 754 precision errors. |
| **Frontend UI Regressions Without E2E Runner** | Medium | Automated linting (`oxlint`) and compilation (`vite build`) gates prevent syntax errors; structured manual walkthroughs verify UI. |
| **Cross-Datastore Inconsistency** | High | MySQL transaction commits financial ledger and outbox atomically; worker retries evaluations until MongoDB confirms persist. |
