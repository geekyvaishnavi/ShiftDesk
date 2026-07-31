import { redirect } from "next/navigation";

import { Wordmark } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_STAFF_PASSWORD } from "@/lib/import/run";
import { prisma } from "@/lib/prisma";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "manager" ? "/dashboard" : "/shifts");

  // Read a real seeded account rather than hardcoding one, so the hint cannot
  // drift from what the importer actually created.
  const [manager, staff] = await Promise.all([
    prisma.user.findFirst({ where: { role: "manager" }, select: { email: true } }),
    prisma.user.findFirst({
      where: { role: "staff" },
      orderBy: { fullName: "asc" },
      select: { email: true },
    }),
  ]);

  return (
    <main className="bg-canvas flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <Wordmark size={30} />
          <div>
            <h1 className="text-ink text-lg leading-tight font-semibold">ShiftDesk</h1>
            <p className="text-muted text-[12px]">Clinic shift scheduling</p>
          </div>
        </div>

        <div className="border-hairline bg-surface mt-5 rounded-xl border p-6">
          <h2 className="text-ink text-[15px] font-semibold">Sign in</h2>
          <p className="text-muted mt-0.5 mb-5 text-[12px]">
            Managers open on coverage, staff on the shifts they can claim.
          </p>
          <LoginForm />
        </div>

        {manager || staff ? (
          <div className="border-hairline mt-4 rounded-xl border border-dashed p-4">
            <p className="text-muted text-[11px] font-semibold tracking-wide uppercase">
              Seeded logins
            </p>
            <dl className="mt-2 flex flex-col gap-1.5">
              {manager ? <Credential role="Manager" email={manager.email} /> : null}
              {staff ? <Credential role="Staff" email={staff.email} /> : null}
            </dl>
            <p className="text-muted mt-2 text-[11px]">
              Password for both: <span className="text-ink font-mono">{DEFAULT_STAFF_PASSWORD}</span>
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Credential({ role, email }: { role: string; email: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="text-muted w-16 flex-none text-[12px]">{role}</dt>
      <dd className="text-ink font-mono text-[12px] break-all">{email}</dd>
    </div>
  );
}
