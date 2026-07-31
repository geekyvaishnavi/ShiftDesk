import { requireManager } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { UploadForm } from "./upload-form";

/// Only merged and rejected rows are stored, so a run with a big file still
/// has a short report. The cap is a guard against a pathological upload rather
/// than an expected limit.
const ROW_LIMIT = 300;

const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export default async function ImportPage() {
  await requireManager();

  const runs = await prisma.importRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      source: true,
      kind: true,
      fileName: true,
      accepted: true,
      merged: true,
      rejected: true,
      createdAt: true,
      _count: { select: { rows: true } },
      rows: {
        take: ROW_LIMIT,
        orderBy: { lineNumber: "asc" },
        select: { id: true, lineNumber: true, raw: true, status: true, reason: true },
      },
    },
  });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-ink text-[15px] font-semibold">Import</h1>
        <p className="text-muted mt-0.5 text-[12px]">
          Every run the clinic has done, newest first — what was accepted, and what happened to
          everything that was not.
        </p>
      </div>

      <UploadForm />

      {runs.length === 0 ? (
        <p className="text-muted border-hairline rounded-lg border border-dashed p-6 text-center text-sm">
          Nothing imported yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {runs.map((run) => (
            <article key={run.id} className="border-hairline bg-surface rounded-lg border">
              <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 p-3.5">
                <h2 className="text-ink text-[13px] font-semibold">{run.fileName}</h2>
                <span className="bg-hover text-muted rounded-full px-2 py-0.5 text-[11px]">
                  {run.kind}
                </span>
                <span className="bg-hover text-muted rounded-full px-2 py-0.5 text-[11px]">
                  {run.source}
                </span>
                <span className="text-muted ml-auto text-[12px]">{WHEN.format(run.createdAt)}</span>
              </header>

              <div className="border-hairline flex flex-wrap gap-x-6 gap-y-2 border-t px-3.5 py-3">
                <Count label="Accepted" value={run.accepted} />
                <Count label="Merged" value={run.merged} tone="warn" />
                <Count label="Rejected" value={run.rejected} tone="gap" />
              </div>

              {run.rows.length > 0 ? (
                <details className="border-hairline border-t">
                  <summary className="text-ink hover:bg-hover cursor-pointer px-3.5 py-2.5 text-[13px]">
                    Show the {run._count.rows} {run._count.rows === 1 ? "row" : "rows"} that were
                    not accepted
                  </summary>

                  {/* The raw row is the point of the report, so it is shown
                      verbatim; long lines scroll rather than wrapping into an
                      unreadable block. */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-[12px]">
                      <thead className="text-muted border-hairline border-y">
                        <tr>
                          <th className="px-3.5 py-2 font-medium">Line</th>
                          <th className="px-3.5 py-2 font-medium">What happened</th>
                          <th className="px-3.5 py-2 font-medium">Why</th>
                          <th className="px-3.5 py-2 font-medium">The row</th>
                        </tr>
                      </thead>
                      <tbody className="divide-hairline divide-y">
                        {run.rows.map((row) => (
                          <tr key={row.id}>
                            <td className="text-muted tnum px-3.5 py-2 align-top">
                              {row.lineNumber}
                            </td>
                            <td className="px-3.5 py-2 align-top">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] ${
                                  row.status === "merged"
                                    ? "bg-warn-soft text-warn"
                                    : "bg-gap-soft text-gap"
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="text-ink px-3.5 py-2 align-top">{row.reason}</td>
                            <td className="text-muted px-3.5 py-2 align-top font-mono text-[11px] whitespace-pre">
                              {row.raw}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {run._count.rows > run.rows.length ? (
                    <p className="text-muted border-hairline border-t px-3.5 py-2 text-[12px]">
                      Showing the first {run.rows.length} of {run._count.rows}.
                    </p>
                  ) : null}
                </details>
              ) : (
                <p className="border-hairline text-muted border-t px-3.5 py-2.5 text-[12px]">
                  Every row was accepted.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const TONES = {
  plain: "text-ink",
  warn: "text-warn",
  gap: "text-gap",
} as const;

function Count({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: number;
  tone?: keyof typeof TONES;
}) {
  return (
    <div>
      <p className="text-muted text-[11px] font-semibold tracking-wide uppercase">{label}</p>
      <p className={`${value === 0 ? "text-muted" : TONES[tone]} tnum mt-0.5 text-lg font-semibold`}>
        {value}
      </p>
    </div>
  );
}
