# Requirements

From PROJECT_BRIEF.md.

## 1. Auth & roles

- [x] R1.1 Login with email + password
- [x] R1.2 Two roles: `manager`, `staff`
- [x] R1.3 Staff have a profession: doctor / nurse / receptionist
- [x] R1.4 Staff can only claim/unclaim for themselves
- [x] R1.5 Manager can assign staff to shifts directly
- [x] R1.6 Seed 1 manager and several staff
- [x] R1.7 Credentials listed in README
- [x] R1.8 Manager-only routes deny staff
      Pages redirect to `/shifts`; server actions return an error. The 403
      helpers in `auth.ts` are for route handlers, of which there are none.

## 2. Shift management

- [x] R2.1 Shift has date, start time, end time, role requirements
- [x] R2.2 Manager can create a shift
- [x] R2.3 Manager can edit a shift
- [x] R2.4 Manager can delete a shift
- [x] R2.5 Editing a claimed shift has defined behaviour, documented in DECISIONS.md

## 3. Claiming

- [x] R3.1 Staff can claim an open shift
- [x] R3.2 Staff can unclaim
- [x] R3.3 Reject if the shift already has enough of that profession
- [x] R3.4 Reject if it overlaps another shift the user has claimed
- [x] R3.5 Rejections return a specific error message
- [x] R3.6 Rules enforced server-side
- [x] R3.7 Same rules apply when a manager assigns someone
- [x] R3.8 Rules re-validated when a shift's time is edited after being claimed
- [x] R3.9 Concurrent claims on one open slot: exactly one succeeds
      Enforced by `FOR UPDATE` on both the shift and the user, and proven by
      T3.1: deleting either lock fails those tests and no others.

## 4. CSV import

- [x] R4.1 Import runs as part of seed
- [x] R4.2 Deployed database pre-populated from that import
- [x] R4.3 Manager can upload a CSV through the UI
- [x] R4.4 Upload calls the same import function as seed
- [x] R4.5 Import report page exists
- [x] R4.6 Import report is manager-only
- [x] R4.7 Report shows count of accepted rows
- [x] R4.8 For each rejected or merged row: the row, the problem, the action taken

### staff.csv rules

- [x] Trim whitespace and normalise case
- [x] Map role synonyms:
      doctor: Doctor, DOCTOR, Physician, MD
      nurse: NURSE, RN, Nurse, nurse, Registered Nurse
      receptionist: receptionist, Receptionist, Reception, recep.
- [x] Reject unsupported profession (997, Janitor)
- [x] Merge exact duplicate rows (103, 110)
- [x] Merge same person under two ids, matched on email (999 into 105)
- [x] Repair `(at)` to `@` in emails (122, 115)
- [x] Reject missing email (995)
- [x] Reject missing name (996)
- [x] Reject email already used by another staff member (998 vs 107)

### shifts.csv rules

- [x] Parse three date formats by separator:
      `YYYY-MM-DD` ISO
      `DD/MM/YYYY` slash, day first
      `MM-DD-YYYY` dash, month first
- [x] Reject impossible dates (5110, 2026-02-30)
- [x] Reject missing start or end time (5114)
- [x] Reject zero-length shift (5112, 12:00 to 12:00)
- [x] Reject duration over 24h after the next-day roll (5115 is 26h)
- [x] Repair `10:00+1` next-day notation (5115)
- [x] Reject free-text requirements (5113, "two nurses and a doctor")
- [x] Missing requirement keys default to 0
- [x] Overnight shifts (end before start) roll to the next day, not an error
- [x] Dedupe on `shift_id` only (5020). 25 groups share a date and time
      under different ids; those are separate shifts.

## 5. Coverage dashboard

- [x] R5.1 Manager week view
- [x] R5.2 Shows every shift in the week
- [x] R5.3 Status per shift: fully staffed, partially staffed, empty
- [x] R5.4 Shows which roles are still missing
- [x] R5.5 Jump to any week
      Previous / this week / next, plus a date picker that snaps to the
      containing week. The week lives in `?week=`, so it stays linkable.
