# Phase 4 — Fraud Monitoring Dashboard

**Repository:** `sujayhegde23/Bank-Management-System`  
**Branch:** `feature/fraud-phase-3-integration`  
**Date:** November 2026  
**Status:** Completed & Verified  

---

## 1. Overview & Architectural Goals

Phase 4 establishes an administrative and operational **Fraud Monitoring Dashboard** within the Bank Management System, completing the end-to-end lifecycle of financial fraud management:
1. **Phase 1:** MongoDB foundation and collections (`transaction_risk_assessments`, `fraud_alerts`, `fraud_rules`, `fraud_investigations`).
2. **Phase 2:** Rule-based fraud detection engine with multi-factor risk scoring (`HIGH_AMOUNT`, `HIGH_VELOCITY`, `NEW_BENEFICIARY`, `UNUSUAL_HOUR`).
3. **Phase 3:** Non-blocking transactional outbox bridge and resilient background worker polling MySQL events and evaluating fraud asynchronously.
4. **Phase 4:** High-visibility monitoring, investigation lifecycle tracking, rule parameter calibration, and executive fraud analytics.

```
       +-------------------------------------------------------------+
       |                  Bank Management System                     |
       +-------------------------------------------------------------+
                                     |
               +---------------------+---------------------+
               |                                           |
    [ADMIN / EMPLOYEE Role]                         [CUSTOMER Role]
               |                                           |
   +-----------------------+                    +---------------------+
   | Fraud Monitoring UI   |                    | Normal Banking UI   |
   | (Overview, Alerts,    |                    | (Balances, Transfer,|
   |  Cases, Rules Config) |                    |  Statements, Profile|
   +-----------------------+                    +---------------------+
               |                                           |
      REST API (/api/fraud/*)                       REST API (/api/*)
               |                                           |
               v                                           v
   +-----------------------+                    +---------------------+
   |  Fraud Dashboard API  |                    | Core Banking API    |
   |     & RBAC Guard      |                    |                     |
   +-----------------------+                    +---------------------+
         |           \                                     |
         |            \ (Batch Hydration O(1))             |
         v             \---------------------------------> v
+------------------+                              +-------------------+
|  MongoDB Cluster |                              |   MySQL 8.0 DB    |
| (Fraud Intel)    |                              | (Core Financials) |
+------------------+                              +-------------------+
```

### Core Architectural Guarantees:
1. **Multi-Database Federation without Dual-Write Hazards:**
   - MySQL remains the immutable authority for financial accounts, ledger records, customers, and staff.
   - MongoDB acts as the authoritative store for risk assessments, fraud alerts, investigations, and detection rules.
2. **Zero N+1 Query Overhead (Batch Hydration):**
   - Paginated alerts returned from MongoDB contain numeric MySQL `transactionId` references.
   - Rather than executing an individual MySQL query per alert, a single batch query `WHERE transaction_id IN (...)` hydrates banking transaction details (amount, type, customer names, accounts) in $O(1)$ database trips.
3. **Strict Role-Based Authorization:**
   - `CUSTOMER`: Strictly forbidden from all `/api/fraud/*` endpoints with `403 Forbidden` (`AUTH_002`).
   - `EMPLOYEE`: Permitted to view dashboard metrics, browse alerts, inspect case details, open investigations, and append investigation notes. Forbidden from modifying fraud detection rules (`403 Forbidden`).
   - `ADMIN`: Full access to overview stats, alerts, investigation management, and real-time rule configuration.
4. **Investigation Audit Trail Immutability:**
   - Investigation notes are append-only. Each note records the author's user ID, role, timestamp, and text. Existing notes cannot be overwritten or deleted.
5. **Monetary Precision & Rule Configuration Safety:**
   - Monetary thresholds (`HIGH_AMOUNT`) are stored in MongoDB as integer paise (e.g., `5000000` paise = ₹50,000.00) to eliminate floating-point drift.
   - The dashboard API exposes rupee representations (`thresholdInRupees`) for operator convenience while persisting integer paise.
   - Rule updates automatically invalidate in-memory rule caches across backend workers via `clearRuleCache()`.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Endpoint | Method | Unauthenticated | CUSTOMER | EMPLOYEE | ADMIN | Description |
