# Data Design — Dual-Database Model (MySQL & MongoDB)

This document specifies the dual-database architecture of the Bank Management System, supporting Section 7 of the [Software Architecture and Design Specification](../architecture_design.md).

The system implements a polyglot persistence architecture:
1. **Relational Database (MySQL 8.0 / InnoDB):** Authoritative transactional ledger for accounts, balances, users, and outbox events.
2. **Document Database (MongoDB):** Flexible store for fraud rules, risk assessments, alerts, and investigations.

## 1. Entity-Relationship & Document Model

```mermaid
erDiagram
    %% Relational MySQL Entities
    USER ||--o| CUSTOMER : "has profile"
    USER ||--o| EMPLOYEE : "has profile"
    CUSTOMER ||--o{ ACCOUNT : owns
    ACCOUNT ||--o{ BANK_TRANSACTION : "is source of"
    ACCOUNT ||--o{ BANK_TRANSACTION : "is destination of"
    USER ||--o{ BANK_TRANSACTION : performs
    USER ||--o{ AUDIT_LOG : generates
    BANK_TRANSACTION ||--o| FRAUD_OUTBOX_EVENT : stages

    %% Logical Relationships Across Dual Databases (Referenced by transactionId)
    BANK_TRANSACTION ||--o| TRANSACTION_RISK_ASSESSMENT : "evaluates (NoSQL)"
    BANK_TRANSACTION ||--o| FRAUD_ALERT : "triggers (NoSQL)"
    FRAUD_ALERT ||--o| FRAUD_INVESTIGATION : "investigated by (NoSQL)"
    EMPLOYEE ||--o{ FRAUD_INVESTIGATION : "assigned to"

    USER {
        bigint user_id PK
        string username UK
        string password_hash "Salted bcrypt hash (cost 10)"
        string role "CUSTOMER, EMPLOYEE, ADMIN"
        string status "ACTIVE, INACTIVE"
        datetime created_at
        datetime updated_at
    }

    CUSTOMER {
        bigint customer_id PK
        bigint user_id FK "UNIQUE"
        string full_name
        date date_of_birth
        string phone "INDEX"
        string email "INDEX"
        string address
        datetime created_at
        datetime updated_at
    }

    EMPLOYEE {
        bigint employee_id PK
        bigint user_id FK "UNIQUE"
        string full_name
        string email "INDEX"
        string phone
        datetime created_at
        datetime updated_at
    }

    ACCOUNT {
        bigint account_id PK
        string account_number UK "Format: ACC-<TYPE>-<8DIGITS>"
        bigint customer_id FK "INDEX"
        string account_type "SAVINGS, CURRENT"
        decimal balance "DECIMAL(15,2), CHECK >= 0"
        string status "ACTIVE, INACTIVE, FROZEN"
        datetime opened_at
        datetime updated_at
    }

    BANK_TRANSACTION {
        bigint transaction_id PK
        string transaction_ref UK "Format: TXN-<TYPE>-<HEX>"
        string type "DEPOSIT, WITHDRAWAL, TRANSFER"
        decimal amount "DECIMAL(15,2), CHECK > 0"
        bigint source_account_id FK "NULL for DEPOSIT"
        bigint destination_account_id FK "NULL for WITHDRAWAL"
        bigint performed_by_user_id FK
        string remarks
        datetime created_at "INDEX"
    }

    AUDIT_LOG {
        bigint audit_id PK
        bigint actor_user_id FK "NULLable"
        string action_type "INDEX"
        string target_entity_type
        string target_entity_id
        string description
        string result "SUCCESS, FAILURE"
        json metadata
        datetime created_at "INDEX"
    }

    FRAUD_OUTBOX_EVENT {
        bigint event_id PK
        bigint transaction_id FK "UNIQUE (ON DELETE RESTRICT)"
        string event_type "TRANSFER, WITHDRAWAL, DEPOSIT"
        json payload "Transaction evaluation context"
        string status "PENDING, PROCESSING, COMPLETED, FAILED"
        int attempt_count
        datetime next_attempt_at "INDEX (status, next_attempt_at)"
        datetime locked_at "INDEX (status, locked_at)"
        string locked_by "Worker ID lease owner"
        string last_error "Sanitized error message"
        datetime created_at
        datetime updated_at
    }

    TRANSACTION_RISK_ASSESSMENT {
        ObjectId _id PK
        int transactionId UK "Ref: bank_transactions.transaction_id"
        int customerId "INDEX"
        int accountId
        string transactionType
        long amount "Integer paise (1 INR = 100 paise)"
        int riskScore "0 to 100"
        string riskLevel "LOW, MEDIUM, HIGH, CRITICAL"
        array triggeredRules "Rule code, points, description"
        string decision "APPROVED, REVIEW_REQUIRED, FLAGGED"
        date assessedAt "INDEX"
    }

    FRAUD_ALERT {
        ObjectId _id PK
        int transactionId UK "Ref: bank_transactions.transaction_id"
        int customerId
        int accountId
        int riskScore "0 to 100"
        string riskLevel "INDEX: LOW, MEDIUM, HIGH, CRITICAL"
        string status "INDEX: OPEN, UNDER_REVIEW, RESOLVED, FALSE_POSITIVE"
        array reasons "Descriptions of triggered rules"
        date createdAt "INDEX"
        date updatedAt
    }

    FRAUD_RULE {
        ObjectId _id PK
        string ruleCode UK "HIGH_AMOUNT, HIGH_VELOCITY, etc."
        string name
        string description
        bool enabled "INDEX"
        long threshold "Integer paise for monetary rules"
        int weight "Points (0 to 100)"
        object config "windowMinutes, startHour, endHour, timezone"
        date createdAt
        date updatedAt
    }

    FRAUD_INVESTIGATION {
        ObjectId _id PK
        ObjectId alertId UK "Ref: fraud_alerts._id"
        int transactionId UK "Ref: bank_transactions.transaction_id"
        int assignedEmployeeId "INDEX"
        string status "INDEX: OPEN, UNDER_REVIEW, IN_PROGRESS, RESOLVED, FALSE_POSITIVE, CLOSED"
        array notes "Append-only operational log entries"
        string resolution "Final case outcome"
        date createdAt
        date updatedAt
    }
```

