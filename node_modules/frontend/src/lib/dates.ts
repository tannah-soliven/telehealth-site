/** Philippine Time (UTC+8) — parse API strings without timezone conversion on display. */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
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
] as const;

/** Extract YYYY-MM-DD and HH:mm from an API datetime (always +08:00 wall clock). */
export function parseAppDateTime(iso: string): {
  date: string;
  hour: number;
  minute: number;
} {
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error(`Invalid datetime: ${iso}`);
  }
  return {
    date: match[1]!,
    hour: Number(match[2]),
    minute: Number(match[3])
  };
}

export function dateKey(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return parseAppDateTime(iso).date;
}

/** Format YYYY-MM-DD date key (no timezone conversion). */
export function formatDateFromKey(key: string): string {
  const [y, mo, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y!, mo! - 1, d!)).getUTCDay();
  return `${WEEKDAYS[weekday]}, ${MONTHS[mo! - 1]} ${d}`;
}

export function formatDate(iso: string): string {
  return formatDateFromKey(dateKey(iso));
}

export function formatTime(iso: string): string {
  const { hour, minute } = parseAppDateTime(iso);
  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? "am" : "pm";
  return `${h12}:${String(minute).padStart(2, "0")}${ampm}`;
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} at ${formatTime(iso)}`;
}

/** True when appointment start (API PHT ISO) is now or in the past. */
export function isAppointmentStartPast(iso: string): boolean {
  const start = new Date(iso);
  return !Number.isNaN(start.getTime()) && start.getTime() <= Date.now();
}

export function groupSlotsByDate<T extends { startsAt: string }>(slots: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const slot of slots) {
    const key = dateKey(slot.startsAt);
    const list = map.get(key) ?? [];
    list.push(slot);
    map.set(key, list);
  }
  return map;
}
