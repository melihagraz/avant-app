// screens/HomeScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Image, FlatList, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { useTranslation } from 'react-i18next';
import { cacheMatches, getCachedMatches } from '../lib/offline';
import { FONT_HEADING, FONT_BODY_SEMIBOLD } from '../lib/fonts';

interface Match {
  id: string;
  created_at: string;
  other_user: { id: string; name: string; age: number; city: string; photos: string[] };
  agent_a_score: number;
  agent_b_score: number;
  agent_a_reasoning: string;
  compatibility_breakdown?: { values: number; communication: number; lifestyle: number; humor: number } | null;
  has_messages: boolean;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'az once';
  if (diffMin < 60) return `${diffMin}dk`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}sa`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}g`;
  return `${Math.floor(diffDay / 7)}hf`;
}

export default function HomeScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [matches, setMatches] = useState<Match[]>([]);
  const [myUserId, setMyUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    init();
    return () => {
      mountedRef.current = false;
      unsubscribeRef.current?.();
    };
  }, []);

  const init = async () => {
    try {
      trackEvent('app_home_load');
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { setLoading(false); return; }
      setMyUserId(user.id);

      await fetchMatches(user.id);
      // Onceki subscription'i temizle
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

  const fetchMatches = async (userId: string) => {
    try {
      // Tek query ile tum match verilerini join ederek cek (N+1 sorunu cozuldu)
      const { data: matchData, error } = await supabase
        .from('matches')
        .select(`
          id, created_at, user_a_id, user_b_id,
          conversation:conversation_id(agent_a_score, agent_b_score, agent_a_reasoning)
        `)
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error || !matchData?.length) { setMatches([]); return; }

      // Diger kullanicilarin ID'lerini topla
      const otherUserIds = matchData.map(m => m.user_a_id === userId ? m.user_b_id : m.user_a_id);
      const matchIds = matchData.map(m => m.id);

      // Paralel: kullanici bilgileri + son mesajlar
      const [usersResult, messagesResult] = await Promise.all([
        supabase.from('users').select('id, name, age, city, photos').in('id', otherUserIds),
        supabase.from('human_messages').select('match_id, content, created_at')
          .in('match_id', matchIds).order('created_at', { ascending: false }),
      ]);

      const usersMap = new Map((usersResult.data || []).map(u => [u.id, u]));

      // Her match icin son mesaji bul
      const lastMessageMap = new Map<string, { content: string; created_at: string }>();
      for (const msg of (messagesResult.data || [])) {
        if (!lastMessageMap.has(msg.match_id)) {
          lastMessageMap.set(msg.match_id, msg);
        }
      }

      const formatted: Match[] = matchData.map(m => {
        const otherUserId = m.user_a_id === userId ? m.user_b_id : m.user_a_id;
        const otherUser = usersMap.get(otherUserId) || { id: otherUserId, name: 'Kullanici', age: 0, city: '', photos: [] };
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

  const fetchSingleMatch = async (matchId: string, userId: string): Promise<Match | null> => {
    try {
      const { data } = await supabase
        .from('matches')
        .select(`
          id, created_at, user_a_id, user_b_id,
          conversation:conversation_id(agent_a_score, agent_b_score, agent_a_reasoning, compatibility_breakdown)
        `)
        .eq('id', matchId)
        .single();

      if (!data) return null;

      const otherUserId = data.user_a_id === userId ? data.user_b_id : data.user_a_id;
      const { data: otherUser } = await supabase
        .from('users').select('id, name, age, city, photos').eq('id', otherUserId).single();

      const conv = data.conversation as any;
      return {
        id: data.id,
        created_at: data.created_at,
        other_user: otherUser || { id: otherUserId, name: '?', age: 0, city: '', photos: [] },
        agent_a_score: conv?.agent_a_score || 0,
        agent_b_score: conv?.agent_b_score || 0,
        agent_a_reasoning: conv?.agent_a_reasoning || '',
        compatibility_breakdown: conv?.compatibility_breakdown || null,
        has_messages: false,
      } as Match;
    } catch (err) {
      captureError(err, { context: 'fetch_single_match' });
      return null;
    }
  };

  const subscribeToMatches = (userId: string) => {
    const channel = supabase.channel('new-matches')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, async (payload) => {
        const matchRow: any = payload.new;
        // Yeni match bu kullaniciya ait mi?
        if (matchRow.user_a_id === userId || matchRow.user_b_id === userId) {
          const fullMatch = await fetchSingleMatch(matchRow.id, userId);
          if (fullMatch) {
            // Cinematic reveal modal
            navigation.navigate('MatchReveal', { match: fullMatch });
          }
        }
        fetchMatches(userId);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'human_messages' }, () => {
        fetchMatches(userId);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  const onRefresh = useCallback(async () => {
    if (!myUserId) return;
    setRefreshing(true);
    await fetchMatches(myUserId);
    setRefreshing(false);
  }, [myUserId]);

  const newMatches = matches.filter(m => !m.has_messages);
  const activeChats = matches
    .filter(m => m.has_messages)
    .sort((a, b) => {
      const tA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tB - tA;
    });

  const renderNewMatchCircle = (match: Match) => {
    const hasPhoto = match.other_user?.photos?.length > 0;
    const firstName = match.other_user?.name?.split(' ')[0] || '?';

    return (
      <TouchableOpacity
        key={match.id}
        style={s.newMatchItem}
        activeOpacity={0.7}
        onPress={() => {
          trackEvent('new_match_tap', { match_id: match.id });
          navigation.navigate('HumanChat', { matchId: match.id, otherUser: match.other_user });
        }}
      >
        <View style={s.newMatchAvatarBorder}>
          {hasPhoto ? (
            <Image source={{ uri: match.other_user.photos[0] }} style={s.newMatchAvatar} />
          ) : (
            <View style={[s.newMatchAvatar, s.newMatchAvatarPlaceholder]}>
              <Text style={s.newMatchInitial}>{firstName[0]}</Text>
            </View>
          )}
        </View>
        <Text style={s.newMatchName} numberOfLines={1}>{firstName}</Text>
      </TouchableOpacity>
    );
  };

  const renderChatItem = ({ item, index }: { item: Match; index: number }) => {
    const placeholderColor = colors.photoPlaceholders[index % colors.photoPlaceholders.length];
    const hasPhoto = item.other_user?.photos?.length > 0;
    const firstName = item.other_user?.name || '?';
    const preview = item.last_message || t('home.defaultChatHint');
    const timeAgo = formatTimeAgo(item.last_message_at);

    return (
      <TouchableOpacity
        style={s.chatRow}
        activeOpacity={0.7}
        onPress={() => {
          trackEvent('chat_tap', { match_id: item.id });
          navigation.navigate('HumanChat', { matchId: item.id, otherUser: item.other_user });
        }}
      >
        {hasPhoto ? (
          <Image source={{ uri: item.other_user.photos[0] }} style={s.chatAvatar} />
        ) : (
          <View style={[s.chatAvatar, { backgroundColor: placeholderColor.bg, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: placeholderColor.text }}>
              {firstName[0]}
            </Text>
          </View>
        )}

        <View style={s.chatInfo}>
          <View style={s.chatTopRow}>
            <Text style={s.chatName} numberOfLines={1}>{firstName}</Text>
            {timeAgo ? <Text style={s.chatTime}>{timeAgo}</Text> : null}
          </View>
          <View style={s.chatBottomRow}>
            <Text style={s.chatPreview} numberOfLines={1}>{preview}</Text>
            {item.unread_count && item.unread_count > 0 ? (
              <View style={s.unreadDot} />
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <>
      {/* New matches horizontal row */}
      {newMatches.length > 0 && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.newMatchesRow}
          >
            {newMatches.map(renderNewMatchCircle)}
          </ScrollView>
          <View style={s.divider} />
        </>
      )}
    </>
  );

  const ListEmpty = () => {
    if (loading) {
      return (
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>{t('common.loading')}</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={s.emptyWrap}>
          <Text style={s.emptyTitle}>{t('home.errorTitle')}</Text>
          <Text style={s.emptyText}>{t('home.errorSub')}</Text>
          <TouchableOpacity onPress={() => { setError(false); setLoading(true); init(); }}>
            <Text style={s.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyTitle}>{t('home.noMessages')}</Text>
        <Text style={s.emptyText}>{t('home.noMessagesSub')}</Text>
      </View>
    );
  };

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.container} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView style={s.safeArea}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Sohbetler</Text>
            <Text style={s.headerSubtitle}>
              {matches.length > 0
                ? `${matches.length} ${t('home.matchCount', { count: matches.length })}`
                : t('home.noMatchesYet')
              }
            </Text>
          </View>
        </View>

        {/* Chat list */}
        <FlatList
          data={activeChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#E8B86D"
              colors={['#E8B86D']}
            />
          }
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FONT_HEADING,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: FONT_BODY_SEMIBOLD,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },

  // New matches row
  newMatchesRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 16,
  },
  newMatchItem: {
    alignItems: 'center',
    width: 68,
  },
  newMatchAvatarBorder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#E8B86D',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newMatchAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  newMatchAvatarPlaceholder: {
    backgroundColor: 'rgba(232,184,109,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newMatchInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#E8B86D',
  },
  newMatchName: {
    fontSize: 11,
    fontFamily: FONT_BODY_SEMIBOLD,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
    textAlign: 'center',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 22,
  },

  // Chat list
  listContent: {
    paddingBottom: 90,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    gap: 14,
  },
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  chatInfo: {
    flex: 1,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    fontSize: 14,
    fontFamily: FONT_BODY_SEMIBOLD,
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  chatBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
  },
  chatPreview: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8B86D',
  },

  // Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: FONT_HEADING,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E8B86D',
    marginTop: 8,
  },
});
