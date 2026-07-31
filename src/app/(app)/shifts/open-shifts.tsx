import Link from "next/link";

import { WeekNav } from "@/components/week-nav";
import { PROFESSION_LABELS, describeMissing, type Coverage } from "@/lib/coverage";
import type { Profession } from "@/lib/import/roles";
import { formatHours, isNightShift, shiftHours } from "@/lib/shift-time";
import type { WeekShift } from "@/lib/shifts";
import { formatDayHeading, formatTime, isSameUTCDay, weekParam, type Week } from "@/lib/week";

import { ClaimButton } from "./claim-controls";

export type OpenRow = { shift: WeekShift; coverage: Coverage };

const FILTERS = [
  { key: "", label: "All open" },
  { key: "day", label: "Day shifts" },
  { key: "night", label: "Nights" },
] as const;

export function OpenShifts({
  week,
  rows,
  profession,
  filter,
}: {
  week: Week;
  rows: OpenRow[];
  profession: Profession;
  filter: string;
}) {
  const visible = rows.filter(({ shift }) => {
    if (filter === "day") return !isNightShift(shift.startsAt);
    if (filter === "night") return isNightShift(shift.startsAt);
    return true;
  });

  return (
    <>
      {/* The same week header the manager's pages use, so stepping weeks,
          returning to this one and jumping to a date work identically
          whichever role is signed in. */}
      <WeekNav week={week} basePath="/shifts" params={filter ? { when: filter } : {}} />

      <p className="text-muted -mt-2 text-[13px]">
        Shifts you’re eligible for as a {PROFESSION_LABELS[profession].one}.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => {
          const href = option.key
            ? `/shifts?when=${option.key}&week=${weekParam(week)}`
            : `/shifts?week=${weekParam(week)}`;
          const active = filter === option.key;

          return (
            <Link
              key={option.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`h-8 rounded-md px-3 text-[13px] leading-8 transition ${
                active
                  ? "bg-plum font-medium text-white"
                  : "border-hairline text-ink hover:bg-hover border"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
        <p className="text-muted ml-auto text-[12px]">
          {visible.length} {visible.length === 1 ? "shift" : "shifts"}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted border-hairline rounded-lg border border-dashed p-8 text-center text-sm">
          Nothing open for you this week. Try another week, or check My shifts.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map(({ shift, coverage }) => (
            <OpenShiftCard key={shift.id} shift={shift} coverage={coverage} profession={profession} />
          ))}
        </div>
      )}
    </>
  );
}

function OpenShiftCard({
  shift,
  coverage,
  profession,
}: {
  shift: WeekShift;
  coverage: Coverage;
  profession: Profession;
}) {
  const overnight = !isSameUTCDay(shift.startsAt, shift.endsAt);
  const mine = coverage.byProfession.find((p) => p.profession === profession);
  const hours = shiftHours(shift);

  return (
    <article className="border-hairline bg-surface flex flex-wrap items-center gap-3 rounded-lg border p-4">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="tnum text-ink text-[15px] font-semibold">
            {formatTime(shift.startsAt)} – {formatTime(shift.endsAt)}
          </span>
          <span className="text-muted text-[13px]">{formatDayHeading(shift.startsAt)}</span>
          {overnight ? <span className="text-muted text-[12px]">+1 day</span> : null}
        </p>

        <p className="text-muted mt-1 text-[13px]">
          Needs {describeMissing(coverage)}
          {mine ? (
            <>
              {" · "}
              <span className="tnum">
                {mine.filled} of {mine.required}
              </span>{" "}
              {mine.required === 1
                ? PROFESSION_LABELS[profession].one
                : PROFESSION_LABELS[profession].many}{" "}
              filled
            </>
          ) : null}
        </p>

        <p className="text-muted mt-0.5 text-[12px]">
          <span className="tnum">{formatHours(hours)}</span> hours
          {overnight ? ` · ends ${formatDayHeading(shift.endsAt).split(",")[0]}` : ""}
        </p>
      </div>

      <ClaimButton shiftId={shift.id} label="Claim shift" />
    </article>
  );
}
