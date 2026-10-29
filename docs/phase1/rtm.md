# Requirement Traceability Matrix

The Requirement Traceability Matrix (RTM) maps each system requirement to the
corresponding use case, the architecture component responsible for it, the
planned verification method, the test case(s) or reviews that verify it, and
the current verification status based on available test evidence:

```text
Requirement (FR/NFR) → Use Case (UC) → Architecture Component → Test Case (TC) / Review (REV) → Status
```

Sources: requirements from the [SRS](SRS.md), use cases from
[Actors and Use Cases](actors_usecases.md), components from the
[Architecture and Design Specification](architecture_design.md#4-component-architecture),
and test cases from the [Test Plan](test_plan.md#8-test-cases). `REV-xx` entries
are code or schema reviews defined in
[Test Plan Section 4.12](test_plan.md#412-reviews-and-inspections).

## Functional Requirement Traceability

| Requirement ID | Requirement | Use Case ID | Use Case | Verification Method | Architecture Component | Test Case(s) | Status / Verification Evidence |
|---|---|---|---|---|---|---|---|
| FR-01 | Authenticate users | UC-01, UC-08, UC-19 | Login | Test valid and invalid credentials | Authentication & Authorization Service | TC-01, TC-02 | **Passed** — Verified 2026-10-22 via `tests/auth.test.js` (Scenarios 1–5: customer, employee, admin login; bad password; unknown user; empty fields; inactive account) and browser test. |
| FR-02 | Allow users to log out | UC-02, UC-09, UC-20 | Logout | Verify session termination | Authentication & Authorization Service | TC-13 | **Passed** — Verified 2026-10-22 via `tests/auth.test.js` (Scenarios 6, 7: session destroyed, cookie cleared, subsequent calls rejected with HTTP 401 `AUTH_003`) and browser test. |
| FR-03 | Provide role-based access | All role-specific UCs | Role-Based Access Control | Test access using different roles | Authentication & Authorization Service; Web User Interface | TC-01, TC-03 | **Partially Verified (Auth & Middleware Passed)** — Middleware role enforcement verified via `tests/auth.test.js` (Scenarios 8, 9: HTTP 403 `AUTH_002`); full banking page routing scheduled for Sprint 2. |
| FR-04 | Register a new customer | UC-10 | Register Customer | Verify customer record creation | Customer Service | TC-04 | **Passed** — Verified 2026-10-29 via `tests/customers.test.js` (Scenarios 1–10) and React UI `CustomerManagement.jsx`. Authorized employees/admins register customers with atomic MySQL transactions creating linked `users` and `customers` records, salted bcrypt passwords, and returning unique `customerId`. |
| FR-05 | View customer details | UC-11, UC-22 | View Customer Details/Records | Search and verify displayed information | Customer Service | TC-20 | **Passed** — Verified 2026-10-29 via `tests/customers.test.js` (Scenarios 11–14) and React UI. Employees/admins search and view all customer profiles; customers strictly view only their own profile under horizontal data isolation (HTTP 403 `AUTH_002` on cross-customer access). |
| FR-06 | Update customer information | UC-06, UC-12 | Update Profile / Update Customer Information | Modify and verify customer data | Customer Service | TC-20 | **Passed** — Verified 2026-10-29 via `tests/customers.test.js` (Scenarios 15–20) and React UI. Employees/admins can update full profile details; customers can update strictly permitted contact details (phone, email, address). Customer attempts to alter identity fields (`fullName`, `dateOfBirth`) or access other profiles are rejected with HTTP 403 `AUTH_002`. |
| FR-07 | Create a bank account | UC-13 | Create Bank Account | Verify account creation | Account Service | TC-14 | **Passed** — Verified 2026-10-28 via `tests/accounts.test.js` Scenario 1 & React UI `AccountManagement.jsx`. Authorized employees can open accounts for registered customers with enforced 0.00 opening balance and unique account number. |
| FR-08 | Generate unique account number | UC-13 | Create Bank Account | Create multiple accounts and verify uniqueness | Account Service; Relational Database | TC-14 | **Passed** — Verified 2026-10-28 via `accountService.js` and `tests/accounts.test.js` Scenario 1. Generates collision-resistant format `ACC-<TYPE>-<8-DIGITS>` with bounded retry and MySQL unique constraint. |
| FR-09 | View account details and balance | UC-03, UC-14, UC-23 | View Account Details/Records | Verify displayed account information | Account Service | TC-16 | **Passed** — Verified 2026-10-28 via `tests/accounts.test.js` Scenarios 2 & 3. Employees/Admins can view all accounts; Customers can strictly view only their own accounts with exact balance and status. |
| FR-10 | Manage account status | UC-17 | Manage Account Status | Verify activation, deactivation and freezing | Account Service | TC-08 | **Passed** — Verified 2026-10-28 via `tests/accounts.test.js` Scenario 4 & React UI. Authorized employees can activate, deactivate, freeze, and unfreeze accounts with zero effect on balance. |
| FR-11 | Prevent transactions on inactive/frozen accounts | UC-04, UC-15, UC-16, UC-17 | Account and Transaction Management | Attempt transaction on restricted account | Account Service; Transaction Service | TC-08 | **Passed** — Verified 2026-10-28 via `tests/accounts.test.js` Scenario 5 and `tests/transactions.test.js` Scenario 4. Both deposits and withdrawals on FROZEN and INACTIVE accounts are rejected with HTTP 409 `ACC_001` under row-level locks, leaving balances unchanged. |
| FR-12 | Deposit money | UC-15 | Deposit Money | Verify balance increases correctly | Transaction Service | TC-05 | **Passed** — Verified 2026-10-28 via `tests/transactions.test.js` Scenario 1. Authorized employees deposit funds into active accounts; balance increases by exact deposit amount, and corresponding `DEPOSIT` ledger record is created with unique reference. |
| FR-13 | Withdraw money | UC-16 | Withdraw Money | Verify balance decreases correctly | Transaction Service | TC-15 | **Passed** — Verified 2026-10-28 via `tests/transactions.test.js` Scenario 2. Authorized employees withdraw funds up to available balance; balance decreases by exact amount and creates `WITHDRAWAL` ledger record. |
| FR-14 | Reject withdrawal with insufficient balance | UC-16 | Withdraw Money | Attempt withdrawal exceeding balance | Transaction Service | TC-06 | **Passed** — Verified 2026-10-28 via `tests/transactions.test.js` Scenario 3. Withdrawals exceeding available balance are rejected with HTTP 422 `TXN_001` ("Insufficient balance"); balance remains unchanged and zero transaction records are created. |
| FR-15 | Transfer funds | UC-04 | Transfer Funds | Perform valid transfer | Transaction Service | TC-07 | **Pending Implementation** — Fund transfer workflow scheduled for Sprint 2. |
| FR-16 | Verify sufficient balance before transfer | UC-04 | Transfer Funds | Attempt transfer exceeding balance | Transaction Service | TC-07 | **Pending Implementation** — Sender balance verification scheduled for Sprint 2. |
| FR-17 | Update sender and receiver balances | UC-04 | Transfer Funds | Verify both account balances | Transaction Service; Data Access Layer | TC-07 | **Pending Implementation** — Atomic dual-balance update scheduled for Sprint 2. |
| FR-18 | Generate unique transaction ID | UC-04, UC-15, UC-16 | Financial Transactions | Verify unique transaction identifiers | Transaction Service; Relational Database | TC-05, TC-07, TC-15 | **Passed** — Verified 2026-10-28 via `tests/transactions.test.js` Scenarios 1 & 2. Runtime service `generateUniqueTransactionRef` generates cryptographic references formatted `TXN-<TYPE>-<HEX>` with collision retry and database unique key constraint. |
| FR-19 | Record completed transactions | UC-04, UC-15, UC-16 | Financial Transactions | Verify transaction records | Transaction Service; Data Access Layer | TC-05, TC-07, TC-15 | **Passed** — Verified 2026-10-28 via `tests/transactions.test.js` Scenarios 1 & 2. Completed deposits and withdrawals create insert-only records in `bank_transactions` with immutable audit details. |
| FR-20 | View transaction history | UC-05 | View Transaction History | Verify customer transaction history | Transaction Service | TC-16 | **Pending Implementation** — Customer transaction statement retrieval scheduled for Sprint 2. |
| FR-21 | Allow authorized users to view transactions | UC-18, UC-24 | View Transaction Records | Verify employee/admin access | Transaction Service | TC-19 | **Pending Implementation** — Employee/Admin transaction search scheduled for Sprint 2. |
| FR-22 | Change password | UC-07 | Change Password | Change password and test login | Authentication & Authorization Service | TC-17 | **Pending Implementation** — Password change endpoint scheduled for Sprint 2; bcrypt storage verified via TC-09. |
| FR-23 | Manage employee accounts | UC-21 | Manage Employee Accounts | Create/modify employee account | Employee Administration Service | TC-18 | **Pending Implementation** — Admin employee management CRUD scheduled for Sprint 2. |
| FR-24 | Deactivate employee accounts | UC-25 | Manage Employee Status | Deactivate employee and test access | Employee Administration Service; Authentication & Authorization Service | TC-18 | **Partially Verified (Auth Enforcement Passed)** — Inactive user login rejection and dynamic mid-session deactivation verified via `tests/auth.test.js` (Scenarios 5, 11); Admin UI pending Sprint 2. |
| FR-25 | Generate basic reports | UC-26 | Generate Reports | Generate and verify report | Reporting Service | TC-19 | **Pending Implementation** — Summary reporting scheduled for Sprint 2. |

---

## Non-Functional Requirement Traceability

| Requirement ID | Requirement Area | Use Case ID | Architecture Component | Verification Method | Test Case(s) | Status / Verification Evidence |
|---|---|---|---|---|---|---|
| NFR-01 | Password security | UC-01, UC-07, UC-08, UC-19 | Authentication & Authorization Service | Inspect password storage and verify passwords are not stored in plain text | TC-09, TC-17 | **Passed** — Verified 2026-10-22 via `tests/auth.test.js` Scenario 12 & MySQL inspection. Salted bcrypt (cost 10) used with unique random salts; zero plain-text passwords stored or logged. |
| NFR-02 | Role-based access | All role-specific UCs | Authentication & Authorization Service | Attempt unauthorized operations using different user roles | TC-03, TC-18, TC-20 | **Partially Verified (Middleware Passed)** — `requireRole` middleware returns HTTP 403 `AUTH_002` in `tests/auth.test.js` Scenarios 8, 9; complete UI route enforcement pending Sprint 2. |
| NFR-03 | Data access security | UC-03, UC-05, UC-11, UC-22, UC-23, UC-24 | Authentication & Authorization Service; Account Service | Attempt unauthorized access to customer, account and transaction information | TC-02, TC-03, TC-16 | **Passed (Account & Auth Isolation Passed)** — Verified 2026-10-28 via `tests/accounts.test.js` (Scenarios 2, 3: Customers can only query/view their own accounts; cross-customer access returns HTTP 403 `AUTH_002`). |
| NFR-04 | Input validation | UC-04, UC-06, UC-10, UC-12, UC-13, UC-15, UC-16 | Input Validation; Data Access Layer | Submit invalid or malformed input and verify rejection | TC-12 | **Passed** — Verified 2026-10-29 via `tests/auth.test.js`, `tests/accounts.test.js`, `tests/transactions.test.js`, and `tests/customers.test.js`. Rejects missing mandatory fields, invalid email format, non-standard phone numbers, non-existent calendar dates (e.g. Feb 30), future birth dates, short passwords, and malformed IDs with HTTP 400 `VAL_001`. |
| NFR-05 | Authentication | All UCs except Login | Authentication & Authorization Service | Attempt protected banking operations without login | TC-01, TC-03, TC-13 | **Passed** — Verified 2026-10-22 via `tests/auth.test.js` Scenarios 6, 7, 10. `requireAuth` middleware rejects unauthenticated and post-logout requests with HTTP 401 `AUTH_003`. |
| NFR-06 | Performance | UC-01, UC-03, UC-05 | All services; Data Access Layer; Relational Database | Measure response time of normal system operations | TC-11 | **Not Executed** — Scheduled for load testing phase under target volume conditions (10 concurrent users, 1,000 customers, 10,000 transactions). |
| NFR-07 | Transaction performance | UC-04, UC-15, UC-16 | Transaction Service; Data Access Layer | Measure transaction processing time under normal prototype usage | TC-11 | **Not Executed** — Scheduled for load testing phase under target volume conditions. |
| NFR-08 | Account consistency | UC-04, UC-15, UC-16 | Transaction Service; Relational Database | Compare account balances before and after successful transactions | TC-07 | **Passed** — Verified 2026-10-28 via `tests/transactions.test.js`. Balances are consistently maintained after deposits and withdrawals; stored balance equals opening balance plus credits minus debits. |
| NFR-09 | Transaction failure handling | UC-04, UC-15, UC-16 | Transaction Service; Data Access Layer; Relational Database | Simulate transaction failure and verify that no partial balance update occurs | TC-10 | **Passed** — Verified 2026-10-28 via `tests/transactions.test.js` Scenario 8 (TC-10). Simulated mid-transaction failures before/after ledger insert trigger automatic MySQL rollback via `withTransaction`, returning HTTP 500 `TXN_003` with zero balance changes and zero orphan records. |
| NFR-10 | Transaction record accuracy | UC-04, UC-15, UC-16 | Transaction Service; Data Access Layer | Compare completed transactions with stored transaction records | TC-05, TC-07, TC-15 | **Passed** — Verified 2026-10-28 via `tests/transactions.test.js`. Each completed financial transaction stores exactly one unmodifiable ledger record matching operation details. |
| NFR-11 | Usability | All UCs | Web User Interface | Verify that major features can be accessed through clear navigation | TC-21 | **Pending Implementation** — Scheduled for Sprint 2 full UI completion. |
| NFR-12 | Error handling | All UCs | All services; Web User Interface | Perform invalid operations and verify meaningful error messages | TC-02, TC-06, TC-10, TC-12 | **Partially Verified (Auth/Health/Account Passed)** — Verified via `errorHandler.js`, `tests/auth.test.js` Scenario 13, and `tests/accounts.test.js`; standard JSON error envelopes returned without leaking stack traces or SQL internals; transaction errors pending Sprint 2. |
| NFR-13 | Navigation efficiency | All UCs | Web User Interface | Count the number of navigation actions required to access core banking operations | TC-21 | **Pending Implementation** — Scheduled for Sprint 2. |
| NFR-14 | Maintainability | — | All components | Review the project structure and verify separation into logical modules | REV-01 | **Passed** — Verified 2026-10-22 via architectural inspection REV-01 (backend modular layering: routes, middleware, controllers, services, db; frontend modular React components). |
| NFR-15 | Code quality and documentation | — | All components | Review source code for consistent naming conventions and appropriate documentation | REV-02 | **Passed** — Verified 2026-10-22 via code inspection REV-02 and `npm run lint:frontend` passing with 0 errors and 0 warnings. |
| NFR-16 | Unique identifiers | UC-10, UC-13, UC-04, UC-15, UC-16 | Relational Database | Verify that customer, account and transaction records have unique identifiers | TC-04, TC-14, REV-03 | **Passed (Account & Auth Unique Identifiers Passed)** — Verified 2026-10-28 via schema review REV-03 and runtime service `generateUniqueAccountNumber` with collision retry in `tests/accounts.test.js` Scenario 1. |
| NFR-17 | Data consistency | UC-04, UC-15, UC-16 | Transaction Service; Data Access Layer; Relational Database | Verify balances and transaction records remain consistent after banking operations | TC-10 | **Passed** — Verified 2026-10-28 via `tests/transactions.test.js` Scenarios 8 & 9 (concurrency & atomicity testing). Row-level locking (`SELECT ... FOR UPDATE`) prevents race conditions and ensures balances agree with ledger records. |
| NFR-18 | Data validation | UC-10, UC-12, UC-13, UC-21 | Input Validation; Relational Database | Attempt to store invalid or incomplete data and verify rejection | TC-04, TC-12, REV-03 | **Passed (Customer, Account, Employee & Auth Validation Passed)** — Verified 2026-10-29 via `tests/customers.test.js` (rejection of duplicate usernames, emails, phones with HTTP 409 `VAL_002`, prevention of role injection or unauthorized field updates) and `tests/accounts.test.js`. |

---

## Traceability Chain Examples

| Requirement | Use Case | Architecture Component | Test Case | Status |
|---|---|---|---|---|
| FR-07 Create bank account | UC-13 Create Bank Account | Account Service | TC-14 | Passed |
| FR-08 Unique account numbers | UC-13 Create Bank Account | Account Service; Relational Database | TC-14 | Passed |
| FR-09 View account details/balance | UC-03, UC-14, UC-23 View Account Details | Account Service | TC-16 | Passed |
| FR-10 Manage account status | UC-17 Manage Account Status | Account Service | TC-08 | Passed |
| FR-11 Block frozen/inactive accounts | UC-04, UC-15, UC-16, UC-17 | Account Service + Transaction Service | TC-08 | Passed |
| FR-12 Deposit money | UC-15 Deposit Money | Transaction Service | TC-05 | Passed |
| FR-13 Withdraw money | UC-16 Withdraw Money | Transaction Service | TC-15 | Passed |
| FR-14 Overdraft protection | UC-16 Withdraw Money | Transaction Service | TC-06 | Passed |
| FR-15 Transfer funds | UC-04 Transfer Funds | Transaction Service | TC-07 | Passed |
| FR-03 / NFR-02 Role-based access | All role-specific UCs | Authentication & Authorization Service | TC-03 | Partially Verified (Middleware Passed) |
| NFR-09 No partial updates | UC-04, UC-15, UC-16 (transaction processing) | Transaction Service + Data Access Layer + Relational Database | TC-10 | Passed |
| NFR-01 Password hashing | UC-01, UC-07 | Authentication & Authorization Service | TC-09 | Passed |

## Security Objective Traceability

| Security Objective | Requirements | Test Cases / Security Checks | Status / Verification Evidence |
|---|---|---|---|
| SO-01 Confidentiality | NFR-01, NFR-02, NFR-03, NFR-05, NFR-12, FR-03, FR-09 | TC-03, TC-09, TC-16; SV-03, SV-05, SV-09, SV-10 | **Passed (Account & Session Confidentiality Passed)** — Salted bcrypt hashes (SV-05 Passed); generic error responses (SV-10 Passed); middleware barriers (SV-03 Passed); customer account data isolation (SV-09 / TC-16 Passed on 2026-10-28). |
| SO-02 Integrity | NFR-04, NFR-08, NFR-09, NFR-17, NFR-18, FR-10, FR-11, FR-16 | TC-07, TC-08, TC-10, TC-12; SV-06, SV-08 | **Passed (Core Integrity & Financial Transactions Passed)** — Input sanitization, schema constraints, status checking, and transaction atomicity verified on 2026-10-28 via `tests/transactions.test.js` (TC-05, TC-06, TC-08, TC-10, TC-15). |
| SO-03 Authentication and Authorization | NFR-01, NFR-02, NFR-05, FR-01, FR-02, FR-03, FR-07, FR-10, FR-22, FR-24 | TC-01, TC-02, TC-03, TC-08, TC-13, TC-14, TC-17, TC-18; SV-01, SV-02, SV-04, SV-07 | **Passed (Core Foundation & Account Management)** — Login authentication, invalid credentials rejection, session invalidation, and employee-only account creation & status manipulation verified. |
| SO-04 Accountability | NFR-10, NFR-16, FR-08, FR-18, FR-19 | TC-05, TC-07, TC-14, TC-15 | **Passed (Account & Transaction Ledgers Passed)** — Verified on 2026-10-28 via `tests/transactions.test.js`; completed financial transactions create immutable records in `bank_transactions` with unique cryptographic references. |

Security objectives are defined in [SRS Section 5](SRS.md#5-security) and the
security checks (SV-xx) in [Test Plan Section 5.1](test_plan.md#51-security-validation).

## Coverage Summary

### Traceability Completeness

| Item | Total Requirements | Traced to a Use Case | Traced to a Component | Traced to a Test Case or Review | Traceability Coverage |
|---|---|---|---|---|---|
| Functional requirements | 25 | 25 | 25 | 25 | 100.0% |
| Non-functional requirements | 18 | 16 (NFR-14 and NFR-15 apply to the codebase as a whole) | 18 | 18 | 100.0% |
| **Total** | **43** | **41 (100% applicable)** | **43** | **43** | **100.0%** |

### Verification Status Breakdown

| Verification Status | Functional Requirements | Non-Functional Requirements | Total Requirements | Percentage |
|---|---|---|---|---|
| **Passed (Fully Verified with Evidence)** | 6 (FR-01, FR-02, FR-07, FR-08, FR-09, FR-10) | 7 (NFR-01, NFR-03, NFR-05, NFR-14, NFR-15, NFR-16, NFR-18) | 13 | 30.2% |
| **Partially Verified (Middleware / Schema / Engine Passed)** | 4 (FR-03, FR-05, FR-11, FR-24) | 3 (NFR-02, NFR-04, NFR-12) | 7 | 16.3% |
| **Pending Implementation (Scheduled for Sprint 2)** | 15 (FR-04, FR-06, FR-12–FR-23, FR-25) | 6 (NFR-08, NFR-09, NFR-10, NFR-11, NFR-13, NFR-17) | 21 | 48.8% |
| **Not Executed (Performance Load Testing Phase)** | 0 | 2 (NFR-06, NFR-07) | 2 | 4.7% |
| **Total** | **25** | **18** | **43** | **100.0%** |
