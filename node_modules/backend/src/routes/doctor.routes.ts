import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { defaultWeeklyGrid, HOURS, syncAvailabilitySlots, type WeeklySlot } from "../lib/sync-availability.js";
import { asyncHandler } from "../lib/async-handler.js";
import { formatAppTzIso } from "../lib/timezone.js";
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
  specialization: z.string().max(150).nullable().optional(),
  avatarUrl: z.string().url().max(2000).nullable().optional()
});

router.use(requireAuth, requireRole("doctor"));

router.get(
  "/patients",
  asyncHandler(async (req: AuthRequest, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const pattern = search.length > 0 ? `%${search}%` : null;

    const result = await pool.query(
      `SELECT
         p.id,
         p.first_name,
         p.last_name,
         u.email,
         p.date_of_birth,
         MAX(a.scheduled_start) AS most_recent_appointment,
         bool_or(
           $1::text IS NOT NULL
           AND (
             p.first_name ILIKE $1
             OR p.last_name ILIKE $1
             OR (p.first_name || ' ' || p.last_name) ILIKE $1
           )
         ) AS matched_name,
         bool_or($1::text IS NOT NULL AND u.email ILIKE $1) AS matched_email,
         bool_or(
           $1::text IS NOT NULL
           AND p.date_of_birth IS NOT NULL
           AND (
             to_char(p.date_of_birth, 'YYYY-MM-DD') ILIKE $1
             OR to_char(p.date_of_birth, 'Mon DD, YYYY') ILIKE $1
             OR to_char(p.date_of_birth, 'FMMonth DD, YYYY') ILIKE $1
             OR to_char(p.date_of_birth, 'DD Mon YYYY') ILIKE $1
           )
         ) AS matched_birthday,
         bool_or($1::text IS NOT NULL AND p.weight_kg::text ILIKE $1) AS matched_weight,
         bool_or($1::text IS NOT NULL AND p.height_cm::text ILIKE $1) AS matched_height,
         bool_or($1::text IS NOT NULL AND p.phone ILIKE $1) AS matched_contact,
         bool_or($1::text IS NOT NULL AND p.medical_history ILIKE $1) AS matched_medical_history,
         bool_or($1::text IS NOT NULL AND cn.findings ILIKE $1) AS matched_findings,
         bool_or($1::text IS NOT NULL AND cn.prescription ILIKE $1) AS matched_prescription
       FROM patient_profiles p
       JOIN users u ON u.id = p.user_id
       JOIN appointments a ON a.patient_id = p.id
       LEFT JOIN consultation_notes cn ON cn.appointment_id = a.id
       WHERE (
         $1::text IS NULL
         OR p.first_name ILIKE $1
         OR p.last_name ILIKE $1
         OR u.email ILIKE $1
         OR (p.first_name || ' ' || p.last_name) ILIKE $1
         OR (
           p.date_of_birth IS NOT NULL
           AND (
             to_char(p.date_of_birth, 'YYYY-MM-DD') ILIKE $1
             OR to_char(p.date_of_birth, 'Mon DD, YYYY') ILIKE $1
             OR to_char(p.date_of_birth, 'FMMonth DD, YYYY') ILIKE $1
             OR to_char(p.date_of_birth, 'DD Mon YYYY') ILIKE $1
           )
         )
         OR p.weight_kg::text ILIKE $1
         OR p.height_cm::text ILIKE $1
         OR p.phone ILIKE $1
         OR p.medical_history ILIKE $1
         OR cn.findings ILIKE $1
         OR cn.prescription ILIKE $1
       )
       GROUP BY p.id, p.first_name, p.last_name, u.email, p.date_of_birth
       ORDER BY most_recent_appointment DESC, p.last_name ASC, p.first_name ASC`,
      [pattern]
    );

    res.json({
      patients: result.rows.map((row) => {
        const matchReasons: string[] = [];
        if (row.matched_name) matchReasons.push("name");
        if (row.matched_email) matchReasons.push("email");
        if (row.matched_birthday) matchReasons.push("birthday");
        if (row.matched_weight) matchReasons.push("weight");
        if (row.matched_height) matchReasons.push("height");
        if (row.matched_contact) matchReasons.push("contact");
        if (row.matched_medical_history) matchReasons.push("medical history");
        if (row.matched_findings) matchReasons.push("consultation notes");
        if (row.matched_prescription) matchReasons.push("prescription");

        return {
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          name: `${row.first_name} ${row.last_name}`,
          email: row.email,
          dateOfBirth: row.date_of_birth
            ? new Date(row.date_of_birth).toISOString().slice(0, 10)
            : null,
          mostRecentAppointment: row.most_recent_appointment
            ? formatAppTzIso(new Date(row.most_recent_appointment))
            : null,
          matchReasons
        };
      })
    });
  })
);

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
         d.avatar_url,
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
      bio: row.bio,
      avatarUrl: row.avatar_url
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

    const { firstName, lastName, bio, specialization, avatarUrl } = parsed.data;

    const result = await pool.query(
      `UPDATE doctor_profiles
       SET
         first_name = $2,
         last_name = $3,
         bio = $4,
         specialty = $5,
         avatar_url = COALESCE($6, avatar_url),
         updated_at = NOW()
       WHERE user_id = $1
       RETURNING id, first_name, last_name, specialty, bio, avatar_url`,
      [req.user!.sub, firstName, lastName, bio ?? null, specialization ?? null, avatarUrl ?? null]
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
      bio: row.bio,
      avatarUrl: row.avatar_url
    });
  })
);

export default router;
