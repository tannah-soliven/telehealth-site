-- Hourly 30-min slots for seeded doctors over the next 14 days (weekdays, 09:00–16:00 PHT / UTC+8)
-- Run after seed.sql

BEGIN;

INSERT INTO availability_slots (doctor_id, starts_at, ends_at)
SELECT
  doc.id,
  slot_start,
  slot_start + INTERVAL '30 minutes'
FROM (
  SELECT id FROM doctor_profiles
  WHERE id IN (
    'b2000001-0001-4001-8001-000000000001',
    'b2000001-0001-4001-8001-000000000002',
    'b2000001-0001-4001-8001-000000000003',
    'b2000001-0001-4001-8001-000000000004',
    'b2000001-0001-4001-8001-000000000005'
  )
) AS doc
CROSS JOIN generate_series(0, 13) AS day_offset
CROSS JOIN generate_series(9, 16) AS hour_offset
CROSS JOIN LATERAL (
  SELECT
    (
      DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Manila')
      + day_offset * INTERVAL '1 day'
      + hour_offset * INTERVAL '1 hour'
    ) AT TIME ZONE 'Asia/Manila' AS slot_start
) AS t
WHERE EXTRACT(ISODOW FROM slot_start AT TIME ZONE 'Asia/Manila') < 6
  AND slot_start > NOW()
  AND NOT EXISTS (
    SELECT 1 FROM availability_slots s
    WHERE s.doctor_id = doc.id AND s.starts_at = slot_start
  );

COMMIT;
