import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Typography } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { canPerformAction, getRemainingCooldown } from '../../src/lib/rateLimit';
import { trackEvent } from '../../src/lib/analytics';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithOtp, verifyOtp, signInDemo, hasAgent } = useAuthStore();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const codeRef = useRef<TextInput>(null);

  const navigateAfterAuth = (hasAgent: boolean) => {
    if (hasAgent) {
      router.replace('/(tabs)/discover');
    } else {
      router.replace('/screens/profile-setup');
    }
  };

  const handleDemoLogin = async () => {
    trackEvent('login_start', { method: 'demo' });
    setLoading(true);
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await signInDemo();
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    trackEvent('login_success', { method: 'demo' });
    navigateAfterAuth(result.hasAgent ?? false);
  };

  const handleSendOtp = async () => {
    if (!canPerformAction('otp_send', 3, 300000)) {
      const remaining = getRemainingCooldown('otp_send', 3, 300000);
      setError(`Cok fazla deneme. ${remaining} saniye bekle.`);
      return;
    }

    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      setError('Gecerli bir e-posta adresi gir.');
      return;
    }

    setLoading(true);
    setError('');
    trackEvent('login_start', { method: 'otp' });

    const result = await signInWithOtp(email);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => codeRef.current?.focus(), 300);
    }
  };

  const handleVerifyOtp = async (codeOverride?: string) => {
    const otpCode = codeOverride || code;

    if (!canPerformAction('otp_verify', 5, 300000)) {
      const remaining = getRemainingCooldown('otp_verify', 5, 300000);
      setError(`Cok fazla deneme. ${remaining} saniye bekle.`);
      return;
    }

    if (otpCode.length < 6) {
      setError('Kodu eksiksiz gir.');
      return;
    }

    setLoading(true);
    setError('');

    const result = await verifyOtp(email, otpCode);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEvent('login_success', { method: 'otp' });
      const store = useAuthStore.getState();
      navigateAfterAuth(store.hasAgent);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(600)} style={styles.header}>
          <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            style={styles.logoMark}
          >
            <Svg width={28} height={28} viewBox="0 0 40 40" fill="none">
              <Path
                d="M20 5C15 5 10 9 10 14.5C10 18 12 20.5 14.5 22L20 35L25.5 22C28 20.5 30 18 30 14.5C30 9 25 5 20 5Z"
                fill="white"
                opacity={0.95}
              />
              <Circle cx={20} cy={14.5} r={3.5} fill="rgba(26,15,0,0.35)" />
            </Svg>
          </LinearGradient>
          <Text style={styles.title}>{sent ? 'Kodu gir' : 'Giris yap'}</Text>
          <Text style={styles.subtitle}>
            {sent
              ? `${email} adresine kod gonderdik`
              : 'E-posta adresinle devam et'}
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.form}>
          {!sent ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="E-posta adresin"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable onPress={handleSendOtp} disabled={loading}>
                {({ pressed }) => (
                  <LinearGradient
                    colors={[Colors.gold, Colors.goldDark]}
                    style={[styles.btn, (pressed || loading) && { opacity: 0.8 }]}
                  >
                    {loading ? (
                      <ActivityIndicator color={Colors.goldText} />
                    ) : (
                      <Text style={styles.btnText}>Kod Gonder →</Text>
                    )}
                  </LinearGradient>
                )}
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>veya</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable onPress={handleDemoLogin} disabled={loading}>
                {({ pressed }) => (
                  <View style={[styles.btnGhost, pressed && { opacity: 0.7 }]}>
                    <Text style={styles.btnGhostText}>Demo Hesapla Gir</Text>
                  </View>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                ref={codeRef}
                style={styles.input}
                placeholder="Dogrulama kodu"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={code}
                onChangeText={(t) => {
                  setCode(t);
                  setError('');
                  if (t.length === 8) handleVerifyOtp(t);
                }}
                keyboardType="number-pad"
                maxLength={8}
                editable={!loading}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable onPress={() => handleVerifyOtp()} disabled={loading}>
                {({ pressed }) => (
                  <LinearGradient
                    colors={[Colors.gold, Colors.goldDark]}
                    style={[styles.btn, (pressed || loading) && { opacity: 0.8 }]}
                  >
                    {loading ? (
                      <ActivityIndicator color={Colors.goldText} />
                    ) : (
                      <Text style={styles.btnText}>Dogrula →</Text>
                    )}
                  </LinearGradient>
                )}
              </Pressable>

              <Pressable onPress={() => { setSent(false); setCode(''); setError(''); }}>
                <Text style={styles.backLink}>← Farkli e-posta kullan</Text>
              </Pressable>
            </>
          )}
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    ...Typography.screenTitle,
    color: Colors.white,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.white45,
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    gap: 14,
  },
  input: {
    backgroundColor: Colors.white05,
    borderWidth: 1,
    borderColor: Colors.white10,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.white,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: '#ff6b6b',
    textAlign: 'center',
  },
  btn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: Colors.goldText,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.white10,
  },
  dividerText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.white30,
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
  backLink: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.gold,
    textAlign: 'center',
    marginTop: 4,
  },
});
