// screens/AuthScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { FONT_HEADING, FONT_BODY_SEMIBOLD } from '../lib/fonts';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { canPerformAction, getRemainingCooldown } from '../lib/rateLimit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEMO_EMAIL = Constants.expoConfig?.extra?.demoEmail || 'demo@avant.app';
const DEMO_PASSWORD = Constants.expoConfig?.extra?.demoPassword || 'AvantDemo2026!';
const OTP_LENGTH = 8;

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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
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
      navigation.replace(agent ? 'Main' : 'Welcome');
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

    // Rate limit: 5 dogrulama / 5 dakika
    if (!canPerformAction('otp_verify', 5, 300000)) {
      const remaining = getRemainingCooldown('otp_verify', 5, 300000);
      setError(t('moderation.rateLimited', { seconds: remaining }));
      return;
    }

    if (otpCode.length !== OTP_LENGTH) {
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
    navigation.replace(agent ? 'Main' : 'Welcome');
  };

  // ── OTP Verification View ──
  if (sent) {
    return (
      <View style={s.bg}>
        <SafeAreaView style={s.container}>
          <KeyboardAvoidingView style={s.kavOtp} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {/* Back button */}
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => { setSent(false); setCode(''); setError(''); }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <Animated.View style={[s.otpContent, { opacity: fadeAnim }]}>
              <Text style={s.otpTitle}>{t('auth.enterCode')}</Text>
              <Text style={s.otpSubtitle}>
                {t('auth.codeSent', { email: email.trim().toLowerCase() })}
              </Text>

              {/* OTP boxes */}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => codeRef.current?.focus()}
                style={s.otpRow}
              >
                {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                  const filled = i < code.length;
                  const active = i === code.length;
                  return (
                    <View
                      key={i}
                      style={[
                        s.otpBox,
                        filled && s.otpBoxFilled,
                        active && s.otpBoxActive,
                        error ? s.otpBoxErr : null,
                      ]}
                    >
                      <Text style={[s.otpDigit, filled && s.otpDigitFilled]}>
                        {code[i] || ''}
                      </Text>
                    </View>
                  );
                })}
              </TouchableOpacity>

              <TextInput
                ref={codeRef}
                style={s.otpHidden}
                value={code}
                onChangeText={v => {
                  const cleaned = v.replace(/\D/g, '').slice(0, OTP_LENGTH);
                  setCode(cleaned);
                  setError('');
                  if (cleaned.length === OTP_LENGTH) {
                    setTimeout(() => verifyOTP(cleaned), 100);
                  }
                }}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                autoFocus
                caretHidden
              />

              {error ? <Text style={s.errTxt}>{error}</Text> : null}

              {/* Verify button */}
              <TouchableOpacity
                style={[s.verifyBtn, (code.length !== OTP_LENGTH || verifying) && s.btnDisabled]}
                onPress={() => verifyOTP()}
                disabled={code.length !== OTP_LENGTH || verifying}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={
                    (code.length !== OTP_LENGTH || verifying)
                      ? (colors.disabledGradient as [string, string])
                      : (colors.goldGradient as [string, string])
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.verifyBtnGrad}
                >
                  {verifying
                    ? <ActivityIndicator color="#1a0f00" size="small" />
                    : <Text style={[
                        s.verifyBtnTxt,
                        (code.length !== OTP_LENGTH || verifying) && { color: 'rgba(255,255,255,0.4)' },
                      ]}>
                        {t('auth.loginBtn')}
                      </Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              {/* Resend */}
              <TouchableOpacity style={s.resendBtn} onPress={sendOTP} activeOpacity={0.7}>
                <Text style={s.resendTxt}>{t('auth.resend')}</Text>
              </TouchableOpacity>
            </Animated.View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ── Initial View (email entry) ──
  return (
    <View style={s.bg}>
      <SafeAreaView style={s.container}>
        <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Center: Logo + branding */}
          <Animated.View style={[s.centerArea, {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }]}>
            {/* Logo mark */}
            <Animated.View style={[s.logoWrap, { transform: [{ scale: logoScale }] }]}>
              <LinearGradient
                colors={['#E8B86D', '#D4914A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.logoMark}
              >
                <Ionicons name="heart" size={40} color="#fff" />
              </LinearGradient>
            </Animated.View>

            <Text style={s.brandName}>Avant</Text>
            <Text style={s.tagline}>Your AI finds the connection</Text>
          </Animated.View>

          {/* Bottom: inputs + actions */}
          <Animated.View style={[s.bottomArea, { opacity: fadeAnim }]}>
            {/* Email input */}
            <TextInput
              style={[s.emailInput, error ? s.emailInputErr : null]}
              value={email}
              onChangeText={v => { setEmail(v); setError(''); }}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={sendOTP}
            />

            {error ? <Text style={s.errTxt}>{error}</Text> : null}

            {/* Basla button */}
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={sendOTP}
              disabled={!email.trim() || loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={colors.goldGradient as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.primaryBtnGrad, (!email.trim() || loading) && { opacity: 0.5 }]}
              >
                {loading
                  ? <ActivityIndicator color="#1a0f00" size="small" />
                  : <Text style={s.primaryBtnTxt}>{t('auth.continueBtn')}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Ghost button: Demo */}
            <TouchableOpacity
              style={s.ghostBtn}
              onPress={demoLogin}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading
                ? <ActivityIndicator color="rgba(255,255,255,0.5)" size="small" />
                : <Text style={s.ghostBtnTxt}>{t('auth.demoLogin')}</Text>
              }
            </TouchableOpacity>

            {/* Legal text */}
            <Text style={s.legalTxt}>{t('auth.emailHint')}</Text>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#0D0D14',
  },
  container: {
    flex: 1,
  },
  kav: {
    flex: 1,
    justifyContent: 'space-between',
  },
  kavOtp: {
    flex: 1,
  },

  // ── Center area (logo) ──
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    marginBottom: 20,
    // Gold glow shadow
    shadowColor: '#E8B86D',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
    elevation: 20,
  },
  logoMark: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: FONT_HEADING,
    fontSize: 38,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 6,
  },

  // ── Bottom area (inputs) ──
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 52,
    gap: 12,
  },
  emailInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#ffffff',
    fontFamily: FONT_BODY_SEMIBOLD,
  },
  emailInputErr: {
    borderColor: '#ff4444',
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryBtnGrad: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnTxt: {
    color: '#1a0f00',
    fontSize: 16,
    fontFamily: FONT_BODY_SEMIBOLD,
    fontWeight: '600',
  },
  ghostBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnTxt: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontFamily: FONT_BODY_SEMIBOLD,
  },
  legalTxt: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.2)',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },

  // ── OTP View ──
  backBtn: {
    marginTop: Platform.OS === 'ios' ? 8 : 16,
    marginLeft: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  otpTitle: {
    fontFamily: FONT_HEADING,
    fontSize: 32,
    color: '#ffffff',
    marginBottom: 8,
  },
  otpSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.5)',
    lineHeight: 22,
    marginBottom: 32,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: '#E8B86D',
    backgroundColor: 'rgba(232, 184, 109, 0.08)',
  },
  otpBoxActive: {
    borderColor: 'rgba(232, 184, 109, 0.5)',
  },
  otpBoxErr: {
    borderColor: '#ff4444',
  },
  otpDigit: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.2)',
  },
  otpDigitFilled: {
    color: '#E8B86D',
  },
  otpHidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  errTxt: {
    fontSize: 13,
    color: '#ff4444',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 4,
  },
  verifyBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  verifyBtnGrad: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnTxt: {
    color: '#1a0f00',
    fontSize: 16,
    fontFamily: FONT_BODY_SEMIBOLD,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  resendTxt: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: FONT_BODY_SEMIBOLD,
  },
});
