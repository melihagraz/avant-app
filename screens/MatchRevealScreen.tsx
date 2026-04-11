// screens/MatchRevealScreen.tsx
// Cinematic match reveal with reanimated animations + haptics
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import CompatibilityBars from '../components/CompatibilityBars';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

function hapticLight() {
  Haptics.selectionAsync();
}

export default function MatchRevealScreen({ route, navigation }: any) {
  const { match } = route.params;
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  const otherUser = match.other_user;
  const score = Math.round(((match.agent_a_score || 0) + (match.agent_b_score || 0)) / 2);
  const hasPhoto = otherUser?.photos?.length > 0;

  // Shared animation values
  const blurOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.7);
  const titleOpacity = useSharedValue(0);
  const photoTranslateY = useSharedValue(150);
  const photoOpacity = useSharedValue(0);
  const scoreScale = useSharedValue(0);
  const barsOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    trackEvent('match_reveal_shown', { match_id: match.id, score });

    // Animation sequence
    blurOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });

    titleOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    titleScale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 120 }));

    photoTranslateY.value = withDelay(
      400,
      withSpring(0, { damping: 12, stiffness: 90 }, (finished) => {
        if (finished) runOnJS(hapticSuccess)();
      })
    );
    photoOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));

    scoreScale.value = withDelay(
      700,
      withSpring(1, { damping: 10, stiffness: 140 })
    );

    barsOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
    buttonsOpacity.value = withDelay(1400, withTiming(1, { duration: 400 }));
  }, []);

  const blurStyle = useAnimatedStyle(() => ({ opacity: blurOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));
  const photoStyle = useAnimatedStyle(() => ({
    opacity: photoOpacity.value,
    transform: [{ translateY: photoTranslateY.value }],
  }));
  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));
  const barsStyle = useAnimatedStyle(() => ({ opacity: barsOpacity.value }));
  const buttonsStyle = useAnimatedStyle(() => ({ opacity: buttonsOpacity.value }));

  const closeAndChat = () => {
    hapticLight();
    navigation.replace('HumanChat', { matchId: match.id, otherUser });
  };

  const closeAndDetail = () => {
    hapticLight();
    navigation.replace('ProfileDetail', { userId: otherUser.id, matchId: match.id });
  };

  const close = () => {
    hapticLight();
    navigation.goBack();
  };

  return (
    <View style={s.wrap}>
      <Animated.View style={[StyleSheet.absoluteFillObject, blurStyle]}>
        <BlurView intensity={isDark ? 95 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['rgba(5,6,15,0.6)', 'rgba(28,22,45,0.85)']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Close button */}
      <TouchableOpacity onPress={close} style={s.closeBtn}>
        <View style={s.closeBtnInner}>
          <Ionicons name="close" size={22} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={s.content}>
        {/* Title */}
        <Animated.View style={titleStyle}>
          <LinearGradient
            colors={colors.accentGradient as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.titleGrad}
          >
            <Text style={s.titleEmoji}>✨</Text>
            <Text style={s.titleText}>{t('matchReveal.title')}</Text>
            <Text style={s.titleEmoji}>✨</Text>
          </LinearGradient>
          <Text style={s.subtitleText}>{t('matchReveal.subtitle')}</Text>
        </Animated.View>

        {/* Photo */}
        <Animated.View style={[s.photoWrap, photoStyle]}>
          <LinearGradient
            colors={colors.accentGradient as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.photoRing}
          >
            {hasPhoto ? (
              <Image source={{ uri: otherUser.photos[0] }} style={s.photo} />
            ) : (
              <View style={[s.photo, s.photoPlaceholder]}>
                <Text style={s.photoInitial}>{otherUser?.name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
          </LinearGradient>
          <Text style={s.nameText}>{otherUser?.name}</Text>
        </Animated.View>

        {/* Score */}
        {score > 0 && (
          <Animated.View style={scoreStyle}>
            <LinearGradient
              colors={colors.accentGradientAlt as any}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.scoreBadge}
            >
              <Text style={s.scoreNum}>{score}</Text>
              <Text style={s.scoreLbl}>{t('matchReveal.compatibilityScore', { score: '' }).trim() || 'uyum'}</Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Compatibility bars */}
        {match.compatibility_breakdown && (
          <Animated.View style={[s.barsWrap, barsStyle]}>
            <CompatibilityBars breakdown={match.compatibility_breakdown} staggerDelay={150} />
          </Animated.View>
        )}

        {/* Buttons */}
        <Animated.View style={[s.buttonsWrap, buttonsStyle]}>
          <TouchableOpacity onPress={closeAndChat} style={s.primaryBtn} activeOpacity={0.85}>
            <LinearGradient
              colors={colors.accentGradientAlt as any}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.primaryBtnGrad}
            >
              <Text style={s.primaryBtnTxt}>{t('matchReveal.sayHi')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={closeAndDetail} style={s.secondaryBtn} activeOpacity={0.85}>
            <Text style={s.secondaryBtnTxt}>{t('matchReveal.viewProfile')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    top: 60, right: 20, zIndex: 10,
  },
  closeBtnInner: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 28,
  },

  titleGrad: {
    flexDirection: 'row',
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  titleEmoji: { fontSize: 22 },
  titleText: {
    fontSize: 26, fontWeight: '900', color: '#fff',
    letterSpacing: 1.5,
  },
  subtitleText: {
    fontSize: 15, fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', marginTop: 10,
  },

  photoWrap: { alignItems: 'center' },
  photoRing: {
    width: 180, height: 180, borderRadius: 90,
    padding: 5,
    shadowColor: '#C084FC', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.6, shadowRadius: 30, elevation: 16,
  },
  photo: {
    width: 170, height: 170, borderRadius: 85,
  },
  photoPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoInitial: {
    fontSize: 64, fontWeight: '900', color: '#fff',
  },
  nameText: {
    fontSize: 28, fontWeight: '900', color: '#fff',
    marginTop: 16, letterSpacing: -0.5,
  },

  scoreBadge: {
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 100,
    flexDirection: 'row', alignItems: 'baseline', gap: 8,
    shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  scoreNum: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  scoreLbl: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  barsWrap: {
    width: SCREEN_WIDTH - 64,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  buttonsWrap: { width: '100%', gap: 12 },
  primaryBtn: {
    borderRadius: 32, overflow: 'hidden',
    shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  primaryBtnGrad: {
    paddingVertical: 20, alignItems: 'center', borderRadius: 32,
  },
  primaryBtnTxt: {
    fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.3,
  },
  secondaryBtn: {
    paddingVertical: 16, alignItems: 'center',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  secondaryBtnTxt: {
    fontSize: 15, fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
});
