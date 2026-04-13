// screens/AgentMatchScreen.tsx
// Agent Match detail screen - shows AI agent compatibility analysis
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { FONT_HEADING, FONT_BODY_SEMIBOLD } from '../lib/fonts';

interface AgentMessage {
  role: string;
  content: string;
  agent: 'a' | 'b';
}

export default function AgentMatchScreen({ route, navigation }: any) {
  const { matchId, otherUserId, otherUser: passedUser } = route.params || {};
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(passedUser || null);
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [reasoning, setReasoning] = useState('');
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    trackEvent('agent_match_view', { match_id: matchId });
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check premium
      const { data: userData } = await supabase
        .from('users').select('is_premium').eq('id', user.id).single();
      setIsPremium(userData?.is_premium || false);

      // Fetch match + conversation data
      const { data: matchData } = await supabase
        .from('matches')
        .select('*, conversation:conversation_id(*)')
        .eq('id', matchId)
        .single();

      if (matchData) {
        const conv = matchData.conversation;
        if (conv) {
          const avg = Math.round(((conv.agent_a_score || 0) + (conv.agent_b_score || 0)) / 2);
          setScore(avg);
          setReasoning(conv.agent_a_reasoning || '');

          if (conv.compatibility_breakdown) {
            setBreakdown(conv.compatibility_breakdown);
          }

          // Parse messages if stored
          if (conv.messages) {
            try {
              const parsed = typeof conv.messages === 'string'
                ? JSON.parse(conv.messages)
                : conv.messages;
              setMessages(Array.isArray(parsed) ? parsed : []);
            } catch { setMessages([]); }
          }
        }

        // Fetch other user if not passed
        if (!passedUser) {
          const otherId = matchData.user_a_id === user.id
            ? matchData.user_b_id : matchData.user_a_id;
          const { data: otherData } = await supabase
            .from('users').select('id,name,age,city,photos')
            .eq('id', otherId).single();
          if (otherData) setOtherUser(otherData);
        }
      }
    } catch (err) {
      captureError(err, { context: 'agent_match_fetch' });
    } finally {
      setLoading(false);
    }
  };

  const startChat = () => {
    navigation.replace('HumanChat', { matchId, otherUser });
  };

  if (loading) {
    return (
      <View style={s.bg}>
        <SafeAreaView style={s.loadingWrap}>
          <ActivityIndicator color={colors.accentPurple} size="large" />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color="#C09AFF" />
          </TouchableOpacity>
          <View style={s.headerTitles}>
            <Text style={s.headerTitle}>Agent Match</Text>
            <Text style={s.headerSub}>{otherUser?.name} ile uyumluluk analizi</Text>
          </View>
          <View style={s.premiumBadge}>
            <Text style={s.premiumBadgeText}>PREMIUM</Text>
          </View>
        </View>

        <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
          {/* Profile pair */}
          <View style={s.pairSection}>
            <View style={s.pairRow}>
              <View style={s.pairAv}>
                <Text style={s.pairAvText}>{'\u{1F9D4}'}</Text>
              </View>
              <View style={s.vsIcon}>
                <LinearGradient
                  colors={['#7c3aed', '#A064FF']}
                  style={s.vsGrad}
                >
                  <Ionicons name="heart" size={14} color="#fff" />
                </LinearGradient>
              </View>
              <View style={[s.pairAv, { backgroundColor: '#3d2a4a' }]}>
                {otherUser?.photos?.[0] ? (
                  <Image source={{ uri: otherUser.photos[0] }} style={s.pairAvImg} />
                ) : (
                  <Text style={s.pairAvText}>{otherUser?.name?.[0] || '?'}</Text>
                )}
              </View>
            </View>
            <Text style={s.pairNames}>Senin Agent'in {'\u00B7'} {otherUser?.name}'in Agent'i</Text>
          </View>

          {/* Compatibility score card */}
          <View style={s.compatCard}>
            <Text style={s.compatScore}>{score}%</Text>
            <Text style={s.compatLabel}>UYUMLULUK SKORU</Text>

            {breakdown && (
              <View style={s.barsWrap}>
                {[
                  { label: 'Degerler', value: breakdown.values || 0 },
                  { label: 'Ilgi alani', value: breakdown.communication || 0 },
                  { label: 'Yasam tarzi', value: breakdown.lifestyle || 0 },
                  { label: 'Iletisim', value: breakdown.humor || 0 },
                ].map((item, i) => (
                  <View key={i} style={s.barRow}>
                    <Text style={s.barLabel}>{item.label}</Text>
                    <View style={s.barTrack}>
                      <LinearGradient
                        colors={['#7c3aed', '#A064FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[s.barFill, { width: `${item.value}%` }]}
                      />
                    </View>
                    <Text style={s.barVal}>{item.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Agent conversation */}
          {messages.length > 0 && (
            <View style={s.convSection}>
              <Text style={s.sectionTitle}>AGENT KONUSMASI</Text>
              {messages.slice(0, 6).map((msg, i) => {
                const isA = msg.agent === 'a' || i % 2 === 0;
                return (
                  <View key={i} style={[s.agentMsg, isA ? s.agentMsgLeft : s.agentMsgRight]}>
                    <Text style={s.agentMsgHeader}>
                      {isA ? "SENIN AGENT'IN" : `${otherUser?.name?.toUpperCase()}'IN AGENT'I`}
                    </Text>
                    <View style={[s.agentBubble, isA ? s.agentBubbleA : s.agentBubbleB]}>
                      <Text style={s.agentBubbleText}>{msg.content}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Insights */}
          {reasoning && (
            <View style={s.insightCard}>
              <Text style={s.sectionTitle}>AGENT ICGORULERI</Text>
              <View style={s.insightItem}>
                <Text style={s.insightIcon}>{'\u2705'}</Text>
                <Text style={s.insightText}>{reasoning}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* CTA buttons */}
        <View style={s.ctaWrap}>
          <TouchableOpacity onPress={startChat} activeOpacity={0.85}>
            <LinearGradient
              colors={colors.goldGradient as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.ctaPrimary}
            >
              <Text style={s.ctaPrimaryText}>Mesaj Baslat {'\u2192'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.ctaGhost} onPress={() => navigation.goBack()}>
            <Text style={s.ctaGhostText}>Geri Don</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0a0812' },
  safeArea: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(160,100,255,0.12)',
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(160,100,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: { flex: 1 },
  headerTitle: {
    fontFamily: FONT_HEADING,
    fontSize: 18,
    color: '#C09AFF',
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(160,100,255,0.55)',
    marginTop: 1,
  },
  premiumBadge: {
    backgroundColor: '#A064FF',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.04,
  },

  // Body
  body: { flex: 1 },
  bodyContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 16,
  },

  // Profile pair
  pairSection: {
    alignItems: 'center',
    marginBottom: 4,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairAv: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1e1530',
    borderWidth: 2,
    borderColor: 'rgba(160,100,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairAvText: {
    fontSize: 26,
  },
  pairAvImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  vsIcon: {
    zIndex: 2,
    marginHorizontal: -8,
  },
  vsGrad: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairNames: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 8,
    textAlign: 'center',
  },

  // Compat card
  compatCard: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.2)',
    borderRadius: 16,
    padding: 16,
  },
  compatScore: {
    fontFamily: FONT_HEADING,
    fontSize: 48,
    color: '#A064FF',
    textAlign: 'center',
    lineHeight: 52,
  },
  compatLabel: {
    fontSize: 12,
    color: 'rgba(160,100,255,0.6)',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.06,
    marginTop: 4,
  },
  barsWrap: {
    marginTop: 14,
    gap: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    width: 80,
  },
  barTrack: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 99,
  },
  barVal: {
    fontSize: 11,
    color: 'rgba(160,100,255,0.8)',
    fontWeight: '600',
    width: 28,
    textAlign: 'right',
  },

  // Conversation
  convSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 0.08,
    marginBottom: 8,
  },
  agentMsg: {
    maxWidth: '82%',
  },
  agentMsgLeft: {
    alignSelf: 'flex-start',
  },
  agentMsgRight: {
    alignSelf: 'flex-end',
  },
  agentMsgHeader: {
    fontSize: 10,
    color: 'rgba(160,100,255,0.6)',
    fontWeight: '600',
    letterSpacing: 0.04,
    marginBottom: 3,
  },
  agentBubble: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 14,
  },
  agentBubbleA: {
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.2)',
    borderBottomLeftRadius: 4,
  },
  agentBubbleB: {
    backgroundColor: 'rgba(124,58,237,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.3)',
    borderBottomRightRadius: 4,
  },
  agentBubbleText: {
    fontSize: 12,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.82)',
  },

  // Insights
  insightCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 14,
  },
  insightItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  insightIcon: {
    fontSize: 14,
  },
  insightText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 19,
    flex: 1,
  },

  // CTA
  ctaWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  ctaPrimary: {
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a0f00',
    fontFamily: FONT_BODY_SEMIBOLD,
  },
  ctaGhost: {
    borderRadius: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  ctaGhostText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
});
