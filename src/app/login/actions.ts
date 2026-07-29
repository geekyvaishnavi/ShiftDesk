"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = { error?: string };

export async function login( _prev: LoginState, formData: FormData, ): Promise<LoginState> {
  
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  const invalid = { error: "Email or password is incorrect." };
  if (!user) return invalid;

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) return invalid;

  await createSession({ userId: user.id, role: user.role });

  redirect(user.role === "manager" ? "/dashboard" : "/shifts");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
