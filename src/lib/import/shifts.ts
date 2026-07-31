import { parseDate, parseTime } from "./dates";
import type { Profession } from "./roles";
import type { HeaderError, ImportResult, RowOutcome } from "./types";

export type ShiftData = {
  externalId: string;
  startsAt: Date;
  endsAt: Date;
  requirements: Record<Profession, number>;
};

const REQUIRED_HEADERS = ["shift_id", "date", "start_time", "end_time", "requirements"];

const REQUIREMENT_KEYS: Record<string, Profession> = {
  nurses: "nurse",
  doctors: "doctor",
  receptionists: "receptionist",
};

/// "nurses=3;doctors=1;receptionists=0" — semicolon-separated key=value
/// pairs. Any key not in REQUIREMENT_KEYS, or anything that isn't this
/// shape, is treated as free text and rejected. Missing keys default to 0.
function parseRequirements(
  input: string,
): { ok: true; requirements: Record<Profession, number> } | { ok: false; reason: string } {
  const requirements: Record<Profession, number> = { doctor: 0, nurse: 0, receptionist: 0 };

  const parts = input
    .trim()
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p !== "");

  for (const part of parts) {
    const match = /^([a-zA-Z]+)=(\d+)$/.exec(part);
    const profession = match ? REQUIREMENT_KEYS[match[1].toLowerCase()] : undefined;

    if (!match || !profession) {
      return { ok: false, reason: `free-text requirements: "${input}"` };
    }

    requirements[profession] = Number(match[2]);
  }

  return { ok: true, requirements };
}

/// Combines date + start/end time into real Date objects, and applies the
/// overnight/next-day rules:
///   - end clock time before start clock time, same day  -> rolls to +1 day
///   - explicit "+1" on the end time                     -> always +1 day
///   - end clock time equal to start clock time           -> zero length, not a rollover
export function computeShiftTimes(
  dateInput: string,
  startInput: string,
  endInput: string,
): { ok: true; startsAt: Date; endsAt: Date } | { ok: false; reason: string } {
  if (!startInput.trim()) return { ok: false, reason: "missing start time" };
  if (!endInput.trim()) return { ok: false, reason: "missing end time" };

  const date = parseDate(dateInput);
  if (!date.ok) return { ok: false, reason: date.reason };

  const start = parseTime(startInput);
  if (!start.ok) return { ok: false, reason: `start time: ${start.reason}` };

  const end = parseTime(endInput);
  if (!end.ok) return { ok: false, reason: `end time: ${end.reason}` };

  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  const endDayOffset = end.plusDays > 0 ? end.plusDays : endMinutes < startMinutes ? 1 : 0;

  const startsAt = new Date(Date.UTC(date.year, date.month - 1, date.day, start.hour, start.minute));
  const endsAt = new Date(
    Date.UTC(date.year, date.month - 1, date.day + endDayOffset, end.hour, end.minute),
  );

  const durationHours = (endsAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60);

  if (durationHours <= 0) {
    return { ok: false, reason: "zero-length shift" };
  }
  if (durationHours > 24) {
    return { ok: false, reason: `shift duration exceeds 24 hours (${durationHours}h)` };
  }

  return { ok: true, startsAt, endsAt };
}

export function importShifts(csvText: string): ImportResult<ShiftData> | HeaderError {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { error: "shifts.csv is empty" };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  for (const required of REQUIRED_HEADERS) {
    if (!header.includes(required)) {
      return { error: `shifts.csv is missing required column: "${required}"` };
    }
  }

  const idIdx = header.indexOf("shift_id");
  const dateIdx = header.indexOf("date");
  const startIdx = header.indexOf("start_time");
  const endIdx = header.indexOf("end_time");
  const reqIdx = header.indexOf("requirements");

  const outcomes: RowOutcome<ShiftData>[] = [];
  const seenIds = new Map<string, number>(); // externalId -> line of first occurrence

  for (let i = 1; i < lines.length; i++) {
    const line = i + 1;
    const raw = lines[i];
    const cols = raw.split(",").map((c) => c.trim());

    const externalId = cols[idIdx] ?? "";

    // Dedupe on shift_id only. Rows that share a date/time under different
    // ids are separate shifts and must not be merged.
    const firstLine = seenIds.get(externalId);
    if (firstLine !== undefined) {
      outcomes.push({
        status: "merged",
        line,
        raw,
        mergedInto: externalId,
        reason: "duplicate shift_id",
      });
      continue;
    }
    seenIds.set(externalId, line);

    const timing = computeShiftTimes(cols[dateIdx] ?? "", cols[startIdx] ?? "", cols[endIdx] ?? "");
    if (!timing.ok) {
      outcomes.push({ status: "rejected", line, raw, reason: timing.reason });
      continue;
    }

    const requirements = parseRequirements(cols[reqIdx] ?? "");
    if (!requirements.ok) {
      outcomes.push({ status: "rejected", line, raw, reason: requirements.reason });
      continue;
    }

    outcomes.push({
      status: "accepted",
      line,
      raw,
      data: {
        externalId,
        startsAt: timing.startsAt,
        endsAt: timing.endsAt,
        requirements: requirements.requirements,
      },
    });
  }

  return {
    outcomes,
    accepted: outcomes.filter((o) => o.status === "accepted").length,
    merged: outcomes.filter((o) => o.status === "merged").length,
    rejected: outcomes.filter((o) => o.status === "rejected").length,
  };
}
