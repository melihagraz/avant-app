import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, Typography } from '../../src/theme';

const NEW_MATCHES = [
  { id: '1', emoji: '👩', name: 'Zeynep', hasNew: true, bg: ['#3d2a4a', '#1e1530'] },
  { id: '2', emoji: '👩\u200D🦱', name: 'Selin', hasNew: false, bg: ['#2a4a3d', '#12302a'] },
  { id: '3', emoji: '👩\u200D🦰', name: 'Mira', hasNew: false, bg: ['#4a3d2a', '#302a12'] },
  { id: '4', emoji: '🧕', name: 'Ayse', hasNew: false, bg: ['#2a3d4a', '#12283a'] },
];

const CHATS = [
  { id: '1', emoji: '👩', name: 'Zeynep', preview: 'Pazar sabahi pazar firsati haha', time: '14:32', unread: true },
  { id: '2', emoji: '👩\u200D🦱', name: 'Selin', preview: 'Yarin uygun musun?', time: 'Dun', unread: false },
  { id: '3', emoji: '👩\u200D🦰', name: 'Mira', preview: 'Tesekkurler', time: 'Pzt', unread: false },
];

export default function ChatListScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sohbetler</Text>
        <Text style={styles.sub}>4 yeni eslisme</Text>
      </View>

      {/* New Matches Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.newMatches}
      >
        {NEW_MATCHES.map((m) => (
          <Pressable
            key={m.id}
            style={styles.nmItem}
            onPress={() => router.push('/screens/chat')}
          >
            <View style={[styles.nmAv, { backgroundColor: m.bg[0] }]}>
              <Text style={styles.nmEmoji}>{m.emoji}</Text>
              {m.hasNew && (
                <View style={styles.nmBadge}>
                  <Text style={styles.nmBadgeText}>!</Text>
                </View>
              )}
            </View>
            <Text style={styles.nmName}>{m.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.divider} />

      {/* Chat List */}
      <ScrollView style={styles.chatList} showsVerticalScrollIndicator={false}>
        {CHATS.map((chat) => (
          <Pressable
            key={chat.id}
            style={styles.chatItem}
            onPress={() => router.push('/screens/chat')}
          >
            <View style={styles.chatAv}>
              <Text style={{ fontSize: 20 }}>{chat.emoji}</Text>
            </View>
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{chat.name}</Text>
              <Text style={styles.chatPreview} numberOfLines={1}>{chat.preview}</Text>
            </View>
            <View style={styles.chatMeta}>
              <Text style={styles.chatTime}>{chat.time}</Text>
              {chat.unread && <View style={styles.unreadDot} />}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    ...Typography.screenTitle,
    color: Colors.white,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.white35,
    marginTop: 2,
  },
  newMatches: {
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 14,
  },
  nmItem: {
    alignItems: 'center',
    gap: 5,
  },
  nmAv: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nmEmoji: {
    fontSize: 22,
  },
  nmBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.gold,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nmBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.goldText,
  },
  nmName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    color: Colors.white55,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.white05,
    marginHorizontal: 16,
  },
  chatList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.white04,
    alignItems: 'center',
  },
  chatAv: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1e1530',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: Colors.white,
  },
  chatPreview: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.white38,
    marginTop: 3,
  },
  chatMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chatTime: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.white28,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
});
