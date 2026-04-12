// screens/DiscoverScreen.tsx
// Full-screen Muzz-style discover feed with top bar, swipe deck, circular actions, 4-tab bar.
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
  const [boostCredits, setBoostCredits] = useState(1);
  const [agentMatchCount, setAgentMatchCount] = useState(0);

  const [superLikeProfile, setSuperLikeProfile] = useState<DiscoverProfile | null>(null);
  const [showSuperLikeModal, setShowSuperLikeModal] = useState(false);

  const myUserIdRef = useRef<string>('');
  const swipeRef = useRef<{ index: number }>({ index: 0 });

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
        {/* TOP BAR */}
        <View style={s.topBar}>
          <TouchableOpacity style={[s.iconBtn, { borderColor: colors.border }]}>
            <Ionicons name="options-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.sortBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="swap-vertical" size={16} color={colors.textPrimary} />
            <Text style={[s.sortText, { color: colors.textPrimary }]}>Sort</Text>
          </TouchableOpacity>

          <View style={s.topRight}>
            <TouchableOpacity style={s.boostPill} activeOpacity={0.85}>
              <LinearGradient
                colors={['#0F766E', '#0D9488']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.boostGrad}
              >
                <Text style={s.boostNumber}>{boostCredits}</Text>
                <Ionicons name="rocket" size={14} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={[s.iconBtn, { borderColor: colors.border }]}>
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              {agentMatchCount > 0 && <View style={s.notifDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* SWIPE DECK */}
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

            {/* ACTION BUTTONS ROW (3 circles) */}
            <View style={s.actionsRow}>
              {/* PASS button (black/dark circle) */}
              <TouchableOpacity
                style={s.passBtn}
                onPress={() => profiles[0] && handleSwipeLeft(profiles[0])}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>

              {/* SUPER LIKE (purple gradient) */}
              <TouchableOpacity
                style={s.superBtn}
                onPress={openSuperLike}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#818CF8', '#6366F1', '#4F46E5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.superGrad}
                >
                  <Ionicons name="star" size={26} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              {/* LIKE (pink gradient) */}
              <TouchableOpacity
                style={s.likeBtn}
                onPress={() => profiles[0] && handleSwipeRight(profiles[0])}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#FF5E8A', '#FF6B9D', '#F472B6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.likeGrad}
                >
                  <Ionicons name="checkmark" size={30} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* 4-TAB FLOATING BAR */}
        <View style={[s.tabBarWrap, { backgroundColor: isDark ? 'rgba(10,11,26,0.85)' : 'rgba(255,255,255,0.85)' }]}>
          <BlurView intensity={isDark ? 80 : 60} tint={isDark ? 'dark' : 'light'} style={s.tabBarBlur}>
            <View style={[s.tabBarInner, { borderColor: colors.border }]}>
              <TabItem
                icon="heart"
                label="Discover"
                active
                color={colors.accentPink}
                inactiveColor={colors.tabInactive}
                onPress={() => {}}
              />
              <TabItem
                icon="compass"
                label="Explore"
                color={colors.accentPink}
                inactiveColor={colors.tabInactive}
                onPress={() => navigation.navigate('Explore')}
              />
              <TabItem
                icon="chatbubble"
                label="Chat"
                color={colors.accentPink}
                inactiveColor={colors.tabInactive}
                badge={0}
                onPress={() => navigation.navigate('Home', { initialTab: 'messages' })}
              />
              <TabItem
                icon="menu"
                label="Menu"
                color={colors.accentPink}
                inactiveColor={colors.tabInactive}
                onPress={() => navigation.navigate('Profile')}
              />
            </View>
          </BlurView>
        </View>

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

function TabItem({
  icon,
  label,
  active = false,
  color,
  inactiveColor,
  badge = 0,
  onPress,
}: {
  icon: any;
  label: string;
  active?: boolean;
  color: string;
  inactiveColor: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.tab} activeOpacity={0.7} onPress={onPress}>
      <View style={{ position: 'relative' }}>
        <Ionicons name={active ? icon : `${icon}-outline`} size={22} color={active ? color : inactiveColor} />
        {badge > 0 && (
          <View style={s.tabBadge}>
            <Text style={s.tabBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[s.tabLbl, { color: active ? color : inactiveColor }]}>{label}</Text>
      {active && <View style={[s.tabDot, { backgroundColor: color }]} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 14,
    fontWeight: '800',
  },
  topRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  boostPill: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  boostGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  boostNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FF6B9D',
    borderWidth: 2,
    borderColor: '#0A0B1A',
  },

  // Deck wrap
  deckWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },

  // Action buttons row
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingVertical: 18,
    marginBottom: 110,
  },
  passBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  superBtn: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
  superGrad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeBtn: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
  likeGrad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Center states
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  emptySub: { fontSize: 15, fontWeight: '500', textAlign: 'center', marginTop: 8, lineHeight: 22 },

  // Tab bar
  tabBarWrap: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  tabBarBlur: { borderRadius: 32, overflow: 'hidden' },
  tabBarInner: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 32,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    paddingVertical: 4,
  },
  tabLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  tabDot: { position: 'absolute', bottom: -6, width: 4, height: 4, borderRadius: 2 },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },
});
