import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';

export interface CompatibilityBreakdown {
  values: number;
  communication: number;
  lifestyle: number;
  humor: number;
}

interface Props {
  breakdown: CompatibilityBreakdown;
  animated?: boolean;
  staggerDelay?: number; // ms delay between bars
  compact?: boolean;     // daha küçük (kartlarda kullanım için)
}

export default function CompatibilityBars({
  breakdown,
  animated = true,
  staggerDelay = 120,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const metrics: Array<keyof CompatibilityBreakdown> = ['values', 'communication', 'lifestyle', 'humor'];
  const barAnims = useRef(metrics.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!animated) {
      barAnims.forEach(a => a.setValue(1));
      return;
    }
    const animations = barAnims.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        duration: 900,
        delay: i * staggerDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      })
    );
    Animated.parallel(animations).start();
  }, [breakdown]);

  return (
    <View style={[s.container, compact && s.containerCompact]}>
      {metrics.map((metric, i) => {
        const value = Math.max(0, Math.min(100, breakdown[metric] ?? 0));
        const barWidth = barAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: ['0%', `${value}%`],
        });
        return (
          <View key={metric} style={[s.row, compact && s.rowCompact]}>
            <View style={s.labelCol}>
              <Text style={[s.label, { color: colors.textSecondary }, compact && s.labelCompact]}>
                {t(`compatibility.${metric}`)}
              </Text>
            </View>
            <View style={[s.track, { backgroundColor: colors.borderLight }, compact && s.trackCompact]}>
              <Animated.View style={[s.fill, { width: barWidth }]}>
                <LinearGradient
                  colors={colors.goldGradient as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
            </View>
            <View style={s.valueCol}>
              <Text style={[s.value, { color: colors.textPrimary }, compact && s.valueCompact]}>
                {value}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14, paddingVertical: 4 },
  containerCompact: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCompact: { gap: 10 },
  labelCol: { width: 100 },
  label: { fontSize: 14, fontWeight: '600' },
  labelCompact: { fontSize: 12 },
  track: {
    flex: 1, height: 10, borderRadius: 5, overflow: 'hidden',
  },
  trackCompact: { height: 7, borderRadius: 4 },
  fill: { height: '100%', borderRadius: 5, overflow: 'hidden' },
  valueCol: { width: 36, alignItems: 'flex-end' },
  value: { fontSize: 14, fontWeight: '800' },
  valueCompact: { fontSize: 12 },
});
