# Actors and Use Cases

## 1. Actors

The Bank Management System has three primary actors:

### 1.1 Customer

The Customer is a bank account holder who uses the system to access account
information and perform permitted banking operations.

The Customer can:

- Log in and log out
- View account details
- Check account balance
- Transfer funds
- View transaction history
- Update permitted profile information
- Change password

---

### 1.2 Bank Employee

The Bank Employee is an authorized bank staff member who manages customers,
accounts and selected banking operations.

The Bank Employee can:

- Log in and log out
- Register customers
- View customer details
- Update customer information
- Create bank accounts
- View account details
- Deposit money
- Withdraw money
- Activate accounts
- Deactivate accounts
- Freeze or unfreeze accounts
- View transaction records

---

### 1.3 Administrator

The Administrator manages system-level users and has access to administrative
information.

The Administrator can:

- Log in and log out
- Manage employee accounts
- View customer records
- View account records
- View transaction records
- Activate or deactivate employee accounts
- Generate basic reports

---

## 2. Use Cases by Actor

### 2.1 Customer Use Cases

| Use Case ID | Use Case | Description |
|---|---|---|
| UC-01 | Login | Customer authenticates using valid credentials |
| UC-02 | Logout | Customer securely ends the current session |
| UC-03 | View Account Details | Customer views account information and balance |
| UC-04 | Transfer Funds | Customer transfers money to another valid account |
| UC-05 | View Transaction History | Customer views previous transactions |
| UC-06 | Update Profile | Customer updates permitted personal information |
| UC-07 | Change Password | Customer changes their account password |

---

### 2.2 Bank Employee Use Cases

| Use Case ID | Use Case | Description |
|---|---|---|
| UC-08 | Login | Employee authenticates using valid credentials |
| UC-09 | Logout | Employee securely ends the current session |
| UC-10 | Register Customer | Employee creates a new customer record |
| UC-11 | View Customer Details | Employee searches for and views customer information |
| UC-12 | Update Customer Information | Employee updates permitted customer information |
| UC-13 | Create Bank Account | Employee creates a bank account for a customer |
| UC-14 | View Account Details | Employee views account information |
| UC-15 | Deposit Money | Employee deposits money into an active account |
| UC-16 | Withdraw Money | Employee withdraws money from an active account |
| UC-17 | Manage Account Status | Employee activates, deactivates, freezes or unfreezes an account |
| UC-18 | View Transaction Records | Employee views authorized transaction information |

---

### 2.3 Administrator Use Cases

| Use Case ID | Use Case | Description |
|---|---|---|
| UC-19 | Login | Administrator authenticates using valid credentials |
| UC-20 | Logout | Administrator securely ends the current session |
| UC-21 | Manage Employee Accounts | Administrator creates and manages employee accounts |
| UC-22 | View Customer Records | Administrator views customer information |
| UC-23 | View Account Records | Administrator views account information |
| UC-24 | View Transaction Records | Administrator views transaction information |
| UC-25 | Manage Employee Status | Administrator activates or deactivates employee accounts |
| UC-26 | Generate Reports | Administrator generates basic banking reports |

---

## 3. Use Case Relationships

Some use cases depend on common system functionality.

### Authentication

The following actors use the Login and Logout functionality:

- Customer
- Bank Employee
- Administrator

### Account Management

Account-related operations are primarily performed by Bank Employees,
while Customers can view their own account information.

### Transaction Management

Customers can transfer funds and view their own transaction history.

Bank Employees can perform deposits and withdrawals and view authorized
transaction records.

Administrators can view transaction records for system monitoring.

### Access Control

The system shall restrict use cases according to the authenticated user's
role. A Customer must not access employee or administrator functions, while
administrative functions must be restricted to authorized Administrators.