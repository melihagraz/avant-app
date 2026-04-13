import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '../../src/theme';
import { useChatStore } from '../../src/stores/chatStore';
import { useAuthStore } from '../../src/stores/authStore';

export default function ChatScreen() {
  const router = useRouter();
  const { matchId, otherUserName } = useLocalSearchParams<{ matchId: string; otherUserName: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const { user } = useAuthStore();
  const { fetchMessages, sendMessage, subscribeToMessages, unsubscribe, getMessages } = useChatStore();

  const messages = getMessages(matchId || '');
  const [inputText, setInputText] = useState('');
  const [agentOpen, setAgentOpen] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    if (matchId) {
      fetchMessages(matchId);
      subscribeToMessages(matchId);
    }
    return () => { if (matchId) unsubscribe(matchId); };
  }, [matchId]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  }, [messages.length]);

  const toggleAgent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAgentOpen(!agentOpen);
  };

  const useChip = (text: string) => {
    setInputText(text);
    setAgentOpen(false);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !matchId || !user?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSendError('');

    const text = inputText.trim();
    setInputText('');

    const result = await sendMessage(matchId, user.id, text);
    if (result.error) {
      setSendError(result.error);
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.chatHAv}>
          <Text style={{ fontSize: 18 }}>👤</Text>
        </View>
        <View>
          <Text style={styles.chatHName}>{otherUserName || 'Sohbet'}</Text>
          <Text style={styles.chatOnline}>● cevrimici</Text>
        </View>
        <Pressable
          style={[styles.agentToggle, agentOpen && styles.agentToggleActive]}
          onPress={toggleAgent}
        >
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={10} stroke="#C09AFF" strokeWidth={2} />
            <Path d="M9 12l2 2 4-4" stroke="#C09AFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.agentToggleText}>Agent</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={[styles.messagesContent, agentOpen && { paddingBottom: 180 }]}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <View key={msg.id} style={[styles.msg, isMe ? styles.msgMe : styles.msgThem]}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.bubbleText, isMe && { color: Colors.goldText, fontWeight: '500' }]}>
                      {msg.content}
                    </Text>
                  </View>
                  <Text style={[styles.msgTime, isMe ? { textAlign: 'right', paddingRight: 4 } : { paddingLeft: 4 }]}>
                    {new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })}
            {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
          </ScrollView>

          {agentOpen && (
            <Animated.View entering={SlideInDown.duration(300)} exiting={SlideOutDown.duration(200)} style={styles.agentPanel}>
              <View style={styles.panelHandle} />
              <View style={styles.panelTitleRow}>
                <View style={styles.panelDot} />
                <Text style={styles.panelTitle}>Agent Asistan — Premium</Text>
              </View>
              <View style={styles.suggestions}>
                {[
                  { icon: '🗺️', text: 'Bu hafta sonu bulusma yapalim mi? Bildigim harika bir yer var.' },
                  { icon: '📸', text: 'En cok hangi anlari cekmekten zevk aliyorsun?' },
                  { icon: '☕', text: 'Bulusma oncesi bir kahve icelim mi, seni daha iyi tanimak isterim.' },
                ].map((s, i) => (
                  <Pressable key={i} style={styles.chip} onPress={() => useChip(s.text)}>
                    <Text style={styles.chipIcon}>{s.icon}</Text>
                    <Text style={styles.chipText}>"{s.text}"</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.agentTip}>Ortak konu: fotograf + pazar</Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.inputBar}>
          <Pressable style={styles.addBtn}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={10} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
              <Path d="M12 8v8M8 12h8" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} strokeLinecap="round" />
            </Svg>
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yaz..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
          />
          <Pressable onPress={handleSend}>
            <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.sendBtn}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={Colors.goldText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.white05 },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.white05, alignItems: 'center', justifyContent: 'center' },
  chatHAv: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1530', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chatHName: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.white },
  chatOnline: { fontFamily: Fonts.body, fontSize: 11, color: Colors.green, marginTop: 2 },
  agentToggle: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(160,100,255,0.35)', borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10 },
  agentToggleActive: { backgroundColor: 'rgba(124,58,237,0.3)', borderColor: 'rgba(160,100,255,0.6)' },
  agentToggleText: { fontFamily: Fonts.bodySemiBold, fontSize: 10, color: Colors.purpleMuted, letterSpacing: 0.3 },
  messages: { flex: 1, paddingHorizontal: 16 },
  messagesContent: { paddingVertical: 12, gap: 8 },
  msg: { maxWidth: '78%' },
  msgMe: { alignSelf: 'flex-end' },
  msgThem: { alignSelf: 'flex-start' },
  bubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  bubbleThem: { backgroundColor: Colors.white07, borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: Colors.gold, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.88)' },
  msgTime: { fontFamily: Fonts.body, fontSize: 10, color: Colors.white22, marginTop: 3 },
  sendError: { fontFamily: Fonts.body, fontSize: 12, color: '#ff6b6b', textAlign: 'center', marginTop: 8 },
  agentPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,8,18,0.98)', borderTopWidth: 1, borderTopColor: 'rgba(160,100,255,0.25)', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 14, paddingHorizontal: 16 },
  panelHandle: { width: 36, height: 3, borderRadius: 99, backgroundColor: 'rgba(160,100,255,0.3)', alignSelf: 'center', marginBottom: 12 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  panelDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.purple },
  panelTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 10, fontWeight: '700', color: 'rgba(160,100,255,0.7)', letterSpacing: 0.8, textTransform: 'uppercase' },
  suggestions: { gap: 7, marginBottom: 12 },
  chip: { backgroundColor: 'rgba(124,58,237,0.12)', borderWidth: 1, borderColor: 'rgba(160,100,255,0.22)', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipIcon: { fontSize: 14 },
  chipText: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 17, flex: 1 },
  agentTip: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(160,100,255,0.5)', textAlign: 'center' },
  inputBar: { height: 58, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.white05, backgroundColor: Colors.surface },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.white05, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: Colors.white05, borderWidth: 1, borderColor: Colors.white08, borderRadius: 22, paddingVertical: 9, paddingHorizontal: 16, fontFamily: Fonts.body, fontSize: 13, color: Colors.white80 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
