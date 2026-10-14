-- ---------------------------------------------------------------------------
-- 05_auth.sql — PostgreSQL-backed authentication for the TalentBridge app.
--
-- The application previously stored sign-up / demo users in a local JSON file.
-- This migration makes authentication restart-safe by adding the auth columns
-- to the existing `users` table (the same table the staffing workflow already
-- references) and enforcing the email / role constraints the app relies on.
--
-- Idempotent: safe to run multiple times.
-- ---------------------------------------------------------------------------

-- The users table already exists (see 01_schema.sql) with:
--   user_id UUID PK, full_name, email UNIQUE, default_role, active, created_at
-- Add the columns needed for password authentication.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

-- Keep updated_at current on every row change.
CREATE OR REPLACE FUNCTION set_users_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_users_updated_at();

-- Role must be one of the three supported backend roles.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_default_role_check;
ALTER TABLE users ADD CONSTRAINT users_default_role_check
    CHECK (default_role IN ('WORKFORCE_PLANNER', 'DELIVERY_MANAGER', 'CLIENT_MANAGER'));

-- Status must be a known value.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
    CHECK (status IN ('active', 'disabled'));

-- email is already UNIQUE; add a case-insensitive unique index + helpful indexes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (default_role);
