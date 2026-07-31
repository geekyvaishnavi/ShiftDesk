import Link from "next/link";

import { ShiftCard } from "@/components/shift-card";
import { StatusMark } from "@/components/status-pill";
import { WeekNav } from "@/components/week-nav";
import { requireManager } from "@/lib/auth";
import {
  PROFESSIONS,
  PROFESSION_LABELS,
  computeCoverage,
  countClaimsByProfession,
  type CoverageStatus,
} from "@/lib/coverage";
import { getWeekShifts, resolveWeek } from "@/lib/shifts";
import {
  daysOf,
  formatDayNumber,
  formatWeekday,
  isSameUTCDay,
  weekParam,
  type Week,
} from "@/lib/week";

const STATUS_ORDER: CoverageStatus[] = ["full", "partial", "empty"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requireManager();
  const params = await searchParams;
  const week = await resolveWeek(params.week);

  const shifts = await getWeekShifts(week);
  const rows = shifts.map((shift) => ({
    shift,
    coverage: computeCoverage(shift, countClaimsByProfession(shift.claims)),
  }));

  const counts: Record<CoverageStatus, number> = { full: 0, partial: 0, empty: 0 };
  const missingByProfession: Record<string, number> = {};
  let totalSlots = 0;
  let slotsShort = 0;

  for (const { coverage } of rows) {
    counts[coverage.status] += 1;
    totalSlots += coverage.totalRequired;
    for (const gap of coverage.missing) {
      missingByProfession[gap.profession] = (missingByProfession[gap.profession] ?? 0) + gap.missing;
      slotsShort += gap.missing;
    }
  }

  const professionsInUse = PROFESSIONS.filter((profession) =>
    rows.some(({ coverage }) =>
      coverage.byProfession.some((p) => p.profession === profession && p.required > 0),
    ),
  ).length;

  // The biggest shortage is the one a manager acts on first, so it leads the
  // subtitle rather than being buried in a list.
  const worst = PROFESSIONS.map((profession) => ({
    profession,
    missing: missingByProfession[profession] ?? 0,
  }))
    .filter((p) => p.missing > 0)
    .sort((a, b) => b.missing - a.missing)[0];

  const emptyDays = [
    ...new Set(
      rows.filter((row) => row.coverage.status === "empty").map((row) => formatWeekday(row.shift.startsAt)),
    ),
  ];

  const days = daysOf(week);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <WeekNav week={week} basePath="/dashboard" trailing={<NewShiftButton week={week} />} />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Shifts this week"
          value={rows.length}
          detail={
            rows.length === 0
              ? "Nothing scheduled"
              : `${totalSlots} ${totalSlots === 1 ? "slot" : "slots"} across ${professionsInUse} ${professionsInUse === 1 ? "profession" : "professions"}`
          }
        />
        <Tile
          label="Fully staffed"
          value={counts.full}
          tone="ok"
          detail={
            rows.length === 0
              ? "Nothing scheduled"
              : counts.full === rows.length
                ? "Every shift this week"
                : `${Math.round((counts.full / rows.length) * 100)}% of the week covered`
          }
        />
        <Tile
          label="Empty"
          value={counts.empty}
          tone="gap"
          detail={
            counts.empty === 0
              ? "Every shift has someone"
              : `${emptyDays.slice(0, 3).join(", ")} — nobody claimed`
          }
        />
        <Tile
          label="Partially staffed"
          value={counts.partial}
          tone="warn"
          detail={
            worst
              ? `${slotsShort} ${slotsShort === 1 ? "slot" : "slots"} short, ${worst.missing} of them ${worst.missing === 1 ? PROFESSION_LABELS[worst.profession].one : PROFESSION_LABELS[worst.profession].many}`
              : "No gaps left"
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <p className="text-muted text-[11px] font-semibold tracking-wide uppercase">
          Shifts this week
        </p>
        {STATUS_ORDER.map((status) => (
          <StatusMark key={status} status={status} />
        ))}
        {slotsShort > 0 ? (
          <Link
            href={`/shifts?needs=1&week=${weekParam(week)}`}
            className="text-accent ml-auto text-[13px] font-medium hover:underline"
          >
            Fill these →
          </Link>
        ) : null}
      </div>

      {/* The week is always seven columns — a day is a column, and a week you
          have to read in two rows is not a week at a glance. Narrow screens
          scroll this strip sideways rather than reflowing it, and the negative
          margin lets it run to the edge of the page instead of stopping short
          inside the padding. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        <div className="grid min-w-[1120px] grid-cols-7 gap-3">
          {days.map((day) => {
            const forDay = rows.filter((row) => isSameUTCDay(row.shift.startsAt, day));
            const gaps = forDay.reduce(
              (sum, row) => sum + row.coverage.missing.reduce((n, p) => n + p.missing, 0),
              0,
            );

            return (
              <section key={day.toISOString()} className="flex min-w-0 flex-col gap-2">
                <div className="border-hairline flex items-baseline gap-1.5 border-b pb-1.5">
                  <span className="text-muted text-[11px] font-semibold tracking-wide uppercase">
                    {formatWeekday(day)}
                  </span>
                  <span className="text-ink tnum text-[13px] font-semibold">
                    {formatDayNumber(day)}
                  </span>
                  {gaps > 0 ? (
                    <span className="text-muted tnum ml-auto text-[11px]">
                      {gaps} {gaps === 1 ? "gap" : "gaps"}
                    </span>
                  ) : null}
                </div>

                {forDay.length === 0 ? (
                  <p className="text-muted/60 text-[12px]">—</p>
                ) : (
                  forDay.map(({ shift, coverage }) => (
                    <ShiftCard
                      key={shift.id}
                      shift={shift}
                      coverage={coverage}
                      showPeople={false}
                    />
                  ))
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NewShiftButton({ week }: { week: Week }) {
  return (
    <Link
      href={`/shifts?new=1&week=${weekParam(week)}`}
      className="bg-plum flex h-8 flex-none items-center rounded-md px-3 text-[13px] font-medium text-white transition hover:opacity-90"
    >
      New shift
    </Link>
  );
}

const DOTS = {
  plain: "",
  ok: "bg-ok",
  warn: "bg-warn",
  gap: "bg-gap",
} as const;

/// The number stays in the text colour whatever it counts. A tile reading "2"
/// in red says nothing "Empty · 2" does not, and three coloured numerals in a
/// row turn a summary into an alarm.
function Tile({
  label,
  value,
  detail,
  tone = "plain",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: keyof typeof DOTS;
}) {
  return (
    <div className="border-hairline bg-surface rounded-lg border p-3.5">
      <p className="text-muted flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
        {tone === "plain" ? null : (
          <span className={`${DOTS[tone]} h-1.5 w-1.5 flex-none rounded-full`} aria-hidden />
        )}
        {label}
      </p>
      <p className="text-ink tnum mt-1 text-2xl font-semibold">{value}</p>
      <p className="text-muted mt-1 text-[12px]">{detail}</p>
    </div>
  );
}
