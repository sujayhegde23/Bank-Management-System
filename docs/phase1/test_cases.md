# Test Case Specification

## Bank Management System with Rule-Driven Fraud Detection

| Item | Details |
|---|---|
| Document | Test Case Specification |
| Project | Bank Management System with MongoDB-Based Rule-Driven Fraud Detection |
| Phase | Formal Testing, Verification & Validation |
| Version | 1.3 |
| Date | 08 November 2026 |
| Standard followed | IEEE Std 829-2008 (Test Case Specification), aligned with ISO/IEC/IEEE 29119-3 |
| Related documents | [SRS](SRS.md), [Architecture & Design Specification](architecture_design.md), [Test Plan](test_plan.md), [RTM](rtm.md) |

### Revision History

| Version | Date | Description | Author |
|---|---|---|---|
| 1.0 | 29 Sep 2026 | Initial baseline test case specifications for Phase 1 core banking (TC-01 through TC-21). | Quality Assurance Team |
| 1.1 | 21 Oct 2026 | Technology stack alignment with React/Vite, Node.js/Express, and MySQL InnoDB. | Quality Assurance Team |
| 1.2 | 22 Oct 2026 | Execution tracking for foundation and authentication modules (TC-01, TC-02, TC-09, TC-13). | Quality Assurance Team |
| 1.3 | 08 Nov 2026 | Comprehensive expansion to formalize full system verification: updated TC-01–TC-21 with actual execution results; added TC-22 through TC-46 covering customer data isolation, transaction receipts, account statements, centralized audit logs, employee administration, MongoDB foundation, 4 fraud detection rules, transactional outbox worker leasing, alert policy guarantees, fraud investigations, and end-to-end integration regression (28 automated integration test suites, 630 automated tests). Clarified fraud assessment as post-transaction analytical classification. | Quality Assurance Team |

---

## Table of Contents

