/** Application timezone: Philippine Time (UTC+8). All user-facing times use this. */
export const APP_TZ_OFFSET_HOURS = 8;
export const APP_TZ_SUFFIX = "+08:00";

export type AppTzParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Wall-clock components in Philippine Time for a UTC instant. */
export function toAppTzParts(date: Date): AppTzParts {
  const shifted = new Date(date.getTime() + APP_TZ_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    dayOfWeek: shifted.getUTCDay()
  };
}

/** UTC instant from Philippine wall-clock components. */
export function fromAppTzParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0
): Date {
  return new Date(
    Date.UTC(year, month - 1, day, hour - APP_TZ_OFFSET_HOURS, minute, second)
  );
}

/** ISO-8601 string with +08:00 offset (wall clock = Philippine time). */
export function formatAppTzIso(date: Date): string {
  const p = toAppTzParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}${APP_TZ_SUFFIX}`;
}

/** Human-readable datetime for notifications (Philippine wall clock). */
export function formatAppTzDisplay(date: Date): string {
  const p = toAppTzParts(date);
  const hour12 = p.hour % 12 || 12;
  const ampm = p.hour < 12 ? "AM" : "PM";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  return `${months[p.month - 1]} ${p.day}, ${p.year}, ${hour12}:${pad2(p.minute)} ${ampm} PHT`;
}

export function addAppTzDays(
  year: number,
  month: number,
  day: number,
  days: number
): Pick<AppTzParts, "year" | "month" | "day" | "dayOfWeek"> {
  const midnight = fromAppTzParts(year, month, day, 0, 0, 0);
  const next = new Date(midnight.getTime() + days * 86_400_000);
  const p = toAppTzParts(next);
  return { year: p.year, month: p.month, day: p.day, dayOfWeek: p.dayOfWeek };
}