- [ ] R5.6 Responsive
      Breakpoint classes and a scroll container are in place; not yet checked
      in a browser at real widths.

## 6. Deliverables

- [x] R6.1 Live deployed URL, seeded
- [x] R6.2 README notes cold starts
- [x] R6.3 Meaningful commits
- [x] R6.4 DECISIONS.md, including one thing to do differently with more time
- [x] R6.5 README: stack, local setup, test instructions, credentials
- [x] R6.6 Tests runnable with one command
- [x] R6.7 `docker compose up` starts app and database, runs migrations, seeds
- [x] R6.8 Fresh clone needs no setup steps beyond `docker compose up`
      Verified by cloning the repo and bringing the stack up: migrations apply,
      the seed reports 34/3/4 and 111/1/5, the app serves, no `.env` needed.
      Needed `public/.gitkeep` — git does not track empty directories, so the
      Dockerfile's `COPY /app/public` failed on a clone but not locally.
- [x] R6.9 App image builds from `output: 'standalone'`
- [x] R6.10 App waits for the database healthcheck before migrating

## 7. Tests

Run with `bun test`, which needs Postgres up. 26 tests across two files.

T1.1 and T1.8–T1.13 have no case of their own. T1.14 asserts the counts the
real CSVs produce, which fails if any of those rules break: covered, not
itemised.

### Import (pure functions, no database)

- [ ] T1.1 Each role synonym maps to the right profession
- [x] T1.2 Each of the three date formats parses to the right date
- [x] T1.3 `05/08/2026` parses as 5 August
- [x] T1.4 Impossible date rejected (2026-02-30)
- [x] T1.5 Missing start or end time rejected
- [x] T1.6 Zero-length rejected; over-24h rejected; a 24h on-call shift accepted
- [x] T1.7 `10:00+1` notation parses to the next day
- [ ] T1.8 Free-text requirements rejected
- [ ] T1.9 Missing requirement keys default to 0
- [x] T1.10 Overnight shift produces `ends_at` on the next day
- [ ] T1.11 Duplicate `shift_id` merged; same date and time under different
      ids kept as separate shifts
- [ ] T1.12 Duplicate staff rows merged, unsupported profession rejected,
      `(at)` email repaired, missing name or email rejected, email already
      used by another staff member rejected
- [ ] T1.13 Wrong header rejects the whole file and names the missing column
- [x] T1.14 Importing the real seed CSVs yields the expected accepted,
      merged and rejected counts

### Business rules 

- [x] T2.1 Claim succeeds on an open shift
- [x] T2.2 Claim rejected when the profession is already full
- [x] T2.3 Claim rejected when it overlaps a shift the user has claimed
- [x] T2.4 Overlap detection is correct across midnight
      Plus the boundary: back-to-back shifts are not a clash.
- [x] T2.5 Same rules apply when a manager assigns someone
- [ ] T2.6 Editing a shift's time drops only the claims that now break a rule
- [ ] T2.7 Lowering requirements below current claims drops the most recent

### Concurrency

- [x] T3.1 N simultaneous claims on one open slot: exactly one succeeds and
      the rest get a clear rejection
      Also three slots against eight claimants, and one person firing two
      overlapping claims at once — the case the user lock exists for.
- [x] T3.2 Same shift, different professions, claimed at once: both succeed

### Authorization

- [ ] T4.1 Staff requesting a manager route gets 403
- [x] T4.2 Staff cannot claim on behalf of another user

## 8. Optional


### Hours on duty

- [x] O1.1 Staff see their total hours for the week on My Shifts
- [ ] O1.2 Manager sees hours per staff member for the visible week
- [x] O1.3 Totals come from claimed shifts, no schema change

Display only. Not a claim rule: a weekly hour cap would add a third business
rule the brief does not ask for, interacting with the two it does.

## Out of scope

- Recurring shifts
- Live updates
- End-to-end browser tests
- Weekly hour limits as a validation rule
