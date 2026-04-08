// screens/AuthScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { canPerformAction, getRemainingCooldown } from '../lib/rateLimit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_EMAIL = Constants.expoConfig?.extra?.demoEmail || 'demo@avant.app';
const DEMO_PASSWORD = Constants.expoConfig?.extra?.demoPassword || 'AvantDemo2026!';

export default function AuthScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const codeRef = useRef<TextInput>(null);
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(bounceAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  const demoLogin = async () => {
    trackEvent('login_start', { method: 'demo' });
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (err || !data.session) {
        setError(t('auth.demoUnavailable'));
        setLoading(false);
        return;
      }
      const { data: agent } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', data.session.user.id)
        .single();
      trackEvent('login_success');
      navigation.replace(agent ? 'Home' : 'Welcome');
    } catch (e) {
      captureError(e);
      setError(t('auth.demoUnavailable'));
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async () => {
    trackEvent('login_start', { method: 'otp' });

    // Rate limit: 3 OTP / 5 dakika
    if (!canPerformAction('otp_send', 3, 300000)) {
      const remaining = getRemainingCooldown('otp_send', 3, 300000);
      setError(t('moderation.rateLimited', { seconds: remaining }));
      return;
    }

    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setLoading(true);
    setError('');

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });

    setLoading(false);
    if (err) {
      setError(t('auth.genericError'));
    } else {
      setSent(true);
      setTimeout(() => codeRef.current?.focus(), 300);
    }
  };

  const verifyOTP = async (codeOverride?: string) => {
    const otpCode = codeOverride || code;

    // Rate limit: 5 doğrulama / 5 dakika
    if (!canPerformAction('otp_verify', 5, 300000)) {
      const remaining = getRemainingCooldown('otp_verify', 5, 300000);
      setError(t('moderation.rateLimited', { seconds: remaining }));
      return;
    }

    if (otpCode.length !== 8) {
      setError(t('auth.codeInvalid'));
      return;
    }
    setVerifying(true);
    setError('');

    const { data, error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otpCode,
      type: 'email',
    });

    setVerifying(false);

    if (err || !data.session) {
      setError(t('auth.codeWrong'));
      return;
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', data.session.user.id)
      .single();

    trackEvent('login_success');
    navigation.replace(agent ? 'Home' : 'Onboarding');
  };

  if (sent) {
    return (
      <LinearGradient colors={colors.authGradient as any} style={s.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView style={s.container}>
          <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Animated.View style={[s.inner, { opacity: fadeAnim, transform: [{ scale: bounceAnim }] }]}>
              <View style={s.top}>
                <Text style={[s.logo, { color: colors.textPrimary }]}>av<Text style={[s.logoAccent, { color: colors.accentPink }]}>a</Text>nt</Text>
                <Text style={s.sparkle}>✨</Text>
              </View>

              <View style={[s.card, { backgroundColor: colors.card }]}>
                <Text style={[s.cardTitle, { color: colors.textPrimary }]}>{t('auth.enterCode')}</Text>
                <Text style={[s.cardSub, { color: colors.textSecondary }]}>
                  {t('auth.codeSent', { email })}
                </Text>

                <TouchableOpacity activeOpacity={0.9} onPress={() => codeRef.current?.focus()} style={s.otpRow}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <View key={i} style={[
                      s.otpBox,
                      { backgroundColor: colors.inputBg, borderColor: colors.border },
                      i < code.length && [s.otpBoxFilled, { borderColor: colors.accentPurple, backgroundColor: colors.inputBg }],
                      error ? s.otpBoxErr : null,
                    ]}>
                      <Text style={[
                        s.otpDigit,
                        { color: colors.placeholder },
                        i < code.length && [s.otpDigitFilled, { color: colors.userBubble }],
                      ]}>{code[i] || ''}</Text>
                    </View>
                  ))}
                </TouchableOpacity>
                <TextInput
                  ref={codeRef}
                  style={s.otpHidden}
                  value={code}
                  onChangeText={v => {
                    const cleaned = v.replace(/\D/g, '').slice(0, 8);
                    setCode(cleaned);
                    setError('');
                    // 8 hane yapıştırıldığında otomatik doğrula
                    if (cleaned.length === 8) {
                      setTimeout(() => verifyOTP(cleaned), 100);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={8}
                  autoFocus
                  caretHidden
                />
                {error ? <Text style={[s.errTxt, { color: colors.error }]}>{error}</Text> : null}

                <TouchableOpacity
                  style={[s.btn, (code.length !== 8 || verifying) && s.btnOff]}
                  onPress={verifyOTP}
                  disabled={code.length !== 8 || verifying}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={(code.length !== 8 || verifying) ? colors.disabledGradient as any : colors.accentGradient as any}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={s.btnGrad}
                  >
                    {verifying
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.btnTxt}>{t('auth.loginBtn')}</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <View style={s.retryRow}>
                  <TouchableOpacity style={s.retryBtn} onPress={() => { setSent(false); setCode(''); setError(''); }}>
                    <Text style={[s.retryTxt, { color: colors.textSecondary }]}>{t('auth.tryDifferent')}</Text>
                  </TouchableOpacity>
                  <Text style={[s.retryDot, { color: colors.chevron }]}>·</Text>
                  <TouchableOpacity style={s.retryBtn} onPress={sendOTP}>
                    <Text style={[s.retryTxt, { color: colors.textSecondary }]}>{t('auth.resend')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={colors.authGradient as any} style={s.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView style={s.container}>
        <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[s.inner, { opacity: fadeAnim, transform: [{ scale: bounceAnim }] }]}>
            <View style={s.top}>
              <Text style={[s.logo, { color: colors.textPrimary }]}>av<Text style={[s.logoAccent, { color: colors.accentPink }]}>a</Text>nt</Text>
              <Text style={s.sparkle}>✨</Text>
              <Text style={[s.tagline, { color: colors.textSecondary }]}>{t('auth.tagline')}</Text>
            </View>

            <View style={[s.card, { backgroundColor: colors.card }]}>
              <Text style={[s.cardLabel, { color: colors.textSecondary }]}>{t('auth.emailLabel')}</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }, error ? s.inputErr : null]}
                value={email}
                onChangeText={v => { setEmail(v); setError(''); }}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={sendOTP}
              />
              {error ? <Text style={[s.errTxt, { color: colors.error }]}>{error}</Text> : null}

              <TouchableOpacity
                style={s.btn}
                onPress={sendOTP}
                disabled={!email.trim() || loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={colors.accentGradient as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.btnGrad}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.btnTxt}>{t('auth.continueBtn')}</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <Text style={[s.hint, { color: colors.textHint }]}>
                {t('auth.emailHint')}
              </Text>

              <TouchableOpacity
                style={[s.demoBtn, { borderTopColor: colors.border }]}
                onPress={demoLogin}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading
                  ? <ActivityIndicator color="#9B8AB8" size="small" />
                  : <Text style={[s.demoTxt, { color: colors.textSecondary }]}>{t('auth.demoLogin')}</Text>
                }
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1 },
  kav: { flex: 1, justifyContent: 'center' },
  inner: { paddingHorizontal: 24 },
  top: { alignItems: 'center', marginBottom: 36 },
  logo: { fontSize: 56, fontWeight: '800', color: '#2D1B4E', letterSpacing: -2 },
  logoAccent: { color: '#FF6B9D' },
  sparkle: { fontSize: 28, marginTop: 4 },
  tagline: { fontSize: 16, color: '#9B8AB8', marginTop: 8, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 28, padding: 28, gap: 14, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
  cardTitle: { fontSize: 28, fontWeight: '800', color: '#2D1B4E', letterSpacing: -0.5 },
  cardSub: { fontSize: 15, color: '#8B7AA0', lineHeight: 22 },
  bold: { fontWeight: '700', color: '#2D1B4E' },
  cardLabel: { fontSize: 14, color: '#9B8AB8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#F8F5FC', borderRadius: 18, paddingHorizontal: 18,
    paddingVertical: 16, fontSize: 17, color: '#2D1B4E', fontWeight: '500',
    borderWidth: 2, borderColor: '#F0EBF7',
  },
  inputErr: { borderColor: '#FF6B9D' },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginVertical: 4 },
  otpBox: {
    width: 40, height: 52, borderRadius: 16, borderWidth: 2, borderColor: '#F0EBF7',
    backgroundColor: '#F8F5FC', alignItems: 'center', justifyContent: 'center',
  },
  otpBoxFilled: { borderColor: '#C084FC', backgroundColor: '#F5F0FF' },
  otpBoxErr: { borderColor: '#FF6B9D' },
  otpDigit: { fontSize: 24, fontWeight: '800', color: '#C4B5D0' },
  otpDigitFilled: { color: '#7C3AED' },
  otpHidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  errTxt: { fontSize: 13, color: '#FF6B9D', textAlign: 'center', fontWeight: '600' },
  btn: { borderRadius: 20, overflow: 'hidden' },
  btnOff: { opacity: 0.6 },
  btnGrad: { padding: 18, alignItems: 'center', borderRadius: 20 },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  hint: { fontSize: 14, color: '#B8A8CC', textAlign: 'center', lineHeight: 20 },
  retryRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  retryBtn: { padding: 6 },
  retryDot: { color: '#D4C8E0', fontSize: 16 },
  retryTxt: { fontSize: 14, color: '#9B8AB8', fontWeight: '600' },
  demoBtn: { alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0EBF7', marginTop: 4 },
  demoTxt: { fontSize: 14, color: '#9B8AB8', fontWeight: '600' },
});
