import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const cond =
  "(starts_at AT TIME ZONE 'Asia/Manila')::time IN ('17:00:00'::time, '18:00:00'::time)";

try {
  const before = await pool.query(
    `SELECT COUNT(*)::int AS cnt_before FROM availability_slots WHERE ${cond}`
  );
  console.log("Before count:", before.rows[0].cnt_before);

  await pool.query(`DELETE FROM availability_slots WHERE ${cond}`);

  const after = await pool.query(
    `SELECT COUNT(*)::int AS cnt_after FROM availability_slots WHERE ${cond}`
  );
  console.log("After count:", after.rows[0].cnt_after);

  const sample = await pool.query(
    `SELECT id, doctor_id, (starts_at AT TIME ZONE 'Asia/Manila') AS starts_pht
     FROM availability_slots
     WHERE ${cond}
     LIMIT 5`
  );
  console.log("Sample remaining rows:", sample.rows.length);
} finally {
  await pool.end();
}

