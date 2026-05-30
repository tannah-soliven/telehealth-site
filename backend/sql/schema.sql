-- Telehealth schema (run once on PostgreSQL / Neon)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'admin');

CREATE TYPE appointment_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
);

CREATE TYPE notification_type AS ENUM (
  'appointment_reminder',
  'appointment_confirmed',
  'appointment_cancelled',
  'consultation_note',
  'system'
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL,
  password_hash TEXT         NOT NULL,
  role          user_role    NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS patient_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name  VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  phone      VARCHAR(32),
  weight_kg  NUMERIC(5, 2),
  height_cm  NUMERIC(5, 2),
  medical_history TEXT,
  avatar_url    TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  specialty      VARCHAR(150),
  license_number VARCHAR(64) UNIQUE,
  bio            TEXT,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability_slots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  UUID        NOT NULL REFERENCES doctor_profiles (id) ON DELETE CASCADE,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  is_booked  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT availability_slots_time_check CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS appointments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           UUID               NOT NULL REFERENCES patient_profiles (id) ON DELETE RESTRICT,
  doctor_id            UUID               NOT NULL REFERENCES doctor_profiles (id) ON DELETE RESTRICT,
  availability_slot_id UUID UNIQUE REFERENCES availability_slots (id) ON DELETE SET NULL,
  scheduled_start      TIMESTAMPTZ        NOT NULL,
  scheduled_end        TIMESTAMPTZ        NOT NULL,
  status               appointment_status NOT NULL DEFAULT 'scheduled',
  reason               TEXT,
  video_room_url       TEXT,
  created_at           TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  CONSTRAINT appointments_time_check CHECK (scheduled_end > scheduled_start)
);

CREATE TABLE IF NOT EXISTS consultation_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID        NOT NULL UNIQUE REFERENCES appointments (id) ON DELETE CASCADE,
  doctor_id      UUID        NOT NULL REFERENCES doctor_profiles (id) ON DELETE RESTRICT,
  subjective     TEXT,
  objective      TEXT,
  assessment     TEXT,
  plan           TEXT,
  is_private     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type                   notification_type NOT NULL,
  title                  VARCHAR(255)      NOT NULL,
  body                   TEXT,
  related_appointment_id UUID REFERENCES appointments (id) ON DELETE SET NULL,
  read_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON patient_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user_id ON doctor_profiles (user_id);
