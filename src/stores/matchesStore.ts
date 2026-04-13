import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Match } from '../types/database';
import { cacheMatches, getCachedMatches } from '../lib/offline';
import { RealtimeChannel } from '@supabase/supabase-js';

interface MatchesState {
  matches: Match[];
  loading: boolean;
  error: string | null;
  channel: RealtimeChannel | null;

  fetchMatches: (userId: string) => Promise<void>;
  subscribeToMatches: (userId: string) => void;
  unsubscribe: () => void;
  getNewMatches: () => Match[];
  getActiveChats: () => Match[];
}

export const useMatchesStore = create<MatchesState>((set, get) => ({
  matches: [],
  loading: false,
  error: null,
  channel: null,

  fetchMatches: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      // Fetch matches where user is either user_a or user_b
      const { data: matchesA, error: errA } = await supabase
        .from('matches')
        .select('*')
        .eq('user_a_id', userId);

      const { data: matchesB, error: errB } = await supabase
        .from('matches')
        .select('*')
        .eq('user_b_id', userId);

      if (errA || errB) {
        const cached = await getCachedMatches(userId);
        set({ matches: cached, loading: false });
        return;
      }

      const allMatches = [...(matchesA || []), ...(matchesB || [])];

      // Fetch other user data and last message for each match
      const enrichedMatches: Match[] = await Promise.all(
        allMatches.map(async (m) => {
          const otherUserId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;

          const [userRes, msgRes, convRes] = await Promise.all([
            supabase.from('users').select('id,name,age,city,photos').eq('id', otherUserId).single(),
            supabase
              .from('human_messages')
              .select('*')
              .eq('match_id', m.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single(),
            m.conversation_id
              ? supabase.from('agent_conversations').select('*').eq('id', m.conversation_id).single()
              : Promise.resolve({ data: null }),
          ]);

          return {
            ...m,
            other_user: userRes.data || undefined,
            last_message: msgRes.data || undefined,
            conversation: convRes.data || undefined,
          } as Match;
        })
      );

      // Sort by last message or match creation
      enrichedMatches.sort((a, b) => {
        const dateA = a.last_message?.created_at || a.created_at;
        const dateB = b.last_message?.created_at || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      await cacheMatches(userId, enrichedMatches);
      set({ matches: enrichedMatches, loading: false });
    } catch (err) {
      console.error('[Matches] fetchMatches error:', err);
      const cached = await getCachedMatches(userId);
      set({ matches: cached, loading: false, error: 'Eslesme yuklenemedi.' });
    }
  },

  subscribeToMatches: (userId: string) => {
    const channel = supabase
      .channel(`matches-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          // Refetch on any match change
          get().fetchMatches(userId);
        }
      )
      .subscribe();

    set({ channel });
  },

  unsubscribe: () => {
    const { channel } = get();
    if (channel) {
      supabase.removeChannel(channel);
      set({ channel: null });
    }
  },

  getNewMatches: () => {
    return get().matches.filter(m => !m.has_messages);
  },

  getActiveChats: () => {
    return get().matches.filter(m => m.has_messages);
  },
}));