|---|---|:---:|:---:|:---:|:---:|---|
| `/api/fraud/dashboard/stats` | `GET` | 401 | 403 | 200 OK | 200 OK | Overview statistics & risk aggregates |
| `/api/fraud/alerts` | `GET` | 401 | 403 | 200 OK | 200 OK | Paginated alerts with MySQL hydration |
| `/api/fraud/alerts/:id` | `GET` | 401 | 403 | 200 OK | 200 OK | Full alert detail with assessment & history |
| `/api/fraud/alerts/:id/investigations` | `POST` | 401 | 403 | 201 OK | 201 OK | Open investigation case for an alert |
| `/api/fraud/investigations` | `GET` | 401 | 403 | 200 OK | 200 OK | List paginated investigations |
| `/api/fraud/investigations/:id` | `GET` | 401 | 403 | 200 OK | 200 OK | Investigation details & full notes audit trail |
| `/api/fraud/investigations/:id` | `PATCH` | 401 | 403 | 200 OK | 200 OK | Update case status, assign staff, append notes |
| `/api/fraud/rules` | `GET` | 401 | 403 | 200 OK | 200 OK | View configured fraud detection rules |
| `/api/fraud/rules/:id` | `PATCH` | 401 | 403 | **403** | **200 OK** | Update rule threshold, weight, or active status |

---

## 3. REST API Specification

### 3.1. Dashboard Overview Statistics
- **Route:** `GET /api/fraud/dashboard/stats`
- **Permissions:** `EMPLOYEE`, `ADMIN`
- **Response Format:**
```json
{
  "success": true,
  "data": {
    "totalAlerts": 142,
    "openAlerts": 18,
    "underReviewAlerts": 7,
    "resolvedAlerts": 115,
    "falsePositiveAlerts": 2,
    "riskDistribution": {
      "LOW": 450,
      "MEDIUM": 85,
      "HIGH": 32,
      "CRITICAL": 8
    },
    "alertsByRisk": {
      "MEDIUM": 50,
      "HIGH": 30,
      "CRITICAL": 8
    },
    "openInvestigations": 12,
    "totalInvestigations": 94,
    "highRiskAlertsCount": 38,
    "averageRiskScore": 24.5
  }
}
```

