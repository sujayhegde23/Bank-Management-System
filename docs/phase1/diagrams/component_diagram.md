# Component Diagram

This diagram depicts the implemented software components of the Bank Management System and their dependencies. It illustrates the Layered / Three-Tier Architecture extended with Asynchronous Transactional Outbox Background Processing as specified in [Software Architecture and Design Specification](../architecture_design.md).

```mermaid
flowchart TB
    subgraph Users["User Actors"]
        Customer(["Customer"])
        Employee(["Bank Employee"])
        Admin(["Administrator"])
    end

    subgraph PL["Presentation Layer (Frontend — React + Vite SPA)"]
        UI["«component»<br/>Web User Interface<br/>(Role Dashboards, Modals, State Management)"]
    end

    subgraph API["API & Middleware Layer (Backend — Node.js + Express)"]
        AUTH["«component»<br/>Authentication & RBAC Middleware<br/>(requireAuth, requireRole, Ownership Checks)"]
        VAL["«component»<br/>Input Validation Middleware<br/>(Schema, Types, Monetary Limits)"]
        ERR["«component»<br/>Centralized Error Handler<br/>(Standard Envelopes, Sanitized Logging)"]
    end

    subgraph BL["Core Banking Service Layer"]
        CUST["«component»<br/>Customer Service"]
        ACC["«component»<br/>Account Service"]
        TXN["«component»<br/>Banking Transaction Service<br/>(executeTransfer, deposit, withdraw)"]
        EMP["«component»<br/>Employee Administration Service"]
        RPT["«component»<br/>Reporting Service"]
        AUD["«component»<br/>Audit Service"]
    end

    subgraph OUTBOX["Asynchronous Outbox & Fraud Subsystem"]
        OUTBOX_REPO["«component»<br/>Outbox Repository<br/>(recordOutboxEvent, claimEvents)"]
        WORKER["«component»<br/>Fraud Outbox Worker<br/>(Polling, Lease Heartbeat, Retries)"]
        CTX["«component»<br/>Transaction Context Provider<br/>(Velocity & Beneficiary Context)"]
        ENGINE["«component»<br/>Fraud Detection Engine<br/>(evaluateTransaction, Rule Evaluators)"]
        RULES_REPO["«component»<br/>Fraud Rule Repository & Loader<br/>(In-Memory Cache & Invalidation)"]
        SCORING["«component»<br/>Risk Scoring Service<br/>(Score Sum, Classification, Disposition)"]
        ASSESS_REPO["«component»<br/>Assessment & Alert Repository<br/>(saveAssessment, saveAlert)"]
        DASH_SVC["«component»<br/>Fraud Dashboard Service<br/>(Stats, Alerts Hydration, Investigations)"]
    end

    subgraph DAL["Relational Data Access Layer (Node.js)"]
        R_DAL["«component»<br/>MySQL Data Access<br/>(Connection Pool, withTransaction, Row Locks)"]
    end

    subgraph DB_MYSQL["Relational Database (MySQL 8.0 / InnoDB)"]
        T_USERS["users"]
        T_CUST["customers"]
        T_EMP["employees"]
        T_ACC["accounts"]
        T_TXN["bank_transactions (Ledger)"]
        T_AUD["audit_logs"]
        T_OUTBOX["fraud_outbox_events (Outbox)"]
    end

    subgraph DB_MONGO["Document Database (MongoDB — bank_fraud_detection)"]
        C_ASSESS["transaction_risk_assessments"]
        C_ALERTS["fraud_alerts"]
        C_RULES["fraud_rules"]
        C_INVEST["fraud_investigations"]
    end

    Customer --> UI
    Employee --> UI
    Admin --> UI

    UI -->|"REST API over HTTP (JSON)"| AUTH
    AUTH --> VAL
    VAL --> CUST
    VAL --> ACC
    VAL --> TXN
    VAL --> EMP
    VAL --> RPT
    VAL --> DASH_SVC

    TXN -->|"Status & balance locks"| ACC
    TXN -->|"Atomic ledger & outbox write"| OUTBOX_REPO

    CUST --> R_DAL
    ACC --> R_DAL
    TXN --> R_DAL
    EMP --> R_DAL
    RPT --> R_DAL
    AUD --> R_DAL
    OUTBOX_REPO --> R_DAL

    R_DAL -->|"Parameterized SQL & ACID Transactions"| DB_MYSQL

    WORKER -->|"Poll & Claim (SKIP LOCKED)"| OUTBOX_REPO
    WORKER -->|"Query historical context"| CTX
    CTX -->|"Read-only transaction history"| R_DAL
    WORKER -->|"Dispatch for evaluation"| ENGINE
    ENGINE -->|"Load active rules"| RULES_REPO
    ENGINE -->|"Calculate score & level"| SCORING
    ENGINE -->|"Idempotent persistence"| ASSESS_REPO
    ASSESS_REPO -->|"BSON documents & indexes"| DB_MONGO
    RULES_REPO -->|"Read/update rules"| DB_MONGO
    DASH_SVC -->|"Hydrate transaction details"| R_DAL
    DASH_SVC -->|"Aggregations & alert queries"| DB_MONGO
    WORKER -->|"Mark event COMPLETED / FAILED"| OUTBOX_REPO
```

