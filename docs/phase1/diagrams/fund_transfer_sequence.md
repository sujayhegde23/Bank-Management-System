# Sequence Diagram 1: Banking Transaction Processing (Fund Transfer)

**Use case:** UC-04 (Transfer Funds)  
**Requirements supported:** FR-11, FR-15, FR-16, FR-17, FR-18, FR-19, NFR-03, NFR-04, NFR-07, NFR-08, NFR-09, NFR-10, NFR-17, NFR-18  
**Implemented API:** `POST /api/transfers` (or `POST /api/transactions/transfer`)  

This diagram depicts the synchronous banking transaction execution flow. The fund transfer updates both account balances, inserts an immutable ledger entry, and stages a transactional outbox event into MySQL within a single atomic database transaction. Downstream fraud evaluation is decoupled and asynchronous; it is not a synchronous prerequisite for banking transaction success.

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant UI as Web User Interface (React)
    participant API as Express API & RBAC
    participant TXN as Transaction Service
    participant ACC as Account Service
    participant DAL as MySQL Data Access Layer
    participant DB as MySQL Database (InnoDB)

    C->>UI: Select source account, enter recipient account number and amount
    UI->>UI: Client-side validation: amount > 0, required fields present
    UI->>API: POST /api/transfers (sourceAccountId, destinationAccountNumber, amount)
    
    API->>API: requireAuth: Validate session cookie (bms.sid)
    API->>API: requireRole('CUSTOMER'): Verify permitted role
    API->>TXN: executeTransfer(user, sourceAccountId, destinationAccountNumber, amount)

    TXN->>TXN: Server-side validation: amount > 0, max 2 decimals, source != destination
    
    TXN->>ACC: Verify source account ownership (customerId)
    ACC->>DAL: findAccountById(sourceAccountId)
    DAL->>DB: SELECT * FROM accounts WHERE account_id = ?
    DB-->>DAL: Source account record
    DAL-->>ACC: Source account record
    ACC-->>TXN: Account ownership and current status

    TXN->>ACC: Look up destination account by number
    ACC->>DAL: findAccountByNumber(destinationAccountNumber)
    DAL->>DB: SELECT * FROM accounts WHERE account_number = ?
    DB-->>DAL: Destination account record (or NULL)
    DAL-->>ACC: Destination account record
    ACC-->>TXN: Destination account details

    TXN->>DAL: withTransaction(async conn => ...)
    DAL->>DB: START TRANSACTION

    Note over TXN,DB: Lock accounts in ascending ID order to prevent deadlocks
    DAL->>DB: SELECT * FROM accounts WHERE account_id IN (src, dst) FOR UPDATE
    DB-->>DAL: Locked account rows with current balances and statuses

    alt Either Account FROZEN or INACTIVE (FR-11)
        TXN->>DAL: Rollback transaction
        DAL->>DB: ROLLBACK
        TXN-->>API: Reject with ACC_001 (Account frozen or inactive)
        API-->>UI: 409 Conflict
        UI-->>C: Display account restriction error
    else Source Balance < Amount (FR-14, FR-16)
        TXN->>DAL: Rollback transaction
        DAL->>DB: ROLLBACK
        TXN-->>API: Reject with TXN_001 (Insufficient balance)
        API-->>UI: 422 Unprocessable Entity
        UI-->>C: Display insufficient balance - balances unchanged
    else Sufficient Balance and Both Accounts Active
        TXN->>DAL: UPDATE accounts SET balance = balance - amount WHERE account_id = src
        DAL->>DB: UPDATE source account balance (FR-17)
        TXN->>DAL: UPDATE accounts SET balance = balance + amount WHERE account_id = dst
        DAL->>DB: UPDATE destination account balance (FR-17)

        TXN->>TXN: generateUniqueTransactionRef('TRANSFER') (FR-18)
        TXN->>DAL: INSERT INTO bank_transactions (...)
        DAL->>DB: INSERT immutable ledger record (FR-19)

        Note over TXN,DB: Stage Outbox Event within the SAME MySQL transaction
        TXN->>DAL: recordOutboxEvent(conn, { transactionId, eventType: 'TRANSFER', payload })
        DAL->>DB: INSERT INTO fraud_outbox_events (transaction_id, event_type, payload, status: 'PENDING')
        
        alt Database Operation Failure (NFR-09)
            DB-->>DAL: SQL error or constraint violation
            DAL->>DB: ROLLBACK
            TXN-->>API: Throw TXN_003 (Transaction failed)
            API-->>UI: 500 Internal Server Error
            UI-->>C: Display failure message - zero balance changes
        else All Operations Succeed
            DAL->>DB: COMMIT
            DB-->>DAL: Transaction committed successfully
            TXN-->>API: Return transaction details
            API-->>UI: 201 Created
            UI-->>C: Display transfer confirmation modal with new balance
        end
    end
```

## Architectural Highlights
1. **Financial Source of Truth (NFR-08):** MySQL is the sole authoritative authority for account balances.
2. **Atomicity and Consistency (NFR-09, NFR-17):** Balance debits, balance credits, immutable ledger entries, and outbox event records are committed together in one atomic MySQL transaction. If any step fails, `ROLLBACK` executes, leaving zero balance modifications and zero orphan outbox events.
3. **Deadlock Prevention:** Account rows are locked in ascending `account_id` order regardless of transfer direction.
4. **Decoupled Outbox Staging:** Staging the event in `fraud_outbox_events` avoids dual-write hazards and eliminates synchronous dependency on MongoDB availability, keeping transaction execution within design performance targets.
