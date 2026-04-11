import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AgentLogScreen({ route, navigation }: any) {
  const { matchId } = route.params;
  const [conv, setConv] = useState<any>(null);

  useEffect(() => {
    supabase.from('matches')
      .select('conversation:conversation_id(*)')
      .eq('id', matchId)
      .single()
      .then(({ data }) => setConv(data?.conversation));
  }, []);

  const messages: any[] = conv?.messages || [];
  const avgScore = conv ? Math.round(((conv.agent_a_score || 0) + (conv.agent_b_score || 0)) / 2) : 0;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Agent konuşması</Text>
          <Text style={s.sub}>{messages.length} mesaj · {avgScore} uyum</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.list}>
        <View style={s.infoBanner}>
          <Text style={s.infoText}>Agentların bu konuşmayı yaptı ve eşleşmeye karar verdi</Text>
        </View>
        {messages.map((msg: any, i: number) => (
          <View key={i} style={[s.row, msg.speaker === 'agent_b' && s.rowRight]}>
            <View style={[s.av, msg.speaker === 'agent_b' ? s.avB : s.avA]}>
              <Text style={s.avTxt}>{msg.speaker === 'agent_a' ? 'A' : 'B'}</Text>
            </View>
            <View style={[s.bbl, msg.speaker === 'agent_b' ? s.bblB : s.bblA]}>
              <Text style={s.bblTxt}>{msg.content?.replace(/VERDICT:.*$/, '').trim()}</Text>
            </View>
          </View>
        ))}
        {conv && (
          <View style={s.verdict}>
            <Text style={s.verdictTitle}>Her iki agent da eşleşti</Text>
            <View style={s.scores}>
              <View style={s.scoreChip}>
                <Text style={s.scoreNum}>{conv.agent_a_score}</Text>
                <Text style={s.scoreLbl}>Senin agentın</Text>
              </View>
              <View style={s.scoreChip}>
                <Text style={s.scoreNum}>{conv.agent_b_score}</Text>
                <Text style={s.scoreLbl}>Karşı agent</Text>
              </View>
            </View>
            <Text style={s.reasoning}>{conv.agent_a_reasoning}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5', gap: 8 },
  back: { fontSize: 26, color: '#888' },
  title: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
  sub: { fontSize: 11, color: '#888' },
  list: { padding: 14, gap: 10 },
  infoBanner: { alignItems: 'center', marginBottom: 4 },
  infoText: { fontSize: 12, color: '#888', textAlign: 'center', backgroundColor: '#f5f5f4', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  rowRight: { flexDirection: 'row-reverse' },
  av: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avA: { backgroundColor: '#FAECE7' },
  avB: { backgroundColor: '#E6F1FB' },
  avTxt: { fontSize: 9, fontWeight: '500', color: '#712B13' },
  bbl: { maxWidth: '76%', borderRadius: 12, padding: 9, paddingHorizontal: 12 },
  bblA: { backgroundColor: '#f5f5f4', borderBottomLeftRadius: 3 },
  bblB: { backgroundColor: '#FAECE7', borderBottomRightRadius: 3 },
  bblTxt: { fontSize: 13, lineHeight: 18, color: '#1a1a1a' },
  verdict: { marginTop: 8, backgroundColor: '#EAF3DE', borderRadius: 14, padding: 14, gap: 10 },
  verdictTitle: { fontSize: 14, fontWeight: '500', color: '#3B6D11', textAlign: 'center' },
  scores: { flexDirection: 'row', gap: 8 },
  scoreChip: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center' },
  scoreNum: { fontSize: 22, fontWeight: '500', color: '#1a1a1a' },
  scoreLbl: { fontSize: 11, color: '#888', marginTop: 2 },
  reasoning: { fontSize: 12, color: '#3B6D11', lineHeight: 17 },
});