# Automated Test Execution Report (Unit & Integration)

## Bank Management System with MongoDB Rule-Driven Fraud Detection

| Document Parameter | Value |
|---|---|
| **Document Title** | Automated Test Execution Report (Unit & Integration) |
| **Project** | Bank Management System with MongoDB-Based Rule-Driven Fraud Detection |
| **Repository** | `sujayhegde23/Bank-Management-System` |
| **Working Branch** | `feature/fraud-phase-3-integration` |
| **Execution Date** | November 8, 2026 |
| **Testing Standard** | IEEE Std 829-2008 (Test Summary Report) |
| **Harness / Runner** | Node.js native test runner (`node:test`) & Supertest `^7.0.0` |
| **Node.js Version** | v24.16.0 |
| **Related Documents** | [Test Plan](../phase1/test_plan.md), [Test Cases](../phase1/test_cases.md), [RTM](../phase1/rtm.md), [System Validation Report](system_validation_report.md), [Code Coverage Report](code_coverage_report.md), [Branch Coverage Report](branch_coverage_report.md) |

---

## 1. Executive Summary

A formal automated test execution run of all backend integration and unit test suites was conducted on branch `feature/fraud-phase-3-integration`.

The backend automated test harness executed **28 test suites** encompassing **638 automated test cases**. Of these:
- **637 tests passed** (**99.84% pass rate**)
- **1 test failed** (**0.16% failure rate**)
- **0 tests skipped / todo / cancelled**
- **Execution Duration:** **55.17 seconds**

