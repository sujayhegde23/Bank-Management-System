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
The technology stack has been finalized for the Bank Management System:

- **Frontend:** React with Vite (Single Page Application architecture, component-based user interface)
- **Backend:** Node.js with Express (RESTful API, modular service layer, middleware-based authorization)
- **Database:** MySQL (Relational database with InnoDB engine, ACID transactions, and decimal precision for currency)
- **Communication:** REST API over HTTP with JSON payloads
- **Development & Collaboration:** Visual Studio Code, Git and GitHub

### Core Security and Reliability Principles
- **Parameterized queries:** All database operations use parameterized queries, which help prevent SQL injection when used correctly by ensuring user input is treated strictly as data rather than executable SQL code.
- **Environment variables:** Sensitive credentials (database passwords, session secrets) are kept in environment variables and never committed to version control.
- **Server-side validation:** All inputs are strictly validated on the server before business rules or database operations execute.
- **Role-based authorization:** Backend middleware enforces role-based access control (RBAC) and customer data ownership on every protected endpoint.
- **Session management:** Secure authentication with server-validated, revocable sessions.
- **Transaction consistency:** Financial operations (deposits, withdrawals, fund transfers) are wrapped in atomic database transactions with row-level locks to preserve balance consistency and prevent duplicate processing.
- **Safe error handling:** Standardized, structured error messages that prevent leaking stack traces, database schemas, or sensitive details.

*Note on implementation decisions:* Specific package versions, authentication/session token libraries, concrete database drivers/ORMs, and production deployment hosting remain open implementation details to be decided in subsequent phases.


## Project Structure
```text
Bank-Management-System/
├── .env.example                # Safe environment variable template with placeholders
├── .gitignore                  # Excludes node_modules, .env, build artifacts, logs
├── package.json                # Root orchestration scripts
├── README.md                   # Project overview, documentation index, and local setup
├── database/                   # Database DDL schema, baseline seeds, and init script
│   ├── README.md               # Schema documentation, tables, constraints, relationships
│   ├── schema.sql              # MySQL 8.0+ InnoDB DDL (tables, PKs, FKs, CHECKs, indexes)
│   ├── seed.sql                # Baseline academic test fixtures (test_plan.md Section 5)
│   └── init.js                 # Automated database initialization runner
├── backend/                    # Node.js + Express REST API backend scaffold
│   ├── .env.example            # Backend-specific environment template
│   ├── package.json            # Backend dependencies, scripts, test runner
│   ├── src/
│   │   ├── app.js              # Express app setup and middleware pipeline
│   │   ├── server.js           # Server entrypoint with graceful shutdown
│   │   ├── config/
│   │   │   └── db.js           # MySQL2 connection pool & parameterized query helper
│   │   ├── middleware/
│   │   │   └── errorHandler.js # Standardized error envelopes conforming to Architecture §10
│   │   └── routes/
│   │       ├── index.js        # API route aggregator
│   │       └── health.js       # Health and database diagnostic endpoints
│   └── tests/
│       └── health.test.js      # Automated API health & 404 handler scaffold test suite
├── frontend/                   # React + Vite single page application scaffold
│   ├── .env.example            # Frontend environment template (VITE_API_BASE_URL)
│   ├── index.html              # HTML entrypoint with metadata
│   ├── package.json            # React 19, Vite, and build configuration
│   ├── vite.config.js          # Vite config with API proxy to localhost:5000
│   └── src/
│       ├── main.jsx            # React root mount point
│       ├── App.jsx             # Core foundation UI with live health probe & schema explorer
│       ├── App.css             # Component styling
│       ├── index.css           # Design tokens, color system, and typography
│       └── services/
│           └── api.js          # Centralized fetch client for backend communication
└── docs/                       # Project planning, IEEE SRS, architecture, and diagrams
    └── phase1/
        ├── SRS.md                      # Complete IEEE-style SRS
        ├── test_plan.md                # IEEE-style test plan with test cases
        ├── architecture_design.md      # Architecture and design specification
        ├── diagrams/
        │   ├── README.md               # Diagram index
        │   ├── component_diagram.md    # Mermaid source (+ .png)
        │   ├── login_sequence.md       # Mermaid source (+ .png)
        │   ├── fund_transfer_sequence.md
        │   ├── data_model.md           # ER and account-status diagrams
        │   └── use_case_diagram.py     # Generates ../use_case_diagram.png
        ├── actors_usecases.md
        ├── feasibility_study.md
        ├── problem_statement.md
        ├── requirements.md
        ├── rtm.md
        └── use_case_diagram.png
```

