-- TING Token Tables
-- AI agents and reward tracking for the TING ecosystem

-- AI Agents table - tracks all registered AI agents
CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_address TEXT NOT NULL UNIQUE,          -- SUI address of the AI agent
    owner_address TEXT NOT NULL,                 -- SUI address of the human owner
    agent_name TEXT DEFAULT 'AI Agent',          -- Display name
    keypair_encrypted TEXT,                      -- Encrypted private key (for backend signing)
    initial_allocation DECIMAL(20, 9) DEFAULT 100, -- Initial TING given
    persona_id UUID REFERENCES personas(id),     -- Link to persona if applicable
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up agents by owner
CREATE INDEX IF NOT EXISTS idx_ai_agents_owner ON ai_agents(owner_address);

-- Index for looking up agents by persona
CREATE INDEX IF NOT EXISTS idx_ai_agents_persona ON ai_agents(persona_id);

-- TING Rewards table - logs all TING rewards given to agents
CREATE TABLE IF NOT EXISTS ting_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_address TEXT NOT NULL,                 -- Agent that received the reward
    reward_type TEXT NOT NULL,                   -- Type of reward (e.g., 'playlistCuration')
    amount DECIMAL(20, 9) NOT NULL,              -- Amount of TING rewarded
    reason TEXT,                                 -- Optional description
    transaction_digest TEXT,                     -- SUI transaction hash
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up rewards by agent
CREATE INDEX IF NOT EXISTS idx_ting_rewards_agent ON ting_rewards(agent_address);

-- Index for analyzing reward types
CREATE INDEX IF NOT EXISTS idx_ting_rewards_type ON ting_rewards(reward_type);

-- TING Transactions table - logs all TING transfers for analytics
CREATE TABLE IF NOT EXISTS ting_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_address TEXT,                           -- Sender (null for mints)
    to_address TEXT NOT NULL,                    -- Recipient
    amount DECIMAL(20, 9) NOT NULL,              -- Amount transferred
    transaction_type TEXT NOT NULL,              -- 'mint', 'transfer', 'burn', 'reward'
    transaction_digest TEXT,                     -- SUI transaction hash
    metadata JSONB,                              -- Additional context
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for transaction lookups
CREATE INDEX IF NOT EXISTS idx_ting_tx_from ON ting_transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_ting_tx_to ON ting_transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_ting_tx_type ON ting_transactions(transaction_type);

-- Updated at trigger for ai_agents
CREATE OR REPLACE FUNCTION update_ai_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_agents_updated_at
    BEFORE UPDATE ON ai_agents
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_agents_updated_at();

-- RLS policies
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ting_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE ting_transactions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage ai_agents"
    ON ai_agents FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage ting_rewards"
    ON ting_rewards FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage ting_transactions"
    ON ting_transactions FOR ALL
    USING (auth.role() = 'service_role');

-- Allow public read access to non-sensitive fields
CREATE POLICY "Public can view agent info"
    ON ai_agents FOR SELECT
    USING (true);

CREATE POLICY "Public can view rewards"
    ON ting_rewards FOR SELECT
    USING (true);

CREATE POLICY "Public can view transactions"
    ON ting_transactions FOR SELECT
    USING (true);

-- Comment on tables
COMMENT ON TABLE ai_agents IS 'Registered AI agents in the TING ecosystem';
COMMENT ON TABLE ting_rewards IS 'Log of TING rewards given to AI agents';
COMMENT ON TABLE ting_transactions IS 'Complete TING transaction history';
