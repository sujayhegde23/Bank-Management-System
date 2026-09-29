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
│       ├── SRS.md                      # Complete IEEE-style SRS
│       ├── test_plan.md                # IEEE-style test plan with test cases
│       ├── architecture_design.md      # Architecture and design specification
│       ├── diagrams/
│       │   ├── README.md               # Diagram index
│       │   ├── component_diagram.md    # Mermaid source (+ .png)
│       │   ├── login_sequence.md       # Mermaid source (+ .png)
│       │   ├── fund_transfer_sequence.md
│       │   ├── data_model.md           # ER and account-status diagrams
│       │   └── use_case_diagram.py     # Generates ../use_case_diagram.png
│       ├── actors_usecases.md
│       ├── feasibility_study.md
│       ├── problem_statement.md
│       ├── requirements.md
│       ├── rtm.md
│       └── use_case_diagram.png
└── ... (implementation files to be added in later phases)
```

## Documentation Index

### Phase 1 Deliverables
- [Software Requirements Specification (SRS)](docs/phase1/SRS.md): complete IEEE-style SRS with functional and non-functional requirements, security objectives and requirements, and the use case model
- [Software Test Plan](docs/phase1/test_plan.md): IEEE-style test plan, security validation (Section 5.1), 21 test cases and a test traceability matrix
- [Software Architecture and Design Specification](docs/phase1/architecture_design.md): layered architecture, components, security architecture, sequence diagrams, API design and error handling
- [Requirement Traceability Matrix](docs/phase1/rtm.md): requirement → use case → architecture component → test case

### Supporting Documents
- [Problem Statement](docs/phase1/problem_statement.md)
- [Requirements List](docs/phase1/requirements.md)
- [Actors and Use Cases](docs/phase1/actors_usecases.md)
- [Feasibility Study](docs/phase1/feasibility_study.md)

### Diagrams
- [Diagram index](docs/phase1/diagrams/README.md)
- [Use Case Diagram](docs/phase1/use_case_diagram.png)
- [Component Diagram](docs/phase1/diagrams/component_diagram.md)
- [Login Sequence Diagram](docs/phase1/diagrams/login_sequence.md)
- [Fund Transfer Sequence Diagram](docs/phase1/diagrams/fund_transfer_sequence.md)
- [Data Model and Account Status Diagrams](docs/phase1/diagrams/data_model.md)

## Project Status
Phase 1 (requirements, test planning, and architecture and design) documentation has been prepared. It covers:
- problem definition, objectives and feasibility analysis
- a complete Software Requirements Specification: 25 functional and 18 non-functional requirements with measurable acceptance criteria
- security objectives (SO-01 to SO-04) mapped to security requirements
- actors, use cases and the use case diagram
- a test plan with security validation and 21 test cases traced to the requirements
- a layered architecture with a component diagram, security architecture, sequence diagrams, planned REST-style APIs and error handling
- an extended requirement traceability matrix

The application itself has **not** been implemented yet. The architecture and APIs are planned designs, and all test cases are in the *Not Executed* state.

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
