import { Router } from "express";
import Groq from "groq-sdk";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { asyncHandler } from "../lib/async-handler.js";
import { DOCTOR_PROFILE_COMPLETE_SQL } from "../lib/doctor-profile-complete.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

const recommendSchema = z.object({
  symptoms: z.string().min(3).max(5000)
});

const DEFAULT_MODEL = "llama-3.1-8b-instant";

function getGroqApiKey(): string | null {
  const raw = process.env.GROQ_API_KEY;
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
}

function createGroqClient(apiKey: string): Groq {
  return new Groq({ apiKey });
}

async function callGroqChat(
  client: Groq,
  model: string,
  prompt: string
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  console.log(`[ai/recommend] Groq request model=${model}`);

  try {
    const completion = await client.chat.completions.create({
      model,
      max_tokens: 512,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      console.error("[ai/recommend] Groq returned empty content");
      return { ok: false, message: "AI returned an empty response" };
    }

    return { ok: true, text };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error calling Groq API";
    console.error("[ai/recommend] Groq API error:", message);
    return { ok: false, message };
  }
}

async function recommendSpecialties(
  client: Groq,
  symptoms: string,
  specialtyList: string[]
): Promise<
  | { ok: true; specialties: string[]; reasoning: string; modelUsed: string }
  | { ok: false; message: string }
> {
  const prompt = `You are a medical triage assistant for a telehealth platform (not a doctor).
Given these patient symptoms, recommend 1-3 medical specialties that would be most appropriate.

Symptoms:
"""
${symptoms}
"""

Respond with ONLY valid JSON in this exact shape (no markdown):
{"specialties":["Specialty Name"],"reasoning":"brief explanation"}

Use specialty names from this list when possible:
${specialtyList.join(", ")}`;

  const model = getGroqModel();
  const result = await callGroqChat(client, model, prompt);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    const parsedAi = JSON.parse(jsonMatch?.[0] ?? result.text) as {
      specialties?: string[];
      reasoning?: string;
    };
    const specialties = (parsedAi.specialties ?? []).filter(Boolean);
    return {
      ok: true,
      specialties: specialties.length > 0 ? specialties : ["General Practitioner"],
      reasoning: parsedAi.reasoning ?? "",
      modelUsed: model
    };
  } catch (parseErr) {
    console.error("[ai/recommend] Failed to parse AI JSON:", result.text.slice(0, 500), parseErr);
    return { ok: false, message: "Failed to parse AI response" };
  }
}

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

    const apiKey = getGroqApiKey();
    if (!apiKey) {
      console.error("[ai/recommend] GROQ_API_KEY is missing or empty");
      res.status(503).json({
        error: "AI recommendations are not configured. Set GROQ_API_KEY on the server."
      });
      return;
    }

    console.log(
      `[ai/recommend] request symptomsLength=${parsed.data.symptoms.length} keyConfigured=true`
    );

    const specialtyResult = await pool.query<{ specialty: string }>(
      `SELECT DISTINCT specialty
       FROM doctor_profiles d
       WHERE ${DOCTOR_PROFILE_COMPLETE_SQL}
       ORDER BY specialty ASC`
    );
    const specialtyList =
      specialtyResult.rows.length > 0
        ? specialtyResult.rows.map((r) => r.specialty)
        : [
            "Cardiologist",
            "Dermatologist",
            "Pediatrician",
            "Neurologist",
            "General Practitioner"
          ];

    const client = createGroqClient(apiKey);
    const aiResult = await recommendSpecialties(client, parsed.data.symptoms, specialtyList);
    if (!aiResult.ok) {
      res.status(502).json({ error: aiResult.message });
      return;
    }

    console.log(
      `[ai/recommend] model=${aiResult.modelUsed} specialties=${aiResult.specialties.join(", ")}`
    );

    const patterns = aiResult.specialties.map((s) => `%${s}%`);
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
       WHERE ${DOCTOR_PROFILE_COMPLETE_SQL}
         AND d.specialty ILIKE ANY($1::text[])
       GROUP BY d.id
       ORDER BY available_slot_count DESC, d.last_name`,
      [patterns]
    );

    res.json({
      specialties: aiResult.specialties,
      reasoning: aiResult.reasoning,
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
