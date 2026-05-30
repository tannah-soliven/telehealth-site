import { Router } from "express";
import multer from "multer";

import { pool } from "../db/pool.js";
import { uploadImageBuffer, isCloudinaryConfigured } from "../lib/cloudinary.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.middleware.js";

const router = Router();

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
  }
});

router.post(
  "/profile-picture",
  requireAuth,
  upload.single("image"),
  asyncHandler(async (req: AuthRequest, res) => {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({
        error: "Image upload is not configured. Set Cloudinary environment variables."
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No image file provided. Use form field name 'image'." });
      return;
    }

    const role = req.user!.role;
    if (role !== "patient" && role !== "doctor") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const imageUrl = await uploadImageBuffer(
      req.file.buffer,
      req.file.mimetype,
      `${role}-${req.user!.sub}`
    );

    if (role === "patient") {
      const result = await pool.query(
        `UPDATE patient_profiles
         SET avatar_url = $2, updated_at = NOW()
         WHERE user_id = $1
         RETURNING avatar_url`,
        [req.user!.sub, imageUrl]
      );
      if (!result.rows[0]) {
        res.status(404).json({ error: "Patient profile not found" });
        return;
      }
    } else {
      const result = await pool.query(
        `UPDATE doctor_profiles
         SET avatar_url = $2, updated_at = NOW()
         WHERE user_id = $1
         RETURNING avatar_url`,
        [req.user!.sub, imageUrl]
      );
      if (!result.rows[0]) {
        res.status(404).json({ error: "Doctor profile not found" });
        return;
      }
    }

    res.json({ url: imageUrl });
  })
);

export default router;
