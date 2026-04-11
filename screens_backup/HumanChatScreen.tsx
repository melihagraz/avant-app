// screens/HumanChatScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView
} from 'react-native';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function HumanChatScreen({ route, navigation }: any) {
  const { matchId, otherUser } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [myUserId, setMyUserId] = useState('');
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyUserId(user.id);
      await fetchMessages();
      await fetchMatchScore();
      subscribeToMessages();
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

    // Optimistic update — hemen ekrana yansıt
    const tempMsg: Message = {
      id: Date.now().toString(),
      sender_id: myUserId,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    await supabase.from('human_messages').insert({
      match_id: matchId,
      sender_id: myUserId,
      content: text,
    });

    // Gerçek veriyi çek
    fetchMessages();
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === myUserId;
    return (
      <View style={[s.msgRow, isMe && s.msgRowRight]}>
        {!isMe && (
          <View style={[s.av, s.avOther]}>
            <Text style={[s.avText, { color: '#0C447C' }]}>
              {otherUser?.name?.[0] || '?'}
            </Text>
          </View>
        )}
        <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
          <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.back}>‹</Text>
          </TouchableOpacity>
          <View style={[s.av, s.avOther, { marginLeft: 4 }]}>
            <Text style={[s.avText, { color: '#0C447C' }]}>
              {otherUser?.name?.[0] || '?'}
            </Text>
          </View>
          <View style={s.headerInfo}>
            <Text style={s.headerName}>{otherUser?.name}</Text>
            {matchScore && (
              <Text style={s.headerSub}>Agent eşleşmesi · {matchScore} uyum</Text>
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
              <Text style={s.matchBannerText}>
                Agentların eşleşti — şimdi sıra sende
              </Text>
            </View>
          }
        />

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Mesaj yaz..."
            placeholderTextColor="#aaa"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[s.sendBtn, !input.trim() && s.sendBtnOff]}
            onPress={sendMessage}
            disabled={!input.trim()}
          >
            <Text style={s.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5', gap: 8 },
  back: { fontSize: 26, color: '#888', marginRight: 2 },
  av: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avOther: { backgroundColor: '#E6F1FB' },
  avText: { fontSize: 13, fontWeight: '500' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
  headerSub: { fontSize: 11, color: '#888' },
  logBtn: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  logBtnText: { fontSize: 12, color: '#666' },
  list: { padding: 12, gap: 8, paddingBottom: 4 },
  matchBanner: { alignItems: 'center', marginBottom: 12 },
  matchBannerText: { fontSize: 12, color: '#888', textAlign: 'center', backgroundColor: '#f5f5f4', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowRight: { flexDirection: 'row-reverse' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 10, paddingHorizontal: 13 },
  bubbleOther: { backgroundColor: '#f5f5f4', borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: '#D85A30', borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 20, color: '#1a1a1a' },
  bubbleTextMe: { color: '#fff' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, paddingHorizontal: 14, borderTopWidth: 0.5, borderTopColor: '#e5e5e5', gap: 8 },
  input: { flex: 1, backgroundColor: '#f5f5f4', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#1a1a1a', maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D85A30', alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: '#f0c4b3' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '500' },
});
