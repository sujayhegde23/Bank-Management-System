# Software Test Plan

## Bank Management System

| Item | Details |
|---|---|
| Document | Software Test Plan |
| Project | Bank Management System (academic prototype) |
| Phase | Phase 1: Test Planning |
| Version | 1.0 |
| Date | 29 September 2026 |
| Standard followed | IEEE Std 829-2008 structure, aligned with ISO/IEC/IEEE 29119-3 |
| Related documents | [SRS](SRS.md), [Architecture and Design Specification](architecture_design.md), [RTM](rtm.md) |

> The system has not been implemented yet. This plan defines **how** it will be
> tested. All test cases are in the **Not Executed** state, and actual results
> will be recorded during the testing phase.

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

| Test Item | Architecture Component | Requirements |
|---|---|---|
| Authentication | Authentication & Authorization Service | FR-01, FR-02, FR-03, FR-22, NFR-01, NFR-02, NFR-05 |
| Customer Management | Customer Service | FR-04, FR-05, FR-06 |
| Account Management | Account Service | FR-07, FR-08, FR-09, FR-10, FR-11 |
| Deposit | Transaction Service | FR-11, FR-12, FR-18, FR-19 |
| Withdrawal | Transaction Service | FR-11, FR-13, FR-14, FR-18, FR-19 |
| Fund Transfer | Transaction Service | FR-11, FR-15, FR-16, FR-17, FR-18, FR-19 |
| Transaction History | Transaction Service | FR-20, FR-21 |
| Employee Management | Employee Administration Service | FR-23, FR-24 |
| Reporting | Reporting Service | FR-25 |
| Input Validation | Input Validation | NFR-04, NFR-18 |
| User Interface | Web User Interface | NFR-11, NFR-12, NFR-13 |
| Data Storage | Data Access Layer, Relational Database | NFR-08, NFR-09, NFR-10, NFR-16, NFR-17 |

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
| Modular structure and code documentation | NFR-14, NFR-15 | Code review REV-01, REV-02 (Section 4.8) |
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

Testing is mainly manual, black-box testing through the user interface. Some
tests also call the planned API directly using an API client, or inspect the
database with a database client. This is realistic for an academic prototype
built by a small team.

### 4.1 Functional Testing

