-- 20260415_agent_naming.sql
-- Add name, avatar_emoji, and stats columns to agents table
-- Avant v2.1: Named personal agents

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_emoji TEXT DEFAULT '🤖',
  ADD COLUMN IF NOT EXISTS interactions_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matches_found INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_suggested INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

-- Default names for existing agents (migration safety)
UPDATE agents
SET name = 'Aria'
WHERE name IS NULL;

-- Index for name lookups
CREATE INDEX IF NOT EXISTS agents_name_idx ON agents(name);
