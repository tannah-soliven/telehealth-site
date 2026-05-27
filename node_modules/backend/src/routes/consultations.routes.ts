import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { asyncHandler } from "../lib/async-handler.js";
import { formatAppTzIso } from "../lib/timezone.js";
import {
  requireAuth,
  requireRole,
  type AuthRequest
} from "../middleware/auth.middleware.js";

const router = Router();

const saveNotesSchema = z.object({
  findings: z.string().max(10000).optional().nullable(),
  prescription: z.string().max(5000).optional().nullable()
});

type NoteRow = {
  id: string;
  appointment_id: string;
  doctor_id: string;
  findings: string | null;
  prescription: string | null;
  created_at: Date;
  updated_at: Date;
  doctor_first_name?: string;
  doctor_last_name?: string;
};

function formatNote(row: NoteRow) {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    doctorId: row.doctor_id,
    findings: row.findings,
    prescription: row.prescription,
    doctorName:
      row.doctor_first_name && row.doctor_last_name
        ? `Dr. ${row.doctor_first_name} ${row.doctor_last_name}`
        : undefined,
    createdAt: formatAppTzIso(new Date(row.created_at)),
    updatedAt: formatAppTzIso(new Date(row.updated_at))
  };
}

// GET /api/consultations/:appointmentId — any authenticated user linked to the appointment
router.get(
  "/:appointmentId",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { appointmentId } = req.params;

    const apptCheck = await pool.query<{
      patient_user_id: string;
      doctor_user_id: string;
    }>(
      `SELECT pu.id AS patient_user_id, du.id AS doctor_user_id
       FROM appointments a
       JOIN patient_profiles pp ON pp.id = a.patient_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN doctor_profiles dp ON dp.id = a.doctor_id
       JOIN users du ON du.id = dp.user_id
       WHERE a.id = $1`,
      [appointmentId]
    );

    const appt = apptCheck.rows[0];
    if (!appt) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    const userId = req.user!.sub;
    if (userId !== appt.patient_user_id && userId !== appt.doctor_user_id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const result = await pool.query<NoteRow>(
      `SELECT
         cn.id,
         cn.appointment_id,
         cn.doctor_id,
         cn.findings,
         cn.prescription,
         cn.created_at,
         cn.updated_at,
         dp.first_name AS doctor_first_name,
         dp.last_name  AS doctor_last_name
       FROM consultation_notes cn
       JOIN doctor_profiles dp ON dp.id = cn.doctor_id
       WHERE cn.appointment_id = $1`,
      [appointmentId]
    );

    res.json({ note: result.rows[0] ? formatNote(result.rows[0]) : null });
  })
);

// POST /api/consultations/:appointmentId/notes — doctor only
router.post(
  "/:appointmentId/notes",
  requireAuth,
  requireRole("doctor"),
  asyncHandler(async (req: AuthRequest, res) => {
    const { appointmentId } = req.params;

    const parsed = saveNotesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    // Verify the requesting doctor owns this appointment
    const apptResult = await pool.query<{
      id: string;
      doctor_profile_id: string;
      doctor_user_id: string;
    }>(
      `SELECT
         a.id,
         dp.id AS doctor_profile_id,
         du.id AS doctor_user_id
       FROM appointments a
       JOIN doctor_profiles dp ON dp.id = a.doctor_id
       JOIN users du ON du.id = dp.user_id
       WHERE a.id = $1`,
      [appointmentId]
    );

    const appt = apptResult.rows[0];
    if (!appt) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }
    if (appt.doctor_user_id !== req.user!.sub) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { findings, prescription } = parsed.data;

    const result = await pool.query<NoteRow>(
      `INSERT INTO consultation_notes (appointment_id, doctor_id, findings, prescription)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (appointment_id) DO UPDATE SET
         findings     = EXCLUDED.findings,
         prescription = EXCLUDED.prescription,
         updated_at   = NOW()
       RETURNING id, appointment_id, doctor_id, findings, prescription, created_at, updated_at`,
      [appointmentId, appt.doctor_profile_id, findings ?? null, prescription ?? null]
    );

    res.status(200).json({ note: formatNote(result.rows[0]!) });
  })
);

// GET /api/consultations/patient/:patientId/records — doctor or the patient themselves
router.get(
  "/patient/:patientId/records",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { patientId } = req.params;
    const userId = req.user!.sub;

    // Confirm requester is the patient or a doctor
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

    const result = await pool.query(
      `SELECT
         a.id                AS appointment_id,
         a.scheduled_start,
         a.scheduled_end,
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
         AND a.status IN ('completed','scheduled','cancelled','no_show')
       ORDER BY a.scheduled_start DESC`,
      [patientId]
    );

    const records = result.rows.map((r) => ({
      appointmentId: r.appointment_id,
      scheduledStart: formatAppTzIso(new Date(r.scheduled_start)),
      scheduledEnd: formatAppTzIso(new Date(r.scheduled_end)),
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

    res.json({ records });
  })
);

export default router;
