import "server-only";

import { prisma } from "@/lib/prisma";
import { parseWeekParam, weekOf, type Week } from "@/lib/week";

/// Everything a shift row needs to render: its requirements and who is on it.
/// Claims come back oldest first, which is also the order seniority is decided
/// in when an edit has to drop someone.
const SHIFT_SELECT = {
  id: true,
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
      user: { select: { id: true, fullName: true, profession: true } },
    },
  },
} as const;

export type WeekShift = Awaited<ReturnType<typeof getWeekShifts>>[number];

/// A shift belongs to the week it starts in, so an overnight shift stays on
/// the day it began rather than splitting across two weeks.
export async function getWeekShifts(week: Week) {
  return prisma.shift.findMany({
    where: { startsAt: { gte: week.start, lt: week.end } },
    orderBy: { startsAt: "asc" },
    select: SHIFT_SELECT,
  });
}

export async function getStaff() {
  return prisma.user.findMany({
    where: { role: "staff" },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, profession: true },
  });
}

export type StaffOption = Awaited<ReturnType<typeof getStaff>>[number];

/// Shifts a staff member has claimed in a week, for their own list.
export async function getMyWeekShifts(userId: string, week: Week) {
  return prisma.shift.findMany({
    where: {
      startsAt: { gte: week.start, lt: week.end },
      claims: { some: { userId } },
    },
    orderBy: { startsAt: "asc" },
    select: SHIFT_SELECT,
  });
}

/// The two numbers beside the staff nav items. Counting in one place keeps the
/// badge and the page it points at from disagreeing.
export async function getStaffCounts(
  userId: string,
  profession: "doctor" | "nurse" | "receptionist" | null,
  week: Week,
) {
  const [all, mine] = await Promise.all([
    getWeekShifts(week),
    prisma.shift.count({
      where: { startsAt: { gte: week.start, lt: week.end }, claims: { some: { userId } } },
    }),
  ]);

  if (!profession) return { open: 0, mine };

  const open = all.filter((shift) => {
    if (shift.claims.some((claim) => claim.userId === userId)) return false;
    const required =
      profession === "doctor"
        ? shift.reqDoctor
        : profession === "nurse"
          ? shift.reqNurse
          : shift.reqReceptionist;
    const filled = shift.claims.filter((c) => c.user.profession === profession).length;
    return required > filled;
  }).length;

  return { open, mine };
}

/// An explicit `?week=` always wins. Without one, the current week is right
/// unless it is empty — the seeded rota sits in a fixed month, and landing on
/// a blank week reads as a failed import rather than a quiet week.
export async function resolveWeek(param: string | undefined): Promise<Week> {
  const now = new Date();
  if (param) return parseWeekParam(param, now);

  const current = weekOf(now);
  const inCurrent = await prisma.shift.count({
    where: { startsAt: { gte: current.start, lt: current.end } },
  });
  if (inCurrent > 0) return current;

  const earliest = await prisma.shift.findFirst({
    orderBy: { startsAt: "asc" },
    select: { startsAt: true },
  });

  return earliest ? weekOf(earliest.startsAt) : current;
}
