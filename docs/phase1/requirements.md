# Software Requirements Specification

## 1. Functional Requirements

Functional requirements describe the operations and services that the Bank
Management System must provide.

### Authentication

**FR-01:** The system shall allow registered users to log in using valid credentials.

**FR-02:** The system shall allow authenticated users to log out securely.

**FR-03:** The system shall provide different levels of access based on the user's
role such as Customer, Bank Employee and Administrator.

---

### Customer Management

**FR-04:** The system shall allow authorized bank employees to register a new customer.

**FR-05:** The system shall allow authorized users to view customer details.

**FR-06:** The system shall allow customers or authorized employees to update
permitted customer information.

---

### Account Management

**FR-07:** The system shall allow authorized bank employees to create a bank account
for a registered customer.

**FR-08:** The system shall generate a unique account number for every bank account.

**FR-09:** The system shall allow customers to view their account details and
current balance.

**FR-10:** The system shall allow authorized employees to activate, deactivate,
freeze or unfreeze a bank account.

**FR-11:** The system shall prevent financial transactions on frozen or inactive
accounts.

---

### Deposit and Withdrawal

**FR-12:** The system shall allow money to be deposited into an active bank account.

**FR-13:** The system shall allow money to be withdrawn from an active bank account.

**FR-14:** The system shall reject a withdrawal if the account does not contain
sufficient balance.

---

### Fund Transfer

**FR-15:** The system shall allow customers to transfer money from their account to
another valid bank account.

**FR-16:** The system shall verify that sufficient balance is available before
processing a fund transfer.

**FR-17:** The system shall update both the sender's and receiver's account balances
after a successful transfer.

---

### Transaction Management

**FR-18:** The system shall generate a unique transaction ID for every successful
financial transaction.

**FR-19:** The system shall record details of every completed deposit, withdrawal
and fund transfer.

**FR-20:** The system shall allow customers to view their transaction history.

**FR-21:** The system shall allow authorized bank employees and administrators to
view transaction records.

---

### User Account Management

**FR-22:** The system shall allow users to change their password.

**FR-23:** The system shall allow administrators to create and manage employee
accounts.

**FR-24:** The system shall allow administrators to deactivate employee accounts.

---

### Reports

**FR-25:** The system shall allow administrators to view basic reports related to
customers, accounts and transactions.



## 2. Non-Functional Requirements

Non-functional requirements describe how well the Bank Management System should
perform and the quality constraints that the system must satisfy.

### Security Requirements

**NFR-01:** User passwords shall not be stored in plain text.

**NFR-02:** The system shall restrict access to features based on the authenticated
user's role.

**NFR-03:** The system shall prevent unauthorized users from accessing customer,
account and transaction information.

**NFR-04:** The system shall validate user input before processing banking
operations.

**NFR-05:** Sensitive banking operations shall only be performed after successful
authentication.

---

### Performance Requirements

**NFR-06:** Normal system operations such as login, balance enquiry and viewing
transaction history should respond within 3 seconds under normal academic
prototype usage.

**NFR-07:** The system shall process transactions without unnecessary delays under
the expected number of users.

---

### Reliability Requirements

**NFR-08:** The system shall maintain consistent account balances after every
successful financial transaction.

**NFR-09:** If a transaction fails before completion, the system shall not leave
account balances in a partially updated state.

**NFR-10:** The system shall maintain transaction records accurately for future
reference.

---

### Usability Requirements

**NFR-11:** The user interface shall provide clear navigation for customers,
employees and administrators.

**NFR-12:** The system shall display meaningful error messages when an invalid
operation is performed.

**NFR-13:** Banking operations shall require minimal steps for users to complete.

---

### Maintainability Requirements

**NFR-14:** The system shall use a modular structure so that individual features can
be modified without significantly affecting unrelated components.

**NFR-15:** The source code shall follow consistent naming conventions and include
appropriate documentation.

---

### Data Integrity Requirements

