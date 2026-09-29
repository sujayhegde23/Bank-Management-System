# Requirement Traceability Matrix

The Requirement Traceability Matrix (RTM) maps each system requirement to the
corresponding use case, the architecture component responsible for it, the
planned verification method and the test case(s) that verify it. This ensures
that requirements can be traced throughout the development and testing process:

```text
Requirement (FR/NFR) → Use Case (UC) → Architecture Component → Test Case (TC)
```

Sources: requirements from the [SRS](SRS.md), use cases from
[Actors and Use Cases](actors_usecases.md), components from the
[Architecture and Design Specification](architecture_design.md#4-component-architecture),
and test cases from the [Test Plan](test_plan.md#8-test-cases). `REV-xx` entries
are code or schema reviews defined in
[Test Plan Section 4.8](test_plan.md#48-reviews-and-inspections).

## Functional Requirement Traceability

| Requirement ID | Requirement | Use Case ID | Use Case | Verification | Architecture Component | Test Case(s) |
|---|---|---|---|---|---|---|
| FR-01 | Authenticate users | UC-01, UC-08, UC-19 | Login | Test valid and invalid credentials | Authentication & Authorization Service | TC-01, TC-02 |
| FR-02 | Allow users to log out | UC-02, UC-09, UC-20 | Logout | Verify session termination | Authentication & Authorization Service | TC-13 |
| FR-03 | Provide role-based access | All role-specific UCs | Role-Based Access Control | Test access using different roles | Authentication & Authorization Service; Web User Interface | TC-01, TC-03 |
| FR-04 | Register a new customer | UC-10 | Register Customer | Verify customer record creation | Customer Service | TC-04 |
| FR-05 | View customer details | UC-11, UC-22 | View Customer Details/Records | Search and verify displayed information | Customer Service | TC-20 |
| FR-06 | Update customer information | UC-06, UC-12 | Update Profile / Update Customer Information | Modify and verify customer data | Customer Service | TC-20 |
| FR-07 | Create a bank account | UC-13 | Create Bank Account | Verify account creation | Account Service | TC-14 |
| FR-08 | Generate unique account number | UC-13 | Create Bank Account | Create multiple accounts and verify uniqueness | Account Service; Relational Database | TC-14 |
| FR-09 | View account details and balance | UC-03, UC-14, UC-23 | View Account Details/Records | Verify displayed account information | Account Service | TC-16 |
| FR-10 | Manage account status | UC-17 | Manage Account Status | Verify activation, deactivation and freezing | Account Service | TC-08 |
| FR-11 | Prevent transactions on inactive/frozen accounts | UC-04, UC-15, UC-16, UC-17 | Account and Transaction Management | Attempt transaction on restricted account | Account Service; Transaction Service | TC-08 |
| FR-12 | Deposit money | UC-15 | Deposit Money | Verify balance increases correctly | Transaction Service | TC-05 |
| FR-13 | Withdraw money | UC-16 | Withdraw Money | Verify balance decreases correctly | Transaction Service | TC-15 |
| FR-14 | Reject withdrawal with insufficient balance | UC-16 | Withdraw Money | Attempt withdrawal exceeding balance | Transaction Service | TC-06 |
| FR-15 | Transfer funds | UC-04 | Transfer Funds | Perform valid transfer | Transaction Service | TC-07 |
| FR-16 | Verify sufficient balance before transfer | UC-04 | Transfer Funds | Attempt transfer exceeding balance | Transaction Service | TC-07 |
| FR-17 | Update sender and receiver balances | UC-04 | Transfer Funds | Verify both account balances | Transaction Service; Data Access Layer | TC-07 |
| FR-18 | Generate unique transaction ID | UC-04, UC-15, UC-16 | Financial Transactions | Verify unique transaction identifiers | Transaction Service; Relational Database | TC-05, TC-07, TC-15 |
| FR-19 | Record completed transactions | UC-04, UC-15, UC-16 | Financial Transactions | Verify transaction records | Transaction Service; Data Access Layer | TC-05, TC-07, TC-15 |
| FR-20 | View transaction history | UC-05 | View Transaction History | Verify customer transaction history | Transaction Service | TC-16 |
| FR-21 | Allow authorized users to view transactions | UC-18, UC-24 | View Transaction Records | Verify employee/admin access | Transaction Service | TC-19 |
| FR-22 | Change password | UC-07 | Change Password | Change password and test login | Authentication & Authorization Service | TC-17 |
| FR-23 | Manage employee accounts | UC-21 | Manage Employee Accounts | Create/modify employee account | Employee Administration Service | TC-18 |
| FR-24 | Deactivate employee accounts | UC-25 | Manage Employee Status | Deactivate employee and test access | Employee Administration Service; Authentication & Authorization Service | TC-18 |
| FR-25 | Generate basic reports | UC-26 | Generate Reports | Generate and verify report | Reporting Service | TC-19 |

---

## Non-Functional Requirement Traceability

| Requirement ID | Requirement Area | Use Case ID | Architecture Component | Verification Method | Test Case(s) |
|---|---|---|---|---|---|
| NFR-01 | Password security | UC-01, UC-07, UC-08, UC-19 | Authentication & Authorization Service | Inspect password storage and verify passwords are not stored in plain text | TC-09, TC-17 |
| NFR-02 | Role-based access | All role-specific UCs | Authentication & Authorization Service | Attempt unauthorized operations using different user roles | TC-03, TC-18, TC-20 |
| NFR-03 | Data access security | UC-03, UC-05, UC-11, UC-22, UC-23, UC-24 | Authentication & Authorization Service; Account Service | Attempt unauthorized access to customer, account and transaction information | TC-02, TC-03, TC-16 |
| NFR-04 | Input validation | UC-04, UC-06, UC-10, UC-12, UC-13, UC-15, UC-16 | Input Validation; Data Access Layer | Submit invalid or malformed input and verify rejection | TC-12 |
| NFR-05 | Authentication | All UCs except Login | Authentication & Authorization Service | Attempt protected banking operations without login | TC-01, TC-03, TC-13 |
| NFR-06 | Performance | UC-01, UC-03, UC-05 | All services; Data Access Layer; Relational Database | Measure response time of normal system operations | TC-11 |
| NFR-07 | Transaction performance | UC-04, UC-15, UC-16 | Transaction Service; Data Access Layer | Measure transaction processing time under normal prototype usage | TC-11 |
| NFR-08 | Account consistency | UC-04, UC-15, UC-16 | Transaction Service; Relational Database | Compare account balances before and after successful transactions | TC-07 |
| NFR-09 | Transaction failure handling | UC-04, UC-15, UC-16 | Transaction Service; Data Access Layer; Relational Database | Simulate transaction failure and verify that no partial balance update occurs | TC-10 |
| NFR-10 | Transaction record accuracy | UC-04, UC-15, UC-16 | Transaction Service; Data Access Layer | Compare completed transactions with stored transaction records | TC-05, TC-07, TC-15 |
| NFR-11 | Usability | All UCs | Web User Interface | Verify that major features can be accessed through clear navigation | TC-21 |
| NFR-12 | Error handling | All UCs | All services; Web User Interface | Perform invalid operations and verify meaningful error messages | TC-02, TC-06, TC-10, TC-12 |
| NFR-13 | Navigation efficiency | All UCs | Web User Interface | Count the number of navigation actions required to access core banking operations | TC-21 |
| NFR-14 | Maintainability | — | All components | Review the project structure and verify separation into logical modules | REV-01 |
| NFR-15 | Code quality and documentation | — | All components | Review source code for consistent naming conventions and appropriate documentation | REV-02 |
| NFR-16 | Unique identifiers | UC-10, UC-13, UC-04, UC-15, UC-16 | Relational Database | Verify that customer, account and transaction records have unique identifiers | TC-04, TC-14, REV-03 |
| NFR-17 | Data consistency | UC-04, UC-15, UC-16 | Transaction Service; Data Access Layer; Relational Database | Verify balances and transaction records remain consistent after banking operations | TC-10 |
| NFR-18 | Data validation | UC-10, UC-12, UC-13, UC-21 | Input Validation; Relational Database | Attempt to store invalid or incomplete data and verify rejection | TC-04, TC-12, REV-03 |

---

## Traceability Chain Examples

| Requirement | Use Case | Architecture Component | Test Case |
|---|---|---|---|
| FR-15 Transfer funds | UC-04 Transfer Funds | Transaction Service | TC-07 |
| FR-03 / NFR-02 Role-based access | All role-specific UCs | Authentication & Authorization Service | TC-03 |
| NFR-09 No partial updates | UC-04, UC-15, UC-16 (transaction processing) | Transaction Service + Data Access Layer + Relational Database | TC-10 |
| NFR-01 Password hashing | UC-01, UC-07 | Authentication & Authorization Service | TC-09 |
| FR-11 Block frozen/inactive accounts | UC-04, UC-15, UC-16, UC-17 | Account Service + Transaction Service | TC-08 |

## Security Objective Traceability

| Security Objective | Requirements | Test Cases / Security Checks |
|---|---|---|
| SO-01 Confidentiality | NFR-01, NFR-02, NFR-03, NFR-05, NFR-12, FR-03 | TC-03, TC-09, TC-16; SV-03, SV-05, SV-09, SV-10 |
| SO-02 Integrity | NFR-04, NFR-08, NFR-09, NFR-17, NFR-18, FR-11, FR-16 | TC-07, TC-08, TC-10, TC-12; SV-06, SV-08 |
| SO-03 Authentication and Authorization | NFR-01, NFR-02, NFR-05, FR-01, FR-02, FR-03, FR-22, FR-24 | TC-01, TC-02, TC-03, TC-13, TC-17, TC-18; SV-01, SV-02, SV-04, SV-07 |
| SO-04 Accountability | NFR-10, NFR-16, FR-18, FR-19 | TC-05, TC-07, TC-15 |

Security objectives are defined in [SRS Section 5](SRS.md#5-security) and the
security checks (SV-xx) in [Test Plan Section 5.1](test_plan.md#51-security-validation).

## Coverage Summary

| Item | Total | Traced to a Use Case | Traced to a Component | Traced to a Test Case or Review |
|---|---|---|---|---|
| Functional requirements | 25 | 25 | 25 | 25 |
| Non-functional requirements | 18 | 16 (NFR-14 and NFR-15 apply to the code as a whole) | 18 | 18 |
