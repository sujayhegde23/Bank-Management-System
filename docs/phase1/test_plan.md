# Software Test Plan

## Bank Management System

| Item | Details |
|---|---|
| Document | Software Test Plan |
| Project | Bank Management System (academic prototype) |
| Phase | Phase 1: Test Planning, Execution Tracking & Traceability |
| Version | 1.2 |
| Date | 22 October 2026 |
| Standard followed | IEEE Std 829-2008 structure, aligned with ISO/IEC/IEEE 29119-3 |
| Related documents | [SRS](SRS.md), [Architecture and Design Specification](architecture_design.md), [RTM](rtm.md) |

### Revision History

| Version | Date | Description |
|---|---|---|
| 1.0 | 29 Sep 2026 | Baseline IEEE-style Software Test Plan for Phase 1 requirements. All test cases in planned/Not Executed state. |
| 1.1 | 21 Oct 2026 | Technology stack alignment with React/Vite, Node.js/Express, and MySQL InnoDB; corrected Section 4.12 review cross-references. |
| 1.2 | 22 Oct 2026 | Task/Issue #13: Test plan execution tracking and RTM alignment following Issue #15 (application scaffold & database schema) and Issue #5 (user authentication and session management). Recorded actual results and evidence for 26 automated backend tests, frontend build/lint verification, and manual browser testing; established explicit test execution statuses. |

