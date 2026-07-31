import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { PROFESSION_LABELS, requiredFor } from "@/lib/coverage";
import type { Profession } from "@/lib/import/roles";
import { prisma } from "@/lib/prisma";
import { formatDayHeading, formatTime } from "@/lib/week";

/// Who is acting, which is not always who the claim is for: a manager may
/// assign someone else. Staff may only ever act on themselves.
export type Actor = { id: string; role: "manager" | "staff" };

export type ClaimErrorCode =
  | "not_allowed"
  | "shift_not_found"
  | "user_not_found"
  | "no_profession"
  | "already_claimed"
  | "not_claimed"
  | "profession_full"
  | "overlap";

export type ClaimOutcome =
  | { ok: true; claimId: string }
  | { ok: false; code: ClaimErrorCode; message: string };

export type UnclaimOutcome = { ok: true } | { ok: false; code: ClaimErrorCode; message: string };

/// A claim dropped by an edit, reported back so the manager learns who lost
/// the shift rather than finding out from the person.
export type DroppedClaim = {
  userId: string;
  fullName: string;
  reason: string;
};

function fail(code: ClaimErrorCode, message: string): { ok: false; code: ClaimErrorCode; message: string } {
  return { ok: false, code, message };
}

function describeShift(shift: { startsAt: Date; endsAt: Date }): string {
  return `${formatDayHeading(shift.startsAt)} ${formatTime(shift.startsAt)}–${formatTime(shift.endsAt)}`;
}

/// Two intervals overlap when each starts before the other ends. The
/// comparisons are strict, so a shift ending at 16:00 and one starting at
/// 16:00 are back-to-back rather than in conflict.
function overlapWhere(shiftId: string, startsAt: Date, endsAt: Date) {
  return {
    shiftId: { not: shiftId },
    shift: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  };
}

/// Takes the row lock the capacity check depends on. Two claims on one shift
/// serialize here, so the second reads the first's claim rather than a stale
/// count. Locking the shift and not the table leaves claims on other shifts
/// running in parallel.
async function lockShift(tx: Prisma.TransactionClient, shiftId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Shift" WHERE id = ${shiftId} FOR UPDATE
  `;
  return rows.length > 0;
}

/// The overlap rule spans shifts, so the shift lock alone would not stop one
/// person firing two claims at overlapping shifts at once. Locking the person
/// closes that. The order is always shift then user, so two transactions
/// cannot hold one lock each and wait on the other.
async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE
  `;
  return rows.length > 0;
}

/// One path for staff claiming and managers assigning, so the two cannot drift
/// apart. Every rule is checked here, inside the transaction — the UI hiding a
/// button is presentation, not enforcement.
export async function claimShift(args: {
  actor: Actor;
  userId: string;
  shiftId: string;
  client?: typeof prisma;
}): Promise<ClaimOutcome> {
  const { actor, userId, shiftId, client = prisma } = args;

  if (actor.role !== "manager" && actor.id !== userId) {
    return fail("not_allowed", "You can only claim shifts for yourself.");
  }

  try {
    return await client.$transaction(async (tx) => {
      if (!(await lockShift(tx, shiftId))) {
        return fail("shift_not_found", "That shift no longer exists.");
      }
      if (!(await lockUser(tx, userId))) {
        return fail("user_not_found", "That staff member no longer exists.");
      }

      const shift = await tx.shift.findUniqueOrThrow({
        where: { id: shiftId },
        select: {
          startsAt: true,
          endsAt: true,
          reqDoctor: true,
          reqNurse: true,
          reqReceptionist: true,
          claims: { select: { userId: true, user: { select: { profession: true } } } },
        },
      });

      const target = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { fullName: true, profession: true },
      });

      const self = actor.id === userId;
      const who = self ? "You are" : `${target.fullName} is`;

      // Managers hold no profession, so they fill no requirement. Letting one
      // claim would put a body on the rota that coverage does not count.
      if (!target.profession) {
        return fail(
          "no_profession",
          self
            ? "Managers do not have a profession, so you cannot claim shifts. Assign a staff member instead."
            : `${target.fullName} has no profession and cannot be assigned to a shift.`,
        );
      }

      const profession: Profession = target.profession;
      const label = PROFESSION_LABELS[profession];

      if (shift.claims.some((claim) => claim.userId === userId)) {
        return fail(
          "already_claimed",
          self ? "You have already claimed this shift." : `${target.fullName} is already on this shift.`,
        );
      }

      const required = requiredFor(shift, profession);
      const filled = shift.claims.filter((c) => c.user.profession === profession).length;

      if (required === 0) {
        return fail("profession_full", `This shift does not need a ${label.one}.`);
      }
      if (filled >= required) {
        return fail(
          "profession_full",
          `This shift already has all ${required} ${required === 1 ? label.one : label.many} it needs.`,
        );
      }

      const conflict = await tx.claim.findFirst({
        where: { userId, ...overlapWhere(shiftId, shift.startsAt, shift.endsAt) },
        select: { shift: { select: { startsAt: true, endsAt: true } } },
      });

      if (conflict) {
        return fail(
          "overlap",
          `${who} already on an overlapping shift (${describeShift(conflict.shift)}).`,
        );
      }

      const claim = await tx.claim.create({ data: { userId, shiftId }, select: { id: true } });
      return { ok: true as const, claimId: claim.id };
    });
  } catch (error) {
    // The unique pair is the last line of defence if two identical claims ever
    // slip past the lock; report it as the rule it enforces, not as a crash.
    if (isUniqueViolation(error)) {
      return fail("already_claimed", "That shift has already been claimed by this person.");
    }
    throw error;
  }
}

