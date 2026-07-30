import { parseProfession, type Profession } from "./roles";
import type { HeaderError, ImportResult, RowOutcome } from "./types";

export type StaffData = {
  externalId: string;
  fullName: string;
  email: string;
  profession: Profession;
};

const REQUIRED_HEADERS = ["staff_id", "full_name", "role", "email"];

type Candidate = {
  line: number;
  raw: string;
  externalId: string;
  fullName: string;
  email: string;
  profession: Profession;
};

export function importStaff(csvText: string): ImportResult<StaffData> | HeaderError {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { error: "staff.csv is empty" };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  for (const required of REQUIRED_HEADERS) {
    if (!header.includes(required)) {
      return { error: `staff.csv is missing required column: "${required}"` };
    }
  }

  const idIdx = header.indexOf("staff_id");
  const nameIdx = header.indexOf("full_name");
  const roleIdx = header.indexOf("role");
  const emailIdx = header.indexOf("email");

  const outcomes: RowOutcome<StaffData>[] = [];
  const candidates: Candidate[] = [];

  // Pass 1: checks that only need this row.
  for (let i = 1; i < lines.length; i++) {
    const line = i + 1;
    const raw = lines[i];
    const cols = raw.split(",").map((c) => c.trim());

    const externalId = cols[idIdx] ?? "";
    const fullName = (cols[nameIdx] ?? "").replace(/\s+/g, " ").trim();
    const email = (cols[emailIdx] ?? "")
      .toLowerCase()
      .replace(/\(at\)/g, "@")
      .trim();

    if (!fullName) {
      outcomes.push({ status: "rejected", line, raw, reason: "missing name" });
      continue;
    }
    if (!email) {
      outcomes.push({ status: "rejected", line, raw, reason: "missing email" });
      continue;
    }

    const profResult = parseProfession(cols[roleIdx] ?? "");
    if (!profResult.ok) {
      outcomes.push({ status: "rejected", line, raw, reason: profResult.reason });
      continue;
    }

    candidates.push({ line, raw, externalId, fullName, email, profession: profResult.profession });
  }

  // Pass 2: checks that depend on other rows, grouped by email so every
  // rule that has to pick one surviving row agrees on which one that is.
  const byEmail = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const group = byEmail.get(candidate.email) ?? [];
    group.push(candidate);
    byEmail.set(candidate.email, group);
  }

  for (const group of byEmail.values()) {
    if (group.length === 1) {
      const c = group[0];
      outcomes.push({
        status: "accepted",
        line: c.line,
        raw: c.raw,
        data: { externalId: c.externalId, fullName: c.fullName, email: c.email, profession: c.profession },
      });
      continue;
    }

    // Same email, more than one row. If the name also matches, it's the
    // same person filed under two ids (or an exact duplicate) — merge.
    // If the name differs, the email was reused for someone else — reject.
    const first = group[0];
    const samePerson = group.filter((c) => c.fullName.toLowerCase() === first.fullName.toLowerCase());
    const different = group.filter((c) => !samePerson.includes(c));

    const canonical = samePerson.reduce((min, c) =>
      Number(c.externalId) < Number(min.externalId) ? c : min,
    );

    outcomes.push({
      status: "accepted",
      line: canonical.line,
      raw: canonical.raw,
      data: {
        externalId: canonical.externalId,
        fullName: canonical.fullName,
        email: canonical.email,
        profession: canonical.profession,
      },
    });

    for (const c of samePerson) {
      if (c === canonical) continue;
      outcomes.push({
        status: "merged",
        line: c.line,
        raw: c.raw,
        mergedInto: canonical.externalId,
        reason:
          c.externalId === canonical.externalId
            ? "duplicate row"
            : "same person under a different staff_id, matched on email",
      });
    }

    for (const c of different) {
      outcomes.push({
        status: "rejected",
        line: c.line,
        raw: c.raw,
        reason: `email already used by another staff member (staff_id ${canonical.externalId})`,
      });
    }
  }

  outcomes.sort((a, b) => a.line - b.line);

  return {
    outcomes,
    accepted: outcomes.filter((o) => o.status === "accepted").length,
    merged: outcomes.filter((o) => o.status === "merged").length,
    rejected: outcomes.filter((o) => o.status === "rejected").length,
  };
}
