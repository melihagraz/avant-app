import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Typography } from '../../src/theme';
import { useEffect } from 'react';

export default function MatchScreen() {
  const router = useRouter();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        {/* Avatars */}
        <Animated.View entering={ZoomIn.duration(600).delay(200)} style={styles.avatarRow}>
          <View style={[styles.avatar, { marginRight: -18, zIndex: 2, backgroundColor: '#2a1f3d' }]}>
            <Text style={{ fontSize: 40 }}>🧔</Text>
          </View>
          <Animated.Text entering={FadeInUp.duration(400).delay(500)} style={{ fontSize: 22, zIndex: 3 }}>
            ✨
          </Animated.Text>
          <View style={[styles.avatar, { marginLeft: -18, backgroundColor: '#3d2a4a' }]}>
            <Text style={{ fontSize: 40 }}>👩</Text>
          </View>
        </Animated.View>

        <Animated.Text entering={FadeInUp.duration(800).delay(400)} style={styles.title}>
          It's a Match!
        </Animated.Text>

        <Animated.Text entering={FadeInUp.duration(800).delay(600)} style={styles.sub}>
          Sen ve Zeynep birbirini begendi
        </Animated.Text>

        {/* AI Hint */}
        <Animated.View entering={FadeInUp.duration(800).delay(800)} style={styles.aiHint}>
          <Text style={styles.aiHintLabel}>🤖 AGENT ANALIZI</Text>
          <Text style={styles.aiHintText}>
            %87 uyumluluk skoru. Pazar sabahi cekim gezisi onermeni tavsiye ediyorum.
          </Text>
        </Animated.View>

        {/* Buttons */}
        <Animated.View entering={FadeInDown.duration(800).delay(1000)} style={styles.btns}>
          <Pressable onPress={() => router.push('/screens/chat')}>
            {({ pressed }) => (
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.btnPrimary, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.btnPrimaryText}>Mesaj Gonder →</Text>
              </LinearGradient>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(tabs)/discover')}
            style={styles.btnGhost}
          >
            <Text style={styles.btnGhostText}>Kesfetmeye Devam</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 40,
    color: Colors.gold,
    marginBottom: 10,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 28,
    lineHeight: 24,
    textAlign: 'center',
  },
  aiHint: {
    backgroundColor: 'rgba(232,184,109,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(232,184,109,0.18)',
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 28,
    width: '100%',
  },
  aiHintLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 10,
    color: 'rgba(232,184,109,0.6)',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  aiHintText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 19.5,
  },
  btns: {
    width: '100%',
    gap: 12,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: Colors.goldText,
  },
  btnGhost: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.white15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
});
