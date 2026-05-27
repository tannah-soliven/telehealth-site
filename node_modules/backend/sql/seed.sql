-- Telehealth seed data: 5 doctors (one per specialty)
-- Run after schema DDL. Default password for all users below: Password123!

BEGIN;

-- Fixed UUIDs for reproducible seeds / local dev references
-- Users (doctors)
INSERT INTO users (id, email, password_hash, role)
VALUES
  (
    'a1000001-0001-4001-8001-000000000001',
    'maria.santos@telehealth.example',
    '$2b$10$QRgqo6GlI7AFHt1ayr1pFeh69xqGdZua7nZPk58QH7lmmOpgy.WRy',
    'doctor'
  ),
  (
    'a1000001-0001-4001-8001-000000000002',
    'james.chen@telehealth.example',
    '$2b$10$QRgqo6GlI7AFHt1ayr1pFeh69xqGdZua7nZPk58QH7lmmOpgy.WRy',
    'doctor'
  ),
  (
    'a1000001-0001-4001-8001-000000000003',
    'emily.patel@telehealth.example',
    '$2b$10$QRgqo6GlI7AFHt1ayr1pFeh69xqGdZua7nZPk58QH7lmmOpgy.WRy',
    'doctor'
  ),
  (
    'a1000001-0001-4001-8001-000000000004',
    'robert.kim@telehealth.example',
    '$2b$10$QRgqo6GlI7AFHt1ayr1pFeh69xqGdZua7nZPk58QH7lmmOpgy.WRy',
    'doctor'
  ),
  (
    'a1000001-0001-4001-8001-000000000005',
    'lisa.nguyen@telehealth.example',
    '$2b$10$QRgqo6GlI7AFHt1ayr1pFeh69xqGdZua7nZPk58QH7lmmOpgy.WRy',
    'doctor'
  )
ON CONFLICT (email) DO NOTHING;

-- Doctor profiles
INSERT INTO doctor_profiles (
  id,
  user_id,
  first_name,
  last_name,
  specialty,
  license_number,
  bio
)
VALUES
  (
    'b2000001-0001-4001-8001-000000000001',
    'a1000001-0001-4001-8001-000000000001',
    'Maria',
    'Santos',
    'Cardiologist',
    'MD-CARD-10001',
    'Board-certified cardiologist focused on preventive heart care and hypertension management.'
  ),
  (
    'b2000001-0001-4001-8001-000000000002',
    'a1000001-0001-4001-8001-000000000002',
    'James',
    'Chen',
    'Dermatologist',
    'MD-DERM-10002',
    'Dermatologist treating acne, eczema, psoriasis, and routine skin cancer screenings.'
  ),
  (
    'b2000001-0001-4001-8001-000000000003',
    'a1000001-0001-4001-8001-000000000003',
    'Emily',
    'Patel',
    'Pediatrician',
    'MD-PEDS-10003',
    'Pediatrician providing well-child visits, vaccinations, and common childhood illness care.'
  ),
  (
    'b2000001-0001-4001-8001-000000000004',
    'a1000001-0001-4001-8001-000000000004',
    'Robert',
    'Kim',
    'Neurologist',
    'MD-NEUR-10004',
    'Neurologist specializing in headaches, epilepsy, and neurodegenerative conditions.'
  ),
  (
    'b2000001-0001-4001-8001-000000000005',
    'a1000001-0001-4001-8001-000000000005',
    'Lisa',
    'Nguyen',
    'General Practitioner',
    'MD-GP-10005',
    'General practitioner offering primary care, chronic disease management, and telehealth consults.'
  )
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
