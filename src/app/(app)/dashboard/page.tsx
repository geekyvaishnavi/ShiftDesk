import { requireManager } from "@/lib/auth";

export default async function DashboardPage() {
  await requireManager();

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-ink text-lg font-semibold">Coverage</h1>
      <p className="text-muted mt-1 text-sm">Week-at-a-glance staffing. Built next.</p>
    </div>
  );
}
