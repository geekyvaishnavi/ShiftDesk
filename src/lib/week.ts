/// Weeks run Monday to Sunday, and every boundary is computed in UTC so a
/// shift never lands in a different week depending on where the server runs.

const DAY_MS = 24 * 60 * 60 * 1000;

export type Week = {
  start: Date;
  end: Date;
};

export function startOfWeek(date: Date): Date {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  // getUTCDay() is 0 for Sunday, so Sunday belongs to the week that began six
  // days earlier rather than starting a new one.
  const weekday = new Date(utc).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return new Date(utc - daysSinceMonday * DAY_MS);
}

export function weekOf(date: Date): Week {
  const start = startOfWeek(date);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

//move fwd bkwd 
export function shiftWeek(week: Week, deltaWeeks: number): Week {
  return weekOf(new Date(week.start.getTime() + deltaWeeks * 7 * DAY_MS));
}

/// Each day of the week
export function daysOf(week: Week): Date[] {
  return Array.from({ length: 7 }, (_, i) => new Date(week.start.getTime() + i * DAY_MS));
}

/// `?week=YYYY-MM-DD` — any date in the week works; it snaps to the Monday.
/// Anything unparseable falls back to the given default rather than erroring,
/// so a hand-edited URL cannot break the page.
export function parseWeekParam(param: string | undefined, fallback: Date): Week {
  if (!param) return weekOf(fallback);

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(param.trim());
  if (!match) return weekOf(fallback);

  const [year, month, day] = [+match[1], +match[2], +match[3]];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return weekOf(fallback);
  }

  return weekOf(parsed);
}

/// The `?week=` value for a week, i.e. its Monday.
export function weekParam(week: Week): string {
  return toDateParam(week.start);
}

export function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const WEEKDAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export function formatDayHeading(date: Date): string {
  return WEEKDAY_MONTH.format(date);
}

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const DAY_NUMBER = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" });

/// The rota columns want the weekday and the date apart, so each can carry its
/// own weight: "MON" quiet and small, "27" in the text colour.
export function formatWeekday(date: Date): string {
  return WEEKDAY.format(date);
}

export function formatDayNumber(date: Date): string {
  return DAY_NUMBER.format(date);
}

export function formatTime(date: Date): string {
  return TIME.format(date);
}

/// "3 – 9 Aug 2026"
export function formatWeekRange(week: Week): string {
  const lastDay = new Date(week.end.getTime() - DAY_MS);
  return `${DAY_MONTH.format(week.start)} – ${DAY_MONTH.format(lastDay)} ${lastDay.getUTCFullYear()}`;
}

/// Overnight shifts belong to the day they start on, which is how rotas are
/// read: a 22:00–06:00 shift is "Saturday night", not part of Sunday.
export function isSameUTCDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}



// Intl.DateTimeFormat instances are created once at module level, not inside the format functions. Creating them is expensive, and the dashboard calls formatTime a few hundred times per render.
