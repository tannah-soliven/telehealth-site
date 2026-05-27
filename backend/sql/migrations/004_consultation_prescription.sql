ALTER TABLE consultation_notes
  ADD COLUMN IF NOT EXISTS findings    TEXT,
  ADD COLUMN IF NOT EXISTS prescription TEXT;
