"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; badge?: string };

/// Active state needs the current URL, which only a client component can read.
/// Matching on the path prefix keeps Shifts lit while its child routes are
/// open — creating and editing a shift are still being on Shifts.
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return pathname.startsWith(href.split("?")[0]);
  }

  return (
    <nav className="flex gap-1 md:flex-col">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-8 items-center justify-between gap-2 rounded-md px-2 text-[13px] transition ${
              active ? "bg-hover text-ink font-semibold" : "text-muted hover:bg-hover"
            }`}
          >
            <span>{item.label}</span>
            {item.badge ? <span className="text-muted tnum text-[11px]">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
