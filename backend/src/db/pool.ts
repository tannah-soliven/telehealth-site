import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const useSsl =
  process.env.DATABASE_SSL === "true" ||
  connectionString.includes("sslmode=require") ||
  connectionString.includes("neon.tech");

export const pool = new Pool({
  connectionString,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
});