**NFR-16:** Every customer, account and transaction shall have a unique identifier.

**NFR-17:** Account balances and transaction records shall remain consistent after
deposit, withdrawal and fund transfer operations.

**NFR-18:** The system shall prevent invalid or incomplete data from being stored in
the database.





## 3. Requirement Validation and Testability

Each requirement must be clear, measurable and testable so that it can be verified
during the testing phase of the project.

### Functional Requirement Validation

| Requirement ID | Validation / Test Method | Expected Result |
|---|---|---|
| FR-01 | Attempt login using valid and invalid credentials | Valid credentials allow login and invalid credentials are rejected |
| FR-02 | Log in and select logout | User session is terminated successfully |
| FR-03 | Log in using Customer, Employee and Administrator accounts | Each role can access only its permitted features |
| FR-04 | Employee enters valid customer details and submits registration | New customer record is created successfully |
| FR-05 | Search for an existing customer | Correct customer details are displayed |
| FR-06 | Modify permitted customer information | Updated information is stored correctly |
| FR-07 | Create an account for an existing customer | New bank account is successfully created |
| FR-08 | Create multiple bank accounts | Each account receives a unique account number |
| FR-09 | Customer views account information | Correct account details and balance are displayed |
| FR-10 | Employee freezes or deactivates an account | Account status is updated successfully |
| FR-11 | Attempt a transaction using a frozen or inactive account | Transaction is rejected |
| FR-12 | Deposit a valid amount into an active account | Account balance increases by the deposited amount |
| FR-13 | Withdraw a valid amount from an active account | Account balance decreases by the withdrawn amount |
| FR-14 | Attempt withdrawal greater than available balance | Withdrawal is rejected |
| FR-15 | Transfer money between two valid accounts | Transfer is completed successfully |
| FR-16 | Attempt transfer with insufficient balance | Transfer is rejected |
| FR-17 | Complete a successful fund transfer | Sender balance decreases and receiver balance increases correctly |
| FR-18 | Perform multiple transactions | Every transaction receives a unique transaction ID |
| FR-19 | Perform deposit, withdrawal and transfer operations | Each successful transaction is stored |
| FR-20 | Customer opens transaction history | Transactions belonging to the customer are displayed |
| FR-21 | Employee/Admin views transaction records | Authorized transaction records are displayed |
| FR-22 | User changes password and logs in using the new password | New password works and old password is rejected |
| FR-23 | Administrator creates an employee account | Employee account is created successfully |
| FR-24 | Administrator deactivates an employee account | Deactivated employee can no longer access the system |
| FR-25 | Administrator requests a report | Requested banking information is displayed correctly |

---

### Non-Functional Requirement Validation

| Requirement ID | Validation / Test Method | Expected Result |
|---|---|---|
| NFR-01 | Inspect stored user credentials | Passwords are not stored as plain text |
| NFR-02 | Access features using different user roles | Unauthorized features cannot be accessed |
| NFR-03 | Attempt unauthorized access to banking information | Access is denied |
| NFR-04 | Submit invalid or malformed input | Invalid input is rejected |
| NFR-05 | Attempt protected banking operation without authentication | Operation is denied |
| NFR-06 | Measure response time of normal operations | Operations complete within approximately 3 seconds under normal load |
| NFR-08 | Perform multiple valid transactions | Account balances remain correct |
| NFR-09 | Force a transaction failure during processing | No partial balance update occurs |
| NFR-10 | Compare completed transactions with stored transaction records | Records accurately represent completed transactions |
| NFR-11 | Navigate through the interface | Major features can be accessed clearly |
| NFR-12 | Perform an invalid operation | A meaningful error message is displayed |
| NFR-14 | Review project source structure | Features are separated into logical modules |
| NFR-16 | Inspect customer, account and transaction identifiers | Each record has a unique identifier |
| NFR-17 | Compare balances before and after transactions | Balances and transaction records remain consistent |
| NFR-18 | Submit incomplete or invalid records | Invalid data is not stored |