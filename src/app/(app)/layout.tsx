import { Suspense } from "react";

import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { requireUser } from "@/lib/auth";

import { logout } from "../login/actions";

const MANAGER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Coverage" },
  { href: "/shifts", label: "Shifts" },
  { href: "/shifts?needs=1", label: "Needs cover" },
  { href: "/import", label: "Import" },
];

const STAFF_NAV: NavItem[] = [{ href: "/shifts", label: "Shifts" }];

/// Every route in this group is signed-in, so the check lives here rather than
/// in each page. Layouts may read cookies, and `requireUser` redirects to
/// /login when there is no valid session.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = user.role === "manager" ? MANAGER_NAV : STAFF_NAV;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="border-hairline bg-surface flex flex-col gap-3 border-b p-3 md:sticky md:top-0 md:h-dvh md:w-56 md:flex-none md:border-r md:border-b-0">
        <div className="flex items-center gap-2">
          <Wordmark size={22} />
          <span className="text-ink text-[13px] font-semibold">ShiftDesk</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* SidebarNav reads the query string, which a layout cannot see —
            hence a client component, and a boundary around it. */}
        <Suspense fallback={<div className="h-8" />}>
          <SidebarNav items={items} />
        </Suspense>

        <div className="border-hairline mt-auto flex items-center gap-2 border-t pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-ink truncate text-[13px] font-medium">{user.fullName}</p>
            <p className="text-muted truncate text-[11px] capitalize">
              {user.profession ?? user.role}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="text-muted hover:bg-hover hover:text-ink rounded-md px-2 py-1 text-[12px] transition"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
