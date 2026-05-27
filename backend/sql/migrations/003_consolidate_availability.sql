DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'doctor_weekly_availability'
  ) THEN
    INSERT INTO availability_slots (doctor_id, starts_at, ends_at, is_booked)
    SELECT
      dwa.doctor_id,
      (
        (
          DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Manila')
          + gs.day_offset * INTERVAL '1 day'
          + dwa.hour * INTERVAL '1 hour'
        ) AT TIME ZONE 'Asia/Manila'
      ) AS starts_at,
      (
        (
          DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Manila')
          + gs.day_offset * INTERVAL '1 day'
          + (dwa.hour + 1) * INTERVAL '1 hour'
        ) AT TIME ZONE 'Asia/Manila'
      ) AS ends_at,
      FALSE
    FROM doctor_weekly_availability dwa
    CROSS JOIN generate_series(0, 27) AS gs(day_offset)
    WHERE dwa.is_available = TRUE
      AND EXTRACT(DOW FROM (
        DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Manila')
        + gs.day_offset * INTERVAL '1 day'
      ))::int = dwa.day_of_week
      AND (
        (
          DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Manila')
          + gs.day_offset * INTERVAL '1 day'
          + dwa.hour * INTERVAL '1 hour'
        ) AT TIME ZONE 'Asia/Manila'
      ) > NOW()
      AND NOT EXISTS (
        SELECT 1
        FROM availability_slots s
        WHERE s.doctor_id = dwa.doctor_id
          AND s.starts_at = (
            (
              DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Manila')
              + gs.day_offset * INTERVAL '1 day'
              + dwa.hour * INTERVAL '1 hour'
            ) AT TIME ZONE 'Asia/Manila'
          )
      );

    DROP TABLE doctor_weekly_availability;
  END IF;
END $$;

