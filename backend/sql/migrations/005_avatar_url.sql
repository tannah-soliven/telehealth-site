ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE doctor_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
