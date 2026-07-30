import bcrypt from "bcryptjs";

import type { PrismaClient } from "@/generated/prisma/client";

import { importShifts } from "./shifts";
import { importStaff } from "./staff";
import type { RowOutcome } from "./types";

/// Staff rows carry no password, so every imported account starts with this one
export const DEFAULT_STAFF_PASSWORD = "password123";

export type ImportSource = "seed" | "upload";

export type ImportRunResult =
  | { ok: false; error: string }
  | { ok: true; runId: string; accepted: number; merged: number; rejected: number };

/// Only merged and rejected rows are stored — the report shows the problems,
/// and the accepted rows are already visible as staff and shifts.
function problemRows<T>(outcomes: RowOutcome<T>[]) {
  const rows: { lineNumber: number; raw: string; status: string; reason: string }[] = [];

  for (const outcome of outcomes) {
    if (outcome.status === "accepted") continue;
    rows.push({
      lineNumber: outcome.line,
      raw: outcome.raw,
      status: outcome.status,
      reason:
        outcome.status === "merged"
          ? `${outcome.reason} → merged into ${outcome.mergedInto}`
          : outcome.reason,
    });
  }

  return rows;
}

export async function runStaffImport(
  client: PrismaClient,
  csvText: string,
  fileName: string,
  source: ImportSource,
): Promise<ImportRunResult> {
  const result = importStaff(csvText);
  if ("error" in result) return { ok: false, error: result.error };

  // Hashing is deliberately slow, so do it once rather than per row.
  const passwordHash = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, 10);

  const runId = await client.$transaction(
    async (tx) => {
      for (const outcome of result.outcomes) {
        if (outcome.status !== "accepted") continue;
        const { externalId, fullName, email, profession } = outcome.data;

        // Upsert on externalId so re-running the seed updates rather than
        // duplicating, and never resets a password already in use.
        await tx.user.upsert({
          where: { externalId },
          update: { fullName, email, profession },
          create: { externalId, fullName, email, profession, role: "staff", passwordHash },
        });
      }

      const run = await tx.importRun.create({
        data: {
          source,
          kind: "staff",
          fileName,
          accepted: result.accepted,
          merged: result.merged,
          rejected: result.rejected,
          rows: { create: problemRows(result.outcomes) },
        },
      });

      return run.id;
    },
    { timeout: 30_000 },
  );

  return {
    ok: true,
    runId,
    accepted: result.accepted,
    merged: result.merged,
    rejected: result.rejected,
  };
}

export async function runShiftImport(
  client: PrismaClient,
  csvText: string,
  fileName: string,
  source: ImportSource,
): Promise<ImportRunResult> {
  const result = importShifts(csvText);
  if ("error" in result) return { ok: false, error: result.error };

  const runId = await client.$transaction(
    async (tx) => {
      for (const outcome of result.outcomes) {
        if (outcome.status !== "accepted") continue;
        const { externalId, startsAt, endsAt, requirements } = outcome.data;

        const fields = {
          startsAt,
          endsAt,
          reqDoctor: requirements.doctor,
          reqNurse: requirements.nurse,
          reqReceptionist: requirements.receptionist,
        };

        await tx.shift.upsert({
          where: { externalId },
          update: fields,
          create: { externalId, ...fields },
        });
      }

      const run = await tx.importRun.create({
        data: {
          source,
          kind: "shifts",
          fileName,
          accepted: result.accepted,
          merged: result.merged,
          rejected: result.rejected,
          rows: { create: problemRows(result.outcomes) },
        },
      });

      return run.id;
    },
    { timeout: 30_000 },
  );

  return {
    ok: true,
    runId,
    accepted: result.accepted,
    merged: result.merged,
    rejected: result.rejected,
  };
}
