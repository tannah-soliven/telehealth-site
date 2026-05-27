CREATE TABLE IF NOT EXISTS doctor_weekly_availability (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    UUID    NOT NULL REFERENCES doctor_profiles (id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour         SMALLINT NOT NULL CHECK (hour BETWEEN 9 AND 16),
  is_available BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT doctor_weekly_availability_unique UNIQUE (doctor_id, day_of_week, hour)
);

CREATE INDEX IF NOT EXISTS idx_doctor_weekly_availability_doctor
  ON doctor_weekly_availability (doctor_id);
