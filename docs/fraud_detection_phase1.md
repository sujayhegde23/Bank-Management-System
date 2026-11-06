# Fraud Detection System — Phase 1: MongoDB Foundation Architecture & Setup Guide

**Repository:** `sujayhegde23/Bank-Management-System`  
**Phase:** 1 (Foundation & Storage Layer)  
**Status:** Implemented & Verified  

---

## 1. Dual-Database Architecture Overview

The Bank Management System utilizes a **dual-database architecture** combining relational and document storage paradigms to balance strict financial ACID consistency with flexible risk assessment telemetry:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Express.js Backend REST API                           │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
                        ▼                             ▼
       ┌────────────────────────────────┐  ┌──────────────────────────────────┐
       │   MySQL (Primary Database)     │  │  MongoDB (Fraud Detection System)│
       ├────────────────────────────────┤  ├──────────────────────────────────┤
       │ Engine: InnoDB                 │  │ Driver: Official mongodb (v7.8+) │
       │ DB: bank_management_system     │  │ DB: bank_fraud_detection         │
       │                                │  │                                  │
       │ Responsibilities:              │  │ Responsibilities:                │
       │ • User Authentication & RBAC   │  │ • Transaction Risk Assessments   │
       │ • Customer & Staff Profiles    │  │ • Suspicious Fraud Alerts        │
       │ • Bank Accounts & Statuses     │  │ • Configurable Fraud Rules       │
       │ • Balance Ledgers (DECIMAL)    │  │ • Investigator Case Logs & Notes │
       │ • Financial Transactions       │  │ • Flexible rule trigger criteria │
       │ • Regulatory Audit Trail       │  │ • Polymorphic risk metadata      │
       └────────────────────────────────┘  └──────────────────────────────────┘
```

### 1.1 Why Both MySQL and MongoDB Are Used
1. **Financial Integrity & Double-Entry Invariants (MySQL):**
   - Core retail banking demands strict ACID transactions, row-level exclusive locks (`FOR UPDATE`), foreign key integrity, and zero-float decimal precision for currency amounts (`DECIMAL(15, 2)`).
   - MySQL remains the authoritative ledger of record. Account balances and transaction records are never replaced, altered, or migrated to MongoDB.
2. **Dynamic Risk Assessment & Heuristics (MongoDB):**
   - Fraud detection involves polymorphic risk assessments, heterogeneous triggered rule payloads, variable machine-learning/heuristic criteria, multi-factor risk scores, and flexible investigator audit trails.
   - MongoDB provides horizontal scale, flexible JSON schema validation, and nested arrays without requiring continuous altering of relational tables.
3. **Fault Isolation & High Availability:**
   - The primary banking application (deposits, withdrawals, transfers, account overview) **must never crash or fail** if MongoDB becomes temporarily unavailable.
   - If MongoDB encounters connectivity interruptions, core banking functions proceed normally while fraud detection is flagged as `DISCONNECTED` or `UNAVAILABLE`.

---

## 2. Responsibilities of Each Database

| Area | Primary Database (MySQL) | Secondary Database (MongoDB) |
|:---|:---|:---|
| **Authoritative Ledger** | All balances, accounts, and financial transfers | No banking accounts or financial balances stored |
| **Transaction Processing** | Creates atomic transaction record with `transaction_id` and unique `transaction_ref` | References MySQL `transactionId`; never generates duplicate transaction IDs |
| **Customer Data** | Legal customer identity, passwords, KYC details | Stores only `customerId` foreign reference for fraud scoring |
| **Rules & Heuristics** | Banking business logic (overdraft checks, account status verification) | Configurable fraud detection rules, thresholds, weights, and triggers |
| **Alerts & Cases** | System audit logs | Fraud alert lifecycle (`OPEN`, `UNDER_REVIEW`, `RESOLVED`, `FALSE_POSITIVE`) and investigator notes |

---

## 3. MongoDB Installation & Environment Configuration

### 3.1 Installation Requirements
- **MongoDB Server:** Version 6.0+ or 7.0+ (Community or Enterprise).
- **Default Port:** `27017`
- **Driver:** Official Node.js driver `mongodb` (installed in `backend/package.json`).

On Windows:
```powershell
# Verify MongoDB service status
Get-Service -Name MongoDB

