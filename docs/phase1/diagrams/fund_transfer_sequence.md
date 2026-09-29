# Sequence Diagram — Fund Transfer

**Use case:** UC-04 (Transfer Funds)

**Requirements supported:** FR-11, FR-15, FR-16, FR-17, FR-18, FR-19, NFR-03,
NFR-04, NFR-07, NFR-08, NFR-09, NFR-17

**Planned API:** `POST /api/transfers` (see
[API Design](../architecture_design.md#9-api-design))

This diagram describes the planned fund transfer flow. It assumes that the
Authentication & Authorization Service has already confirmed a valid session and
the `CUSTOMER` role before the request reaches the Transaction Service (see
[login sequence](login_sequence.md) and
[Security Architecture](../architecture_design.md#6-security-architecture)).

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant UI as Web User Interface
    participant TXN as Transaction Service
    participant ACC as Account Service
    participant DAL as Data Access Layer
    participant DB as Relational Database

    C->>UI: Select source account, enter receiver account number and amount
    UI->>UI: Check required fields and amount > 0
    UI->>TXN: Transfer request (sourceAccountId, receiverAccountNumber, amount)

    TXN->>TXN: Validate input: amount > 0, max 2 decimal places,<br/>receiver different from sender (NFR-04)
    alt Invalid input
        TXN-->>UI: Failure: VAL_001 / TXN_002
        UI-->>C: Show validation error (NFR-12)
    else Input valid
        TXN->>ACC: Check sender account (sourceAccountId, customerId)
        ACC->>DAL: findAccountById(sourceAccountId)
        DAL->>DB: SELECT sender account
        DB-->>DAL: Sender account
        DAL-->>ACC: Sender account
        ACC-->>TXN: Owner and status of sender account

        TXN->>ACC: Check receiver account (receiverAccountNumber)
        ACC->>DAL: findAccountByNumber(receiverAccountNumber)
        DAL->>DB: SELECT receiver account
        DB-->>DAL: Receiver account or no result
        DAL-->>ACC: Receiver account or not found
        ACC-->>TXN: Receiver status or not found

        alt Sender account not owned by this customer (NFR-03)
            TXN-->>UI: Failure: AUTH_002 "Unauthorized operation"
            UI-->>C: Show error
        else Invalid recipient (receiver account not found)
            TXN-->>UI: Failure: ACC_002 "Account not found"
            UI-->>C: Show error
        else Sender or receiver frozen / inactive (FR-11)
            TXN-->>UI: Failure: ACC_001 "Account frozen or inactive"
            UI-->>C: Show error
        else Both accounts valid and active
            TXN->>DAL: Begin database transaction
            DAL->>DB: BEGIN
            DAL->>DB: SELECT both accounts FOR UPDATE<br/>(lock in ascending account ID order)
            DB-->>DAL: Locked balances and current status
            DAL-->>TXN: Sender balance, both statuses

            alt Sender balance < amount (FR-16)
                TXN->>DAL: Roll back
                DAL->>DB: ROLLBACK
                TXN-->>UI: Failure: TXN_001 "Insufficient balance"
                UI-->>C: Show error, balances unchanged
            else Status changed to frozen / inactive since the first check (FR-11)
                TXN->>DAL: Roll back
                DAL->>DB: ROLLBACK
                TXN-->>UI: Failure: ACC_001 "Account frozen or inactive"
                UI-->>C: Show error, balances unchanged
            else Sufficient balance
                TXN->>DAL: Debit sender by amount (FR-17)
                DAL->>DB: UPDATE sender balance
                TXN->>DAL: Credit receiver by amount (FR-17)
                DAL->>DB: UPDATE receiver balance
                TXN->>TXN: Generate unique transaction ID (FR-18)
                TXN->>DAL: Create transaction record (FR-19)
                DAL->>DB: INSERT transaction record

                alt Any database step fails (NFR-09)
                    DB-->>DAL: Error
                    DAL->>DB: ROLLBACK
                    DAL-->>TXN: Failure
                    TXN->>TXN: Log failure without sensitive data
                    TXN-->>UI: Failure: TXN_003 "Transaction failed"
                    UI-->>C: Show error, no partial update
                else All steps succeed
                    DAL->>DB: COMMIT
                    DB-->>DAL: Committed
                    DAL-->>TXN: Success
                    TXN-->>UI: Success: transaction ID, amount,<br/>new sender balance, timestamp
                    UI-->>C: Show transfer confirmation
                end
            end
        end
    end
```

## Notes

1. **Atomicity (NFR-09, NFR-17):** The debit, the credit and the transaction record
   are written inside one database transaction. They are either all committed or
   all rolled back, so a balance can never be left partially updated.
2. **Balance check under lock (FR-16, NFR-08):** The final balance and status
   checks happen after the account rows are locked. Two simultaneous transfers
   from the same account therefore cannot both spend the same money.
3. **Deadlock avoidance:** Both account rows are always locked in the same order
   (ascending account ID), whichever account is sending.
4. **Status checked twice (FR-11):** The early status check gives the customer a
   quick error message. The second check, under lock, handles the case where an
   employee freezes an account while a transfer is in progress.
5. **Transaction record (FR-18, FR-19):** A transaction record is only created for
   a completed transfer, and it is committed together with the balance changes.
6. **Performance (NFR-07):** The whole flow is expected to complete within
   5 seconds under the conditions defined in the SRS.
