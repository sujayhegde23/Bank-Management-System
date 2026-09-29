# Bank Management System

## Project Overview
The Bank Management System is an academic software engineering project designed to automate core banking operations for customers, bank employees, and administrators. The system aims to centralize customer records, account information, and transaction processing while enforcing role-based access control and secure financial workflows.

This repository currently contains the project planning and requirements documentation for the initial phase of the system.

## Project Goals
- Automate customer account management
- Support deposit, withdrawal, and fund transfer operations
- Maintain transaction records securely and consistently
- Provide role-based access for customers, employees, and administrators
- Improve efficiency, accuracy, and transparency in banking operations

## Target Users
### Customer
- View account details and balance
- Transfer funds to other valid accounts
- View transaction history
- Change password
- Update permitted profile information

### Bank Employee
- Register customers
- Create and manage bank accounts
- Deposit and withdraw funds
- Activate, deactivate, or freeze accounts
- View transaction records

### Administrator
- Manage employee accounts
- View customer and account records
- Monitor transactions and reports
- Control access to administrative features

## Core Features
- User authentication and session management
- Role-based authorization
- Customer management
- Account creation and status management
- Deposit and withdrawal processing
- Fund transfer between accounts
- Transaction history tracking
- Administrative reporting

## Technology Stack
The feasibility study identifies a practical academic stack based on commonly available tools:
- Frontend: HTML, CSS, JavaScript
- Backend: server-side framework or application logic layer
- Database: MySQL or equivalent relational database
- Version control: Git and GitHub
- IDE: Visual Studio Code

## Project Structure
```text
Bank-Management-System/
├── README.md
├── docs/
│   └── phase1/
│       ├── actors_usecases.md
│       ├── feasibility_study.md
│       ├── problem_statement.md
│       ├── requirements.md
│       ├── rtm.md
│       └── use_case_diagram.png
└── ... (implementation files to be added in later phases)
```

## Documentation Index
- [Problem Statement](docs/phase1/problem_statement.md)
- [Requirements Specification](docs/phase1/requirements.md)
- [Actors and Use Cases](docs/phase1/actors_usecases.md)
- [Feasibility Study](docs/phase1/feasibility_study.md)
- [Requirement Traceability Matrix](docs/phase1/rtm.md)

## Project Status
This project is currently in the requirements and analysis phase. The foundational documentation has been prepared and covers:
- problem definition
- system objectives
- functional and non-functional requirements
- user roles and use cases
- traceability matrix
- feasibility analysis

## Expected Future Phases
1. System design and database schema
2. Frontend and backend implementation
3. Testing and validation
4. Final deployment or demo preparation

## How to Contribute
1. Clone the repository and create a new branch for your work.
2. Keep documentation for each phase inside its own folder under `docs/`.
3. Write clear commit messages describing what was changed.
4. Open a pull request so the team can review changes before merging into `main`.

## Notes
This is a prototype for academic use and does not include real-bank integrations such as UPI, loan processing, payment gateways, or inter-bank settlement.

## Repository Purpose
The repository serves as the planning and documentation foundation for a complete Bank Management System that can later be implemented as a web application or desktop-based academic project.
