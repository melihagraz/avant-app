import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    <LinearGradient colors={['#FFF8FA', '#F8F5FF', '#F5FAFF']} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.back}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Agent konuşması 🤖</Text>
            <Text style={s.sub}>{messages.length} mesaj · {avgScore} uyum</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={s.list}>
          <View style={s.infoBanner}>
            <View style={s.bannerPill}>
              <Text style={s.infoText}>Agentların bu konuşmayı yaptı ve eşleşmeye karar verdi ✨</Text>
            </View>
          </View>
          {messages.map((msg: any, i: number) => (
            <View key={i} style={[s.row, msg.speaker === 'agent_b' && s.rowRight]}>
              {msg.speaker === 'agent_a' ? (
                <LinearGradient colors={['#FF6B9D', '#C084FC']} style={s.av}>
                  <Text style={s.avTxt}>A</Text>
                </LinearGradient>
              ) : (
                <LinearGradient colors={['#818CF8', '#3B82F6']} style={s.av}>
                  <Text style={s.avTxt}>B</Text>
                </LinearGradient>
              )}
              <View style={[s.bbl, msg.speaker === 'agent_b' ? s.bblB : s.bblA]}>
                <Text style={s.bblTxt}>{msg.content?.replace(/VERDICT:.*$/, '').trim()}</Text>
              </View>
            </View>
          ))}
          {conv && (
            <View style={s.verdict}>
              <LinearGradient colors={['#00C853', '#69F0AE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.verdictGrad}>
                <Text style={s.verdictTitle}>Her iki agent da eşleşti 🎉</Text>
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
              </LinearGradient>
            </View>
          )}
        </ScrollView>
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
  title: { fontSize: 18, fontWeight: '800', color: '#2D1B4E' },
  sub: { fontSize: 12, color: '#9B8AB8', fontWeight: '600', marginTop: 1 },
  list: { padding: 16, gap: 12 },
  infoBanner: { alignItems: 'center', marginBottom: 6 },
  bannerPill: { backgroundColor: '#fff', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 8, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  infoText: { fontSize: 13, color: '#9B8AB8', textAlign: 'center', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowRight: { flexDirection: 'row-reverse' },
  av: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  bbl: { maxWidth: '76%', borderRadius: 20, padding: 11, paddingHorizontal: 14 },
  bblA: { backgroundColor: '#fff', borderBottomLeftRadius: 5, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  bblB: { backgroundColor: '#F8F5FC', borderBottomRightRadius: 5, shadowColor: '#818CF8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  bblTxt: { fontSize: 14, lineHeight: 20, color: '#2D1B4E' },
  verdict: { marginTop: 10, borderRadius: 24, overflow: 'hidden', shadowColor: '#00C853', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  verdictGrad: { padding: 22, gap: 14, borderRadius: 24 },
  verdictTitle: { fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center' },
  scores: { flexDirection: 'row', gap: 10 },
  scoreChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  scoreNum: { fontSize: 30, fontWeight: '900', color: '#fff' },
  scoreLbl: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3, fontWeight: '700' },
  reasoning: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 21, fontWeight: '500' },
});
