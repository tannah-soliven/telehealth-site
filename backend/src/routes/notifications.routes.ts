import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { asyncHandler } from "../lib/async-handler.js";
import { formatAppTzIso } from "../lib/timezone.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.middleware.js";

const router = Router();

const markReadSchema = z
  .object({
    notificationIds: z.array(z.string().uuid()).optional(),
    markAll: z.boolean().optional()
  })
  .refine((d) => (d.notificationIds?.length ?? 0) > 0 || d.markAll === true, {
    message: "Provide notificationIds or markAll: true"
  });

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = typeof req.query.userId === "string" ? req.query.userId : req.user!.sub;

    if (userId !== req.user!.sub) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const unreadOnly = req.query.unread !== "false";

    const result = await pool.query(
      `SELECT
         id,
         type,
         title,
         body,
         related_appointment_id,
         read_at,
         created_at
       FROM notifications
       WHERE user_id = $1
         ${unreadOnly ? "AND read_at IS NULL" : ""}
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({
      notifications: result.rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        relatedAppointmentId: n.related_appointment_id,
        readAt: n.read_at ? formatAppTzIso(new Date(n.read_at)) : null,
        createdAt: formatAppTzIso(new Date(n.created_at))
      }))
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const parsed = markReadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const userId = req.user!.sub;

    if (parsed.data.markAll) {
      await pool.query(
        `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
        [userId]
      );
    } else {
      await pool.query(
        `UPDATE notifications
         SET read_at = NOW()
         WHERE user_id = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL`,
        [userId, parsed.data.notificationIds]
      );
    }

    res.json({ ok: true });
  })
);

export default router;
