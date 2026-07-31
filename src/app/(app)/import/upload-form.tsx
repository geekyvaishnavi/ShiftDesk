"use client";

import { useActionState } from "react";

import { uploadCsvAction, type ImportState } from "./actions";

export function UploadForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(uploadCsvAction, {});

  return (
    <section className="border-hairline bg-surface rounded-lg border p-3.5">
      <h2 className="text-ink text-[13px] font-semibold">Import a CSV</h2>
      <p className="text-muted mt-0.5 text-[12px]">
        Runs the same importer as the seed. Rows that cannot be trusted are rejected and listed
        below with the reason, never dropped quietly.
      </p>

      <form action={action} className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-ink text-[13px] font-medium">What is in this file?</span>
          <div className="flex flex-wrap gap-3">
            <label className="text-ink flex items-center gap-1.5 text-[13px]">
              <input
                type="radio"
                name="kind"
                value="staff"
                defaultChecked
                className="accent-plum h-3.5 w-3.5"
              />
              Staff
            </label>
            <label className="text-ink flex items-center gap-1.5 text-[13px]">
              <input type="radio" name="kind" value="shifts" className="accent-plum h-3.5 w-3.5" />
              Shifts
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="file" className="text-ink text-[13px] font-medium">
            CSV file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="border-hairline text-muted file:bg-hover file:text-ink w-full rounded-md border px-2.5 py-2 text-[13px] file:mr-3 file:rounded file:border-0 file:px-2.5 file:py-1 file:text-[12px]"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="bg-plum h-9 rounded-md px-4 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Importing…" : "Import"}
          </button>
        </div>
      </form>

      {state.error ? (
        <p role="alert" className="text-gap mt-3 text-[13px]">
          {state.error}
        </p>
      ) : null}

      {state.result ? (
        <p className="text-ink mt-3 text-[13px]">
          Imported <span className="font-medium">{state.result.fileName}</span> —{" "}
          <span className="tnum">{state.result.accepted}</span> accepted,{" "}
          <span className="tnum">{state.result.merged}</span> merged,{" "}
          <span className="tnum">{state.result.rejected}</span> rejected. The run is at the top of
          the list below.
        </p>
      ) : null}
    </section>
  );
}
