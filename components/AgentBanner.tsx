// components/AgentBanner.tsx
// Floating pill shown at top of Discover screen.
// Shows agent status (active/found) and links to AgentMatchesScreen.
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';

interface Props {
  agentMatchCount: number;
  onPress: () => void;
}

export default function AgentBanner({ agentMatchCount, onPress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const dotScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const dotOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });

  const onPressIn = () => {
    Animated.spring(pressScale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  };
  const onPressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };
  const handlePress = () => {
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <Animated.View style={[s.wrap, { transform: [{ scale: pressScale }] }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={s.pressable}
      >
        <LinearGradient
          colors={colors.accentGradient as any}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.grad}
        >
          <View style={s.left}>
            <Text style={s.emoji}>🤖</Text>
            <View style={s.dotWrap}>
              <Animated.View style={[s.dotRing, { transform: [{ scale: dotScale }], opacity: dotOpacity }]} />
              <View style={s.dot} />
            </View>
          </View>
          <Text style={s.text} numberOfLines={1}>
            {agentMatchCount > 0
              ? t('discover.agentBannerFound', { count: agentMatchCount })
              : t('discover.agentBannerActive')}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 28,
    shadowColor: '#E8B86D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  pressable: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  grad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emoji: {
    fontSize: 20,
  },
  dotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  dotRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#69F0AE',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#69F0AE',
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
});
