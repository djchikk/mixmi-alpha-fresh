-- Replace collaborator_groups with known_collaborators
-- collaborator_groups stored full split permutations (confusing, doesn't scale)
-- known_collaborators stores just names + optional notes for chip selection

ALTER TABLE agent_preferences DROP COLUMN IF EXISTS collaborator_groups;
ALTER TABLE agent_preferences ADD COLUMN IF NOT EXISTS known_collaborators JSONB DEFAULT '[]';

-- Format: [{"name": "Sophie", "notes": "writing partner"}, {"name": "Tootles", "notes": "producer"}]
