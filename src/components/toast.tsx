"use client";

/// A result you have to go looking for is a result most people miss. The form
/// keeps the detail — who was refused, who lost a slot — and this carries the
/// headline to where the eye already is.
export function Toast({
  open,
  message,
  tone = "ok",
  onClose,
}: {
  open: boolean;
  message: string;
  tone?: "ok" | "gap";
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 md:inset-x-auto md:right-6 md:bottom-6 md:max-w-sm"
    >
      <div className="border-hairline bg-surface flex items-start gap-2 rounded-lg border p-3 shadow-lg">
        <span
          className={`${tone === "ok" ? "bg-ok" : "bg-gap"} mt-[7px] h-1.5 w-1.5 flex-none rounded-full`}
          aria-hidden
        />
        <p className="text-ink flex-1 text-[13px]">{message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="text-muted hover:text-ink -mt-0.5 flex-none text-[15px] leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
