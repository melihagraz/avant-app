import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors, Typography, Fonts } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';

export default function SplashScreen() {
  const router = useRouter();
  const { session, hasAgent } = useAuthStore();

  // Auto-redirect if already logged in
  useEffect(() => {
    if (session) {
      if (hasAgent) {
        router.replace('/(tabs)/discover');
      } else {
        router.replace('/screens/profile-setup');
      }
    }
  }, [session, hasAgent]);

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/screens/auth');
  };

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/screens/auth');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoArea}>
        <Animated.View entering={FadeInUp.duration(800).delay(200)}>
          <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoMark}
          >
            <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
              <Path
                d="M20 5C15 5 10 9 10 14.5C10 18 12 20.5 14.5 22L20 35L25.5 22C28 20.5 30 18 30 14.5C30 9 25 5 20 5Z"
                fill="white"
                opacity={0.95}
              />
              <Circle cx={20} cy={14.5} r={3.5} fill="rgba(26,15,0,0.35)" />
            </Svg>
          </LinearGradient>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.duration(800).delay(400)}
          style={styles.appTitle}
        >
          Avant
        </Animated.Text>

        <Animated.Text
          entering={FadeInUp.duration(800).delay(600)}
          style={styles.tagline}
        >
          Your AI finds the connection
        </Animated.Text>
      </View>

      <Animated.View
        entering={FadeInDown.duration(800).delay(800)}
        style={styles.ctaArea}
      >
        <Pressable onPress={handleStart}>
          {({ pressed }) => (
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.btnPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            >
              <Text style={styles.btnPrimaryText}>Basla →</Text>
            </LinearGradient>
          )}
        </Pressable>

        <Pressable onPress={handleLogin}>
          {({ pressed }) => (
            <View style={[styles.btnGhost, pressed && { opacity: 0.7 }]}>
              <Text style={styles.btnGhostText}>Zaten hesabim var</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.legal}>
          Devam ederek Kullanim Kosullari'ni kabul edersiniz
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  logoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 30,
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
  },
  appTitle: {
    ...Typography.appTitle,
    color: Colors.white,
  },
  tagline: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 8,
    letterSpacing: 0.6,
  },
  ctaArea: {
    paddingHorizontal: 24,
    paddingBottom: 20,
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
  legal: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.white20,
    textAlign: 'center',
    marginTop: 4,
  },
});
