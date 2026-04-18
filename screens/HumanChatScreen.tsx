// screens/HumanChatScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { useTranslation } from 'react-i18next';
import { cacheMessages, getCachedMessages, useOnlineStatus } from '../lib/offline';
import { queueMessage } from '../lib/syncQueue';
import { moderateText, getModerationMessage } from '../lib/moderation';
import { canPerformAction, getRemainingCooldown } from '../lib/rateLimit';
import { fetchMatchInsights, type MatchInsights } from '../lib/matchInsights';
import StarterCards from '../components/StarterCards';
import ContextTags from '../components/ContextTags';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [myUserId, setMyUserId] = useState('');
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [insights, setInsights] = useState<MatchInsights | null>(null);
  const [startersDismissed, setStartersDismissed] = useState(false);
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
      fetchInsights();
      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeToMessages();
    } catch (err) {
      captureError(err, { context: 'humanchat_init' });
      console.error('HumanChat init error:', err);
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
      // Offline fallback
      const cached = await getCachedMessages(matchId);
      if (cached.length > 0) setMessages(cached);
    }
  };

  const fetchInsights = async () => {
    const data = await fetchMatchInsights(matchId);
    if (data) setInsights(data);
  };

  const pickStarter = (text: string) => {
    setInput(text);
    trackEvent('starter_picked', { match_id: matchId });
  };

  const pickTag = (tag: { label: string }) => {
    // Tag tapped → seed the input with a gentle opener referencing the topic.
    setInput((cur) => (cur ? cur : t('contextTags.seed', { topic: tag.label })));
  };

  const fetchMatchScore = async () => {
    const { data } = await supabase
      .from('matches')
      .select('conversation:conversation_id(agent_a_score,agent_b_score)')
      .eq('id', matchId)
      .single();
    if (data?.conversation) {
      const avg = Math.round((data.conversation.agent_a_score + data.conversation.agent_b_score) / 2);
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

    // Rate limit: 10 mesaj / dakika
    if (!canPerformAction('message_send', 10, 60000)) {
      const remaining = getRemainingCooldown('message_send', 10, 60000);
      Alert.alert(t('common.error'), t('moderation.rateLimited', { seconds: remaining }));
      return;
    }

    // İçerik moderasyonu
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
      // Mesajı kuyruğa al (offline gönderim)
      await queueMessage({ ...tempMsg, match_id: matchId });
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true } : m));
      Alert.alert(t('common.error'), t('chat.sendError'));
      return;
    }

    fetchMessages();
  };

  const retryMessage = async (msg: Message) => {
    // Başarısız mesajı kaldır ve tekrar gönder
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
            <View style={[s.datePill, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
              <Text style={[s.dateLabel, { color: colors.textSecondary }]}>{formatDateLabel(item.created_at)}</Text>
            </View>
          </View>
        )}
        <View style={[s.msgRow, isMe && s.msgRowRight]}>
          {!isMe && (
            <LinearGradient colors={colors.accentGradientAlt as any} style={s.avOther}>
              <Text style={s.avText}>
                {otherUser?.name?.[0] || '?'}
              </Text>
            </LinearGradient>
          )}
          <View>
            <View style={[
              s.bubble,
              isMe
                ? [s.bubbleMe, { backgroundColor: colors.userBubble }]
                : [s.bubbleOther, { backgroundColor: colors.card, shadowColor: colors.shadow }],
              item.failed && s.bubbleFailed,
            ]}>
              <Text style={[
                s.bubbleText,
                isMe ? s.bubbleTextMe : { color: colors.otherBubbleText },
              ]}>
                {item.content}
              </Text>
            </View>
            {item.failed ? (
              <TouchableOpacity onPress={() => retryMessage(item)} style={s.retryRow}>
                <Text style={[s.failedText, { color: colors.error }]}>{t('chat.sendFailed')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[s.timestamp, isMe && s.timestampRight, { color: colors.placeholder }]}>
                {formatTime(item.created_at)}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Text style={[s.back, { color: colors.textSecondary }]}>‹</Text>
            </TouchableOpacity>
            <LinearGradient colors={colors.accentGradientAlt as any} style={s.headerAv}>
              <Text style={s.headerAvTxt}>
                {otherUser?.name?.[0] || '?'}
              </Text>
            </LinearGradient>
            <View style={s.headerInfo}>
              <Text style={[s.headerName, { color: colors.textPrimary }]}>{otherUser?.name}</Text>
              {matchScore && (
                <Text style={[s.headerSub, { color: colors.textSecondary }]}>{t('chat.agentMatch', { score: matchScore })}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[s.logBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => navigation.navigate('AgentLog', { matchId })}
            >
              <Text style={[s.logBtnText, { color: colors.userBubble }]}>{t('chat.agentLog')}</Text>
            </TouchableOpacity>
          </View>

          {insights && insights.tags.length > 0 && (
            <ContextTags tags={insights.tags} onPick={pickTag} />
          )}

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={i => i.id}
            renderItem={renderMessage}
            contentContainerStyle={s.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd()}
            ListHeaderComponent={
              <View>
                <View style={s.matchBanner}>
                  <View style={[s.bannerPill, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                    <Text style={[s.matchBannerText, { color: colors.textSecondary }]}>
                      {t('chat.banner')}
                    </Text>
                  </View>
                </View>
                {messages.length === 0 && !startersDismissed && insights && insights.starters.length > 0 && (
                  <StarterCards
                    starters={insights.starters}
                    onPick={pickStarter}
                    onDismiss={() => setStartersDismissed(true)}
                  />
                )}
              </View>
            }
          />

          <View style={[s.inputRow, { backgroundColor: colors.card, borderTopColor: colors.separator }]}>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              value={input}
              onChangeText={setInput}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[s.sendBtn, !input.trim() && s.sendBtnOff]}
              onPress={sendMessage}
              disabled={!input.trim()}
            >
              <LinearGradient
                colors={!input.trim() ? (colors.disabledGradient as any) : (colors.accentGradientAlt as any)}
                style={s.sendGrad}
              >
                <Text style={s.sendIcon}>↑</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 18, borderBottomWidth: 1, gap: 10 },
  backBtn: { padding: 4 },
  back: { fontSize: 28, fontWeight: '300' },
  headerAv: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerAvTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  avOther: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  logBtn: { borderWidth: 2, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7 },
  logBtnText: { fontSize: 13, fontWeight: '700' },
  list: { padding: 14, gap: 10, paddingBottom: 6 },
  matchBanner: { alignItems: 'center', marginBottom: 14 },
  bannerPill: { borderRadius: 28, paddingHorizontal: 20, paddingVertical: 8, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  matchBannerText: { fontSize: 13, textAlign: 'center', fontWeight: '600' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  msgRowRight: { flexDirection: 'row-reverse' },
  bubble: { maxWidth: '75%', borderRadius: 22, padding: 12, paddingHorizontal: 16 },
  bubbleOther: { borderBottomLeftRadius: 6, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  bubbleMe: { borderBottomRightRadius: 6 },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  bubbleTextMe: { color: '#fff', fontWeight: '500' },
  timestamp: { fontSize: 11, marginTop: 4, marginLeft: 6, fontWeight: '500' },
  timestampRight: { textAlign: 'right', marginRight: 6, marginLeft: 0 },
  dateLabelWrap: { alignItems: 'center', marginVertical: 12 },
  datePill: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  dateLabel: { fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingHorizontal: 16, borderTopWidth: 1, gap: 10 },
  input: { flex: 1, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 13, fontSize: 16, maxHeight: 100, borderWidth: 2, fontWeight: '500' },
  sendBtn: { borderRadius: 24, overflow: 'hidden' },
  sendBtnOff: { opacity: 0.5 },
  sendGrad: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 22, fontWeight: '600' },
  bubbleFailed: { backgroundColor: '#7C3AED', opacity: 0.6 },
  failedText: { fontSize: 11, marginTop: 4, marginRight: 6, textAlign: 'right', fontWeight: '600' },
  retryRow: { alignSelf: 'flex-end' },
});
