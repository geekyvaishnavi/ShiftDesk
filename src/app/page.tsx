import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

/// The root has no content of its own: it routes to the view each role starts
/// from. Managers open on coverage, staff on the shifts they can claim.
export default async function Home(): Promise<never> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "manager" ? "/dashboard" : "/shifts");
}
