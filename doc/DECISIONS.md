# Decisions

## Stack

| Layer | Choice |
|---|---|
| Package manager | Bun |
| UI | React 19 |
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | Auth.js |
| Styling | Tailwind CSS |
| Local setup | Docker Compose |
| Hosting | Vercel + Neon |
| Tests | `bun test` |

**PostgreSQL.** Claims need row-level locking (`SELECT ... FOR UPDATE`).

**Next.js.** Frontend and API in one project, so there is no second service to
deploy or keep in sync.

**TypeScript.** The importer returns a union of accepted, merged and rejected,
so the compiler catches any case the report fails to handle.

**Prisma.** Migrations and `$transaction`. The row lock is raw SQL, since the
query builder does not express `FOR UPDATE`.

**Auth.js.** Sessions and role checks without hand-rolling password handling.

**Tailwind.** Fastest route to a responsive dashboard.

**Bun.** Runs the TypeScript seed script directly; `bun test` needs no config.

**Vercel + Neon.** Free tier, zero config. Neon cold starts; noted in README.

## Data model

Shift times are absolute timestamps (`starts_at`, `ends_at`) rather than a date
plus two clock times, so overnight shifts need no special case and overlap is
one expression:

```
A.starts_at < B.ends_at AND B.starts_at < A.ends_at
```

Constraints: `UNIQUE(user_id, shift_id)`, `UNIQUE(email)`,
`CHECK (ends_at > starts_at)`.

## Access control

Manager-only routes check the role on the server and return 403, independently
of the UI hiding the link. The user id comes from the session, never the
request body.

## Claiming

Capacity and overlap cannot be expressed as constraints, so both are checked
inside a transaction that locks the shift row first. Locking the shift rather
than the table keeps claims on different shifts parallel.

One function serves both staff claiming and managers assigning, so the two
paths cannot drift apart.

Rejections name the reason: which profession is full, or which existing shift
conflicts.

## Editing a shift that has claims

The edit applies, then every claim is re-checked against the new time and
requirements. Claims that break a rule are dropped and returned, so the manager
is told who lost the shift. Claims that still fit are untouched. If
requirements drop below current claims, the most recent go first.

Blocking edits on claimed shifts was rejected: a manager could then never
correct a mistake once anyone had claimed.

## Import

One function serves the seed and manager uploads, so its rules are policies for
any file rather than fixes for one export.

**Header.** A mismatched header rejects the file whole, naming the missing
column. Bad values inside a correct header are handled per row.

**Rows.** Each row is normalised, repaired where the intent is unambiguous,
then validated, leaving as accepted, merged or rejected with a reason. Nothing
is dropped silently; every rejected and merged row reaches the report with its
original text, the problem, and the action taken.

**Dates.** Three formats: ISO, slash-separated read day-first, dash-separated
with trailing year read month-first. Anything else is rejected with the value
quoted rather than guessed at.

**Durations.** An end before the start rolls to the next day. Zero-length rows
are rejected as ambiguous, and rows over 24 hours as malformed, since a date
and two clock times cannot express a longer shift.

**Roles.** Values are trimmed, lowercased and stripped of punctuation before
lookup, so casing variants need no entries. Unrecognised roles are rejected
with the original text, never fuzzy-matched.

**Duplicates.** Records dedupe on their identifier, staff additionally on
email. Two shifts sharing a date and time are not duplicates; a clinic runs
several at once.

## Coverage dashboard

The week view is server-rendered and addressed by URL, so a week can be linked.
Status comes from claims against requirements per profession, and missing roles
are named rather than counted.

## Local setup

`docker compose up` on a fresh clone starts the database, applies migrations,
runs the seed importer and serves the app.

The database has a healthcheck the app waits on: `depends_on` waits for the
container to start, not for Postgres to accept connections, so the first
migration fails without it.

The image uses `output: 'standalone'` to keep `node_modules` out of the runtime
stage. Production runs on Vercel and Neon; both environments read the same
`DATABASE_URL`.

## Testing

`bun test`

- Import rules are table-driven cases, since parsing and validation are pure
  functions with no database
- Capacity and overlap run against a real database, with overlap tested across
  midnight
- Concurrency: several claims fired at one open slot, exactly one succeeds
- Two professions claimed on the same shift at once both succeed, confirming
  the lock is not over-serializing
- Manager routes requested with a staff session return 403
- Browser end-to-end tests are out of scope

## With more time

- Enforce overlap as a Postgres exclusion constraint
  (`EXCLUDE USING gist`) instead of an application check, so it holds from any
  code path rather than only the one that takes the lock
- Notify staff when a manager's edit drops their claim; only the manager sees
  it now
- Preview an import before committing rather than writing immediately
- Make imports idempotent, so re-uploading a file is a no-op
- Model role requirements as rows rather than columns, so adding a profession
  is data rather than a migration
