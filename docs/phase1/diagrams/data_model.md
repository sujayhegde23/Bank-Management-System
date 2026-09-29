# Logical Data Model and Account Status States

These diagrams support the Data Design section of the
[Software Architecture and Design Specification](../architecture_design.md#7-data-design).
They are a **preliminary logical design**. The final database schema will be
produced in the system design phase.

## 1. Entity-Relationship Diagram

```mermaid
erDiagram
    USER ||--o| CUSTOMER : "has profile"
    USER ||--o| EMPLOYEE : "has profile"
    CUSTOMER ||--o{ ACCOUNT : owns
    ACCOUNT ||--o{ BANK_TRANSACTION : "is source of"
    ACCOUNT ||--o{ BANK_TRANSACTION : "is destination of"
    USER ||--o{ BANK_TRANSACTION : performs

    USER {
        bigint user_id PK
        string username UK
        string password_hash "salted hash, never plain text"
        string role "CUSTOMER, EMPLOYEE or ADMIN"
        string status "ACTIVE or INACTIVE"
        datetime created_at
    }
    CUSTOMER {
        bigint customer_id PK
        bigint user_id FK "UNIQUE"
        string full_name
        date date_of_birth
        string phone
        string email
        string address
        datetime created_at
    }
    EMPLOYEE {
        bigint employee_id PK
        bigint user_id FK "UNIQUE"
        string full_name
        string email
        string phone
        datetime created_at
    }
    ACCOUNT {
        bigint account_id PK
        string account_number UK "system generated"
        bigint customer_id FK
        string account_type "e.g. SAVINGS, CURRENT"
        decimal balance "DECIMAL(15,2), CHECK >= 0"
        string status "ACTIVE, INACTIVE or FROZEN"
        datetime opened_at
        datetime updated_at
    }
    BANK_TRANSACTION {
        bigint transaction_id PK
        string transaction_ref UK "unique ID shown to users"
        string type "DEPOSIT, WITHDRAWAL or TRANSFER"
        decimal amount "DECIMAL(15,2), CHECK > 0"
        bigint source_account_id FK "null for DEPOSIT"
        bigint destination_account_id FK "null for WITHDRAWAL"
        bigint performed_by_user_id FK
        datetime created_at
    }
```

### Notes

| Design Point | Reason | Requirement |
|---|---|---|
| Each table has a primary key, and `username`, `account_number` and `transaction_ref` are unique | Unique identifiers enforced by the database | FR-08, FR-18, NFR-16 |
| `balance` and `amount` use `DECIMAL(15,2)`, not floating point | Exact money arithmetic without rounding errors | NFR-08, NFR-17 |
| `CHECK (balance >= 0)` and `CHECK (amount > 0)` | The database also rejects invalid values, as a second line of defence after input validation | FR-14, NFR-18 |
| Mandatory columns are `NOT NULL` | Incomplete records cannot be stored | NFR-18 |
| `password_hash` stores only the salted hash | Passwords are never stored in plain text | NFR-01 |
| The table is named `BANK_TRANSACTION` | `TRANSACTION` is a reserved word in SQL | — |
| `BANK_TRANSACTION` rows are insert-only (no update or delete operation is provided) | Transaction records cannot be changed after they are written | NFR-10 |
| Administrators are `USER` rows with role `ADMIN` and no extra profile table | Administrators need only login details (SRS A-07) | FR-03 |

## 2. Account Status State Diagram

```mermaid
stateDiagram-v2
    [*] --> ACTIVE : Account created (FR-07)
    ACTIVE --> FROZEN : Freeze (FR-10)
    FROZEN --> ACTIVE : Unfreeze (FR-10)
    ACTIVE --> INACTIVE : Deactivate (FR-10)
    FROZEN --> INACTIVE : Deactivate (FR-10)
    INACTIVE --> ACTIVE : Activate (FR-10)

    note right of ACTIVE
        Deposits, withdrawals and
        transfers allowed
    end note
    note right of FROZEN
        No financial transactions (FR-11).
        Account can still be viewed.
    end note
```

| Status | Financial Transactions | Viewable | Changed By |
|---|---|---|---|
| ACTIVE | Allowed | Yes | Bank Employee |
| FROZEN | Rejected with `ACC_001` (FR-11) | Yes (SRS A-09) | Bank Employee |
| INACTIVE | Rejected with `ACC_001` (FR-11) | Yes (SRS A-09) | Bank Employee |