### 3.2. Paginated Alerts Listing with Hydration
- **Route:** `GET /api/fraud/alerts?page=1&limit=20&riskLevel=CRITICAL&status=OPEN`
- **Permissions:** `EMPLOYEE`, `ADMIN`
- **Query Parameters:**
  - `page`: Page index (default: `1`).
  - `limit`: Items per page (default: `20`, max: `100`).
  - `riskLevel`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
  - `status`: `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `FALSE_POSITIVE`, `DISMISSED`.
  - `startDate`, `endDate`: ISO 8601 creation filters.
  - `transactionId`: Filter by exact MySQL banking transaction ID.
- **Hydrated Response Item:**
```json
{
  "_id": "6aecca327e58fac2376c8d31",
  "alertId": "6aecca327e58fac2376c8d31",
  "transactionId": 1290,
  "riskScore": 85,
  "riskLevel": "CRITICAL",
  "status": "OPEN",
  "triggeredRules": ["HIGH_AMOUNT", "NEW_BENEFICIARY"],
  "createdAt": "2026-11-05T18:00:00.000Z",
  "transaction": {
    "transactionId": 1290,
    "transactionRef": "TXN-88203-91",
    "type": "TRANSFER",
    "amount": 250000.00,
    "createdAt": "2026-11-05T18:00:00.000Z",
    "sourceAccount": {
      "accountNumber": "ACC-10023",
      "customerName": "John Doe",
      "customerId": 14
    },
    "destinationAccount": {
      "accountNumber": "ACC-99401",
      "customerName": "External Beneficiary",
      "customerId": 88
    }
  }
}
```

### 3.3. Alert Details
- **Route:** `GET /api/fraud/alerts/:id`
- **Identifier:** Supports both 24-character hexadecimal MongoDB `ObjectId` string or numeric MySQL `transactionId`.
- **Response Structure:** Includes complete `alert`, `riskAssessment` (with breakdown of all evaluated rules), `transaction` (from MySQL), and linked `investigation` (if already opened).

### 3.4. Case Management & Investigations
- **Create Investigation:** `POST /api/fraud/alerts/:id/investigations`
  - **Payload:** `{ "assignedTo": 3, "notes": "Initiating identity verification with customer." }`
  - **Behavior:** Creates case idempotently, transitions alert status to `UNDER_REVIEW`, records initial audit note.
- **List Investigations:** `GET /api/fraud/investigations?status=OPEN&page=1&limit=20`
- **Update Investigation:** `PATCH /api/fraud/investigations/:id`
  - **Payload:**
    ```json
    {
      "status": "RESOLVED",
      "assignedTo": 3,
      "notes": "Customer confirmed legitimate transaction via phone 2FA.",
      "resolution": "CONFIRMED_LEGITIMATE"
    }
    ```
  - **Lifecycle Synchronization:** Setting status to `RESOLVED` or `FALSE_POSITIVE` automatically synchronizes the corresponding `fraud_alerts` document status.

### 3.5. Fraud Rules Management
- **List Rules:** `GET /api/fraud/rules` (EMPLOYEE & ADMIN)
  - Returns rule code, name, description, weight, thresholds (in both integer paise and converted rupees), and active state.
- **Update Rule:** `PATCH /api/fraud/rules/:id` (ADMIN Only)
  - Accepts `threshold`, `thresholdInRupees`, `weight` (0–100), and `enabled` (`true`/`false`).
  - Converts rupee inputs to integer paise before storing in MongoDB.
  - Automatically invokes `clearRuleCache()` so workers pick up updated parameters immediately.

---

## 4. MongoDB Aggregations & Query Design

### 4.1. Fast Multi-Faceted Dashboard Aggregation
To prevent multiple round-trips to MongoDB for summary metrics, `getDashboardStats` uses a single pipeline with `$facet`:

```javascript
const [stats] = await alertsColl.aggregate([
  {
    $facet: {
      statusCounts: [
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ],
      riskCounts: [
        { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
      ],
      recentScoreAvg: [
        { $sort: { createdAt: -1 } },
        { $limit: 1000 },
        { $group: { _id: null, avgScore: { $avg: '$riskScore' }, count: { $sum: 1 } } }
      ]
    }
  }
]).toArray();
```

> [!NOTE]
> **Metric Definition:** `recentAverageRiskScore` represents the arithmetic mean of `riskScore` for the most recent 1,000 fraud alerts (or all alerts if fewer than 1,000 exist), ordered by `createdAt` descending (`{ createdAt: -1 }`). It leverages the index `idx_alert_created_at` for $O(K)$ retrieval without an in-memory sort.

### 4.2. Distinction Between Assessments and Alerts
The dashboard explicitly separates risk assessments from fraud alerts:
- **`totalAssessments` & `assessmentsByRiskLevel`**: Sourced directly from `transaction_risk_assessments`. Covers *all* evaluated banking transactions (LOW, MEDIUM, HIGH, CRITICAL).
- **`totalAlerts` & `alertsByRiskLevel`**: Sourced directly from `fraud_alerts`. Generated only when a transaction requires review or triggers alert thresholds (typically HIGH and CRITICAL).
- **`totalInvestigations` & `investigationsByStatus`**: Sourced directly from `fraud_investigations`.
Alert counts and assessment counts are strictly decoupled and never treated as interchangeable.
```

A companion `$facet` query evaluates the overall risk distribution across all evaluated transactions from `transaction_risk_assessments`.

### 4.2. Zero N+1 Hydration Pattern
To ensure the alerts table scales without burdening MySQL:
```javascript
// 1. Fetch paginated alerts from MongoDB
const alerts = await alertsColl.find(mongoQuery).skip(skip).limit(limit).toArray();

// 2. Extract unique transaction IDs
const transactionIds = alerts.map(a => a.transactionId).filter(Boolean);

// 3. Batch fetch all corresponding banking details in ONE SQL query
const [rows] = await pool.query(`
  SELECT 
    t.transaction_id, t.transaction_ref, t.type, t.amount, t.created_at,
    sa.account_number AS source_acc, c1.full_name AS source_customer, c1.customer_id AS source_cust_id,
    da.account_number AS dest_acc, c2.full_name AS dest_customer, c2.customer_id AS dest_cust_id
  FROM bank_transactions t
  LEFT JOIN accounts sa ON t.source_account_id = sa.account_id
  LEFT JOIN customers c1 ON sa.customer_id = c1.customer_id
  LEFT JOIN accounts da ON t.destination_account_id = da.account_id
  LEFT JOIN customers c2 ON da.customer_id = c2.customer_id
  WHERE t.transaction_id IN (?)
`, [transactionIds]);

// 4. Map back to MongoDB alert objects in memory in O(1) time
const txnMap = new Map(rows.map(r => [r.transaction_id, r]));
alerts.forEach(a => { a.transaction = txnMap.get(a.transactionId) || null; });
```

---

## 5. Frontend Dashboard Implementation

The Fraud Dashboard is integrated into the banking single-page application (`frontend/src/App.jsx` and `frontend/src/components/FraudDashboard.jsx`).

### Visual Theme & User Experience:
- **Design System:** Midnight navy dark theme (`#0f172a`, `#1e293b`) with neon emerald (`#10b981`), amber (`#f59e0b`), crimson (`#ef4444`), and purple (`#8b5cf6`) accents.
- **Navigation Placement:** Available in the primary sidebar for users with `ADMIN` and `EMPLOYEE` roles (`activeNav === 'fraud'`). Strictly omitted for `CUSTOMER`.
- **Sub-Tabs:**
  1. **Overview:** Metric cards (Total Alerts, High/Critical Count, Open Investigations, Avg Risk Score), Risk Level Distribution Visualizer, Alerts by Status Breakdown, and System Health status.
  2. **Fraud Alerts:** Filterable table with Risk Badges, Transaction Refs, Amounts in ₹, Status Selectors, and Action Buttons ("View Details", "Investigate").
  3. **Case Management:** List of ongoing investigations with assigned staff, resolution status, and "Manage Case" action.
  4. **Fraud Rules (Admin Only):** Rule configuration cards showing weights, thresholds (in ₹), active state toggles, and "Configure Rule" modal with instant validation.

### Interactive Modals:
- **Alert Details Modal:** Deep-dive modal displaying MySQL transaction specifics, MongoDB risk assessment breakdown (scores and weights for each triggered rule), and direct link to case management.
- **Investigation Modal:** Case history timeline showing timestamped notes and status transitions, case resolution form, and staff assignment selector.
- **Rule Configuration Modal:** Form allowing administrators to tune thresholds in rupees and weights from 0 to 100 with immediate feedback.

---

## 6. Automated Test Suite & Verification

The test suite in `backend/tests/fraudDashboard.test.js` exercises all backend endpoints, aggregation pipelines, investigation lifecycles, and security guarantees.

### Summary of Executed Test Suites:

| Suite | File | Tests | Passed | Failed | Status |
|---|---|:---:|:---:|:---:|:---:|
| **Phase 4 Fraud Dashboard** | `tests/fraudDashboard.test.js` | 36 | 36 | 0 | **PASS** |
| **Phase 3 Outbox Integration** | `tests/fraudOutboxIntegration.test.js` | 28 | 28 | 0 | **PASS** |
| **Phase 2 Rule-Based Engine** | `tests/fraudEngine.test.js` | 28 | 28 | 0 | **PASS** |
| **Phase 1 Mongo Foundation** | `tests/mongoFoundation.test.js` | 9 | 9 | 0 | **PASS** |
| **Customer Secure Transfers** | `tests/secureTransfers.test.js` | 27 | 27 | 0 | **PASS** |
| **Customer Balance Display** | `tests/customerBalanceDisplay.test.js` | 24 | 24 | 0 | **PASS** |
| **Customer Account Statements** | `tests/accountStatements.test.js` | 15 | 15 | 0 | **PASS** |
| **Customer Profile Security** | `tests/customerProfileSecurity.test.js` | 11 | 11 | 0 | **PASS** |
| **Customer Account Isolation** | `tests/customerAccountIsolation.test.js` | 25 | 25 | 0 | **PASS** |
| **Total Test Count** | **9 Test Suites** | **203** | **203** | **0** | **PASS (100%)** |

### Frontend Build & Lint Verification:
- `npm run build` (Vite 8.3.5): **Success (0 errors)**.
- `npx oxlint`: **Success (0 errors)** across all JSX and JS files.

---

## 7. Manual Testing & Verification Runbook

### Prerequisites:
Ensure MySQL and MongoDB are running:
```bash
# Verify MySQL (3306) and MongoDB (27017)
netstat -ano | findstr "3306"
netstat -ano | findstr "27017"
```

### 1. Test Customer Access Denial (Security Test):
1. Sign in as a customer:
   ```bash
   curl -i -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"john.doe","password":"Password123!"}' \
     -c cookies.txt
   ```
2. Attempt to access fraud stats:
   ```bash
   curl -i -X GET http://localhost:5000/api/fraud/dashboard/stats -b cookies.txt
   ```
   **Expected Result:** HTTP `403 Forbidden` with `{ "errorCode": "AUTH_002", "message": "Access denied" }`.

### 2. Test Employee Overview & Alerts:
1. Sign in as an employee:
   ```bash
   curl -i -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"emp.sarah","password":"Password123!"}' \
     -c cookies.txt
   ```
2. Retrieve fraud stats:
   ```bash
   curl -i -X GET http://localhost:5000/api/fraud/dashboard/stats -b cookies.txt
   ```
   **Expected Result:** HTTP `200 OK` with aggregated totals and risk distributions.
3. List alerts:
   ```bash
   curl -i -X GET "http://localhost:5000/api/fraud/alerts?page=1&limit=5" -b cookies.txt
   ```
   **Expected Result:** HTTP `200 OK` with hydrated banking transactions.

### 3. Test Employee Opening Investigation:
```bash
curl -i -X POST http://localhost:5000/api/fraud/alerts/<ALERT_ID>/investigations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"notes":"Customer contacted regarding unusual transfer."}'
```
**Expected Result:** HTTP `201 Created` with case ID and status `UNDER_REVIEW`.

### 4. Test Employee Forbidden from Modifying Rules:
```bash
curl -i -X PATCH http://localhost:5000/api/fraud/rules/HIGH_AMOUNT \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"weight": 50}'
```
**Expected Result:** HTTP `403 Forbidden` (`AUTH_002`).

### 5. Test Admin Modifying Rules & Cache Invalidation:
1. Sign in as admin:
   ```bash
   curl -i -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin.alice","password":"Password123!"}' \
     -c cookies.txt
   ```
2. Modify `HIGH_AMOUNT` threshold in rupees:
   ```bash
   curl -i -X PATCH http://localhost:5000/api/fraud/rules/HIGH_AMOUNT \
     -H "Content-Type: application/json" \
     -b cookies.txt \
     -d '{"thresholdInRupees": 75000, "weight": 40}'
   ```
   **Expected Result:** HTTP `200 OK` with `threshold: 7500000` (paise) and `thresholdInRupees: 75000`.

