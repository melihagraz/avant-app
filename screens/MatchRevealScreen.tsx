// screens/MatchRevealScreen.tsx
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
import { FONT_HEADING, FONT_BODY_SEMIBOLD } from '../lib/fonts';
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
  const { colors } = useTheme();
  const { t } = useTranslation();

  const otherUser = match.other_user;
  const score = Math.round(((match.agent_a_score || 0) + (match.agent_b_score || 0)) / 2);
  const hasPhoto = otherUser?.photos?.length > 0;

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

    scoreScale.value = withDelay(700, withSpring(1, { damping: 10, stiffness: 140 }));
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
        <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['rgba(61,42,15,0.4)', 'rgba(13,13,20,0.85)']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <TouchableOpacity onPress={close} style={s.closeBtn}>
        <View style={s.closeBtnInner}>
          <Ionicons name="close" size={22} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={s.content}>
        {/* Avatars pair */}
        <Animated.View style={[s.avatarPair, photoStyle]}>
          <View style={[s.matchAv, { zIndex: 2, marginRight: -18 }]}>
            <Text style={s.matchAvText}>{'\u{1F9D4}'}</Text>
          </View>
          <Text style={s.sparkle}>{'\u2728'}</Text>
          <View style={[s.matchAv, { marginLeft: -18 }]}>
            {hasPhoto ? (
              <Image source={{ uri: otherUser.photos[0] }} style={s.matchAvImg} />
            ) : (
              <Text style={s.matchAvText}>{otherUser?.name?.[0] || '?'}</Text>
            )}
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={[s.titleWrap, titleStyle]}>
          <Text style={s.matchTitle}>It's a Match!</Text>
          <Text style={s.matchSub}>
            Sen ve {otherUser?.name} birbirini begendi
          </Text>
        </Animated.View>

        {/* AI hint box */}
        {score > 0 && (
          <Animated.View style={[s.aiHint, scoreStyle]}>
            <Text style={s.aiHintLabel}>{'\u{1F916}'} AGENT ANALIZI</Text>
            <Text style={s.aiHintText}>
              %{score} uyumluluk skoru. {match.agent_a_reasoning ? match.agent_a_reasoning.substring(0, 80) : 'Harika bir eslesme!'}
            </Text>
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
          <TouchableOpacity onPress={closeAndChat} activeOpacity={0.85}>
            <LinearGradient
              colors={colors.goldGradient as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.primaryBtn}
            >
              <Text style={s.primaryBtnTxt}>Mesaj Gonder {'\u2192'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={close} style={s.ghostBtn} activeOpacity={0.85}>
            <Text style={s.ghostBtnTxt}>Kesfetmeye Devam</Text>
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
    paddingHorizontal: 24,
    gap: 24,
  },

  // Avatar pair
  avatarPair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchAv: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#E8B86D',
    backgroundColor: '#2a1f3d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchAvText: {
    fontSize: 40,
  },
  matchAvImg: {
    width: 94,
    height: 94,
    borderRadius: 47,
  },
  sparkle: {
    fontSize: 22,
    zIndex: 3,
  },

  // Title
  titleWrap: {
    alignItems: 'center',
  },
  matchTitle: {
    fontFamily: FONT_HEADING,
    fontSize: 40,
    color: '#E8B86D',
  },
  matchSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 10,
    lineHeight: 24,
    textAlign: 'center',
  },

  // AI hint
  aiHint: {
    backgroundColor: 'rgba(232,184,109,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(232,184,109,0.18)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  aiHintLabel: {
    fontSize: 10,
    color: 'rgba(232,184,109,0.6)',
    fontWeight: '600',
    letterSpacing: 0.08,
    marginBottom: 6,
  },
  aiHintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },

  // Bars
  barsWrap: {
    width: SCREEN_WIDTH - 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // Buttons
  buttonsWrap: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a0f00',
    fontFamily: FONT_BODY_SEMIBOLD,
  },
  ghostBtn: {
    borderRadius: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  ghostBtnTxt: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
});
