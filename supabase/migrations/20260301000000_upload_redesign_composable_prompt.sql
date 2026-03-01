-- Upload Redesign: Composable Prompt Architecture
-- Adds columns to agent_preferences for collaborator groups, pilot program, and auto-generated preferences

ALTER TABLE agent_preferences
  ADD COLUMN IF NOT EXISTS collaborator_groups JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS pilot_program TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bio_draft_material TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preferences_auto_generated BOOLEAN DEFAULT FALSE;
