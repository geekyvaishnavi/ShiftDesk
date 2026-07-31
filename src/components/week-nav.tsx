import Link from "next/link";

import { formatWeekRange, shiftWeek, toDateParam, weekParam, type Week } from "@/lib/week";

const BUTTON =
  "border-hairline hover:bg-hover text-ink flex h-8 items-center rounded-md border px-2.5 text-[13px] transition";

/// The week lives in the URL, so a week can be linked, bookmarked and shared,
/// and the back button steps through weeks the way you would expect.
export function WeekNav({
  week,
  basePath,
  params = {},
  trailing,
}: {
  week: Week;
  basePath: string;
  params?: Record<string, string>;
  trailing?: React.ReactNode;
}) {
  function href(target: Week): string {
    const query = new URLSearchParams({ ...params, week: weekParam(target) });
    return `${basePath}?${query}`;
  }

  const thisWeek = `${basePath}?${new URLSearchParams({ ...params, week: toDateParam(new Date()) })}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-ink mr-auto text-[15px] font-semibold">{formatWeekRange(week)}</h1>
      <nav className="flex items-center gap-1.5" aria-label="Change week">
        <Link href={href(shiftWeek(week, -1))} className={BUTTON} aria-label="Previous week">
          ←
        </Link>
        <Link href={thisWeek} className={BUTTON}>
          This week
        </Link>
        <Link href={href(shiftWeek(week, 1))} className={BUTTON} aria-label="Next week">
          →
        </Link>
      </nav>
      {trailing}
    </div>
  );
}
