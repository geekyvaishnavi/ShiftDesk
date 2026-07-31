import type { CoverageStatus } from "@/lib/coverage";

export const STATUS_LABELS: Record<CoverageStatus, string> = {
  full: "Fully staffed",
  partial: "Partially staffed",
  empty: "Empty",
};

const STATUS_DOT: Record<CoverageStatus, string> = {
  full: "bg-ok",
  partial: "bg-warn",
  empty: "bg-gap",
};

/// Colour is carried by a 6px dot and nothing else. A rota is mostly fine most
/// of the time, so filling every card with red and amber makes the shifts that
/// actually need attention harder to find, not easier — the wording beside the
/// dot is what a manager reads.
export function StatusDot({ status }: { status: CoverageStatus }) {
  return (
    <span
      className={`${STATUS_DOT[status]} mt-[5px] h-1.5 w-1.5 flex-none self-start rounded-full`}
      aria-hidden
    />
  );
}

export function StatusMark({ status }: { status: CoverageStatus }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`${STATUS_DOT[status]} h-1.5 w-1.5 flex-none rounded-full`} aria-hidden />
      <span className="text-muted text-[12px]">{STATUS_LABELS[status]}</span>
    </span>
  );
}
