import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '../theme';

interface RangeSliderProps {
  min: number;
  max: number;
  initialLow: number;
  initialHigh: number;
  step?: number;
  onValueChange: (low: number, high: number) => void;
}

export default function RangeSlider({
  min, max, initialLow, initialHigh, step = 1, onValueChange,
}: RangeSliderProps) {
  const [low, setLow] = useState(initialLow);
  const [high, setHigh] = useState(initialHigh);

  const update = (newLow: number, newHigh: number) => {
    setLow(newLow);
    setHigh(newHigh);
    onValueChange(newLow, newHigh);
    Haptics.selectionAsync();
  };

  const decLow = () => { if (low - step >= min) update(low - step, high); };
  const incLow = () => { if (low + step < high) update(low + step, high); };
  const decHigh = () => { if (high - step > low) update(low, high - step); };
  const incHigh = () => { if (high + step <= max) update(low, high + step); };

  // Calculate fill percentage for visual bar
  const fillLeft = ((low - min) / (max - min)) * 100;
  const fillWidth = ((high - low) / (max - min)) * 100;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.label}>Yas Araligi</Text>
        <Text style={styles.valueText}>{low} — {high}</Text>
      </View>

      {/* Visual bar */}
      <View style={styles.trackRow}>
        <View style={styles.track}>
          <View style={[styles.fill, { left: `${fillLeft}%`, width: `${fillWidth}%` }]} />
        </View>
      </View>

      {/* Stepper controls */}
      <View style={styles.steppersRow}>
        {/* Low control */}
        <View style={styles.stepper}>
          <Text style={styles.stepperLabel}>Min</Text>
          <View style={styles.stepperBtns}>
            <Pressable onPress={decLow} style={styles.stepBtn}>
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <View style={styles.stepValue}>
              <Text style={styles.stepValueText}>{low}</Text>
            </View>
            <Pressable onPress={incLow} style={styles.stepBtn}>
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* High control */}
        <View style={styles.stepper}>
          <Text style={styles.stepperLabel}>Max</Text>
          <View style={styles.stepperBtns}>
            <Pressable onPress={decHigh} style={styles.stepBtn}>
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <View style={styles.stepValue}>
              <Text style={styles.stepValueText}>{high}</Text>
            </View>
            <Pressable onPress={incHigh} style={styles.stepBtn}>
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Min/Max labels */}
      <View style={styles.minMaxRow}>
        <Text style={styles.minMaxText}>{min}</Text>
        <Text style={styles.minMaxText}>{max}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  label: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.white85 },
  valueText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.gold },
  trackRow: { marginBottom: 16 },
  track: { height: 4, backgroundColor: Colors.white10, borderRadius: 99, overflow: 'hidden' },
  fill: { position: 'absolute', height: '100%', backgroundColor: Colors.gold, borderRadius: 99 },
  steppersRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  stepper: { flex: 1, alignItems: 'center', gap: 6 },
  stepperLabel: { fontFamily: Fonts.body, fontSize: 11, color: Colors.white30, textTransform: 'uppercase', letterSpacing: 0.5 },
  stepperBtns: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stepBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.white06, borderWidth: 1, borderColor: Colors.white10,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, color: Colors.gold, fontWeight: '500', marginTop: -2 },
  stepValue: {
    minWidth: 48, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(232,184,109,0.08)', borderWidth: 1, borderColor: Colors.goldBorder,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  stepValueText: { fontFamily: Fonts.bodySemiBold, fontSize: 16, color: Colors.gold },
  minMaxRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  minMaxText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.white30 },
});
