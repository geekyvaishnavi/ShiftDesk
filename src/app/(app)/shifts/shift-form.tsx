"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Toast } from "@/components/toast";
import { PROFESSIONS, PROFESSION_LABELS } from "@/lib/coverage";
import type { Profession } from "@/lib/import/roles";
import type { StaffOption } from "@/lib/shifts";

import {
  createShiftAction,
  deleteShiftAction,
  updateShiftAction,
  type ShiftFormState,
} from "./shift-actions";

export type ShiftDefaults = {
  date: string;
  start: string;
  end: string;
  reqDoctor: number;
  reqNurse: number;
  reqReceptionist: number;
};

const FIELD =
  "border-hairline bg-surface text-ink tnum h-9 rounded-md border px-2.5 text-[13px] w-full";

const REQ_FIELD: Record<Profession, keyof ShiftDefaults> = {
  doctor: "reqDoctor",
  nurse: "reqNurse",
  receptionist: "reqReceptionist",
};

/// Mirrors the importer's rule so the line under the inputs agrees with what
/// the server will do: an end before the start rolls to the next day, an end
/// equal to the start is zero-length and is refused.
function describeDuration(start: string, end: string): { text: string; invalid: boolean } | null {
  const s = /^(\d{2}):(\d{2})$/.exec(start);
  const e = /^(\d{2}):(\d{2})$/.exec(end);
  if (!s || !e) return null;

  const startMinutes = +s[1] * 60 + +s[2];
  const endMinutes = +e[1] * 60 + +e[2];
  const nextDay = endMinutes < startMinutes;
  const minutes = endMinutes + (nextDay ? 1440 : 0) - startMinutes;

  if (minutes <= 0) {
    return { text: "Start and end are the same — a shift needs a length.", invalid: true };
  }

  const hours = (minutes / 60).toFixed(1);
  return { text: `${hours} hours · ${nextDay ? "ends next day" : "same day"}`, invalid: false };
}

