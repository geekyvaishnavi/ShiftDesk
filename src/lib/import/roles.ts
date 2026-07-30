export type Profession = "doctor" | "nurse" | "receptionist";

/// Every synonym that appears in staff.csv, lowercased. Matching is
/// case-insensitive and whitespace-trimmed before lookup.
const SYNONYMS: Record<string, Profession> = {
  doctor: "doctor",
  physician: "doctor",
  md: "doctor",

  nurse: "nurse",
  rn: "nurse",
  "registered nurse": "nurse",

  receptionist: "receptionist",
  reception: "receptionist",
  "recep.": "receptionist",
};

export function parseProfession( input: string, ): { ok: true; profession: Profession } | { ok: false; reason: string } {
 
  const key = input.trim().toLowerCase();
  const profession = SYNONYMS[key];

  if (!profession) {
    return { ok: false, reason: `unsupported profession: "${input}"` };
  }

  return { ok: true, profession };
}
