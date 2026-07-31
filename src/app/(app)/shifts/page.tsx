import { requireUser } from "@/lib/auth";

export default async function ShiftsPage() {
  const user = await requireUser();

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-ink text-lg font-semibold">Shifts</h1>
      <p className="text-muted mt-1 text-sm">
        {user.role === "manager"
          ? "Create, edit, and assign shifts. Built next."
          : "Claim and release shifts. Built next."}
      </p>
    </div>
  );
}
