"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

import type { StaffOption } from "@/lib/shifts";

import { claimAction, releaseAction, type ActionState } from "./actions";

function Submit({ label, tone }: { label: string; tone: "solid" | "quiet" }) {
  const { pending } = useFormStatus();
  const styles =
    tone === "solid"
      ? "bg-plum text-white hover:opacity-90"
      : "border-hairline text-muted hover:bg-hover hover:text-ink border";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${styles} h-8 flex-none rounded-md px-3 text-[13px] font-medium transition disabled:opacity-60`}
    >
      {pending ? "…" : label}
    </button>
  );
}

/// Rejections are the interesting case, so the message renders next to the
/// control that caused it rather than as a page-level banner.
function Error({ state }: { state: ActionState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-gap mt-1.5 text-[12px]">
      {state.error}
    </p>
  );
}

export function ClaimButton({ shiftId, label = "Claim" }: { shiftId: string; label?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(claimAction, {});

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="shiftId" value={shiftId} />
        <Submit label={label} tone="solid" />
      </form>
      <Error state={state} />
    </div>
  );
}

export function ReleaseButton({
  shiftId,
  userId,
  label = "Release",
}: {
  shiftId: string;
  userId?: string;
  label?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(releaseAction, {});

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="shiftId" value={shiftId} />
        {userId ? <input type="hidden" name="userId" value={userId} /> : null}
        <Submit label={label} tone="quiet" />
      </form>
      <Error state={state} />
    </div>
  );
}

/// A person on a shift, with the release control on the chip itself rather
/// than as a separate "Remove <name>" button per claim — a shift with five
/// people had five near-identical buttons stacked under it.
export function PersonChip({
  shiftId,
  userId,
  name,
  profession,
  removable,
}: {
  shiftId: string;
  userId: string;
  name: string;
  profession: string | null;
  removable: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(releaseAction, {});

  return (
    <span className="bg-hover text-ink inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-[11px] whitespace-nowrap">
      {name}
      {profession ? <span className="text-muted">· {profession}</span> : null}
      {removable ? (
        <form action={action} className="flex">
          <input type="hidden" name="shiftId" value={shiftId} />
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            aria-label={`Remove ${name}`}
            title={state.error ?? `Remove ${name}`}
            className={`grid h-4 w-4 place-items-center rounded-full leading-none transition ${
              state.error ? "text-gap" : "text-muted hover:bg-gap-soft hover:text-gap"
            }`}
          >
            ×
          </button>
        </form>
      ) : null}
    </span>
  );
}

/// Only staff who could plausibly fill a gap are listed, so the common case
/// needs no error. The server still re-checks: the list is a convenience, not
/// the rule.
export function AssignForm({ shiftId, options }: { shiftId: string; options: StaffOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(claimAction, {});
  const form = useRef<HTMLFormElement>(null);

  if (options.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-none md:items-end">
      {/* Choosing someone is the whole intent, so the choice submits. A
          separate Assign button would sit in every row of the week to confirm
          something the manager has already said. */}
      <form ref={form} action={action}>
        <input type="hidden" name="shiftId" value={shiftId} />
        <label className="sr-only" htmlFor={`assign-${shiftId}`}>
          Assign a staff member
        </label>
        <select
          id={`assign-${shiftId}`}
          name="userId"
          defaultValue=""
          disabled={pending}
          onChange={(event) => {
            if (event.target.value) form.current?.requestSubmit();
          }}
          className="border-hairline bg-surface text-ink h-8 w-full rounded-md border px-2 text-[12px] disabled:opacity-60 md:w-44"
        >
          <option value="" disabled>
            {pending ? "Assigning…" : "Assign someone…"}
          </option>
          {options.map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName} ({person.profession})
            </option>
          ))}
        </select>
      </form>
      {state.error ? (
        <p role="alert" className="text-gap text-[11px] md:text-right">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