## 2. Account Status State Machine

```mermaid
stateDiagram-v2
    [*] --> ACTIVE : Account created (FR-07)
    ACTIVE --> FROZEN : Freeze (FR-10)
    FROZEN --> ACTIVE : Unfreeze (FR-10)
    ACTIVE --> INACTIVE : Deactivate (FR-10)
    FROZEN --> INACTIVE : Deactivate (FR-10)
    INACTIVE --> ACTIVE : Activate (FR-10)

    note right of ACTIVE
        Deposits, withdrawals, and
        transfers permitted
    end note
    note right of FROZEN
        No financial transactions permitted (FR-11).
        Account details and history readable.
    end note
    note right of INACTIVE
        Account retired. No transactions permitted.
    end note
```

## 3. Fraud Investigation Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> OPEN : Alert generated (Triggered rules > 0)
    OPEN --> UNDER_REVIEW : Employee/Admin begins review
    OPEN --> IN_PROGRESS : Investigation actively assigned
    UNDER_REVIEW --> IN_PROGRESS : Additional evidence gathering
    IN_PROGRESS --> UNDER_REVIEW : Pending external verification
    UNDER_REVIEW --> RESOLVED : Confirmed fraudulent activity
    IN_PROGRESS --> RESOLVED : Confirmed fraudulent activity
    UNDER_REVIEW --> FALSE_POSITIVE : Verified legitimate customer transfer
    IN_PROGRESS --> FALSE_POSITIVE : Verified legitimate customer transfer
    RESOLVED --> CLOSED : Archived after remediation
    FALSE_POSITIVE --> CLOSED : Archived as benign activity
```
