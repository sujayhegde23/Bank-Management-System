# Sequence Diagram — User Login

**Use cases:** UC-01 (Customer Login), UC-08 (Employee Login), UC-19 (Administrator Login)

**Requirements supported:** FR-01, FR-03, NFR-01, NFR-02, NFR-05, NFR-12

**Planned API:** `POST /api/auth/login` (see
[API Design](../architecture_design.md#9-api-design))

This diagram describes the planned login flow for all three actors. The session
mechanism (server-side session or token) has not yet been selected, so it is
shown generically as an "authenticated session".

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Customer / Employee / Administrator)
    participant UI as Web User Interface
    participant AUTH as Authentication & Authorization Service
    participant DAL as Data Access Layer
    participant DB as Relational Database

    User->>UI: Enter username and password
    UI->>UI: Check that both fields are filled in
    UI->>AUTH: Login request (username, password)
    AUTH->>AUTH: Validate input format (NFR-04)

    AUTH->>DAL: findUserByUsername(username)
    DAL->>DB: SELECT user record (parameterized query)
    DB-->>DAL: User record or no result
    DAL-->>AUTH: User (id, password hash, role, status) or not found

    AUTH->>AUTH: Hash entered password with stored salt and compare (NFR-01)<br/>(dummy comparison if user not found, so response time is similar)

    alt User not found OR password does not match
        AUTH-->>UI: Failure: AUTH_001 "Invalid username or password"
        UI-->>User: Show generic login error (NFR-12)
    else Password matches but user account is deactivated (FR-24)
        AUTH-->>UI: Failure: AUTH_001 "Invalid username or password"
        UI-->>User: Show generic login error
    else Password matches and user account is active
        AUTH->>AUTH: Identify role (CUSTOMER / EMPLOYEE / ADMIN) (FR-03)
        AUTH->>AUTH: Create authenticated session bound to user ID and role
        AUTH-->>UI: Success: session credential, user ID, role
        UI->>UI: Build role-specific navigation menu (NFR-11, NFR-13)
        UI-->>User: Show role-specific dashboard
    end
```

## Notes

1. **Generic error message:** An unknown username, a wrong password and a
   deactivated account all return the same `AUTH_001` message. This prevents an
   attacker from learning which usernames exist.
2. **Password handling:** The password is only compared with the stored salted
   hash. It is never stored in plain text, written to logs or returned in a
   response (NFR-01).
3. **Session:** After successful login, every later request carries the session
   credential. The Authentication & Authorization Service validates it and
   checks the user's role before any protected operation runs (NFR-02, NFR-05).
4. **Logout (FR-02):** Logout invalidates the session on the server, so the old
   session credential can no longer be used for protected operations.
