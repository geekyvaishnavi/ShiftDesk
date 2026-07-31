"use client";

import { useState } from "react";

import type { StaffOption } from "@/lib/shifts";

import { ShiftForm, type ShiftDefaults } from "./shift-form";

/// Collapsed by default: the week's shifts are what a manager came to see, and
/// a form standing permanently open would push them below the fold. Opening it
/// is one click, and `?new=1` opens it straight away for the link from the
/// coverage dashboard.
export function NewShiftPanel({
  defaultOpen,
  week,
  defaults,
  staff,
}: {
  defaultOpen: boolean;
  week: string;
  defaults: ShiftDefaults;
  staff: StaffOption[];
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-hairline bg-surface rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="hover:bg-hover flex w-full items-center gap-2 rounded-lg p-3 text-left transition"
      >
        <span className="text-ink text-[13px] font-semibold">New shift</span>
        <span className="text-muted ml-auto text-[12px]">
          {open ? "Close" : "Add a shift to this week"}
        </span>
      </button>

      {open ? (
        <div className="border-hairline border-t p-3">
          <ShiftForm
            mode="create"
            week={week}
            backHref={`/shifts?week=${week}`}
            defaults={defaults}
            claimed={{ doctor: 0, nurse: 0, receptionist: 0 }}
            staff={staff}
            onCancel={() => setOpen(false)}
          />
        </div>
      ) : null}
    </section>
  );
}
