import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { asyncHandler } from "../lib/async-handler.js";
import { signToken } from "../lib/jwt.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["patient", "doctor"])
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128)
});

type DbUser = {
  id: string;
  email: string;
  role: "patient" | "doctor" | "admin";
};

function profileNamesFromEmail(email: string): { firstName: string; lastName: string } {
  const local = email.split("@")[0] ?? "user";
  const parts = local.replace(/[._+-]+/g, " ").trim().split(/\s+/);
  const firstName =
    parts[0]?.charAt(0).toUpperCase() + (parts[0]?.slice(1).toLowerCase() ?? "") || "New";
  const lastName =
    parts[1]?.charAt(0).toUpperCase() + (parts[1]?.slice(1).toLowerCase() ?? "") || "User";
  return { firstName, lastName };
}

function toPublicUser(user: DbUser) {
  return { id: user.id, email: user.email, role: user.role };
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { email, password, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const { firstName, lastName } = profileNamesFromEmail(normalizedEmail);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userResult = await client.query<DbUser>(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, email, role`,
        [normalizedEmail, passwordHash, role]
      );

      const user = userResult.rows[0];
      if (!user) {
        throw new Error("Failed to create user");
      }

      if (role === "patient") {
        await client.query(
          `INSERT INTO patient_profiles (user_id, first_name, last_name)
           VALUES ($1, $2, $3)`,
          [user.id, firstName, lastName]
        );
      } else {
        await client.query(
          `INSERT INTO doctor_profiles (user_id, first_name, last_name)
           VALUES ($1, $2, $3)`,
          [user.id, firstName, lastName]
        );
      }

      await client.query("COMMIT");

      const token = signToken({
        sub: user.id,
        email: user.email,
        role: user.role
      });

      res.status(201).json({ user: toPublicUser(user), token });
    } catch (err: unknown) {
      await client.query("ROLLBACK");
      if (err && typeof err === "object" && "code" in err && err.code === "23505") {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const result = await pool.query<DbUser & { password_hash: string }>(
      `SELECT id, email, role, password_hash
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role
    });

    res.json({
      user: toPublicUser(user),
      token
    });
  })
);

export default router;
