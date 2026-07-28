# Flows

## 1. Screens

```mermaid
flowchart TD
    L[Login] --> R{Role?}

    R -->|staff| SD[My Shifts]
    R -->|manager| MD[Coverage Dashboard]

    SD --> SB[Browse Open Shifts]
    SB -->|claim| SB
    SD -->|unclaim| SD

    MD --> MW[Week view, jump to any week]
    MD --> MS[Create / Edit / Delete Shift]
    MD --> MA[Assign staff to a shift]
    MD --> MU[Upload CSV]
    MU --> MR[Import Report]
```

| Screen | Who |
|---|---|
| Login | everyone |
| Browse open shifts, claim | staff |
| My shifts, unclaim | staff |
| Coverage dashboard | manager |
| Shift create / edit form | manager |
| CSV upload | manager |
| Import report | manager |

Manager routes check the role on the server, not only by hiding links.

## 2. Claim a shift

One transaction. The shift row is locked before anything is counted.

```mermaid
flowchart TD
    A[POST /api/shifts/:id/claim] --> B{Logged in?}
    B -->|no| E1[401]
    B -->|yes| C{Claiming for self, or manager assigning?}
    C -->|staff claiming someone else| E2[403]
    C -->|ok| T[BEGIN TRANSACTION]

    T --> LK[Lock the shift row, SELECT FOR UPDATE]
    LK --> D{Shift exists?}
    D -->|no| E3[404]
    D -->|yes| F{Already claimed by this user?}

    F -->|yes| E4[409 Already claimed]
    F -->|no| G{Enough slots left for their profession?}

    G -->|no| E5[409 with the profession that is full]
    G -->|yes| H{Overlaps another shift they have claimed?}

    H -->|yes| E6[409 with the conflicting shift]
    H -->|no| I[INSERT claim]

    I --> J[COMMIT]
    J --> K[200 OK]

    E3 --> RB[ROLLBACK]
    E4 --> RB
    E5 --> RB
    E6 --> RB
```

Overlap test:

```
A.starts_at < B.ends_at AND B.starts_at < A.ends_at
```

Staff claiming and manager assigning call the same function.

## 3. Edit a shift

```mermaid
flowchart TD
    A[Manager edits shift time] --> T[BEGIN TRANSACTION]
    T --> B[Lock shift, load its claims]
    B --> C[Apply new time]
    C --> D[Re-check every claim against the new time]
    D --> E{Any claim now overlaps that person's other shifts?}
    E -->|no| F[COMMIT]
    E -->|yes| G[Drop those claims]
    G --> H[COMMIT]
    H --> I[Return the dropped claims for the UI]
```

If requirements are lowered below current claims, drop the most recently added
claims for that profession.

## 4. Import

Seed and UI upload call the same function. The header is validated before any
row is parsed.

```mermaid
flowchart LR
    A[CSV file] --> B[Parse rows]
    B --> C[For each row]
    C --> D[Trim, normalise]
    D --> E[Repair dates, roles, emails, +1 times]
    E --> F[Validate]
    F --> G{Outcome}
    G -->|ok| H[ACCEPTED]
    G -->|dup of earlier row| I[MERGED]
    G -->|broken| J[REJECTED with reason]
    H --> K[Write to DB]
    I --> L[Import Report]
    J --> L
    H --> L
```

```ts
type RowOutcome =
  | { status: 'accepted'; row: RawRow; data: Shift | Staff }
  | { status: 'merged';   row: RawRow; mergedInto: string; reason: string }
  | { status: 'rejected'; row: RawRow; reason: string }
```

## 5. Data model

```mermaid
erDiagram
    USER ||--o{ CLAIM : has
    SHIFT ||--o{ CLAIM : has

    USER {
        string id PK
        string email UK
        string password_hash
        enum role "manager or staff"
        enum profession "doctor, nurse, receptionist"
        string full_name
    }
    SHIFT {
        string id PK
        timestamptz starts_at
        timestamptz ends_at
        int req_doctor
        int req_nurse
        int req_receptionist
    }
    CLAIM {
        string user_id FK
        string shift_id FK
    }
```

Database constraints: `UNIQUE(user_id, shift_id)`, `UNIQUE(email)`,
`CHECK (ends_at > starts_at)`.

Profession capacity and per-user overlap cannot be constraints, so they are
enforced in the transaction shown in flow 2.