1. [Introduction and Test Case Structure](#1-introduction-and-test-case-structure)
2. [Master Test Case Directory & Execution Summary](#2-master-test-case-directory--execution-summary)
3. [Core Banking, Authentication & Operations Test Cases (TC-01 to TC-21)](#3-core-banking-authentication--operations-test-cases-tc-01-to-tc-21)
4. [Security, Isolation & Customer/Employee Services Test Cases (TC-22 to TC-32)](#4-security-isolation--customeremployee-services-test-cases-tc-22-to-tc-32)
5. [Dual-Datastore Foundation & Rule-Driven Fraud Detection Test Cases (TC-33 to TC-38)](#5-dual-datastore-foundation--rule-driven-fraud-detection-test-cases-tc-33-to-tc-38)
6. [Transactional Outbox Subsystem & Polling Worker Test Cases (TC-39 to TC-41)](#6-transactional-outbox-subsystem--polling-worker-test-cases-tc-39-to-tc-41)
7. [Fraud Alert Policy, Dashboard & Case Investigation Test Cases (TC-42 to TC-45)](#7-fraud-alert-policy-dashboard--case-investigation-test-cases-tc-42-to-tc-45)
8. [End-to-End Banking-to-Fraud Integration Regression Test Cases (TC-46)](#8-end-to-end-banking-to-fraud-integration-regression-test-cases-tc-46)

---

## 1. Introduction and Test Case Structure

### 1.1 Purpose
This document provides the formal Test Case Specification for the Bank Management System, adhering to the IEEE Std 829-2008 standard. It details all operational, security, non-functional, and fraud analytics test cases executed against the system across its dual-datastore architecture (MySQL and MongoDB).

### 1.2 Scope
Verification covers all 25 Functional Requirements (`FR-01` to `FR-25`), all 18 Non-Functional Requirements (`NFR-01` to `NFR-18`), and the five fraud detection use cases (`UC-27` to `UC-31`). It encompasses:
- Core banking ledger workflows (deposits, withdrawals, balance checks, fund transfers).
- Security controls (bcrypt password salting, session invalidation, RBAC, customer horizontal data isolation).
- Dual-datastore foundation (MySQL InnoDB relational engine and MongoDB fraud collections).
- Rule-driven fraud detection engine (`HIGH_AMOUNT`, `HIGH_VELOCITY`, `NEW_BENEFICIARY`, `UNUSUAL_HOUR`).
- Asynchronous transactional outbox processing and distributed worker leasing (`SKIP LOCKED`, heartbeat renewal, retry backoff).
- Fraud investigation lifecycle and administrative configuration dashboard.

> **Crucial Architectural Principle — Analytical Assessment Decoupling:**  
> The fraud detection engine executes **asynchronously post-transaction** via a decoupled outbox worker. Fraud risk classifications (`APPROVED`, `REVIEW_REQUIRED`, `FLAGGED`) are analytical classifications generated strictly for administrative monitoring and investigation triage. They do **not** approve, reject, or block financial transactions.

### 1.3 Test Case Specification Format
Each test case is specified using standard IEEE 829 attributes:
- **Test Case ID:** Unique identifier (`TC-01` to `TC-46`).
- **Requirement ID(s):** Traceability mapping to [SRS](SRS.md) requirements.
- **Use Case ID(s):** Traceability mapping to [Actors and Use Cases](actors_usecases.md).
- **Test Type:** Functional, Security, Reliability, Performance, Negative, Boundary, or Integration.
- **Priority:** High, Medium, or Low.
- **Verification Method:** Automated Integration Test, Code/Schema Inspection, or Manual UI Walkthrough.
- **Test Objective:** Concise statement of verification intent.
- **Preconditions:** System state, database records, and authentication context required prior to execution.
- **Test Steps:** Exact operational sequence followed.
- **Test Data / Input:** Specific payload parameters, boundary values, or test vectors.
- **Expected Result:** Authoritative expected system behavior, HTTP status codes, and database state.
- **Actual Result & Evidence:** Empirical execution result referencing automated test files (`backend/tests/`), scenario numbers, and dates.
- **Status:** `Passed`, `Passed (Manual UI Walkthrough)`, or `Pending Implementation`.

---

## 2. Master Test Case Directory & Execution Summary

| Test ID | Title | Requirement(s) | Test Type | Method | Automated Test Suite | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [TC-01](#tc-01--valid-user-login) | Valid User Login | FR-01, FR-03, NFR-05 | Functional, Security | Automated | `tests/auth.test.js` | **Passed** |
| [TC-02](#tc-02--invalid-user-login--enumeration-defense) | Invalid User Login & Enumeration Defense | FR-01, NFR-03, NFR-12 | Negative, Security | Automated | `tests/auth.test.js` | **Passed** |
| [TC-03](#tc-03--role-based-access-control--privilege-boundaries) | Role-Based Access Control & Privilege Boundaries | FR-03, NFR-02, NFR-03, NFR-05 | Security | Automated | `tests/auth.test.js`, `tests/employees.test.js` | **Passed** |
| [TC-04](#tc-04--customer-registration-by-authorized-staff) | Customer Registration by Authorized Staff | FR-04, NFR-01, NFR-04 | Functional | Automated | `tests/customers.test.js` | **Passed** |
| [TC-05](#tc-05--successful-cash-deposit) | Successful Cash Deposit | FR-12, FR-18, FR-19, NFR-10 | Functional | Automated | `tests/transactions.test.js` | **Passed** |
| [TC-06](#tc-06--withdrawal-with-insufficient-balance--overdraft-prevention) | Withdrawal with Insufficient Balance / Overdraft Prevention | FR-14, NFR-12 | Negative, Boundary | Automated | `tests/transactions.test.js` | **Passed** |
| [TC-07](#tc-07--successful-customer-fund-transfer--balance-ledger-update) | Successful Customer Fund Transfer & Balance Ledger Update | FR-15, FR-16, FR-17, FR-18, FR-19, NFR-08, NFR-10 | Functional, Integration | Automated | `tests/transfers.test.js`, `tests/secureTransfers.test.js` | **Passed** |
| [TC-08](#tc-08--transaction-prevention-on-frozen-or-inactive-accounts) | Transaction Prevention on Frozen or Inactive Accounts | FR-10, FR-11 | Negative, Security | Automated | `tests/accounts.test.js`, `tests/transactions.test.js` | **Passed** |
| [TC-09](#tc-09--password-security--salted-bcrypt-storage) | Password Security & Salted Bcrypt Storage | NFR-01 | Security, Inspection | Automated & Inspection | `tests/auth.test.js` | **Passed** |
| [TC-10](#tc-10--failed-transaction-atomicity--rollback-guarantees) | Failed Transaction Atomicity & Rollback Guarantees | NFR-09, NFR-17, NFR-12 | Reliability, Integration | Automated | `tests/transactions.test.js`, `tests/transfers.test.js` | **Passed** |
| [TC-11](#tc-11--reporting-performance--aggregation-efficiency) | Reporting Performance & Aggregation Efficiency | NFR-06, NFR-07 | Performance | Automated Benchmark | `tests/reports.test.js` | **Partially Verified** |
| [TC-12](#tc-12--server-side-input-validation--sanitization) | Server-Side Input Validation & Sanitization | NFR-04, NFR-18 | Security, Integrity | Automated | `tests/auth.test.js`, `tests/accounts.test.js`, `tests/transactions.test.js` | **Passed** |
| [TC-13](#tc-13--user-logout-and-immediate-session-invalidation) | User Logout and Immediate Session Invalidation | FR-02, NFR-05 | Functional, Security | Automated | `tests/auth.test.js` | **Passed** |
| [TC-14](#tc-14--bank-account-creation-with-unique-account-numbers) | Bank Account Creation with Unique Account Numbers | FR-07, FR-08, NFR-16 | Functional | Automated | `tests/accounts.test.js` | **Passed** |
| [TC-15](#tc-15--successful-cash-withdrawal--zero-balance-boundary) | Successful Cash Withdrawal & Zero-Balance Boundary | FR-13, FR-18, FR-19, NFR-10 | Functional, Boundary | Automated | `tests/transactions.test.js` | **Passed** |
| [TC-16](#tc-16--customer-account-details-and-history-retrieval) | Customer Account Details and History Retrieval | FR-09, FR-20, NFR-03 | Functional, Security | Automated | `tests/history.test.js`, `tests/customerOverview.test.js` | **Passed** |
| [TC-17](#tc-17--self-service-customer-password-change) | Self-Service Customer Password Change | FR-22, NFR-01 | Functional, Security | Code Inspection | `tests/customerProfileSecurity.test.js` | **Pending Implementation** |
| [TC-18](#tc-18--employee-account-lifecycle-management--session-revocation) | Employee Account Lifecycle Management & Session Revocation | FR-23, FR-24, NFR-02 | Functional, Security | Automated | `tests/employees.test.js` | **Passed** |
| [TC-19](#tc-19--global-transaction-records-query--multi-parameter-filtering) | Global Transaction Records Query & Multi-Parameter Filtering | FR-21, NFR-03, NFR-06 | Functional | Automated | `tests/history.test.js`, `tests/reports.test.js` | **Passed** |
| [TC-20](#tc-20--customer-information-viewing-and-profile-modification) | Customer Information Viewing and Profile Modification | FR-05, FR-06, NFR-02 | Functional | Automated | `tests/customers.test.js` | **Passed** |
| [TC-21](#tc-21--role-specific-ui-navigation--accessibility) | Role-Specific UI Navigation & Accessibility | NFR-11, NFR-13 | Usability, Navigation | Manual UI Walkthrough | Manual Browser Walkthrough | **Passed (Manual UI Walkthrough)** |
| [TC-22](#tc-22--customer-account-balance-display--status-clarity) | Customer Account Balance Display & Status Clarity | FR-11 | Functional, UI Support | Automated | `tests/customerBalanceDisplay.test.js` | **Passed** |
| [TC-23](#tc-23--customer-horizontal-data-isolation--idor-defense) | Customer Horizontal Data Isolation & IDOR Defense | NFR-01, NFR-03 | Security | Automated | `tests/customerAccountIsolation.test.js` | **Passed** |
| [TC-24](#tc-24--secure-customer-fund-transfer--beneficiary-verification) | Secure Customer Fund Transfer & Beneficiary Verification | FR-15, FR-16, FR-17 | Functional, Security | Automated | `tests/secureTransfers.test.js` | **Passed** |
| [TC-25](#tc-25--customer-account-statement-generation) | Customer Account Statement Generation | FR-19, FR-20 | Functional | Automated | `tests/accountStatements.test.js` | **Passed** |
| [TC-26](#tc-26--transaction-digital-receipt-generation) | Transaction Digital Receipt Generation | FR-12, FR-13 | Functional | Automated | `tests/transactionReceipts.test.js` | **Passed** |
| [TC-27](#tc-27--customer-profile-security--diagnostics-restriction) | Customer Profile Security & Diagnostics Restriction | NFR-01, NFR-03 | Security | Automated | `tests/customerProfileSecurity.test.js` | **Passed** |
| [TC-28](#tc-28--centralized-audit-trail-logging--immutability) | Centralized Audit Trail Logging & Immutability | NFR-02, NFR-03 | Security, Compliance | Automated | `tests/audit.test.js` | **Passed** |
| [TC-29](#tc-29--employee-personal-activity-history-isolation) | Employee Personal Activity History Isolation | FR-23, NFR-01 | Functional, Security | Automated | `tests/employeeActivity.test.js` | **Passed** |
| [TC-30](#tc-30--employee-banking-operations-console) | Employee Banking Operations Console | FR-09, FR-10 | Functional | Automated | `tests/employeeConsole.test.js` | **Passed** |
| [TC-31](#tc-31--administrative-executive-dashboard-overview) | Administrative Executive Dashboard Overview | FR-25, NFR-03 | Functional, Reporting | Automated | `tests/dashboard.test.js` | **Passed** |
| [TC-32](#tc-32--administrative-rfc-4180-csv-report-export--injection-defense) | Administrative RFC 4180 CSV Report Export & Injection Defense | FR-25, NFR-01 | Functional, Security | Automated | `tests/reportExports.test.js` | **Passed** |
| [TC-33](#tc-33--mongodb-dual-datastore-foundation--schema-validation) | MongoDB Dual-Datastore Foundation & Schema Validation | UC-27–UC-31 | Data Integrity | Automated | `tests/mongoFoundation.test.js` | **Passed** |
| [TC-34](#tc-34--fraud-detection-rule-engine-high_amount-evaluation) | Fraud Detection Rule Engine: HIGH_AMOUNT Evaluation | UC-27, UC-30 | Analytical, Logic | Automated | `tests/fraudEngine.test.js`, `tests/fraudPipelineBugInvestigation.test.js` | **Passed** |
| [TC-35](#tc-35--fraud-detection-rule-engine-high_velocity-evaluation) | Fraud Detection Rule Engine: HIGH_VELOCITY Evaluation | UC-27, UC-30 | Analytical, Logic | Automated | `tests/fraudEngine.test.js`, `tests/fraudPipelineBugInvestigation.test.js` | **Passed** |
| [TC-36](#tc-36--fraud-detection-rule-engine-new_beneficiary-evaluation) | Fraud Detection Rule Engine: NEW_BENEFICIARY Evaluation | UC-27, UC-30 | Analytical, Logic | Automated | `tests/fraudEngine.test.js` | **Passed** |
| [TC-37](#tc-37--fraud-detection-rule-engine-unusual_hour-evaluation) | Fraud Detection Rule Engine: UNUSUAL_HOUR Evaluation | UC-27, UC-30 | Analytical, Logic | Automated | `tests/fraudEngine.test.js` | **Passed** |
| [TC-38](#tc-38--fraud-risk-scoring-weight-calibration--analytical-classification) | Fraud Risk Scoring, Weight Calibration & Analytical Classification | UC-28, NFR-08 | Analytical, Risk | Automated | `tests/fraudEngine.test.js` | **Passed** |
| [TC-39](#tc-39--transactional-outbox-atomic-staging--mysql-state-preservation) | Transactional Outbox Atomic Staging & MySQL State Preservation | UC-27, NFR-09 | Reliability, Integration | Automated | `tests/fraudOutboxIntegration.test.js` | **Passed** |
| [TC-40](#tc-40--outbox-polling-worker-leasing-heartbeat--stale-recovery) | Outbox Polling Worker Leasing, Heartbeat & Stale Recovery | UC-27, NFR-09 | Reliability, Concurrency | Automated | `tests/fraudOutboxIntegration.test.js` | **Passed** |
| [TC-41](#tc-41--outbox-worker-exponential-retry-backoff--failure-capture) | Outbox Worker Exponential Retry Backoff & Failure Capture | UC-27, NFR-09 | Reliability, Fault Tolerance | Automated | `tests/fraudOutboxIntegration.test.js` | **Passed** |
| [TC-42](#tc-42--fraud-alert-generation-policy-guarantee) | Fraud Alert Generation Policy Guarantee | UC-27 | Policy, Analytical | Automated | `tests/fraudAlertPolicyCorrection.test.js` | **Passed** |
| [TC-43](#tc-43--fraud-investigation-lifecycle-management--state-machine) | Fraud Investigation Lifecycle Management & State Machine | UC-29 | Workflow, Integrity | Automated | `tests/fraudDashboard.test.js` | **Passed** |
| [TC-44](#tc-44--fraud-dynamic-rule-configuration--threshold-management) | Fraud Dynamic Rule Configuration & Threshold Management | UC-30 | Functional, Security | Automated | `tests/fraudDashboard.test.js` | **Passed** |
| [TC-45](#tc-45--fraud-analytics--aggregations-dashboard) | Fraud Analytics & Aggregations Dashboard | UC-31 | Reporting, Analytics | Automated | `tests/fraudDashboard.test.js` | **Passed** |
| [TC-46](#tc-46--end-to-end-banking-to-fraud-integration-regression) | End-to-End Banking-to-Fraud Integration Regression | All FRs, UC-27–UC-31 | Integration, Regression | Automated | `tests/fraudRegressionDebugging.test.js` | **Passed** |

---

## 3. Core Banking, Authentication & Operations Test Cases (TC-01 to TC-21)

### TC-01 — Valid User Login

| Field | Details |
|---|---|
| Test Case ID | TC-01 |
| Requirement ID | FR-01, FR-03, NFR-05 |
| Use Case ID | UC-01, UC-08, UC-19 |
| Test Type | Functional, Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/auth.test.js`) |
| Test Objective | Verify that registered active users of Customer, Employee, and Administrator roles authenticate successfully with valid credentials and establish an authenticated session. |
| Preconditions | Active user accounts exist in MySQL `users` table for each role (`test.customer1`, `test.employee1`, `test.admin1`) with bcrypt-hashed passwords. |
| Test Steps | 1. Send `POST /api/auth/login` with `test.customer1` credentials. 2. Verify HTTP status, payload, and `bms.sid` session cookie. 3. Repeat for `test.employee1` and `test.admin1`. |
| Test Data / Input | Username: `test.customer1` / `test.employee1` / `test.admin1`; Password: `Password123!` |
| Expected Result | HTTP 200 OK returned with `{ success: true, user: { id, username, fullName, role } }`. HTTP-only `bms.sid` cookie issued with `SameSite=Lax`. |
| Actual Result & Evidence | Verified on 2026-10-22 in `tests/auth.test.js` (Scenario 1, 3 tests). All three roles authenticate cleanly, session cookies are created, and user roles match database records. |
| Status | Passed |

### TC-02 — Invalid User Login & Enumeration Defense

| Field | Details |
|---|---|
| Test Case ID | TC-02 |
| Requirement ID | FR-01, NFR-03, NFR-12 |
| Use Case ID | UC-01 |
| Test Type | Negative, Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/auth.test.js`) |
| Test Objective | Verify that authentication rejects invalid passwords, non-existent usernames, and empty fields with standardized error envelopes without username enumeration. |
| Preconditions | Active user `test.customer1` exists. User `no.such.user` does not exist. |
| Test Steps | 1. Submit login request with valid username and wrong password. 2. Submit login request with non-existent username. 3. Submit login request with empty strings. |
| Test Data / Input | Valid user + wrong password; `username: "no.such.user"`; empty credentials `""`. |
| Expected Result | Cases 1 & 2 return HTTP 401 Unauthorized with generic message `{ code: 'AUTH_001', message: 'Invalid username or password' }`. Response times use constant-time dummy bcrypt hashing to prevent timing enumeration. Case 3 returns HTTP 400 `{ code: 'VAL_001' }`. |
| Actual Result & Evidence | Verified on 2026-10-22 in `tests/auth.test.js` (Scenarios 2, 3, 4, 5, 4 tests). Constant-time execution prevents timing attacks; structured JSON envelopes returned. |
| Status | Passed |

### TC-03 — Role-Based Access Control & Privilege Boundaries

| Field | Details |
|---|---|
| Test Case ID | TC-03 |
| Requirement ID | FR-03, NFR-02, NFR-03, NFR-05 |
| Use Case ID | UC-10, UC-15, UC-21, UC-26 |
| Test Type | Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/auth.test.js`, `tests/employees.test.js`, `tests/transfers.test.js`, `tests/fraudDashboard.test.js`) |
| Test Objective | Verify that backend authorization middleware intercepts and denies unauthorized cross-role requests across Customer, Employee, and Administrator boundary routes. |
| Preconditions | Active sessions established for `test.customer1`, `test.employee1`, and unauthenticated requests. |
| Test Steps | 1. Customer attempts employee-only customer registration `POST /api/customers`. 2. Customer attempts employee deposit `POST /api/accounts/:id/deposits`. 3. Customer and Employee attempt admin employee management `GET /api/employees`. 4. Customer attempts fraud monitoring dashboard `GET /api/fraud/stats`. 5. Unauthenticated request issued to protected endpoints. |
| Test Data / Input | Valid role sessions attached to unauthorized endpoints. |
| Expected Result | Unauthorized role requests are blocked with HTTP 403 Forbidden `{ code: 'AUTH_002', message: 'Unauthorized operation' }`. Unauthenticated calls are blocked with HTTP 401 Unauthorized `{ code: 'AUTH_003' }`. Zero data accessed or modified. |
| Actual Result & Evidence | Verified across `tests/auth.test.js` (Scenarios 8-10), `tests/employees.test.js` (Scenarios 1-3), `tests/transfers.test.js` (Scenario 3), and `tests/fraudDashboard.test.js` (Scenario 1). Total of 32 authorization assertions passing. |
| Status | Passed |

### TC-04 — Customer Registration by Authorized Staff

| Field | Details |
|---|---|
| Test Case ID | TC-04 |
| Requirement ID | FR-04, NFR-01, NFR-04 |
| Use Case ID | UC-10 |
| Test Type | Functional |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/customers.test.js`) |
| Test Objective | Verify that authorized bank staff can register new customers with atomic user creation, salted password hashing, and unique customer ID generation. |
| Preconditions | Logged in as `test.employee1` or `test.admin1`. |
| Test Steps | 1. Submit `POST /api/customers` with complete, valid customer profile data. 2. Verify MySQL atomic insertion in `users` and `customers` tables. 3. Attempt duplicate registration with same email or phone. |
| Test Data / Input | `fullName: "Alice Smith"`, `dateOfBirth: "1992-05-15"`, `phone: "9876543210"`, `email: "alice@example.com"`, `address: "123 Bank St"`, `username: "alice.smith"`, `password: "Pass1234!"` |
| Expected Result | HTTP 201 Created with `{ success: true, customer: { id, customerNumber, fullName, ... } }`. Password hashed with bcrypt cost 10. Duplicate email/phone rejected with HTTP 400 `VAL_001`. |
| Actual Result & Evidence | Verified on 2026-10-29 in `tests/customers.test.js` (Scenarios 1-10, 30 tests). Atomic creation, unique constraint validation, and salted password storage confirmed. |
| Status | Passed |

### TC-05 — Successful Cash Deposit

| Field | Details |
|---|---|
| Test Case ID | TC-05 |
| Requirement ID | FR-12, FR-18, FR-19, NFR-10 |
| Use Case ID | UC-15 |
| Test Type | Functional |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/transactions.test.js`) |
| Test Objective | Verify that an authorized employee can deposit cash into an active bank account, increasing its balance exactly and creating a persistent `DEPOSIT` transaction record. |
| Preconditions | Active savings account exists with balance 10,000.00. Logged in as `test.employee1`. |
| Test Steps | 1. Send `POST /api/transactions/deposit` with account ID and amount 2,500.00. 2. Query account balance and verify exact increase. 3. Query `bank_transactions` record. |
| Test Data / Input | `accountId`: Target active account; `amount`: 2500.00; `description`: "Over the counter cash deposit" |
| Expected Result | HTTP 201 Created with transaction details. New balance is 12,500.00. One record created in `bank_transactions` with `transaction_type = 'DEPOSIT'` and unique `reference_number = 'TXN-DEP-...'`. |
| Actual Result & Evidence | Verified on 2026-10-28 in `tests/transactions.test.js` (Scenario 1, 6 tests). Exact balance calculation and ledger record creation confirmed. |
| Status | Passed |

### TC-06 — Withdrawal with Insufficient Balance / Overdraft Prevention

| Field | Details |
|---|---|
| Test Case ID | TC-06 |
| Requirement ID | FR-14, NFR-12 |
| Use Case ID | UC-16 |
| Test Type | Negative, Boundary |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/transactions.test.js`) |
| Test Objective | Verify that a withdrawal exceeding available balance is strictly rejected, leaving the balance unchanged and inserting zero transaction records. |
| Preconditions | Active savings account exists with balance 10,000.00. Logged in as `test.employee1`. |
| Test Steps | 1. Send `POST /api/transactions/withdraw` with amount 10,000.01 (0.01 above balance). 2. Query account balance and transaction records. |
| Test Data / Input | `accountId`: Target account; `amount`: 10000.01 |
| Expected Result | HTTP 422 Unprocessable Entity with error envelope `{ success: false, error: { code: 'TXN_001', message: 'Insufficient balance' } }`. Account balance remains exactly 10,000.00; zero transaction records created. |
| Actual Result & Evidence | Verified on 2026-10-28 in `tests/transactions.test.js` (Scenario 3, 4 tests). Boundary value 10,000.01 properly rejected; balance integrity preserved. |
| Status | Passed |

### TC-07 — Successful Customer Fund Transfer & Balance Ledger Update

| Field | Details |
|---|---|
| Test Case ID | TC-07 |
| Requirement ID | FR-15, FR-16, FR-17, FR-18, FR-19, NFR-08, NFR-10 |
| Use Case ID | UC-04 |
| Test Type | Functional, Integration |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/transfers.test.js`, `tests/secureTransfers.test.js`) |
| Test Objective | Verify that an authenticated customer can transfer funds to another valid account within available balance, executing an atomic two-phase balance update (debit sender, credit receiver) and generating distinct ledger records. |
| Preconditions | Logged in as customer owning source account ACC-S1 (balance 10,000.00). Destination account ACC-D2 exists (balance 5,000.00). |
| Test Steps | 1. Submit `POST /api/transfers` with source ACC-S1, destination ACC-D2, and amount 1,500.00. 2. Verify sender balance is 8,500.00. 3. Verify receiver balance is 6,500.00. 4. Verify transaction records and references. 5. Attempt transfer of 20,000.00 from ACC-S1 (insufficient funds). |
| Test Data / Input | Transfer 1: `fromAccountId: ACC-S1`, `toAccountId: ACC-D2`, `amount: 1500.00`. Transfer 2: `amount: 20000.00`. |
| Expected Result | Transfer 1 succeeds with HTTP 201 Created. Both accounts updated atomically. Two transaction records inserted (`TRANSFER_DEBIT` and `TRANSFER_CREDIT`). Transfer 2 rejected with HTTP 422 `TXN_001`, leaving balances unchanged. |
| Actual Result & Evidence | Verified across `tests/transfers.test.js` (Scenarios 1-5, 33 tests) and `tests/secureTransfers.test.js` (Scenarios 1-3, 27 tests). Total 60 automated transfer tests passing. |
| Status | Passed |

### TC-08 — Transaction Prevention on Frozen or Inactive Accounts

| Field | Details |
|---|---|
| Test Case ID | TC-08 |
| Requirement ID | FR-10, FR-11 |
| Use Case ID | UC-17, UC-04, UC-15, UC-16 |
| Test Type | Negative, Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/accounts.test.js`, `tests/transactions.test.js`) |
| Test Objective | Verify that accounts in FROZEN or INACTIVE status reject all deposits, withdrawals, and outgoing/incoming fund transfers. |
| Preconditions | Account ACC-FRZ is FROZEN; Account ACC-INA is INACTIVE. |
| Test Steps | 1. Attempt deposit to ACC-FRZ. 2. Attempt withdrawal from ACC-INA. 3. Attempt fund transfer from ACC-FRZ. 4. Attempt fund transfer to ACC-FRZ as recipient. |
| Test Data / Input | `amount: 500.00` targeted at frozen and inactive account IDs. |
| Expected Result | All operations rejected with HTTP 409 Conflict `{ code: 'ACC_001', message: 'Account is frozen or inactive' }`. Account balances remain unaltered; zero transaction records created. |
| Actual Result & Evidence | Verified on 2026-10-28 in `tests/accounts.test.js` (Scenario 5) and `tests/transactions.test.js` (Scenario 4). Eligibility engine enforces restrictions across all transaction types. |
| Status | Passed |

### TC-09 — Password Security & Salted Bcrypt Storage

| Field | Details |
|---|---|
| Test Case ID | TC-09 |
| Requirement ID | NFR-01 |
| Use Case ID | UC-01, UC-10, UC-21 |
| Test Type | Security, Inspection |
| Priority | High |
| Verification Method | Automated Integration Test & Code Inspection (`tests/auth.test.js`) |
| Test Objective | Verify that user passwords are stored exclusively as salted one-way hashes using bcrypt (cost 10), that identical passwords produce distinct hash values, and that plain text is never logged or returned. |
| Preconditions | Access to database and application logs. |
| Test Steps | 1. Create two test accounts with identical password `SecretPassword123!`. 2. Inspect MySQL `users.password_hash` column. 3. Verify distinct hash strings starting with `$2b$10$`. 4. Inspect login and user response payloads. |
| Test Data / Input | Duplicate plain passwords across distinct user entities. |
| Expected Result | Distinct salted hashes generated. Password hash or plain-text password omitted from all JSON responses. Zero passwords in logs. |
| Actual Result & Evidence | Verified on 2026-10-22 in `tests/auth.test.js` (Scenario 12, 2 tests). Password hash salting verified with cost factor 10. |
| Status | Passed |

### TC-10 — Failed Transaction Atomicity & Rollback Guarantees

| Field | Details |
|---|---|
| Test Case ID | TC-10 |
| Requirement ID | NFR-09, NFR-17, NFR-12 |
| Use Case ID | UC-04, UC-15, UC-16 |
| Test Type | Reliability, Integration |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/transactions.test.js`, `tests/transfers.test.js`) |
| Test Objective | Verify that when a database error, constraint violation, or simulated failure occurs during a financial transaction, the entire transaction rolls back cleanly with zero balance corruption and zero orphan records. |
| Preconditions | Active accounts exist with verified balances. |
| Test Steps | 1. Simulate mid-transaction query failure during fund transfer (e.g. invalid SQL injection or forced error after debit). 2. Verify HTTP error response. 3. Verify sender balance is unchanged. 4. Verify receiver balance is unchanged. 5. Verify no partial transaction records exist. |
| Test Data / Input | Forced failure trigger during transfer between ACC-S1 and ACC-D2. |
| Expected Result | HTTP 500 Internal Server Error returned with `{ code: 'TXN_003' }`. Complete transaction rollback executed by MySQL InnoDB engine. |
| Actual Result & Evidence | Verified on 2026-10-28 in `tests/transactions.test.js` (Scenario 8) and `tests/transfers.test.js` (Scenario 5). ACID atomicity confirmed under simulated failure conditions. |
| Status | Passed |

### TC-11 — Reporting Performance & Aggregation Efficiency

| Field | Details |
|---|---|
| Test Case ID | TC-11 |
| Requirement ID | NFR-06, NFR-07 |
| Use Case ID | UC-26 |
| Test Type | Performance |
| Priority | Medium |
| Verification Method | Automated Benchmark (`tests/reports.test.js`) |
| Test Objective | Verify that system reporting queries leverage database-level SQL aggregations (`COUNT`, `SUM`, `AVG`) with index scans, executing well within the 3-second SLA. |
| Preconditions | Seeded database with transaction and account records. |
| Test Steps | 1. Send `GET /api/reports/overview` and `GET /api/reports/transactions`. 2. Measure server response time. |
| Test Data / Input | Multi-account transaction queries across configured date ranges. |
| Expected Result | Server generates aggregation reports in under 500ms on baseline test data (SLA < 3.0s for 10,000 records). |
| Actual Result & Evidence | Verified in `tests/reports.test.js` (Scenario 1, execution time < 25ms per aggregation query). Formal multi-user load testing at target scale (10,000 transactions, 100 concurrent threads) is documented as partially verified pending high-concurrency tooling. |
| Status | Partially Verified (SQL Index & Query Efficiency Verified) |

### TC-12 — Server-Side Input Validation & Sanitization

| Field | Details |
|---|---|
| Test Case ID | TC-12 |
| Requirement ID | NFR-04, NFR-18 |
| Use Case ID | All UCs |
| Test Type | Security, Data Integrity |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/auth.test.js`, `tests/accounts.test.js`, `tests/transactions.test.js`, `tests/customers.test.js`) |
| Test Objective | Verify that backend request validation middleware rejects missing fields, negative amounts, non-numeric values, >2 decimal monetary amounts, invalid date formats, and SQL injection strings with standardized `VAL_001` or `TXN_002` error envelopes. |
| Preconditions | Server running with active validation middleware. |
| Test Steps | 1. Submit deposit with negative amount `-500.00`. 2. Submit transfer with amount `100.555` (>2 decimals). 3. Submit customer registration with invalid email `notanemail` and invalid date `2025-02-30`. 4. Submit SQL injection payload `' OR '1'='1`. |
| Test Data / Input | Negative amounts, multi-decimal fractions, invalid dates, malformed JSON types. |
| Expected Result | All invalid inputs rejected with HTTP 400 Bad Request `{ code: 'VAL_001' }` or `{ code: 'TXN_002' }`. Zero database queries executed with malformed data. |
| Actual Result & Evidence | Verified across `tests/auth.test.js` (Scenario 4), `tests/accounts.test.js` (Scenario 1), `tests/transactions.test.js` (Scenario 5), and `tests/customers.test.js` (Scenario 2). Total of 45 validation tests passing. |
| Status | Passed |

### TC-13 — User Logout and Immediate Session Invalidation

| Field | Details |
|---|---|
| Test Case ID | TC-13 |
| Requirement ID | FR-02, NFR-05 |
| Use Case ID | UC-02, UC-09, UC-20 |
| Test Type | Functional, Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/auth.test.js`) |
| Test Objective | Verify that calling logout destroys the server-side session in the database session store, expires the client cookie, and immediately rejects subsequent requests using the old cookie. |
| Preconditions | Active session established with valid cookie `bms.sid`. |
| Test Steps | 1. Send `POST /api/auth/logout` with valid session cookie. 2. Verify `Set-Cookie` header expires `bms.sid`. 3. Verify session record deleted from `sessions` table. 4. Attempt to access `GET /api/auth/me` with old session cookie. |
| Test Data / Input | Valid session cookie before and after logout invocation. |
| Expected Result | HTTP 200 OK returned on logout. Subsequent request using old cookie is rejected with HTTP 401 Unauthorized `{ code: 'AUTH_003' }`. |
| Actual Result & Evidence | Verified on 2026-10-22 in `tests/auth.test.js` (Scenarios 6 & 7, 2 tests). Session destroyed and rejected on subsequent calls. |
| Status | Passed |

### TC-14 — Bank Account Creation with Unique Account Numbers

| Field | Details |
|---|---|
| Test Case ID | TC-14 |
| Requirement ID | FR-07, FR-08, NFR-16 |
| Use Case ID | UC-13 |
| Test Type | Functional |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/accounts.test.js`) |
| Test Objective | Verify that authorized bank staff can open SAVINGS and CURRENT accounts for registered customers, enforcing 0.00 opening balance and generating unique account numbers formatted `ACC-<TYPE>-<8-DIGITS>`. |
| Preconditions | Customer C1 exists. Logged in as `test.employee1`. |
| Test Steps | 1. Send `POST /api/accounts` with `customerId: C1`, `accountType: "SAVINGS"`. 2. Send request to create second account for C1. 3. Verify account numbers follow standard regex `^ACC-(SAV|CUR)-[0-9]{8}$`. 4. Attempt account creation for non-existent customer. |
| Test Data / Input | `customerId: C1`, `accountType: "SAVINGS"` / `"CURRENT"`. |
| Expected Result | HTTP 201 Created. Unique account numbers generated without collision. Non-existent customer rejected with HTTP 404 `{ code: 'CUST_001' }`. Unauthorized roles rejected with HTTP 403 `AUTH_002`. |
| Actual Result & Evidence | Verified on 2026-10-28 in `tests/accounts.test.js` (Scenario 1, 8 tests). Unique constraint and collision-resistant generator confirmed. |
| Status | Passed |

### TC-15 — Successful Cash Withdrawal & Zero-Balance Boundary

| Field | Details |
|---|---|
| Test Case ID | TC-15 |
| Requirement ID | FR-13, FR-18, FR-19, NFR-10 |
| Use Case ID | UC-16 |
| Test Type | Functional, Boundary |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/transactions.test.js`) |
| Test Objective | Verify that an authorized employee can withdraw cash up to and including the exact available balance down to 0.00, reducing the balance and recording a `WITHDRAWAL` transaction. |
| Preconditions | Active account exists with balance 5,000.00. Logged in as `test.employee1`. |
| Test Steps | 1. Withdraw 2,000.00. Verify balance is 3,000.00. 2. Withdraw remaining 3,000.00 (exact boundary to 0.00). Verify balance is 0.00. 3. Verify `bank_transactions` records. |
| Test Data / Input | Withdrawal 1: `amount: 2000.00`. Withdrawal 2: `amount: 3000.00`. |
| Expected Result | Both operations succeed with HTTP 201 Created. Final balance is 0.00. Distinct `WITHDRAWAL` transaction records inserted with unique reference numbers. |
| Actual Result & Evidence | Verified on 2026-10-28 in `tests/transactions.test.js` (Scenario 2, 5 tests). Zero-balance boundary withdrawal executes cleanly. |
| Status | Passed |

### TC-16 — Customer Account Details and History Retrieval

| Field | Details |
|---|---|
| Test Case ID | TC-16 |
| Requirement ID | FR-09, FR-20, NFR-03 |
| Use Case ID | UC-03, UC-05 |
| Test Type | Functional, Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/history.test.js`, `tests/customerOverview.test.js`) |
| Test Objective | Verify that an authenticated customer can retrieve their own account details and paginated transaction history in descending chronological order, but cannot access another customer's data. |
| Preconditions | Logged in as `test.customer1` (owns ACC-1). Customer `test.customer2` owns ACC-2. |
| Test Steps | 1. Send `GET /api/accounts/overview` as customer 1. 2. Send `GET /api/accounts/ACC-1/transactions`. 3. Verify transactions ordered by `created_at DESC, id DESC`. 4. Send `GET /api/accounts/ACC-2/transactions` using customer 1 session. |
| Test Data / Input | Valid customer session accessing own vs. other customer account ID. |
| Expected Result | Own accounts and transactions returned with HTTP 200 OK and pagination metadata. Cross-customer access rejected with HTTP 403 Forbidden `{ code: 'AUTH_002' }`. |
| Actual Result & Evidence | Verified across `tests/history.test.js` (Scenarios 1-14, 25 tests) and `tests/customerOverview.test.js` (Scenarios 1-8, 15 tests). Pagination and horizontal data isolation confirmed. |
| Status | Passed |

### TC-17 — Self-Service Customer Password Change

| Field | Details |
|---|---|
| Test Case ID | TC-17 |
| Requirement ID | FR-22, NFR-01 |
| Use Case ID | UC-07 |
| Test Type | Functional, Security |
| Priority | Medium |
| Verification Method | Code Inspection (`backend/routes/auth.js`) |
| Test Objective | Verify that an authenticated user can change their password via a dedicated self-service endpoint by verifying the current password and providing a new compliant password. |
| Preconditions | User is authenticated. |
| Test Steps | 1. Submit password change with incorrect current password. 2. Submit password change with correct current password and compliant new password. 3. Authenticate with old password (fails). 4. Authenticate with new password (succeeds). |
| Test Data / Input | `currentPassword: "OldPassword123!"`, `newPassword: "NewSecurePassword456!"`. |
| Expected Result | Step 1 rejected with HTTP 401. Step 2 succeeds with HTTP 200. Stored bcrypt hash updated. |
| Actual Result & Evidence | Code inspection confirms dedicated self-service `POST /api/auth/change-password` route is not yet implemented. Customer profile update exists, and password salting/storage is verified under TC-09 in `tests/auth.test.js`. |
| Status | Pending Implementation |

### TC-18 — Employee Account Lifecycle Management & Session Revocation

| Field | Details |
|---|---|
| Test Case ID | TC-18 |
| Requirement ID | FR-23, FR-24, NFR-02 |
| Use Case ID | UC-21, UC-25 |
| Test Type | Functional, Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/employees.test.js`) |
| Test Objective | Verify that an administrator can create employee accounts, update details, deactivate employees, and revoke active sessions, immediately terminating their access. |
| Preconditions | Logged in as `test.admin1`. Active employee `test.emp1` is logged in. |
| Test Steps | 1. Admin creates new employee via `POST /api/employees`. 2. Admin deactivates employee via `PATCH /api/employees/:id/status`. 3. Admin revokes sessions via `POST /api/employees/:id/revoke-sessions`. 4. Deactivated employee attempts banking operation. 5. Deactivated employee attempts login. |
| Test Data / Input | Employee creation payload; deactivation toggle `isActive: false`. |
| Expected Result | Employee created successfully. Revoke sessions purges active sessions from database session store. Deactivated employee requests rejected with HTTP 401 `AUTH_003`. Subsequent login rejected with HTTP 401 `AUTH_001`. |
| Actual Result & Evidence | Verified on 2026-11-04 in `tests/employees.test.js` (Scenarios 1-10, 53 tests). Admin employee lifecycle and dynamic mid-session revocation verified. |
| Status | Passed |

### TC-19 — Global Transaction Records Query & Multi-Parameter Filtering

| Field | Details |
|---|---|
| Test Case ID | TC-19 |
| Requirement ID | FR-21, NFR-03, NFR-06 |
| Use Case ID | UC-18, UC-24 |
| Test Type | Functional |
| Priority | Medium |
| Verification Method | Automated Integration Test (`tests/history.test.js`, `tests/reports.test.js`) |
| Test Objective | Verify that employees and administrators can query the global transaction ledger with filters for account number, transaction type, date range, and pagination. |
| Preconditions | Seeded transactions of types `DEPOSIT`, `WITHDRAWAL`, `TRANSFER_DEBIT`, `TRANSFER_CREDIT`. Logged in as `test.employee1` or `test.admin1`. |
| Test Steps | 1. Query `GET /api/reports/transactions` with `type=DEPOSIT`. 2. Query with date range `startDate` and `endDate`. 3. Query with specific account ID. 4. Verify pagination envelope (`page`, `limit`, `totalCount`, `totalPages`). |
| Test Data / Input | Query parameters: `type=DEPOSIT`, `startDate=2026-10-01`, `limit=20`. |
| Expected Result | HTTP 200 OK returned with matching records adhering strictly to filter predicates. Customers attempting to access global ledger are rejected with HTTP 403 `AUTH_002`. |
| Actual Result & Evidence | Verified across `tests/history.test.js` (Scenario 15) and `tests/reports.test.js` (Scenarios 2-4, 16 tests). Multi-criteria filtering confirmed. |
| Status | Passed |

### TC-20 — Customer Information Viewing and Profile Modification

| Field | Details |
|---|---|
| Test Case ID | TC-20 |
| Requirement ID | FR-05, FR-06, NFR-02 |
| Use Case ID | UC-06, UC-11, UC-12, UC-22 |
| Test Type | Functional |
| Priority | Medium |
| Verification Method | Automated Integration Test (`tests/customers.test.js`) |
| Test Objective | Verify that authorized staff can view and modify customer records, while customers can view only their own profile and update strictly permitted contact details. |
| Preconditions | Customer C1 exists. Logged in as `test.customer1`, `test.employee1`, and `test.admin1`. |
| Test Steps | 1. Employee updates C1's address and phone number via `PUT /api/customers/:id`. 2. Customer updates own contact info via `PUT /api/customers/profile`. 3. Customer attempts to alter identity field `fullName` or `dateOfBirth`. 4. Customer attempts to update customer C2's profile. |
| Test Data / Input | `phone: "9988776655"`, `address: "456 Oak Avenue"`. |
| Expected Result | Employee and permitted customer updates succeed with HTTP 200 OK. Customer attempts to modify immutable identity fields or access other customer records are rejected with HTTP 403 `AUTH_002`. |
| Actual Result & Evidence | Verified on 2026-10-29 in `tests/customers.test.js` (Scenarios 11-20, 15 tests). Permission boundaries between staff and customers verified. |
| Status | Passed |

### TC-21 — Role-Specific UI Navigation & Accessibility

| Field | Details |
|---|---|
| Test Case ID | TC-21 |
| Requirement ID | NFR-11, NFR-13 |
| Use Case ID | All UCs |
| Test Type | Usability, Navigation |
| Priority | Medium |
| Verification Method | Manual UI Walkthrough (Manual Browser Inspection) |
| Test Objective | Verify in the React single-page application that navigation menus dynamically adapt to the authenticated role, display only permitted actions, and provide access to core features in $\le$ 3 clicks. |
| Preconditions | Frontend running (`npm run dev`). User credentials for Customer, Employee, and Administrator available. |
| Test Steps | 1. Log in as Customer. Inspect navigation bar (Dashboard, Accounts, Transfers, Statements). Verify Employee/Admin options absent. 2. Log in as Employee. Verify Customer Management, Account Management, Transaction Desk visible. 3. Log in as Administrator. Verify System Dashboard, Employee Admin, Reports, and Fraud Management visible. 4. Count click depth from dashboard to any primary operation. |
| Test Data / Input | Interactive browser sessions for each user role. |
| Expected Result | Navigation bar reflects exact role permissions. All core actions accessible within 1 to 3 clicks. No unauthorized UI views exposed. |
| Actual Result & Evidence | Verified via manual browser inspection across Chrome and Firefox. *Note: Automated frontend UI testing is not configured in `frontend/package.json`; this verification is conducted manually.* |
| Status | Passed (Manual UI Walkthrough) |

---

## 4. Security, Isolation & Customer/Employee Services Test Cases (TC-22 to TC-32)

### TC-22 — Customer Account Balance Display & Status Clarity

| Field | Details |
|---|---|
| Test Case ID | TC-22 |
| Requirement ID | FR-11 |
| Use Case ID | UC-03 |
| Test Type | Functional, UI Support |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/customerBalanceDisplay.test.js`) |
| Test Objective | Verify that account balance retrieval displays unambiguous balances and explicit account status indicators (ACTIVE, FROZEN, INACTIVE) to prevent user confusion. |
| Preconditions | Customer owns accounts in ACTIVE, FROZEN, and INACTIVE states. |
| Test Steps | 1. Send `GET /api/accounts/overview` as customer. 2. Verify returned balance fields, currency formatting, and explicit status flags. 3. Verify frozen accounts display clear notice that transactions are suspended. |
| Test Data / Input | Customer session owning multiple accounts with varying statuses. |
| Expected Result | HTTP 200 OK. Each account payload includes exact integer/decimal balance, formatted currency string, and status code. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/customerBalanceDisplay.test.js` (Scenarios 1-8, 24 tests). Balance clarity and status distinction verified. |
| Status | Passed |

### TC-23 — Customer Horizontal Data Isolation & IDOR Defense

| Field | Details |
|---|---|
| Test Case ID | TC-23 |
| Requirement ID | NFR-01, NFR-03 |
| Use Case ID | UC-03, UC-05 |
| Test Type | Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/customerAccountIsolation.test.js`) |
| Test Objective | Verify that Customer A cannot view, query, or transact upon Customer B's accounts by manipulating account IDs in URL path parameters, query parameters, or request bodies (Insecure Direct Object Reference defense). |
| Preconditions | Customer A (ACC-A) and Customer B (ACC-B) are registered with active accounts. |
| Test Steps | 1. Authenticate as Customer A. 2. Request `GET /api/accounts/ACC-B`. 3. Request `GET /api/accounts/ACC-B/transactions`. 4. Request `POST /api/transfers` with `fromAccountId: ACC-B`. |
| Test Data / Input | Cross-customer account IDs injected into Customer A requests. |
| Expected Result | All cross-customer requests rejected with HTTP 403 Forbidden `{ code: 'AUTH_002', message: 'Unauthorized operation' }`. Zero data belonging to Customer B is leaked. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/customerAccountIsolation.test.js` (Scenarios 1-10, 25 tests). Strict ownership validation enforced on every customer endpoint. |
| Status | Passed |

### TC-24 — Secure Customer Fund Transfer & Beneficiary Verification

| Field | Details |
|---|---|
| Test Case ID | TC-24 |
| Requirement ID | FR-15, FR-16, FR-17 |
| Use Case ID | UC-04 |
| Test Type | Functional, Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/secureTransfers.test.js`) |
| Test Objective | Verify that pre-transfer beneficiary verification validates destination account existence and displays masked recipient name (e.g. "J*** D**") without exposing full customer identity, and prevents self-transfers. |
| Preconditions | Customer A and Customer B have active accounts. Logged in as Customer A. |
| Test Steps | 1. Send `POST /api/transfers/verify-beneficiary` with destination account number. 2. Verify masked name returned. 3. Attempt beneficiary verification with own account number (self-transfer). 4. Execute fund transfer and verify atomic ledger updates. |
| Test Data / Input | Destination account number ACC-B; own account number ACC-A. |
| Expected Result | Step 1 returns HTTP 200 with masked name. Step 3 rejected with HTTP 400 `{ code: 'TXN_002', message: 'Cannot transfer funds to the same account' }`. Transfer executes with idempotent balance updates. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/secureTransfers.test.js` (Scenarios 1-10, 27 tests). Masked verification and self-transfer prevention confirmed. |
| Status | Passed |

### TC-25 — Customer Account Statement Generation

| Field | Details |
|---|---|
| Test Case ID | TC-25 |
| Requirement ID | FR-19, FR-20 |
| Use Case ID | UC-05 |
| Test Type | Functional |
| Priority | Medium |
| Verification Method | Automated Integration Test (`tests/accountStatements.test.js`) |
| Test Objective | Verify that an authenticated customer can generate and download monthly and date-filtered account statements containing opening balance, closing balance, total debits, total credits, and itemized transaction rows. |
| Preconditions | Active customer account with history of deposits, withdrawals, and transfers. |
| Test Steps | 1. Send `GET /api/accounts/:id/statement?month=2026-10`. 2. Verify statement summary math: $	ext{closing} = 	ext{opening} + 	ext{credits} - 	ext{debits}$. 3. Verify itemized transaction list matches database. |
| Test Data / Input | Customer account ID, calendar month parameter. |
| Expected Result | HTTP 200 OK with statement JSON structure. Mathematical reconciliation of opening and closing balances confirmed. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/accountStatements.test.js` (Scenarios 1-5, 15 tests). Mathematical consistency and ownership checks verified. |
| Status | Passed |

### TC-26 — Transaction Digital Receipt Generation

| Field | Details |
|---|---|
| Test Case ID | TC-26 |
| Requirement ID | FR-12, FR-13 |
| Use Case ID | UC-15, UC-16 |
| Test Type | Functional |
| Priority | Medium |
| Verification Method | Automated Integration Test (`tests/transactionReceipts.test.js`) |
| Test Objective | Verify that immediately following a deposit or withdrawal, the system generates an authoritative transaction receipt payload containing transaction reference, timestamp, amount, new balance, and servicing employee ID. |
| Preconditions | Logged in as `test.employee1`. Account active. |
| Test Steps | 1. Execute cash deposit. 2. Request receipt `GET /api/transactions/:id/receipt`. 3. Verify receipt fields against database transaction record. |
| Test Data / Input | Transaction ID returned from successful deposit. |
| Expected Result | HTTP 200 OK. Receipt details match database record exactly. Unauthorized customer access to other customer receipts rejected with HTTP 403 `AUTH_002`. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/transactionReceipts.test.js` (Scenarios 1-5, 10 tests). Exact data reconciliation and RBAC verified. |
| Status | Passed |

### TC-27 — Customer Profile Security & Diagnostics Restriction

| Field | Details |
|---|---|
| Test Case ID | TC-27 |
| Requirement ID | NFR-01, NFR-03 |
| Use Case ID | UC-06 |
| Test Type | Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/customerProfileSecurity.test.js`) |
| Test Objective | Verify that customers can update only permitted profile fields, that password complexity rules are enforced, and that internal system diagnostic routes (`/api/health/system`, `/api/diagnostics`) are strictly restricted to Administrators. |
| Preconditions | Customer session established. |
| Test Steps | 1. Customer attempts profile update with password not meeting complexity policy. 2. Customer attempts to access `GET /api/diagnostics`. 3. Administrator accesses `GET /api/diagnostics`. |
| Test Data / Input | Weak password payload; diagnostic endpoint request. |
| Expected Result | Weak password rejected with HTTP 400 `VAL_001`. Customer diagnostic access rejected with HTTP 403 `AUTH_002`. Administrator access succeeds with HTTP 200 OK. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/customerProfileSecurity.test.js` (Scenario 1, 11 tests). Profile validation and diagnostics protection confirmed. |
| Status | Passed |

### TC-28 — Centralized Audit Trail Logging & Immutability

| Field | Details |
|---|---|
| Test Case ID | TC-28 |
| Requirement ID | NFR-02, NFR-03 |
| Use Case ID | All UCs |
| Test Type | Security, Compliance |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/audit.test.js`) |
| Test Objective | Verify that security-sensitive events (logins, logouts, customer updates, employee deactivations, account status changes) write immutable audit records to `audit_logs` in MySQL, and that audit logs cannot be modified or deleted via API. |
| Preconditions | Administrative session. |
| Test Steps | 1. Trigger sensitive banking operation (e.g. employee deactivation). 2. Verify audit log entry created with `actor_user_id`, `action_type`, `ip_address`, and timestamp. 3. Attempt `PUT /api/audit-logs/:id` or `DELETE /api/audit-logs/:id`. |
| Test Data / Input | Administrative operations; HTTP PUT/DELETE requests directed at audit endpoints. |
| Expected Result | Audit records created reliably. Modification and deletion requests rejected with HTTP 405 Method Not Allowed or HTTP 403 Forbidden. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/audit.test.js` (Scenarios 1-9, 27 tests). Append-only immutability and complete event capture verified. |
| Status | Passed |

### TC-29 — Employee Personal Activity History Isolation

| Field | Details |
|---|---|
| Test Case ID | TC-29 |
| Requirement ID | FR-23, NFR-01 |
| Use Case ID | UC-10, UC-13, UC-15 |
| Test Type | Functional, Security |
| Priority | Medium |
| Verification Method | Automated Integration Test (`tests/employeeActivity.test.js`) |
| Test Objective | Verify that bank employees can view their own personal activity history (deposits handled, customers registered) but are isolated from viewing other staff members' activities. |
| Preconditions | Employees E1 and E2 have performed banking transactions. |
| Test Steps | 1. Log in as Employee E1 and request `GET /api/audit-logs/my-activity`. 2. Verify returned activities match E1 actions only. 3. Pass `actorUserId=E2` in query string to attempt viewing E2 actions. |
| Test Data / Input | Employee E1 session with spoofed query parameter. |
| Expected Result | HTTP 200 OK. Server ignores client-supplied `actorUserId` and enforces session `req.session.user.id`. E2 activities are strictly excluded. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/employeeActivity.test.js` (Scenarios 1-4, 20 tests). Session-enforced activity scoping confirmed. |
| Status | Passed |

### TC-30 — Employee Banking Operations Console

| Field | Details |
|---|---|
| Test Case ID | TC-30 |
| Requirement ID | FR-09, FR-10 |
| Use Case ID | UC-11, UC-14, UC-17 |
| Test Type | Functional |
| Priority | Medium |
| Verification Method | Automated Integration Test (`tests/employeeConsole.test.js`) |
| Test Objective | Verify that bank employees can search customers by name, phone, or account number and manage account statuses via the staff console. |
| Preconditions | Logged in as `test.employee1`. Multiple customer records exist. |
| Test Steps | 1. Send `GET /api/customers?search=9876543210`. 2. Send `GET /api/accounts?search=ACC-SAV-00000001`. 3. Send `PATCH /api/accounts/:id/status` to toggle between ACTIVE and FROZEN. |
| Test Data / Input | Search strings matching phone, name, and account number. |
| Expected Result | HTTP 200 OK. Search returns exact matching records. Status toggle executes and returns updated status payload. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/employeeConsole.test.js` (Scenarios 1-3, 10 tests). Staff lookup and status management confirmed. |
| Status | Passed |

### TC-31 — Administrative Executive Dashboard Overview

| Field | Details |
|---|---|
| Test Case ID | TC-31 |
| Requirement ID | FR-25, NFR-03 |
| Use Case ID | UC-26 |
| Test Type | Functional, Reporting |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/dashboard.test.js`) |
| Test Objective | Verify that the administrative dashboard endpoint aggregates system-wide statistics (total customers, active/frozen accounts, total deposit/withdrawal volume) accurately matching MySQL records. |
| Preconditions | Seeded database with customers, accounts, and transactions. Logged in as `test.admin1`. |
| Test Steps | 1. Send `GET /api/reports/dashboard`. 2. Compare returned aggregate counts and sums directly against SQL `COUNT` and `SUM` queries. 3. Attempt access as Customer or Employee. |
| Test Data / Input | Admin session request. |
| Expected Result | HTTP 200 OK for Admin with exact matching figures. Non-admin roles rejected with HTTP 403 `AUTH_002`. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/dashboard.test.js` (Scenarios 1-7, 15 tests). Metric calculation accuracy and RBAC confirmed. |
| Status | Passed |

### TC-32 — Administrative RFC 4180 CSV Report Export & Injection Defense

| Field | Details |
|---|---|
| Test Case ID | TC-32 |
| Requirement ID | FR-25, NFR-01 |
| Use Case ID | UC-26 |
| Test Type | Functional, Security |
| Priority | Medium |
| Verification Method | Automated Integration Test (`tests/reportExports.test.js`) |
| Test Objective | Verify that administrators can export transaction, customer, and account reports as streaming RFC 4180 compliant CSV files, and that cells beginning with formula characters (`=`, `+`, `-`, `@`) are sanitized to prevent CSV injection attacks. |
| Preconditions | Seeded records including a customer whose name begins with `=cmd|...`. Logged in as `test.admin1`. |
| Test Steps | 1. Send `GET /api/reports/transactions/export?format=csv`. 2. Verify `Content-Type: text/csv` and `Content-Disposition` attachment headers. 3. Send `GET /api/reports/customers/export?format=csv`. 4. Inspect formula cell to verify single quote prefix sanitization. |
| Test Data / Input | Customer record with formula injection payload. |
| Expected Result | Valid RFC 4180 CSV streamed with 200 OK. Formula characters sanitized with leading apostrophe (`'=...`). Unauthorized roles rejected with 403 `AUTH_002`. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/reportExports.test.js` (Scenarios 1-9, 24 tests). CSV streaming, formatting, and injection defense confirmed. |
| Status | Passed |

---

## 5. Dual-Datastore Foundation & Rule-Driven Fraud Detection Test Cases (TC-33 to TC-38)

> **Important Notice on Fraud Classifications:**  
> Fraud evaluations execute **after** banking transactions have successfully completed. Classification values (`APPROVED`, `REVIEW_REQUIRED`, `FLAGGED`) represent post-transaction analytical risk levels for fraud monitoring. They do not alter or reverse transaction execution.

### TC-33 — MongoDB Dual-Datastore Foundation & Schema Validation

| Field | Details |
|---|---|
| Test Case ID | TC-33 |
| Requirement ID | UC-27, UC-28, UC-29, UC-30, UC-31 |
| Use Case ID | UC-27, UC-30 |
| Test Type | Data Integrity |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/mongoFoundation.test.js`) |
| Test Objective | Verify that MongoDB collections (`fraud_rules`, `fraud_assessments`, `fraud_alerts`, `fraud_investigations`) initialize with strict JSON Schema validators enforcing data types, mandatory fields, and compound indexes for fast analytical queries. |
| Preconditions | MongoDB service running on configured URI. |
| Test Steps | 1. Verify existence of the 4 fraud collections. 2. Attempt insertion of an assessment document missing mandatory `transaction_id`. 3. Attempt insertion with invalid risk classification enum (`"INVALID"`). 4. Inspect collection indexes. |
| Test Data / Input | Malformed assessment document missing required fields. |
| Expected Result | Schema validator rejects invalid document with MongoServerError (code 121 / Document failed validation). Indexes on `transaction_id`, `account_id`, `created_at`, and `status` exist. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/mongoFoundation.test.js` (Scenario 1, 9 tests). Schema enforcement and index setup confirmed. |
| Status | Passed |

### TC-34 — Fraud Detection Rule Engine: HIGH_AMOUNT Evaluation

| Field | Details |
|---|---|
| Test Case ID | TC-34 |
| Requirement ID | UC-27, UC-30 |
| Use Case ID | UC-27, UC-30 |
| Test Type | Analytical, Logic |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudEngine.test.js`, `tests/fraudPipelineBugInvestigation.test.js`) |
| Test Objective | Verify that the `HIGH_AMOUNT` rule triggers if and only if the transaction amount is strictly greater than the configured threshold (`amount > threshold`), evaluated using integer paise precision to eliminate floating-point rounding errors. |
| Preconditions | Default rule configuration: threshold = 200,000.00 INR (20,000,000 paise). |
| Test Steps | 1. Evaluate transaction with amount 199,999.99 INR. 2. Evaluate transaction with amount exactly 200,000.00 INR (boundary condition). 3. Evaluate transaction with amount 200,000.01 INR. |
| Test Data / Input | Transaction amounts: 19,999,999 paise, 20,000,000 paise, 20,000,001 paise. |
| Expected Result | Boundary 200,000.00 INR does **not** trigger (`triggered: false`). Amount 200,000.01 INR triggers (`triggered: true`). Strict inequality verified. |
| Actual Result & Evidence | Verified across `tests/fraudEngine.test.js` (Scenarios 1-3) and `tests/fraudPipelineBugInvestigation.test.js` (Scenarios 1-3). Integer paise threshold precision confirmed. |
| Status | Passed |

### TC-35 — Fraud Detection Rule Engine: HIGH_VELOCITY Evaluation

| Field | Details |
|---|---|
| Test Case ID | TC-35 |
| Requirement ID | UC-27, UC-30 |
| Use Case ID | UC-27, UC-30 |
| Test Type | Analytical, Logic |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudEngine.test.js`, `tests/fraudPipelineBugInvestigation.test.js`) |
| Test Objective | Verify that the `HIGH_VELOCITY` rule counts all transactions (debits and credits) on the source account within the configured sliding time window, and triggers if and only if the count is strictly greater than the configured threshold. |
| Preconditions | Default rule configuration: `windowMinutes: 60`, `threshold: 5` transactions. |
| Test Steps | 1. Seed 4 prior transactions on account within 60 minutes. Current transaction is 5th. Evaluate rule. 2. Seed 5 prior transactions within 60 minutes. Current transaction is 6th. Evaluate rule. 3. Verify transactions outside the 60-minute window are excluded. |
| Test Data / Input | Seeded transactions within and outside sliding window boundary. |
| Expected Result | 5th transaction does not trigger (count $5 \le 5$). 6th transaction triggers (count $6 > 5$). Transactions older than 60 minutes are not counted. |
| Actual Result & Evidence | Verified across `tests/fraudEngine.test.js` (Scenarios 4-6) and `tests/fraudPipelineBugInvestigation.test.js` (Scenarios 4-6). Sliding-window boundary logic confirmed. |
| Status | Passed |

### TC-36 — Fraud Detection Rule Engine: NEW_BENEFICIARY Evaluation

| Field | Details |
|---|---|
| Test Case ID | TC-36 |
| Requirement ID | UC-27, UC-30 |
| Use Case ID | UC-27, UC-30 |
| Test Type | Analytical, Logic |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudEngine.test.js`) |
| Test Objective | Verify that the `NEW_BENEFICIARY` rule triggers for fund transfers when the sender account has zero prior completed transfers to the destination account, and does not trigger on non-transfer transactions or repeat transfers. |
| Preconditions | Account ACC-S has never transferred to ACC-D1; has transferred 2 times to ACC-D2. |
| Test Steps | 1. Evaluate fund transfer ACC-S $	o$ ACC-D1. 2. Evaluate fund transfer ACC-S $	o$ ACC-D2. 3. Evaluate cash deposit to ACC-S. |
| Test Data / Input | Transfer transactions with new vs. existing beneficiary accounts. |
| Expected Result | Transfer to ACC-D1 triggers (`triggered: true`). Transfer to ACC-D2 does not trigger (`triggered: false`). Cash deposit does not trigger. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/fraudEngine.test.js` (Scenarios 7-9, 6 tests). Prior transfer counting logic verified. |
| Status | Passed |

### TC-37 — Fraud Detection Rule Engine: UNUSUAL_HOUR Evaluation

| Field | Details |
|---|---|
| Test Case ID | TC-37 |
| Requirement ID | UC-27, UC-30 |
| Use Case ID | UC-27, UC-30 |
| Test Type | Analytical, Logic |
| Priority | Medium |
| Verification Method | Automated Integration Test (`tests/fraudEngine.test.js`) |
| Test Objective | Verify that the `UNUSUAL_HOUR` rule evaluates transaction timestamps against the configured night window (default 23:00 to 06:00) using the configured operational timezone (Asia/Kolkata), handling overnight window wrapping. |
| Preconditions | Default window: `startHour: 23`, `endHour: 6`, `timezone: "Asia/Kolkata"`. |
| Test Steps | 1. Evaluate transaction at 14:30 IST. 2. Evaluate transaction at 23:15 IST. 3. Evaluate transaction at 03:45 IST. 4. Evaluate transaction at 06:00 IST (boundary). |
| Test Data / Input | UTC timestamps corresponding to specific local Asia/Kolkata hours. |
| Expected Result | 14:30 and 06:00 do not trigger. 23:15 and 03:45 trigger (`triggered: true`). |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/fraudEngine.test.js` (Scenarios 10-12, 5 tests). Timezone localization and overnight window wrapping confirmed. |
| Status | Passed |

### TC-38 — Fraud Risk Scoring, Weight Calibration & Analytical Classification

| Field | Details |
|---|---|
| Test Case ID | TC-38 |
| Requirement ID | UC-28, NFR-08 |
| Use Case ID | UC-28 |
| Test Type | Analytical, Risk |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudEngine.test.js`) |
| Test Objective | Verify that risk scores (0–100) are computed accurately as the sum of triggered rule weights, capped at 100, mapped to risk levels (LOW, MEDIUM, HIGH), and assigned post-transaction analytical classifications (`APPROVED`, `REVIEW_REQUIRED`, `FLAGGED`). |
| Preconditions | Default weights: HIGH_AMOUNT (40), HIGH_VELOCITY (30), NEW_BENEFICIARY (20), UNUSUAL_HOUR (15). Thresholds: LOW (<30), MEDIUM (30–69), HIGH ($\ge$ 70). |
| Test Steps | 1. Zero rules trigger: verify score = 0, LOW, `APPROVED`. 2. NEW_BENEFICIARY triggers: score = 20, LOW, `APPROVED`. 3. HIGH_AMOUNT triggers: score = 40, MEDIUM, `REVIEW_REQUIRED`. 4. All 4 rules trigger: score = 105 $	o$ capped at 100, HIGH, `FLAGGED`. |
| Test Data / Input | Simulated rule trigger combinations. |
| Expected Result | Precise score computation, clamping at 100, and analytical classification mapping verified. Financial transaction remains executed regardless of risk level. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/fraudEngine.test.js` (Scenarios 13-16, 8 tests). Weight summation and risk classification confirmed. |
| Status | Passed |

---

## 6. Transactional Outbox Subsystem & Polling Worker Test Cases (TC-39 to TC-41)

### TC-39 — Transactional Outbox Atomic Staging & MySQL State Preservation

| Field | Details |
|---|---|
| Test Case ID | TC-39 |
| Requirement ID | UC-27, NFR-09 |
| Use Case ID | UC-27 |
| Test Type | Reliability, Integration |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudOutboxIntegration.test.js`) |
| Test Objective | Verify that every banking transaction atomically stages an event payload into the MySQL `fraud_outbox` table within the same database transaction, ensuring zero loss of fraud evaluation events. |
| Preconditions | MySQL connection active. Outbox table initialized. |
| Test Steps | 1. Execute fund transfer. 2. Verify `bank_transactions` ledger updated. 3. Verify exactly one record in `fraud_outbox` with matching `transaction_id`, `event_type = 'TRANSACTION_CREATED'`, and `status = 'PENDING'`. 4. Simulate failure during ledger commit; verify outbox record is rolled back. |
| Test Data / Input | Valid fund transfer payload and failed transfer attempt. |
| Expected Result | Staged outbox record created atomically with transaction commit. Rolled-back transaction leaves zero outbox records. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/fraudOutboxIntegration.test.js` (Scenarios 1-3, 8 tests). Atomic staging and ACID rollback confirmed. |
| Status | Passed |

### TC-40 — Outbox Polling Worker Leasing, Heartbeat & Stale Recovery

| Field | Details |
|---|---|
| Test Case ID | TC-40 |
| Requirement ID | UC-27, NFR-09 |
| Use Case ID | UC-27 |
| Test Type | Reliability, Concurrency |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudOutboxIntegration.test.js`) |
| Test Objective | Verify that the asynchronous outbox worker claims pending events using row-level locking (`SELECT ... FOR UPDATE SKIP LOCKED`), establishes a 60-second lease, renews heartbeats every 20 seconds, and reclaims abandoned leases after worker crashes. |
| Preconditions | Seeded pending events in `fraud_outbox`. Worker instance running. |
| Test Steps | 1. Worker polls and claims batch; verify `status = 'PROCESSING'` and `locked_by` set. 2. Launch concurrent second worker; verify it skips locked rows. 3. Simulate slow processing; verify lease heartbeat update. 4. Simulate crashed worker; advance lease clock past 60s; verify second worker reclaims stale record. |
| Test Data / Input | Concurrent worker instances and expired lease timestamps. |
| Expected Result | `SKIP LOCKED` prevents double-processing. Expired leases reclaimed cleanly without event loss. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/fraudOutboxIntegration.test.js` (Scenarios 4-7, 12 tests). Concurrency protection and stale lease recovery confirmed. |
| Status | Passed |

### TC-41 — Outbox Worker Exponential Retry Backoff & Failure Capture

| Field | Details |
|---|---|
| Test Case ID | TC-41 |
| Requirement ID | UC-27, NFR-09 |
| Use Case ID | UC-27 |
| Test Type | Reliability, Fault Tolerance |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudOutboxIntegration.test.js`) |
| Test Objective | Verify that when MongoDB is temporarily unreachable or an evaluation fails, the outbox worker increments retry count, applies exponential backoff, and eventually marks the event as `FAILED` with captured error details after reaching `max_retries`. |
| Preconditions | Pending outbox event. Simulated transient error in MongoDB connector. |
| Test Steps | 1. Worker encounters evaluation error on attempt 1. Verify `retry_count = 1`, `status = 'PENDING'`, and exponential backoff delay applied. 2. Simulate repeated failures up to `max_retries` (default 5). 3. Verify event transitions to `status = 'FAILED'` with error stack captured. |
| Test Data / Input | Simulated network timeout during MongoDB insert. |
| Expected Result | Exponential backoff prevents storming. Final failure captured with complete diagnostic metadata for administrator review. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/fraudOutboxIntegration.test.js` (Scenarios 8-10, 8 tests). Exponential backoff and Dead Letter Queue (DLQ) state confirmed. |
| Status | Passed |

---

## 7. Fraud Alert Policy, Dashboard & Case Investigation Test Cases (TC-42 to TC-45)

### TC-42 — Fraud Alert Generation Policy Guarantee

| Field | Details |
|---|---|
| Test Case ID | TC-42 |
| Requirement ID | UC-27 |
| Use Case ID | UC-27 |
| Test Type | Policy, Analytical |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudAlertPolicyCorrection.test.js`) |
| Test Objective | Verify that every transaction that triggers one or more fraud rules generates an alert document in `fraud_alerts`, regardless of whether the aggregate risk score is LOW, MEDIUM, or HIGH, ensuring zero alert suppression. |
| Preconditions | Assessment completed with 1 rule triggered (`NEW_BENEFICIARY`, score 20, LOW). |
| Test Steps | 1. Process assessment where single rule triggered. 2. Verify alert inserted in `fraud_alerts`. 3. Verify alert references `assessment_id`, triggered rules array, severity, and `status = 'OPEN'`. 4. Process transaction where zero rules triggered; verify no alert inserted. |
| Test Data / Input | Single-rule vs. zero-rule transaction evaluations. |
| Expected Result | 100% alert creation for any triggered rule. Zero alerts created for clean transactions. |
| Actual Result & Evidence | Verified on 2026-11-06 in `tests/fraudAlertPolicyCorrection.test.js` (Scenarios 1-4, 13 tests). Policy guarantee and schema alignment confirmed. |
| Status | Passed |

### TC-43 — Fraud Investigation Lifecycle Management & State Machine

| Field | Details |
|---|---|
| Test Case ID | TC-43 |
| Requirement ID | UC-29 |
| Use Case ID | UC-29 |
| Test Type | Workflow, Integrity |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudDashboard.test.js`) |
| Test Objective | Verify that authorized staff can initiate investigations on flagged alerts, transition statuses across the state machine (`UNDER_INVESTIGATION` $	o$ `CONFIRMED_FRAUD` / `FALSE_POSITIVE` / `RESOLVED_NO_ACTION`), and append immutable audit notes. |
| Preconditions | Open alert exists in MongoDB. Logged in as `test.admin1` or `test.employee1`. |
| Test Steps | 1. Create investigation via `POST /api/fraud/investigations`. Verify initial status `UNDER_INVESTIGATION`. 2. Add investigator note via `POST /api/fraud/investigations/:id/notes`. 3. Update status to `CONFIRMED_FRAUD` with disposition details. 4. Verify invalid status transition rejected. |
| Test Data / Input | Status updates and investigator case notes. |
| Expected Result | State machine transitions follow valid paths. Notes append with author ID and ISO timestamp. Illegal transitions rejected with HTTP 400 `VAL_001`. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/fraudDashboard.test.js` (Scenarios 5-8, 16 tests). Investigation state machine and notes trail confirmed. |
| Status | Passed |

### TC-44 — Fraud Dynamic Rule Configuration & Threshold Management

| Field | Details |
|---|---|
| Test Case ID | TC-44 |
| Requirement ID | UC-30 |
| Use Case ID | UC-30 |
| Test Type | Functional, Security |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudDashboard.test.js`) |
| Test Objective | Verify that administrators can view all configured fraud rules, toggle rules enabled/disabled, update threshold and weight parameters with schema validation, and that non-admin roles are denied access. |
| Preconditions | 4 standard rules loaded in MongoDB `fraud_rules`. |
| Test Steps | 1. Administrator sends `GET /api/fraud/rules`. 2. Update `HIGH_AMOUNT` threshold via `PATCH /api/fraud/rules/HIGH_AMOUNT`. 3. Toggle `UNUSUAL_HOUR` `enabled: false`. 4. Employee attempts rule update. |
| Test Data / Input | Rule threshold modifications; unauthorized employee request. |
| Expected Result | Admin updates succeed with HTTP 200 OK and updated rule payload. Employee request rejected with HTTP 403 `AUTH_002`. Invalid threshold (negative or non-numeric) rejected with HTTP 400. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/fraudDashboard.test.js` (Scenarios 9-12, 14 tests). Dynamic reconfiguration and RBAC protection confirmed. |
| Status | Passed |

### TC-45 — Fraud Analytics & Aggregations Dashboard

| Field | Details |
|---|---|
| Test Case ID | TC-45 |
| Requirement ID | UC-31 |
| Use Case ID | UC-31 |
| Test Type | Reporting, Analytics |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudDashboard.test.js`) |
| Test Objective | Verify that the fraud dashboard endpoint `GET /api/fraud/stats` aggregates MongoDB assessment, alert, and investigation metrics (total alerts, open investigations, risk tier breakdown, top triggered rules) accurately matching stored documents. |
| Preconditions | Seeded assessments and alerts in MongoDB. Logged in as `test.admin1`. |
| Test Steps | 1. Send `GET /api/fraud/stats`. 2. Verify returned counts against direct MongoDB aggregation pipelines. 3. Filter by date window (24h, 7d, 30d). |
| Test Data / Input | Administrator session query with date filters. |
| Expected Result | HTTP 200 OK. Metric counts, percentages, and risk distributions match MongoDB data. Non-admin roles rejected with HTTP 403 `AUTH_002`. |
| Actual Result & Evidence | Verified on 2026-11-05 in `tests/fraudDashboard.test.js` (Scenarios 1-4, 14 tests). Analytics aggregation accuracy confirmed. |
| Status | Passed |

---

## 8. End-to-End Banking-to-Fraud Integration Regression Test Cases (TC-46)

### TC-46 — End-to-End Banking-to-Fraud Integration Regression

| Field | Details |
|---|---|
| Test Case ID | TC-46 |
| Requirement ID | All FRs, All NFRs, UC-27–UC-31 |
| Use Case ID | All UCs |
| Test Type | Integration, Regression |
| Priority | High |
| Verification Method | Automated Integration Test (`tests/fraudRegressionDebugging.test.js`) |
| Test Objective | Verify the entire end-to-end operational pipeline across the dual-datastore architecture: Customer logs in $	o$ executes high-value fund transfer $	o$ MySQL balance updated atomically $	o$ outbox event staged $	o$ worker claims event via `SKIP LOCKED` $	o$ fraud engine evaluates rules $	o$ assessment and alert created in MongoDB $	o$ Administrator views fraud dashboard and opens investigation. |
| Preconditions | Full application stack running with MySQL and MongoDB test instances. |
| Test Steps | 1. Authenticate Customer. 2. Execute transfer > 200,000 INR to new beneficiary. 3. Verify MySQL balances and outbox row. 4. Trigger outbox worker cycle. 5. Verify MongoDB assessment (`status = 'FLAGGED'`) and alert created. 6. Authenticate Admin and retrieve fraud alerts. 7. Update investigation status to `UNDER_INVESTIGATION`. |
| Test Data / Input | Complete end-to-end transaction payload across banking and fraud subsystems. |
| Expected Result | Seamless execution across the entire pipeline: financial ledger updated instantly; asynchronous fraud processing completes reliably; administrative alert surfaced without blocking customer funds. |
| Actual Result & Evidence | Verified on 2026-11-06 in `tests/fraudRegressionDebugging.test.js` (12-point regression suite, 12 tests). Complete end-to-end pipeline integrity confirmed. |
| Status | Passed |

---

## 9. Verification Summary & Subsystem Coverage

| Subsystem | Target Test Cases | Automated Test Suite Files | Total Implemented Tests | Overall Status |
| :--- | :--- | :--- | :-: | :--- |
| **Authentication & RBAC** | TC-01, TC-02, TC-03, TC-09, TC-13 | `auth.test.js`, `health.test.js` | 26 tests | **100% Passed** |
| **Customer Administration** | TC-04, TC-20 | `customers.test.js` | 30 tests | **100% Passed** |
| **Account Management** | TC-08, TC-14, TC-30 | `accounts.test.js`, `employeeConsole.test.js` | 52 tests | **100% Passed** |
| **Banking Ledger Operations** | TC-05, TC-06, TC-07, TC-10, TC-15 | `transactions.test.js`, `transfers.test.js` | 63 tests | **100% Passed** |
| **Customer Security & Isolation** | TC-16, TC-22, TC-23, TC-24, TC-27 | `customerOverview.test.js`, `customerAccountIsolation.test.js`, `customerBalanceDisplay.test.js`, `secureTransfers.test.js`, `customerProfileSecurity.test.js` | 102 tests | **100% Passed** |
| **Receipts & Statements** | TC-25, TC-26 | `accountStatements.test.js`, `transactionReceipts.test.js` | 25 tests | **100% Passed** |
| **Staff Administration & Auditing** | TC-18, TC-28, TC-29 | `employees.test.js`, `audit.test.js`, `employeeActivity.test.js` | 100 tests | **100% Passed** |
| **Transaction History & Reporting** | TC-11, TC-19, TC-31, TC-32 | `history.test.js`, `reports.test.js`, `dashboard.test.js`, `reportExports.test.js` | 80 tests | **100% Passed** |
| **MongoDB Foundation** | TC-33 | `mongoFoundation.test.js` | 9 tests | **100% Passed** |
| **Fraud Detection Rule Engine** | TC-34, TC-35, TC-36, TC-37, TC-38 | `fraudEngine.test.js`, `fraudPipelineBugInvestigation.test.js` | 46 tests | **100% Passed** |
| **Transactional Outbox Worker** | TC-39, TC-40, TC-41 | `fraudOutboxIntegration.test.js` | 28 tests | **100% Passed** |
| **Fraud Alerts & Investigations** | TC-42, TC-43, TC-44, TC-45 | `fraudAlertPolicyCorrection.test.js`, `fraudDashboard.test.js` | 57 tests | **100% Passed** |
| **End-to-End Regression** | TC-46 | `fraudRegressionDebugging.test.js` | 12 tests | **100% Passed** |
| **Frontend UI Navigation** | TC-21 | Manual Browser Walkthrough | Manual Walkthrough | **Passed (Manual UI Walkthrough)** |
| **Self-Service Password Change** | TC-17 | Pending API route | Code Inspection | **Pending Implementation** |
| **Grand Total** | **46 Test Cases** | **28 Automated Test Suites** | **630 Automated Tests** | **Comprehensive Backend Coverage** |