# Start service if stopped
Start-Service -Name MongoDB

# Test TCP socket
Test-NetConnection -ComputerName 127.0.0.1 -Port 27017
```

### 3.2 Environment Configuration
Add the connection URI to your environment file (`backend/.env` or root `.env`).

Template provided in `backend/.env.example`:
```bash
# MongoDB Connection Settings (Fraud Detection System - Phase 1)
MONGODB_URI=mongodb://127.0.0.1:27017/bank_fraud_detection
```

> [!IMPORTANT]
> Never hardcode database credentials or connection strings in source code. Credentials must always be injected through environment variables.

---

## 4. Collection Structure & Schemas

The database `bank_fraud_detection` contains four dedicated collections:

### 4.1 `transaction_risk_assessments`
Stores the fraud risk scoring and evaluation associated with an existing MySQL transaction.

```json
{
  "_id": "ObjectId('672b1234567890abcdef1234')",
  "transactionId": 1045,
  "customerId": 5,
  "accountId": 12,
  "transactionType": "TRANSFER",
  "amount": 75000,
  "riskScore": 65,
  "riskLevel": "HIGH",
  "triggeredRules": [
    {
      "ruleCode": "HIGH_AMOUNT",
      "points": 25,
      "description": "Transaction exceeds configured threshold"
    }
  ],
  "decision": "FLAGGED",
  "assessedAt": "2026-11-05T21:00:00.000Z"
}
```

- **Validation:** JSON Schema validates required fields, numeric boundaries (`riskScore` between 0-100), and `riskLevel` enum (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **Indexes:**
  - `uniq_assessment_transaction_id`: `{ transactionId: 1 }` (**Unique** — enforces exactly one assessment per banking transaction).
  - `idx_assessment_customer_id`: `{ customerId: 1 }`
  - `idx_assessment_risk_level`: `{ riskLevel: 1 }`
  - `idx_assessment_assessed_at`: `{ assessedAt: -1 }`

### 4.2 `fraud_alerts`
Stores alerts generated for high-risk or suspicious operations requiring operational oversight.

```json
{
  "_id": "ObjectId('672b1234567890abcdef1235')",
  "transactionId": 1045,
  "customerId": 5,
  "accountId": 12,
  "riskScore": 65,
  "riskLevel": "HIGH",
  "status": "OPEN",
  "reasons": [
    "Unusually high transaction amount"
  ],
  "createdAt": "2026-11-05T21:00:00.000Z",
  "updatedAt": "2026-11-05T21:00:00.000Z"
}
```

- **Validation:** Status must be one of `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `FALSE_POSITIVE`.
- **Indexes:**
  - `uniq_alert_transaction_id`: `{ transactionId: 1 }` (**Unique** — enforces one primary alert record per transaction).
  - `idx_alert_status`: `{ status: 1 }`
  - `idx_alert_risk_level`: `{ riskLevel: 1 }`
  - `idx_alert_created_at`: `{ createdAt: -1 }`

### 4.3 `fraud_rules`
Stores configurable risk heuristic rules with operational weights and thresholds.

```json
{
  "_id": "ObjectId('672b1234567890abcdef1236')",
  "ruleCode": "HIGH_AMOUNT",
  "name": "Unusually High Transaction Amount",
  "description": "Flags transactions exceeding configured monetary threshold (e.g. ₹50,000)",
  "enabled": true,
  "threshold": 50000,
  "weight": 25,
  "createdAt": "2026-11-05T21:00:00.000Z",
  "updatedAt": "2026-11-05T21:00:00.000Z"
}
```

- **Baseline Seeded Rules:**
  1. `HIGH_AMOUNT`: Threshold ₹50,000 (Weight: 25)
  2. `RAPID_TRANSFERS`: Threshold 3 transfers within window (Weight: 20)
  3. `SUSPICIOUS_HOUR`: Transactions between 01:00 - 05:00 (Weight: 15)
  4. `ZERO_BALANCE_DRAIN`: 100% account balance depletion (Weight: 20)
