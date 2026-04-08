import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';

export default function AgentLogScreen({ route, navigation }: any) {
  const { matchId } = route.params;
  const [conv, setConv] = useState<any>(null);
  const { colors } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    trackEvent('agent_log_view', { match_id: matchId });
    supabase.from('matches')
      .select('conversation:conversation_id(*)')
      .eq('id', matchId)
      .single()
      .then(({ data }) => setConv(data?.conversation));
  }, []);

  const messages: any[] = conv?.messages || [];
  const avgScore = conv ? Math.round(((conv.agent_a_score || 0) + (conv.agent_b_score || 0)) / 2) : 0;

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.separator }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={[s.back, { color: colors.textSecondary }]}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: colors.textPrimary }]}>{t('agentLog.title')}</Text>
            <Text style={[s.sub, { color: colors.textSecondary }]}>{t('agentLog.messageCount', { count: messages.length, score: avgScore })}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={s.list}>
          <View style={s.infoBanner}>
            <View style={[s.bannerPill, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
              <Text style={[s.infoText, { color: colors.textSecondary }]}>{t('agentLog.infoBanner')}</Text>
            </View>
          </View>
          {messages.map((msg: any, i: number) => (
            <View key={i} style={[s.row, msg.speaker === 'agent_b' && s.rowRight]}>
              {msg.speaker === 'agent_a' ? (
                <LinearGradient colors={colors.accentGradientAlt as any} style={s.av}>
                  <Text style={s.avTxt}>A</Text>
                </LinearGradient>
              ) : (
                <LinearGradient colors={colors.agentBGradient as any} style={s.av}>
                  <Text style={s.avTxt}>B</Text>
                </LinearGradient>
              )}
              <View style={[s.bbl, msg.speaker === 'agent_b' ? [s.bblB, { backgroundColor: colors.inputBg, shadowColor: colors.accentIndigo }] : [s.bblA, { backgroundColor: colors.card, shadowColor: colors.shadow }]]}>
                <Text style={[s.bblTxt, { color: colors.textPrimary }]}>{msg.content?.replace(/VERDICT:.*$/, '').trim()}</Text>
              </View>
            </View>
          ))}
          {conv && (
            <View style={s.verdict}>
              <LinearGradient colors={colors.successGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.verdictGrad}>
                <Text style={s.verdictTitle}>{t('agentLog.matchTitle')}</Text>
                <View style={s.scores}>
                  <View style={s.scoreChip}>
                    <Text style={s.scoreNum}>{conv.agent_a_score}</Text>
                    <Text style={s.scoreLbl}>{t('agentLog.yourAgent')}</Text>
                  </View>
                  <View style={s.scoreChip}>
                    <Text style={s.scoreNum}>{conv.agent_b_score}</Text>
                    <Text style={s.scoreLbl}>{t('agentLog.otherAgent')}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 18, borderBottomWidth: 1, gap: 10 },
  backBtn: { padding: 4 },
  back: { fontSize: 28, fontWeight: '300' },
  title: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  list: { padding: 16, gap: 12 },
  infoBanner: { alignItems: 'center', marginBottom: 6 },
  bannerPill: { borderRadius: 28, paddingHorizontal: 20, paddingVertical: 8, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  infoText: { fontSize: 13, textAlign: 'center', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowRight: { flexDirection: 'row-reverse' },
  av: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  bbl: { maxWidth: '76%', borderRadius: 20, padding: 11, paddingHorizontal: 14 },
  bblA: { borderBottomLeftRadius: 5, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  bblB: { borderBottomRightRadius: 5, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  bblTxt: { fontSize: 14, lineHeight: 20 },
  verdict: { marginTop: 10, borderRadius: 24, overflow: 'hidden', shadowColor: '#00C853', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  verdictGrad: { padding: 22, gap: 14, borderRadius: 24 },
  verdictTitle: { fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'center' },
  scores: { flexDirection: 'row', gap: 10 },
  scoreChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  scoreNum: { fontSize: 30, fontWeight: '900', color: '#fff' },
  scoreLbl: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 3, fontWeight: '700' },
  reasoning: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 21, fontWeight: '500' },
});
