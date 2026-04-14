import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors, Fonts } from '../theme';

interface RangeSliderProps {
  min: number;
  max: number;
  initialLow: number;
  initialHigh: number;
  step?: number;
  onValueChange: (low: number, high: number) => void;
}

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 4;
const TOOLTIP_WIDTH = 40;

export default function RangeSlider({
  min, max, initialLow, initialHigh, step = 1, onValueChange,
}: RangeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [lowVal, setLowVal] = useState(initialLow);
  const [highVal, setHighVal] = useState(initialHigh);

  const lowPos = useSharedValue(0);
  const highPos = useSharedValue(0);
  const lowStart = useSharedValue(0);
  const highStart = useSharedValue(0);

  const valueToPos = useCallback((val: number) => {
    if (trackWidth === 0) return 0;
    return ((val - min) / (max - min)) * trackWidth;
  }, [trackWidth, min, max]);

  const posToValue = useCallback((pos: number) => {
    if (trackWidth === 0) return min;
    const raw = min + (pos / trackWidth) * (max - min);
    return Math.round(raw / step) * step;
  }, [trackWidth, min, max, step]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width - THUMB_SIZE;
    setTrackWidth(w);
    lowPos.value = ((initialLow - min) / (max - min)) * w;
    highPos.value = ((initialHigh - min) / (max - min)) * w;
  };

  const updateLow = (val: number) => {
    setLowVal(val);
    onValueChange(val, highVal);
  };

  const updateHigh = (val: number) => {
    setHighVal(val);
    onValueChange(lowVal, val);
  };

  const lowGesture = Gesture.Pan()
    .onStart(() => { lowStart.value = lowPos.value; })
    .onUpdate((e) => {
      let newPos = lowStart.value + e.translationX;
      newPos = Math.max(0, Math.min(newPos, highPos.value - THUMB_SIZE * 0.5));
      lowPos.value = newPos;
      const val = posToValue(newPos);
      runOnJS(updateLow)(val);
    });

  const highGesture = Gesture.Pan()
    .onStart(() => { highStart.value = highPos.value; })
    .onUpdate((e) => {
      let newPos = highStart.value + e.translationX;
      newPos = Math.max(lowPos.value + THUMB_SIZE * 0.5, Math.min(newPos, trackWidth));
      highPos.value = newPos;
      const val = posToValue(newPos);
      runOnJS(updateHigh)(val);
    });

  const lowThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lowPos.value }],
  }));

  const highThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highPos.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    left: lowPos.value + THUMB_SIZE / 2,
    width: highPos.value - lowPos.value,
  }));

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Labels */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>Yas Araligi</Text>
        <Text style={styles.valueText}>{lowVal} - {highVal}</Text>
      </View>

      {/* Track */}
      <View style={styles.trackContainer}>
        <View style={styles.track} />
        <Animated.View style={[styles.fill, fillStyle]} />

        {/* Low thumb */}
        <GestureDetector gesture={lowGesture}>
          <Animated.View style={[styles.thumbWrap, lowThumbStyle]}>
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>{lowVal}</Text>
            </View>
            <View style={styles.thumb} />
          </Animated.View>
        </GestureDetector>

        {/* High thumb */}
        <GestureDetector gesture={highGesture}>
          <Animated.View style={[styles.thumbWrap, highThumbStyle]}>
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>{highVal}</Text>
            </View>
            <View style={styles.thumb} />
          </Animated.View>
        </GestureDetector>
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
  container: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.white85,
  },
  valueText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: Colors.gold,
  },
  trackContainer: {
    height: THUMB_SIZE + 30,
    justifyContent: 'flex-end',
    paddingBottom: THUMB_SIZE / 2 - TRACK_HEIGHT / 2,
  },
  track: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    bottom: THUMB_SIZE / 2 - TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Colors.white10,
  },
  fill: {
    position: 'absolute',
    bottom: THUMB_SIZE / 2 - TRACK_HEIGHT / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Colors.gold,
  },
  thumbWrap: {
    position: 'absolute',
    bottom: 0,
    width: THUMB_SIZE,
    alignItems: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: Colors.gold,
    borderWidth: 3,
    borderColor: Colors.surface,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  tooltip: {
    backgroundColor: 'rgba(40,40,60,0.95)',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 6,
    minWidth: TOOLTIP_WIDTH,
    alignItems: 'center',
  },
  tooltipText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.white,
  },
  minMaxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: THUMB_SIZE / 2 - 4,
  },
  minMaxText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.white30,
  },
});
