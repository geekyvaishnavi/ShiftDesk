import { requireManager } from "@/lib/auth";

export default async function ImportPage() {
  await requireManager();

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-ink text-lg font-semibold">Import</h1>
      <p className="text-muted mt-1 text-sm">Upload a CSV and review the report. Built next.</p>
    </div>
  );
}
