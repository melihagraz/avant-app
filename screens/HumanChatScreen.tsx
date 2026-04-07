// screens/HumanChatScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  failed?: boolean;
}

export default function HumanChatScreen({ route, navigation }: any) {
  const { matchId, otherUser } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [myUserId, setMyUserId] = useState('');
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const listRef = useRef<FlatList>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
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
      console.error('HumanChat init error:', err);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('human_messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
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
    setInput('');

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
      // Mesajı failed olarak işaretle
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true } : m));
      Alert.alert('Hata', 'Mesaj gönderilemedi. Tekrar dene.');
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
    if (diff < dayMs && d.getDate() === now.getDate()) return 'Bugün';
    if (diff < 2 * dayMs) return 'Dün';
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
            <View style={s.datePill}>
              <Text style={s.dateLabel}>{formatDateLabel(item.created_at)}</Text>
            </View>
          </View>
        )}
        <View style={[s.msgRow, isMe && s.msgRowRight]}>
          {!isMe && (
            <LinearGradient colors={['#FF6B9D', '#C084FC']} style={s.avOther}>
              <Text style={s.avText}>
                {otherUser?.name?.[0] || '?'}
              </Text>
            </LinearGradient>
          )}
          <View>
            <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther, item.failed && s.bubbleFailed]}>
              <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>
                {item.content}
              </Text>
            </View>
            {item.failed ? (
              <TouchableOpacity onPress={() => retryMessage(item)} style={s.retryRow}>
                <Text style={s.failedText}>Gönderilemedi · Tekrar dene</Text>
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
    <LinearGradient colors={['#FFF8FA', '#F8F5FF', '#F5FAFF']} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Text style={s.back}>‹</Text>
            </TouchableOpacity>
            <LinearGradient colors={['#FF6B9D', '#C084FC']} style={s.headerAv}>
              <Text style={s.headerAvTxt}>
                {otherUser?.name?.[0] || '?'}
              </Text>
            </LinearGradient>
            <View style={s.headerInfo}>
              <Text style={s.headerName}>{otherUser?.name}</Text>
              {matchScore && (
                <Text style={s.headerSub}>Agent eşleşmesi · {matchScore} uyum ✨</Text>
              )}
            </View>
            <TouchableOpacity
              style={s.logBtn}
              onPress={() => navigation.navigate('AgentLog', { matchId })}
            >
              <Text style={s.logBtnText}>Agent log</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={i => i.id}
            renderItem={renderMessage}
            contentContainerStyle={s.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd()}
            ListHeaderComponent={
              <View style={s.matchBanner}>
                <View style={s.bannerPill}>
                  <Text style={s.matchBannerText}>
                    Agentların eşleşti — şimdi sıra sende 💜
                  </Text>
                </View>
              </View>
            }
          />

          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Mesaj yaz..."
              placeholderTextColor="#C4B5D0"
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[s.sendBtn, !input.trim() && s.sendBtnOff]}
              onPress={sendMessage}
              disabled={!input.trim()}
            >
              <LinearGradient
                colors={!input.trim() ? ['#E0D0E8', '#D8C8E0'] : ['#FF6B9D', '#C084FC']}
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 18, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F5F0FA', gap: 10 },
  backBtn: { padding: 4 },
  back: { fontSize: 28, color: '#9B8AB8', fontWeight: '300' },
  headerAv: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerAvTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  avOther: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '800', color: '#2D1B4E' },
  headerSub: { fontSize: 12, color: '#9B8AB8', fontWeight: '600', marginTop: 1 },
  logBtn: { borderWidth: 2, borderColor: '#F0EBF7', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff' },
  logBtnText: { fontSize: 13, color: '#7C3AED', fontWeight: '700' },
  list: { padding: 14, gap: 10, paddingBottom: 6 },
  matchBanner: { alignItems: 'center', marginBottom: 14 },
  bannerPill: { backgroundColor: '#fff', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 8, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  matchBannerText: { fontSize: 13, color: '#9B8AB8', textAlign: 'center', fontWeight: '600' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  msgRowRight: { flexDirection: 'row-reverse' },
  bubble: { maxWidth: '75%', borderRadius: 22, padding: 12, paddingHorizontal: 16 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 6, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  bubbleMe: { backgroundColor: '#7C3AED', borderBottomRightRadius: 6 },
  bubbleText: { fontSize: 16, lineHeight: 22, color: '#2D1B4E' },
  bubbleTextMe: { color: '#fff', fontWeight: '500' },
  timestamp: { fontSize: 11, color: '#C4B5D0', marginTop: 4, marginLeft: 6, fontWeight: '500' },
  timestampRight: { textAlign: 'right', marginRight: 6, marginLeft: 0 },
  dateLabelWrap: { alignItems: 'center', marginVertical: 12 },
  datePill: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  dateLabel: { fontSize: 12, color: '#9B8AB8', fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F5F0FA', gap: 10 },
  input: { flex: 1, backgroundColor: '#F8F5FC', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 13, fontSize: 16, color: '#2D1B4E', maxHeight: 100, borderWidth: 2, borderColor: '#F0EBF7', fontWeight: '500' },
  sendBtn: { borderRadius: 24, overflow: 'hidden' },
  sendBtnOff: { opacity: 0.5 },
  sendGrad: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 22, fontWeight: '600' },
  bubbleFailed: { backgroundColor: '#7C3AED', opacity: 0.6 },
  failedText: { fontSize: 11, color: '#FF6B9D', marginTop: 4, marginRight: 6, textAlign: 'right', fontWeight: '600' },
  retryRow: { alignSelf: 'flex-end' },
});
