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