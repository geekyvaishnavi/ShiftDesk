import Link from "next/link";
import { redirect } from "next/navigation";

import { WeekNav } from "@/components/week-nav";
import { requireUser } from "@/lib/auth";
import { PROFESSION_LABELS, computeCoverage, countClaimsByProfession } from "@/lib/coverage";
import { formatHours, shiftHours, shiftLabel } from "@/lib/shift-time";
import { getMyWeekShifts, resolveWeek } from "@/lib/shifts";
import {
  daysOf,
  formatDayNumber,
  formatTime,
  formatWeekday,
  isSameUTCDay,
  weekParam,
} from "@/lib/week";

import { ReleaseButton } from "../shifts/claim-controls";

export default async function MyShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireUser();
  // Managers hold no claims, so this page would always be empty for them.
  if (user.role === "manager") redirect("/dashboard");

  const params = await searchParams;
  const week = await resolveWeek(params.week);
  const shifts = await getMyWeekShifts(user.id, week);

  const totalHours = shifts.reduce((sum, shift) => sum + shiftHours(shift), 0);
  const days = daysOf(week);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      {/* The same week header the manager's pages use, so the two roles step
          through weeks the same way. */}
      <WeekNav week={week} basePath="/my-shifts" />

      <p className="text-muted -mt-2 text-[13px]">
        {user.fullName}
        {user.profession ? `, ${PROFESSION_LABELS[user.profession].one}` : ""}
      </p>

      {/* Hours are shown because a rota is also a timesheet, but no cap is
          implied: a weekly limit would be a third claim rule, and the brief
          asks for two. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="tnum text-ink text-4xl font-semibold">{formatHours(totalHours)}</p>
        <div>
          <p className="text-ink text-[14px]">hours this week</p>
          <p className="text-muted text-[12px]">
            {shifts.length} {shifts.length === 1 ? "shift" : "shifts"}
          </p>
        </div>
      </div>

      {shifts.length === 0 ? (
        <p className="text-muted border-hairline rounded-lg border border-dashed p-8 text-center text-sm">
          You have no shifts this week.{" "}
          <Link href={`/shifts?week=${weekParam(week)}`} className="text-accent hover:underline">
            Find an open one
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {days.map((day) => {
            const forDay = shifts.filter((shift) => isSameUTCDay(shift.startsAt, day));
            if (forDay.length === 0) return null;

            const dayHours = forDay.reduce((sum, shift) => sum + shiftHours(shift), 0);

            return (
              <section key={day.toISOString()} className="flex flex-col gap-2">
                <div className="border-hairline flex items-baseline gap-1.5 border-b pb-1.5">
                  <span className="text-ink text-[12px] font-semibold tracking-wide uppercase">
                    {formatWeekday(day)}
                  </span>
                  <span className="text-muted tnum text-[13px]">{formatDayNumber(day)}</span>
                  <span className="text-muted tnum ml-auto text-[12px]">
                    {formatHours(dayHours)}h
                  </span>
                </div>

                {forDay.map((shift) => {
                  const coverage = computeCoverage(shift, countClaimsByProfession(shift.claims));
                  const mine = coverage.byProfession.find((p) => p.profession === user.profession);
                  const others = shift.claims.length - 1;

                  return (
                    <article
                      key={shift.id}
                      className="border-hairline bg-surface flex flex-wrap items-center gap-3 rounded-lg border p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="tnum text-ink text-[15px] font-semibold">
                          {formatTime(shift.startsAt)} – {formatTime(shift.endsAt)}
                        </p>
                        <p className="text-muted mt-1 text-[13px]">
                          {shiftLabel(shift.startsAt)}
                          {others > 0
                            ? ` · with ${others} ${others === 1 ? "other" : "others"}`
                            : " · on your own"}
                          {mine && user.profession
                            ? ` · ${mine.filled} of ${mine.required} ${
                                mine.required === 1
                                  ? PROFESSION_LABELS[user.profession].one
                                  : PROFESSION_LABELS[user.profession].many
                              }`
                            : ""}
                        </p>
                      </div>

                      <ReleaseButton shiftId={shift.id} label="Unclaim" />
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
