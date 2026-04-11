// screens/HomeScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Animated, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { useTranslation } from 'react-i18next';
import { cacheMatches, getCachedMatches, useOnlineStatus } from '../lib/offline';

interface Match {
  id: string;
  created_at: string;
  other_user: { id: string; name: string; age: number; city: string; photos: string[] };
  agent_a_score: number;
  agent_b_score: number;
  agent_a_reasoning: string;
  has_messages: boolean;
  last_message?: string;
  last_message_at?: string;
}

export default function HomeScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const [matches, setMatches] = useState<Match[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [myUserId, setMyUserId] = useState('');
  const [myName, setMyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<'matches' | 'messages' | 'profile'>('matches');
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const robotPulseAnim = useRef(new Animated.Value(0)).current;
  const breathAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const activityFadeAnim = useRef(new Animated.Value(1)).current;
  const [activityIndex, setActivityIndex] = useState(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const robotAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const breathAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const activityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startPulse();
    startRobotPulse();
    startBreathing();
    startGlow();
    startActivityRotation();
    init();
    return () => {
      unsubscribeRef.current?.();
      pulseAnimRef.current?.stop();
      robotAnimRef.current?.stop();
      breathAnimRef.current?.stop();
      glowAnimRef.current?.stop();
      if (activityIntervalRef.current) clearInterval(activityIntervalRef.current);
    };
  }, []);

  const init = async () => {
    try {
      trackEvent('app_home_load');
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { setLoading(false); return; }
      setMyUserId(user.id);

      const { data: userData } = await supabase
        .from('users').select('name').eq('id', user.id).single();
      if (userData) setMyName(userData.name?.[0]?.toUpperCase() || 'M');

      await fetchMatches(user.id);
      // Önceki subscription'ı temizle
      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeToMatches(user.id);
    } catch (err) {
      console.error('init error:', err);
      captureError(err, { context: 'home_init' });
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const startPulse = () => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulseAnimRef.current = animation;
    animation.start();
  };

  const startRobotPulse = () => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(robotPulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(robotPulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );
    robotAnimRef.current = animation;
    animation.start();
  };

  const startBreathing = () => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    breathAnimRef.current = animation;
    animation.start();
  };

  const startGlow = () => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 3200, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 3200, useNativeDriver: false }),
      ])
    );
    glowAnimRef.current = animation;
    animation.start();
  };

  const startActivityRotation = () => {
    activityIntervalRef.current = setInterval(() => {
      Animated.sequence([
        Animated.timing(activityFadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(activityFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setActivityIndex(i => (i + 1) % 8), 300);
    }, 2800);
  };

  const fetchMatches = async (userId: string) => {
    try {
      // Tek query ile tüm match verilerini join ederek çek (N+1 sorunu çözüldü)
      const { data: matchData, error } = await supabase
        .from('matches')
        .select(`
          id, created_at, user_a_id, user_b_id,
          conversation:conversation_id(agent_a_score, agent_b_score, agent_a_reasoning)
        `)
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error || !matchData?.length) { setMatches([]); return; }

      // Diğer kullanıcıların ID'lerini topla
      const otherUserIds = matchData.map(m => m.user_a_id === userId ? m.user_b_id : m.user_a_id);
      const matchIds = matchData.map(m => m.id);

      // Paralel: kullanıcı bilgileri + son mesajlar
      const [usersResult, messagesResult] = await Promise.all([
        supabase.from('users').select('id, name, age, city, photos').in('id', otherUserIds),
        supabase.from('human_messages').select('match_id, content, created_at')
          .in('match_id', matchIds).order('created_at', { ascending: false }),
      ]);

      const usersMap = new Map((usersResult.data || []).map(u => [u.id, u]));

      // Her match için son mesajı bul
      const lastMessageMap = new Map<string, { content: string; created_at: string }>();
      for (const msg of (messagesResult.data || [])) {
        if (!lastMessageMap.has(msg.match_id)) {
          lastMessageMap.set(msg.match_id, msg);
        }
      }

      const formatted: Match[] = matchData.map(m => {
        const otherUserId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
        const otherUser = usersMap.get(otherUserId) || { id: otherUserId, name: 'Kullanıcı', age: 0, city: '', photos: [] };
        const conv = m.conversation as any;
        const lastMsg = lastMessageMap.get(m.id);

        return {
          id: m.id,
          created_at: m.created_at,
          other_user: otherUser,
          agent_a_score: conv?.agent_a_score || 0,
          agent_b_score: conv?.agent_b_score || 0,
          agent_a_reasoning: conv?.agent_a_reasoning || '',
          has_messages: !!lastMsg,
          last_message: lastMsg?.content,
          last_message_at: lastMsg?.created_at,
        };
      });

      setMatches(formatted);
      cacheMatches(userId, formatted);
    } catch (err) {
      captureError(err, { context: 'fetch_matches' });
      // Offline fallback
      const cached = await getCachedMatches(userId);
      if (cached.length > 0) setMatches(cached);
    }
  };

  const subscribeToMatches = (userId: string) => {
    const channel = supabase.channel('new-matches')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, () => {
        fetchMatches(userId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'human_messages' }, () => {
        fetchMatches(userId);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  const avgScore = (m: Match) => Math.round((m.agent_a_score + m.agent_b_score) / 2);

  const newMatches = matches.filter(m => !m.has_messages && !dismissed.includes(m.id));
  const activeChats = matches.filter(m => m.has_messages);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  const renderMatchCard = (match: Match, idx: number) => {
    const score = avgScore(match);
    const color = colors.photoPlaceholders[idx % colors.photoPlaceholders.length];
    const hasPhoto = match.other_user?.photos?.length > 0;

    return (
      <View key={match.id} style={[s.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
        <View style={s.photoWrap}>
          {hasPhoto ? (
            <Image source={{ uri: match.other_user.photos[0] }} style={s.photo} resizeMode="cover" />
          ) : (
            <LinearGradient colors={colors.accentGradient as any} style={s.photoPlaceholder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={s.silhouetteCircle}>
                <Ionicons name="person" size={64} color="rgba(255,255,255,0.5)" />
              </View>
              <Text style={s.photoName}>{match.other_user?.name?.[0] || '?'}</Text>
            </LinearGradient>
          )}
          <LinearGradient colors={['transparent', 'rgba(45,27,78,0.85)']} style={s.cardGradient}>
            <View style={s.gradientContent}>
              <Text style={s.cardName}>
                {match.other_user?.name}
                <Text style={s.cardAge}>, {match.other_user?.age || '?'}</Text>
              </Text>
              {match.other_user?.city ? <Text style={s.cardCity}>{match.other_user.city}</Text> : null}
            </View>
          </LinearGradient>
          <View style={s.scoreBadge}>
            <LinearGradient colors={colors.accentGradientAlt as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.scoreBadgeInner}>
              <Text style={s.scoreNum}>{score}</Text>
              <Text style={s.scoreLbl}>{t('home.compatibility')}</Text>
            </LinearGradient>
          </View>
        </View>

        <View style={s.cardBody}>
          {match.agent_a_reasoning ? (
            <View style={[s.reasonCard, { backgroundColor: colors.inputBg }]}>
              <Text style={[s.reasonTxt, { color: colors.textMuted }]} numberOfLines={2}>
                <Text style={[s.reasonLabel, { color: colors.userBubble }]}>{t('home.agentSays')}</Text>
                "{match.agent_a_reasoning}"
              </Text>
            </View>
          ) : null}
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.btnPass, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => {
                trackEvent('match_dismiss', { match_id: match.id });
                setDismissed(prev => [...prev, match.id]);
              }}
            >
              <Text style={[s.btnPassTxt, { color: colors.textSecondary }]}>{t('home.pass')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnChat}
              onPress={() => {
                trackEvent('chat_start', { match_id: match.id });
                navigation.navigate('HumanChat', { matchId: match.id, otherUser: match.other_user });
                setActiveTab('messages');
              }}
            >
              <LinearGradient colors={colors.accentGradientAlt as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnChatGrad}>
                <Text style={s.btnChatTxt}>{t('home.startChat')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderChatRow = (match: Match, idx: number) => {
    const color = colors.photoPlaceholders[idx % colors.photoPlaceholders.length];
    const hasPhoto = match.other_user?.photos?.length > 0;

    return (
      <TouchableOpacity
        key={match.id}
        style={[s.chatRow, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
        onPress={() => navigation.navigate('HumanChat', { matchId: match.id, otherUser: match.other_user })}
        activeOpacity={0.7}
      >
        {hasPhoto ? (
          <Image source={{ uri: match.other_user.photos[0] }} style={s.chatAvatar} />
        ) : (
          <View style={[s.chatAvatar, { backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: color.text }}>
              {match.other_user?.name?.[0] || '?'}
            </Text>
          </View>
        )}
        <View style={s.chatInfo}>
          <Text style={[s.chatName, { color: colors.textPrimary }]}>{match.other_user?.name}</Text>
          <Text style={[s.chatLastMsg, { color: colors.textSecondary }]} numberOfLines={1}>
            {match.last_message || t('home.defaultChatHint')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.container} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <Text style={[s.logo, { color: colors.textPrimary }]}>av<Text style={[s.logoAccent, { color: colors.accentPink }]}>a</Text>nt</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={s.avatarBtn}>
            <LinearGradient colors={colors.accentGradientAlt as any} style={s.avatarGrad}>
              <Text style={s.avatarTxt}>{myName || 'M'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {activeTab === 'matches' && (
            <>
              <View style={s.pillRow}>
                <View style={[s.pill, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                  <View style={s.pillDotWrap}>
                    <Animated.View style={[s.pillDotRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
                    <View style={s.pillDot} />
                  </View>
                  <Text style={[s.pillTxt, { color: colors.textPrimary }]}>{t('home.agentActive')}</Text>
                  {newMatches.length > 0 && (
                    <View style={s.pillBadge}>
                      <Text style={s.pillBadgeTxt}>{t('home.newCount', { count: newMatches.length })}</Text>
                    </View>
                  )}
                </View>
              </View>

              {loading ? (
                <View style={[s.emptyState, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                  <Text style={[s.emptySub, { color: colors.textSecondary }]}>{t('common.loading')}</Text>
                </View>
              ) : error ? (
                <View style={[s.emptyState, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                  <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>{t('home.errorTitle')}</Text>
                  <Text style={[s.emptySub, { color: colors.textSecondary }]}>{t('home.errorSub')}</Text>
                  <TouchableOpacity onPress={() => { setError(false); setLoading(true); init(); }}>
                    <Text style={{ color: colors.accentPink, marginTop: 10, fontSize: 15, fontWeight: '700' }}>{t('common.retry')}</Text>
                  </TouchableOpacity>
                </View>
              ) : newMatches.length === 0 ? (
                <LinearGradient
                  colors={colors.accentGradient as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.emptyHero}
                >
                  <View style={s.emptyRobotWrap}>
                    <Animated.View
                      style={[
                        s.emptyRing1,
                        {
                          transform: [{
                            scale: robotPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }),
                          }],
                          opacity: robotPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        s.emptyRing2,
                        {
                          transform: [{
                            scale: robotPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }),
                          }],
                          opacity: robotPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] }),
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        s.emptyRobotCircle,
                        {
                          transform: [{
                            scale: breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
                          }],
                          shadowOpacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] }),
                        },
                      ]}
                    >
                      <Text style={s.emptyRobotEmoji}>🤖</Text>
                    </Animated.View>
                  </View>

                  <Text style={s.emptyHeroTitle}>{t('home.emptyTitle')}</Text>

                  <Animated.View style={[s.activityRow, { opacity: activityFadeAnim }]}>
                    <View style={s.activityDot} />
                    <Text style={s.activityText}>{t(`home.activity${activityIndex + 1}`)}</Text>
                  </Animated.View>

                  <View style={s.emptyDivider} />

                  <Text style={s.emptyHeroSub}>{t('home.emptySub')}</Text>
                  <Text style={s.emptyHeroHint}>{t('home.emptyHint')}</Text>
                </LinearGradient>
              ) : (
                newMatches.map((m, i) => renderMatchCard(m, i))
              )}
            </>
          )}

          {activeTab === 'messages' && (
            <>
              <View style={s.sectionHdr}>
                <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>{t('home.messagesTitle')}</Text>
              </View>
              {activeChats.length === 0 ? (
                <View style={[s.emptyState, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                  <Text style={s.emptyEmoji}>✉️</Text>
                  <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>{t('home.noMessages')}</Text>
                  <Text style={[s.emptySub, { color: colors.textSecondary }]}>{t('home.noMessagesSub')}</Text>
                </View>
              ) : (
                <View style={s.chatList}>
                  {activeChats.map((m, i) => renderChatRow(m, i))}
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={s.tabBarWrap}>
          <BlurView
            intensity={isDark ? 80 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={s.tabBarBlur}
          >
            <View style={[s.tabBarInner, { borderColor: colors.border }]}>
              {([
                { key: 'matches', label: t('home.tabMatches'), icon: 'heart' as const, iconOutline: 'heart-outline' as const, badge: newMatches.length },
                { key: 'messages', label: t('home.tabMessages'), icon: 'chatbubble' as const, iconOutline: 'chatbubble-outline' as const, badge: activeChats.length },
                { key: 'profile', label: t('home.tabProfile'), icon: 'person' as const, iconOutline: 'person-outline' as const, badge: 0 },
              ]).map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={s.tab}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (tab.key === 'profile') {
                        setActiveTab('profile');
                        navigation.navigate('Profile');
                      } else {
                        trackEvent('tab_change', { tab: tab.key });
                        setActiveTab(tab.key as any);
                      }
                    }}
                  >
                    <View style={s.tabIconWrap}>
                      <Ionicons
                        name={isActive ? tab.icon : tab.iconOutline}
                        size={22}
                        color={isActive ? colors.accentPink : colors.tabInactive}
                      />
                      {tab.badge > 0 && (
                        <View style={[s.tabBadge, { borderColor: isDark ? '#0A0B1A' : '#ffffff' }]}>
                          <Text style={s.tabBadgeTxt}>{tab.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.tabLbl, { color: isActive ? colors.accentPink : colors.tabInactive }]}>{tab.label}</Text>
                    {isActive && <View style={[s.tabDot, { backgroundColor: colors.accentPink }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14 },
  logo: { fontSize: 28, fontWeight: '800', color: '#2D1B4E', letterSpacing: -1 },
  logoAccent: { color: '#FF6B9D' },
  avatarBtn: { borderRadius: 22, overflow: 'hidden' },
  avatarGrad: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 17, fontWeight: '800', color: '#fff' },
  scroll: { paddingBottom: 140 },
  pillRow: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 28, paddingHorizontal: 16, paddingVertical: 10, gap: 10, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  pillDotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  pillDotRing: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#10B981' },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  pillTxt: { fontSize: 14, color: '#2D1B4E', fontWeight: '700' },
  pillBadge: { backgroundColor: '#FF6B9D', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3 },
  pillBadgeTxt: { fontSize: 12, color: '#fff', fontWeight: '700' },
  sectionHdr: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 12 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: '#2D1B4E', letterSpacing: -0.5 },
  card: {
    marginHorizontal: 20, marginTop: 18, borderRadius: 32, overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#C084FC', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 32, elevation: 10,
  },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 440 },
  photoPlaceholder: { width: '100%', height: 440, alignItems: 'center', justifyContent: 'center', gap: 8 },
  silhouetteCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  photoName: { fontSize: 22, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, justifyContent: 'flex-end', paddingHorizontal: 26, paddingBottom: 26 },
  gradientContent: { gap: 4 },
  cardName: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8 },
  cardAge: { fontSize: 26, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  cardCity: { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  scoreBadge: {
    position: 'absolute', top: 20, right: 20, borderRadius: 28, overflow: 'hidden',
    shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  scoreBadgeInner: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', borderRadius: 28 },
  scoreNum: { fontSize: 24, fontWeight: '900', color: '#fff' },
  scoreLbl: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '700', marginTop: -2, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardBody: { padding: 22, gap: 18 },
  reasonCard: { backgroundColor: '#F8F5FC', borderRadius: 20, padding: 16 },
  reasonTxt: { fontSize: 14, color: '#8B7AA0', lineHeight: 21 },
  reasonLabel: { color: '#7C3AED', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12 },
  btnPass: { flex: 1, paddingVertical: 18, borderRadius: 28, borderWidth: 1.5, borderColor: '#F0EBF7', alignItems: 'center', backgroundColor: '#fff' },
  btnPassTxt: { fontSize: 15, color: '#9B8AB8', fontWeight: '700' },
  btnChat: {
    flex: 2.5, borderRadius: 28, overflow: 'hidden',
    shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  btnChatGrad: { paddingVertical: 18, borderRadius: 28, alignItems: 'center' },
  btnChatTxt: { fontSize: 15, color: '#fff', fontWeight: '800' },
  chatList: { paddingHorizontal: 20, gap: 10 },
  chatRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, gap: 14,
    borderRadius: 28, backgroundColor: '#fff',
    shadowColor: '#C084FC', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 4,
  },
  chatAvatar: { width: 56, height: 56, borderRadius: 28 },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 17, fontWeight: '800', color: '#2D1B4E' },
  chatLastMsg: { fontSize: 14, color: '#9B8AB8', marginTop: 3 },
  emptyState: {
    margin: 20, marginTop: 28, backgroundColor: '#fff', borderRadius: 32, padding: 52,
    alignItems: 'center', gap: 12,
    shadowColor: '#C084FC', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 6,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#2D1B4E' },
  emptySub: { fontSize: 15, color: '#9B8AB8', textAlign: 'center', lineHeight: 22 },
  emptyHero: {
    margin: 20, marginTop: 28, borderRadius: 36, padding: 40, alignItems: 'center',
    shadowColor: '#C084FC', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.35, shadowRadius: 40, elevation: 16,
  },
  emptyRobotWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyRing1: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)' },
  emptyRing2: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  emptyRobotCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#ffffff', shadowOffset: { width: 0, height: 0 }, shadowRadius: 24, elevation: 10,
  },
  emptyRobotEmoji: { fontSize: 52 },
  emptyHeroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 14, textAlign: 'center' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#69F0AE' },
  activityText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  emptyDivider: { width: 60, height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 20 },
  emptyHeroSub: { fontSize: 16, color: 'rgba(255,255,255,0.95)', fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyHeroHint: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontWeight: '500' },
  tabBarWrap: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    borderRadius: 32, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 30, elevation: 20,
  },
  tabBarBlur: { borderRadius: 32, overflow: 'hidden' },
  tabBarInner: {
    flexDirection: 'row',
    paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: 32, borderWidth: 1,
  },
  tab: { flex: 1, alignItems: 'center', gap: 6, position: 'relative', paddingVertical: 4 },
  tabIconWrap: { position: 'relative' },
  tabLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  tabDot: { position: 'absolute', bottom: -8, width: 4, height: 4, borderRadius: 2 },
  tabBadge: { position: 'absolute', top: -5, right: -10, backgroundColor: '#FF6B9D', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  tabBadgeTxt: { fontSize: 10, color: '#fff', fontWeight: '800' },
});