## Component Summary

| Component | Responsibility | Interacts with |
|---|---|---|
| **Web User Interface (React + Vite)** | Renders role-specific dashboards, interactive forms, navigation, transfer modals, and fraud monitoring console. Manages UI state and dispatches authenticated HTTP requests. | Customer, Employee, Admin, Authentication & RBAC Middleware |
| **Authentication & RBAC Middleware** | Authenticates incoming sessions via signed HTTP-only cookies (`bms.sid`), enforces role-based access barriers (`requireRole`), and validates horizontal customer ownership. | Web User Interface, Input Validation Middleware, Express Routing |
| **Input Validation Middleware** | Performs schema, data type, monetary format (up to 2 decimals), range, and parameter validation prior to executing business logic. Rejects malformed requests with `VAL_001`. | Authentication Middleware, Core Banking Services, Fraud Services |
| **Centralized Error Handler** | Catches operational and unhandled exceptions across all routes. Returns standard sanitized error envelopes (`{ success: false, error: { code, message, referenceId } }`) without leaking SQL syntax or stack traces. | All API routes and Express middleware |
| **Customer Service** | Manages customer registration, profile lookups, and authorized contact information updates. | Input Validation, MySQL Data Access Layer |
| **Account Service** | Handles account creation, collision-resistant unique account number generation (`ACC-<TYPE>-<8-DIGITS>`), balance retrieval, and account status management (`ACTIVE`, `INACTIVE`, `FROZEN`). | Input Validation, MySQL Data Access Layer, Transaction Service |
| **Banking Transaction Service** | Executes deposits, withdrawals, and customer fund transfers under atomic row-level locks (`SELECT ... FOR UPDATE`). Generates cryptographic references (`TXN-<TYPE>-<HEX>`), inserts immutable ledger records, and enqueues outbox events. | Account Service, Outbox Repository, MySQL Data Access Layer |
| **Employee Administration Service** | Provides administrative CRUD for employee staff accounts, secure salted bcrypt password initialization, status deactivation, and session revocation. | Input Validation, MySQL Data Access Layer, Audit Service |
| **Reporting Service** | Executes database-level SQL aggregations (`COUNT`, `SUM`, `AVG`) across customers, accounts, and ledger records to produce administrative summary reports and statement exports. | MySQL Data Access Layer |
| **Audit Service** | Records administrative, authentication, and status change events into the `audit_logs` table for institutional accountability. | MySQL Data Access Layer |
| **MySQL Data Access Layer** | Manages the MySQL connection pool, parameterized query execution, row-level locks, and transaction boundary control (`withTransaction`). | Core Banking Services, Outbox Repository, MySQL Database |
| **Outbox Repository** | Atomically inserts outbox records into `fraud_outbox_events` within banking transactions (`recordOutboxEvent`), and claims pending events using `FOR UPDATE SKIP LOCKED` (`claimEvents`). | Banking Transaction Service, Background Fraud Worker, MySQL Data Access |
| **Background Fraud Worker** | Polls the outbox table asynchronously, acquires lease-based claims, maintains active heartbeat renewals, orchestrates rule evaluation, and marks events `COMPLETED` or `FAILED` with exponential backoff. | Outbox Repository, Transaction Context Provider, Fraud Detection Engine |
| **Transaction Context Provider** | Queries authoritative historical transaction records and account transfer history from MySQL to construct analytical context (velocity count, beneficiary transfer history). | MySQL Data Access Layer, Background Fraud Worker |
| **Fraud Detection Engine** | Evaluates individual transactions against active configured rules, invokes rule evaluators, aggregates rule weights into risk scores (0–100), and classifies categorical risk levels. | Fraud Rule Repository, Risk Scoring Service, Assessment Repository |
| **Fraud Rule Repository & Loader** | Loads enabled rule definitions from MongoDB with in-memory caching and hot-cache invalidation. Supports integer paise monetary precision. | Fraud Detection Engine, Fraud Dashboard Service, MongoDB Database |
| **Risk Scoring Service** | Sums points from triggered rules capped strictly at 100, assigns categorical risk level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and determines post-transaction assessment classifications (`APPROVED`, `REVIEW_REQUIRED`, `FLAGGED`) for investigation triage (does not block or alter banking transaction settlement). | Fraud Detection Engine |
| **Assessment & Alert Repository** | Persists risk assessment documents and fraud alert records into MongoDB idempotently using unique compound index constraints. | Fraud Detection Engine, Fraud Dashboard Service, MongoDB Database |
| **Fraud Dashboard Service** | Provides endpoints for employees and administrators to query system-wide fraud metrics via MongoDB aggregation pipelines, list paginated alerts with hydrated MySQL banking details, and manage investigations. | MySQL Data Access Layer, Assessment & Alert Repository, MongoDB Database |
| **Relational Database (MySQL 8.0)** | Authoritative relational store for banking ledgers, accounts, customers, users, audit logs, and transactional outbox events using InnoDB with ACID guarantees. | MySQL Data Access Layer |
| **Document Database (MongoDB)** | Flexible NoSQL store for fraud rules, risk assessments, alerts, and investigation cases in the `bank_fraud_detection` database. | Assessment & Alert Repository, Fraud Rule Repository |
