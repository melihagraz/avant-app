-- Agent Match Insights
-- Stores per-match: highlight reel cards, conversation starters, contextual tags
-- Produced by agent-match edge function after a successful match.

CREATE TABLE IF NOT EXISTS agent_match_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE NOT NULL UNIQUE,
  conversation_id uuid REFERENCES agent_conversations(id) ON DELETE CASCADE NOT NULL,

  -- Array of highlight cards for the Stories-style reel.
  -- Shape: [{ "type": "common|spark|difference|surprise|score",
  --           "emoji": "🎬", "title": "Ortak nokta", "detail": "..." }, ...]
  highlights jsonb DEFAULT '[]'::jsonb NOT NULL,

  -- Array of conversation starter suggestions shown at chat open.
  -- Shape: [{ "text": "Interstellar'ın sonunu nasıl yorumladın? 🎬",
  --           "based_on": "Nolan filmleri" }, ...]
  starters jsonb DEFAULT '[]'::jsonb NOT NULL,

  -- Array of small topic chips shown above the chat.
  -- Shape: [{ "emoji": "🎬", "label": "Nolan" }, ...]
  tags jsonb DEFAULT '[]'::jsonb NOT NULL,

  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_match_insights_match ON agent_match_insights(match_id);
CREATE INDEX IF NOT EXISTS idx_agent_match_insights_conversation ON agent_match_insights(conversation_id);

-- RLS: each match participant can read its own insights.
ALTER TABLE agent_match_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants_read_insights" ON agent_match_insights;
CREATE POLICY "participants_read_insights"
  ON agent_match_insights
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = agent_match_insights.match_id
        AND (m.user_a_id = auth.uid() OR m.user_b_id = auth.uid())
    )
  );

-- Writes go through the service role from the edge function; no insert policy for anon.
