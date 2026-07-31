import Link from "next/link";
import { notFound } from "next/navigation";

import { requireManager } from "@/lib/auth";
import { countClaimsByProfession } from "@/lib/coverage";
import { prisma } from "@/lib/prisma";
import { formatDayHeading, formatTime, formatWeekRange, toDateParam, weekOf, weekParam } from "@/lib/week";

import { ShiftForm } from "../shift-form";

export default async function EditShiftPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManager();
  const { id } = await params;

  const shift = await prisma.shift.findUnique({
    where: { id },
    select: {
      id: true,
      externalId: true,
      startsAt: true,
      endsAt: true,
      reqDoctor: true,
      reqNurse: true,
      reqReceptionist: true,
      claims: { select: { id: true, user: { select: { profession: true } } } },
    },
  });

  if (!shift) notFound();

  const week = weekOf(shift.startsAt);
  const param = weekParam(week);
  const claimed = countClaimsByProfession(shift.claims);
  const claimCount = shift.claims.length;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <Link href={`/shifts?week=${param}`} className="text-muted text-[12px] hover:underline">
          ‹ Shifts · {formatWeekRange(week)}
        </Link>
        <h1 className="text-ink mt-1 text-xl font-semibold">Edit shift</h1>
        <p className="text-muted mt-0.5 text-[12px]">
          {/* Only imported shifts carry the clinic's own number; ones created
              here have none, so it is shown when it exists rather than faked. */}
          {shift.externalId ? `#${shift.externalId} · ` : ""}
          {formatDayHeading(shift.startsAt)} · {formatTime(shift.startsAt)}–
          {formatTime(shift.endsAt)} · {claimCount} {claimCount === 1 ? "person" : "people"} claimed
        </p>
      </div>

      <div className="border-hairline border-t" />

      <ShiftForm
        mode="edit"
        shiftId={shift.id}
        week={param}
        backHref={`/shifts?week=${param}`}
        defaults={{
          date: toDateParam(shift.startsAt),
          start: formatTime(shift.startsAt),
          end: formatTime(shift.endsAt),
          reqDoctor: shift.reqDoctor,
          reqNurse: shift.reqNurse,
          reqReceptionist: shift.reqReceptionist,
        }}
        claimed={claimed}
      />
    </div>
  );
}
