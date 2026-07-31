const HOUR_MS = 60 * 60 * 1000;

export function shiftHours(shift: { startsAt: Date; endsAt: Date }): number {
  return (shift.endsAt.getTime() - shift.startsAt.getTime()) / HOUR_MS;
}

/// "8.0" rather than "8" so a column of durations lines up on the decimal.
export function formatHours(hours: number): string {
  return hours.toFixed(1);
}

/// One definition of a night, used by both the label on a shift and the filter
/// that hides them, so the two cannot disagree about what a night is.
export function isNightShift(startsAt: Date): boolean {
  const hour = startsAt.getUTCHours();
  return hour >= 18 || hour < 6;
}

/// Derived from the start time rather than stored: the clinic's export carries
/// no name for a shift, and inventing a column to hold one would put a label
/// in the database that nothing keeps true.
export function shiftLabel(startsAt: Date): string {
  const hour = startsAt.getUTCHours();
  if (hour < 6) return "Night shift";
  if (hour < 12) return "Day shift";
  if (hour < 18) return "Late shift";
  return "Night shift";
}
