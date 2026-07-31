import { redirect } from "next/navigation";

import { Wordmark } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/auth";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "manager" ? "/dashboard" : "/shifts");

  return (
    <main className="bg-canvas flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="border-hairline bg-surface w-full max-w-sm rounded-xl border p-8">
        <div className="flex items-center gap-2">
          <Wordmark size={26} />
          <h1 className="text-ink text-lg font-semibold">ShiftDesk</h1>
        </div>
        <p className="text-muted mt-1.5 mb-6 text-sm">Sign in to manage clinic shifts.</p>
        <LoginForm />
      </div>
    </main>
  );
}
