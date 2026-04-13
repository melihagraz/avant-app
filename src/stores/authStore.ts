import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setAnalyticsUser } from '../lib/analytics';
import { UserProfile } from '../types/database';
import { cacheProfile, getCachedProfile } from '../lib/offline';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  hasAgent: boolean;
  loading: boolean;
  isReady: boolean;

  initialize: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<UserProfile | null>;
  checkAgent: (userId: string) => Promise<boolean>;
  signInWithOtp: (email: string) => Promise<{ error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ error?: string }>;
  signInDemo: () => Promise<{ error?: string; hasAgent?: boolean }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  hasAgent: false,
  loading: true,
  isReady: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const profile = await get().fetchProfile(session.user.id);
        const hasAgent = await get().checkAgent(session.user.id);
        setAnalyticsUser(session.user.id);

        set({
          session,
          user: session.user,
          profile,
          hasAgent,
          loading: false,
          isReady: true,
        });
      } else {
        set({ loading: false, isReady: true });
      }

      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          setAnalyticsUser(session.user.id);
          get().fetchProfile(session.user.id);
          get().checkAgent(session.user.id);
        } else {
          set({ profile: null, hasAgent: false });
          setAnalyticsUser(null);
        }
      });
    } catch (err) {
      console.error('[Auth] Initialize error:', err);
      set({ loading: false, isReady: true });
    }
  },

  fetchProfile: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        const cached = await getCachedProfile(userId);
        if (cached) {
          set({ profile: cached });
          return cached;
        }
        return null;
      }

      await cacheProfile(userId, data);
      set({ profile: data as UserProfile });
      return data as UserProfile;
    } catch {
      const cached = await getCachedProfile(userId);
      if (cached) set({ profile: cached });
      return cached;
    }
  },

  checkAgent: async (userId: string) => {
    try {
      const { data } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', userId)
        .single();

      const hasAgent = !!data;
      set({ hasAgent });
      return hasAgent;
    } catch {
      return false;
    }
  },

  signInWithOtp: async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });

    if (error) return { error: 'Kod gonderilemedi. Tekrar deneyin.' };
    return {};
  },

  verifyOtp: async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    });

    if (error || !data.session) {
      return { error: 'Kod gecersiz. Tekrar deneyin.' };
    }

    const profile = await get().fetchProfile(data.session.user.id);
    const hasAgent = await get().checkAgent(data.session.user.id);

    set({
      session: data.session,
      user: data.session.user,
      profile,
      hasAgent,
    });

    return {};
  },

  signInDemo: async () => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'demo@avant.app',
        password: 'AvantDemo2026!',
      });

      if (error || !data.session) {
        return { error: 'Demo hesabina ulasilamadi.' };
      }

      const profile = await get().fetchProfile(data.session.user.id);
      const hasAgent = await get().checkAgent(data.session.user.id);

      set({
        session: data.session,
        user: data.session.user,
        profile,
        hasAgent,
      });

      return { hasAgent };
    } catch {
      return { error: 'Demo hesabina ulasilamadi.' };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      profile: null,
      hasAgent: false,
    });
    setAnalyticsUser(null);
  },
}));