export function ShiftForm({
  mode,
  shiftId,
  week,
  backHref,
  defaults,
  claimed,
  staff,
  onCancel,
}: {
  mode: "create" | "edit";
  shiftId?: string;
  week: string;
  backHref: string;
  defaults: ShiftDefaults;
  claimed: Record<Profession, number>;
  staff?: StaffOption[];
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState<ShiftFormState, FormData>(
    mode === "create" ? createShiftAction : updateShiftAction,
    {},
  );

  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [counts, setCounts] = useState<Record<Profession, number>>({
    doctor: defaults.reqDoctor,
    nurse: defaults.reqNurse,
    receptionist: defaults.reqReceptionist,
  });

  const duration = describeDuration(start, end);

  // Keyed on the state object, which is a fresh reference after every submit,
  // so saving twice raises the toast twice.
  const [toastOpen, setToastOpen] = useState(false);
  useEffect(() => {
    if (!state.saved) return;
    setToastOpen(true);
    const timer = setTimeout(() => setToastOpen(false), 6000);
    return () => clearTimeout(timer);
  }, [state]);

  const refused = state.assignErrors?.length ?? 0;
  const lost = state.dropped?.length ?? 0;

  const headline = state.created
    ? refused > 0
      ? `Shift created — ${state.assigned} assigned, ${refused} could not be`
      : state.assigned && state.assigned > 0
        ? `Shift created — ${state.assigned} ${state.assigned === 1 ? "person" : "people"} assigned`
        : "Shift created"
    : lost > 0
      ? `Shift saved — ${lost} ${lost === 1 ? "person" : "people"} lost their place`
      : "Shift saved";

  // Losing a shift you have claimed should never be a surprise discovered
  // afterwards, so the consequence is stated while the manager is still
  // deciding.
  const willDrop = PROFESSIONS.map((profession) => ({
    profession,
    losing: Math.max(0, (claimed[profession] ?? 0) - counts[profession]),
  })).filter((row) => row.losing > 0);

  return (
    <div className="max-w-2xl">
      <form id="shift-form" action={formAction} className="flex flex-col gap-6">
        {shiftId ? <input type="hidden" name="shiftId" value={shiftId} /> : null}
        <input type="hidden" name="week" value={week} />

        <section className="flex flex-col gap-2">
          <h2 className="text-muted text-[11px] font-semibold tracking-wide uppercase">When</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date" htmlFor="date">
              <input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={defaults.date}
                className={FIELD}
              />
            </Field>
            <Field label="Start" htmlFor="start">
              <input
                id="start"
                name="start"
                type="time"
                required
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className={FIELD}
              />
            </Field>
            <Field label="End" htmlFor="end">
              <input
                id="end"
                name="end"
                type="time"
                required
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className={FIELD}
              />
            </Field>
          </div>
          {duration ? (
            <p className={`text-[12px] ${duration.invalid ? "text-gap" : "text-muted"}`}>
              {duration.text}
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-muted text-[11px] font-semibold tracking-wide uppercase">
            Requirements
          </h2>
          <p className="text-muted text-[12px]">
            How many of each profession this shift needs. Zero means the profession isn’t used.
          </p>

          <div className="border-hairline divide-hairline divide-y rounded-lg border">
            {PROFESSIONS.map((profession) => {
              const label = PROFESSION_LABELS[profession];
              const taken = claimed[profession] ?? 0;

              return (
                <div key={profession} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-[13px] font-medium capitalize">{label.many}</p>
                    {mode === "edit" ? (
                      <p className="text-muted tnum text-[12px]">
                        {taken} of {counts[profession]} claimed
                      </p>
                    ) : null}
                  </div>

                  <Stepper
                    value={counts[profession]}
                    name={REQ_FIELD[profession]}
                    label={label.many}
                    onChange={(next) => setCounts({ ...counts, [profession]: next })}
                  />
                </div>
              );
            })}
          </div>

          {mode === "create" && staff && staff.length > 0 ? (
            <StaffPicker staff={staff} />
          ) : null}

          {willDrop.length > 0 ? (
            <p role="alert" className="text-gap text-[12px]">
              Saving will remove{" "}
              {willDrop
                .map((row) => {
                  const label = PROFESSION_LABELS[row.profession];
                  return `${row.losing} ${row.losing === 1 ? label.one : label.many}`;
                })
                .join(", ")}{" "}
              from this shift — the most recent to claim go first.
            </p>
          ) : null}
        </section>
      </form>

      {/* A sibling form, since one form cannot nest inside another. The buttons
          sit in a shared row and point at their form by id. */}
      {mode === "edit" ? (
        <form id="delete-shift" action={deleteShiftAction}>
          <input type="hidden" name="shiftId" value={shiftId} />
          <input type="hidden" name="week" value={week} />
        </form>
      ) : null}

      <div className="border-hairline mt-6 flex items-center gap-2 border-t pt-4">
        <button
          form="shift-form"
          type="submit"
          disabled={pending || duration?.invalid}
          className="bg-plum h-9 rounded-md px-4 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save shift"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="border-hairline text-ink hover:bg-hover h-9 rounded-md border px-4 text-[13px] transition"
          >
            Cancel
          </button>
        ) : (
          <Link
            href={backHref}
            className="border-hairline text-ink hover:bg-hover flex h-9 items-center rounded-md border px-4 text-[13px] transition"
          >
            Cancel
          </Link>
        )}
        {mode === "edit" ? (
          <button
            form="delete-shift"
            type="submit"
            className="border-hairline text-gap hover:bg-gap-soft ml-auto h-9 rounded-md border px-4 text-[13px] transition"
          >
            Delete shift
          </button>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-gap mt-3 text-[13px]">
          {state.error}
        </p>
      ) : null}

      {/* The toast carries the headline; this panel only appears when there is
          something a manager must actually read — who was refused, or who lost
          a place they had already claimed. */}
      {state.saved && refused + lost > 0 ? (
        <div className="border-hairline bg-surface mt-3 rounded-lg border p-3">
          {refused > 0 ? (
            <>
              <p className="text-ink text-[13px] font-medium">Not everyone could be assigned</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {state.assignErrors?.map((message) => (
                  <li key={message} className="text-muted text-[12px]">
                    {message}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {lost > 0 ? (
            <>
              <p className={`text-ink text-[13px] font-medium ${refused > 0 ? "mt-3" : ""}`}>
                Claims dropped by this edit
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {state.dropped?.map((claim) => (
                  <li key={claim.userId} className="text-muted text-[12px]">
                    <span className="text-ink">{claim.fullName}</span> lost this shift because{" "}
                    {claim.reason}.
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      <Toast
        open={toastOpen}
        message={headline}
        tone={refused + lost > 0 ? "gap" : "ok"}
        onClose={() => setToastOpen(false)}
      />
    </div>
  );
}

/// Thirty-odd staff is too many to scan, so the list is searchable by name or
/// profession. Filtered-out rows are hidden rather than unmounted: a checkbox
/// that leaves the DOM loses its tick, and someone you picked before typing
/// must still be assigned when you submit.
function StaffPicker({ staff }: { staff: StaffOption[] }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const needle = query.trim().toLowerCase();
  const matches = (person: StaffOption) =>
    needle === "" ||
    person.fullName.toLowerCase().includes(needle) ||
    (person.profession ?? "").includes(needle);

  const shown = staff.filter(matches).length;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-muted text-[11px] font-semibold tracking-wide uppercase">
          Assign staff <span className="normal-case">— optional</span>
        </h2>
        {picked.length > 0 ? (
          <span className="text-muted tnum text-[12px]">{picked.length} selected</span>
        ) : null}
      </div>

      <p className="text-muted text-[12px]">
        Leave this empty and assign people later. Anyone who cannot take the shift — already booked,
        or their profession is full — is skipped and named after saving.
      </p>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or profession"
        aria-label="Search staff"
        className="border-hairline bg-surface text-ink h-9 rounded-md border px-2.5 text-[13px]"
      />

      <div className="border-hairline max-h-48 overflow-y-auto rounded-lg border">
        {shown === 0 ? (
          <p className="text-muted p-3 text-[12px]">No staff match “{query}”.</p>
        ) : null}

        {staff.map((person) => (
          <label
            key={person.id}
            className={`hover:bg-hover cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] ${
              matches(person) ? "flex" : "hidden"
            }`}
          >
            <input
              type="checkbox"
              name="assign"
              value={person.id}
              onChange={(event) =>
                setPicked((current) =>
                  event.target.checked
                    ? [...current, person.id]
                    : current.filter((id) => id !== person.id),
                )
              }
              className="accent-plum h-3.5 w-3.5 flex-none"
            />
            <span className="text-ink truncate">{person.fullName}</span>
            <span className="text-muted ml-auto flex-none text-[12px]">{person.profession}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-ink text-[13px] font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

const STEP_BUTTON =
  "border-hairline text-ink hover:bg-hover h-8 w-8 flex-none rounded-md border text-[15px] leading-none transition disabled:opacity-40";

function Stepper({
  value,
  name,
  label,
  onChange,
}: {
  value: number;
  name: string;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-none items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        className={STEP_BUTTON}
        aria-label={`One fewer ${label}`}
      >
        −
      </button>
      <input
        type="number"
        name={name}
        value={value}
        min={0}
        max={99}
        onChange={(event) => onChange(Math.max(0, Math.min(99, Number(event.target.value) || 0)))}
        aria-label={label}
        className="border-hairline bg-surface text-ink tnum h-8 w-12 rounded-md border text-center text-[13px]"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        disabled={value >= 99}
        className={STEP_BUTTON}
        aria-label={`One more ${label}`}
      >
        +
      </button>
    </div>
  );
}
