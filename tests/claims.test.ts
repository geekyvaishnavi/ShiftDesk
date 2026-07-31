import { beforeEach, describe, expect, test } from "bun:test";

import { claimShift } from "@/lib/claims";
import type { Profession } from "@/lib/import/roles";
import { prisma } from "@/lib/prisma";

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "Claim", "Shift", "User", "ImportRow", "ImportRun" RESTART IDENTITY CASCADE`,
  );
});

let seq = 0;

async function makeStaff(profession: Profession, fullName = `Staff ${++seq}`) {
  return prisma.user.create({
    data: {
      email: `staff${seq}@clinicmail.test`,
      passwordHash: "not-used-here",
      fullName,
      role: "staff",
      profession,
    },
    select: { id: true, fullName: true },
  });
}

async function makeManager() {
  return prisma.user.create({
    data: {
      email: `manager${++seq}@clinicmail.test`,
      passwordHash: "not-used-here",
      fullName: "The Manager",
      role: "manager",
    },
    select: { id: true },
  });
}

/// Times are UTC, matching how the importer writes them.
async function makeShift(
  startsAt: string,
  endsAt: string,
  requirements: { doctor?: number; nurse?: number; receptionist?: number } = { nurse: 1 },
) {
  return prisma.shift.create({
    data: {
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      reqDoctor: requirements.doctor ?? 0,
      reqNurse: requirements.nurse ?? 0,
      reqReceptionist: requirements.receptionist ?? 0,
    },
    select: { id: true },
  });
}

function asSelf(user: { id: string }) {
  return { id: user.id, role: "staff" as const };
}

describe("capacity", () => {
  test("a claim succeeds while the profession has room", async () => {
    const nurse = await makeStaff("nurse");
    const shift = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z", { nurse: 1 });

    const result = await claimShift({
      actor: asSelf(nurse),
      userId: nurse.id,
      shiftId: shift.id,
    });

    expect(result.ok).toBe(true);
  });

  test("a claim is refused once the profession is full", async () => {
    const first = await makeStaff("nurse");
    const second = await makeStaff("nurse");
    const shift = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z", { nurse: 1 });

    await claimShift({ actor: asSelf(first), userId: first.id, shiftId: shift.id });
    const result = await claimShift({
      actor: asSelf(second),
      userId: second.id,
      shiftId: shift.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("profession_full");
      expect(result.message.toLowerCase()).toContain("nurse");
    }
  });

  test("a full profession does not block a different one on the same shift", async () => {
    const nurse = await makeStaff("nurse");
    const doctor = await makeStaff("doctor");
    const shift = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z", {
      nurse: 1,
      doctor: 1,
    });

    await claimShift({ actor: asSelf(nurse), userId: nurse.id, shiftId: shift.id });
    const result = await claimShift({
      actor: asSelf(doctor),
      userId: doctor.id,
      shiftId: shift.id,
    });

    expect(result.ok).toBe(true);
  });
});

describe("overlap", () => {
  test("a second shift over the same hours is refused", async () => {
    const nurse = await makeStaff("nurse");
    const morning = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z");
    const clashing = await makeShift("2026-08-05T12:00:00Z", "2026-08-05T20:00:00Z");

    await claimShift({ actor: asSelf(nurse), userId: nurse.id, shiftId: morning.id });
    const result = await claimShift({
      actor: asSelf(nurse),
      userId: nurse.id,
      shiftId: clashing.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("overlap");
  });

  test("back-to-back shifts are not an overlap", async () => {
    const nurse = await makeStaff("nurse");
    const early = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z");
    const late = await makeShift("2026-08-05T16:00:00Z", "2026-08-06T00:00:00Z");

    await claimShift({ actor: asSelf(nurse), userId: nurse.id, shiftId: early.id });
    const result = await claimShift({ actor: asSelf(nurse), userId: nurse.id, shiftId: late.id });

    // Treating a handover as a clash would cost the clinic every one of them.
    expect(result.ok).toBe(true);
  });

  test("an overlap is detected across midnight", async () => {
    const nurse = await makeStaff("nurse");
    // The clash is four hours, on a different calendar day from where the
    // night shift started.
    const night = await makeShift("2026-08-05T22:00:00Z", "2026-08-06T06:00:00Z");
    const morning = await makeShift("2026-08-06T04:00:00Z", "2026-08-06T12:00:00Z");

    await claimShift({ actor: asSelf(nurse), userId: nurse.id, shiftId: night.id });
    const result = await claimShift({
      actor: asSelf(nurse),
      userId: nurse.id,
      shiftId: morning.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("overlap");
  });
});

describe("who may act", () => {
  test("staff cannot claim on behalf of someone else", async () => {
    const nurse = await makeStaff("nurse");
    const colleague = await makeStaff("nurse");
    const shift = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z");

    const result = await claimShift({
      actor: asSelf(nurse),
      userId: colleague.id,
      shiftId: shift.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_allowed");
  });

  test("a manager assigning is held to the same capacity rule", async () => {
    const manager = await makeManager();
    const first = await makeStaff("nurse");
    const second = await makeStaff("nurse");
    const shift = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z", { nurse: 1 });

    const actor = { id: manager.id, role: "manager" as const };
    await claimShift({ actor, userId: first.id, shiftId: shift.id });
    const result = await claimShift({ actor, userId: second.id, shiftId: shift.id });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("profession_full");
  });

  test("a manager assigning is held to the same overlap rule", async () => {
    const manager = await makeManager();
    const nurse = await makeStaff("nurse");
    const morning = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z");
    const clashing = await makeShift("2026-08-05T12:00:00Z", "2026-08-05T20:00:00Z");

    const actor = { id: manager.id, role: "manager" as const };
    await claimShift({ actor, userId: nurse.id, shiftId: morning.id });
    const result = await claimShift({ actor, userId: nurse.id, shiftId: clashing.id });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("overlap");
  });
});

/// The reason the claim path takes row locks at all. Everything above would
/// still pass if the rules were checked without one — these two would not.
describe("concurrency", () => {
  test("eight nurses claiming one slot at once: exactly one gets it", async () => {
    const shift = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z", { nurse: 1 });
    const nurses = await Promise.all(Array.from({ length: 8 }, () => makeStaff("nurse")));

    const results = await Promise.all(
      nurses.map((nurse) =>
        claimShift({ actor: asSelf(nurse), userId: nurse.id, shiftId: shift.id }),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(1);

    for (const result of results) {
      if (!result.ok) expect(result.code).toBe("profession_full");
    }

    expect(await prisma.claim.count({ where: { shiftId: shift.id } })).toBe(1);
  });

  test("three slots claimed by eight at once: exactly three get in", async () => {
    const shift = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z", { nurse: 3 });
    const nurses = await Promise.all(Array.from({ length: 8 }, () => makeStaff("nurse")));

    const results = await Promise.all(
      nurses.map((nurse) =>
        claimShift({ actor: asSelf(nurse), userId: nurse.id, shiftId: shift.id }),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(await prisma.claim.count({ where: { shiftId: shift.id } })).toBe(3);
  });

  test("two professions claiming at once both succeed", async () => {
    const shift = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z", {
      nurse: 1,
      doctor: 1,
    });
    const nurse = await makeStaff("nurse");
    const doctor = await makeStaff("doctor");

    const [first, second] = await Promise.all([
      claimShift({ actor: asSelf(nurse), userId: nurse.id, shiftId: shift.id }),
      claimShift({ actor: asSelf(doctor), userId: doctor.id, shiftId: shift.id }),
    ]);

    // A lock on the table rather than the row would refuse one of these a slot
    // that was free.
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  test("one person firing two overlapping claims at once: only one lands", async () => {
    const nurse = await makeStaff("nurse");
    const morning = await makeShift("2026-08-05T08:00:00Z", "2026-08-05T16:00:00Z");
    const clashing = await makeShift("2026-08-05T12:00:00Z", "2026-08-05T20:00:00Z");

    // Different shifts, so the two claims never contend for the same shift
    // row. This is the case the user lock exists for.
    const results = await Promise.all([
      claimShift({ actor: asSelf(nurse), userId: nurse.id, shiftId: morning.id }),
      claimShift({ actor: asSelf(nurse), userId: nurse.id, shiftId: clashing.id }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await prisma.claim.count({ where: { userId: nurse.id } })).toBe(1);
  });
});
