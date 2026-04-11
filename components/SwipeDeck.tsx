// components/SwipeDeck.tsx
// Hinge/Bumble-style swipe deck with Reanimated 3 + gesture-handler
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_UP_THRESHOLD = -120;
const ROTATION_FACTOR = 12; // derece

interface SwipeDeckProps<T> {
  data: T[];
  renderCard: (item: T, idx: number) => React.ReactNode;
  onSwipeLeft: (item: T) => void;
  onSwipeRight: (item: T) => void;
  onSwipeUp: (item: T) => void;
  onEmpty?: () => void;
  keyExtractor: (item: T) => string;
}

function triggerHaptic(type: 'success' | 'light') {
  if (type === 'success') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function SwipeDeck<T>({
  data,
  renderCard,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onEmpty,
  keyExtractor,
}: SwipeDeckProps<T>) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const handleNext = useCallback(() => {
    setIndex(prev => {
      const nextIdx = prev + 1;
      if (nextIdx >= data.length && onEmpty) onEmpty();
      return nextIdx;
    });
    translateX.value = 0;
    translateY.value = 0;
  }, [data.length, onEmpty]);

  const triggerSwipeLeft = useCallback((item: T) => {
    triggerHaptic('success');
    onSwipeLeft(item);
    handleNext();
  }, [onSwipeLeft, handleNext]);

  const triggerSwipeRight = useCallback((item: T) => {
    triggerHaptic('success');
    onSwipeRight(item);
    handleNext();
  }, [onSwipeRight, handleNext]);

  const triggerSwipeUp = useCallback((item: T) => {
    triggerHaptic('light');
    onSwipeUp(item);
    // Detail screen'e git, kartı kaldırma
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  }, [onSwipeUp]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const currentItem = data[index];
      if (!currentItem) return;

      // Swipe up → Profile detail
      if (event.translationY < SWIPE_UP_THRESHOLD && Math.abs(event.translationX) < 100) {
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 250 }, () => {
          runOnJS(triggerSwipeUp)(currentItem);
        });
        return;
      }

      // Swipe right → Like
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 }, () => {
          runOnJS(triggerSwipeRight)(currentItem);
        });
        return;
      }

      // Swipe left → Pass
      if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 }, () => {
          runOnJS(triggerSwipeLeft)(currentItem);
        });
        return;
      }

      // Threshold altında → geri dön
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  // Top card animated style
  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-ROTATION_FACTOR, 0, ROTATION_FACTOR],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  // LIKE overlay
  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  // PASS overlay
  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  // DETAIL overlay (swipe up)
  const detailOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [SWIPE_UP_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  // Next card (behind) — scales up as top card moves
  const nextCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.abs(translateX.value) + Math.abs(translateY.value),
      [0, SCREEN_WIDTH / 2],
      [0.95, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ scale }],
    };
  });

  // Empty state
  if (index >= data.length) {
    return (
      <View style={s.emptyWrap}>
        <LinearGradient
          colors={colors.accentGradient as any}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.emptyCard}
        >
          <Text style={s.emptyEmoji}>🎉</Text>
          <Text style={s.emptyTitle}>{t('swipe.empty')}</Text>
          <Text style={s.emptySub}>{t('swipe.emptySub')}</Text>
        </LinearGradient>
      </View>
    );
  }

  const currentItem = data[index];
  const nextItem = data[index + 1];

  return (
    <View style={s.wrap}>
      {/* Next card (behind) */}
      {nextItem && (
        <Animated.View style={[s.cardWrap, s.nextCardWrap, nextCardStyle]}>
          {renderCard(nextItem, index + 1)}
        </Animated.View>
      )}

      {/* Top card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[s.cardWrap, cardStyle]}>
          {renderCard(currentItem, index)}

          {/* LIKE overlay */}
          <Animated.View style={[s.overlay, s.likeOverlay, likeOverlayStyle]} pointerEvents="none">
            <Text style={s.likeLabel}>{t('swipe.like')}</Text>
          </Animated.View>

          {/* PASS overlay */}
          <Animated.View style={[s.overlay, s.passOverlay, passOverlayStyle]} pointerEvents="none">
            <Text style={s.passLabel}>{t('swipe.pass')}</Text>
          </Animated.View>

          {/* DETAIL overlay */}
          <Animated.View style={[s.overlay, s.detailOverlay, detailOverlayStyle]} pointerEvents="none">
            <Text style={s.detailLabel}>↑ {t('swipe.details')}</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  cardWrap: {
    width: SCREEN_WIDTH - 40,
    position: 'absolute',
    top: 8,
  },
  nextCardWrap: {
    opacity: 0.6,
  },
  overlay: {
    position: 'absolute',
    top: 40,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 4,
  },
  likeOverlay: {
    right: 24,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16,185,129,0.2)',
    transform: [{ rotate: '-12deg' }],
  },
  likeLabel: {
    fontSize: 32,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 2,
  },
  passOverlay: {
    left: 24,
    borderColor: '#FF6B9D',
    backgroundColor: 'rgba(255,107,157,0.2)',
    transform: [{ rotate: '12deg' }],
  },
  passLabel: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF6B9D',
    letterSpacing: 2,
  },
  detailOverlay: {
    top: 'auto',
    bottom: 80,
    alignSelf: 'center',
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  detailLabel: {
    fontSize: 20,
    fontWeight: '900',
    color: '#3B82F6',
    letterSpacing: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyCard: {
    width: SCREEN_WIDTH - 40,
    borderRadius: 36,
    padding: 48,
    alignItems: 'center',
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 12,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  emptySub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
  },
});
