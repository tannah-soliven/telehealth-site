import { Router } from "express";

import { pool } from "../db/pool.js";
import { asyncHandler } from "../lib/async-handler.js";
import { formatAppTzIso } from "../lib/timezone.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.middleware.js";

const router = Router();

// GET /api/patients/:patientId/records
// Returns full appointment history including consultation notes.
// Accessible by: the patient themselves, or any authenticated doctor.
router.get(
  "/:patientId/records",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { patientId } = req.params;
    const userId = req.user!.sub;

    if (req.user!.role === "patient") {
      const own = await pool.query<{ id: string }>(
        `SELECT id FROM patient_profiles WHERE id = $1 AND user_id = $2`,
        [patientId, userId]
      );
      if (!own.rows[0]) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else if (req.user!.role !== "doctor") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Patient profile (weight, height, medical history) for doctor context
    const profileResult = await pool.query(
      `SELECT
         p.first_name, p.last_name, p.date_of_birth,
         p.weight_kg, p.height_cm, p.medical_history, p.phone, u.email
       FROM patient_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [patientId]
    );
    const profile = profileResult.rows[0];

    // Full appointment + note history
    const result = await pool.query(
      `SELECT
         a.id                AS appointment_id,
         a.scheduled_start,
         a.status,
         a.reason,
         dp.id              AS doctor_id,
         dp.first_name      AS doctor_first_name,
         dp.last_name       AS doctor_last_name,
         dp.specialty       AS doctor_specialty,
         cn.id              AS note_id,
         cn.findings,
         cn.prescription,
         cn.created_at      AS note_created_at
       FROM appointments a
       JOIN doctor_profiles dp ON dp.id = a.doctor_id
       LEFT JOIN consultation_notes cn ON cn.appointment_id = a.id
       WHERE a.patient_id = $1
       ORDER BY a.scheduled_start DESC`,
      [patientId]
    );

    const records = result.rows.map((r) => ({
      appointmentId: r.appointment_id,
      scheduledStart: formatAppTzIso(new Date(r.scheduled_start)),
      status: r.status,
      reason: r.reason,
      doctor: {
        id: r.doctor_id,
        name: `Dr. ${r.doctor_first_name} ${r.doctor_last_name}`,
        specialty: r.doctor_specialty
      },
      note: r.note_id
        ? {
            id: r.note_id,
            findings: r.findings,
            prescription: r.prescription,
            createdAt: formatAppTzIso(new Date(r.note_created_at))
          }
        : null
    }));

    res.json({
      profile: profile
        ? {
            firstName: profile.first_name,
            lastName: profile.last_name,
            email: profile.email,
            dateOfBirth: profile.date_of_birth
              ? new Date(profile.date_of_birth).toISOString().slice(0, 10)
              : null,
            weightKg: profile.weight_kg != null ? Number(profile.weight_kg) : null,
            heightCm: profile.height_cm != null ? Number(profile.height_cm) : null,
            phone: profile.phone,
            medicalHistory: profile.medical_history
          }
        : null,
      records
    });
  })
);

export default router;
