import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

const recommendSchema = z.object({
  symptoms: z.string().min(3).max(5000)
});

const MODEL = "claude-sonnet-4-20250514";

const KNOWN_SPECIALTIES = [
  "Cardiologist",
  "Dermatologist",
  "Pediatrician",
  "Neurologist",
  "General Practitioner"
];

router.post(
  "/recommend",
  requireAuth,
  requireRole("patient"),
  asyncHandler(async (req, res) => {
    const parsed = recommendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI recommendations are not configured" });
      return;
    }

    const prompt = `You are a medical triage assistant for a telehealth platform (not a doctor).
Given these patient symptoms, recommend 1-3 medical specialties that would be most appropriate.

Symptoms:
"""
${parsed.data.symptoms}
"""

Respond with ONLY valid JSON in this exact shape (no markdown):
{"specialties":["Specialty Name"],"reasoning":"brief explanation"}

Use specialty names from this list when possible:
${KNOWN_SPECIALTIES.join(", ")}`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      res.status(502).json({ error: "AI service unavailable" });
      return;
    }

    const anthropicData = (await anthropicRes.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const textBlock = anthropicData.content?.find((c) => c.type === "text");
    const rawText = textBlock?.text ?? "";

    let specialties: string[] = [];
    let reasoning = "";

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsedAi = JSON.parse(jsonMatch?.[0] ?? rawText) as {
        specialties?: string[];
        reasoning?: string;
      };
      specialties = parsedAi.specialties ?? [];
      reasoning = parsedAi.reasoning ?? "";
    } catch {
      res.status(502).json({ error: "Failed to parse AI response" });
      return;
    }

    if (specialties.length === 0) {
      specialties = ["General Practitioner"];
    }

    const doctorsResult = await pool.query(
      `SELECT
         d.id,
         d.first_name,
         d.last_name,
         d.specialty,
         d.bio,
         COUNT(s.id) FILTER (
           WHERE s.is_booked = FALSE AND s.starts_at > NOW()
         )::int AS available_slot_count
       FROM doctor_profiles d
       LEFT JOIN availability_slots s ON s.doctor_id = d.id
       WHERE d.specialty ILIKE ANY($1::text[])
       GROUP BY d.id
       ORDER BY available_slot_count DESC, d.last_name`,
      [specialties.map((s) => `%${s}%`)]
    );

    res.json({
      specialties,
      reasoning,
      doctors: doctorsResult.rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        name: `Dr. ${row.first_name} ${row.last_name}`,
        specialty: row.specialty,
        bio: row.bio,
        availableSlotCount: Number(row.available_slot_count ?? 0)
      }))
    });
  })
);

export default router;
