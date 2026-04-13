import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { HumanMessage } from '../types/database';
import { moderateText, getModerationMessage } from '../lib/moderation';
import { canPerformAction, getRemainingCooldown } from '../lib/rateLimit';
import { queueMessage } from '../lib/syncQueue';
import { cacheMessages, getCachedMessages } from '../lib/offline';
import { trackEvent } from '../lib/analytics';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ChatState {
  messages: Record<string, HumanMessage[]>;
  sending: boolean;
  error: string | null;
  channels: Record<string, RealtimeChannel>;

  fetchMessages: (matchId: string) => Promise<void>;
  sendMessage: (matchId: string, senderId: string, content: string) => Promise<{ error?: string }>;
  subscribeToMessages: (matchId: string) => void;
  unsubscribe: (matchId: string) => void;
  getMessages: (matchId: string) => HumanMessage[];
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  sending: false,
  error: null,
  channels: {},

  fetchMessages: async (matchId: string) => {
    try {
      const { data, error } = await supabase
        .from('human_messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) {
        const cached = await getCachedMessages(matchId);
        set((state) => ({
          messages: { ...state.messages, [matchId]: cached },
        }));
        return;
      }

      const msgs = (data || []) as HumanMessage[];
      await cacheMessages(matchId, msgs);
      set((state) => ({
        messages: { ...state.messages, [matchId]: msgs },
      }));
    } catch {
      const cached = await getCachedMessages(matchId);
      set((state) => ({
        messages: { ...state.messages, [matchId]: cached },
      }));
    }
  },

  sendMessage: async (matchId: string, senderId: string, content: string) => {
    // Rate limit: 10 messages/minute
    if (!canPerformAction('message_send', 10, 60000)) {
      const remaining = getRemainingCooldown('message_send', 10, 60000);
      return { error: `Cok hizli mesaj gonderiyorsun. ${remaining} saniye bekle.` };
    }

    // Moderation check
    const modResult = moderateText(content);
    if (!modResult.clean) {
      return { error: getModerationMessage(modResult.reason || '') };
    }

    const tempId = `temp-${Date.now()}`;
    const tempMsg: HumanMessage = {
      id: tempId,
      match_id: matchId,
      sender_id: senderId,
      content,
      created_at: new Date().toISOString(),
    };

    // Optimistic insert
    set((state) => ({
      messages: {
        ...state.messages,
        [matchId]: [...(state.messages[matchId] || []), tempMsg],
      },
      sending: true,
    }));

    try {
      const { data, error } = await supabase.from('human_messages').insert({
        match_id: matchId,
        sender_id: senderId,
        content,
      }).select().single();

      if (error) {
        // Queue for later sync
        await queueMessage(tempMsg);
        set({ sending: false });
        return { error: 'Mesaj gonderilemedi. Baglanti gelince tekrar denenir.' };
      }

      // Replace temp message with real one
      set((state) => ({
        messages: {
          ...state.messages,
          [matchId]: (state.messages[matchId] || []).map(m =>
            m.id === tempId ? (data as HumanMessage) : m
          ),
        },
        sending: false,
      }));

      // Update match to has_messages
      await supabase.from('matches').update({ has_messages: true }).eq('id', matchId);

      trackEvent('message_sent', { match_id: matchId });
      return {};
    } catch {
      await queueMessage(tempMsg);
      set({ sending: false });
      return { error: 'Baglanti hatasi.' };
    }
  },

  subscribeToMessages: (matchId: string) => {
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'human_messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newMsg = payload.new as HumanMessage;
          set((state) => {
            const existing = state.messages[matchId] || [];
            // Avoid duplicates
            if (existing.some(m => m.id === newMsg.id)) return state;
            // Remove temp messages with same content from same sender
            const filtered = existing.filter(
              m => !(m.id.startsWith('temp-') && m.content === newMsg.content && m.sender_id === newMsg.sender_id)
            );
            return {
              messages: {
                ...state.messages,
                [matchId]: [...filtered, newMsg],
              },
            };
          });
        }
      )
      .subscribe();

    set((state) => ({
      channels: { ...state.channels, [matchId]: channel },
    }));
  },

  unsubscribe: (matchId: string) => {
    const { channels } = get();
    const channel = channels[matchId];
    if (channel) {
      supabase.removeChannel(channel);
      set((state) => {
        const newChannels = { ...state.channels };
        delete newChannels[matchId];
        return { channels: newChannels };
      });
    }
  },

  getMessages: (matchId: string) => {
    return get().messages[matchId] || [];
  },
}));
