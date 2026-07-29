import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "manager" ? "/dashboard" : "/shifts");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">ShiftDesk</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Sign in to manage clinic shifts.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
