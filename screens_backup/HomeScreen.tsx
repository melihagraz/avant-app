// screens/HomeScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Animated, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  { bg: '#FAECE7', text: '#D85A30' },
  { bg: '#E6F1FB', text: '#185FA5' },
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#FBEAF0', text: '#993556' },
  { bg: '#EEEDFE', text: '#534AB7' },
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

  useEffect(() => {
    startPulse();
    init();
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
      subscribeToMatches(user.id);
    } catch (err) {
      console.error('init error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  };

  const fetchMatches = async (userId: string) => {
    try {
      const { data: matchData, error } = await supabase
        .from('matches')
        .select('id, created_at, user_a_id, user_b_id, conversation_id')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error || !matchData?.length) { setMatches([]); return; }

      const formatted: Match[] = [];
      for (const m of matchData) {
        const otherUserId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
        const { data: otherUser } = await supabase
          .from('users').select('id, name, age, city, photos').eq('id', otherUserId).single();

        let agent_a_score = 0, agent_b_score = 0, agent_a_reasoning = '';
        if (m.conversation_id) {
          const { data: conv } = await supabase
            .from('agent_conversations')
            .select('agent_a_score, agent_b_score, agent_a_reasoning')
            .eq('id', m.conversation_id).single();
          if (conv) {
            agent_a_score = conv.agent_a_score || 0;
            agent_b_score = conv.agent_b_score || 0;
            agent_a_reasoning = conv.agent_a_reasoning || '';
          }
        }

        // Mesaj var mı kontrol et
        const { data: msgs } = await supabase
          .from('human_messages')
          .select('content, created_at')
          .eq('match_id', m.id)
          .order('created_at', { ascending: false })
          .limit(1);

        formatted.push({
          id: m.id,
          created_at: m.created_at,
          other_user: otherUser || { id: otherUserId, name: 'Kullanıcı', age: 0, city: '', photos: [] },
          agent_a_score, agent_b_score, agent_a_reasoning,
          has_messages: (msgs?.length || 0) > 0,
          last_message: msgs?.[0]?.content,
          last_message_at: msgs?.[0]?.created_at,
        });
      }
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

  // Yeni eşleşmeler — henüz konuşma başlatılmamış
  const newMatches = matches.filter(m => !m.has_messages && !dismissed.includes(m.id));
  // Aktif konuşmalar — mesaj var
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
            <View style={[s.photoPlaceholder, { backgroundColor: color.bg }]}>
              <Text style={[s.photoInitial, { color: color.text }]}>
                {match.other_user?.name?.[0] || '?'}
              </Text>
            </View>
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.78)']} style={s.gradient}>
            <View style={s.gradientContent}>
              <Text style={s.cardName}>
                {match.other_user?.name}
                <Text style={s.cardAge}> · {match.other_user?.age || '?'}</Text>
              </Text>
              {match.other_user?.city ? <Text style={s.cardCity}>{match.other_user.city}</Text> : null}
            </View>
          </LinearGradient>
          <View style={s.scoreBadge}>
            <Text style={s.scoreNum}>{score}</Text>
            <Text style={s.scoreLbl}>uyum</Text>
          </View>
        </View>

        <View style={s.cardBody}>
          {match.agent_a_reasoning ? (
            <Text style={s.reasonTxt} numberOfLines={2}>
              <Text style={s.reasonLabel}>Agentın: </Text>
              "{match.agent_a_reasoning}"
            </Text>
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
              <Text style={s.btnChatTxt}>Konuşmayı başlat →</Text>
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
      >
        {hasPhoto ? (
          <Image source={{ uri: match.other_user.photos[0] }} style={s.chatAvatar} />
        ) : (
          <View style={[s.chatAvatar, { backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 22, fontWeight: '500', color: color.text }}>
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
        <Text style={s.chatArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.logo}>av<Text style={s.accent}>a</Text>nt</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={s.avatarBtn}>
          <Text style={s.avatarTxt}>{myName || 'M'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {activeTab === 'matches' && (
          <>
            {/* Agent pill */}
            <View style={s.pillRow}>
              <View style={s.pill}>
                <View style={s.pillDotWrap}>
                  <Animated.View style={[s.pillDotRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
                  <View style={s.pillDot} />
                </View>
                <Text style={s.pillTxt}>Agentın aktif</Text>
                {newMatches.length > 0 && (
                  <View style={s.pillBadge}>
                    <Text style={s.pillBadgeTxt}>{newMatches.length} yeni</Text>
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
                  <Text style={{ color: '#D85A30', marginTop: 8, fontSize: 14 }}>Tekrar dene</Text>
                </TouchableOpacity>
              </View>
            ) : newMatches.length === 0 ? (
              <View style={s.emptyState}>
                <View style={s.emptyIconWrap}>
                  <Text style={s.emptyIconTxt}>A</Text>
                </View>
                <Text style={s.emptyTitle}>Agentın çalışıyor</Text>
                <Text style={s.emptySub}>İlk eşleşmen yakında gelecek.</Text>
              </View>
            ) : (
              newMatches.map((m, i) => renderMatchCard(m, i))
            )}
          </>
        )}

        {activeTab === 'messages' && (
          <>
            <View style={s.sectionHdr}>
              <Text style={s.sectionTitle}>Mesajlar</Text>
            </View>
            {activeChats.length === 0 ? (
              <View style={s.emptyState}>
                <View style={s.emptyIconWrap}>
                  <Text style={s.emptyIconTxt}>✉</Text>
                </View>
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

      {/* Tab Bar */}
      <View style={s.tabBar}>
        {[
          { key: 'matches', label: 'Eşleşmeler', icon: '⊡', badge: newMatches.length },
          { key: 'messages', label: 'Mesajlar', icon: '◉', badge: activeChats.length },
          { key: 'profile', label: 'Profil', icon: '○', badge: 0 },
        ].map(tab => (
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
              <Text style={[s.tabIcon, activeTab === tab.key && s.tabIconActive]}>{tab.icon}</Text>
              {tab.badge > 0 && (
                <View style={s.tabBadge}>
                  <Text style={s.tabBadgeTxt}>{tab.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[s.tabLbl, activeTab === tab.key && s.tabLblActive]}>{tab.label}</Text>
            {activeTab === tab.key && <View style={s.tabLine} />}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  logo: { fontSize: 22, fontWeight: '500', color: '#1a1a1a', letterSpacing: -0.5 },
  accent: { color: '#D85A30' },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FAECE7', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '600', color: '#712B13' },
  scroll: { paddingBottom: 20 },
  pillRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#f9f9f8', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  pillDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  pillDotRing: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: '#D85A30' },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D85A30' },
  pillTxt: { fontSize: 13, color: '#555', fontWeight: '500' },
  pillBadge: { backgroundColor: '#D85A30', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pillBadgeTxt: { fontSize: 11, color: '#fff', fontWeight: '600' },
  sectionHdr: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  card: { marginHorizontal: 16, marginTop: 14, borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 380 },
  photoPlaceholder: { width: '100%', height: 380, alignItems: 'center', justifyContent: 'center' },
  photoInitial: { fontSize: 80, fontWeight: '500' },
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160, justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 18 },
  gradientContent: { gap: 3 },
  cardName: { fontSize: 24, fontWeight: '600', color: '#fff' },
  cardAge: { fontSize: 20, color: 'rgba(255,255,255,0.85)', fontWeight: '400' },
  cardCity: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  scoreBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  scoreNum: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  scoreLbl: { fontSize: 10, color: '#888', marginTop: -2 },
  cardBody: { padding: 16, gap: 12 },
  reasonTxt: { fontSize: 13, color: '#888', lineHeight: 19 },
  reasonLabel: { color: '#D85A30', fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 10 },
  btnPass: { flex: 1, padding: 13, borderRadius: 16, borderWidth: 0.5, borderColor: '#e5e5e5', alignItems: 'center' },
  btnPassTxt: { fontSize: 14, color: '#999' },
  btnChat: { flex: 2.5, padding: 13, borderRadius: 16, backgroundColor: '#D85A30', alignItems: 'center' },
  btnChatTxt: { fontSize: 14, color: '#fff', fontWeight: '600' },
  chatList: { paddingHorizontal: 16, gap: 2 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 14, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f4' },
  chatAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f5f5f4' },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  chatLastMsg: { fontSize: 13, color: '#aaa', marginTop: 2 },
  chatArrow: { fontSize: 22, color: '#ccc' },
  emptyState: { margin: 16, marginTop: 20, backgroundColor: '#f9f9f8', borderRadius: 20, padding: 40, alignItems: 'center', gap: 10 },
  emptyIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  emptyIconTxt: { fontSize: 22, color: '#D85A30' },
  emptyTitle: { fontSize: 16, fontWeight: '500', color: '#1a1a1a' },
  emptySub: { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 20 },
  tabBar: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#f0f0f0', backgroundColor: '#fff' },
  tab: { flex: 1, paddingVertical: 10, paddingBottom: 12, alignItems: 'center', gap: 3, position: 'relative' },
  tabIconWrap: { position: 'relative' },
  tabIcon: { fontSize: 18, color: '#ccc' },
  tabIconActive: { color: '#D85A30' },
  tabLbl: { fontSize: 10, color: '#ccc' },
  tabLblActive: { color: '#D85A30', fontWeight: '500' },
  tabLine: { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 2, backgroundColor: '#D85A30', borderRadius: 1 },
  tabBadge: { position: 'absolute', top: -4, right: -8, backgroundColor: '#D85A30', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  tabBadgeTxt: { fontSize: 9, color: '#fff', fontWeight: '700' },
});
