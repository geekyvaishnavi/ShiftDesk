import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { computeShiftTimes, importShifts } from "@/lib/import/shifts";
import { importStaff } from "@/lib/import/staff";

const SEED_DATA = join(import.meta.dirname, "..", "seed-data");

function seedFile(name: string): string {
  return readFileSync(join(SEED_DATA, name), "utf8");
}

/// Every synonym, merge and rejection rule shows up in these counts, so one
/// assertion per file guards the lot.
describe("the clinic's own CSVs", () => {
  test("staff.csv: 34 accepted, 3 merged, 4 rejected", () => {
    const result = importStaff(seedFile("staff.csv"));
    if ("error" in result) throw new Error(`header rejected: ${result.error}`);

    expect(result.accepted).toBe(34);
    expect(result.merged).toBe(3);
    expect(result.rejected).toBe(4);
    expect(result.outcomes).toHaveLength(41);
  });

  test("shifts.csv: 111 accepted, 1 merged, 5 rejected", () => {
    const result = importShifts(seedFile("shifts.csv"));
    if ("error" in result) throw new Error(`header rejected: ${result.error}`);

    expect(result.accepted).toBe(111);
    expect(result.merged).toBe(1);
    expect(result.rejected).toBe(5);
    expect(result.outcomes).toHaveLength(117);
  });

  test("every outcome says what happened to its row", () => {
    const result = importStaff(seedFile("staff.csv"));
    if ("error" in result) throw new Error(`header rejected: ${result.error}`);

    for (const outcome of result.outcomes) {
      if (outcome.status === "accepted") continue;
      expect(outcome.reason.length).toBeGreaterThan(0);
      expect(outcome.raw.length).toBeGreaterThan(0);
      expect(outcome.line).toBeGreaterThan(0);
    }
  });
});

/// The separator decides the order, so getting it wrong moves a shift by
/// months rather than failing.
describe("date formats", () => {
  test("05/08/2026 is 5 August, not 8 May", () => {
    const result = computeShiftTimes("05/08/2026", "09:00", "17:00");
    if (!result.ok) throw new Error(result.reason);

    expect(result.startsAt.toISOString()).toBe("2026-08-05T09:00:00.000Z");
  });

  test("05-08-2026 is 8 May, not 5 August", () => {
    const result = computeShiftTimes("05-08-2026", "09:00", "17:00");
    if (!result.ok) throw new Error(result.reason);

    expect(result.startsAt.toISOString()).toBe("2026-05-08T09:00:00.000Z");
  });

  test("2026-08-05 is read as ISO", () => {
    const result = computeShiftTimes("2026-08-05", "09:00", "17:00");
    if (!result.ok) throw new Error(result.reason);

    expect(result.startsAt.toISOString()).toBe("2026-08-05T09:00:00.000Z");
  });

  test("a date that does not exist is rejected", () => {
    expect(computeShiftTimes("2026-02-30", "09:00", "17:00").ok).toBe(false);
  });
});

describe("shift duration", () => {
  test("an overnight shift ends the next day", () => {
    const result = computeShiftTimes("2026-08-05", "22:00", "06:00");
    if (!result.ok) throw new Error(result.reason);

    expect(result.startsAt.toISOString()).toBe("2026-08-05T22:00:00.000Z");
    expect(result.endsAt.toISOString()).toBe("2026-08-06T06:00:00.000Z");
  });

  test("06:00+1 notation is the next day", () => {
    const result = computeShiftTimes("2026-08-05", "22:00", "06:00+1");
    if (!result.ok) throw new Error(result.reason);

    expect(result.endsAt.toISOString()).toBe("2026-08-06T06:00:00.000Z");
  });

  test("start equal to end is zero-length and refused", () => {
    const result = computeShiftTimes("2026-08-05", "12:00", "12:00");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("zero-length");
  });

  test("a 24-hour on-call shift is allowed", () => {
    const result = computeShiftTimes("2026-08-05", "08:00", "08:00+1");

    expect(result.ok).toBe(true);
  });

  test("26 hours is over the limit and refused", () => {
    const result = computeShiftTimes("2026-08-05", "08:00", "10:00+1");
    // 08:00 to 10:00 the next day is 26 hours.
    expect(result.ok).toBe(false);
  });

  test("a missing time is refused rather than guessed", () => {
    expect(computeShiftTimes("2026-08-05", "", "17:00").ok).toBe(false);
    expect(computeShiftTimes("2026-08-05", "09:00", "").ok).toBe(false);
  });
});
