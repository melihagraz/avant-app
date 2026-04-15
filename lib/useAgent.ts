// lib/useAgent.ts
// Hook to fetch and cache current user's agent (name, emoji, stats)
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@avant_agent_info';

export interface AgentInfo {
  id: string;
  name: string;
  avatar_emoji: string;
  interactions_count?: number;
  matches_found?: number;
  messages_suggested?: number;
}

export function useAgent() {
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAgent = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('agents')
        .select('id, name, avatar_emoji, interactions_count, matches_found, messages_suggested')
        .eq('user_id', user.id)
        .single();

      if (data) {
        const info: AgentInfo = {
          id: data.id,
          name: data.name || 'Aria',
          avatar_emoji: data.avatar_emoji || '\u{1F916}',
          interactions_count: data.interactions_count || 0,
          matches_found: data.matches_found || 0,
          messages_suggested: data.messages_suggested || 0,
        };
        setAgent(info);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(info));
      } else {
        // Fallback to cache
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) setAgent(JSON.parse(cached));
      }
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) setAgent(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  return { agent, loading, refresh: fetchAgent };
}
