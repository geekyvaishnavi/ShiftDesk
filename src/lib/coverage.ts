import type { Profession } from "@/lib/import/roles";

export const PROFESSIONS: Profession[] = ["doctor", "nurse", "receptionist"];

export const PROFESSION_LABELS: Record<Profession, { one: string; many: string }> = {
  doctor: { one: "doctor", many: "doctors" },
  nurse: { one: "nurse", many: "nurses" },
  receptionist: { one: "receptionist", many: "receptionists" },
};

export type CoverageStatus = "empty" | "partial" | "full";


export type ShiftRequirements = {
  reqDoctor: number;
  reqNurse: number;
  reqReceptionist: number;
};

export type ProfessionCoverage = {
  profession: Profession;
  required: number;
  filled: number;
  missing: number;
};

export type Coverage = {
  status: CoverageStatus;
  byProfession: ProfessionCoverage[];
  missing: ProfessionCoverage[];
  totalRequired: number;
  totalFilled: number;
};

export function requiredFor(shift: ShiftRequirements, profession: Profession): number {
  if (profession === "doctor") return shift.reqDoctor;
  if (profession === "nurse") return shift.reqNurse;
  return shift.reqReceptionist;
}


export function computeCoverage( shift: ShiftRequirements, claimed: Record<Profession, number>, ): Coverage {
  const byProfession = PROFESSIONS.map((profession) => {
    const required = requiredFor(shift, profession);
    const filled = claimed[profession] ?? 0;
    return { profession, required, filled, missing: Math.max(0, required - filled) };
  });

  const totalRequired = byProfession.reduce((sum, p) => sum + p.required, 0);
 
  const totalFilled = byProfession.reduce((sum, p) => sum + Math.min(p.filled, p.required), 0);
  const missing = byProfession.filter((p) => p.missing > 0);

  const status: CoverageStatus =
    missing.length === 0 ? "full" : totalFilled === 0 ? "empty" : "partial";

  return { status, byProfession, missing, totalRequired, totalFilled };
}

/// Counts claims by the claimant's profession. Managers have no profession
/// and are skipped, so an assigning manager never counts as coverage.
export function countClaimsByProfession(
  claims: { user: { profession: Profession | null } }[],
): Record<Profession, number> {
  const counts: Record<Profession, number> = { doctor: 0, nurse: 0, receptionist: 0 };
  for (const claim of claims) {
    if (claim.user.profession) counts[claim.user.profession] += 1;
  }
  return counts;
}


export function describeMissing(coverage: Coverage): string {
  if (coverage.missing.length === 0) return "";
  return coverage.missing
    .map((p) => {
      const label = PROFESSION_LABELS[p.profession];
      return `${p.missing} ${p.missing === 1 ? label.one : label.many}`;
    })
    .join(", ");
}
