import { STATUS_LABELS, StatusDot } from "@/components/status-pill";
import { describeMissing, type Coverage } from "@/lib/coverage";
import type { WeekShift } from "@/lib/shifts";
import { formatTime, isSameUTCDay } from "@/lib/week";

export function ShiftCard({
  shift,
  coverage,
  actions,
}: {
  shift: WeekShift;
  coverage: Coverage;
  actions?: React.ReactNode;
}) {
  // An overnight shift ends on the next day; say so rather than showing a time
  // that reads as going backwards.
  const overnight = !isSameUTCDay(shift.startsAt, shift.endsAt);
  const short = coverage.missing.length > 0;

  return (
    <article className="border-hairline bg-surface rounded-lg border p-3">
      <p className="tnum text-ink text-[13px] font-semibold">
        {formatTime(shift.startsAt)} – {formatTime(shift.endsAt)}
        {overnight ? <span className="text-muted text-[11px] font-normal"> +1 day</span> : null}
      </p>

      {/* One line does both jobs: the dot names the status, the sentence says
          what to do about it. Only the shifts that are short read in full ink. */}
      <div className="mt-1.5 flex gap-1.5">
        <StatusDot status={coverage.status} />
        <p className={`text-[12px] ${short ? "text-ink" : "text-muted"}`}>
          {short ? `Needs ${describeMissing(coverage)}` : "All slots filled"}
          <span className="sr-only"> — {STATUS_LABELS[coverage.status]}</span>
        </p>
      </div>

      {shift.claims.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {shift.claims.map((claim) => (
            <li
              key={claim.id}
              className="bg-hover text-muted rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap"
            >
              {claim.user.fullName}
            </li>
          ))}
        </ul>
      ) : null}

      {actions ? <div className="mt-2.5 flex flex-col gap-1.5">{actions}</div> : null}
    </article>
  );
}