> **Current Implementation & Execution State:** The foundation and authentication modules have been implemented
> (Issue #15 application scaffold, MySQL schema, and health diagnostics; Issue #5 user login, session management,
> and RBAC middleware). 26 backend integration tests (in `tests/auth.test.js` and `tests/health.test.js`) have been
> executed and passed with 100% success rate, alongside verified frontend builds and manual browser authentication tests.
> Test cases covering these implemented features (TC-01, TC-02, TC-09, TC-13, REV-01, REV-02, REV-03) are marked
> as **Passed**. Tests covering transactional banking workflows, account management, customer administration,
> and reporting remain **Pending Implementation** as their respective features are scheduled for subsequent sprints.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Test Items](#2-test-items)
3. [Features to be Tested](#3-features-to-be-tested)
4. [Test Approach](#4-test-approach)
5. [Test Environment and Validation](#5-test-environment-and-validation)
6. [Entry and Exit Criteria](#6-entry-and-exit-criteria)
7. [Test Deliverables](#7-test-deliverables)
8. [Test Cases](#8-test-cases)
9. [Test Traceability Matrix](#9-test-traceability-matrix)
10. [Roles, Schedule and Risks](#10-roles-schedule-and-risks)

---

## 1. Introduction

### 1.1 Purpose

This test plan describes the scope, approach, environment, security validation,
test cases and traceability for testing the Bank Management System. It ensures
that every requirement in the [SRS](SRS.md) is verified before the prototype is
demonstrated.

### 1.2 Scope

Testing covers the functional requirements FR-01 to FR-25 and the non-functional
requirements NFR-01 to NFR-18 defined in the [SRS](SRS.md), for all three user
roles: Customer, Bank Employee and Administrator.

Testing is performed on the academic prototype in a local environment using
dummy data only. Load testing at production scale, penetration testing by
external specialists, and testing of out-of-scope features (UPI, payment
gateways, loans, inter-bank settlement) are not included.

### 1.3 Objectives

1. Verify that every functional requirement behaves as specified in its
   acceptance criterion.
2. Verify that security controls prevent unauthorized access and protect
   passwords, balances and transaction records (SO-01 to SO-04).
3. Verify that financial operations are atomic and keep balances consistent.
4. Verify that response times meet NFR-06 and NFR-07 under normal prototype
   usage.
5. Record defects and confirm they are fixed before the final demonstration.
6. Maintain traceability from each requirement to at least one verification
   activity.

### 1.4 References

1. IEEE Std 829-2008, *IEEE Standard for Software and System Test
   Documentation*.
2. ISO/IEC/IEEE 29119-3:2021, *Software testing — Part 3: Test documentation*.
3. [Software Requirements Specification](SRS.md)
4. [Software Architecture and Design Specification](architecture_design.md)
5. [Actors and Use Cases](actors_usecases.md)
6. [Requirement Traceability Matrix](rtm.md)
7. [Feasibility Study](feasibility_study.md)

### 1.5 Definitions

| Term | Meaning |
|---|---|
| Test case (TC) | A set of preconditions, inputs, steps and expected results used to verify a requirement |
| Negative test | A test that uses invalid input or an unauthorized action and expects the system to reject it |
| Boundary value | A value at the edge of a valid range, such as an amount equal to the account balance |
| Defect | A difference between the expected result and the actual result |
| Test data reset | Restoring the database to the baseline test data set (Section 5) |

---

## 2. Test Items

The test items are the planned modules of the system, as defined in the
[Architecture and Design Specification](architecture_design.md#4-component-architecture).

| Test Item | Architecture Component & Technology | Requirements |
|---|---|---|
| User Interface | Web User Interface (React SPA built with Vite) | NFR-11, NFR-12, NFR-13 |
| Authentication & Session | Authentication & Authorization Service (Express middleware & service) | FR-01, FR-02, FR-03, FR-22, NFR-01, NFR-02, NFR-05 |
| Customer Management | Customer Service (Node.js service layer) | FR-04, FR-05, FR-06 |
| Account Management | Account Service (Node.js service layer) | FR-07, FR-08, FR-09, FR-10, FR-11 |
| Deposit & Withdrawal | Transaction Service (Node.js service layer) | FR-11, FR-12, FR-13, FR-14, FR-18, FR-19 |
| Fund Transfer | Transaction Service (Node.js service layer) | FR-11, FR-15, FR-16, FR-17, FR-18, FR-19 |
| Transaction History & Records | Transaction Service (Node.js service layer) | FR-20, FR-21 |
| Employee Administration | Employee Administration Service (Node.js service layer) | FR-23, FR-24 |
| Administrative Reporting | Reporting Service (Node.js service layer) | FR-25 |
| Input Validation | Input Validation (Express request middleware) | NFR-04, NFR-18 |
| Data Access & Storage | Data Access Layer (Node.js) & MySQL Relational Database | NFR-08, NFR-09, NFR-10, NFR-16, NFR-17 |

---

## 3. Features to be Tested

### 3.1 Functional Features

| Feature | Requirement IDs | Test Cases |
|---|---|---|
| Login with valid and invalid credentials | FR-01 | TC-01, TC-02 |
| Logout and session invalidation | FR-02 | TC-13 |
| Role-based access to functions | FR-03 | TC-03 |
| Customer registration | FR-04 | TC-04 |
| Viewing and updating customer information | FR-05, FR-06 | TC-20 |
| Account creation and unique account numbers | FR-07, FR-08 | TC-14 |
| Viewing account details and balance | FR-09 | TC-16 |
| Account status management and restrictions | FR-10, FR-11 | TC-08 |
| Deposit | FR-12 | TC-05 |
| Withdrawal, including insufficient balance | FR-13, FR-14 | TC-15, TC-06 |
| Fund transfer, including balance check | FR-15, FR-16, FR-17 | TC-07 |
| Transaction IDs and transaction records | FR-18, FR-19 | TC-05, TC-07, TC-15 |
| Customer transaction history | FR-20 | TC-16 |
| Employee and administrator transaction view | FR-21 | TC-19 |
| Password change | FR-22 | TC-17 |
| Employee account creation and deactivation | FR-23, FR-24 | TC-18 |
| Basic reports | FR-25 | TC-19 |

### 3.2 Non-Functional Features

| Feature | Requirement IDs | Test Cases / Activities |
|---|---|---|
| Password storage | NFR-01 | TC-09, TC-17 |
| Role-based access and data access security | NFR-02, NFR-03 | TC-03, TC-16 |
| Input validation | NFR-04, NFR-18 | TC-12, TC-04 |
| Authentication before sensitive operations | NFR-05 | TC-03, TC-13 |
| Response time | NFR-06, NFR-07 | TC-11 |
| Balance consistency | NFR-08, NFR-17 | TC-07, TC-10 |
| Transaction atomicity | NFR-09 | TC-10 |
| Transaction record accuracy | NFR-10 | TC-05, TC-07, TC-15 |
| Role-specific navigation | NFR-11, NFR-13 | TC-21 |
| Meaningful error messages | NFR-12 | TC-02, TC-06, TC-12 |
| Modular structure and code documentation | NFR-14, NFR-15 | Code review REV-01, REV-02 (Section 4.12) |
| Unique identifiers | NFR-16 | TC-04, TC-14 |

### 3.3 Features Not to be Tested

| Feature | Reason |
|---|---|
| UPI, payment gateway, card processing, loans, inter-bank settlement | Out of scope ([SRS](SRS.md#12-scope)) |
| High-volume load and stress testing | The prototype is only required to support normal prototype usage (SRS A-02) |
| External penetration testing | Not required in Phase 1; basic security validation is done instead (Section 5.1) |
| Browser compatibility beyond the browsers listed in Section 5 | Limited academic resources |

---

## 4. Test Approach

Testing follows a layered verification strategy across the three architectural tiers:
the **React frontend**, the **Node.js/Express backend API**, and the **MySQL database**.

> **Note on Execution Status:** Testing is conducted incrementally across project sprints.
> In Sprint 1 (Foundation & Authentication), the application structure, MySQL schema, API health diagnostics,
> user login, session management, and server-side RBAC middleware were implemented and verified with 26 automated
> tests and browser validation. Corresponding test cases (TC-01, TC-02, TC-09, TC-13) and reviews (REV-01, REV-02, REV-03)
> have been executed and marked **Passed**. Test cases for pending functional modules (Customer, Account,
> Transaction, Employee Admin, Reporting) remain in the **Pending Implementation** state. Load performance testing (TC-11)
> remains in the **Not Executed** state until the database is loaded with target scale fixtures.

### 4.1 Frontend Testing (React with Vite)

Frontend testing verifies the user interface components and client-side behavior:

1. **Component Rendering & State Management:** Verify that React components render the expected forms, controls, tables, and dashboards for each user role without errors.
2. **Client-Side Input Validation:** Verify that basic client-side form validation (e.g. required fields, valid email syntax, positive numeric amounts) triggers clear user guidance before form submission.
3. **Role-Specific Views and Navigation:** Verify that the navigation menu renders strictly role-permitted actions (NFR-11) and that all permitted core features are accessible within at most 3 navigation steps (NFR-13).
4. **API Integration & Error Display:** Verify that asynchronous HTTP requests correctly handle response payloads, loading states, and error responses, displaying safe user-friendly messages without exposing system internals (NFR-12).

### 4.2 Backend & REST API Testing (Node.js with Express)

Backend testing verifies the Express application layer independently of the UI:

1. **Endpoint Routing & Payloads:** Call planned REST endpoints directly using an API client (such as Postman or curl) or automated HTTP test utilities (e.g., Supertest), verifying HTTP status codes and structured JSON response schemas (Section 9 of [Architecture Specification](architecture_design.md#9-api-design)).
2. **Authentication & Session Lifecycle:** Test login (`POST /api/auth/login`), password validation against salted hashes, session creation, session invalidation on logout (`POST /api/auth/logout`), session expiry after inactivity, and rejection of protected calls without a valid session (`AUTH_003`).
3. **Role-Based Authorization (RBAC):** Verify that Express authorization middleware intercepts and denies unauthorized role requests with `AUTH_002` across every protected route.
4. **Error Handling Middleware:** Verify that the central Express error-handling middleware intercepts thrown exceptions and returns standardized error codes without stack traces or SQL syntax (NFR-12).

### 4.3 Database Interaction & Persistence Testing (MySQL)

Database testing verifies direct interactions between the Node.js Data Access Layer and the MySQL database:

1. **Parameterized Queries:** Verify through code inspection and dynamic testing that all database operations use parameterized queries, ensuring that user input is treated strictly as data parameters to help prevent SQL injection when used correctly (NFR-04, SV-06).
2. **Schema & Constraint Validation:** Verify that MySQL primary keys, foreign keys, unique constraints (account numbers, usernames, transaction references), NOT NULL constraints, and `CHECK (balance >= 0)` prevent corrupt or duplicate records from being stored (NFR-16, NFR-18, REV-03).
3. **Connection Management:** Verify connection pool initialization, error recovery, and proper release of client connections back to the pool after query execution.

### 4.4 Authorization & Input Validation Testing

Validation and authorization testing ensures that security controls cannot be bypassed:

1. **Server-Side Input Validation:** Submit empty strings, boundary values, malformed data types, overlong strings, and SQL injection strings (`' OR '1'='1`) to verify rejection with `VAL_001` before reaching business services (NFR-04, NFR-18).
2. **Customer Data Ownership:** Verify horizontal privilege separation (SV-09, TC-16): when Customer C1 requests data or transactions belonging to Customer C2, the backend rejects the request with `AUTH_002` and returns no data.
3. **Privilege Escalation Prevention:** Verify vertical separation: ensure Customer and Employee users cannot access administrative endpoints (`POST /api/employees`, `GET /api/reports/summary`).

### 4.5 Financial Transaction Integrity & Concurrency Testing

Financial operations require strict ACID guarantees:

1. **Atomicity & Consistency:** Test deposits (TC-05), withdrawals (TC-06, TC-15), and fund transfers (TC-07) to verify that balance updates and transaction records (`BANK_TRANSACTION`) are committed together inside a single database transaction. If any failure occurs, the transaction rolls back completely and no balance is altered (NFR-08, NFR-09, NFR-17).
2. **Concurrency & Row-Level Locking:** Test concurrent operations on the same account to verify that `SELECT ... FOR UPDATE` locks account rows. Verify that fund transfers lock accounts in ascending ID order to prevent deadlocks.
3. **Duplicate Processing Prevention:** Verify that re-submitting a transfer or deposit request does not result in duplicate debits or duplicate transaction records.
4. **Account Status Enforcement:** Verify that accounts in FROZEN or INACTIVE status reject all deposits, withdrawals, and transfers with `ACC_001` before any balance change is executed (FR-11, TC-08, SV-08).

### 4.6 Integration Testing

Integration tests verify that components work together across tiers:
- **React UI → Express Backend:** HTTP requests carry appropriate headers/session credentials, and API responses update the React component tree correctly.
- **Express Backend → Data Access Layer → MySQL:** Service operations properly translate into parameterized SQL queries and database transactions.
- **Cross-Service Dependencies:** Transaction Service coordinates with Account Service for ownership and status checks before invoking the Data Access Layer.

Modules are verified independently first, then integrated in sequence: Authentication, Customer, Account, Transaction, Employee Administration, and Reporting.

### 4.7 Validation Testing (End-to-End)

Validation testing confirms that the complete system meets user needs across all three roles. Each actor's main use cases from [Actors and Use Cases](actors_usecases.md) are run end to end through the React UI and Express backend. For example, an employee registers a customer, creates an account and deposits money, and then the customer logs in, transfers funds and views the history.

### 4.8 Negative Testing

Every major operation is also tested with invalid or unauthorized actions: wrong passwords, missing fields, negative and zero amounts, amounts above the balance, frozen and inactive accounts, non-existent accounts, and access by the wrong role. The expected result is always a clear rejection (NFR-12) with **no change to stored data**.

### 4.9 Security Testing

Security testing follows the checklist in [Section 5.1](#51-security-validation). It covers authentication, authorization, password storage, input validation, session handling, account status restrictions, and data confidentiality.

### 4.10 Performance Testing

Response times are measured with the browser developer tools (Network tab) or an API benchmark client while up to 10 users are active on the test environment (SRS A-02). Each measured operation is repeated 20 times, and the requirement is met if at most 1 of the 20 repetitions exceeds the limit (NFR-06, NFR-07).

### 4.11 Regression Testing

After each defect fix, the failed test case is repeated. The related high-priority test cases (TC-01, TC-03, TC-05, TC-07 and TC-10) are also repeated to confirm that nothing else was broken.

### 4.12 Reviews and Inspections

Some requirements are verified by inspection and review rather than dynamic execution:

| Review ID | Activity | Requirement | Review Date | Status | Findings / Evidence |
|---|---|---|---|---|---|
| REV-01 | Review the source code structure to confirm separate modules for authentication, customer, account, transaction, employee administration and reporting | NFR-14 | 2026-10-22 | **Passed** | Inspected project layout. Confirmed modular three-tier separation: `frontend/` (React SPA components, CSS tokens, centralized API client), `backend/` (Express route modules, security middleware, DB pool, unified environment loader), and `database/` (DDL schema, baseline seed fixtures, initialization script). Modules interact cleanly across API contracts. |
| REV-02 | Review source code for the documented naming convention and comments on public business-logic functions | NFR-15 | 2026-10-22 | **Passed** | Inspected codebase naming conventions. Standard camelCase applied for functions/variables, PascalCase for React components, UPPER_SNAKE_CASE for constants. All routes, controllers, and utility functions feature structured docstrings documenting purpose, parameters, and return types. Frontend linting (`oxlint`) passed with 0 errors and 0 warnings. |
| REV-03 | Inspect the database schema for primary keys, unique constraints, foreign keys, and CHECK constraints | NFR-16, NFR-18 | 2026-10-22 | **Passed** | Inspected `database/schema.sql` and initialized live MySQL schema via `npm run db:init:seed`. Verified: `users` PK `user_id` and UK `username`; `customers` PK `customer_id` and UK/FK `user_id`; `employees` PK `employee_id` and UK/FK `user_id`; `accounts` PK `account_id`, UK `account_number`, FK `customer_id`, and `CHECK (balance >= 0.00)`; `bank_transactions` PK `transaction_id`, UK `transaction_ref`, FKs to accounts/users, and `CHECK (amount > 0.00)`. |

---

## 5. Test Environment and Validation

**Test environment**

| Item | Environment |
|---|---|
| Browser / client | Latest Google Chrome, plus one of Mozilla Firefox or Microsoft Edge, running the React single-page application built with Vite |
| Application server / backend | Node.js runtime executing the Express backend application server listening on local HTTP port ([SRS](SRS.md#25-design-and-implementation-constraints), C-08) |
| Database | MySQL Community Edition (InnoDB storage engine supporting ACID transactions), running locally on default port 3306 |
| Local development environment | Team laptops or lab machines (Windows, macOS or Linux), Visual Studio Code, Git and GitHub |
| Supporting tools | Browser developer tools (Network tab, console), API client such as Postman or curl (direct REST API calls), database client such as MySQL Workbench (schema and data inspection), Node.js native test runner (`node:test`) and Supertest for automated integration tests, Oxlint for frontend linting, and Vite for frontend bundling |

**Test data**

Only dummy data is used ([Feasibility Study](feasibility_study.md#6-legal-and-ethical-feasibility)).
Unless a test case states otherwise, the database is reset to the following
baseline **before each test case**, so that test cases do not depend on each
other:

| Data Item | Details |
|---|---|
| Customer `C1` | Login `test.customer1`; owns account **ACC-T1** (Active, balance 10,000.00) and account **ACC-T4** (Inactive, balance 1,000.00) |
| Customer `C2` | Login `test.customer2`; owns account **ACC-T2** (Active, balance 5,000.00) and account **ACC-T3** (Frozen, balance 2,000.00) |
| Bank Employee `E1` | Login `test.employee1`; active |
| Bank Employee `E2` | Login `test.employee2`; active (used for the deactivation test) |
| Administrator `A1` | Login `test.admin1`; active |
| Passwords | Standard local test password `Password123!` used across dummy test accounts. Stored in `database/seed.sql` as salted bcrypt hashes (`$2b$10$...`) with distinct random salts for each user. In test specifications it is written as `<valid password>`. |

All amounts are in INR with two decimal places.

### 5.1 Security Validation

This section defines the security checks that must pass before the system is
accepted. Each check maps to a security requirement in the
[SRS](SRS.md#52-security-requirements) and to the test case that performs it.

| Check ID | Security Area | Validation Method | Expected Result | Requirement | Test Case | Status | Verification Evidence |
|---|---|---|---|---|---|---|---|
| SV-01 | Login authentication | Log in as each role with valid credentials | Login succeeds and a session is created for the correct role | FR-01, NFR-05 | TC-01 | **Passed** | Verified on 2026-10-22 via `auth.test.js` Scenario 1 and frontend browser login. HTTP-only `bms.sid` session established. |
| SV-02 | Invalid credentials | Log in with a wrong password, an unknown username and an inactive user | All three are rejected with the same generic message (`AUTH_001`), which does not reveal whether the username exists | FR-01, FR-24, NFR-03, NFR-12 | TC-02, TC-18 | **Passed** | Verified on 2026-10-22 via `auth.test.js` Scenarios 2, 3, 5. Constant-time dummy bcrypt compare mitigates timing enumeration. |
| SV-03 | Role-based authorization | While logged in as a Customer, open employee and administrator functions from the UI and by entering their URLs | Access is denied with `AUTH_002`, and no data is shown or changed | FR-03, NFR-02 | TC-03 | **Pending Implementation (Middleware Verified)** | `requireRole` middleware verified with HTTP 403 `AUTH_002` in `auth.test.js` Scenarios 8 & 9. Banking page route enforcement pending Sprint 2. |
| SV-04 | Unauthorized URL / API access | Call protected API operations without a session and after logout | Requests are rejected with `AUTH_003`, and no data is returned | NFR-05, FR-02 | TC-03, TC-13 | **Passed** | Verified on 2026-10-22 via `auth.test.js` Scenarios 6, 7, 10. `GET /api/auth/me` and `/protected` reject unauthenticated and post-logout requests with 401 `AUTH_003`. |
| SV-05 | Password storage | Inspect the user table; search application logs for the test password | Only salted hashes are stored; the same password gives different hashes for different users; no plain-text password appears in logs or responses | NFR-01 | TC-09, TC-17 | **Passed** | Verified on 2026-10-22 via `auth.test.js` Scenario 12 and MySQL inspection. Bcrypt hashes (`$2b$10$...`) have distinct salts; no secrets leaked. |
| SV-06 | Input validation | Submit empty fields, negative, zero and non-numeric amounts, overlong text and SQL-like text such as `' OR '1'='1` | All are rejected with `VAL_001` before processing; no data changes; no SQL error is shown | NFR-04, NFR-18 | TC-12 | **Pending Implementation (Auth Input Verified)** | Authentication empty/whitespace input rejected with HTTP 400 `VAL_001` in `auth.test.js` Scenario 4 & 13. Financial transaction validation pending Sprint 2. |
| SV-07 | Access to protected operations | Attempt a deposit, withdrawal and transfer without being logged in | All are rejected with `AUTH_003` | NFR-05 | TC-03 | **Passed** | Verified on 2026-10-22 via `auth.test.js` Scenario 10. `requireAuth` middleware rejects unauthenticated access with HTTP 401 `AUTH_003`. |
| SV-08 | Account status restrictions | Deposit to, withdraw from and transfer to or from a frozen and an inactive account | All are rejected with `ACC_001`; balances unchanged; no transaction record | FR-11 | TC-08 | **Pending Implementation** | Account status financial restrictions scheduled for Sprint 2 transaction engine. |
| SV-09 | Data confidentiality | Logged in as Customer C1, request C2's account ACC-T2 and its transaction history by changing the ID in the URL or request | Access is denied; none of C2's data is returned | NFR-03 | TC-16 | **Pending Implementation** | Customer data ownership validation scheduled for Sprint 2 account/transaction endpoints. |
| SV-10 | Safe error responses | Trigger invalid operations and a forced internal error | Messages give the reason but contain no stack trace, SQL, table names or password hashes | NFR-12 | TC-10, TC-12 | **Passed** | Verified on 2026-10-22 via `auth.test.js` Scenario 13 and `errorHandler.js`. Structured JSON envelopes returned without leaking internal details. |

**Security validation pass criterion:** all checks SV-01 to SV-10 pass before final project release. Currently, foundational security checks (SV-01, SV-02, SV-04, SV-05, SV-07, SV-10) **Pass** with automated evidence. Domain-specific checks (SV-03, SV-06, SV-08, SV-09) are partially verified or pending Sprint 2 banking workflows. Any failed security check is recorded as a **Critical** defect and blocks the exit criteria in Section 6.

### 5.2 Data Integrity Validation

After completing TC-05, TC-07, TC-10 and TC-15, the tester checks the
following in the database:

1. For each test account, the stored balance equals the opening balance plus
   credits minus debits in its transaction records (NFR-08, NFR-17).
2. Every transaction ID is unique (FR-18, NFR-16).
3. No transaction record exists for any rejected or failed operation (NFR-09,
   NFR-10).

---

## 6. Entry and Exit Criteria

### 6.1 Entry Criteria

Testing of a module can begin when:

1. The SRS, architecture and design specification and this test plan have been
   reviewed and baselined.
2. The module is implemented and committed to the GitHub repository.
3. The test environment (Section 5) is installed and the baseline test data is
   loaded.
4. The module builds and starts without errors (smoke test: the login page
   opens and a test user can log in).

### 6.2 Exit Criteria

A test phase is complete when:

1. All test cases TC-01 to TC-21 and reviews REV-01 to REV-03 have been
   executed.
2. All security checks SV-01 to SV-10 pass.
3. At least 90% of test cases pass, and every high-priority test case
   (TC-01, TC-02, TC-03, TC-05, TC-06, TC-07, TC-08, TC-09, TC-10) passes.
4. There are no open Critical or High severity defects.
5. Test results, the defect log and the traceability matrix are updated.

### 6.3 Suspension and Resumption Criteria

Testing is **suspended** if the login function fails (most tests depend on
it), if the test database cannot be reset, or if more than 30% of test cases in
one run fail because of the same defect. Testing **resumes** after the
blocking defect is fixed and the smoke test passes.

### 6.4 Defect Severity

| Severity | Meaning | Example |
|---|---|---|
| Critical | Security failure, data loss or incorrect balance | Transfer debits the sender but does not credit the receiver |
| High | Core function does not work and there is no workaround | Deposit cannot be performed |
| Medium | Function works incorrectly but has a workaround | Report total is wrong but the individual records are correct |
| Low | Cosmetic or wording issue | Spelling mistake in an error message |

---

## 7. Test Deliverables

| Deliverable | Description |
|---|---|
| Test plan | This document |
| Test cases | TC-01 to TC-21 in Section 8 |
| Test execution results | The Actual Result and Status fields of each test case, completed during execution, with date and tester |
| Defect reports | A defect log (GitHub Issues) with ID, test case, steps to reproduce, severity and status |
| Traceability matrix | Section 9 of this plan and the project [RTM](rtm.md) |
| Security validation results | Pass or fail result for each check SV-01 to SV-10 in Section 5.1 |
| Test summary report | Final summary of executed, passed and failed tests and open defects |

---

## 8. Test Cases

Each test case starts from the baseline test data (Section 5). Any extra data
a test needs is created in its own preconditions. **Actual Result** and **Status** are completed during execution.

### TC-01 — Valid User Login

| Field | Details |
|---|---|
| Test Case ID | TC-01 |
| Requirement ID | FR-01, FR-03, NFR-05 |
| Use Case ID | UC-01, UC-08, UC-19 |
| Test Type | Functional, Security |
| Priority | High |
| Test Objective | Verify that registered active users of each role can log in with valid credentials and reach their role's dashboard. |
| Preconditions | Users `test.customer1`, `test.employee1` and `test.admin1` exist and are active. No user is logged in. |
| Test Steps | 1. Open the login page. 2. Enter username `test.customer1` and its valid password. 3. Click **Login**. 4. Log out. 5. Repeat steps 1–4 for `test.employee1` and `test.admin1`. |
| Test Data / Input | Username: `test.customer1`, `test.employee1`, `test.admin1`; Password: `<valid password>` for each |
| Expected Result | Each login succeeds. The Customer sees the customer dashboard, the Employee sees the employee dashboard and the Administrator sees the administrator dashboard. |
| Actual Result | Executed on 2026-10-22 via automated integration test suite (`tests/auth.test.js`, Scenario 1: customer, employee, and administrator valid logins) and browser verification. All three roles successfully authenticate with HTTP 200, receiving `{ success: true, user: { id, username, fullName, role, ... } }` and establishing an HTTP-only `bms.sid` session cookie. Interactive browser session verified customer dashboard access and session restoration on reload. |
| Status | Passed |

### TC-02 — Invalid User Login

| Field | Details |
|---|---|
| Test Case ID | TC-02 |
| Requirement ID | FR-01, NFR-03, NFR-12 |
| Use Case ID | UC-01 |
| Test Type | Functional (negative), Security |
| Priority | High |
| Test Objective | Verify that invalid credentials are rejected with a generic message that does not reveal whether the username exists. |
| Preconditions | User `test.customer1` exists. No user is logged in. |
| Test Steps | 1. Enter username `test.customer1` with a wrong password and click **Login**. 2. Enter a username that does not exist (`no.such.user`) with any password and click **Login**. 3. Leave both fields empty and click **Login**. |
| Test Data / Input | Wrong password: `<invalid password>`; unknown username: `no.such.user`; empty fields |
| Expected Result | Steps 1 and 2 show the same message, "Invalid username or password" (`AUTH_001`), and no session is created. Step 3 shows a "required field" message. No message reveals whether the username exists. |
| Actual Result | Executed on 2026-10-22 via automated integration test suite (`tests/auth.test.js`, Scenarios 2, 3, 4, 5). Wrong password and non-existent username (`no.such.user`) both return HTTP 401 with generic error envelope `{ success: false, error: { code: 'AUTH_001', message: 'Invalid username or password' } }`, preventing username enumeration via constant-time dummy bcrypt hashing. Empty and whitespace credentials return HTTP 400 with `{ code: 'VAL_001' }`. Inactive user accounts return HTTP 401 `AUTH_001`. |
| Status | Passed |

### TC-03 — Role-Based Access Control

| Field | Details |
|---|---|
| Test Case ID | TC-03 |
| Requirement ID | FR-03, NFR-02, NFR-03, NFR-05 |
| Use Case ID | UC-10, UC-15, UC-21, UC-26 (role-restricted use cases) |
| Test Type | Security, Negative |
| Priority | High |
| Test Objective | Verify that each role can access only its permitted functions, and that protected operations cannot be performed without logging in. |
| Preconditions | Baseline test data loaded. |
| Test Steps | 1. Log in as `test.customer1`. 2. Try to open the Register Customer page (UC-10) by typing its URL. 3. Send a deposit request (`POST /api/accounts/{accountId}/deposits`) for ACC-T1 using the customer's session. 4. Try to open Manage Employee Accounts (UC-21) and Generate Reports (UC-26). 5. Log out, log in as `test.employee1` and try to open Manage Employee Accounts (UC-21). 6. Log out and, with no session, send `GET /api/accounts/{accountId}` for ACC-T1. |
| Test Data / Input | Customer and employee sessions; URLs and API requests of restricted functions |
| Expected Result | Steps 2–5: access is denied with "Unauthorized operation" (`AUTH_002`), and the menu does not show these functions. Step 6: the request is rejected with "Authentication required" (`AUTH_003`). No data is shown or changed in any step. |
| Actual Result | Partially verified on 2026-10-22 at the backend middleware and authentication API level (`tests/auth.test.js`, Scenarios 8, 9, 10). `requireRole` middleware enforces role barriers: Customer access to employee-only route returns HTTP 403 `{ code: 'AUTH_002', message: 'Unauthorized operation for user role' }`. Unauthenticated calls to protected routes return HTTP 401 `{ code: 'AUTH_003', message: 'Authentication required' }`. Full front-end UI route guarding and core banking endpoints (`POST /api/accounts/.../deposits`, `UC-10`, `UC-21`, `UC-26`) remain pending implementation in Sprint 2. |
| Status | Pending Implementation (Middleware Verified) |

### TC-04 — Register Customer

| Field | Details |
|---|---|
| Test Case ID | TC-04 |
| Requirement ID | FR-04, NFR-16, NFR-18 |
| Use Case ID | UC-10 |
| Test Type | Functional |
| Priority | High |
| Test Objective | Verify that a Bank Employee can register a new customer and that the customer receives a unique customer ID. |
| Preconditions | Logged in as `test.employee1`. |
| Test Steps | 1. Open **Register Customer**. 2. Enter all mandatory details. 3. Click **Submit**. 4. Search for the new customer. 5. Repeat steps 1–3 with a second customer. |
| Test Data / Input | Name: `Test Customer Three`; Date of birth: `01-01-2000`; Phone: `9000000003`; E-mail: `test3@example.com`; Address: `Test Address 3` (dummy data), and a second similar dummy customer |
| Expected Result | A success message shows a new customer ID. The customer can be found by search with the entered details. The two new customers have different customer IDs. |
| Actual Result | Feature scheduled for Sprint 2 (Customer Service & registration UI). Underlying database schema table `customers` and primary key / constraints verified via REV-03. |
| Status | Pending Implementation |

### TC-05 — Successful Deposit

| Field | Details |
|---|---|
| Test Case ID | TC-05 |
| Requirement ID | FR-12, FR-18, FR-19, NFR-10 |
| Use Case ID | UC-15 |
| Test Type | Functional |
| Priority | High |
| Test Objective | Verify that a deposit into an active account increases its balance by the exact amount and creates one transaction record. |
| Preconditions | Logged in as `test.employee1`. ACC-T1 is Active with balance 10,000.00. |
| Test Steps | 1. Open **Deposit Money**. 2. Enter account ACC-T1 and amount 2,500.00. 3. Click **Submit**. 4. View the ACC-T1 account details. 5. View the transaction records for ACC-T1. |
| Test Data / Input | Account: ACC-T1; Amount: 2,500.00 |
| Expected Result | A success message shows a transaction ID. The balance of ACC-T1 is 12,500.00. Exactly one new DEPOSIT record exists with that transaction ID, amount 2,500.00, account ACC-T1, and the current date and time. |
| Actual Result | Feature scheduled for Sprint 2 (Transaction Service deposit workflow). |
| Status | Pending Implementation |

### TC-06 — Withdrawal with Insufficient Balance

| Field | Details |
|---|---|
| Test Case ID | TC-06 |
| Requirement ID | FR-14, NFR-12 |
| Use Case ID | UC-16 |
| Test Type | Functional (negative) |
| Priority | High |
| Test Objective | Verify that a withdrawal greater than the available balance is rejected and the balance does not change. |
| Preconditions | Logged in as `test.employee1`. ACC-T2 is Active with balance 5,000.00. |
| Test Steps | 1. Open **Withdraw Money**. 2. Enter account ACC-T2 and amount 5,000.01. 3. Click **Submit**. 4. View the ACC-T2 account details and transaction records. |
| Test Data / Input | Account: ACC-T2; Amount: 5,000.01 (boundary: 0.01 above the balance) |
| Expected Result | The withdrawal is rejected with "Insufficient balance" (`TXN_001`). The balance of ACC-T2 remains 5,000.00. No new transaction record is created. |
| Actual Result | Feature scheduled for Sprint 2 (Transaction Service withdrawal validation). |
| Status | Pending Implementation |

### TC-07 — Successful Fund Transfer

| Field | Details |
|---|---|
| Test Case ID | TC-07 |
| Requirement ID | FR-15, FR-16, FR-17, FR-18, FR-19, NFR-08, NFR-10 |
| Use Case ID | UC-04 |
| Test Type | Functional, Integration |
| Priority | High |
| Test Objective | Verify that a customer can transfer funds to another valid account, that both balances are updated correctly, and that a transfer above the balance is rejected. |
| Preconditions | Logged in as `test.customer1`. ACC-T1 balance 10,000.00 (Active); ACC-T2 balance 5,000.00 (Active). |
| Test Steps | 1. Open **Transfer Funds**. 2. Select source ACC-T1, enter receiver ACC-T2 and amount 1,500.00. 3. Click **Submit**, then confirm. 4. View the ACC-T1 details and transaction history. 5. Log in as `test.customer2` and view the ACC-T2 details. 6. Log in again as `test.customer1` and try to transfer 20,000.00 from ACC-T1 to ACC-T2. |
| Test Data / Input | Transfer 1: ACC-T1 → ACC-T2, 1,500.00. Transfer 2: ACC-T1 → ACC-T2, 20,000.00 |
| Expected Result | Transfer 1 succeeds and shows a transaction ID. ACC-T1 balance is 8,500.00 and ACC-T2 balance is 6,500.00. One TRANSFER record exists with both account numbers and amount 1,500.00. Transfer 2 is rejected with "Insufficient balance" (`TXN_001`), and the balances remain 8,500.00 and 6,500.00. |
| Actual Result | Feature scheduled for Sprint 2 (Transaction Service transfer workflow & two-phase balance update). |
| Status | Pending Implementation |

### TC-08 — Transaction Attempt on Frozen or Inactive Account

| Field | Details |
|---|---|
| Test Case ID | TC-08 |
| Requirement ID | FR-10, FR-11 |
| Use Case ID | UC-17, UC-04, UC-15, UC-16 |
| Test Type | Functional (negative), Security |
| Priority | High |
| Test Objective | Verify that account status changes take effect and that no financial transaction is allowed on a frozen or inactive account. |
| Preconditions | ACC-T3 is Frozen (2,000.00); ACC-T4 is Inactive (1,000.00); ACC-T1 is Active (10,000.00). |
| Test Steps | 1. Log in as `test.employee1` and try to deposit 100.00 into ACC-T3. 2. Try to withdraw 100.00 from ACC-T4. 3. Log in as `test.customer1` and try to transfer 100.00 from ACC-T1 to ACC-T3. 4. Try to transfer 100.00 from ACC-T4 to ACC-T2. 5. Log in as `test.employee1`, unfreeze ACC-T3 (set it to Active), and deposit 100.00 into it. |
| Test Data / Input | Accounts ACC-T1, ACC-T2, ACC-T3, ACC-T4; Amount: 100.00 |
| Expected Result | Steps 1–4 are rejected with "Account frozen or inactive" (`ACC_001`), and all balances are unchanged with no transaction records. Step 5: the status changes to Active and the deposit succeeds (ACC-T3 = 2,100.00). |
| Actual Result | Feature scheduled for Sprint 2 (Account status enforcement & transaction blocking). |
| Status | Pending Implementation |

### TC-09 — Password Security / Password Storage

| Field | Details |
|---|---|
| Test Case ID | TC-09 |
| Requirement ID | NFR-01 |
| Use Case ID | UC-01, UC-10, UC-21 |
| Test Type | Security (inspection) |
| Priority | High |
| Test Objective | Verify that passwords are stored only as salted one-way hashes and never appear in plain text. |
| Preconditions | Access to the test database through a database client. Test users exist. |
| Test Steps | 1. Create two test users with the **same** test password. 2. Open the user table in the database client. 3. Compare the stored password fields of the two users. 4. Search the stored password fields and the application log files for the plain-text test password. 5. Check the login API response for any password or hash field. |
| Test Data / Input | Two dummy users with the same test password `<shared test password>` |
| Expected Result | Stored values are hashes, not the password. The two users have **different** stored hash values (salting). The plain-text password is not found in the database, the logs or any response. |
| Actual Result | Executed on 2026-10-22 via automated test (`tests/auth.test.js`, Scenario 12) and database inspection of `database/seed.sql`. Stored user passwords use bcrypt with cost factor 10 (`$2b$10$...`). Different users sharing the identical test password `Password123!` have distinct salted hashes. Direct inspections confirm plain-text passwords never appear in database records, backend application logs, or API response bodies. |
| Status | Passed |

### TC-10 — Failed Transaction Atomicity

| Field | Details |
|---|---|
| Test Case ID | TC-10 |
| Requirement ID | NFR-09, NFR-17, NFR-12 |
| Use Case ID | UC-04 |
| Test Type | Non-functional (reliability), Integration |
| Priority | High |
| Test Objective | Verify that a transfer that fails part-way through leaves no partial balance update and no transaction record. |
| Preconditions | ACC-T1 = 10,000.00, ACC-T2 = 5,000.00. A test-only failure point is available in the test environment (for example, a test setting that makes the transaction-record insert fail, or stopping the database after the debit step while debugging). |
| Test Steps | 1. Record the balances of ACC-T1 and ACC-T2. 2. Enable the forced failure after the sender debit. 3. As `test.customer1`, transfer 1,000.00 from ACC-T1 to ACC-T2. 4. Disable the forced failure. 5. Check both balances and the transaction records in the database. |
| Test Data / Input | ACC-T1 → ACC-T2, 1,000.00 |
| Expected Result | The user sees "Transaction failed" (`TXN_003`) with no technical details. ACC-T1 remains 10,000.00 and ACC-T2 remains 5,000.00. No transaction record exists for the failed transfer. |
| Actual Result | Feature scheduled for Sprint 2 (Transaction Service InnoDB transaction boundaries and rollback handling). |
| Status | Pending Implementation |

### TC-11 — Response Time Validation

| Field | Details |
|---|---|
| Test Case ID | TC-11 |
| Requirement ID | NFR-06, NFR-07 |
| Use Case ID | UC-01, UC-03, UC-05, UC-04, UC-15 |
| Test Type | Non-functional (performance) |
| Priority | Medium |
| Test Objective | Verify response times under normal prototype usage (up to 10 concurrent users, SRS A-02). |
| Preconditions | Test environment running with the baseline data plus sample data (about 1,000 customers and 10,000 transactions). Up to 10 testers or scripted clients active. |
| Test Steps | 1. With browser developer tools open, perform login 20 times and record each response time. 2. Repeat for balance enquiry (view ACC-T1) and viewing transaction history. 3. Perform 20 deposits and 20 transfers of 1.00 and record each response time. |
| Test Data / Input | Accounts ACC-T1 and ACC-T2; Amount: 1.00 |
| Expected Result | Login, balance enquiry and transaction history: at most 1 of 20 responses per operation exceeds 3 seconds (NFR-06). Deposits and transfers: at most 1 of 20 exceeds 5 seconds (NFR-07). |
| Actual Result | Performance load testing planned for later phase with 10 concurrent users and populated volume data (1,000 customers, 10,000 transactions). |
| Status | Not Executed |

### TC-12 — Invalid Input Rejection

| Field | Details |
|---|---|
| Test Case ID | TC-12 |
| Requirement ID | NFR-04, NFR-18, NFR-12 |
| Use Case ID | UC-10, UC-15, UC-04 |
| Test Type | Non-functional (security, data integrity), Negative |
| Priority | High |
| Test Objective | Verify that invalid input is rejected before processing and that invalid data is never stored. |
| Preconditions | Logged in as `test.employee1` (steps 1–4) and as `test.customer1` (steps 5–6). |
| Test Steps | 1. Register a customer with the name field empty. 2. Register a customer with e-mail `not-an-email` and phone `abc`. 3. Deposit amount `-100` into ACC-T1. 4. Deposit amount `0`, then `abc`, then `10.555` into ACC-T1. 5. Transfer from ACC-T1 to receiver `' OR '1'='1`. 6. Transfer 100.00 from ACC-T1 to ACC-T1 (same account). |
| Test Data / Input | As listed in the steps |
| Expected Result | Every step is rejected with a field-level error (`VAL_001`, `TXN_002` for amounts, or `TXN_004` for the same account). No customer record, balance or transaction record is created or changed. No SQL error, stack trace or table name is shown. |
| Actual Result | Partially verified on 2026-10-22 for authentication endpoints (`tests/auth.test.js`, Scenarios 4 & 13). Empty username/password and whitespace payloads are rejected with HTTP 400 `{ code: 'VAL_001', message: 'Username and password are required' }`. SQL injection strings (e.g. `' OR '1'='1`) are safely handled via MySQL parameterized queries and return HTTP 401 `AUTH_001` without SQL syntax errors or schema leakage. Financial amount validation (`TXN_002`, `TXN_004`) and customer field validation are scheduled for Sprint 2. |
| Status | Pending Implementation (Auth Input Verified) |

### TC-13 — Logout and Session Invalidation

| Field | Details |
|---|---|
| Test Case ID | TC-13 |
| Requirement ID | FR-02, NFR-05 |
| Use Case ID | UC-02, UC-09, UC-20 |
| Test Type | Functional, Security |
| Priority | High |
| Test Objective | Verify that logout ends the session and that protected pages cannot be used afterwards. |
| Preconditions | Logged in as `test.customer1`, with the ACC-T1 account details page open. |
| Test Steps | 1. Click **Logout**. 2. Press the browser **Back** button. 3. Refresh the page. 4. Using an API client, repeat the earlier `GET /api/accounts/{accountId}` request with the old session credential. |
| Test Data / Input | Session of `test.customer1` |
| Expected Result | Step 1 returns the user to the login page. Steps 2–4 do not show account data; they redirect to login or return "Authentication required" (`AUTH_003`). |
| Actual Result | Executed on 2026-10-22 via automated test (`tests/auth.test.js`, Scenarios 6 & 7) and browser verification. `POST /api/auth/logout` terminates the session on the server, clears the `bms.sid` session cookie with an expired maxAge/expires header, and subsequent requests with the expired cookie to protected routes (`GET /api/auth/me`, `/protected`) return HTTP 401 `{ code: 'AUTH_003', message: 'Authentication required' }`. |
| Status | Passed |

### TC-14 — Create Bank Account with Unique Account Number

| Field | Details |
|---|---|
| Test Case ID | TC-14 |
| Requirement ID | FR-07, FR-08, NFR-16 |
| Use Case ID | UC-13 |
| Test Type | Functional |
| Priority | High |
| Test Objective | Verify that an employee can create accounts for a registered customer and that each account gets a unique account number. |
| Preconditions | Logged in as `test.employee1`. Customer C1 exists. |
| Test Steps | 1. Open **Create Bank Account**. 2. Select customer C1, choose account type Savings and opening balance 0.00. 3. Click **Submit**. 4. Repeat steps 1–3 two more times. 5. Try to create an account for a customer ID that does not exist. |
| Test Data / Input | Customer: C1; Type: Savings; Opening balance: 0.00; non-existent customer ID `C9999` |
| Expected Result | Steps 1–4 create three accounts, each Active, with a different account number that is also different from ACC-T1 to ACC-T4. Step 5 is rejected with "Customer not found" (`CUST_001`). |
| Actual Result | Database constraint verified via schema review REV-03 (`accounts.account_number` has `UNIQUE KEY`). Automated account generation and customer linking service scheduled for Sprint 2. |
| Status | Pending Implementation (Schema Verified) |

### TC-15 — Successful Withdrawal

| Field | Details |
|---|---|
| Test Case ID | TC-15 |
| Requirement ID | FR-13, FR-18, FR-19, NFR-10 |
| Use Case ID | UC-16 |
| Test Type | Functional (including boundary value) |
| Priority | High |
| Test Objective | Verify that withdrawals up to and including the full balance succeed and are recorded. |
| Preconditions | Logged in as `test.employee1`. ACC-T2 = 5,000.00 (Active). |
| Test Steps | 1. Withdraw 1,000.00 from ACC-T2. 2. Withdraw 4,000.00 from ACC-T2 (the exact remaining balance). 3. View the ACC-T2 balance and transaction records. |
| Test Data / Input | Account: ACC-T2; Amounts: 1,000.00 and 4,000.00 |
| Expected Result | Both withdrawals succeed with different transaction IDs. The final balance is 0.00. Two WITHDRAWAL records exist with the correct amounts. |
| Actual Result | Feature scheduled for Sprint 2 (Transaction Service withdrawal workflow). |
| Status | Pending Implementation |

### TC-16 — View Own Account Details and Transaction History

| Field | Details |
|---|---|
| Test Case ID | TC-16 |
| Requirement ID | FR-09, FR-20, NFR-03 |
| Use Case ID | UC-03, UC-05 |
| Test Type | Functional, Security |
| Priority | High |
| Test Objective | Verify that a customer can view their own accounts and history, but not another customer's. |
| Preconditions | Baseline data, plus one completed transfer of 1,500.00 from ACC-T1 to ACC-T2 made by `test.customer1` as setup. Logged in as `test.customer1`. |
| Test Steps | 1. Open **View Account Details**. 2. Open **Transaction History** for ACC-T1. 3. Change the account ID in the URL or API request to ACC-T2 (owned by C2) and request its details. 4. Request the transaction history of ACC-T2 in the same way. |
| Test Data / Input | Own account: ACC-T1; other customer's account: ACC-T2 |
| Expected Result | Step 1 shows only ACC-T1 and ACC-T4 with correct numbers, status and balances. Step 2 shows ACC-T1's transactions, newest first. Steps 3–4 are denied with `AUTH_002`, and none of ACC-T2's data is returned. |
| Actual Result | Feature scheduled for Sprint 2 (Account & Transaction customer history endpoints and ownership authorization). |
| Status | Pending Implementation |

### TC-17 — Change Password

| Field | Details |
|---|---|
| Test Case ID | TC-17 |
| Requirement ID | FR-22, NFR-01 |
| Use Case ID | UC-07 |
| Test Type | Functional, Security |
| Priority | Medium |
| Test Objective | Verify that a user can change their password, that the new password works and that the old one is rejected. |
| Preconditions | Logged in as `test.customer1`. |
| Test Steps | 1. Open **Change Password**. 2. Enter a wrong current password and a new password, then submit. 3. Enter the correct current password and a new password, then submit. 4. Log out and log in with the old password. 5. Log in with the new password. 6. Check the stored password field in the database. |
| Test Data / Input | Current: `<valid password>`; New: `<new test password>` |
| Expected Result | Step 2 is rejected. Step 3 succeeds. Step 4 fails with `AUTH_001`. Step 5 succeeds. Step 6 shows a new hash value, not the plain-text password. |
| Actual Result | Feature scheduled for Sprint 2 (`POST /api/auth/change-password` endpoint and profile UI). Password storage security verified under TC-09. |
| Status | Pending Implementation |

### TC-18 — Create and Deactivate Employee Account

| Field | Details |
|---|---|
| Test Case ID | TC-18 |
| Requirement ID | FR-23, FR-24, NFR-02 |
| Use Case ID | UC-21, UC-25 |
| Test Type | Functional, Security |
| Priority | Medium |
| Test Objective | Verify that an administrator can create an employee account and that a deactivated employee can no longer log in or use an existing session. |
| Preconditions | Logged in as `test.admin1`. `test.employee2` is active and logged in on a second browser. |
| Test Steps | 1. Create a new employee `test.employee3` and log in as that employee on a third browser. 2. As the administrator, deactivate `test.employee2`. 3. In the second browser, `test.employee2` tries to open **Register Customer**. 4. `test.employee2` logs out and tries to log in again. |
| Test Data / Input | New employee: `test.employee3` (dummy details); employee to deactivate: `test.employee2` |
| Expected Result | Step 1: `test.employee3` logs in with the Bank Employee role. Step 3: the request is rejected (`AUTH_003`). Step 4: login fails with the generic message `AUTH_001`. |
| Actual Result | Authentication handling verified on 2026-10-22 (`tests/auth.test.js`, Scenarios 5 & 11). Login for an inactive user is rejected with HTTP 401 `AUTH_001`. Mid-session account deactivation is dynamically detected by `requireAuth` checking `user.is_active` against the database on each request, immediately revoking access with HTTP 401 `AUTH_003`. Administrator UI for creating and managing employee accounts is scheduled for Sprint 2. |
| Status | Pending Implementation (Auth Handling Verified) |

### TC-19 — View Transaction Records and Generate Report

| Field | Details |
|---|---|
| Test Case ID | TC-19 |
| Requirement ID | FR-21, FR-25 |
| Use Case ID | UC-18, UC-24, UC-26 |
| Test Type | Functional |
| Priority | Medium |
| Test Objective | Verify that employees and administrators can view transaction records and that the administrator's summary report matches the stored data. |
| Preconditions | Baseline data, plus the following setup transactions made today: a deposit of 2,500.00 into ACC-T1, a transfer of 1,500.00 from ACC-T1 to ACC-T2, and a withdrawal of 1,000.00 from ACC-T2. |
| Test Steps | 1. As `test.employee1`, open **View Transaction Records** filtered by ACC-T2 and today's date. 2. As `test.admin1`, open **View Transaction Records** with the same filter. 3. As `test.admin1`, generate the summary report for today. 4. Compare the report figures with the database. |
| Test Data / Input | Filter: ACC-T2, today's date; Report date range: today |
| Expected Result | Steps 1–2 list the ACC-T2 transactions from today. The step 3 report shows the total customers, accounts per status (Active, Inactive, Frozen), and the count and total value of deposits, withdrawals and transfers, all equal to the database values. |
| Actual Result | Feature scheduled for Sprint 2 (Employee/Admin transaction records view and Reporting Service). |
| Status | Pending Implementation |

### TC-20 — View and Update Customer Information

| Field | Details |
|---|---|
| Test Case ID | TC-20 |
| Requirement ID | FR-05, FR-06, NFR-02 |
| Use Case ID | UC-06, UC-11, UC-12, UC-22 |
| Test Type | Functional |
| Priority | Medium |
| Test Objective | Verify that customer details can be viewed by authorized users and updated within each role's permissions. |
| Preconditions | Customer C1 exists. |
| Test Steps | 1. As `test.customer1`, update phone and address in **Update Profile**. 2. As `test.customer1`, try to change the name field (by editing the request if the field is not shown). 3. As `test.employee1`, search for C1 and view the details. 4. As `test.employee1`, update C1's name. 5. As `test.admin1`, view C1's record. |
| Test Data / Input | Phone: `9000000099`; Address: `Updated Test Address`; Name: `Test Customer One Updated` |
| Expected Result | Step 1 succeeds. Step 2 is rejected (`AUTH_002`) or the name is ignored, and the name is unchanged. Step 3 shows the updated phone and address. Step 4 succeeds. Step 5 shows all updated values. |
| Actual Result | Feature scheduled for Sprint 2 (Customer Profile and Employee Customer Management). |
| Status | Pending Implementation |

### TC-21 — Role-Specific Navigation

| Field | Details |
|---|---|
| Test Case ID | TC-21 |
| Requirement ID | NFR-11, NFR-13 |
| Use Case ID | All use cases (navigation) |
| Test Type | Non-functional (usability, demonstration) |
| Priority | Medium |
| Test Objective | Verify that each role sees only its permitted operations and can reach every core operation within 3 navigation actions. |
| Preconditions | Test users of all three roles exist. |
| Test Steps | 1. Log in as each role in turn. 2. Compare the menu items with the role's use cases in [Actors and Use Cases](actors_usecases.md). 3. From the dashboard, open each core operation (for example Transfer Funds, Deposit Money, Manage Employee Accounts) and count the navigation actions. 4. Check that the menu is present on every page visited. |
| Test Data / Input | Logins of `test.customer1`, `test.employee1`, `test.admin1` |
| Expected Result | Each menu lists exactly the role's permitted operations. Every core operation is reached in 3 or fewer navigation actions. The menu is shown on every page after login. |
| Actual Result | Feature scheduled for Sprint 2 (Full role-specific navigation bar across customer, employee, and administrator views in the React frontend). Foundational login, authentication state persistence, and logout navigation verified in Sprint 1. |
| Status | Pending Implementation |

### 8.1 Test Case Summary

| Test Case | Title | Type | Priority | Execution Status | Evidence / Notes |
|---|---|---|---|---|---|
| TC-01 | Valid User Login | Functional, Security | High | **Passed** | Verified 2026-10-22 via `auth.test.js` Scenario 1 & browser test. Session cookie established. |
| TC-02 | Invalid User Login | Negative, Security | High | **Passed** | Verified 2026-10-22 via `auth.test.js` Scenarios 2, 3, 4, 5. Constant-time dummy hash prevents enumeration. |
| TC-03 | Role-Based Access Control | Security | High | **Pending Implementation (Middleware Verified)** | `requireRole` middleware verified via `auth.test.js` Scenarios 8, 9 (HTTP 403 `AUTH_002`). Full page URLs pending Sprint 2. |
| TC-04 | Register Customer | Functional | High | **Pending Implementation** | Customer Service scheduled for Sprint 2. DB schema verified via REV-03. |
| TC-05 | Successful Deposit | Functional | High | **Pending Implementation** | Transaction Service scheduled for Sprint 2. |
| TC-06 | Withdrawal with Insufficient Balance | Negative | High | **Pending Implementation** | Transaction Service balance validation scheduled for Sprint 2. |
| TC-07 | Successful Fund Transfer | Functional, Integration | High | **Pending Implementation** | Multi-account transfer transaction scheduled for Sprint 2. |
| TC-08 | Transaction Attempt on Frozen or Inactive Account | Negative, Security | High | **Pending Implementation** | Account status financial restrictions scheduled for Sprint 2. |
| TC-09 | Password Security / Password Storage | Security | High | **Passed** | Verified 2026-10-22 via `auth.test.js` Scenario 12 & DB inspection. Bcrypt cost 10, random salts, no plain text in DB/logs/responses. |
| TC-10 | Failed Transaction Atomicity | Reliability | High | **Pending Implementation** | Database transaction rollback scheduled for Sprint 2. |
| TC-11 | Response Time Validation | Performance | Medium | **Not Executed** | Planned for dedicated load test phase (10 concurrent users, 1,000 customers, 10,000 transactions). |
| TC-12 | Invalid Input Rejection | Security, Data Integrity | High | **Pending Implementation (Auth Input Verified)** | Empty/whitespace input and SQL injection strings verified via `auth.test.js` Scenarios 4 & 13. Financial inputs pending Sprint 2. |
| TC-13 | Logout and Session Invalidation | Functional, Security | High | **Passed** | Verified 2026-10-22 via `auth.test.js` Scenarios 6, 7 & browser test. Session destroyed, cookie expired, calls rejected with 401 `AUTH_003`. |
| TC-14 | Create Bank Account with Unique Account Number | Functional | High | **Pending Implementation (Schema Verified)** | Unique key on `accounts.account_number` verified via REV-03. Account generator scheduled for Sprint 2. |
| TC-15 | Successful Withdrawal | Functional | High | **Pending Implementation** | Transaction Service scheduled for Sprint 2. |
| TC-16 | View Own Account Details and Transaction History | Functional, Security | High | **Pending Implementation** | Customer account access endpoints scheduled for Sprint 2. |
| TC-17 | Change Password | Functional, Security | Medium | **Pending Implementation** | Password change endpoint and UI scheduled for Sprint 2. Bcrypt hashing verified under TC-09. |
| TC-18 | Create and Deactivate Employee Account | Functional, Security | Medium | **Pending Implementation (Auth Handling Verified)** | Inactive account login block and dynamic deactivation session revocation verified via `auth.test.js` Scenarios 5, 11. Admin employee management UI scheduled for Sprint 2. |
| TC-19 | View Transaction Records and Generate Report | Functional | Medium | **Pending Implementation** | Reporting and admin records view scheduled for Sprint 2. |
| TC-20 | View and Update Customer Information | Functional | Medium | **Pending Implementation** | Customer profile and employee management scheduled for Sprint 2. |
| TC-21 | Role-Specific Navigation | Usability | Medium | **Pending Implementation** | Complete role dashboard menus scheduled for Sprint 2. Foundational navigation verified in Sprint 1. |

**Totals & Status Breakdown:**
- **Total Test Cases:** 21 test cases (plus 3 reviews in Section 4.12 and 10 security checks in Section 5.1).
- **Execution Status Breakdown (TC-01 to TC-21):**
  - **Passed:** 4 test cases (TC-01, TC-02, TC-09, TC-13) — 19.0%
  - **Pending Implementation — Partially Verified (Middleware / Schema / Auth):** 4 test cases (TC-03, TC-12, TC-14, TC-18) — 19.0%
  - **Pending Implementation — Scheduled for Sprint 2:** 12 test cases (TC-04, TC-05, TC-06, TC-07, TC-08, TC-10, TC-15, TC-16, TC-17, TC-19, TC-20, TC-21) — 57.1%
  - **Not Executed:** 1 test case (TC-11) — 4.8%
- **Reviews & Inspections (REV-01 to REV-03):** 3 Passed (100%).
- **Security Validation Checks (SV-01 to SV-10):** 6 Passed (SV-01, SV-02, SV-04, SV-05, SV-07, SV-10), 4 Partially Verified / Pending Implementation (SV-03, SV-06, SV-08, SV-09).

---

## 9. Test Traceability Matrix

Verification types: **T** = Test execution, **I** = Inspection or review,
**A** = Analysis, **D** = Demonstration.

### 9.1 Functional Requirements

| Requirement ID | Requirement | Test Case ID | Verification Type | Status / Verification Evidence |
|---|---|---|---|---|
| FR-01 | Login with valid credentials | TC-01, TC-02 | T | **Passed** (Verified 2026-10-22 via `auth.test.js` Scenarios 1–5 & browser test) |
| FR-02 | Secure logout | TC-13 | T | **Passed** (Verified 2026-10-22 via `auth.test.js` Scenarios 6, 7 & browser test) |
| FR-03 | Role-based access levels | TC-01, TC-03 | T | **Passed (Auth & Middleware)** / Pending Implementation (Page routes pending Sprint 2) |
| FR-04 | Register customer | TC-04 | T | **Pending Implementation** (Scheduled for Sprint 2; DB schema verified via REV-03) |
| FR-05 | View customer details | TC-20 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-06 | Update permitted customer information | TC-20 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-07 | Create bank account | TC-14 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-08 | Unique account number | TC-14 | T | **Passed (Schema Constraint)** / Pending Implementation (Generator pending Sprint 2) |
| FR-09 | View account details and balance | TC-16 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-10 | Manage account status | TC-08 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-11 | Block transactions on frozen/inactive accounts | TC-08 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-12 | Deposit | TC-05 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-13 | Withdrawal | TC-15 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-14 | Reject withdrawal with insufficient balance | TC-06 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-15 | Fund transfer | TC-07 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-16 | Balance check before transfer | TC-07 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-17 | Update sender and receiver balances | TC-07 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-18 | Unique transaction ID | TC-05, TC-07, TC-15 | T, A | **Pending Implementation** (Scheduled for Sprint 2; DB schema UK verified via REV-03) |
| FR-19 | Record completed transactions | TC-05, TC-07, TC-15 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-20 | Customer transaction history | TC-16 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-21 | Employee/administrator transaction view | TC-19 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-22 | Change password | TC-17 | T | **Pending Implementation** (Scheduled for Sprint 2; bcrypt storage verified via TC-09) |
| FR-23 | Create and manage employee accounts | TC-18 | T | **Pending Implementation** (Scheduled for Sprint 2) |
| FR-24 | Deactivate employee accounts | TC-18 | T | **Passed (Auth Enforcement)** / Pending Implementation (Admin CRUD UI pending Sprint 2) |
| FR-25 | Basic reports | TC-19 | T, A | **Pending Implementation** (Scheduled for Sprint 2) |

### 9.2 Non-Functional Requirements

| Requirement ID | Requirement | Test Case ID | Verification Type | Status / Verification Evidence |
|---|---|---|---|---|
| NFR-01 | Passwords stored as salted hashes | TC-09, TC-17 | I, T | **Passed** (Verified 2026-10-22 via `auth.test.js` Scenario 12 & DB inspection) |
| NFR-02 | Role-based feature restriction | TC-03, TC-18, TC-20 | T | **Passed (Middleware)** / Pending Implementation (Full UI pending Sprint 2) |
| NFR-03 | Prevent unauthorized data access | TC-02, TC-03, TC-16 | T | **Passed (Auth & Middleware)** / Pending Implementation (Account data endpoints pending Sprint 2) |
| NFR-04 | Input validation | TC-12 | T | **Passed (Auth Input)** / Pending Implementation (Transaction inputs pending Sprint 2) |
| NFR-05 | Authentication before sensitive operations | TC-01, TC-03, TC-13 | T | **Passed** (Verified 2026-10-22 via `auth.test.js` Scenarios 6, 7, 10) |
| NFR-06 | Response time ≤ 3 s (95%) | TC-11 | T | **Not Executed** (Planned for load testing phase under target volume) |
| NFR-07 | Transaction time ≤ 5 s (95%) | TC-11 | T | **Not Executed** (Planned for load testing phase under target volume) |
| NFR-08 | Consistent balances | TC-07, Section 5.2 | T, A | **Pending Implementation** (Scheduled for Sprint 2 transaction engine) |
| NFR-09 | No partial updates on failure | TC-10 | T | **Pending Implementation** (Scheduled for Sprint 2 InnoDB rollback tests) |
| NFR-10 | One unmodifiable record per transaction | TC-05, TC-07, TC-15 | T, I | **Pending Implementation** (Scheduled for Sprint 2) |
| NFR-11 | Role-specific navigation menu | TC-21 | D | **Pending Implementation** (Scheduled for Sprint 2 full dashboard UI) |
| NFR-12 | Meaningful, safe error messages | TC-02, TC-06, TC-10, TC-12 | T | **Passed (Auth/Health)** / Pending Implementation (Financial errors pending Sprint 2) |
| NFR-13 | Core operations within 3 navigation actions | TC-21 | D | **Pending Implementation** (Scheduled for Sprint 2) |
| NFR-14 | Modular structure | REV-01 | I | **Passed** (Verified 2026-10-22 via architecture review REV-01) |
| NFR-15 | Naming convention and documentation | REV-02 | I | **Passed** (Verified 2026-10-22 via oxlint & code review REV-02) |
| NFR-16 | Unique identifiers | TC-04, TC-14, REV-03 | T, I | **Passed (Schema Constraints)** / Pending Implementation (Runtime generation pending Sprint 2) |
| NFR-17 | Balances consistent with records | TC-10, Section 5.2 | T, A | **Pending Implementation** (Scheduled for Sprint 2) |
| NFR-18 | Prevent invalid data storage | TC-04, TC-12, REV-03 | T, I | **Passed (Schema & Auth Input)** / Pending Implementation (Financial input pending Sprint 2) |

**Coverage:** all 25 functional requirements and all 18 non-functional
requirements have at least one verification activity.

---

## 10. Roles, Schedule and Risks

### 10.1 Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Test lead (team member) | Maintains this plan, tracks progress and prepares the test summary report |
| Testers (all team members) | Execute test cases, record results and log defects |
| Developers (all team members) | Fix defects and support regression testing |
| Reviewer (team member not involved in the module) | Performs REV-01 to REV-03 |

### 10.2 Schedule

| Activity | Planned Phase |
|---|---|
| Test planning and test case design | Phase 1 (this document) |
| Test data preparation | Start of the implementation phase |
| Module and integration testing | During implementation, as each module is completed |
| System, security and performance testing | Testing and validation phase |
| Regression testing and test summary report | Before the final demonstration |

### 10.3 Risks and Contingencies

| Risk | Impact | Contingency |
|---|---|---|
| Implementation is delayed, leaving less time for testing | Tests not completed | Test high-priority cases first (Section 6.2) |
| Forcing a failure for TC-10 is difficult | NFR-09 not verified | Add a test-only failure setting during implementation, or verify with a database-level transaction test |
| Test data becomes inconsistent between runs | False failures | Reset the database to the baseline before each run |
| Too few people to create 10 concurrent users for TC-11 | NFR-06/NFR-07 not verified under load | Use a simple script or an API client runner to simulate concurrent requests |
