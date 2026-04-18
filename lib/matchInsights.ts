// lib/matchInsights.ts
// Shared types and fetcher for agent match insights (highlights, starters, tags).
// Populated by the agent-match edge function after a match.

import { supabase } from './supabase';

export type HighlightType = 'common' | 'spark' | 'difference' | 'surprise' | 'score';

export interface HighlightCard {
  type: HighlightType;
  emoji: string;
  title: string;
  detail: string;
}

export interface StarterCard {
  text: string;
  based_on: string;
}

export interface ContextTag {
  emoji: string;
  label: string;
}

export interface MatchInsights {
  highlights: HighlightCard[];
  starters: StarterCard[];
  tags: ContextTag[];
}

export async function fetchMatchInsights(matchId: string): Promise<MatchInsights | null> {
  const { data, error } = await supabase
    .from('agent_match_insights')
    .select('highlights, starters, tags')
    .eq('match_id', matchId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    highlights: (data.highlights as HighlightCard[]) || [],
    starters: (data.starters as StarterCard[]) || [],
    tags: (data.tags as ContextTag[]) || [],
  };
}
