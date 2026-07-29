import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: "manager" | "staff";
  profession: "doctor" | "nurse" | "receptionist" | null;
};

// cache() dedupes this per request, so several components asking "who is the
// user" hit the database once, not once each.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      profession: true,
    },
  });

  return user ?? null;
});

// For pages.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireManager(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "manager") redirect("/shifts");
  return user;
}

// For route handlers, which need a Response rather than a redirect.
export async function apiRequireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false as const,
      response: Response.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  return { ok: true as const, user };
}

export async function apiRequireManager() {
  const result = await apiRequireUser();
  if (!result.ok) return result;

  if (result.user.role !== "manager") {
    return {
      ok: false as const,
      response: Response.json({ error: "Managers only" }, { status: 403 }),
    };
  }
  return result;
}