Each functional requirement is tested against its acceptance criterion in the
[SRS](SRS.md#3-functional-requirements). Test cases use **equivalence
partitioning** (valid versus invalid inputs) and **boundary value analysis**
(for example, withdrawing exactly the available balance, or transferring 0.01).

### 4.2 Integration Testing

Integration tests verify that components work together across layers:

- Web User Interface → Authentication & Authorization Service (login, session
  checks)
- Transaction Service → Account Service → Data Access Layer → Relational
  Database (transfers update two accounts and one transaction record together)
- Employee Administration Service → Authentication & Authorization Service
  (a deactivated employee can no longer log in)

Each module is first tested on its own. Modules are then combined in this
order: authentication, customer, account, transaction, employee administration,
reporting.

### 4.3 Validation Testing

Validation testing confirms that the complete system meets user needs. Each
actor's main use cases from [Actors and Use Cases](actors_usecases.md) are run
end to end. For example, an employee registers a customer, creates an account
and deposits money, and then the customer logs in, transfers funds and views
the history.

### 4.4 Negative Testing

Every major operation is also tested with invalid or unauthorized actions:
wrong passwords, missing fields, negative and zero amounts, amounts above the
balance, frozen and inactive accounts, non-existent accounts, and access by the
wrong role. The expected result is always a clear rejection (NFR-12) with **no
change to stored data**.

### 4.5 Security Testing

Security testing follows the checklist in
[Section 5.1](#51-security-validation). It covers authentication, authorization,
password storage, input validation, session handling, account status
restrictions and data confidentiality.

### 4.6 Performance Testing

Response times are measured with the browser developer tools (Network tab) or
an API client while up to 10 users are active on the test environment (SRS
A-02). Each measured operation is repeated 20 times, and the requirement is met
if at most 1 of the 20 repetitions exceeds the limit (NFR-06, NFR-07).

### 4.7 Regression Testing

After each defect fix, the failed test case is repeated. The related high-priority
test cases (TC-01, TC-03, TC-05, TC-07 and TC-10) are also repeated to confirm
that nothing else was broken.

### 4.8 Reviews and Inspections

Some requirements are verified by review instead of execution:

| Review ID | Activity | Requirement |
|---|---|---|
| REV-01 | Review the source code structure to confirm separate modules for authentication, customer, account, transaction, employee administration and reporting | NFR-14 |
| REV-02 | Review source code for the documented naming convention and comments on public business-logic functions | NFR-15 |
| REV-03 | Inspect the database schema for primary keys, unique constraints and NOT NULL constraints | NFR-16, NFR-18 |

---

## 5. Test Environment and Validation

**Test environment**

| Item | Environment |
|---|---|
| Browser / client | Latest Google Chrome, plus one of Mozilla Firefox or Microsoft Edge, on a desktop or laptop |
| Application server / backend | The backend application/server layer of the prototype, running locally. The backend framework has not yet been selected ([SRS](SRS.md#25-design-and-implementation-constraints), C-08). |
| Database | MySQL Community Edition or an equivalent relational database, on the same machine or local network |
| Local development environment | Team laptops or lab machines (Windows, macOS or Linux), Visual Studio Code, Git and GitHub |
| Supporting tools | Browser developer tools (response times, requests), an API client such as Postman or curl (direct API calls), a database client such as MySQL Workbench (data inspection) |

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
| Passwords | Each test user has a test password recorded only in the team's private test-data sheet. In this document it is written as `<valid password>`. |

All amounts are in INR with two decimal places.

### 5.1 Security Validation

This section defines the security checks that must pass before the system is
accepted. Each check maps to a security requirement in the
[SRS](SRS.md#52-security-requirements) and to the test case that performs it.

| Check ID | Security Area | Validation Method | Expected Result | Requirement | Test Case |
|---|---|---|---|---|---|
| SV-01 | Login authentication | Log in as each role with valid credentials | Login succeeds and a session is created for the correct role | FR-01, NFR-05 | TC-01 |
| SV-02 | Invalid credentials | Log in with a wrong password, an unknown username and a deactivated employee | All three are rejected with the same generic message, which does not reveal whether the username exists | FR-01, FR-24, NFR-03, NFR-12 | TC-02, TC-18 |
| SV-03 | Role-based authorization | While logged in as a Customer, open employee and administrator functions from the UI and by entering their URLs | Access is denied with `AUTH_002`, and no data is shown or changed | FR-03, NFR-02 | TC-03 |
| SV-04 | Unauthorized URL / API access | Call protected API operations (for example `GET /api/accounts/{accountId}`) without a session and after logout | Requests are rejected with `AUTH_003`, and no data is returned | NFR-05, FR-02 | TC-03, TC-13 |
| SV-05 | Password storage | Inspect the user table after creating users and changing a password; search application logs for the test password | Only salted hashes are stored; the same password gives different hashes for different users; no plain-text password appears in logs | NFR-01 | TC-09, TC-17 |
| SV-06 | Input validation | Submit empty fields, negative, zero and non-numeric amounts, overlong text and SQL-like text such as `' OR '1'='1` | All are rejected with `VAL_001` before processing; no data changes; no SQL error is shown | NFR-04, NFR-18 | TC-12 |
| SV-07 | Access to protected operations | Attempt a deposit, withdrawal and transfer without being logged in | All are rejected with `AUTH_003` | NFR-05 | TC-03 |
| SV-08 | Account status restrictions | Deposit to, withdraw from and transfer to or from a frozen and an inactive account | All are rejected with `ACC_001`; balances unchanged; no transaction record | FR-11 | TC-08 |
| SV-09 | Data confidentiality | Logged in as Customer C1, request C2's account ACC-T2 and its transaction history by changing the ID in the URL or request | Access is denied; none of C2's data is returned | NFR-03 | TC-16 |
| SV-10 | Safe error responses | Trigger invalid operations and a forced internal error | Messages give the reason but contain no stack trace, SQL, table names or password hashes | NFR-12 | TC-10, TC-12 |

**Security validation pass criterion:** all checks SV-01 to SV-10 pass. Any
failed security check is recorded as a **Critical** defect and blocks the exit
criteria in Section 6.

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

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
| Actual Result | To be recorded during execution |
| Status | Not Executed |

### 8.1 Test Case Summary

| Test Case | Title | Type | Priority |
|---|---|---|---|
| TC-01 | Valid User Login | Functional, Security | High |
| TC-02 | Invalid User Login | Negative, Security | High |
| TC-03 | Role-Based Access Control | Security | High |
| TC-04 | Register Customer | Functional | High |
| TC-05 | Successful Deposit | Functional | High |
| TC-06 | Withdrawal with Insufficient Balance | Negative | High |
| TC-07 | Successful Fund Transfer | Functional, Integration | High |
| TC-08 | Transaction Attempt on Frozen or Inactive Account | Negative, Security | High |
| TC-09 | Password Security / Password Storage | Security | High |
| TC-10 | Failed Transaction Atomicity | Reliability | High |
| TC-11 | Response Time Validation | Performance | Medium |
| TC-12 | Invalid Input Rejection | Security, Data Integrity | High |
| TC-13 | Logout and Session Invalidation | Functional, Security | High |
| TC-14 | Create Bank Account with Unique Account Number | Functional | High |
| TC-15 | Successful Withdrawal | Functional | High |
| TC-16 | View Own Account Details and Transaction History | Functional, Security | High |
| TC-17 | Change Password | Functional, Security | Medium |
| TC-18 | Create and Deactivate Employee Account | Functional, Security | Medium |
| TC-19 | View Transaction Records and Generate Report | Functional | Medium |
| TC-20 | View and Update Customer Information | Functional | Medium |
| TC-21 | Role-Specific Navigation | Usability | Medium |

**Totals:** 21 test cases covering both functional and non-functional
requirements, plus 3 reviews (Section 4.8).

---

## 9. Test Traceability Matrix

Verification types: **T** = Test execution, **I** = Inspection or review,
**A** = Analysis, **D** = Demonstration.

### 9.1 Functional Requirements

| Requirement ID | Requirement | Test Case ID | Verification Type |
|---|---|---|---|
| FR-01 | Login with valid credentials | TC-01, TC-02 | T |
| FR-02 | Secure logout | TC-13 | T |
| FR-03 | Role-based access levels | TC-01, TC-03 | T |
| FR-04 | Register customer | TC-04 | T |
| FR-05 | View customer details | TC-20 | T |
| FR-06 | Update permitted customer information | TC-20 | T |
| FR-07 | Create bank account | TC-14 | T |
| FR-08 | Unique account number | TC-14 | T |
| FR-09 | View account details and balance | TC-16 | T |
| FR-10 | Manage account status | TC-08 | T |
| FR-11 | Block transactions on frozen/inactive accounts | TC-08 | T |
| FR-12 | Deposit | TC-05 | T |
| FR-13 | Withdrawal | TC-15 | T |
| FR-14 | Reject withdrawal with insufficient balance | TC-06 | T |
| FR-15 | Fund transfer | TC-07 | T |
| FR-16 | Balance check before transfer | TC-07 | T |
| FR-17 | Update sender and receiver balances | TC-07 | T |
| FR-18 | Unique transaction ID | TC-05, TC-07, TC-15 | T, A |
| FR-19 | Record completed transactions | TC-05, TC-07, TC-15 | T |
| FR-20 | Customer transaction history | TC-16 | T |
| FR-21 | Employee/administrator transaction view | TC-19 | T |
| FR-22 | Change password | TC-17 | T |
| FR-23 | Create and manage employee accounts | TC-18 | T |
| FR-24 | Deactivate employee accounts | TC-18 | T |
| FR-25 | Basic reports | TC-19 | T, A |

### 9.2 Non-Functional Requirements

| Requirement ID | Requirement | Test Case ID | Verification Type |
|---|---|---|---|
| NFR-01 | Passwords stored as salted hashes | TC-09, TC-17 | I, T |
| NFR-02 | Role-based feature restriction | TC-03, TC-18, TC-20 | T |
| NFR-03 | Prevent unauthorized data access | TC-02, TC-03, TC-16 | T |
| NFR-04 | Input validation | TC-12 | T |
| NFR-05 | Authentication before sensitive operations | TC-01, TC-03, TC-13 | T |
| NFR-06 | Response time ≤ 3 s (95%) | TC-11 | T |
| NFR-07 | Transaction time ≤ 5 s (95%) | TC-11 | T |
| NFR-08 | Consistent balances | TC-07, Section 5.2 | T, A |
| NFR-09 | No partial updates on failure | TC-10 | T |
| NFR-10 | One unmodifiable record per transaction | TC-05, TC-07, TC-15 | T, I |
| NFR-11 | Role-specific navigation menu | TC-21 | D |
| NFR-12 | Meaningful, safe error messages | TC-02, TC-06, TC-10, TC-12 | T |
| NFR-13 | Core operations within 3 navigation actions | TC-21 | D |
| NFR-14 | Modular structure | REV-01 | I |
| NFR-15 | Naming convention and documentation | REV-02 | I |
| NFR-16 | Unique identifiers | TC-04, TC-14, REV-03 | T, I |
| NFR-17 | Balances consistent with records | TC-10, Section 5.2 | T, A |
| NFR-18 | Prevent invalid data storage | TC-04, TC-12, REV-03 | T, I |

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
