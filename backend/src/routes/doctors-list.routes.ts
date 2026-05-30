import { Router } from "express";

import { pool } from "../db/pool.js";
import { asyncHandler } from "../lib/async-handler.js";
import { DOCTOR_PROFILE_COMPLETE_SQL } from "../lib/doctor-profile-complete.js";
import { formatAppTzIso } from "../lib/timezone.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);

function formatDoctorListRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `Dr. ${row.first_name} ${row.last_name}`,
    specialty: row.specialty,
    bio: row.bio,
    availableSlotCount: Number(row.available_slot_count ?? 0),
    nextAvailableAt: row.next_available_at
      ? formatAppTzIso(new Date(row.next_available_at as string))
      : null
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const specialty = typeof req.query.specialty === "string" ? req.query.specialty.trim() : "";

    const params: string[] = [];
    let specialtyFilter = "";
    if (specialty) {
      params.push(specialty);
      specialtyFilter = `AND d.specialty ILIKE $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         d.id,
         d.first_name,
         d.last_name,
         d.specialty,
         d.bio,
         COUNT(s.id) FILTER (
           WHERE s.is_booked = FALSE AND s.starts_at > NOW()
         )::int AS available_slot_count,
         MIN(s.starts_at) FILTER (
           WHERE s.is_booked = FALSE AND s.starts_at > NOW()
         ) AS next_available_at
       FROM doctor_profiles d
       LEFT JOIN availability_slots s ON s.doctor_id = d.id
       WHERE ${DOCTOR_PROFILE_COMPLETE_SQL} ${specialtyFilter}
       GROUP BY d.id
       ORDER BY d.last_name, d.first_name`,
      params
    );

    res.json({ doctors: result.rows.map(formatDoctorListRow) });
  })
);

router.get(
  "/specialties",
  asyncHandler(async (_req, res) => {
    const result = await pool.query<{ specialty: string }>(
      `SELECT DISTINCT specialty
       FROM doctor_profiles d
       WHERE ${DOCTOR_PROFILE_COMPLETE_SQL}
       ORDER BY specialty ASC`
    );
    res.json({ specialties: result.rows.map((r) => r.specialty) });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const doctorResult = await pool.query(
      `SELECT id, first_name, last_name, specialty, bio, license_number
       FROM doctor_profiles d
       WHERE id = $1 AND ${DOCTOR_PROFILE_COMPLETE_SQL}`,
      [id]
    );

    const doctor = doctorResult.rows[0];
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const slotsResult = await pool.query(
      `SELECT id, starts_at, ends_at
       FROM availability_slots
       WHERE doctor_id = $1
         AND is_booked = FALSE
         AND starts_at > NOW()
       ORDER BY starts_at ASC
       LIMIT 100`,
      [id]
    );

    res.json({
      id: doctor.id,
      firstName: doctor.first_name,
      lastName: doctor.last_name,
      name: `Dr. ${doctor.first_name} ${doctor.last_name}`,
      specialty: doctor.specialty,
      bio: doctor.bio,
      licenseNumber: doctor.license_number,
      availableSlots: slotsResult.rows.map((s) => ({
        id: s.id,
        startsAt: formatAppTzIso(new Date(s.starts_at)),
        endsAt: formatAppTzIso(new Date(s.ends_at))
      }))
    });
  })
);

export default router;
