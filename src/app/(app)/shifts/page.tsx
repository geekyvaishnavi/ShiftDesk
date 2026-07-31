import Link from "next/link";

import { StatusDot } from "@/components/status-pill";
import { WeekNav } from "@/components/week-nav";
import { requireUser } from "@/lib/auth";
import {
  computeCoverage,
  countClaimsByProfession,
  describeMissing,
  type Coverage,
} from "@/lib/coverage";
import { getStaff, getWeekShifts, resolveWeek, type StaffOption, type WeekShift } from "@/lib/shifts";
import {
  daysOf,
  formatDayHeading,
  formatTime,
  isSameUTCDay,
  toDateParam,
  weekParam,
} from "@/lib/week";

import { AssignForm, ClaimButton, PersonChip, ReleaseButton } from "./claim-controls";
import { NewShiftPanel } from "./new-shift-panel";
import { OpenShifts } from "./open-shifts";

type Row = { shift: WeekShift; coverage: Coverage };

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; needs?: string; new?: string; when?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const week = await resolveWeek(params.week);
  const onlyNeeds = params.needs === "1";

  const shifts = await getWeekShifts(week);
  const staff = user.role === "manager" ? await getStaff() : [];

  const rows: Row[] = shifts.map((shift) => ({
    shift,
    coverage: computeCoverage(shift, countClaimsByProfession(shift.claims)),
  }));

  // Staff get a different question answered: not "what is on this week" but
  // "what could I take". Anything they already hold, or that has no room for
  // their profession, is not an open shift for them.
  if (user.role === "staff") {
    const profession = user.profession;
    if (!profession) {
      return (
        <div className="p-4 md:p-6">
          <p className="text-muted text-sm">Your account has no profession set.</p>
        </div>
      );
    }

    const open = rows.filter(({ shift, coverage }) => {
      if (shift.claims.some((claim) => claim.userId === user.id)) return false;
      const mine = coverage.byProfession.find((p) => p.profession === profession);
      return !!mine && mine.missing > 0;
    });

    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <OpenShifts week={week} rows={open} profession={profession} filter={params.when ?? ""} />
      </div>
    );
  }

  const visible = onlyNeeds ? rows.filter((row) => row.coverage.missing.length > 0) : rows;
  const days = daysOf(week);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <WeekNav week={week} basePath="/shifts" params={onlyNeeds ? { needs: "1" } : {}} />

      {user.role === "manager" ? (
        <NewShiftPanel
          defaultOpen={params.new === "1"}
          week={weekParam(week)}
          staff={staff}
          defaults={{
            date: toDateParam(week.start),
            start: "09:00",
            end: "17:00",
            reqDoctor: 0,
            reqNurse: 1,
            reqReceptionist: 0,
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Filter href={`/shifts?week=${weekParam(week)}`} active={!onlyNeeds} label="All shifts" />
        <Filter href={`/shifts?needs=1&week=${weekParam(week)}`} active={onlyNeeds} label="Needs cover" />
        <p className="text-muted ml-auto text-[12px]">
          {visible.length} {visible.length === 1 ? "shift" : "shifts"}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted border-hairline rounded-lg border border-dashed p-6 text-center text-sm">
          {onlyNeeds ? "Every shift this week is fully staffed." : "No shifts this week."}
        </p>
      ) : (
        days.map((day) => {
          const forDay = visible.filter((row) => isSameUTCDay(row.shift.startsAt, day));
          if (forDay.length === 0) return null;

          return (
            <section key={day.toISOString()} className="flex flex-col gap-1.5">
              <h2 className="text-muted text-[11px] font-semibold tracking-wide uppercase">
                {formatDayHeading(day)}
              </h2>

              {/* Rows rather than cards: every shift shares the same shape, so
                  time, gap and people line up down the page and can be compared
                  by eye. They stack on narrow screens instead of scrolling. */}
              <div className="border-hairline divide-hairline divide-y overflow-hidden rounded-lg border">
                {forDay.map(({ shift, coverage }) => (
                  <ShiftRow
                    key={shift.id}
                    shift={shift}
                    coverage={coverage}
                    user={user}
                    staff={staff}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function ShiftRow({
  shift,
  coverage,
  user,
  staff,
}: {
  shift: WeekShift;
  coverage: Coverage;
  user: {
    id: string;
    role: "manager" | "staff";
    profession: "doctor" | "nurse" | "receptionist" | null;
  };
  staff: StaffOption[];
}) {
  const overnight = !isSameUTCDay(shift.startsAt, shift.endsAt);
  const short = coverage.missing.length > 0;
  const isManager = user.role === "manager";

  // Every column is a fixed track, so the same template repeats down the list
  // and the columns line up between rows. Flexing them made each row size
  // itself, which is what left the list looking ragged.
  return (
    <div className="bg-surface hover:bg-hover/40 flex flex-col gap-2 p-3 transition md:grid md:grid-cols-[8.5rem_12rem_minmax(0,1fr)_15rem] md:items-start md:gap-4">
      <div className="flex items-center gap-2">
        <StatusDot status={coverage.status} />
        <p className="tnum text-ink text-[13px] font-semibold whitespace-nowrap">
          {formatTime(shift.startsAt)} – {formatTime(shift.endsAt)}
          {overnight ? <span className="text-muted text-[11px] font-normal"> +1</span> : null}
        </p>
      </div>

      <p className={`text-[12px] md:pt-0.5 ${short ? "text-ink" : "text-muted"}`}>
        {short ? `Needs ${describeMissing(coverage)}` : "All slots filled"}
      </p>

      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {shift.claims.length === 0 ? (
          <span className="text-muted text-[12px] md:pt-0.5">Nobody yet</span>
        ) : (
          shift.claims.map((claim) => (
            <PersonChip
              key={claim.id}
              shiftId={shift.id}
              userId={claim.userId}
              name={claim.user.fullName}
              profession={claim.user.profession}
              removable={isManager}
            />
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
        {isManager ? (
          <ManagerActions shift={shift} coverage={coverage} staff={staff} />
        ) : (
          <StaffActions shift={shift} coverage={coverage} user={user} />
        )}
      </div>
    </div>
  );
}

function Filter({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`h-8 rounded-md px-2.5 text-[13px] leading-8 transition ${
        active ? "bg-hover text-ink font-semibold" : "text-muted hover:bg-hover"
      }`}
    >
      {label}
    </Link>
  );
}

/// Staff act only on themselves, so the only questions are whether they are
/// already on this shift and whether their profession still has a gap.
function StaffActions({
  shift,
  coverage,
  user,
}: {
  shift: WeekShift;
  coverage: Coverage;
  user: { id: string; profession: "doctor" | "nurse" | "receptionist" | null };
}) {
  const mine = shift.claims.some((claim) => claim.userId === user.id);
  if (mine) return <ReleaseButton shiftId={shift.id} label="Release" />;

  if (!user.profession) return null;

  const slot = coverage.byProfession.find((p) => p.profession === user.profession);
  if (!slot || slot.required === 0) {
    return <p className="text-muted text-[12px]">No {user.profession} needed</p>;
  }
  if (slot.missing === 0) {
    return <p className="text-muted text-[12px]">Full</p>;
  }

  return <ClaimButton shiftId={shift.id} />;
}

/// Managers get the same rules through the same engine; the picker just hides
/// the people who would obviously be rejected.
function ManagerActions({
  shift,
  coverage,
  staff,
}: {
  shift: WeekShift;
  coverage: Coverage;
  staff: StaffOption[];
}) {
  const taken = new Set(shift.claims.map((claim) => claim.userId));
  const gaps = new Set(coverage.missing.map((p) => p.profession));

  const options = staff.filter(
    (person) => person.profession && gaps.has(person.profession) && !taken.has(person.id),
  );

  return (
    <>
      <AssignForm shiftId={shift.id} options={options} />
      <Link
        href={`/shifts/${shift.id}`}
        className="border-hairline text-muted hover:bg-hover hover:text-ink flex h-8 flex-none items-center rounded-md border px-2.5 text-[12px] transition"
      >
        Edit
      </Link>
    </>
  );
}
