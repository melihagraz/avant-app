// screens/DiscoverScreen.tsx
// Discover feed with branded header, swipe deck, and 4-button action row.
// Tab bar is managed externally by BottomTabBar.
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert,
  Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { FONT_HEADING } from '../lib/fonts';
import { useAgent } from '../lib/useAgent';
import SwipeDeck from '../components/SwipeDeck';
import DiscoverProfileCard, { DiscoverProfile } from '../components/DiscoverProfileCard';
import SuperLikeModal from '../components/SuperLikeModal';

const FREE_LIKES_PER_DAY = 15;

export default function DiscoverScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { agent } = useAgent();

  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [remainingLikes, setRemainingLikes] = useState(FREE_LIKES_PER_DAY);
  const [remainingSuperLikes, setRemainingSuperLikes] = useState(1);
  const [boostCredits, setBoostCredits] = useState(1);
  const [agentMatchCount, setAgentMatchCount] = useState(0);

  const [superLikeProfile, setSuperLikeProfile] = useState<DiscoverProfile | null>(null);
  const [showSuperLikeModal, setShowSuperLikeModal] = useState(false);

  const myUserIdRef = useRef<string>('');
  const swipeRef = useRef<{ index: number }>({ index: 0 });

  // Pulsing dot animation for Agent Match PRO pill
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      trackEvent('discover_view');
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      myUserIdRef.current = user.id;
      await Promise.all([fetchFeed(), fetchAgentMatchCount(user.id)]);
    } catch (err) {
      captureError(err, { context: 'discover_init' });
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeed = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-discover-feed', {
        body: {},
      });
      if (error || !data) {
        setProfiles([]);
        return;
      }
      setProfiles(data.profiles || []);
    } catch (err) {
      captureError(err, { context: 'fetch_discover_feed' });
      setProfiles([]);
    }
  };

  const fetchAgentMatchCount = async (userId: string) => {
    try {
      const { data: agentMatches } = await supabase
        .from('matches')
        .select('id')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .not('conversation_id', 'is', null);
      const matchIds = (agentMatches || []).map((m) => m.id);
      if (matchIds.length === 0) {
        setAgentMatchCount(0);
        return;
      }
      const { data: messages } = await supabase
        .from('human_messages')
        .select('match_id')
        .in('match_id', matchIds);
      const chattedSet = new Set((messages || []).map((m) => m.match_id));
      setAgentMatchCount(matchIds.filter((id) => !chattedSet.has(id)).length);
    } catch (err) {
      captureError(err, { context: 'agent_match_count' });
    }
  };

  const callProcessLike = async (
    likedId: string,
    action: 'like' | 'super_like' | 'pass',
    comment?: string,
    targetPromptKey?: string | null
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('process-like', {
        body: { liked_id: likedId, action, comment, target_prompt_key: targetPromptKey || null },
      });

      if (error) {
        captureError(error, { context: 'process_like_call', action, liked_id: likedId });
        return;
      }
      if (!data || data.ok === false) {
        if (data?.error === 'daily_like_limit_reached' || data?.error === 'daily_super_like_limit_reached') {
          trackEvent('discover_limit_reached', { type: action });
          Alert.alert(t('discover.limitReached'), t('discover.limitReachedSub'));
        }
        return;
      }

      if (typeof data.remaining_likes === 'number') setRemainingLikes(data.remaining_likes);
      if (typeof data.remaining_super_likes === 'number') setRemainingSuperLikes(data.remaining_super_likes);

      if (data.matched && data.match_id) {
        trackEvent('discover_match_created', { match_id: data.match_id, action });
        const profile = profiles.find((p) => p.id === likedId);
        if (profile) {
          navigation.navigate('MatchReveal', {
            match: {
              id: data.match_id,
              other_user: profile,
              agent_a_score: 0,
              agent_b_score: 0,
              agent_a_reasoning: '',
              compatibility_breakdown: null,
            },
          });
        }
      }
    } catch (err) {
      captureError(err, { context: 'process_like', action });
    }
  };

  const handleSwipeLeft = (profile: DiscoverProfile) => {
    trackEvent('discover_swipe_left', { liked_id: profile.id });
    callProcessLike(profile.id, 'pass');
  };
  const handleSwipeRight = (profile: DiscoverProfile) => {
    trackEvent('discover_swipe_right', { liked_id: profile.id });
    callProcessLike(profile.id, 'like');
  };
  const handleSwipeUp = (profile: DiscoverProfile) => {
    trackEvent('discover_swipe_up', { liked_id: profile.id });
    navigation.navigate('ProfileDetail', { userId: profile.id, matchId: '' });
  };

  const openSuperLike = () => {
    if (profiles.length === 0) return;
    setSuperLikeProfile(profiles[0]);
    setShowSuperLikeModal(true);
  };

  const submitSuperLike = (comment: string, targetPromptKey: string | null) => {
    if (!superLikeProfile) return;
    trackEvent('discover_super_like', { liked_id: superLikeProfile.id });
    callProcessLike(superLikeProfile.id, 'super_like', comment, targetPromptKey);
    setShowSuperLikeModal(false);
    setSuperLikeProfile(null);
    setProfiles((prev) => prev.filter((p) => p.id !== superLikeProfile.id));
  };

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {/* Brand title */}
            <Text style={[s.brandTitle, { color: colors.accentGold }]}>Avant</Text>

            {/* Agent Match PRO pill */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AgentMatches')}
            >
              <LinearGradient
                colors={['rgba(124,58,237,0.25)', 'rgba(160,100,255,0.15)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.agentPill, { borderColor: colors.accentPurple }]}
              >
                <Animated.View style={[s.pulsingDot, { opacity: pulseAnim, backgroundColor: colors.accentPurple }]} />
                <Text style={[s.agentPillText, { color: colors.accentPurple }]}>
                  {agent?.name ? `${agent.name} Match` : 'Agent Match'}
                </Text>
                <View style={[s.proBadge, { backgroundColor: colors.accentPurple }]}>
                  <Text style={s.proBadgeText}>PRO</Text>
                </View>
                {agentMatchCount > 0 && (
                  <View style={s.agentCountBadge}>
                    <Text style={s.agentCountText}>{agentMatchCount}</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Filter icon */}
          <TouchableOpacity
            style={[s.filterBtn, { borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Filters', 'Filter screen coming soon')}
          >
            <Ionicons name="options-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* ── CONTENT ── */}
        {loading ? (
          <View style={s.centerWrap}>
            <ActivityIndicator color={colors.accentGold} size="large" />
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
              <Text style={{ color: colors.accentGold, fontSize: 15, fontWeight: '700' }}>
                {t('common.retry')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : profiles.length === 0 ? (
          <View style={s.centerWrap}>
            <Text style={s.emptyEmoji}>🎉</Text>
            <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>{t('discover.emptyTitle')}</Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>{t('discover.emptySub')}</Text>
          </View>
        ) : (
          <>
            <View style={s.deckWrap}>
              <SwipeDeck<DiscoverProfile>
                data={profiles}
                keyExtractor={(p) => p.id}
                renderCard={(p) => <DiscoverProfileCard profile={p} />}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onSwipeUp={handleSwipeUp}
                onEmpty={() => trackEvent('discover_empty')}
              />
            </View>

            {/* ── ACTION BUTTONS ROW (4 circles) ── */}
            <View style={s.actionsRow}>
              {/* Pass */}
              <TouchableOpacity
                style={s.passBtn}
                onPress={() => profiles[0] && handleSwipeLeft(profiles[0])}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={28} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>

              {/* Super-like */}
              <TouchableOpacity
                style={s.superLikeBtn}
                onPress={openSuperLike}
                activeOpacity={0.85}
              >
                <Ionicons name="star-outline" size={24} color="rgba(100,160,255,0.9)" />
              </TouchableOpacity>

              {/* Like (gold gradient) */}
              <TouchableOpacity
                style={s.likeBtnWrap}
                onPress={() => profiles[0] && handleSwipeRight(profiles[0])}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={colors.goldGradient as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.likeGrad}
                >
                  <Ionicons name="heart" size={28} color="#1a1a1a" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Boost */}
              <TouchableOpacity
                style={s.boostBtn}
                onPress={() => Alert.alert('Boost', 'Boost coming soon')}
                activeOpacity={0.85}
              >
                <Ionicons name="rocket-outline" size={22} color="rgba(160,100,255,0.9)" />
              </TouchableOpacity>
            </View>
          </>
        )}

        <SuperLikeModal
          profile={superLikeProfile}
          visible={showSuperLikeModal}
          onClose={() => {
            setShowSuperLikeModal(false);
            setSuperLikeProfile(null);
          }}
          onSubmit={submitSuperLike}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandTitle: {
    fontSize: 22,
    fontFamily: FONT_HEADING,
    letterSpacing: 0.3,
  },

  /* Agent Match PRO pill */
  agentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  agentPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  proBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  proBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.6,
  },
  agentCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E8B86D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  agentCountText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
  },

  /* Filter button */
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  /* ── Deck ── */
  deckWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },

  /* ── Action buttons row ── */
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 16,
    marginBottom: 90,
  },
  passBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  superLikeBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(100,160,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(100,160,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBtnWrap: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#E8B86D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  likeGrad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(160,100,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Center states (loading / error / empty) ── */
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  emptySub: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginTop: 8, lineHeight: 22 },
});
