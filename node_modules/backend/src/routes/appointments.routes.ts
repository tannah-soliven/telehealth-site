import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { formatAppointment, jitsiRoomUrl } from "../lib/appointments.js";
import { asyncHandler } from "../lib/async-handler.js";
import { formatAppTzDisplay } from "../lib/timezone.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.middleware.js";

const router = Router();

const createSchema = z.object({
  availabilitySlotId: z.string().uuid(),
  reason: z.string().max(1000).optional()
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
    cancellationReason: z.string().max(500).optional()
  }),
  z.object({
    action: z.literal("reschedule"),
    availabilitySlotId: z.string().uuid()
  })
]);

const APPOINTMENT_SELECT = `
  SELECT
    a.id,
    a.patient_id,
    a.doctor_id,
    a.availability_slot_id,
    a.scheduled_start,
    a.scheduled_end,
    a.status,
    a.reason,
    a.video_room_url,
    pp.first_name AS patient_first_name,
    pp.last_name AS patient_last_name,
    dp.first_name AS doctor_first_name,
    dp.last_name AS doctor_last_name,
    dp.specialty AS doctor_specialty
  FROM appointments a
  JOIN patient_profiles pp ON pp.id = a.patient_id
  JOIN doctor_profiles dp ON dp.id = a.doctor_id
`;

async function getPatientProfileId(userId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(
    `SELECT id FROM patient_profiles WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0]?.id ?? null;
}

async function getDoctorProfileId(userId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(
    `SELECT id FROM doctor_profiles WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0]?.id ?? null;
}

async function createBookingNotifications(
  client: import("pg").PoolClient,
  appointmentId: string,
  patientUserId: string,
  doctorUserId: string,
  when: string,
  doctorName: string,
  patientName: string
) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, related_appointment_id)
     VALUES
       ($1, 'appointment_confirmed', 'Appointment confirmed', $3, $5),
       ($2, 'appointment_confirmed', 'New appointment booked', $4, $5)`,
    [
      patientUserId,
      doctorUserId,
      `Your visit with ${doctorName} is scheduled for ${when}.`,
      `${patientName} booked an appointment for ${when}.`,
      appointmentId
    ]
  );
}

async function createRescheduleNotifications(
  client: import("pg").PoolClient,
  appointmentId: string,
  patientUserId: string,
  doctorUserId: string,
  when: string,
  doctorName: string,
  patientName: string
) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, related_appointment_id)
     VALUES
       ($1, 'appointment_confirmed', 'Appointment rescheduled', $3, $5),
       ($2, 'appointment_confirmed', 'Appointment rescheduled', $4, $5)`,
    [
      patientUserId,
      doctorUserId,
      `Your appointment with ${doctorName} has been rescheduled to ${when}.`,
      `Your appointment with ${patientName} has been rescheduled to ${when}.`,
      appointmentId
    ]
  );
}

const doctorRescheduleSchema = z.object({
  scheduledAt: z.string().min(1)
});

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const patientIdQuery = req.query.patientId as string | undefined;
    const doctorIdQuery = req.query.doctorId as string | undefined;
    const statusFilter =
      typeof req.query.status === "string" ? req.query.status : "scheduled";

    let patientId = patientIdQuery;
    let doctorId = doctorIdQuery;

    if (req.user!.role === "patient") {
      const ownPatientId = await getPatientProfileId(req.user!.sub);
      if (!ownPatientId) {
        res.status(404).json({ error: "Patient profile not found" });
        return;
      }
      if (patientId && patientId !== ownPatientId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      patientId = ownPatientId;
    } else if (req.user!.role === "doctor") {
      const ownDoctorId = await getDoctorProfileId(req.user!.sub);
      if (!ownDoctorId) {
        res.status(404).json({ error: "Doctor profile not found" });
        return;
      }
      if (doctorId && doctorId !== ownDoctorId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      doctorId = ownDoctorId;
    } else {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (patientId) {
      conditions.push(`a.patient_id = $${paramIndex++}`);
      params.push(patientId);
    }
    if (doctorId) {
      conditions.push(`a.doctor_id = $${paramIndex++}`);
      params.push(doctorId);
    }
    if (statusFilter === "upcoming") {
      conditions.push(`a.status = 'scheduled'`);
      conditions.push(`a.scheduled_start > NOW()`);
    } else if (statusFilter !== "all") {
      conditions.push(`a.status = $${paramIndex++}`);
      params.push(statusFilter);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `${APPOINTMENT_SELECT}
       ${where}
       ORDER BY a.scheduled_start ASC`,
      params
    );

    res.json({ appointments: result.rows.map(formatAppointment) });
  })
);

