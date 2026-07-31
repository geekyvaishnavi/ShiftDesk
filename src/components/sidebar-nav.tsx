"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type NavItem = { href: string; label: string; badge?: string };

/// Active state needs the current URL, which only a client component can read.
/// Assign and Shifts share a path and differ by query, so the check compares
/// both when the item carries one.
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const search = useSearchParams();

  function isActive(href: string): boolean {
    const [path, query] = href.split("?");
    if (!pathname.startsWith(path)) return false;
    if (query) return search.get("needs") === "1";
    return path !== "/shifts" || search.get("needs") !== "1";
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
