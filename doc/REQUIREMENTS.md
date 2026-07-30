# Requirements

From PROJECT_BRIEF.md.

## 1. Auth & roles

- [x] R1.1 Login with email + password
- [x] R1.2 Two roles: `manager`, `staff`
- [x] R1.3 Staff have a profession: doctor / nurse / receptionist
- [ ] R1.4 Staff can only claim/unclaim for themselves
- [ ] R1.5 Manager can assign staff to shifts directly
- [ ] R1.6 Seed 1 manager and several staff
- [ ] R1.7 Credentials listed in README
- [ ] R1.8 Manager-only routes return 403 for staff

## 2. Shift management

- [ ] R2.1 Shift has date, start time, end time, role requirements
- [ ] R2.2 Manager can create a shift
- [ ] R2.3 Manager can edit a shift
- [ ] R2.4 Manager can delete a shift
- [ ] R2.5 Editing a claimed shift has defined behaviour, documented in DECISIONS.md

## 3. Claiming

- [ ] R3.1 Staff can claim an open shift
- [ ] R3.2 Staff can unclaim
- [ ] R3.3 Reject if the shift already has enough of that profession
- [ ] R3.4 Reject if it overlaps another shift the user has claimed
- [ ] R3.5 Rejections return a specific error message
- [ ] R3.6 Rules enforced server-side
- [ ] R3.7 Same rules apply when a manager assigns someone
- [ ] R3.8 Rules re-validated when a shift's time is edited after being claimed
- [ ] R3.9 Concurrent claims on one open slot: exactly one succeeds

## 4. CSV import

- [ ] R4.1 Import runs as part of seed
- [ ] R4.2 Deployed database pre-populated from that import
- [ ] R4.3 Manager can upload a CSV through the UI
- [ ] R4.4 Upload calls the same import function as seed
- [ ] R4.5 Import report page exists
- [ ] R4.6 Import report is manager-only
- [ ] R4.7 Report shows count of accepted rows
- [ ] R4.8 For each rejected or merged row: the row, the problem, the action taken

### staff.csv rules

- [ ] Trim whitespace and normalise case
- [ ] Map role synonyms:
      doctor: Doctor, DOCTOR, Physician, MD
      nurse: NURSE, RN, Nurse, nurse, Registered Nurse
      receptionist: receptionist, Receptionist, Reception, recep.
- [ ] Reject unsupported profession (997, Janitor)
- [ ] Merge exact duplicate rows (103, 110)
- [ ] Merge same person under two ids, matched on email (999 into 105)
- [ ] Repair `(at)` to `@` in emails (122, 115)
- [ ] Reject missing email (995)
- [ ] Reject missing name (996)
- [ ] Reject email already used by another staff member (998 vs 107)

### shifts.csv rules

- [ ] Parse three date formats by separator:
      `YYYY-MM-DD` ISO
      `DD/MM/YYYY` slash, day first
      `MM-DD-YYYY` dash, month first
- [ ] Reject impossible dates (5110, 2026-02-30)
- [ ] Reject missing start or end time (5114)
- [ ] Reject zero-length shift (5112, 12:00 to 12:00)
- [ ] Reject duration over 24h after the next-day roll (5115 is 26h)
- [ ] Repair `10:00+1` next-day notation (5115)
- [ ] Reject free-text requirements (5113, "two nurses and a doctor")
- [ ] Missing requirement keys default to 0
- [ ] Overnight shifts (end before start) roll to the next day, not an error
- [ ] Dedupe on `shift_id` only (5020). 25 groups share a date and time
      under different ids; those are separate shifts.

## 5. Coverage dashboard

- [ ] R5.1 Manager week view
- [ ] R5.2 Shows every shift in the week
- [ ] R5.3 Status per shift: fully staffed, partially staffed, empty
- [ ] R5.4 Shows which roles are still missing
- [ ] R5.5 Jump to any week
- [ ] R5.6 Responsive

## 6. Deliverables

- [ ] R6.1 Live deployed URL, seeded
- [ ] R6.2 README notes cold starts
- [ ] R6.3 Meaningful commits
- [ ] R6.4 DECISIONS.md, including one thing to do differently with more time
- [ ] R6.5 README: stack, local setup, test instructions, credentials
- [ ] R6.6 Tests runnable with one command
- [x] R6.7 `docker compose up` starts app and database, runs migrations, seeds
- [ ] R6.8 Fresh clone needs no setup steps beyond `docker compose up`
- [x] R6.9 App image builds from `output: 'standalone'`
- [x] R6.10 App waits for the database healthcheck before migrating

## 7. Tests

Run with `bun test`. Documented in the README.

### Import (pure functions, no database)

Table-driven, one case per rule in section 4.

- [ ] T1.1 Each role synonym maps to the right profession
- [ ] T1.2 Each of the three date formats parses to the right date
- [ ] T1.3 `05/08/2026` parses as 5 August
- [ ] T1.4 Impossible date rejected (2026-02-30)
- [ ] T1.5 Missing start or end time rejected
- [ ] T1.6 Zero-length rejected; over-24h rejected; a 24h on-call shift accepted
- [ ] T1.7 `10:00+1` notation parses to the next day
- [ ] T1.8 Free-text requirements rejected
- [ ] T1.9 Missing requirement keys default to 0
- [ ] T1.10 Overnight shift produces `ends_at` on the next day
- [ ] T1.11 Duplicate `shift_id` merged; same date and time under different
      ids kept as separate shifts
- [ ] T1.12 Duplicate staff rows merged, unsupported profession rejected,
      `(at)` email repaired, missing name or email rejected, email already
      used by another staff member rejected
- [ ] T1.13 Wrong header rejects the whole file and names the missing column
- [ ] T1.14 Importing the real seed CSVs yields the expected accepted,
      merged and rejected counts

### Business rules 

- [ ] T2.1 Claim succeeds on an open shift
- [ ] T2.2 Claim rejected when the profession is already full
- [ ] T2.3 Claim rejected when it overlaps a shift the user has claimed
- [ ] T2.4 Overlap detection is correct across midnight
- [ ] T2.5 Same rules apply when a manager assigns someone
- [ ] T2.6 Editing a shift's time drops only the claims that now break a rule
- [ ] T2.7 Lowering requirements below current claims drops the most recent

### Concurrency

- [ ] T3.1 N simultaneous claims on one open slot: exactly one succeeds and
      the rest get a clear rejection
- [ ] T3.2 Same shift, different professions, claimed at once: both succeed

### Authorization

- [ ] T4.1 Staff requesting a manager route gets 403
- [ ] T4.2 Staff cannot claim on behalf of another user

## 8. Optional


### Hours on duty

- [ ] O1.1 Staff see their total hours for the week on My Shifts
- [ ] O1.2 Manager sees hours per staff member for the visible week
- [ ] O1.3 Totals come from claimed shifts, no schema change

Display only. Not a claim rule: a weekly hour cap would add a third business
rule the brief does not ask for, interacting with the two it does.

## Out of scope

- Recurring shifts
- Live updates
- End-to-end browser tests
- Weekly hour limits as a validation rule

