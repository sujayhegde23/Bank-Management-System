# Phase 2 — Rule-Based Fraud Detection Engine Documentation

## 1. Overview
The Rule-Based Fraud Detection Engine evaluates completed banking transactions against configurable fraud detection rules stored in MongoDB. It computes standardized fraud risk scores (0–100), classifies categorical risk levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), determines policy decisions (`APPROVED`, `REVIEW_REQUIRED`, `FLAGGED`), and idempotently records assessments and alerts.

MySQL remains the primary authoritative database of record for all banking operations, accounts, and balance ledgers. The fraud detection engine is decoupled and operates exclusively on MongoDB collections without modifying banking records or transactions.

---

## 2. Architecture & Module Separation

```
backend/src/services/fraud/
├── index.js                  # Public API export
├── fraudDetectionService.js  # Main evaluation orchestrator (with partial rollback & recovery)
├── fraudRuleRepository.js    # MongoDB fraud_rules loader, validator, and cache
├── riskScoringService.js     # Scoring formula, classification boundaries, decisions
├── assessmentRepository.js   # Idempotent persistence for assessments & alerts
├── rules/                    # Isolated rule evaluators
│   ├── index.js              # Rule registry and evaluator dispatcher
│   ├── highAmount.js         # Rule 1: HIGH_AMOUNT
│   ├── highVelocity.js       # Rule 2: HIGH_VELOCITY
│   ├── newBeneficiary.js     # Rule 3: NEW_BENEFICIARY
│   └── unusualHour.js        # Rule 4: UNUSUAL_HOUR
└── utils/
    ├── monetary.js           # Exact integer paise, safe BIGINT handling, string decimal parser
    ├── validation.js         # Transaction and context input validator
    └── errors.js             # FraudEngineError, FraudValidationError, FraudConfigurationError
```

---

## 3. Monetary Precision & Unit Specification

### Unit: Integer Paise
All monetary values in MongoDB (`transaction_risk_assessments.amount` and `fraud_rules.threshold`) are stored and computed in **integer paise** ($1\text{ INR} = 100\text{ paise}$).

