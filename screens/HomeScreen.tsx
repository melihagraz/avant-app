// screens/HomeScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Animated, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

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

const PHOTO_COLORS = [
  { bg: '#FFE0EB', text: '#FF6B9D' },
  { bg: '#E8DEFF', text: '#7C3AED' },
  { bg: '#D6F5E8', text: '#10B981' },
  { bg: '#FFE4D6', text: '#F97316' },
  { bg: '#DBEAFE', text: '#3B82F6' },
];

export default function HomeScreen({ navigation }: any) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [myUserId, setMyUserId] = useState('');
  const [myName, setMyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<'matches' | 'messages' | 'profile'>('matches');
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    startPulse();
    init();
    return () => {
      // Subscription cleanup
      unsubscribeRef.current?.();
      // Pulse animation cleanup
      pulseAnimRef.current?.stop();
    };
  }, []);

  const init = async () => {
    try {
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
    } catch (err) {
      console.error('fetchMatches error:', err);
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
    const color = PHOTO_COLORS[idx % PHOTO_COLORS.length];
    const hasPhoto = match.other_user?.photos?.length > 0;

    return (
      <View key={match.id} style={s.card}>
        <View style={s.photoWrap}>
          {hasPhoto ? (
            <Image source={{ uri: match.other_user.photos[0] }} style={s.photo} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#FF6B9D', '#C084FC', '#818CF8']} style={s.photoPlaceholder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
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
            <LinearGradient colors={['#FF6B9D', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.scoreBadgeInner}>
              <Text style={s.scoreNum}>{score}</Text>
              <Text style={s.scoreLbl}>uyum</Text>
            </LinearGradient>
          </View>
        </View>

        <View style={s.cardBody}>
          {match.agent_a_reasoning ? (
            <View style={s.reasonCard}>
              <Text style={s.reasonTxt} numberOfLines={2}>
                <Text style={s.reasonLabel}>🤖 Agentın: </Text>
                "{match.agent_a_reasoning}"
              </Text>
            </View>
          ) : null}
          <View style={s.actions}>
            <TouchableOpacity style={s.btnPass} onPress={() => setDismissed(prev => [...prev, match.id])}>
              <Text style={s.btnPassTxt}>Geç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnChat}
              onPress={() => {
                navigation.navigate('HumanChat', { matchId: match.id, otherUser: match.other_user });
                setActiveTab('messages');
              }}
            >
              <LinearGradient colors={['#FF6B9D', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnChatGrad}>
                <Text style={s.btnChatTxt}>Konuşmayı başlat 💬</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderChatRow = (match: Match, idx: number) => {
    const color = PHOTO_COLORS[idx % PHOTO_COLORS.length];
    const hasPhoto = match.other_user?.photos?.length > 0;

    return (
      <TouchableOpacity
        key={match.id}
        style={s.chatRow}
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
          <Text style={s.chatName}>{match.other_user?.name}</Text>
          <Text style={s.chatLastMsg} numberOfLines={1}>
            {match.last_message || 'Agentların eşleşti — ilk mesajı sen gönder'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#D4C8E0" />
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#FFF8FA', '#F8F5FF', '#F5FAFF']} style={s.container} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <Text style={s.logo}>av<Text style={s.logoAccent}>a</Text>nt</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={s.avatarBtn}>
            <LinearGradient colors={['#FF6B9D', '#C084FC']} style={s.avatarGrad}>
              <Text style={s.avatarTxt}>{myName || 'M'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {activeTab === 'matches' && (
            <>
              <View style={s.pillRow}>
                <View style={s.pill}>
                  <View style={s.pillDotWrap}>
                    <Animated.View style={[s.pillDotRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
                    <View style={s.pillDot} />
                  </View>
                  <Text style={s.pillTxt}>Agentın aktif</Text>
                  {newMatches.length > 0 && (
                    <View style={s.pillBadge}>
                      <Text style={s.pillBadgeTxt}>{newMatches.length} yeni 🎉</Text>
                    </View>
                  )}
                </View>
              </View>

              {loading ? (
                <View style={s.emptyState}>
                  <Text style={s.emptySub}>Yükleniyor...</Text>
                </View>
              ) : error ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyTitle}>Bir hata oluştu</Text>
                  <Text style={s.emptySub}>Veriler yüklenemedi. Tekrar dene.</Text>
                  <TouchableOpacity onPress={() => { setError(false); setLoading(true); init(); }}>
                    <Text style={{ color: '#FF6B9D', marginTop: 10, fontSize: 15, fontWeight: '700' }}>Tekrar dene</Text>
                  </TouchableOpacity>
                </View>
              ) : newMatches.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyEmoji}>🤖</Text>
                  <Text style={s.emptyTitle}>Agentın çalışıyor</Text>
                  <Text style={s.emptySub}>İlk eşleşmen yakında gelecek ✨</Text>
                </View>
              ) : (
                newMatches.map((m, i) => renderMatchCard(m, i))
              )}
            </>
          )}

          {activeTab === 'messages' && (
            <>
              <View style={s.sectionHdr}>
                <Text style={s.sectionTitle}>Mesajlar 💬</Text>
              </View>
              {activeChats.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyEmoji}>✉️</Text>
                  <Text style={s.emptyTitle}>Henüz mesaj yok</Text>
                  <Text style={s.emptySub}>Eşleşmeler sekmesinden konuşma başlat.</Text>
                </View>
              ) : (
                <View style={s.chatList}>
                  {activeChats.map((m, i) => renderChatRow(m, i))}
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={s.tabBar}>
          {([
            { key: 'matches', label: 'Eşleşmeler', icon: 'heart' as const, iconOutline: 'heart-outline' as const, badge: newMatches.length },
            { key: 'messages', label: 'Mesajlar', icon: 'chatbubble' as const, iconOutline: 'chatbubble-outline' as const, badge: activeChats.length },
            { key: 'profile', label: 'Profil', icon: 'person' as const, iconOutline: 'person-outline' as const, badge: 0 },
          ]).map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={s.tab}
                onPress={() => {
                  if (tab.key === 'profile') {
                    setActiveTab('profile');
                    navigation.navigate('Profile');
                  } else {
                    setActiveTab(tab.key as any);
                  }
                }}
              >
                <View style={s.tabIconWrap}>
                  <Ionicons
                    name={isActive ? tab.icon : tab.iconOutline}
                    size={24}
                    color={isActive ? '#FF6B9D' : '#C4B5D0'}
                  />
                  {tab.badge > 0 && (
                    <View style={s.tabBadge}>
                      <Text style={s.tabBadgeTxt}>{tab.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.tabLbl, isActive && s.tabLblActive]}>{tab.label}</Text>
                {isActive && <View style={s.tabLine} />}
              </TouchableOpacity>
            );
          })}
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
  scroll: { paddingBottom: 100 },
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
  card: { marginHorizontal: 18, marginTop: 14, borderRadius: 26, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#C084FC', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 6 },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 420 },
  photoPlaceholder: { width: '100%', height: 420, alignItems: 'center', justifyContent: 'center', gap: 8 },
  silhouetteCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  photoName: { fontSize: 22, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, justifyContent: 'flex-end', paddingHorizontal: 22, paddingBottom: 22 },
  gradientContent: { gap: 4 },
  cardName: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  cardAge: { fontSize: 24, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  cardCity: { fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  scoreBadge: { position: 'absolute', top: 16, right: 16, borderRadius: 20, overflow: 'hidden' },
  scoreBadgeInner: { paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', borderRadius: 20 },
  scoreNum: { fontSize: 22, fontWeight: '900', color: '#fff' },
  scoreLbl: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '700', marginTop: -2 },
  cardBody: { padding: 18, gap: 14 },
  reasonCard: { backgroundColor: '#F8F5FC', borderRadius: 16, padding: 14 },
  reasonTxt: { fontSize: 14, color: '#8B7AA0', lineHeight: 21 },
  reasonLabel: { color: '#7C3AED', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12 },
  btnPass: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 2, borderColor: '#F0EBF7', alignItems: 'center', backgroundColor: '#fff' },
  btnPassTxt: { fontSize: 15, color: '#9B8AB8', fontWeight: '700' },
  btnChat: { flex: 2.5, borderRadius: 20, overflow: 'hidden' },
  btnChatGrad: { padding: 16, borderRadius: 20, alignItems: 'center' },
  btnChatTxt: { fontSize: 15, color: '#fff', fontWeight: '800' },
  chatList: { paddingHorizontal: 18, gap: 8 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14, borderRadius: 22, backgroundColor: '#fff', shadowColor: '#C084FC', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  chatAvatar: { width: 56, height: 56, borderRadius: 28 },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 17, fontWeight: '800', color: '#2D1B4E' },
  chatLastMsg: { fontSize: 14, color: '#9B8AB8', marginTop: 3 },
  emptyState: { margin: 18, marginTop: 24, backgroundColor: '#fff', borderRadius: 28, padding: 48, alignItems: 'center', gap: 10, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#2D1B4E' },
  emptySub: { fontSize: 15, color: '#9B8AB8', textAlign: 'center', lineHeight: 22 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F5F0FA', paddingTop: 4 },
  tab: { flex: 1, paddingVertical: 8, paddingBottom: 14, alignItems: 'center', gap: 3, position: 'relative' },
  tabIconWrap: { position: 'relative' },
  tabLbl: { fontSize: 11, color: '#C4B5D0', fontWeight: '600' },
  tabLblActive: { color: '#FF6B9D', fontWeight: '700' },
  tabLine: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 3, backgroundColor: '#FF6B9D', borderRadius: 2 },
  tabBadge: { position: 'absolute', top: -4, right: -10, backgroundColor: '#FF6B9D', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  tabBadgeTxt: { fontSize: 10, color: '#fff', fontWeight: '800' },
});
