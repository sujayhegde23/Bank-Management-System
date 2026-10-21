# Database Documentation & Initialization

This directory contains the database definition, initialization scripts, and baseline academic dummy data for the **Bank Management System**.

## 1. Database Architecture & Engine

- **RDBMS:** MySQL 8.0+
- **Storage Engine:** `InnoDB` (enforces ACID transactions, row-level locking, and foreign key integrity)
- **Character Set / Collation:** `utf8mb4` / `utf8mb4_unicode_ci`
- **Currency Storage:** `DECIMAL(15,2)` with non-negative check constraints (prevents floating-point rounding errors)

---

## 2. Table Specifications & Relationships

```text
┌──────────────┐       1:1        ┌──────────────┐
│    users     ├──────────────────┤  customers   │
└──────┬───────┘                  └──────┬───────┘
       │ 1:1                             │ 1:N
┌──────┴───────┐                  ┌──────┴───────┐
│  employees   │                  │   accounts   │
└──────────────┘                  └──────┬───────┘
                                         │ 1:N
                                  ┌──────┴────────────┐
                                  │ bank_transactions │
                                  └───────────────────┘
```

### Table Summary

| Table | Purpose | Primary Key | Key Constraints & Rules |
|---|---|---|---|
| `users` | System login accounts & roles | `user_id` | `username` UNIQUE; `password_hash` stores salted hashes; `role` ∈ {CUSTOMER, EMPLOYEE, ADMIN}; `status` ∈ {ACTIVE, INACTIVE} |
| `customers` | Customer personal profiles | `customer_id` | `user_id` UNIQUE FK referencing `users(user_id)`; `date_of_birth`, `phone`, `email` |
| `employees` | Bank staff profiles | `employee_id` | `user_id` UNIQUE FK referencing `users(user_id)`; `email`, `phone` |
| `accounts` | Bank accounts | `account_id` | `account_number` UNIQUE; `customer_id` FK; `balance DECIMAL(15,2) DEFAULT 0.00`; `CHECK (balance >= 0)`; `status` ∈ {ACTIVE, INACTIVE, FROZEN} |
| `bank_transactions` | Insert-only financial audit log | `transaction_id` | `transaction_ref` UNIQUE; `type` ∈ {DEPOSIT, WITHDRAWAL, TRANSFER}; `amount DECIMAL(15,2)`; `CHECK (amount > 0)`; `source_account_id` FK (NULL for deposit); `destination_account_id` FK (NULL for withdrawal); `performed_by_user_id` FK |

---

## 3. How to Initialize the Database

### Method A: Using the Node.js Initialization Script (Recommended)

Make sure you have copied `.env.example` to `.env` in the `backend/` folder (or project root) and set your MySQL password.

```bash
# Run schema creation only
node database/init.js

# Or initialize schema and insert baseline academic dummy data
node database/init.js --seed
```

From the repository root or backend folder, you can also run:
```bash
npm run db:init
# or
npm run db:init:seed
```

### Method B: Using the MySQL Command-Line Client

```bash
mysql -u root -p < database/schema.sql

# Optionally load baseline dummy seed data:
mysql -u root -p bank_management_system < database/seed.sql
```

### Method C: Using MySQL Workbench
1. Open MySQL Workbench and connect to your local MySQL instance.
2. Open `database/schema.sql` and execute all statements.
3. (Optional) Open `database/seed.sql` and execute all statements.

---

## 4. Security & Best Practices

- **Never Commit Secrets:** Database credentials (`DB_USER`, `DB_PASSWORD`) must be stored in `.env`, which is ignored by `.gitignore`.
- **Parameterized Queries:** All backend queries must use parameterized placeholders (`?`) to prevent SQL injection.
- **Row-Level Locking:** Financial operations must use `SELECT ... FOR UPDATE` inside `START TRANSACTION ... COMMIT` blocks to prevent race conditions.
