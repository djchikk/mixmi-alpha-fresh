-- Migration: Add Agent Persona Support
-- Date: December 26, 2025
-- Description: Adds fields to support AI agent personas that can collect and mix content

-- Add agent fields to personas table
ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_agent BOOLEAN DEFAULT false;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS agent_mission TEXT;  -- Free text description of agent's preferences
ALTER TABLE personas ADD COLUMN IF NOT EXISTS agent_daily_limit_usdc DECIMAL(10,2) DEFAULT 5.00;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS agent_spent_today_usdc DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS agent_last_reset DATE DEFAULT CURRENT_DATE;

-- Constraint: Maximum 1 agent per account
-- This ensures agents are special and prevents spam
CREATE UNIQUE INDEX IF NOT EXISTS one_agent_per_account
ON personas (account_id)
WHERE is_agent = true;

-- Function to reset daily agent spending (run via cron job at midnight UTC)
CREATE OR REPLACE FUNCTION reset_agent_daily_spending()
RETURNS void AS $$
BEGIN
  UPDATE personas
  SET agent_spent_today_usdc = 0,
      agent_last_reset = CURRENT_DATE
  WHERE is_agent = true
    AND agent_last_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the agent system
COMMENT ON COLUMN personas.is_agent IS 'True if this persona is an AI agent (max 1 per account)';
COMMENT ON COLUMN personas.agent_mission IS 'Free text description of agent preferences and behavior, interpreted by AI';
COMMENT ON COLUMN personas.agent_daily_limit_usdc IS 'Maximum USDC the agent can spend per day';
COMMENT ON COLUMN personas.agent_spent_today_usdc IS 'USDC spent by agent today (resets at midnight UTC)';
COMMENT ON COLUMN personas.agent_last_reset IS 'Date of last spending reset';
