# Sequence Diagram — User Authentication and Session Management

**Use cases:** UC-01 (Customer Login), UC-08 (Employee Login), UC-19 (Administrator Login)  
**Requirements supported:** FR-01, FR-02, FR-03, FR-24, NFR-01, NFR-02, NFR-03, NFR-05, NFR-11, NFR-12, NFR-13  
**Implemented API:** `POST /api/auth/login` (see [API Design](../architecture_design.md#9-api-design))  

This diagram depicts the user authentication, security validation, and session creation sequence for all three system actors (Customer, Employee, Administrator). The system implements stateful server-side sessions stored in MySQL using `express-session`, issuing a cryptographically signed HTTP-only cookie (`bms.sid`).

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Customer / Employee / Admin)
    participant UI as Web User Interface (React + Vite)
    participant API as Express API & RBAC (routes/auth.js)
    participant AUD as Audit Service (audit_logs)
    participant DAL as MySQL Data Access Layer
    participant DB as MySQL Database (InnoDB)

    User->>UI: Enter username and password
    UI->>UI: Client validation: verify non-empty inputs
    UI->>API: POST /api/auth/login { username, password }
    API->>API: Validate input schema (VAL_001 if missing)

    API->>DAL: query("SELECT ... FROM users WHERE username = ?", [username])
    DAL->>DB: Parameterized SELECT on users table (NFR-01)
    DB-->>DAL: User row (user_id, password_hash, role, status) or empty
    DAL-->>API: User record or null

    alt User Not Found (Timing Attack Mitigation)
        API->>API: Compare with dummy bcrypt hash (neutralizes timing side-channels)
        API->>AUD: recordAuditEvent('LOGIN_FAILED', 'unknown user')
        API-->>UI: 401 Unauthorized: AUTH_001 "Invalid username or password"
        UI-->>User: Display generic authentication error (NFR-12)
    else User Found
        API->>API: bcrypt.compare(password, user.password_hash) (NFR-01)
        alt Password Mismatch
            API->>AUD: recordAuditEvent('LOGIN_FAILED', 'invalid password')
            API-->>UI: 401 Unauthorized: AUTH_001 "Invalid username or password"
            UI-->>User: Display generic authentication error (NFR-12)
        else Password Valid but Account INACTIVE (FR-24)
            API->>AUD: recordAuditEvent('LOGIN_FAILED', 'deactivated account')
            API-->>UI: 401 Unauthorized: AUTH_001 "Invalid username or password"
            UI-->>User: Display generic authentication error (NFR-12)
        else Password Valid and Account ACTIVE
            API->>DAL: Resolve display name from linked profile (customers / employees)
            DAL->>DB: SELECT full_name FROM customers/employees WHERE user_id = ?
            DB-->>DAL: Profile metadata
            DAL-->>API: Domain details (displayName, customerId, employeeId)
            
            API->>DB: Save session in sessions table (express-session)
            API->>AUD: recordAuditEvent('LOGIN_SUCCESS')
            API-->>UI: 200 OK + Set-Cookie: bms.sid (HttpOnly, SameSite)
            UI->>UI: Render role-specific navigation menu (NFR-11, NFR-13)
            UI-->>User: Redirect to role-specific dashboard (Customer, Employee, Admin)
        end
    end
```

## Architectural Highlights
1. **Timing Attack Mitigation (NFR-01):** When an unrecognised username is submitted, a dummy bcrypt comparison executes against a precomputed static hash. This equalizes execution latency, preventing malicious actors from enumerating valid usernames.
2. **Generic Error Disclosure (NFR-12):** Unknown usernames, incorrect passwords, and deactivated accounts all return identical HTTP 401 `AUTH_001` error envelopes.
3. **Stateful Session Architecture (MySQL Store):** Sessions are durably stored in the MySQL `sessions` table. The client receives an opaque, signed HTTP-only cookie (`bms.sid`). This allows instantaneous server-side session revocation when an employee account is deactivated (`FR-24`).
4. **Session Invalidation on Logout (FR-02):** Invoking `POST /api/auth/logout` explicitly destroys the session row in MySQL and clears the cookie, immediately preventing credential replay.
