// screens/HumanChatScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { useTranslation } from 'react-i18next';
import { cacheMessages, getCachedMessages } from '../lib/offline';
import { queueMessage } from '../lib/syncQueue';
import { moderateText, getModerationMessage } from '../lib/moderation';
import { canPerformAction, getRemainingCooldown } from '../lib/rateLimit';
import { FONT_BODY_SEMIBOLD } from '../lib/fonts';
import ChatAgentPanel from '../components/ChatAgentPanel';
import { useAgent } from '../lib/useAgent';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  failed?: boolean;
}

export default function HumanChatScreen({ route, navigation }: any) {
  const { matchId, otherUser } = route.params;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { agent } = useAgent();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [myUserId, setMyUserId] = useState('');
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const listRef = useRef<FlatList>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    trackEvent('chat_open', { match_id: matchId });
    init();
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyUserId(user.id);
      await fetchMessages();
      await fetchMatchScore();
      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeToMessages();
    } catch (err) {
      captureError(err, { context: 'humanchat_init' });
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('human_messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(data);
      cacheMessages(matchId, data);
    } else {
      const cached = await getCachedMessages(matchId);
      if (cached.length > 0) setMessages(cached);
    }
  };

  const fetchMatchScore = async () => {
    const { data } = await supabase
      .from('matches')
      .select('conversation:conversation_id(agent_a_score,agent_b_score)')
      .eq('id', matchId)
      .single();
    if (data?.conversation) {
      const conv = data.conversation as any;
      const avg = Math.round(((conv.agent_a_score || 0) + (conv.agent_b_score || 0)) / 2);
      setMatchScore(avg);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'human_messages',
        filter: `match_id=eq.${matchId}`
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    if (!canPerformAction('message_send', 10, 60000)) {
      const remaining = getRemainingCooldown('message_send', 10, 60000);
      Alert.alert(t('common.error'), t('moderation.rateLimited', { seconds: remaining }));
      return;
    }

    const modResult = moderateText(text);
    if (!modResult.clean) {
      Alert.alert(t('common.error'), t(getModerationMessage(modResult.reason || '')));
      return;
    }

    setInput('');
    trackEvent('message_send', { match_id: matchId });

    const tempId = Date.now().toString();
    const tempMsg: Message = {
      id: tempId,
      sender_id: myUserId,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    const { error } = await supabase.from('human_messages').insert({
      match_id: matchId,
      sender_id: myUserId,
      content: text,
    });

    if (error) {
      captureError(error, { context: 'send_message', match_id: matchId });
      await queueMessage({ ...tempMsg, match_id: matchId });
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true } : m));
      Alert.alert(t('common.error'), t('chat.sendError'));
      return;
    }

    fetchMessages();
  };

  const retryMessage = async (msg: Message) => {
    setMessages(prev => prev.filter(m => m.id !== msg.id));
    setInput(msg.content);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const dayMs = 86400000;
    if (diff < dayMs && d.getDate() === now.getDate()) return t('common.today');
    if (diff < 2 * dayMs) return t('common.yesterday');
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  };

  const shouldShowDateLabel = (idx: number) => {
    if (idx === 0) return true;
    const prev = new Date(messages[idx - 1].created_at);
    const curr = new Date(messages[idx].created_at);
    return prev.toDateString() !== curr.toDateString();
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === myUserId;
    const showDate = shouldShowDateLabel(index);
    return (
      <View>
        {showDate && (
          <View style={s.dateLabelWrap}>
            <Text style={s.dateLabel}>{formatDateLabel(item.created_at)}</Text>
          </View>
        )}
        <View style={[s.msgRow, isMe ? s.msgRowRight : s.msgRowLeft]}>
          <View style={s.bubbleWrap}>
            {isMe ? (
              <LinearGradient
                colors={colors.goldGradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.bubble, s.bubbleMe, item.failed && s.bubbleFailed]}
              >
                <Text style={s.bubbleTextMe}>{item.content}</Text>
              </LinearGradient>
            ) : (
              <View style={[s.bubble, s.bubbleOther]}>
                <Text style={s.bubbleTextOther}>{item.content}</Text>
              </View>
            )}
            {item.failed ? (
              <TouchableOpacity onPress={() => retryMessage(item)} style={s.retryRow}>
                <Text style={s.failedText}>{t('chat.sendFailed')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[s.timestamp, isMe && s.timestampRight]}>
                {formatTime(item.created_at)}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            <View style={s.headerAvatar}>
              <Text style={s.headerAvatarText}>
                {otherUser?.name?.[0] || '?'}
              </Text>
            </View>

            <View style={s.headerInfo}>
              <Text style={s.headerName}>{otherUser?.name}</Text>
              <Text style={s.headerOnline}>{'\u25CF'} {t('chat.online') || 'cevrimici'}</Text>
            </View>

            {/* Agent button */}
            <TouchableOpacity
              style={[s.agentBtn, showAgentPanel && s.agentBtnActive]}
              onPress={() => setShowAgentPanel(!showAgentPanel)}
            >
              <Ionicons name="sparkles" size={12} color="#C09AFF" />
              <Text style={s.agentBtnText}>{agent?.name || 'Agent'}</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={i => i.id}
            renderItem={renderMessage}
            contentContainerStyle={s.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd()}
          />

          {/* Agent Panel */}
          <ChatAgentPanel
            visible={showAgentPanel}
            matchId={matchId}
            matchScore={matchScore}
            onClose={() => setShowAgentPanel(false)}
            onSelectSuggestion={(text) => {
              setInput(text);
              setShowAgentPanel(false);
            }}
          />

          {/* Input bar */}
          <View style={s.inputBar}>
            <TouchableOpacity style={s.plusBtn}>
              <Ionicons name="add" size={18} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>

            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder={t('chat.placeholder') || 'Mesaj yaz...'}
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              style={[s.sendBtn, !input.trim() && s.sendBtnOff]}
              onPress={sendMessage}
              disabled={!input.trim()}
            >
              <LinearGradient
                colors={colors.goldGradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.sendGrad}
              >
                <Ionicons name="arrow-up" size={18} color="#1a0f00" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0D0D14' },
  safeArea: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3d2a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    fontFamily: FONT_BODY_SEMIBOLD,
  },
  headerOnline: {
    fontSize: 11,
    color: '#4cd964',
    marginTop: 2,
  },
  agentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.35)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  agentBtnActive: {
    backgroundColor: 'rgba(124,58,237,0.3)',
    borderColor: 'rgba(160,100,255,0.6)',
  },
  agentBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#C09AFF',
    letterSpacing: 0.03,
  },

  // Messages
  list: {
    padding: 16,
    gap: 8,
    paddingBottom: 8,
  },
  dateLabelWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.28)',
  },
  msgRow: {
    marginBottom: 4,
  },
  msgRowLeft: {
    alignItems: 'flex-start',
  },
  msgRowRight: {
    alignItems: 'flex-end',
  },
  bubbleWrap: {
    maxWidth: '78%',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleTextMe: {
    fontSize: 13,
    lineHeight: 20,
    color: '#1a0f00',
    fontWeight: '500',
  },
  bubbleTextOther: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.88)',
  },
  timestamp: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.22)',
    marginTop: 3,
    paddingLeft: 4,
  },
  timestampRight: {
    textAlign: 'right',
    paddingRight: 4,
    paddingLeft: 0,
  },
  bubbleFailed: {
    opacity: 0.6,
  },
  failedText: {
    fontSize: 11,
    color: '#ff4444',
    marginTop: 4,
    textAlign: 'right',
    fontWeight: '600',
  },
  retryRow: {
    alignSelf: 'flex-end',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#0D0D14',
    gap: 10,
  },
  plusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    maxHeight: 80,
  },
  sendBtn: {
    borderRadius: 19,
    overflow: 'hidden',
  },
  sendBtnOff: {
    opacity: 0.4,
  },
  sendGrad: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