## Local Development Setup

### 1. Prerequisites
Ensure the following tools are installed on your workstation:
- **Node.js**: v18.0.0 or higher (v20+ / v22+ LTS recommended)
- **npm**: v9.0.0 or higher
- **MySQL Server**: v8.0 or higher (running locally or accessible via network)
- **Git**: v2.30 or higher

### 2. Environment Configuration
Create your local environment configuration file from the safe example template:
```bash
# In the repository root:
cp .env.example .env
```
Open `.env` and set your local MySQL connection credentials:
```ini
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_local_mysql_password
DB_NAME=bank_management_system
CLIENT_URL=http://localhost:5173
SESSION_SECRET=change_me_to_a_secure_random_string
```
> **Security Notice**: Never commit `.env` or any real credentials to Git. The `.gitignore` file automatically excludes `.env` and all `.env.local` files.

### 3. Install Dependencies
Install dependencies for both backend and frontend applications:
```bash
# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 4. Database Initialization
Ensure your MySQL server service is running. Then initialize the database schema and optionally load baseline academic test fixtures:

```bash
# Option A: Initialize schema only (creates database and tables)
npm run db:init

# Option B: Initialize schema AND seed baseline test fixtures (recommended for development)
npm run db:init:seed
```
*Alternatively, you can execute the SQL scripts directly in the MySQL CLI:*
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

The database schema initializes:
- `users`: Authentication identities with role classification (`ADMIN`, `EMPLOYEE`, `CUSTOMER`)
- `customers`: 1-to-1 customer profile details
- `employees`: 1-to-1 staff profile details
- `accounts`: Bank accounts with exact `DECIMAL(15,2)` balance and `CHECK (balance >= 0)` constraint
- `bank_transactions`: Immutable transaction ledger supporting deposits, withdrawals, and transfers

### 5. Running the Application

You can run the backend and frontend services separately in dedicated terminal windows:

#### Start the Backend API (Port 5000)
```bash
# From repository root:
npm run dev:backend

# Or directly from backend folder:
cd backend && npm run dev
```
The Express REST API will start at `http://localhost:5000`. You can verify API health at `http://localhost:5000/api/health`.

#### Start the Frontend Web App (Port 5173)
```bash
# From repository root:
npm run dev:frontend

# Or directly from frontend folder:
cd frontend && npm run dev
```
The Vite development server will start at `http://localhost:5173` with hot module reloading (HMR) and an automatic proxy routing `/api` requests to `http://localhost:5000`.

### 6. Running Tests and Verification Checks
```bash
# Run backend automated scaffold tests (using Node.js native test runner)
npm run test:backend

# Build the frontend production bundle to verify compilation
npm run build:frontend

# Run frontend linting
npm run lint:frontend
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
Phase 1 requirements, test planning, and architecture specifications have been prepared and approved.
Issue #15 has established the initial application structure, database schema, and diagnostic foundation:
- **Database Schema**: MySQL InnoDB schema (`database/schema.sql`) and academic test seed data (`database/seed.sql`) implementing accounts, transactions, users, customers, and employees with strict exact decimal precision (`DECIMAL(15,2)`), non-negative check constraints, and referential integrity.
- **Backend Scaffold**: Express API with connection pooling, parameterized queries, centralized error envelopes, and automated health checks (`backend/`).
- **Frontend Scaffold**: React 19 + Vite single page application with diagnostic connectivity monitoring, design tokens, and interactive schema inspection (`frontend/`).

Feature workflows (login authentication, customer registration, fund transfer transactions, reporting) remain to be implemented in subsequent development tasks.

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
The repository serves as the planning and documentation foundation for a complete Bank Management System to be implemented as a web application using React with Vite, Node.js with Express, and MySQL.