Frontend verification was conducted via dedicated static code analysis and production build compilation:
- Static analysis (`oxlint`) evaluated 104 lint rules across 19 React modules in **279ms**, reporting **0 errors** and 11 non-blocking stylistic warnings.
- Production bundling (`vite build`) compiled 47 modules into deployable static assets in **831ms** with **0 compilation errors**.
- *Important:* Frontend linting and bundling verify code hygiene and bundle integrity, but do not replace functional UI and accessibility validation, which is tracked separately as pending manual walkthrough ([TC-21](../phase1/test_cases.md#tc-21--role-specific-ui-navigation--accessibility)).

The single failing test occurred in `tests/fraudPipelineBugInvestigation.test.js:237`. The failure has been thoroughly audited: the test author asserted a risk score of 30 expecting only the `HIGH_AMOUNT` rule in isolation, but the test fixture used an unseeded beneficiary account, legitimately triggering `NEW_BENEFICIARY` (weight 25) as well, resulting in an accumulated score of 55 (`MEDIUM` risk, decision `REVIEW_REQUIRED`). The failure remains formally recorded as **FAILED** until the test assertion or fixture is addressed in an authorized development cycle.

---

## 2. Testing Environment & Execution Profile

### 2.1 Hardware and Runtime Infrastructure
- **Operating System:** Microsoft Windows 11 Enterprise (x64)
- **Node.js Runtime:** v24.16.0 (native `node:test` runner with `--experimental-test-coverage`)
- **Relational Datastore:** MySQL Community Server 8.0.x running locally on port 3306 (InnoDB ACID storage engine)
- **Document Datastore:** MongoDB Community Server 7.0.x running locally on port 27017 (with JSON Schema validators and compound indexes)
- **Frontend Tooling:** Vite 5.x (Rollup bundler), Oxlint (Rust-based AST linter)

### 2.2 Execution Commands

```bash
# 1. Deterministic Baseline Fixture Reset
npm --prefix backend run db:clean:transactions
# Purges transient outbox events and past transactions, restores 4 baseline accounts (ACC-T1 to ACC-T4), and clears MongoDB assessments

# 2. Complete Backend Automated Test Suite Execution
npm --prefix backend test
# Executed command: node --test --test-concurrency=1 tests/**/*.test.js

# 3. Frontend Static Analysis & Linting
npm --prefix frontend run lint
# Executed command: oxlint

# 4. Frontend Production Bundle Compilation
npm --prefix frontend run build
# Executed command: vite build
```

---

## 3. Automated Test Execution Metrics

> [!IMPORTANT]
> Backend automated test counts and frontend static verification checks are distinct activities and are not combined.

### 3.1 Backend Automated Test Results

| Execution Metric | Empirical Result | Proportion |
|---|:---:|:---:|
| **Total Backend Test Suites** | 28 suites | 100.0% |
| **Total Automated Test Cases** | 638 tests | 100.0% |
| **Passed Tests** | **637 tests** | **99.84%** |
| **Failed Tests** | **1 test** | **0.16%** |
| **Skipped Tests** | 0 tests | 0.00% |
| **Todo / Cancelled Tests** | 0 tests | 0.00% |
| **Total Execution Duration** | **55.17 seconds** | — |

### 3.2 Frontend Static Quality & Build Metrics

| Verification Gate | Command | Files / Modules Evaluated | Errors | Warnings | Result |
|---|---|:---:|:---:|:---:|:---:|
| **Static Code Analysis** | `oxlint` | 19 React JSX modules | **0** | 11 non-blocking | **PASS (Clean)** |
| **Production Build** | `vite build` | 47 bundled modules | **0** | 0 | **PASS (Clean)** |

---

## 4. Test Suite Execution Breakdown (All 28 Backend Suites)

| # | Test Suite File (`backend/tests/`) | Target Requirements & Focus Domain | Executed | Passed | Failed | Suite Status |
| :-: | :--- | :--- | :-: | :-: | :-: | :---: |
| 1 | `health.test.js` | Diagnostics, System Health & Telemetry (NFR-05) | 5 | 5 | 0 | **PASSED** |
| 2 | `auth.test.js` | User Authentication, Password Hashing, Session Management (FR-01, FR-02, FR-03, NFR-01) | 21 | 21 | 0 | **PASSED** |
| 3 | `customers.test.js` | Customer Registration, Profile Updates (FR-04, FR-05, FR-06, NFR-04) | 30 | 30 | 0 | **PASSED** |
| 4 | `customerOverview.test.js` | Customer Dashboard Overview & Ownership Boundaries (FR-09) | 15 | 15 | 0 | **PASSED** |
| 5 | `customerAccountIsolation.test.js` | Horizontal Data Isolation & IDOR Defense (NFR-01, NFR-03) | 25 | 25 | 0 | **PASSED** |
| 6 | `customerBalanceDisplay.test.js` | Real-time Balance Clarity & Frozen Visibility (FR-11) | 24 | 24 | 0 | **PASSED** |
| 7 | `customerProfileSecurity.test.js` | Profile Security & System Diagnostics Protection (NFR-01, NFR-03) | 11 | 11 | 0 | **PASSED** |
| 8 | `accounts.test.js` | Account Creation, Number Gen, Status Management (FR-07, FR-08, FR-09, FR-10) | 42 | 42 | 0 | **PASSED** |
| 9 | `transactions.test.js` | Deposits, Withdrawals, Overdraft Rejection (FR-12, FR-13, FR-14, FR-18) | 30 | 30 | 0 | **PASSED** |
| 10 | `transactionReceipts.test.js` | Transaction Digital Receipt Generation & Audit (FR-12, FR-13, NFR-10) | 10 | 10 | 0 | **PASSED** |
| 11 | `transfers.test.js` | Fund Transfers, Balance Checks, Two-Phase Update (FR-15, FR-16, FR-17) | 33 | 33 | 0 | **PASSED** |
| 12 | `secureTransfers.test.js` | Beneficiary Verification & Privacy Masking (FR-15, FR-16, FR-17) | 27 | 27 | 0 | **PASSED** |
| 13 | `history.test.js` | Transaction History Pagination & Filtering (FR-20, FR-21, NFR-06) | 25 | 25 | 0 | **PASSED** |
| 14 | `accountStatements.test.js` | Monthly Statement Generation & Math Verification (FR-19, FR-20, NFR-17) | 15 | 15 | 0 | **PASSED** |
| 15 | `dashboard.test.js` | Admin Executive Dashboard Overview (FR-25, NFR-03) | 15 | 15 | 0 | **PASSED** |
| 16 | `reports.test.js` | Administrative Summary Reports & Performance Benchmarks (FR-25, NFR-06, NFR-07) | 16 | 16 | 0 | **PASSED** |
| 17 | `reportExports.test.js` | RFC 4180 CSV Export & Formula Injection Defense (FR-25, NFR-01) | 24 | 24 | 0 | **PASSED** |
| 18 | `audit.test.js` | Centralized Audit Logging & Immutability (NFR-02, NFR-03, NFR-10) | 27 | 27 | 0 | **PASSED** |
| 19 | `employeeConsole.test.js` | Staff Operations Console & Status Toggling (FR-09, FR-10) | 10 | 10 | 0 | **PASSED** |
| 20 | `employeeActivity.test.js` | Employee Personal Activity History Isolation (FR-23, NFR-01) | 20 | 20 | 0 | **PASSED** |
| 21 | `employees.test.js` | Admin Employee CRUD & Mid-Session Revocation (FR-23, FR-24, NFR-02) | 53 | 53 | 0 | **PASSED** |
| 22 | `mongoFoundation.test.js` | MongoDB Collections, JSON Validators & Indexes (UC-27 to UC-31) | 9 | 9 | 0 | **PASSED** |
| 23 | `fraudEngine.test.js` | 4 Fraud Rules, Risk Scoring (0–100), Thresholds (UC-27, UC-28, UC-30) | 28 | 28 | 0 | **PASSED** |
| 24 | `fraudOutboxIntegration.test.js` | Outbox Staging, Worker Leasing, Heartbeat, Backoff (UC-27, NFR-09) | 28 | 28 | 0 | **PASSED** |
| 25 | `fraudDashboard.test.js` | Fraud Dashboard, Case Workflows, Rule Config (UC-29, UC-30, UC-31) | 44 | 44 | 0 | **PASSED** |
| 26 | `fraudAlertPolicyCorrection.test.js`| Alert-on-Triggered-Rule Policy Guarantee (UC-27) | 13 | 13 | 0 | **PASSED** |
| 27 | `fraudPipelineBugInvestigation.test.js`| Paise Precision, Sliding Window & Multi-Rule Boundary Tests | 18 | 17 | 1 | **FAILED (1 failure)** |
| 28 | `fraudRegressionDebugging.test.js`| End-to-End Banking-to-Fraud Integration Regression (12 Points) | 12 | 12 | 0 | **PASSED** |
| **Total** | **28 Automated Test Suites** | **Complete System Verification Scope** | **638** | **637** | **1** | **99.84% Pass Rate** |

---

## 5. Detailed Audit of the Failed Test

Exactly 1 test out of 638 failed during automated suite execution:

### 5.1 Test Failure Identification
- **Test Suite File:** `backend/tests/fraudPipelineBugInvestigation.test.js`
- **Location:** Line 237 (Suite block: `describe('3. Integration, Outbox Worker & Alert Generation')`)
- **Test Title:** `"Large transfer triggers HIGH_AMOUNT and persists risk assessment with decision REVIEW_REQUIRED"`
- **Failure Type:** `AssertionError [ERR_ASSERTION]: Risk score must be 30 for single large transfer`
- **Measured Values:** `actual: 55 !== expected: 30` (Operator: `strictEqual`)

### 5.2 Failure Execution Context
```javascript
// backend/tests/fraudPipelineBugInvestigation.test.js:237-268
it('Large transfer triggers HIGH_AMOUNT and persists risk assessment with decision REVIEW_REQUIRED', async () => {
  const intTxId = TEST_BASE_ID + 30;
  await query(
    `INSERT INTO bank_transactions
     (transaction_id, transaction_ref, type, amount, source_account_id, destination_account_id, performed_by_user_id, remarks, created_at)
     VALUES (?, ?, 'TRANSFER', 60000.00, 1, 184, 4, 'Integration ₹60,000 transfer', NOW())`,
    [intTxId, `TXN-INT-${intTxId}`]
  );
  createdTxnIds.push(intTxId);

  // Outbox event creation and batch processing
  const outboxRes = await query(
    `INSERT INTO fraud_outbox_events (transaction_id, event_type, payload, status)
     VALUES (?, 'TRANSFER', ?, 'PENDING')`,
    [intTxId, JSON.stringify({ transactionId: intTxId, amount: '60000.00', accountId: 1 })]
  );
  createdOutboxIds.push(outboxRes.insertId);

  const worker = new FraudOutboxWorker({ pollIntervalMs: 5000, batchSize: 5 });
  await worker.processBatch();

  const assessment = await mongoDb.collection('transaction_risk_assessments').findOne({ transactionId: intTxId });
  assert.ok(assessment, 'Assessment must be persisted in MongoDB');
  assert.equal(assessment.amount, 6000000, 'Amount must be 6,000,000 paise');
  assert.equal(assessment.riskScore, 30, 'Risk score must be 30 for single large transfer'); // <--- FAILED HERE (55 !== 30)
  assert.equal(assessment.riskLevel, 'MEDIUM');
  assert.equal(assessment.decision, 'REVIEW_REQUIRED');
});
```

### 5.3 Detailed Technical Breakdown

1. **What the Test Actually Demonstrates:**  
   The test demonstrates that when a transfer of ₹60,000 is staged into the outbox and processed by `FraudOutboxWorker`, the asynchronous fraud engine executes, constructs transaction context via `buildTransactionContext()`, evaluates active rules, persists a document in `transaction_risk_assessments` with paise amount `6000000`, assigns riskLevel `MEDIUM` and decision `REVIEW_REQUIRED`, and generates a corresponding alert in `fraud_alerts`.
2. **Why the Assertion Failed:**  
   Line 265 strictly asserted `assessment.riskScore === 30`. The test author expected only the `HIGH_AMOUNT` rule (weight 30) to trigger. However, the risk scoring service computed a total score of **55** ($30 + 25 = 55$).
3. **Fixture vs. Scenario Inconsistency:**  
   The test fixture inserted a transfer from Account 1 to Account 184 (`destination_account_id = 184`). Because Account 184 had no prior recorded transfers from Account 1 in the test database, `buildTransactionContext()` identified this recipient as a new beneficiary (`priorTransfers === 0`). Consequently, the engine evaluated two rules:
   - `HIGH_AMOUNT`: ₹60,000.00 > ₹50,000.00 threshold -> **Triggered (+30 points)**.
   - `NEW_BENEFICIARY`: Transfer to first-time recipient -> **Triggered (+25 points)**.
   The resulting score was $30 + 25 = 55$. Under the active risk boundaries (MEDIUM: 30–59), a score of 55 correctly maps to `MEDIUM` risk and decision `REVIEW_REQUIRED`. If the author intended to test `HIGH_AMOUNT` in isolation, the fixture should have pre-seeded an earlier transfer to Account 184 to establish beneficiary history; if the author intended to test a transfer to an unseeded account, the assertion should have expected 55.
4. **Possibility of Application Defect:**  
   While the rule engine operated in strict accordance with its active rule definitions and context provider logic, the failure indicates that the test harness and integration worker lack a mechanism to isolate specific rules in integration scenarios without pre-seeding cross-table relational context. A potential application defect or design gap also remains possible: specifically, whether the outbox payload's supplied metadata should explicitly govern rule evaluation scope or whether the context provider should filter out test transactions.
5. **Resolution Status:**  
   Per test integrity standards, this test remains recorded as **FAILED**. It must not be masked, suppressed, or altered without an authorized development issue and clean regression re-execution.

---

## 6. Active Fraud Engine Configuration Verified from Source

The active fraud rule definitions, calibrated weights, and scoring thresholds were verified directly against `backend/src/config/initMongo.js` and `backend/src/services/fraud/riskScoringService.js`:

### 6.1 Calibrated Fraud Rule Parameters

| Rule Code | Display Name | Enabled | Trigger Condition | Threshold / Window | Weight |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **`HIGH_AMOUNT`** | Unusually High Transaction Amount | `true` | `amount > rule.threshold` (strict inequality in integer paise) | ₹50,000.00 (`5000000` paise) | **30** |
| **`HIGH_VELOCITY`** | High-Velocity Transaction Frequency | `true` | `txnCount > rule.threshold` within rolling window | `> 3` transactions within `windowMinutes: 2` | **25** |
| **`NEW_BENEFICIARY`** | First-Time Beneficiary Transfer | `true` | Applies strictly to `TRANSFER`; triggers when recipient has 0 prior transfers from sender | `priorTransfers === 0` | **25** |
| **`UNUSUAL_HOUR`** | Unusual Banking Hour Activity | `true` | Transaction executed during configured off-hours | `[01:00, 05:00)` half-open window in `'Asia/Kolkata'` timezone | **20** |
| **Total Weight** | **4 Deterministic Rules** | — | — | — | **100** |

### 6.2 Risk Score Aggregation & Classification Boundaries

- **Aggregation Formula:** $	ext{riskScore} = \min\left(100, \max\left(0, \sum 	ext{triggeredRuleWeights}ight)ight)$
- **Classification Tiers & Policy Decisions (`riskScoringService.js`):**
  - **`LOW` (0 to 29 points):** Decision: `APPROVED`
  - **`MEDIUM` (30 to 59 points):** Decision: `REVIEW_REQUIRED`
  - **`HIGH` (60 to 79 points):** Decision: `FLAGGED`
  - **`CRITICAL` (80 to 100 points):** Decision: `FLAGGED`
- **Alert Generation Policy (`fraudDetectionService.js` & `tests/fraudAlertPolicyCorrection.test.js`):**  
  An alert document is generated in MongoDB `fraud_alerts` **if and only if** at least one rule triggers (`triggeredRules.length > 0`) OR the assessment risk level is `HIGH` or `CRITICAL`. Clean transactions (0 rules triggered, score 0, LOW risk) save an assessment with decision `APPROVED`, but **do not generate an alert**. Multiple triggered rules generate **exactly one** consolidated alert.

---

## 7. Limitations & Outstanding Work

1. **Pending Self-Service Password Change Endpoint ([TC-17](../phase1/test_cases.md#tc-17--self-service-customer-password-change) / FR-22):**  
   While password security (salted bcrypt `$2b$10$...`) is verified via TC-09, profile updating is verified via TC-20/TC-27, and administrative employee password resetting is verified via TC-18, the customer self-service endpoint `POST /api/auth/change-password` has not been implemented. FR-22 remains **Partially Validated / Pending Implementation**.
2. **High-Concurrency Multi-User Load Testing ([TC-11](../phase1/test_cases.md#tc-11--reporting-performance--aggregation-efficiency) / NFR-07):**  
   Automated integration tests verified single-thread query performance (<25ms aggregation) and outbox worker lease concurrency (`FOR UPDATE SKIP LOCKED`). However, formal multi-user stress testing at scale (e.g. 100 concurrent threads / 10,000 transactions via JMeter/k6) has not been executed and remains scheduled for Sprint 2. NFR-07 is **Partially Validated**.
3. **Frontend UI Functional & Accessibility Validation ([TC-21](../phase1/test_cases.md#tc-21--role-specific-ui-navigation--accessibility) / NFR-11, NFR-13):**  
   `frontend/package.json` contains no browser automation runner (Playwright/Cypress). Oxlint (0 errors) and Vite build (0 errors) verify static syntax and bundling, but do not validate UI navigation depth or WCAG contrast compliance. TC-21 remains **Pending Manual Walkthrough**.

---

## 8. Conclusion

The automated test execution demonstrates robust backend reliability:
- **637 out of 638 automated tests passed** (99.84% pass rate).
- Core banking ledger workflows (deposits, withdrawals, transfers, account creation, and statements) executed with zero failures.
- The dual-datastore transactional outbox pipeline and rule engine operated reliably across all integration scenarios.
- One test failure in `fraudPipelineBugInvestigation.test.js` is documented and tracked for development resolution.
