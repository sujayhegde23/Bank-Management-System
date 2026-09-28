# Requirement Traceability Matrix

The Requirement Traceability Matrix (RTM) maps each system requirement to the
corresponding use case and planned verification method. This ensures that
requirements can be traced throughout the development and testing process.

| Requirement ID | Requirement | Use Case ID | Use Case | Verification |
|---|---|---|---|---|
| FR-01 | Authenticate users | UC-01, UC-08, UC-19 | Login | Test valid and invalid credentials |
| FR-02 | Allow users to log out | UC-02, UC-09, UC-20 | Logout | Verify session termination |
| FR-03 | Provide role-based access | All role-specific UCs | Role-Based Access Control | Test access using different roles |
| FR-04 | Register a new customer | UC-10 | Register Customer | Verify customer record creation |
| FR-05 | View customer details | UC-11, UC-22 | View Customer Details/Records | Search and verify displayed information |
| FR-06 | Update customer information | UC-06, UC-12 | Update Profile / Update Customer Information | Modify and verify customer data |
| FR-07 | Create a bank account | UC-13 | Create Bank Account | Verify account creation |
| FR-08 | Generate unique account number | UC-13 | Create Bank Account | Create multiple accounts and verify uniqueness |
| FR-09 | View account details and balance | UC-03, UC-14, UC-23 | View Account Details/Records | Verify displayed account information |
| FR-10 | Manage account status | UC-17 | Manage Account Status | Verify activation, deactivation and freezing |
| FR-11 | Prevent transactions on inactive/frozen accounts | UC-15, UC-16, UC-17 | Account and Transaction Management | Attempt transaction on restricted account |
| FR-12 | Deposit money | UC-15 | Deposit Money | Verify balance increases correctly |
| FR-13 | Withdraw money | UC-16 | Withdraw Money | Verify balance decreases correctly |
| FR-14 | Reject withdrawal with insufficient balance | UC-16 | Withdraw Money | Attempt withdrawal exceeding balance |
| FR-15 | Transfer funds | UC-04 | Transfer Funds | Perform valid transfer |
| FR-16 | Verify sufficient balance before transfer | UC-04 | Transfer Funds | Attempt transfer exceeding balance |
| FR-17 | Update sender and receiver balances | UC-04 | Transfer Funds | Verify both account balances |
| FR-18 | Generate unique transaction ID | UC-04, UC-15, UC-16 | Financial Transactions | Verify unique transaction identifiers |
| FR-19 | Record completed transactions | UC-04, UC-15, UC-16 | Financial Transactions | Verify transaction records |
| FR-20 | View transaction history | UC-05 | View Transaction History | Verify customer transaction history |
| FR-21 | Allow authorized users to view transactions | UC-18, UC-24 | View Transaction Records | Verify employee/admin access |
| FR-22 | Change password | UC-07 | Change Password | Change password and test login |
| FR-23 | Manage employee accounts | UC-21 | Manage Employee Accounts | Create/modify employee account |
| FR-24 | Deactivate employee accounts | UC-25 | Manage Employee Status | Deactivate employee and test access |
| FR-25 | Generate basic reports | UC-26 | Generate Reports | Generate and verify report |

---

## Non-Functional Requirement Traceability

| Requirement ID | Requirement Area | Verification Method |
|---|---|---|
| NFR-01 | Password security | Inspect password storage |
| NFR-02 | Role-based access | Attempt unauthorized operations |
| NFR-03 | Data access security | Test unauthorized access |
| NFR-04 | Input validation | Submit invalid input |
| NFR-05 | Authentication | Attempt protected operation without login |
| NFR-06 | Performance | Measure response time |
| NFR-08 | Account consistency | Compare balances before and after transactions |
| NFR-09 | Transaction failure handling | Test failed transaction scenarios |
| NFR-10 | Transaction record accuracy | Compare transactions with stored records |
| NFR-11 | Usability | Evaluate navigation and interface |
| NFR-12 | Error handling | Perform invalid operations |
| NFR-14 | Maintainability | Review modular project structure |
| NFR-16 | Unique identifiers | Verify customer/account/transaction IDs |
| NFR-17 | Data consistency | Verify balances against transaction records |
| NFR-18 | Data validation | Attempt to store invalid/incomplete data |