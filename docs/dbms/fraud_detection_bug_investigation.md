# Critical Bug Investigation Report: Fraud Detection Pipeline and Dashboard

**System:** Bank Management System  
**Repository Branch:** `feature/fraud-phase-3-integration`  
**Investigation Date:** November 6, 2026  
**Status:** Completed & Verified  

---

## 1. Executive Summary

During manual testing of the Bank Management System, three consecutive transfers of ₹60,000.00 were executed from Account 1 to Account 184 in under two minutes. The tester expected the fraud detection engine to flag repeated high-value transfers, produce high-risk classifications, generate alerts in the Fraud Monitoring Dashboard, and display a non-zero recent average risk score.

Instead, the dashboard presented:
- **Total Assessments:** 6 (up from 2 baseline assessments).
- **Risk Distribution:** 4 MEDIUM, 2 LOW, 0 HIGH, 0 CRITICAL.
- **Total Alerts:** 0.
- **Recent Average Risk Score:** 0.

A rigorous, end-to-end investigation across MySQL transaction tables, outbox events, background worker execution, rule evaluation engines, MongoDB collections, and React dashboard components identified the root causes.

### Summary of Root Causes

| Issue Observed | Root Cause | Classification |
|---|---|---|
| **6 assessments instead of 5** | Prior to the 3 transfers, a ₹1,000,000.00 deposit was executed at 03:00:51 UTC (Txn #7) to provide sufficient account balance. The banking engine records all deposits, withdrawals, and transfers into the transactional outbox. The fraud worker evaluated this deposit, triggering `HIGH_AMOUNT` (30 points -> MEDIUM). The 6 assessments comprise: 2 baseline (Txn #5, #6), 1 deposit (Txn #7), and 3 transfers (Txn #8, #9, #10). | Expected System Behavior (User Action Discovered) |
| **0 alerts generated for 3x ₹60,000 transfers** | Scoring policy arithmetic: `HIGH_AMOUNT` awarded 30 points and `HIGH_VELOCITY` awarded 25 points on the 4th transaction in the 2-minute window. Their sum ($30 + 25 = 55$) falls into the `MEDIUM` tier (30–59). Alerts are strictly persisted when risk score $\ge 60$ (`HIGH` or `CRITICAL`). `NEW_BENEFICIARY` did not trigger because Account 184 was previously transferred to in Txn #5. `UNUSUAL_HOUR` did not trigger because transfers occurred at 08:31 AM IST (03:01 UTC). | Design Boundary / Scoring Calibration |
| **Recent Average Risk Score displayed 0** | The dashboard aggregation pipeline computed `recentScoreAvg` exclusively on `fraud_alerts`. When zero alerts exist, the pipeline yielded an empty set, falling back to 0. It did not calculate the average score across transaction assessments from `transaction_risk_assessments`. | Dashboard Aggregation Metric Scope |

---

## 2. End-to-End Pipeline Architecture & Lifecycle Trace

The fraud detection pipeline operates asynchronously via the Transactional Outbox pattern to guarantee zero latency penalty and zero blocking of core banking operations:

```
+----------------------------------------------------------------------------------------------------+
| 1. Banking Transaction Execution (MySQL)                                                           |
|    POST /api/transactions/transfer                                                                 |
|    - START TRANSACTION                                                                             |
|    - Check balances, update account ledger                                                         |
|    - INSERT INTO bank_transactions                                                                 |
|    - INSERT INTO fraud_outbox_events (status='PENDING', payload=...)                               |
|    - COMMIT                                                                                        |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
| 2. Transactional Outbox Worker (Node.js Background Process)                                        |
|    - Polls fraud_outbox_events using SELECT ... FOR UPDATE with row lease locking                 |
|    - Atomically claims PENDING events -> PROCESSING                                                |
|    - Invokes Transaction Context Provider                                                         |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
| 3. Transaction Context Provider (MySQL Data Aggregator)                                            |
|    - Queries MySQL for sender account history, 2-minute rolling window count, prior counterparties |
|    - Converts monetary values to integer paise                                                     |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
| 4. Rule Evaluation Engine (MongoDB Rules Source of Truth)                                          |
|    - Fetches active rules from bank_fraud_detection.fraud_rules:                                   |
|      * HIGH_AMOUNT (threshold: 5,000,000 paise / weight: 30)                                       |
|      * HIGH_VELOCITY (threshold: 3 txns in 2 min / weight: 25)                                     |
|      * NEW_BENEFICIARY (first-time recipient / weight: 25)                                         |
|      * UNUSUAL_HOUR (01:00 - 05:00 IST / weight: 20)                                               |
|    - Calculates: riskScore = sum(triggered_weights)                                                |
|    - Classifies: LOW (0-29), MEDIUM (30-59), HIGH (60-79), CRITICAL (80-100)                      |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
| 5. Risk Assessment & Alert Persistence (MongoDB)                                                   |
|    - Upserts assessment document into transaction_risk_assessments (idempotent on transactionId)   |
|    - If riskScore >= 60 (HIGH or CRITICAL):                                                        |
|      * Persists alert into fraud_alerts with status='OPEN'                                         |
|    - Marks outbox event as COMPLETED in MySQL                                                      |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
| 6. Monitoring Dashboard & Analytics (Express + React Frontend)                                     |
|    - GET /api/fraud/dashboard/stats aggregates:                                                    |
|      * Total Assessments & Risk Distribution from transaction_risk_assessments                     |
|      * Recent Average Assessment Risk Score & Recent Average Alert Score                           |
|      * Total Alerts & Alert Breakdown from fraud_alerts                                            |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Live Database Record Evidence: Transactions 5 through 10

Inspection of the production databases revealed the exact transaction history:

### A. MySQL Ledger (`bank_transactions` & `fraud_outbox_events`)

| Tx ID | Reference | Type | Amount (INR) | Source -> Dest | Created At (UTC) | Outbox Event ID | Outbox Status |
|:---:|:---|:---:|---:|:---:|:---:|:---:|:---:|
| **5** | `TXN-1762311020290` | TRANSFER | ₹2,500.00 | Acc 1 -> Acc 184 | 2026-11-06 02:50:20 | 10001004 | `COMPLETED` |
| **6** | `TXN-1762311295286` | DEPOSIT | ₹2,500.00 | Null -> Acc 184 | 2026-11-06 02:54:55 | 10001005 | `COMPLETED` |
| **7** | `TXN-1762311651543` | DEPOSIT | ₹1,000,000.00 | Null -> Acc 1 | 2026-11-06 03:00:51 | 10001006 | `COMPLETED` |
| **8** | `TXN-1762311689239` | TRANSFER | ₹60,000.00 | Acc 1 -> Acc 184 | 2026-11-06 03:01:29 | 10001007 | `COMPLETED` |
| **9** | `TXN-1762311700689` | TRANSFER | ₹60,000.00 | Acc 1 -> Acc 184 | 2026-11-06 03:01:40 | 10001008 | `COMPLETED` |
| **10** | `TXN-1762311714241` | TRANSFER | ₹60,000.00 | Acc 1 -> Acc 184 | 2026-11-06 03:01:54 | 10001009 | `COMPLETED` |

### B. MongoDB Risk Assessments (`transaction_risk_assessments`)

```json
[
  {
    "transactionId": 5,
    "amount": 250000,
    "riskScore": 25,
    "riskLevel": "LOW",
    "triggeredRules": ["NEW_BENEFICIARY"],
    "decision": "APPROVED",
    "assessedAt": "2026-11-06T02:50:20.350Z"
  },
  {
    "transactionId": 6,
    "amount": 250000,
    "riskScore": 0,
    "riskLevel": "LOW",
    "triggeredRules": [],
    "decision": "APPROVED",
    "assessedAt": "2026-11-06T02:54:55.334Z"
  },
  {
    "transactionId": 7,
    "amount": 100000000,
    "riskScore": 30,
    "riskLevel": "MEDIUM",
    "triggeredRules": ["HIGH_AMOUNT"],
    "decision": "REVIEW_REQUIRED",
    "assessedAt": "2026-11-06T03:00:51.603Z"
  },
  {
    "transactionId": 8,
    "amount": 6000000,
    "riskScore": 30,
    "riskLevel": "MEDIUM",
    "triggeredRules": ["HIGH_AMOUNT"],
    "decision": "REVIEW_REQUIRED",
    "assessedAt": "2026-11-06T03:01:29.308Z"
  },
  {
    "transactionId": 9,
    "amount": 6000000,
    "riskScore": 30,
    "riskLevel": "MEDIUM",
    "triggeredRules": ["HIGH_AMOUNT"],
    "decision": "REVIEW_REQUIRED",
    "assessedAt": "2026-11-06T03:01:40.732Z"
  },
  {
    "transactionId": 10,
    "amount": 6000000,
    "riskScore": 55,
    "riskLevel": "MEDIUM",
    "triggeredRules": ["HIGH_AMOUNT", "HIGH_VELOCITY"],
    "decision": "REVIEW_REQUIRED",
    "assessedAt": "2026-11-06T03:01:54.296Z"
  }
]
```

---

## 4. In-Depth Analysis of Observed Behaviors

### 4.1 Resolution of Assessment Count Discrepancy (6 Assessments vs. 5 Expected)
The tester reported seeing 2 assessments initially and expected 5 total after performing 3 transfers ($2 + 3 = 5$).
- **Evidence:** MySQL transaction #7 (`TXN-1762311651543`) was executed at `03:00:51 UTC` for `₹1,000,000.00`.
- **Reason:** To fund the account for subsequent transfers, the user performed a deposit of ₹1,000,000.00 into Account 1.
- **Outbox Processing:** In banking architecture, deposits and withdrawals are first-class financial transactions and emit outbox events. The worker claimed event #10001006 and evaluated the ₹1,000,000.00 deposit.
- **Rule Fired:** The deposit exceeded ₹50,000.00, triggering `HIGH_AMOUNT` (30 points -> `MEDIUM`).
- **Conclusion:** $2\text{ (baseline)} + 1\text{ (deposit)} + 3\text{ (transfers)} = 6\text{ assessments}$.
  - LOW: 2 (Txn #5, Txn #6)
  - MEDIUM: 4 (Txn #7, Txn #8, Txn #9, Txn #10)
  - HIGH: 0
  - CRITICAL: 0

### 4.2 Why 3 Transfers of ₹60,000 Produced No Alerts
The tester expected 3 consecutive ₹60,000 transfers to trigger alerts. Tracing the evaluation of each transfer explains why:

#### Transfer 1 (Txn #8 at 03:01:29 UTC):
- **Amount:** ₹60,000.00 (6,000,000 paise) $> 5,000,000$ paise threshold $\rightarrow$ `HIGH_AMOUNT` triggers (**30 points**).
- **Velocity Window (02:59:29 to 03:01:29 UTC):**
  - Txn #7 (03:00:51 UTC) + Txn #8 (03:01:29 UTC) = 2 transactions.
  - Threshold rule: `count > 3`. Since $2 \le 3$, `HIGH_VELOCITY` does **not** trigger (0 points).
- **Beneficiary:** Acc 1 previously transferred to Acc 184 in Txn #5. `NEW_BENEFICIARY` does **not** trigger (0 points).
- **Time:** 08:31 AM IST is outside 01:00–05:00 AM IST. `UNUSUAL_HOUR` does **not** trigger (0 points).
- **Score:** 30 $\rightarrow$ `MEDIUM`. Alert requirement ($\ge 60$) not met.

#### Transfer 2 (Txn #9 at 03:01:40 UTC):
- **Amount:** ₹60,000.00 $> 50,000.00$ $\rightarrow$ `HIGH_AMOUNT` triggers (**30 points**).
- **Velocity Window (02:59:40 to 03:01:40 UTC):**
  - Txn #7 (03:00:51) + Txn #8 (03:01:29) + Txn #9 (03:01:40) = 3 transactions.
  - Threshold rule: `count > 3`. Since $3 \le 3$, `HIGH_VELOCITY` does **not** trigger (0 points).
- **Score:** 30 $\rightarrow$ `MEDIUM`. Alert requirement not met.

#### Transfer 3 (Txn #10 at 03:01:54 UTC):
- **Amount:** ₹60,000.00 $> 50,000.00$ $\rightarrow$ `HIGH_AMOUNT` triggers (**30 points**).
- **Velocity Window (02:59:54 to 03:01:54 UTC):**
  - Txn #7 (03:00:51) + Txn #8 (03:01:29) + Txn #9 (03:01:40) + Txn #10 (03:01:54) = 4 transactions.
  - Threshold rule: $4 > 3 \rightarrow$ `HIGH_VELOCITY` **triggers** (**25 points**).
- **Score:** $30 + 25 = 55$.
- **Classification:** Score 55 falls within `MEDIUM` (30–59), mapping to `decision: 'REVIEW_REQUIRED'`.
- **Alert Policy:** Alerts are generated strictly when `riskLevel === 'HIGH' || riskLevel === 'CRITICAL'` (score $\ge 60$). Because $55 < 60$, no alert was persisted.

---

## 5. Dashboard Aggregation Analysis and Implemented Corrections

### 5.1 Root Cause of Recent Average Risk Score = 0
In `backend/src/services/fraud/fraudDashboardService.js`, the `recentScoreAvg` aggregation pipeline was attached only to `alertsCollection` (`fraud_alerts`):

```javascript
// Previous Implementation:
const [alertsFacet] = await alertsCollection.aggregate([
  {
    $facet: {
      recentScoreAvg: [
        { $sort: { createdAt: -1 } },
        { $limit: 1000 },
        { $group: { _id: null, avgScore: { $avg: '$riskScore' } } }
      ]
    }
  }
]);
```

When there were 0 alerts in the system, `recentScoreAvg` produced `[]`, which defaulted `recentAverageRiskScore` to `0`. Meanwhile, 6 assessments existed in `transaction_risk_assessments` with scores [25, 0, 30, 30, 30, 55], whose true arithmetic mean is:
$$\frac{25 + 0 + 30 + 30 + 30 + 55}{6} = \frac{170}{6} \approx 28.33$$

### 5.2 Implemented Dashboard Service Enhancements
1. **Assessment Average Pipeline:** Added a dedicated pipeline inside `assessmentsFacet` on `transaction_risk_assessments`:
   ```javascript
   recentAssessmentScoreAvg: [
     { $sort: { assessedAt: -1 } },
     { $limit: 1000 },
     { $group: { _id: null, avgScore: { $avg: '$riskScore' } } }
   ]
   ```
2. **Dual Metric API Response:** The endpoint `GET /api/fraud/dashboard/stats` now returns:
   - `recentAverageAssessmentScore`: Authoritative average risk score across evaluated banking transactions (e.g., 28.33).
   - `recentAverageAlertScore`: Average risk score across generated fraud alerts.
   - `recentAverageRiskScore`: Backward-compatible alias.
3. **Strict UTC Date Filtering:** Replaced local-timezone boundary mutation with `setUTCHours(0, 0, 0, 0)` and `setUTCHours(23, 59, 59, 999)` to prevent timezone drift across international client requests.
4. **Frontend UI Update (`FraudDashboard.jsx`):** Card 4 was updated to display `recentAverageAssessmentScore` (or formatted alert average) with clear descriptive subtext indicating evaluation scope.

---

## 6. Structured Diagnostic Logging Implementation

To maintain permanent observability without exposing sensitive credentials, session tokens, or customer PII, structured diagnostic logging was implemented in:

1. **`fraudOutboxWorker.js`**:
   - `[FraudWorker:worker-id] Claimed outbox event #<id> (tx #<id>, type: <TYPE>, attempt: <n>)`
   - `[FraudWorker:worker-id] Loaded context for tx #<id>: accountId=<id>, recentTxCount=<n>, isNewBeneficiary=<bool>`
   - `[FraudWorker:worker-id] Outbox event #<id> marked COMPLETED for tx #<id> (score: <score>, level: <LEVEL>)`
2. **`fraudDetectionService.js`**:
   - `[FraudPipeline] Evaluating tx #<id> (<TYPE>): amount=₹<amount> (<paise> paise), accountId=<id>, customerId=<id>`
   - `[FraudPipeline] Loaded <n> active fraud rule(s): <Rule>(weight:<w>), ...`
   - `[FraudPipeline] Rule "<RULE_CODE>": triggered=<bool>, points=<pts> (<reason>)`
   - `[FraudPipeline] Tx #<id> calculated riskScore=<score>, riskLevel=<LEVEL>, decision=<DECISION>`
   - `[FraudPipeline] Assessment for tx #<id>: INSERTED`
   - `[FraudPipeline] Alert for tx #<id>: INSERTED (<LEVEL>)`

All logged attributes adhere strictly to banking security compliance: zero passwords, tokens, full account credentials, or PAN numbers are logged.

---

## 7. Verification Test Suite Results

A dedicated test suite `backend/tests/fraudPipelineBugInvestigation.test.js` was created and executed along with all existing suites:

### Test Suite Execution Summary

| Test Category | File | Tests Run | Passed | Failed |
|---|---|:---:|:---:|:---:|
| **HIGH_AMOUNT Precision & Units** | `fraudPipelineBugInvestigation.test.js` | 5 | 5 | 0 |
| **HIGH_VELOCITY Windows & Account Isolation** | `fraudPipelineBugInvestigation.test.js` | 5 | 5 | 0 |
| **Outbox Integration & Idempotency** | `fraudPipelineBugInvestigation.test.js` | 3 | 3 | 0 |
| **Dashboard Aggregations & UTC Boundaries** | `fraudPipelineBugInvestigation.test.js` | 5 | 5 | 0 |
| **Functional Debugging Regression** | `fraudRegressionDebugging.test.js` | 12 | 12 | 0 |
| **Core Fraud Engine, Outbox & Dashboard** | `fraudEngine`, `fraudOutbox`, `fraudDashboard` | 100 | 100 | 0 |
| **Frontend Production Build** | Vite Build (`npm run build`) | N/A | Clean (0 errors) | 0 |
| **Total Verified Fraud Tests** | — | **130** | **130** | **0** |

---

## 8. Recommendations for Fraud Scoring Policy

The investigation proves that the engine behaves correctly according to the configured rule weights and mathematical specifications:
$$\text{Score} = \text{HIGH\_AMOUNT (30)} + \text{HIGH\_VELOCITY (25)} = 55$$

Because 55 falls below the alert threshold (60), the 3rd transfer did not trigger an alert. If banking risk policy requires repeated high-value transactions to generate an alert immediately, the following calibration adjustments can be adopted:

1. **Option A (Adjust Weights to Reach 60 on Velocity + Amount):**
   - Increase `HIGH_AMOUNT` from 30 to 35.
   - Increase `HIGH_VELOCITY` from 25 to 30.
   - Adjust `NEW_BENEFICIARY` to 20 and `UNUSUAL_HOUR` to 15 (maintaining maximum score = 100).
   - Under this setting: $35 + 30 = 65 \ge 60 \rightarrow$ alert generated immediately on 4th transaction.
2. **Option B (Lower Alert Threshold for Review Required):**
   - Lower the alert trigger threshold from 60 to 50, allowing high-velocity high-amount transactions (score 55) to trigger `REVIEW_REQUIRED` alerts.
3. **Option C (Composite Velocity Rule):**
   - Add a rule specifically measuring cumulative transferred volume in rolling windows (e.g., aggregate transferred $> ₹100,000$ in 5 minutes).

