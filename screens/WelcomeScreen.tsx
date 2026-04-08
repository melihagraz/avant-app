// screens/WelcomeScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';

export default function WelcomeScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const stepAnims = [0, 1, 2].map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    trackEvent('onboarding_welcome');
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(180, stepAnims.map(a =>
        Animated.spring(a, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true })
      )).start();
    });
  }, []);

  const steps = [
    { emoji: '🎯', title: t('welcome.step1Title'), desc: t('welcome.step1Desc'), color: '#FF6B9D' },
    { emoji: '🤖', title: t('welcome.step2Title'), desc: t('welcome.step2Desc'), color: '#C084FC' },
    { emoji: '💬', title: t('welcome.step3Title'), desc: t('welcome.step3Desc'), color: '#818CF8' },
  ];

  return (
    <LinearGradient colors={colors.authGradient as any} style={s.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <SafeAreaView style={s.container}>
        <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          <View style={s.logoWrap}>
            <Text style={[s.logo, { color: colors.textPrimary }]}>av<Text style={[s.accent, { color: colors.accentPink }]}>a</Text>nt</Text>
            <View style={[s.agentPill, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
              <Text style={s.pillEmoji}>🤖</Text>
              <Text style={[s.pillTxt, { color: colors.userBubble }]}>{t('welcome.pillLabel')}</Text>
            </View>
          </View>

          <View style={s.messageWrap}>
            <Text style={[s.title, { color: colors.textPrimary }]}>{t('welcome.title')}</Text>
            <Text style={[s.sub, { color: colors.textMuted }]}>
              {t('welcome.subtitle')}
            </Text>
          </View>

          <View style={s.steps}>
            {steps.map((step, i) => (
              <Animated.View key={i} style={[s.step, { backgroundColor: colors.card, shadowColor: colors.shadow }, { opacity: stepAnims[i], transform: [{ scale: stepAnims[i] }] }]}>
                <View style={[s.stepIcon, { backgroundColor: step.color + '18' }]}>
                  <Text style={s.stepEmoji}>{step.emoji}</Text>
                </View>
                <View style={s.stepText}>
                  <Text style={[s.stepTitle, { color: colors.textPrimary }]}>{step.title}</Text>
                  <Text style={[s.stepDesc, { color: colors.textSecondary }]}>{step.desc}</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          <View style={[s.noteCard, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <Text style={[s.note, { color: colors.textMuted }]}>
              {t('welcome.note')}
            </Text>
          </View>

          <TouchableOpacity
            style={s.btn}
            onPress={() => {
              trackEvent('onboarding_start');
              navigation.replace('Onboarding');
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={colors.accentGradient as any}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.btnGrad}
            >
              <Text style={s.btnTxt}>{t('welcome.startBtn')}</Text>
            </LinearGradient>
          </TouchableOpacity>

        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  container: { flex: 1 },
  content: { flex: 1, padding: 24, paddingTop: 16, justifyContent: 'space-between' },
  logoWrap: { alignItems: 'flex-start', gap: 10 },
  logo: { fontSize: 48, fontWeight: '800', color: '#2D1B4E', letterSpacing: -2 },
  accent: { color: '#FF6B9D' },
  agentPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 7, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  pillEmoji: { fontSize: 14 },
  pillTxt: { fontSize: 13, color: '#7C3AED', fontWeight: '700' },
  messageWrap: { gap: 14 },
  title: { fontSize: 44, fontWeight: '900', color: '#2D1B4E', lineHeight: 52, letterSpacing: -1.5 },
  sub: { fontSize: 16, color: '#8B7AA0', lineHeight: 25 },
  steps: { gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 22, padding: 16, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  stepIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepEmoji: { fontSize: 24 },
  stepText: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: '800', color: '#2D1B4E' },
  stepDesc: { fontSize: 14, color: '#9B8AB8', marginTop: 2, lineHeight: 20 },
  noteCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  note: { fontSize: 14, color: '#8B7AA0', textAlign: 'center', lineHeight: 22 },
  btn: { borderRadius: 22, overflow: 'hidden' },
  btnGrad: { padding: 20, alignItems: 'center', borderRadius: 22 },
  btnTxt: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
});
