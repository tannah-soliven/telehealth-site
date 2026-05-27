import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { defaultWeeklyGrid, HOURS, syncAvailabilitySlots, type WeeklySlot } from "../lib/sync-availability.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.middleware.js";

const router = Router();

const weeklySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  hour: z.number().int().min(9).max(16),
  available: z.boolean()
});

const saveAvailabilitySchema = z.object({
  slots: z.array(weeklySlotSchema)
});

async function getDoctorProfileId(userId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(
    `SELECT id FROM doctor_profiles WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0]?.id ?? null;
}

function mergeWeeklySlots(stored: WeeklySlot[]): WeeklySlot[] {
  const grid = defaultWeeklyGrid();
  for (const slot of stored) {
    const idx = grid.findIndex((g) => g.dayOfWeek === slot.dayOfWeek && g.hour === slot.hour);
    if (idx >= 0 && grid[idx]) {
      grid[idx] = {
        dayOfWeek: grid[idx]!.dayOfWeek,
        hour: grid[idx]!.hour,
        available: slot.available
      };
    }
  }
  return grid;
}

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  bio: z.string().max(5000).nullable().optional(),
  specialization: z.string().max(150).nullable().optional()
});

router.use(requireAuth, requireRole("doctor"));

router.get(
  "/availability",
  asyncHandler(async (req: AuthRequest, res) => {
    const doctorId = await getDoctorProfileId(req.user!.sub);
    if (!doctorId) {
      res.status(404).json({ error: "Doctor profile not found" });
      return;
    }

    const result = await pool.query<{ day_of_week: number; hour: number }>(
      `SELECT DISTINCT
         EXTRACT(DOW FROM starts_at AT TIME ZONE 'Asia/Manila')::int AS day_of_week,
         EXTRACT(HOUR FROM starts_at AT TIME ZONE 'Asia/Manila')::int AS hour
       FROM availability_slots
       WHERE doctor_id = $1
         AND starts_at > NOW()
         AND starts_at < NOW() + INTERVAL '28 days'`,
      [doctorId]
    );

    const stored: WeeklySlot[] = result.rows.map((r) => ({
      dayOfWeek: r.day_of_week,
      hour: r.hour,
      available: true
    }));

    res.json({
      slots: mergeWeeklySlots(stored),
      hours: HOURS,
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    });
  })
);

router.post(
  "/availability",
  asyncHandler(async (req: AuthRequest, res) => {
    const parsed = saveAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const doctorId = await getDoctorProfileId(req.user!.sub);
    if (!doctorId) {
      res.status(404).json({ error: "Doctor profile not found" });
      return;
    }

    const slots: WeeklySlot[] = parsed.data.slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      hour: s.hour,
      available: s.available
    }));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await syncAvailabilitySlots(doctorId, slots, client);

      await client.query("COMMIT");

      res.json({ ok: true, slots: mergeWeeklySlots(slots) });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

router.get(
  "/profile",
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `SELECT
         d.id,
         d.first_name,
         d.last_name,
         d.specialty,
         d.bio,
         u.email
       FROM doctor_profiles d
       JOIN users u ON u.id = d.user_id
       WHERE d.user_id = $1`,
      [req.user!.sub]
    );

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.json({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      specialization: row.specialty,
      bio: row.bio
    });
  })
);

router.put(
  "/profile",
  asyncHandler(async (req: AuthRequest, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { firstName, lastName, bio, specialization } = parsed.data;

    const result = await pool.query(
      `UPDATE doctor_profiles
       SET
         first_name = $2,
         last_name = $3,
         bio = $4,
         specialty = $5,
         updated_at = NOW()
       WHERE user_id = $1
       RETURNING id, first_name, last_name, specialty, bio`,
      [req.user!.sub, firstName, lastName, bio ?? null, specialization ?? null]
    );

    const row = result.rows[0];
    if (!row) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.json({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      specialization: row.specialty,
      bio: row.bio
    });
  })
);

export default router;
