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
| Auth | Signed JWT cookie (`jose`) + `bcryptjs` |
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

**Auth.** Email and password only, with one role check, so Auth.js would have
added a provider abstraction and its own schema for no gain here. Instead the
session is a JWT signed with `jose`, stored in an httpOnly cookie, and
passwords are hashed with `bcryptjs`. Roughly sixty lines, and the trust
boundary stays legible: a tampered cookie fails signature verification and
reads as signed out.

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

Constraints: `UNIQUE(user_id, shift_id)` so a claim cannot be duplicated,
`UNIQUE(email)`, and `UNIQUE(external_id)` on both users and shifts so
re-running the seed upserts rather than duplicating.

`ends_at > starts_at` is enforced by the importer and by shift editing rather
than as a database `CHECK`; adding the constraint is listed under *With more
time*, since it belongs where it cannot be bypassed.

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

**Roles.** Values are trimmed and lowercased before lookup, so casing variants
need no entries of their own. Every accepted spelling, including abbreviations
like `MD`, `RN` and `recep.`, is an explicit entry in one table: a synonym is
either recognised or it is not. Unrecognised roles are rejected with the
original text, never fuzzy-matched, so a typo cannot silently become a
profession.

**Duplicates.** Records dedupe on their identifier, staff additionally on
email. Two shifts sharing a date and time are not duplicates; a clinic runs
several at once.

## Coverage dashboard

The week view is server-rendered and addressed by URL, so a week can be linked.
Status comes from claims against requirements per profession, and missing roles
are named rather than counted.

Weeks run Monday to Sunday and every boundary is computed in UTC, matching the
importer, so a shift cannot land in a different week depending on where the
server runs. The end of a week is the following Monday, exclusive, which is
also the range query.

Coverage counts each profession only up to what the shift requires: three
doctors on a shift needing one doctor and two nurses reads as partially
staffed, not full. Extra people never fill another role's gap.

The default week is the current one, falling back to the earliest week that
has shifts when it is empty. The seed data sits in a fixed month, so a manager
opening the dashboard would otherwise land on a blank week and assume the
import failed.

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

`bun test`, with Postgres running (`docker compose up -d db`).

Twenty-six tests across two files, chosen for what cannot be shown by clicking
rather than for coverage.

- **Import rules** are pure functions with no database, so they are plain
  cases: the three date formats, both duration bounds, the overnight roll. The
  anchor is the clinic's own two CSVs asserted down to the counts they produce
  — 34 accepted, 3 merged, 4 rejected for staff; 111, 1 and 5 for shifts —
  which exercises every synonym, repair and rejection rule at once
- **Capacity and overlap** run against a real database, including the two cases
  most likely to be wrong: an overlap that spans midnight, and a handover where
  one shift ends exactly as the next begins, which must not count as a clash
- **Concurrency** is the reason the claim path takes row locks, so it is tested
  directly. Eight nurses claim one slot at once and exactly one gets it; eight
  claim three slots and exactly three do; two professions claim the same shift
  at once and both succeed, which is what says the lock is no wider than it
  needs to be. One person firing two overlapping claims simultaneously lands
  only one — that case is why the user row is locked as well as the shift
- Deleting `FOR UPDATE` from both locks was used to check these tests have
  teeth: the concurrency cases fail and every other test still passes

Tests run against a separate `_test` database, created and migrated on first
run. The suite refuses to start against a database whose name does not end in
`_test`, so a stray `DATABASE_URL` cannot truncate development data.

Authorization is covered where it is enforced — that staff cannot claim for
someone else, and that a manager assigning is held to the same two rules — but
not at the HTTP layer. Browser end-to-end tests are out of scope.

## With more time

- Enforce overlap as a Postgres exclusion constraint
  (`EXCLUDE USING gist`) instead of an application check, so it holds from any
  code path rather than only the one that takes the lock
- Add `CHECK (ends_at > starts_at)` so a zero-length or reversed shift cannot
  be written even by a direct SQL edit
- Notify staff when a manager's edit drops their claim; only the manager sees
  it now
- Preview an import before committing rather than writing immediately
- Make imports idempotent, so re-uploading a file is a no-op
- Model role requirements as rows rather than columns, so adding a profession
  is data rather than a migration
