"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { runShiftImport, runStaffImport } from "@/lib/import/run";
import { prisma } from "@/lib/prisma";

export type ImportState = {
  error?: string;
  result?: {
    kind: string;
    fileName: string;
    accepted: number;
    merged: number;
    rejected: number;
  };
};

/// An upload runs the same importer the seed does, with `source: "upload"` the
/// only difference. The rules are policies for any file, not fixes for the two
/// exports that happened to ship with the brief.
export async function uploadCsvAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  if (user.role !== "manager") return { error: "Only managers can import." };

  const kind = String(formData.get("kind") ?? "");
  if (kind !== "staff" && kind !== "shifts") {
    return { error: "Choose whether this file holds staff or shifts." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to import." };
  }

  const text = await file.text();

  const result =
    kind === "staff"
      ? await runStaffImport(prisma, text, file.name, "upload")
      : await runShiftImport(prisma, text, file.name, "upload");

  // A header error rejects the file whole, so it never reaches the report —
  // there is no run to attach it to. It comes back here instead.
  if (!result.ok) return { error: result.error };

  revalidatePath("/import");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");

  return {
    result: {
      kind,
      fileName: file.name,
      accepted: result.accepted,
      merged: result.merged,
      rejected: result.rejected,
    },
  };
}