### No Floating-Point Multiplication
- MySQL `DECIMAL(15,2)` amounts (e.g. `"19.99"`, `50000.00`, `"50000.01"`) are parsed via exact string splitting and `BigInt` operations in [`monetary.js`](file:///c:/se%20mini%20project/Bank-Management-System/backend/src/services/fraud/utils/monetary.js).
- For example, `"19.99"` becomes `1999` paise directly, completely avoiding floating-point rounding errors (e.g., `19.99 * 100 = 1998.9999999999998`).
- Persisted in MongoDB as safe integers (`int32` / `int64`).
- Display formatting uses exact integer quotient/remainder operations (`paiseToRupees`, `formatPaiseToRupees`).

### Identifier Safety
- MySQL `BIGINT` identifiers (`transactionId`, `customerId`, `accountId`) are validated against `Number.MAX_SAFE_INTEGER` ($2^{53} - 1 = 9,007,199,254,740,991$) using `toSafeId()`.
- Identifiers exceeding this limit (e.g., `"9007199254740993"`, `"9223372036854775807"`) or non-integer values are strictly rejected with `FraudValidationError` rather than undergoing silent precision loss.

---

## 4. MongoDB Rules Configuration

Active collection: `fraud_rules` in database `bank_fraud_detection`.

| Rule Code | Display Name | Threshold (Paise) | Weight | Configuration | Description |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `HIGH_AMOUNT` | Unusually High Transaction Amount | 5,000,000 paise (₹50,000.00) | 25 | None | Flags single transactions strictly exceeding ₹50,000.00. |
| `HIGH_VELOCITY` | High-Velocity Transaction Frequency | 3 | 20 | `{ windowMinutes: 2 }` | Flags high frequency of transactions (>3) within short time window. |
| `NEW_BENEFICIARY` | First-Time Beneficiary Transfer | 0 | 20 | None | Flags transfers to a destination account without prior history. |
| `UNUSUAL_HOUR` | Unusual Banking Hour Activity | 0 | 15 | `{ startHour: 1, endHour: 5, timezone: "Asia/Kolkata" }` | Flags transactions executed between 01:00 and 05:00 IST. |

*Backward Compatibility Aliases:*
- `RAPID_TRANSFERS` is recognized as an alias for `HIGH_VELOCITY`.
- `SUSPICIOUS_HOUR` is recognized as an alias for `UNUSUAL_HOUR`.

---

## 5. Detection Rules & Execution Logic

### Rule 1: HIGH_AMOUNT
- **Evaluator:** [`rules/highAmount.js`](file:///c:/se%20mini%20project/Bank-Management-System/backend/src/services/fraud/rules/highAmount.js)
- **Condition:** Amount strictly exceeds configured threshold: `amountPaise > thresholdPaise`.
- **Boundary:** Transactions at or below threshold (e.g. ₹50,000.00 = 5,000,000 paise) do NOT trigger. Transactions at ₹50,000.01 (5,000,001 paise) trigger.
- **Weight:** Configured weight in MongoDB (default: 25 points).

### Rule 2: HIGH_VELOCITY
- **Evaluator:** [`rules/highVelocity.js`](file:///c:/se%20mini%20project/Bank-Management-System/backend/src/services/fraud/rules/highVelocity.js)
- **Condition:** Transaction frequency strictly exceeds configured threshold: `count > threshold`.
- **Context Handling & Double-Counting Safeguard:** Caller supplies transaction frequency via `context.recentTransactionCount` or `context.recentTransactions` array. If `context.includeCurrentTransaction === false`, the count is incremented by 1 only if the current transaction is not already in the array. Missing or empty context safely evaluates to non-trigger.
- **Weight:** Configured weight in MongoDB (default: 20 points).

### Rule 3: NEW_BENEFICIARY
- **Evaluator:** [`rules/newBeneficiary.js`](file:///c:/se%20mini%20project/Bank-Management-System/backend/src/services/fraud/rules/newBeneficiary.js)
- **Condition:** Evaluated strictly for `TRANSFER` transaction types. Bypasses `DEPOSIT` and `WITHDRAWAL`.
- **Context Handling:** Requires reliable beneficiary history in context (`isNewBeneficiary`, `previousTransfersCount`, `knownBeneficiary`). If reliable history is omitted or missing, the rule safely does not trigger.
- **Weight:** Configured weight in MongoDB (default: 20 points).

### Rule 4: UNUSUAL_HOUR
- **Evaluator:** [`rules/unusualHour.js`](file:///c:/se%20mini%20project/Bank-Management-System/backend/src/services/fraud/rules/unusualHour.js)
- **Condition:** Transaction timestamp falls within off-hours interval in the configured timezone (`Asia/Kolkata` by default).
- **Timezone Safety:** Uses `Intl.DateTimeFormat` with explicit timezone targeting, preventing server host OS timezone drift.
- **Boundary:** Half-open interval `[startHour, endHour)`. In Asia/Kolkata, timestamps from 01:00:00 through 04:59:59 IST trigger (e.g., UTC 19:30:00 through 23:29:59). Timestamps at 05:00:00 IST (UTC 23:30:00) and earlier than 01:00:00 IST (UTC 19:29:59) fall outside and do not trigger.
- **Weight:** Configured weight in MongoDB (default: 15 points).

---

## 6. Risk Scoring & Decision Matrix

- **Calculation:**
  $$\text{riskScore} = \min(100, \sum \text{triggeredRuleWeights})$$
- **Classification Boundaries & Automated Decisions:**

| Risk Level | Score Range | Assessment Decision | Generates Alert in `fraud_alerts`? |
| :--- | :---: | :---: | :---: |
| `LOW` | 0 – 29 | `APPROVED` | **No** |
| `MEDIUM` | 30 – 59 | `REVIEW_REQUIRED` | **No** |
| `HIGH` | 60 – 79 | `FLAGGED` | **Yes** (`status: OPEN`) |
| `CRITICAL` | 80 – 100 | `FLAGGED` | **Yes** (`status: OPEN`) |

---

## 7. Persistence, Idempotency & Partial Failure Handling

### Assessment Collection: `transaction_risk_assessments`
- Keyed by unique index `transactionId`.
- Duplicate evaluation requests for the same `transactionId` catch MongoDB error `11000`, return the existing assessment, and flag `isExisting: true`.
- Existing assessments are never overwritten.

### Alert Collection: `fraud_alerts`
- Keyed by unique index `transactionId`.
- Created exclusively for `HIGH` and `CRITICAL` risk assessments.
- Repeated evaluations return the existing alert without inserting duplicates.

### Partial Persistence Failure & Rollback
- If alert creation fails after an assessment has been inserted for a newly evaluated transaction, the engine catches the failure and immediately deletes the newly inserted assessment (`deleteAssessment(tx.transactionId)`). This prevents orphaned assessments without alerts.
- **Self-Healing Recovery:** If an existing high-risk assessment is re-evaluated and found without an alert (e.g. from an earlier system crash), the idempotency checker generates and persists the missing alert.
