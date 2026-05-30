import "dotenv/config";
import { createApp } from "./app.js";

const app = createApp();

const groqKey = process.env.GROQ_API_KEY?.trim();
const groqModel = process.env.GROQ_MODEL?.trim() ?? "llama-3.1-8b-instant";
const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
    process.env.CLOUDINARY_API_KEY?.trim() &&
    process.env.CLOUDINARY_API_SECRET?.trim()
);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[backend] listening on http://localhost:${port}`);
  console.log(
    `[backend] GROQ_API_KEY: ${groqKey ? `configured (${groqKey.length} chars)` : "MISSING"}`
  );
  console.log(`[backend] GROQ_MODEL: ${groqModel}`);
  console.log(`[backend] Cloudinary: ${cloudinaryConfigured ? "configured" : "MISSING"}`);
});