router.post(
  "/",
  requireAuth,
  requireRole("patient"),
  asyncHandler(async (req: AuthRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const patientProfileId = await getPatientProfileId(req.user!.sub);
    if (!patientProfileId) {
      res.status(404).json({ error: "Patient profile not found" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const slotResult = await client.query<{
        id: string;
        doctor_id: string;
        starts_at: Date;
        ends_at: Date;
        is_booked: boolean;
        doctor_user_id: string;
        doctor_first_name: string;
        doctor_last_name: string;
      }>(
        `SELECT
           s.id,
           s.doctor_id,
           s.starts_at,
           s.ends_at,
           s.is_booked,
           u.id AS doctor_user_id,
           d.first_name AS doctor_first_name,
           d.last_name AS doctor_last_name
         FROM availability_slots s
         JOIN doctor_profiles d ON d.id = s.doctor_id
         JOIN users u ON u.id = d.user_id
         WHERE s.id = $1
         FOR UPDATE OF s`,
        [parsed.data.availabilitySlotId]
      );

      const slot = slotResult.rows[0];
      if (!slot) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Availability slot not found" });
        return;
      }
      if (slot.is_booked) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: "Slot is no longer available" });
        return;
      }
      if (slot.starts_at <= new Date()) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Cannot book a past slot" });
        return;
      }

      const appointmentResult = await client.query<{ id: string }>(
        `INSERT INTO appointments (
           patient_id,
           doctor_id,
           availability_slot_id,
           scheduled_start,
           scheduled_end,
           status,
           reason,
           video_room_url
         )
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, NULL)
         RETURNING id`,
        [
          patientProfileId,
          slot.doctor_id,
          slot.id,
          slot.starts_at,
          slot.ends_at,
          parsed.data.reason ?? null
        ]
      );

      const appointmentId = appointmentResult.rows[0]!.id;
      const finalVideoUrl = jitsiRoomUrl(appointmentId);

      await client.query(
        `UPDATE appointments SET video_room_url = $2 WHERE id = $1`,
        [appointmentId, finalVideoUrl]
      );

      await client.query(
        `UPDATE availability_slots SET is_booked = TRUE, updated_at = NOW() WHERE id = $1`,
        [slot.id]
      );

      const patientNameResult = await client.query<{ first_name: string; last_name: string }>(
        `SELECT first_name, last_name FROM patient_profiles WHERE id = $1`,
        [patientProfileId]
      );
      const patientName = patientNameResult.rows[0]
        ? `${patientNameResult.rows[0].first_name} ${patientNameResult.rows[0].last_name}`
        : "A patient";

      const when = formatAppTzDisplay(slot.starts_at);
      const doctorName = `Dr. ${slot.doctor_first_name} ${slot.doctor_last_name}`;

      await createBookingNotifications(
        client,
        appointmentId,
        req.user!.sub,
        slot.doctor_user_id,
        when,
        doctorName,
        patientName
      );

      await client.query("COMMIT");

      const full = await pool.query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [appointmentId]);
      res.status(201).json({ appointment: formatAppointment(full.rows[0]) });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

