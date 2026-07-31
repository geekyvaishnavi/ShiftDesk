"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { claimShift, revalidateShiftClaims, type DroppedClaim } from "@/lib/claims";
import { computeShiftTimes } from "@/lib/import/shifts";
import { prisma } from "@/lib/prisma";

export type ShiftFormState = {
  error?: string;
  saved?: boolean;
  created?: boolean;
  assigned?: number;
  assignErrors?: string[];
  dropped?: DroppedClaim[];
};

/// The form posts the same three strings the CSV carries — a date and two
/// clock times — so it runs through the importer's own parser. That keeps one
/// definition of a legal shift: the UTC construction, the overnight roll, and
/// the zero-length and over-24-hour rejections are shared, not re-implemented.
function readShift(formData: FormData) {
  const timing = computeShiftTimes(
    String(formData.get("date") ?? ""),
    String(formData.get("start") ?? ""),
    String(formData.get("end") ?? ""),
  );
  if (!timing.ok) return { error: timing.reason } as const;

  const requirements = {
    reqDoctor: readCount(formData.get("reqDoctor")),
    reqNurse: readCount(formData.get("reqNurse")),
    reqReceptionist: readCount(formData.get("reqReceptionist")),
  };

  return { timing, requirements } as const;
}

function readCount(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? "0"));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(Math.floor(parsed), 99);
}

async function requireManagerAction() {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." } as const;
  if (user.role !== "manager") return { error: "Only managers can change shifts." } as const;
  return { user } as const;
}

function refresh() {
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}

export async function createShiftAction(
  _prev: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const auth = await requireManagerAction();
  if ("error" in auth) return { error: auth.error };

  const parsed = readShift(formData);
  if ("error" in parsed) return { error: parsed.error };

  const shift = await prisma.shift.create({
    data: {
      startsAt: parsed.timing.startsAt,
      endsAt: parsed.timing.endsAt,
      ...parsed.requirements,
    },
    select: { id: true },
  });

  // Anyone picked on the form goes through the same claim engine as every
  // other assignment, one at a time, so the capacity and overlap rules hold on
  // this path too. Some may be refused — a nurse already booked elsewhere —
  // and the shift still exists, so the outcome is reported per person rather
  // than failing the whole create.
  const picked = formData.getAll("assign").map(String).filter(Boolean);
  const assignErrors: string[] = [];
  let assigned = 0;

  for (const userId of picked) {
    const result = await claimShift({ actor: auth.user, userId, shiftId: shift.id });
    if (result.ok) assigned += 1;
    else assignErrors.push(result.message);
  }

  refresh();
  return { saved: true, created: true, assigned, assignErrors };
}

export async function updateShiftAction(
  _prev: ShiftFormState,
  formData: FormData,
): Promise<ShiftFormState> {
  const auth = await requireManagerAction();
  if ("error" in auth) return { error: auth.error };

  const shiftId = String(formData.get("shiftId") ?? "");
  if (!shiftId) return { error: "That shift is missing." };

  const parsed = readShift(formData);
  if ("error" in parsed) return { error: parsed.error };

  // The edit and the re-check share a transaction, so the shift is never
  // briefly visible holding claims that break its own rules.
  const dropped = await prisma.$transaction(async (tx) => {
    await tx.shift.update({
      where: { id: shiftId },
      data: {
        startsAt: parsed.timing.startsAt,
        endsAt: parsed.timing.endsAt,
        ...parsed.requirements,
      },
    });

    return revalidateShiftClaims(tx, shiftId);
  });

  refresh();
  return { saved: true, dropped };
}

export async function deleteShiftAction(formData: FormData): Promise<void> {
  const auth = await requireManagerAction();
  if ("error" in auth) return;

  const shiftId = String(formData.get("shiftId") ?? "");
  if (shiftId) {
    // Claims cascade with the shift, so nobody is left holding a slot on a
    // rota that no longer has it.
    await prisma.shift.delete({ where: { id: shiftId } });
  }

  refresh();
  redirect(`/dashboard?week=${String(formData.get("week") ?? "")}`);
}
