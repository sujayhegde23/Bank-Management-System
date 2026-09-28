# Feasibility Study

A feasibility study is performed to determine whether the proposed Bank Management
System can be realistically developed and used within the available time,
technology, and resources.

## 1. Technical Feasibility

The system is technically feasible because it can be developed using commonly
available technologies and development tools.

The proposed system can use:

- HTML, CSS and JavaScript for the frontend
- A backend framework or server-side technology
- MySQL or another relational database for storing customer, account and transaction data
- Git and GitHub for version control and collaboration

The team has access to the required software and development environment.

Therefore, no specialized or expensive infrastructure is required for the
academic prototype.

---

## 2. Operational Feasibility

The system is operationally feasible because it simplifies common banking
activities for customers, employees and administrators.

Customers can perform operations such as:

- Viewing account details
- Checking balance
- Transferring money
- Viewing transaction history

Bank employees can manage:

- Customers
- Bank accounts
- Deposits and withdrawals
- Account status

Administrators can manage employees and monitor system records.

The interface will be designed to be simple and easy to use for the intended users.

---

## 3. Economic Feasibility

The project is economically feasible because most of the required development
tools and technologies are freely available.

Examples include:

- Visual Studio Code
- Git
- GitHub
- MySQL Community Edition
- Open-source libraries and frameworks

Since the project is an academic prototype, no commercial banking infrastructure
or paid banking services are required.

Hence, the development cost is minimal.

---

## 4. Schedule Feasibility

The project is feasible within the available semester duration if the scope is
limited to essential banking operations.

The development can be divided into multiple phases:

- Requirement analysis
- System design
- Implementation
- Testing and validation
- Final demonstration

Features such as real payment gateways, UPI integration, loan processing and
external banking network integration are excluded to keep the project manageable
within the available time.

---

## 5. Security Feasibility

The Bank Management System handles sensitive financial information, so security
must be considered throughout the project.

The system will include measures such as:

- User authentication
- Role-based access control
- Password protection
- Input validation
- Transaction validation
- Prevention of unauthorized access
- Secure storage of user credentials

Detailed security testing and penetration testing will be planned during the
requirement and design phases and performed after the system has been implemented.

---

## 6. Legal and Ethical Feasibility

The project will be developed only as an academic prototype.

The system will use dummy or test customer information and financial data.

No real customer banking details will be stored or processed.

This prevents privacy and legal issues associated with handling real financial
information.

---

## Conclusion

Based on the technical, operational, economic, schedule, security and legal
analysis, the proposed Bank Management System is feasible for development as an
academic software engineering project.


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