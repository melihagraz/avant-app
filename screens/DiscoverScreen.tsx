// screens/DiscoverScreen.tsx
// Main Hinge-style discover feed. SwipeDeck of profiles + AgentBanner at top.
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import SwipeDeck from '../components/SwipeDeck';
import DiscoverProfileCard, { DiscoverProfile } from '../components/DiscoverProfileCard';
import AgentBanner from '../components/AgentBanner';
import SuperLikeModal from '../components/SuperLikeModal';

const FREE_LIKES_PER_DAY = 15;

export default function DiscoverScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const [profiles, setProfiles] = useState<DiscoverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [remainingLikes, setRemainingLikes] = useState(FREE_LIKES_PER_DAY);
  const [remainingSuperLikes, setRemainingSuperLikes] = useState(1);
  const [agentMatchCount, setAgentMatchCount] = useState(0);

  const [superLikeProfile, setSuperLikeProfile] = useState<DiscoverProfile | null>(null);
  const [showSuperLikeModal, setShowSuperLikeModal] = useState(false);

  const myUserIdRef = useRef<string>('');
  const myNameRef = useRef<string>('');

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

      const { data: userData } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();
      if (userData) myNameRef.current = userData.name?.[0]?.toUpperCase() || 'M';

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
        captureError(error || new Error('no data'), { context: 'fetch_discover_feed' });
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
      // Count agent matches that haven't been chatted yet
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
        body: {
          liked_id: likedId,
          action,
          comment,
          target_prompt_key: targetPromptKey || null,
        },
      });

      if (error) {
        captureError(error, { context: 'process_like_call', action, liked_id: likedId });
        return;
      }
      if (!data || data.ok === false) {
        if (data?.error === 'daily_like_limit_reached') {
          trackEvent('discover_limit_reached', { type: 'like' });
          Alert.alert(t('discover.limitReached'), t('discover.limitReachedSub'));
        } else if (data?.error === 'daily_super_like_limit_reached') {
          trackEvent('discover_limit_reached', { type: 'super_like' });
          Alert.alert(t('discover.limitReached'), t('discover.limitReachedSub'));
        }
        return;
      }

      // Update counters
      if (typeof data.remaining_likes === 'number') setRemainingLikes(data.remaining_likes);
      if (typeof data.remaining_super_likes === 'number') setRemainingSuperLikes(data.remaining_super_likes);

      // Mutual match → reveal modal
      if (data.matched && data.match_id) {
        trackEvent('discover_match_created', { match_id: data.match_id, action });
        // Build a synthetic match object for MatchReveal
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
    const current = profiles[0];
    setSuperLikeProfile(current);
    setShowSuperLikeModal(true);
  };

  const submitSuperLike = (comment: string, targetPromptKey: string | null) => {
    if (!superLikeProfile) return;
    trackEvent('discover_super_like', { liked_id: superLikeProfile.id });
    callProcessLike(superLikeProfile.id, 'super_like', comment, targetPromptKey);
    setShowSuperLikeModal(false);
    setSuperLikeProfile(null);
    // Remove the profile from the deck
    setProfiles((prev) => prev.filter((p) => p.id !== superLikeProfile.id));
  };

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.container}>
      <SafeAreaView style={s.safeArea}>
        {/* Header */}
        <View style={s.header}>
          <Text style={[s.logo, { color: colors.textPrimary }]}>
            av<Text style={{ color: colors.accentPink }}>a</Text>nt
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={s.avatarBtn}>
            <LinearGradient colors={colors.accentGradientAlt as any} style={s.avatarGrad}>
              <Text style={s.avatarTxt}>{myNameRef.current || 'M'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Agent Banner */}
        <AgentBanner
          agentMatchCount={agentMatchCount}
          onPress={() => {
            trackEvent('discover_agent_banner_tap');
            navigation.navigate('AgentMatches');
          }}
        />

        {/* Like counter */}
        {!loading && profiles.length > 0 && (
          <View style={s.countersRow}>
            <View style={[s.counterPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="heart" size={14} color={colors.accentPink} />
              <Text style={[s.counterText, { color: colors.textPrimary }]}>
                {remainingLikes}
              </Text>
            </View>
            <View style={[s.counterPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={s.starEmoji}>✨</Text>
              <Text style={[s.counterText, { color: colors.textPrimary }]}>
                {remainingSuperLikes}
              </Text>
            </View>
          </View>
        )}

        {/* Main content */}
        {loading ? (
          <View style={s.centerWrap}>
            <ActivityIndicator color={colors.accentPink} size="large" />
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

            {/* Action buttons */}
            <View style={s.actionsRow}>
              <TouchableOpacity
                style={[s.actionBtn, s.passBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => profiles[0] && handleSwipeLeft(profiles[0])}
              >
                <Ionicons name="close" size={28} color={colors.error} />
              </TouchableOpacity>

              <TouchableOpacity style={s.superLikeBtn} onPress={openSuperLike}>
                <LinearGradient
                  colors={['#818CF8', '#C084FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.superLikeGrad}
                >
                  <Text style={s.superLikeEmoji}>✨</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.actionBtn, s.likeBtn]}
                onPress={() => profiles[0] && handleSwipeRight(profiles[0])}
              >
                <LinearGradient
                  colors={colors.accentGradientAlt as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.likeGrad}
                >
                  <Ionicons name="heart" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Floating tab bar */}
        <View style={[s.tabBarWrap, { backgroundColor: isDark ? 'rgba(10,11,26,0.85)' : 'rgba(255,255,255,0.85)' }]}>
          <BlurView intensity={isDark ? 80 : 60} tint={isDark ? 'dark' : 'light'} style={s.tabBarBlur}>
            <View style={[s.tabBarInner, { borderColor: colors.border }]}>
              <TouchableOpacity style={s.tab} activeOpacity={0.7}>
                <Ionicons name="compass" size={22} color={colors.accentPink} />
                <Text style={[s.tabLbl, { color: colors.accentPink }]}>{t('discover.title')}</Text>
                <View style={[s.tabDot, { backgroundColor: colors.accentPink }]} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.tab}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Home', { initialTab: 'messages' })}
              >
                <Ionicons name="chatbubble-outline" size={22} color={colors.tabInactive} />
                <Text style={[s.tabLbl, { color: colors.tabInactive }]}>{t('home.tabMessages')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.tab}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Profile')}
              >
                <Ionicons name="person-outline" size={22} color={colors.tabInactive} />
                <Text style={[s.tabLbl, { color: colors.tabInactive }]}>{t('home.tabProfile')}</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>

        {/* Super like modal */}
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
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  logo: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  avatarBtn: { borderRadius: 22, overflow: 'hidden' },
  avatarGrad: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 17, fontWeight: '800', color: '#fff' },

  countersRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  counterText: { fontSize: 13, fontWeight: '700' },
  starEmoji: { fontSize: 14 },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  emptySub: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginTop: 8, lineHeight: 22 },

  deckWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 18,
    marginBottom: 110,
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passBtn: {
    borderWidth: 2,
  },
  likeBtn: {
    overflow: 'hidden',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  likeGrad: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  superLikeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  superLikeGrad: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  superLikeEmoji: { fontSize: 24 },

  // Floating glassmorphism tab bar (same as HomeScreen)
  tabBarWrap: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  tabBarBlur: { borderRadius: 32, overflow: 'hidden' },
  tabBarInner: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 32,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    paddingVertical: 4,
  },
  tabLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  tabDot: { position: 'absolute', bottom: -8, width: 4, height: 4, borderRadius: 2 },
});
