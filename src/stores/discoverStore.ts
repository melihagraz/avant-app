import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { DiscoverProfile, ProcessLikeResponse } from '../types/database';
import { trackEvent } from '../lib/analytics';

interface DiscoverState {
  profiles: DiscoverProfile[];
  currentIndex: number;
  loading: boolean;
  error: string | null;
  remainingLikes: number;
  remainingSuperLikes: number;

  fetchFeed: () => Promise<void>;
  processLike: (likedId: string, action: 'like' | 'super_like' | 'pass', comment?: string) => Promise<ProcessLikeResponse | null>;
  nextProfile: () => void;
  reset: () => void;
  getCurrentProfile: () => DiscoverProfile | null;
}

export const useDiscoverStore = create<DiscoverState>((set, get) => ({
  profiles: [],
  currentIndex: 0,
  loading: false,
  error: null,
  remainingLikes: 15,
  remainingSuperLikes: 1,

  fetchFeed: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.functions.invoke('get-discover-feed', {
        body: {},
      });

      if (error) {
        set({ error: 'Feed yuklenemedi.', loading: false });
        return;
      }

      set({
        profiles: data?.profiles || [],
        currentIndex: 0,
        loading: false,
        remainingLikes: data?.remaining_likes ?? 15,
        remainingSuperLikes: data?.remaining_super_likes ?? 1,
      });
    } catch (err) {
      console.error('[Discover] fetchFeed error:', err);
      set({ error: 'Baglanti hatasi.', loading: false });
    }
  },

  processLike: async (likedId, action, comment) => {
    try {
      trackEvent('swipe', { action, liked_id: likedId });

      const { data, error } = await supabase.functions.invoke('process-like', {
        body: { liked_id: likedId, action, comment },
      });

      if (error) {
        console.error('[Discover] processLike error:', error);
        return null;
      }

      const response = data as ProcessLikeResponse;

      if (response.remaining_likes !== undefined) {
        set({ remainingLikes: response.remaining_likes });
      }
      if (response.remaining_super_likes !== undefined) {
        set({ remainingSuperLikes: response.remaining_super_likes });
      }

      return response;
    } catch (err) {
      console.error('[Discover] processLike error:', err);
      return null;
    }
  },

  nextProfile: () => {
    set((state) => ({ currentIndex: state.currentIndex + 1 }));
  },

  reset: () => {
    set({ profiles: [], currentIndex: 0, error: null });
  },

  getCurrentProfile: () => {
    const { profiles, currentIndex } = get();
    return currentIndex < profiles.length ? profiles[currentIndex] : null;
  },
}));
