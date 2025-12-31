-- Migration: Add sui_migration_notes column to alpha_users
-- For tracking migration status and notes during SUI transition

ALTER TABLE alpha_users
ADD COLUMN IF NOT EXISTS sui_migration_notes TEXT;

COMMENT ON COLUMN alpha_users.sui_migration_notes IS 'Notes for tracking SUI migration status (e.g., which persona, delete?, keep?, etc.)';
