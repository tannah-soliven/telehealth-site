import type { PoolClient } from "pg";

import { addAppTzDays, fromAppTzParts, toAppTzParts } from "./timezone.js";
import { pool } from "../db/pool.js";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16] as const;
const WEEKS_AHEAD = 4;

export type WeeklySlot = {
  dayOfWeek: number;
  hour: number;
  available: boolean;
};

function slotTimesForDate(
  year: number,
  month: number,
  day: number,
  hour: number
): { startsAt: Date; endsAt: Date } {
  const startsAt = fromAppTzParts(year, month, day, hour, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  return { startsAt, endsAt };
}

function isSlotAvailable(slots: WeeklySlot[], dayOfWeek: number, hour: number): boolean {
  return slots.some((s) => s.dayOfWeek === dayOfWeek && s.hour === hour && s.available);
}

export async function syncAvailabilitySlots(
  doctorId: string,
  weeklySlots: WeeklySlot[],
  client?: PoolClient
) {
  const db = client ?? pool;
  const now = new Date();
  const today = toAppTzParts(now);

  for (let offset = 0; offset < WEEKS_AHEAD * 7; offset++) {
    const { year, month, day, dayOfWeek } = addAppTzDays(
      today.year,
      today.month,
      today.day,
      offset
    );

    for (const hour of HOURS) {
      const { startsAt, endsAt } = slotTimesForDate(year, month, day, hour);
      if (startsAt <= now) continue;

      const available = isSlotAvailable(weeklySlots, dayOfWeek, hour);

      const existing = await db.query<{ id: string; is_booked: boolean }>(
        `SELECT id, is_booked FROM availability_slots
         WHERE doctor_id = $1 AND starts_at = $2`,
        [doctorId, startsAt]
      );

      const row = existing.rows[0];

      if (available) {
        if (!row) {
          await db.query(
            `INSERT INTO availability_slots (doctor_id, starts_at, ends_at, is_booked)
             VALUES ($1, $2, $3, FALSE)`,
            [doctorId, startsAt, endsAt]
          );
        }
      } else if (row && !row.is_booked) {
        await db.query(`DELETE FROM availability_slots WHERE id = $1`, [row.id]);
      }
    }
  }
}

export function defaultWeeklyGrid(): WeeklySlot[] {
  const slots: WeeklySlot[] = [];
  for (let day = 0; day <= 6; day++) {
    for (const hour of HOURS) {
      slots.push({ dayOfWeek: day, hour, available: false });
    }
  }
  return slots;
}

export { HOURS };