export async function unclaimShift(args: {
  actor: Actor;
  userId: string;
  shiftId: string;
  client?: typeof prisma;
}): Promise<UnclaimOutcome> {
  const { actor, userId, shiftId, client = prisma } = args;

  if (actor.role !== "manager" && actor.id !== userId) {
    return fail("not_allowed", "You can only release shifts for yourself.");
  }

  const deleted = await client.claim.deleteMany({ where: { userId, shiftId } });
  if (deleted.count === 0) {
    return fail("not_claimed", "That claim no longer exists.");
  }
  return { ok: true };
}

/// Re-applies both rules to a shift's existing claims, for use straight after
/// an edit. Claims that still fit are left alone; the rest are dropped and
/// returned. Must run inside the same transaction as the edit, so a shift is
/// never briefly visible with claims that break its own rules.
export async function revalidateShiftClaims(
  tx: Prisma.TransactionClient,
  shiftId: string,
): Promise<DroppedClaim[]> {
  const shift = await tx.shift.findUnique({
    where: { id: shiftId },
    select: {
      startsAt: true,
      endsAt: true,
      reqDoctor: true,
      reqNurse: true,
      reqReceptionist: true,
      claims: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          userId: true,
          user: { select: { fullName: true, profession: true } },
        },
      },
    },
  });

  if (!shift) return [];

  const dropped: DroppedClaim[] = [];
  const doomed = new Set<string>();

  // Capacity first. Claims are ordered oldest first, so when requirements drop
  // the people who claimed most recently are the ones who lose the shift.
  const seen: Record<string, number> = {};
  for (const claim of [...shift.claims].reverse()) {
    const profession = claim.user.profession;
    if (!profession) {
      doomed.add(claim.id);
      dropped.push({
        userId: claim.userId,
        fullName: claim.user.fullName,
        reason: "no longer has a profession",
      });
      continue;
    }

    const required = requiredFor(shift, profession);
    const kept = seen[profession] ?? 0;

    if (kept >= required) {
      doomed.add(claim.id);
      const label = PROFESSION_LABELS[profession];
      dropped.push({
        userId: claim.userId,
        fullName: claim.user.fullName,
        reason:
          required === 0
            ? `the shift no longer needs a ${label.one}`
            : `the shift now needs only ${required} ${required === 1 ? label.one : label.many}`,
      });
      continue;
    }

    seen[profession] = kept + 1;
  }

  // Then overlap, against the new time, for whoever is still on the shift.
  const survivors = shift.claims.filter((claim) => !doomed.has(claim.id));

  if (survivors.length > 0) {
    const conflicts = await tx.claim.findMany({
      where: {
        userId: { in: survivors.map((claim) => claim.userId) },
        ...overlapWhere(shiftId, shift.startsAt, shift.endsAt),
      },
      select: { userId: true, shift: { select: { startsAt: true, endsAt: true } } },
    });

    const conflictByUser = new Map(conflicts.map((c) => [c.userId, c.shift]));

    for (const claim of survivors) {
      const other = conflictByUser.get(claim.userId);
      if (!other) continue;

      doomed.add(claim.id);
      dropped.push({
        userId: claim.userId,
        fullName: claim.user.fullName,
        reason: `the new time overlaps their shift on ${describeShift(other)}`,
      });
    }
  }

  if (doomed.size > 0) {
    await tx.claim.deleteMany({ where: { id: { in: [...doomed] } } });
  }

  return dropped;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
