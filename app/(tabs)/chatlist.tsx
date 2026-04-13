import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Typography } from '../../src/theme';
import { useMatchesStore } from '../../src/stores/matchesStore';
import { useAuthStore } from '../../src/stores/authStore';

export default function ChatListScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { matches, loading, fetchMatches, subscribeToMatches, unsubscribe, getNewMatches, getActiveChats } = useMatchesStore();

  useEffect(() => {
    if (user?.id) {
      fetchMatches(user.id);
      subscribeToMatches(user.id);
    }
    return () => unsubscribe();
  }, [user?.id]);

  const newMatches = getNewMatches();
  const activeChats = getActiveChats();

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Dun';
    if (diffDays < 7) return ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'][d.getDay()];
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  const getPhoto = (photos?: string[]) => photos?.[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sohbetler</Text>
        <Text style={styles.sub}>{newMatches.length} yeni eslisme</Text>
      </View>

      {loading && matches.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : (
        <>
          {newMatches.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newMatches}>
              {newMatches.map((m) => (
                <Pressable
                  key={m.id}
                  style={styles.nmItem}
                  onPress={() => router.push({ pathname: '/screens/chat', params: { matchId: m.id, otherUserName: m.other_user?.name || '' } })}
                >
                  <View style={styles.nmAv}>
                    {getPhoto(m.other_user?.photos) ? (
                      <Image source={{ uri: getPhoto(m.other_user?.photos) }} style={styles.nmAvImg} />
                    ) : (
                      <Text style={{ fontSize: 22 }}>👤</Text>
                    )}
                    <View style={styles.nmBadge}><Text style={styles.nmBadgeText}>!</Text></View>
                  </View>
                  <Text style={styles.nmName} numberOfLines={1}>{m.other_user?.name || '?'}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={styles.divider} />

          <ScrollView style={styles.chatList} showsVerticalScrollIndicator={false}>
            {activeChats.length === 0 && !loading && (
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>Henuz mesaj yok. Eslesmelerinle sohbet baslat!</Text>
              </View>
            )}
            {activeChats.map((chat) => (
              <Pressable
                key={chat.id}
                style={styles.chatItem}
                onPress={() => router.push({ pathname: '/screens/chat', params: { matchId: chat.id, otherUserName: chat.other_user?.name || '' } })}
              >
                <View style={styles.chatAv}>
                  {getPhoto(chat.other_user?.photos) ? (
                    <Image source={{ uri: getPhoto(chat.other_user?.photos) }} style={styles.chatAvImg} />
                  ) : (
                    <Text style={{ fontSize: 20 }}>👤</Text>
                  )}
                </View>
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{chat.other_user?.name || '?'}</Text>
                  <Text style={styles.chatPreview} numberOfLines={1}>
                    {chat.last_message?.content || 'Mesaj baslat...'}
                  </Text>
                </View>
                <View style={styles.chatMeta}>
                  <Text style={styles.chatTime}>{formatTime(chat.last_message?.created_at)}</Text>
                  {chat.unread_count && chat.unread_count > 0 ? <View style={styles.unreadDot} /> : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { ...Typography.screenTitle, color: Colors.white },
  sub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.white35, marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  newMatches: { paddingHorizontal: 16, gap: 14, paddingBottom: 14 },
  nmItem: { alignItems: 'center', gap: 5 },
  nmAv: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, borderColor: Colors.gold, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nmAvImg: { width: '100%', height: '100%' },
  nmBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.gold, borderWidth: 2, borderColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  nmBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.goldText },
  nmName: { fontFamily: Fonts.bodyMedium, fontSize: 10, color: Colors.white55, maxWidth: 60, textAlign: 'center' },
  divider: { height: 1, backgroundColor: Colors.white05, marginHorizontal: 16 },
  chatList: { flex: 1, paddingHorizontal: 16 },
  emptyChat: { paddingTop: 40, alignItems: 'center' },
  emptyChatText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.white35, textAlign: 'center' },
  chatItem: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.white04, alignItems: 'center' },
  chatAv: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1e1530', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chatAvImg: { width: '100%', height: '100%' },
  chatInfo: { flex: 1 },
  chatName: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.white },
  chatPreview: { fontFamily: Fonts.body, fontSize: 12, color: Colors.white38, marginTop: 3 },
  chatMeta: { alignItems: 'flex-end', gap: 4 },
  chatTime: { fontFamily: Fonts.body, fontSize: 11, color: Colors.white28 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gold },
});
