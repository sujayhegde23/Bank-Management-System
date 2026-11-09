# Sequence Diagram 2: Asynchronous Fraud Detection (Outbox Pipeline)

**Requirements supported:** FR-19, FR-21, NFR-03, NFR-08, NFR-09, NFR-10, NFR-14, NFR-18  
**Use cases supported:** UC-27, UC-28, UC-30, UC-31  

This diagram depicts the asynchronous background fraud detection pipeline. The background worker polls MySQL using lease-based row locking (`SKIP LOCKED`), extracts historical banking context, evaluates configurable MongoDB fraud rules, persists risk assessments and alerts, and updates outbox status with exponential backoff retry support.

```mermaid
sequenceDiagram
    autonumber
    participant W as Fraud Outbox Worker
    participant OR as Outbox Repository
    participant MY as MySQL Database (InnoDB)
    participant CTX as Transaction Context Provider
    participant ENG as Fraud Detection Engine
    participant RR as Fraud Rule Repository
    participant MG as MongoDB Database (bank_fraud_detection)

    Note over W: Worker polling loop triggers (pollInterval = 5000ms)
    W->>OR: claimEvents({ workerId, batchSize: 10, leaseSeconds: 60 })
    OR->>MY: START TRANSACTION
    OR->>MY: SELECT event_id, transaction_id, ... FROM fraud_outbox_events<br/>WHERE (status='PENDING' AND next_attempt_at <= NOW())<br/>OR (status='PROCESSING' AND locked_at < NOW() - INTERVAL 60s)<br/>ORDER BY next_attempt_at ASC LIMIT 10 FOR UPDATE SKIP LOCKED
    MY-->>OR: Claimed eligible event rows
    OR->>MY: UPDATE fraud_outbox_events SET status='PROCESSING', locked_at=NOW(),<br/>locked_by=workerId, attempt_count=attempt_count+1 WHERE event_id IN (...)
    OR->>MY: COMMIT (Releases MySQL row locks immediately)
    OR-->>W: Return array of claimed event objects

    loop For each claimed outbox event
        Note over W: Start active heartbeat lease renewal timer (every lease/3 = 20s)
        
        W->>CTX: buildTransactionContext(event.transactionId)
        CTX->>MY: SELECT * FROM bank_transactions WHERE transaction_id = ?
        MY-->>CTX: Core transaction details (amount, accountId, customerId, timestamp)
        CTX->>MY: SELECT COUNT(*) FROM bank_transactions WHERE (source_account_id = ? OR destination_account_id = ?)<br/>AND created_at >= (tx.created_at - INTERVAL 2 MINUTE)
        MY-->>CTX: Recent velocity transaction count (all account transactions)
        CTX->>MY: SELECT COUNT(*) FROM bank_transactions WHERE type = 'TRANSFER' AND source_account_id = ?<br/>AND destination_account_id = ? AND transaction_id < ?
        MY-->>CTX: Prior beneficiary transfer count
        CTX-->>W: Return { transaction, context: { recentTransactionCount, isNewBeneficiary } }

        W->>ENG: evaluateTransaction(transaction, context)
        
        ENG->>RR: getEnabledRules({ forceRefresh: false })
        RR->>RR: Check in-memory rule cache
        alt Cache Miss / Expired
            RR->>MG: db.fraud_rules.find({ enabled: true })
            MG-->>RR: Active rule documents (HIGH_AMOUNT, HIGH_VELOCITY, NEW_BENEFICIARY, UNUSUAL_HOUR)
            RR->>RR: Cache active rules in memory
        end
        RR-->>ENG: Return enabled rules list with calibrated weights

        Note over ENG: Evaluate Rules Sequentially against Transaction & Context
        ENG->>ENG: Evaluate HIGH_AMOUNT: amount > threshold (5,000,000 paise = ₹50,000)
        ENG->>ENG: Evaluate HIGH_VELOCITY: recentCount > threshold (3 tx in 2 min)
        ENG->>ENG: Evaluate NEW_BENEFICIARY: isNewBeneficiary === true (0 prior transfers)
        ENG->>ENG: Evaluate UNUSUAL_HOUR: tx hour in 01:00-05:00 IST
        
        ENG->>ENG: calculateRiskScore(triggeredRules): Sum weights capped at 100
        ENG->>ENG: classifyRiskLevel(riskScore): LOW (0-29), MEDIUM (30-59), HIGH (60-79), CRITICAL (80-100)
        ENG->>ENG: determineDecision(riskLevel): Post-Tx Classification (APPROVED, REVIEW_REQUIRED, FLAGGED)

        ENG->>MG: db.transaction_risk_assessments.updateOne({ transactionId }, { $setOnInsert: assessment }, { upsert: true })
        MG-->>ENG: Assessment persisted idempotently (uniq_assessment_transaction_id)

        alt Triggered Rules > 0 OR Risk Level in (HIGH, CRITICAL)
            ENG->>MG: db.fraud_alerts.updateOne({ transactionId }, { $setOnInsert: alert }, { upsert: true })
            MG-->>ENG: Fraud alert persisted idempotently (uniq_alert_transaction_id)
        end
        ENG-->>W: Return { assessment, alert, triggeredRules }

        alt Evaluation & Persistence Successful
            W->>OR: markEventCompleted({ eventId, workerId })
            OR->>MY: UPDATE fraud_outbox_events SET status='COMPLETED', processed_at=NOW(),<br/>locked_at=NULL, locked_by=NULL, error_message=NULL<br/>WHERE event_id = ? AND locked_by = workerId AND status = 'PROCESSING'
            MY-->>OR: Event marked COMPLETED
            Note over W: Stop heartbeat timer
        else Processing Failure (e.g., MongoDB Connectivity Issue)
            Note over W: Worker catches error and classifies (transient vs permanent)
            W->>OR: markEventFailed({ eventId, workerId, error, attemptCount, maxAttempts: 5 })
            alt Transient Error & attemptCount < 5
                Note over OR,MY: Calculate exponential backoff delay [0s, 30s, 2m, 10m, 30m]
                OR->>MY: UPDATE fraud_outbox_events SET status='PENDING',<br/>next_attempt_at = NOW() + INTERVAL delay SECOND, locked_at=NULL, locked_by=NULL,<br/>last_error=sanitizedError WHERE event_id = ? AND locked_by = workerId AND status = 'PROCESSING'
            else Permanent Error OR attemptCount >= 5
                OR->>MY: UPDATE fraud_outbox_events SET status='FAILED',<br/>locked_at=NULL, locked_by=NULL, last_error=sanitizedError<br/>WHERE event_id = ? AND locked_by = workerId AND status = 'PROCESSING'
            end
            MY-->>OR: Failure status recorded
            Note over W: Stop heartbeat timer
        end
    end
```

## Architectural Highlights
1. **Decoupled Resilience:** Banking transactions commit in MySQL independently of MongoDB availability. Even if MongoDB is completely offline, banking transactions succeed and events accumulate safely in `fraud_outbox_events`.
2. **Concurrency Safety (`FOR UPDATE SKIP LOCKED`):** Multiple background workers can operate concurrently on different nodes without contention or redundant processing.
3. **Lease Heartbeat & Crash Recovery:** If a worker node crashes mid-evaluation, its lease expires after 60 seconds, and another worker claims the event automatically.
4. **Idempotent Persistence:** Unique compound indexes in MongoDB (`uniq_assessment_transaction_id`, `uniq_alert_transaction_id`) guarantee that worker retries never duplicate risk assessments or alerts.
5. **Sanitized Error Logging:** Connection strings, database credentials, and secrets are systematically redacted from `last_error` before storage in MySQL.
6. **Stale Worker Protection:** Status updates enforce `WHERE event_id = ? AND locked_by = workerId AND status = 'PROCESSING'`. If a worker loses its lease due to timeout or network latency, it cannot overwrite or corrupt a subsequent worker's claim.
