import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.middleware.js";

const router = Router();

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().date().nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  medicalHistory: z.string().max(10000).nullable().optional(),
  avatarUrl: z.string().url().max(2000).nullable().optional()
});

router.use(requireAuth, requireRole("patient"));

router.get(
  "/profile",
  asyncHandler(async (req: AuthRequest, res) => {
    const result = await pool.query(
      `SELECT
         p.id,
         p.first_name,
         p.last_name,
         p.date_of_birth,
         p.phone,
         p.weight_kg,
         p.height_cm,
         p.medical_history,
         p.avatar_url,
         u.email
       FROM patient_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
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
      dateOfBirth: row.date_of_birth
        ? new Date(row.date_of_birth).toISOString().slice(0, 10)
        : null,
      phone: row.phone,
      weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
      heightCm: row.height_cm != null ? Number(row.height_cm) : null,
      medicalHistory: row.medical_history,
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

    const { firstName, lastName, dateOfBirth, weightKg, heightCm, phone, medicalHistory, avatarUrl } =
      parsed.data;

    const result = await pool.query(
      `UPDATE patient_profiles
       SET
         first_name = $2,
         last_name = $3,
         date_of_birth = $4,
         weight_kg = $5,
         height_cm = $6,
         phone = $7,
         medical_history = $8,
         avatar_url = COALESCE($9, avatar_url),
         updated_at = NOW()
       WHERE user_id = $1
       RETURNING
         id,
         first_name,
         last_name,
         date_of_birth,
         phone,
         weight_kg,
         height_cm,
         medical_history,
         avatar_url`,
      [
        req.user!.sub,
        firstName,
        lastName,
        dateOfBirth ?? null,
        weightKg ?? null,
        heightCm ?? null,
        phone ?? null,
        medicalHistory ?? null,
        avatarUrl ?? null
      ]
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
      dateOfBirth: row.date_of_birth
        ? new Date(row.date_of_birth).toISOString().slice(0, 10)
        : null,
      phone: row.phone,
      weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
      heightCm: row.height_cm != null ? Number(row.height_cm) : null,
      medicalHistory: row.medical_history,
      avatarUrl: row.avatar_url
    });
  })
);

export default router;