router.patch(
  "/:id/reschedule",
  requireAuth,
  // 1. REMOVED requireRole("doctor") here so patients can hit this endpoint
  asyncHandler(async (req: AuthRequest, res) => {
    const parsed = doctorRescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const scheduledAt = new Date(parsed.data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      res.status(400).json({ error: "Invalid scheduledAt datetime" });
      return;
    }
    if (scheduledAt <= new Date()) {
      res.status(400).json({ error: "Cannot reschedule to a past time" });
      return;
    }

    const appointmentResult = await pool.query<{
      id: string;
      doctor_id: string;
      availability_slot_id: string | null;
      status: string;
      patient_user_id: string;
      doctor_user_id: string;
      doctor_first_name: string;
      doctor_last_name: string;
      patient_first_name: string;
      patient_last_name: string;
    }>(
      `SELECT
         a.id,
         a.doctor_id,
         a.availability_slot_id,
         a.status,
         pu.id AS patient_user_id,
         du.id AS doctor_user_id,
         dp.first_name AS doctor_first_name,
         dp.last_name AS doctor_last_name,
         pp.first_name AS patient_first_name,
         pp.last_name AS patient_last_name
       FROM appointments a
       JOIN patient_profiles pp ON pp.id = a.patient_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN doctor_profiles dp ON dp.id = a.doctor_id
       JOIN users du ON du.id = dp.user_id
       WHERE a.id = $1`,
      [req.params.id]
    );

    const appointment = appointmentResult.rows[0];
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    // 2. UPDATED SECURITY CHECK: Ensure user is EITHER the assigned doctor OR the assigned patient
    const isPatient = req.user!.role === "patient" && req.user!.sub === appointment.patient_user_id;
    const isDoctor = req.user!.role === "doctor" && req.user!.sub === appointment.doctor_user_id;
    
    if (!isPatient && !isDoctor) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (appointment.status === "cancelled") {
      res.status(400).json({ error: "Cannot reschedule a cancelled appointment" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const slotResult = await client.query<{
        id: string;
        starts_at: Date;
        ends_at: Date;
        is_booked: boolean;
      }>(
        `SELECT id, starts_at, ends_at, is_booked
         FROM availability_slots
         WHERE doctor_id = $1 AND starts_at = $2
         FOR UPDATE`,
        [appointment.doctor_id, scheduledAt]
      );

      const newSlot = slotResult.rows[0];
      if (!newSlot) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "No available slot at the selected time" });
        return;
      }
      if (
        newSlot.is_booked &&
        newSlot.id !== appointment.availability_slot_id
      ) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: "Slot is no longer available" });
        return;
      }

      if (
        appointment.availability_slot_id &&
        appointment.availability_slot_id !== newSlot.id
      ) {
        await client.query(
          `UPDATE availability_slots SET is_booked = FALSE, updated_at = NOW() WHERE id = $1`,
          [appointment.availability_slot_id]
        );
      }

      if (newSlot.id !== appointment.availability_slot_id) {
        await client.query(
          `UPDATE availability_slots SET is_booked = TRUE, updated_at = NOW() WHERE id = $1`,
          [newSlot.id]
        );
      }

      await client.query(
        `UPDATE appointments
         SET
           availability_slot_id = $2,
           scheduled_start = $3,
           scheduled_end = $4,
           updated_at = NOW()
         WHERE id = $1`,
        [appointment.id, newSlot.id, newSlot.starts_at, newSlot.ends_at]
      );

      const when = formatAppTzDisplay(newSlot.starts_at);
      const doctorName = `Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}`;
      const patientName = `${appointment.patient_first_name} ${appointment.patient_last_name}`;

      await createRescheduleNotifications(
        client,
        appointment.id,
        appointment.patient_user_id,
        appointment.doctor_user_id,
        when,
        doctorName,
        patientName
      );

      await client.query("COMMIT");

      const full = await pool.query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [appointment.id]);
      res.json({ appointment: formatAppointment(full.rows[0]) });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

