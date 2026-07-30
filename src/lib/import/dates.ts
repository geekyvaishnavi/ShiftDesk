/// Three formats appear in clinic exports. The separator tells them apart:
///   2026-08-28   ISO
///   05/08/2026   slash, day first
///   08-13-2026   dash, month first
export function parseDate( input: string, ): { ok: true; year: number; month: number; day: number } | { ok: false; reason: string } {
 
  const value = input.trim();
  if (!value) return { ok: false, reason: "date is empty" };

  let year: number, month: number, day: number;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const dash = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(value);

  if (iso) {
    [year, month, day] = [+iso[1], +iso[2], +iso[3]];
  } else if (slash) {
    [day, month, year] = [+slash[1], +slash[2], +slash[3]];
  } else if (dash) {
    [month, day, year] = [+dash[1], +dash[2], +dash[3]];
  } else {
    return { ok: false, reason: `unrecognised date format: "${value}"` };
  }

  // Catches 2026-02-30: the components exist but the date does not.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return { ok: false, reason: `date does not exist: "${value}"` };
  }

  return { ok: true, year, month, day };
}

/// Accepts "09:00" and the next-day form "10:00+1".
export function parseTime( input: string, ): { ok: true; hour: number; minute: number; plusDays: number } | { ok: false; reason: string } {
  
  const value = input.trim();
  if (!value) return { ok: false, reason: "time is empty" };

  const match = /^(\d{1,2}):(\d{2})(\+(\d))?$/.exec(value);
  if (!match) return { ok: false, reason: `unrecognised time: "${value}"` };

  const hour = +match[1];
  const minute = +match[2];
  const plusDays = match[4] ? +match[4] : 0;

  if (hour > 23 || minute > 59) {
    return { ok: false, reason: `impossible time: "${value}"` };
  }

  return { ok: true, hour, minute, plusDays };
}
