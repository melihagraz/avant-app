// screens/AgentMatchesScreen.tsx
// Shows agent-found matches as a SwipeDeck. Reachable from Discover via the AgentBanner.
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { cacheMatches, getCachedMatches } from '../lib/offline';
import SwipeDeck from '../components/SwipeDeck';

interface Match {
  id: string;
  created_at: string;
  other_user: { id: string; name: string; age: number; city: string; photos: string[] };
  agent_a_score: number;
  agent_b_score: number;
  agent_a_reasoning: string;
  compatibility_breakdown?: { values: number; communication: number; lifestyle: number; humor: number } | null;
}

export default function AgentMatchesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [matches, setMatches] = useState<Match[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const breathAnim = useRef(new Animated.Value(0)).current;
  const activityFadeAnim = useRef(new Animated.Value(1)).current;
  const [activityIndex, setActivityIndex] = useState(0);
  const mountedRef = useRef(true);
  const breathRef = useRef<Animated.CompositeAnimation | null>(null);
  const activityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    init();
    startBreathing();
    startActivityRotation();
    return () => {
      mountedRef.current = false;
      breathRef.current?.stop();
      if (activityIntervalRef.current) clearInterval(activityIntervalRef.current);
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    };
  }, []);

  const init = async () => {
    try {
      trackEvent('agent_matches_view');
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      await fetchMatches(user.id);
    } catch (err) {
      captureError(err, { context: 'agent_matches_init' });
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async (userId: string) => {
    try {
      const { data: matchData, error } = await supabase
        .from('matches')
        .select(`
          id, created_at, user_a_id, user_b_id, conversation_id,
          conversation:conversation_id(agent_a_score, agent_b_score, agent_a_reasoning, compatibility_breakdown)
        `)
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .not('conversation_id', 'is', null)  // Only agent matches
        .order('created_at', { ascending: false });

      if (error || !matchData?.length) {
        setMatches([]);
        return;
      }

      const otherUserIds = matchData.map((m) => (m.user_a_id === userId ? m.user_b_id : m.user_a_id));
      const matchIds = matchData.map((m) => m.id);

      const [usersResult, messagesResult] = await Promise.all([
        supabase.from('users').select('id, name, age, city, photos').in('id', otherUserIds),
        supabase.from('human_messages').select('match_id').in('match_id', matchIds),
      ]);

      const usersMap = new Map((usersResult.data || []).map((u) => [u.id, u]));
      const matchesWithMessages = new Set((messagesResult.data || []).map((m) => m.match_id));

      const formatted: Match[] = matchData
        .filter((m) => !matchesWithMessages.has(m.id))  // Hide already-chatting matches
        .map((m) => {
          const otherUserId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
          const otherUser = usersMap.get(otherUserId) || { id: otherUserId, name: 'Kullanıcı', age: 0, city: '', photos: [] };
          const conv = m.conversation as any;
          return {
            id: m.id,
            created_at: m.created_at,
            other_user: otherUser,
            agent_a_score: conv?.agent_a_score || 0,
            agent_b_score: conv?.agent_b_score || 0,
            agent_a_reasoning: conv?.agent_a_reasoning || '',
            compatibility_breakdown: conv?.compatibility_breakdown || null,
          };
        });

      setMatches(formatted);
      cacheMatches(userId, formatted);
    } catch (err) {
      captureError(err, { context: 'fetch_agent_matches' });
      const cached = await getCachedMatches(userId);
      if (cached.length > 0) setMatches(cached as any);
    }
  };

  const startBreathing = () => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    breathRef.current = animation;
    animation.start();
  };

  const startActivityRotation = () => {
    activityIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      Animated.sequence([
        Animated.timing(activityFadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(activityFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      activityTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setActivityIndex((i) => (i + 1) % 8);
      }, 300);
    }, 2800);
  };

  const avgScore = (m: Match) => Math.round((m.agent_a_score + m.agent_b_score) / 2);
  const visibleMatches = matches.filter((m) => !dismissed.includes(m.id));

  const renderMatchCard = (match: Match) => {
    const score = avgScore(match);
    const hasPhoto = match.other_user?.photos?.length > 0;

    return (
      <View style={[s.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
        <View style={s.photoWrap}>
          {hasPhoto ? (
            <Image source={{ uri: match.other_user.photos[0] }} style={s.photo} resizeMode="cover" />
          ) : (
            <LinearGradient colors={colors.accentGradient as any} style={s.photoPlaceholder}>
              <View style={s.silhouetteCircle}>
                <Ionicons name="person" size={64} color="rgba(255,255,255,0.5)" />
              </View>
            </LinearGradient>
          )}
          <LinearGradient colors={['transparent', 'rgba(5,6,15,0.92)']} style={s.cardGradient}>
            <Text style={s.cardName}>
              {match.other_user?.name}
              <Text style={s.cardAge}>, {match.other_user?.age || '?'}</Text>
            </Text>
            {match.other_user?.city ? <Text style={s.cardCity}>{match.other_user.city}</Text> : null}
          </LinearGradient>

          <View style={s.scoreBadge}>
            <LinearGradient colors={colors.accentGradientAlt as any} style={s.scoreBadgeInner}>
              <Text style={s.scoreNum}>{score}</Text>
              <Text style={s.scoreLbl}>{t('home.compatibility')}</Text>
            </LinearGradient>
          </View>

          <View style={s.agentBadge}>
            <Text style={s.agentBadgeTxt}>🤖 Agent Pick</Text>
          </View>
        </View>

        {match.agent_a_reasoning ? (
          <View style={s.cardBody}>
            <View style={[s.reasonCard, { backgroundColor: colors.inputBg }]}>
              <Text style={[s.reasonTxt, { color: colors.textMuted }]} numberOfLines={2}>
                <Text style={[s.reasonLabel, { color: colors.userBubble }]}>{t('home.agentSays')}</Text>
                "{match.agent_a_reasoning}"
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>🤖 Agent Picks</Text>
          <View style={{ width: 32 }} />
        </View>

        {loading ? (
          <View style={s.centerWrap}>
            <Text style={[s.loadingText, { color: colors.textSecondary }]}>{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View style={s.centerWrap}>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>{t('home.errorTitle')}</Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>{t('home.errorSub')}</Text>
            <TouchableOpacity
              onPress={() => {
                setError(false);
                setLoading(true);
                init();
              }}
              style={{ marginTop: 16 }}
            >
              <Text style={{ color: colors.accentPink, fontSize: 15, fontWeight: '700' }}>
                {t('common.retry')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : visibleMatches.length === 0 ? (
          <View style={s.centerWrap}>
            <LinearGradient
              colors={colors.accentGradient as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.emptyHero}
            >
              <Animated.View
                style={[
                  s.emptyRobotCircle,
                  {
                    transform: [
                      {
                        scale: breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={s.emptyRobotEmoji}>🤖</Text>
              </Animated.View>
              <Text style={s.emptyHeroTitle}>{t('home.emptyTitle')}</Text>
              <Animated.View style={[s.activityRow, { opacity: activityFadeAnim }]}>
                <View style={s.activityDot} />
                <Text style={s.activityText}>{t(`home.activity${activityIndex + 1}`)}</Text>
              </Animated.View>
              <View style={s.emptyDivider} />
              <Text style={s.emptyHeroSub}>{t('home.emptySub')}</Text>
              <Text style={s.emptyHeroHint}>{t('home.emptyHint')}</Text>
            </LinearGradient>
          </View>
        ) : (
          <View style={s.deckWrap}>
            <SwipeDeck<Match>
              data={visibleMatches}
              keyExtractor={(m) => m.id}
              renderCard={(m) => renderMatchCard(m)}
              onSwipeLeft={(m) => {
                trackEvent('agent_match_dismiss', { match_id: m.id });
                setDismissed((prev) => [...prev, m.id]);
              }}
              onSwipeRight={(m) => {
                trackEvent('agent_match_chat', { match_id: m.id });
                navigation.navigate('HumanChat', { matchId: m.id, otherUser: m.other_user });
              }}
              onSwipeUp={(m) => {
                trackEvent('agent_match_detail', { match_id: m.id });
                navigation.navigate('ProfileDetail', { userId: m.other_user.id, matchId: m.id });
              }}
            />
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  loadingText: { fontSize: 15, fontWeight: '600' },

  emptyHero: {
    width: '100%',
    borderRadius: 36,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
    elevation: 16,
  },
  emptyRobotCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    marginBottom: 20,
  },
  emptyRobotEmoji: { fontSize: 52 },
  emptyHeroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 14,
    textAlign: 'center',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#69F0AE' },
  activityText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  emptyDivider: { width: 60, height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 20 },
  emptyHeroSub: { fontSize: 16, color: 'rgba(255,255,255,0.95)', fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyHeroHint: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontWeight: '500' },
  emptyTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  emptySub: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginTop: 6 },

  deckWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Match card (copy from HomeScreen patterns)
  card: {
    width: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 36,
    elevation: 14,
  },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 440 },
  photoPlaceholder: {
    width: '100%',
    height: 440,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  silhouetteCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    justifyContent: 'flex-end',
    paddingHorizontal: 26,
    paddingBottom: 26,
  },
  cardName: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8 },
  cardAge: { fontSize: 26, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  cardCity: { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  scoreBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#E8B86D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  scoreBadgeInner: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', borderRadius: 28 },
  scoreNum: { fontSize: 24, fontWeight: '900', color: '#fff' },
  scoreLbl: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '700', marginTop: -2, textTransform: 'uppercase', letterSpacing: 0.5 },

  agentBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  agentBadgeTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },

  cardBody: { padding: 22 },
  reasonCard: { borderRadius: 20, padding: 16 },
  reasonTxt: { fontSize: 14, lineHeight: 21 },
  reasonLabel: { fontWeight: '700' },
});
