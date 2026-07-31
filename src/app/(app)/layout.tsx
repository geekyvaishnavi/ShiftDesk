import Link from "next/link";

import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { requireUser } from "@/lib/auth";
import type { Profession } from "@/lib/import/roles";
import { getStaffCounts, resolveWeek } from "@/lib/shifts";

import { logout } from "../login/actions";

/// Assigning is a filter on the shifts page, not a place of its own, so it
/// lives as a chip there rather than as a second nav entry pointing at the
/// same route.
const MANAGER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Coverage" },
  { href: "/shifts", label: "Shifts" },
  { href: "/import", label: "Import" },
];

/// Staff see two lists, not one: what they could take, and what they hold.
/// The counts come from the same queries the pages run, so a badge cannot
/// promise something the page then fails to show.
async function staffNav(user: { id: string; profession: Profession | null }): Promise<NavItem[]> {
  const week = await resolveWeek(undefined);
  const counts = await getStaffCounts(user.id, user.profession, week);

  return [
    { href: "/shifts", label: "Open shifts", badge: String(counts.open) },
    { href: "/my-shifts", label: "My shifts", badge: String(counts.mine) },
  ];
}

/// Every route in this group is signed-in, so the check lives here rather than
/// in each page. Layouts may read cookies, and `requireUser` redirects to
/// /login when there is no valid session.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = user.role === "manager" ? MANAGER_NAV : await staffNav(user);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="border-hairline bg-surface flex flex-col gap-3 border-b p-3 md:sticky md:top-0 md:h-dvh md:w-56 md:flex-none md:border-r md:border-b-0">
        <div className="flex items-center gap-2">
          {/* The mark is aria-hidden, so the wording carries the link's name. */}
          <Link href="/" className="hover:bg-hover -m-1 flex items-center gap-2 rounded-md p-1">
            <Wordmark size={22} />
            <span className="text-ink text-[13px] font-semibold">ShiftDesk</span>
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* SidebarNav reads the pathname, which a layout cannot see, so the
            active state has to be decided on the client. */}
        <SidebarNav items={items} />

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
