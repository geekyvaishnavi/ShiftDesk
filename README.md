# ShiftDesk

Shift scheduling for a clinic. A manager creates shifts with a required count per
profession; staff claim the ones they can cover. Two rules are enforced on the
server for every claim: a profession cannot be filled beyond what the shift
requires, and nobody can hold two overlapping shifts.

| | |
| --- | --- |
| Live site | **https://shift-desk-murex.vercel.app** |
| Run locally | `docker compose up` |
| Run the tests | `bun test` |
| Sign in | `manager@clinicmail.test` / `password123` |

The deployed database is on a free tier that suspends when idle, so the first
request after a quiet period takes a few seconds.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, server components, server actions) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4 |
| Database | PostgreSQL 17 |
| ORM | Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| Auth | Session JWT in an httpOnly cookie (`jose`), `bcryptjs` for passwords |
| Package manager | Bun |
| Local setup | Docker Compose |

## Running it locally

```bash
docker compose up
```

On a fresh clone, with nothing installed but Docker: starts PostgreSQL, applies
the migrations, runs the CSV importer, and serves the app on
**http://localhost:3000**. `docker compose down -v` to start over.

### Without Docker

Requires Bun and a PostgreSQL instance.

```bash
bun install
cp .env.example .env        # set DATABASE_URL and AUTH_SECRET
bun run db:deploy
bun run db:seed
bun run dev
```

## Logins

| Role | Email | Password |
| --- | --- | --- |
| Manager | `manager@clinicmail.test` | `password123` |
| Staff | any email imported from `seed-data/staff.csv` | `password123` |


## Tests

```bash
bun test
```

26 tests. The only prerequisite is a reachable PostgreSQL — `docker compose up -d db`
is enough.

- **`tests/import.test.ts`** — the importer as pure functions: the three date
  formats, impossible dates, zero-length and over-24-hour shifts, `+1` next-day
  notation, free-text requirements, duplicate handling, and a wrong header
  rejecting the file.
- **`tests/claims.test.ts`** — against a real database, since the rules are
  enforced by a row lock: capacity, overlap across midnight, manager assignment,
  the claims dropped by an edit, and several claims fired at one open slot where
  exactly one must win.

The suite appends `_test` to `DATABASE_URL`, creates and migrates that database,
and refuses to run against any name not ending in `_test`. Override with
`TEST_DATABASE_URL`.

## Documents

- [`doc/DECISIONS.md`](doc/DECISIONS.md) — design decisions, and what I would do
  differently with more time
- [`doc/REQUIREMENTS.md`](doc/REQUIREMENTS.md) — the brief as checkable items
- [`doc/FLOWS.md`](doc/FLOWS.md) — flow diagrams