router.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const appointmentResult = await pool.query<{
      id: string;
      patient_id: string;
      doctor_id: string;
      availability_slot_id: string | null;
      scheduled_start: Date;
      scheduled_end: Date;
      status: string;
      patient_user_id: string;
      doctor_user_id: string;
      doctor_first_name: string;
      doctor_last_name: string;
      patient_first_name: string;
      patient_last_name: string;
    }>(
      `SELECT
         a.id,
         a.patient_id,
         a.doctor_id,
         a.availability_slot_id,
         a.scheduled_start,
         a.scheduled_end,
         a.status,
         pu.id AS patient_user_id,
         du.id AS doctor_user_id,
         dp.first_name AS doctor_first_name,
         dp.last_name AS doctor_last_name,
         pp.first_name AS patient_first_name,
         pp.last_name AS patient_last_name
       FROM appointments a
       JOIN patient_profiles pp ON pp.id = a.patient_id
       JOIN users pu ON pu.id = pp.user_id
       JOIN doctor_profiles dp ON dp.id = a.doctor_id
       JOIN users du ON du.id = dp.user_id
       WHERE a.id = $1`,
      [req.params.id]
    );

    const appointment = appointmentResult.rows[0];
    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    const isPatient = req.user!.role === "patient" && req.user!.sub === appointment.patient_user_id;
    const isDoctor = req.user!.role === "doctor" && req.user!.sub === appointment.doctor_user_id;
    if (!isPatient && !isDoctor) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (appointment.status === "cancelled") {
      res.status(400).json({ error: "Appointment is already cancelled" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (parsed.data.action === "cancel") {
        if (appointment.availability_slot_id) {
          await client.query(
            `UPDATE availability_slots SET is_booked = FALSE, updated_at = NOW() WHERE id = $1`,
            [appointment.availability_slot_id]
          );
        }

        await client.query(
          `UPDATE appointments
           SET status = 'cancelled', updated_at = NOW()
           WHERE id = $1`,
          [appointment.id]
        );

        const when = formatAppTzDisplay(appointment.scheduled_start);

        await client.query(
          `INSERT INTO notifications (user_id, type, title, body, related_appointment_id)
           VALUES
             ($1, 'appointment_cancelled', 'Appointment cancelled', $3, $5),
             ($2, 'appointment_cancelled', 'Appointment cancelled', $4, $5)`,
          [
            appointment.patient_user_id,
            appointment.doctor_user_id,
            `Your appointment on ${when} has been cancelled.`,
            `The appointment with ${appointment.patient_first_name} ${appointment.patient_last_name} on ${when} was cancelled.`,
            appointment.id
          ]
        );
      } else {
        if (!isPatient) {
          await client.query("ROLLBACK");
          res.status(403).json({ error: "Only patients can reschedule" });
          return;
        }

        const slotResult = await client.query<{
          id: string;
          doctor_id: string;
          starts_at: Date;
          ends_at: Date;
          is_booked: boolean;
        }>(
          `SELECT id, doctor_id, starts_at, ends_at, is_booked
           FROM availability_slots
           WHERE id = $1
           FOR UPDATE`,
          [parsed.data.availabilitySlotId]
        );

        const newSlot = slotResult.rows[0];
        if (!newSlot) {
          await client.query("ROLLBACK");
          res.status(404).json({ error: "Availability slot not found" });
          return;
        }
        if (newSlot.doctor_id !== appointment.doctor_id) {
          await client.query("ROLLBACK");
          res.status(400).json({ error: "Slot must belong to the same doctor" });
          return;
        }
        if (newSlot.is_booked) {
          await client.query("ROLLBACK");
          res.status(409).json({ error: "Slot is no longer available" });
          return;
        }

        if (appointment.availability_slot_id) {
          await client.query(
            `UPDATE availability_slots SET is_booked = FALSE, updated_at = NOW() WHERE id = $1`,
            [appointment.availability_slot_id]
          );
        }

        await client.query(
          `UPDATE availability_slots SET is_booked = TRUE, updated_at = NOW() WHERE id = $1`,
          [newSlot.id]
        );

        await client.query(
          `UPDATE appointments
           SET
             availability_slot_id = $2,
             scheduled_start = $3,
             scheduled_end = $4,
             updated_at = NOW()
           WHERE id = $1`,
          [appointment.id, newSlot.id, newSlot.starts_at, newSlot.ends_at]
        );
      }

      await client.query("COMMIT");

      const full = await pool.query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [appointment.id]);
      res.json({ appointment: formatAppointment(full.rows[0]) });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

export default router;