- **Indexes:**
  - `uniq_rule_code`: `{ ruleCode: 1 }` (**Unique**)
  - `idx_rule_enabled`: `{ enabled: 1 }`

### 4.4 `fraud_investigations`
Maintains investigation records and notes for compliance and security personnel.

```json
{
  "_id": "ObjectId('672b1234567890abcdef1237')",
  "alertId": "ObjectId('672b1234567890abcdef1235')",
  "transactionId": 1045,
  "assignedEmployeeId": 8,
  "status": "UNDER_REVIEW",
  "notes": [
    {
      "authorId": 8,
      "text": "Contacted account holder to verify beneficiary details.",
      "createdAt": "2026-11-05T21:15:00.000Z"
    }
  ],
  "resolution": null,
  "createdAt": "2026-11-05T21:05:00.000Z",
  "updatedAt": "2026-11-05T21:15:00.000Z"
}
```

- **Indexes:**
  - `idx_investigation_alert_id`: `{ alertId: 1 }`
  - `idx_investigation_transaction_id`: `{ transactionId: 1 }`
  - `idx_investigation_employee_id`: `{ assignedEmployeeId: 1 }`
  - `idx_investigation_status`: `{ status: 1 }`

---

## 5. Database Initialization

Initialization is fully automated, repeatable, and idempotent:

```bash
# From repository root:
node database/initMongo.js

# Or from backend directory:
npm run db:init:mongo
```

The script:
1. Connects to `bank_fraud_detection` via `MONGODB_URI`.
2. Verifies or creates the 4 required collections.
3. Applies JSON Schema validators.
4. Generates all required indexes.
5. Idempotently seeds the 4 default fraud detection rules using `$setOnInsert`.
6. Leaves existing documents and historical assessments completely intact.

---

## 6. Connection Verification & Health Diagnostics

### 6.1 Public / Customer-Safe Health Check
Endpoint: `GET /api/health`

Returns high-level status of both databases without revealing database credentials, connection strings, or server paths:
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "service": "bank-management-system-backend",
    "environment": "development",
    "timestamp": "2026-11-05T16:21:52.012Z",
    "uptimeSeconds": 45,
    "database": {
      "connected": true,
      "status": "CONNECTED"
    },
    "mongodb": {
      "connected": true,
      "status": "CONNECTED"
    }
  }
}
```

If MongoDB is offline, `status` remains `UP` because core banking continues to function:
```json
{
  "mongodb": {
    "connected": false,
    "status": "DISCONNECTED",
    "note": "Fraud detection database unavailable"
  }
}
```

### 6.2 Administrator System Diagnostics
Endpoint: `GET /api/diagnostics` (Requires `role: 'ADMIN'`)

Returns detailed metrics for both MySQL pool and MongoDB collections:
```json
{
  "success": true,
  "data": {
    "service": "bank-management-system-backend",
    "database": {
      "connected": true,
      "status": "CONNECTED",
      "poolTotalConnections": 10,
      "poolFreeConnections": 10
    },
    "mongodb": {
      "connected": true,
      "status": "CONNECTED",
      "database": "bank_fraud_detection",
      "collectionStats": {
        "transaction_risk_assessments": 0,
        "fraud_alerts": 0,
        "fraud_rules": 4,
        "fraud_investigations": 0
      }
    },
    "tableStats": {
      "users": 15,
      "customers": 6,
      "accounts": 20,
      "bank_transactions": 78
    }
  }
}
```

---

## 7. Automated Testing

Run the MongoDB test suite from `backend/`:
```bash
node --test tests/mongoFoundation.test.js
```

Covers 9 comprehensive test cases:
1. MongoDB connection initialization and database resolution.
2. Connection failure handling with offline/invalid URIs.
3. Prevention of duplicate connections (singleton pattern).
4. Creation of all 4 required collections.
5. Verification of all index definitions and code 11000 duplicate key enforcement.
6. Idempotent initialization without rule duplication.
7. Verification that MongoDB disconnection leaves MySQL banking APIs (login, accounts, profile) 100% operational.
8. Role-based diagnostics security (Admin access vs Customer 403 rejection).
9. Safe payload validation in public `/api/health`.

