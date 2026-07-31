import Link from "next/link";

import { formatWeekRange, shiftWeek, toDateParam, weekParam, type Week } from "@/lib/week";

const BUTTON =
  "border-hairline hover:bg-hover text-ink flex h-8 items-center rounded-md border px-2.5 text-[13px] transition";

const DATE_INPUT =
  "border-hairline bg-surface text-ink h-8 rounded-md border px-2 text-[13px] [color-scheme:light] dark:[color-scheme:dark]";

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

      {/* Stepping is fine for next week and useless for one in March, so any
          date is a way in: a plain GET form, since `?week=` already accepts a
          date and snaps it to that week. No JavaScript in the path. */}
      <form method="get" action={basePath} className="flex items-center gap-1.5">
        {Object.entries(params).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input
          type="date"
          name="week"
          defaultValue={weekParam(week)}
          aria-label="Jump to week"
          className={DATE_INPUT}
        />
        <button type="submit" className={BUTTON}>
          Go
        </button>
      </form>

      {trailing}
    </div>
  );
}
