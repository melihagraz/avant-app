// screens/ExploreScreen.tsx
// "Who liked you" + "Visited you" explore tab. Premium gating with blurred locked cards.
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = (SCREEN_WIDTH - 52) / 2;

interface LikedByUser {
  id: string;
  name: string;
  age: number;
  city: string;
  photos: string[];
  liked_at: string;
}

export default function ExploreScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const [tab, setTab] = useState<'forYou' | 'history'>('forYou');
  const [likers, setLikers] = useState<LikedByUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const myIdRef = useRef<string>('');

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      trackEvent('explore_view');
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      myIdRef.current = user.id;

      const [profileRes, likersRes] = await Promise.all([
        supabase.from('users').select('is_premium').eq('id', user.id).single(),
        supabase
          .from('user_likes')
          .select('liker_id, created_at')
          .eq('liked_id', user.id)
          .in('action', ['like', 'super_like'])
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      setIsPremium(!!profileRes.data?.is_premium);

      if (likersRes.data && likersRes.data.length > 0) {
        const likerIds = likersRes.data.map((l) => l.liker_id);
        const { data: users } = await supabase
          .from('users')
          .select('id, name, age, city, photos')
          .in('id', likerIds);

        const usersMap = new Map((users || []).map((u) => [u.id, u]));
        const merged: LikedByUser[] = likersRes.data
          .map((l) => {
            const u = usersMap.get(l.liker_id);
            if (!u) return null;
            return {
              id: u.id,
              name: u.name,
              age: u.age,
              city: u.city,
              photos: u.photos,
              liked_at: l.created_at,
            };
          })
          .filter(Boolean) as LikedByUser[];
        setLikers(merged);
      }
    } catch (err) {
      captureError(err, { context: 'explore_init' });
    } finally {
      setLoading(false);
    }
  };

  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (86400000));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const onUnlockPremium = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    trackEvent('explore_unlock_premium_tap');
    navigation.navigate('Profile'); // Premium card is in profile
  };

  const onCardTap = (user: LikedByUser) => {
    if (!isPremium) {
      onUnlockPremium();
      return;
    }
    Haptics.selectionAsync();
    navigation.navigate('ProfileDetail', { userId: user.id, matchId: '' });
  };

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.headerIconBtn}>
            <Ionicons name="options-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Explore</Text>
          <View style={{ width: 42 }} />
        </View>

        {/* Top tabs */}
        <View style={s.topTabs}>
          <TouchableOpacity
            style={[s.topTab, tab === 'forYou' && s.topTabActive, tab === 'forYou' && { borderBottomColor: colors.textPrimary }]}
            onPress={() => setTab('forYou')}
          >
            <Text style={[s.topTabText, { color: tab === 'forYou' ? colors.textPrimary : colors.tabInactive }]}>
              For you
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.topTab, tab === 'history' && s.topTabActive, tab === 'history' && { borderBottomColor: colors.textPrimary }]}
            onPress={() => setTab('history')}
          >
            <Text style={[s.topTabText, { color: tab === 'history' ? colors.textPrimary : colors.tabInactive }]}>
              My history
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={s.centerWrap}>
              <ActivityIndicator color={colors.accentPink} size="large" />
            </View>
          ) : likers.length === 0 ? (
            <View style={s.centerWrap}>
              <Text style={s.emptyEmoji}>💫</Text>
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>
                No likes yet
              </Text>
              <Text style={[s.emptySub, { color: colors.textSecondary }]}>
                Keep swiping — your likes will show up here
              </Text>
            </View>
          ) : (
            <>
              {/* "All other likes" section */}
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>
                  All other likes
                </Text>
                <View style={[s.countPill, { backgroundColor: colors.inputBg }]}>
                  <Text style={[s.countPillText, { color: colors.textPrimary }]}>
                    {likers.length}
                  </Text>
                </View>
              </View>

              {/* Grid of blurred liker cards */}
              <View style={s.grid}>
                {likers.slice(0, 6).map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[s.gridCard, { backgroundColor: colors.card }]}
                    onPress={() => onCardTap(user)}
                    activeOpacity={0.85}
                  >
                    {/* Photo */}
                    {user.photos?.[0] ? (
                      <Image source={{ uri: user.photos[0] }} style={s.gridPhoto} />
                    ) : (
                      <LinearGradient colors={colors.accentGradient as any} style={s.gridPhoto} />
                    )}

                    {/* Blur overlay (if not premium) */}
                    {!isPremium && (
                      <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFillObject}>
                        <View style={s.lockWrap}>
                          <View style={s.lockCircle}>
                            <Ionicons name="lock-closed" size={22} color="#fff" />
                          </View>
                        </View>
                      </BlurView>
                    )}

                    {/* "Liked you" badge */}
                    <View style={s.likedBadge}>
                      <Text style={s.likedBadgeText}>Liked you</Text>
                    </View>

                    {/* Name + location info at bottom */}
                    <View style={s.gridInfo}>
                      <Text style={s.gridName} numberOfLines={1}>
                        {isPremium ? user.name : '•••••'}{' '}
                        <Text style={s.gridAge}>{user.age}</Text>
                      </Text>
                      {user.city ? (
                        <View style={s.gridLocPill}>
                          <Ionicons name="location" size={10} color="#fff" />
                          <Text style={s.gridLocText} numberOfLines={1}>
                            {isPremium ? user.city : 'Hidden'}
                          </Text>
                        </View>
                      ) : null}
                      <Text style={s.gridTime}>{timeAgo(user.liked_at)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* "Visited You" teaser section */}
              <View style={[s.visitedSection, { marginTop: 24 }]}>
                <Text style={[s.visitedTitle, { color: colors.textPrimary }]}>
                  Visited You
                </Text>
                <Text style={[s.visitedSub, { color: colors.textSecondary }]}>
                  See who's interested, they might be your perfect match.
                </Text>
              </View>

              {/* Gold CTA */}
              {!isPremium && (
                <TouchableOpacity
                  style={s.goldCtaWrap}
                  onPress={onUnlockPremium}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#D4A017', '#B8860B', '#8B6914']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.goldCta}
                  >
                    <Text style={s.goldCtaText}>See who likes you</Text>
                    <Ionicons name="star" size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <View style={{ height: 120 }} />
            </>
          )}
        </ScrollView>
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
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  topTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  topTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  topTabActive: {},
  topTabText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },

  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  emptySub: { fontSize: 15, fontWeight: '500', marginTop: 8, textAlign: 'center' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  countPill: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: {
    fontSize: 14,
    fontWeight: '800',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: CARD_W,
    aspectRatio: 0.78,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  gridPhoto: {
    width: '100%',
    height: '100%',
  },
  lockWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  likedBadge: {
    position: 'absolute',
    top: 14,
    left: '50%',
    marginLeft: -38,
    backgroundColor: '#E8B86D',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    shadowColor: '#E8B86D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  likedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  gridInfo: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: 6,
  },
  gridName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  gridAge: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  gridLocPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignSelf: 'flex-start',
  },
  gridLocText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    maxWidth: 80,
  },
  gridTime: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },

  visitedSection: {
    gap: 6,
  },
  visitedTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  visitedSub: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },

  goldCtaWrap: {
    marginTop: 28,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#D4A017',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  goldCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 32,
  },
  goldCtaText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
