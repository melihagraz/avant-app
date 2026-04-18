// components/HighlightReel.tsx
// Full-screen Stories-style player for agent match highlights.
// Auto-advances every 4s. Tap left/right to skip, tap & hold to pause.

import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableWithoutFeedback, Dimensions, Modal,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';
import type { HighlightCard } from '../lib/matchInsights';

const { width: W, height: H } = Dimensions.get('window');
const STORY_DURATION_MS = 4000;

interface Props {
  visible: boolean;
  highlights: HighlightCard[];
  otherName?: string;
  onClose: () => void;
}

// Gradient palette per highlight type — keeps the reel visually varied.
const GRADIENTS: Record<HighlightCard['type'], [string, string]> = {
  common:     ['#6366F1', '#A855F7'],
  spark:      ['#F97316', '#EC4899'],
  difference: ['#0EA5E9', '#6366F1'],
  surprise:   ['#F59E0B', '#EF4444'],
  score:      ['#10B981', '#06B6D4'],
};

const MAX_HIGHLIGHTS = 5;

export default function HighlightReel({ visible, highlights, otherName, onClose }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  // Fixed pool of shared values — hooks cannot live in loops. We slice
  // highlights to MAX_HIGHLIGHTS and only the first N bars are rendered.
  const p0 = useSharedValue(0);
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  const p3 = useSharedValue(0);
  const p4 = useSharedValue(0);
  const progress = useMemo(() => [p0, p1, p2, p3, p4], []);

  const items = highlights.slice(0, MAX_HIGHLIGHTS);

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    progress.forEach((p) => (p.value = 0));
  }, [visible]);

  useEffect(() => {
    if (!visible || items.length === 0) return;

    // Reset all bars up to and including current, then animate current.
    for (let i = 0; i < index; i++) progress[i].value = 1;
    for (let i = index + 1; i < progress.length; i++) progress[i].value = 0;

    progress[index].value = 0;
    progress[index].value = withTiming(
      1,
      { duration: STORY_DURATION_MS, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(advance)();
      }
    );

    return () => {
      cancelAnimation(progress[index]);
    };
  }, [index, visible]);

  const advance = () => {
    if (index < items.length - 1) {
      setIndex(index + 1);
      Haptics.selectionAsync().catch(() => {});
    } else {
      onClose();
    }
  };

  const goBack = () => {
    if (index > 0) {
      setIndex(index - 1);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const handleTap = (e: any) => {
    const x = e.nativeEvent.locationX;
    if (x < W / 3) goBack();
    else advance();
  };

  if (items.length === 0) return null;
  const current = items[index];
  const gradient = GRADIENTS[current.type] || GRADIENTS.common;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <LinearGradient colors={gradient} style={s.bg}>
        <TouchableWithoutFeedback onPress={handleTap}>
          <View style={s.tapLayer}>
            {/* Progress bars */}
            <View style={s.barsRow}>
              {items.map((_, i) => (
                <ProgressBar key={i} progress={progress[i]} />
              ))}
            </View>

            {/* Header */}
            <View style={s.header}>
              <Text style={s.headerTitle}>
                ✨ {otherName ? t('highlightReel.headerWithName', { name: otherName }) : t('highlightReel.header')}
              </Text>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <View style={s.body}>
              <Text style={s.emoji}>{current.emoji}</Text>
              <Text style={s.title}>{current.title}</Text>
              <Text style={s.detail}>{current.detail}</Text>
            </View>

            {/* Footer hint */}
            <View style={s.footer}>
              <Text style={s.footerTxt}>
                {index + 1} / {items.length}  ·  {t('highlightReel.tapHint')}
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </LinearGradient>
    </Modal>
  );
}

function ProgressBar({ progress }: { progress: any }) {
  const style = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  return (
    <View style={s.barBg}>
      <Animated.View style={[s.barFill, style]} />
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  tapLayer: { flex: 1, paddingTop: 54, paddingBottom: 40 },
  barsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 4,
    marginBottom: 10,
  },
  barBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 96,
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  detail: {
    fontSize: 18,
    lineHeight: 26,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
  },
  footerTxt: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
  },
});
