"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { claimShift, unclaimShift } from "@/lib/claims";

export type ActionState = { error?: string; notice?: string };

/// The actor always comes from the session. `userId` in the form is only ever
/// a target — a manager assigning someone — and the engine rejects it if the
/// actor is not allowed to act for that person.
async function actorAndTarget(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." } as const;

  const shiftId = String(formData.get("shiftId") ?? "");
  if (!shiftId) return { error: "That shift is missing." } as const;

  const requested = String(formData.get("userId") ?? "").trim();
  return { user, shiftId, userId: requested || user.id } as const;
}

function refresh() {
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}

export async function claimAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = await actorAndTarget(formData);
  if ("error" in parsed) return { error: parsed.error };

  const result = await claimShift({
    actor: parsed.user,
    userId: parsed.userId,
    shiftId: parsed.shiftId,
  });

  if (!result.ok) return { error: result.message };

  refresh();
  return {};
}

export async function releaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = await actorAndTarget(formData);
  if ("error" in parsed) return { error: parsed.error };

  const result = await unclaimShift({
    actor: parsed.user,
    userId: parsed.userId,
    shiftId: parsed.shiftId,
  });

  if (!result.ok) return { error: result.message };

  refresh();
  return {};
}
