import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Ellipse } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Typography } from '../../src/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/(tabs)/discover');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Progress steps */}
        <View style={styles.steps}>
          <View style={[styles.dot, styles.dotDone]} />
          <View style={[styles.dot, styles.dotDone]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.title}>Fotograflarini{'\n'}ekle</Text>
        <Text style={styles.sub}>Ilk 3 fotograf eslemeyi dogrudan etkiler</Text>

        {/* Photo grid */}
        <View style={styles.photoGrid}>
          {/* Filled slots */}
          <View style={[styles.photoSlot, styles.photoFilled, { backgroundColor: '#1e1530' }]}>
            <Svg viewBox="0 0 60 80" width="100%" height="100%">
              <Ellipse cx={30} cy={22} rx={14} ry={16} fill="rgba(255,255,255,0.18)" />
              <Path d="M6 80C6 56 54 56 54 80" fill="rgba(255,255,255,0.14)" />
            </Svg>
          </View>
          <View style={[styles.photoSlot, styles.photoFilled, { backgroundColor: '#121e30' }]}>
            <Svg viewBox="0 0 60 80" width="100%" height="100%">
              <Ellipse cx={30} cy={22} rx={14} ry={16} fill="rgba(255,255,255,0.18)" />
              <Path d="M6 80C6 56 54 56 54 80" fill="rgba(255,255,255,0.14)" />
            </Svg>
          </View>

          {/* Empty slots */}
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.photoSlot}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={10} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
                <Path d="M12 8v8M8 12h8" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            </View>
          ))}
        </View>

        {/* Tip box */}
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            💡 <Text style={{ fontWeight: '700' }}>Ipucu:</Text> Gercek gulumseme iceren fotograflar %40 daha fazla eslisme saglar.
          </Text>
        </View>

        <Pressable onPress={handleContinue}>
          {({ pressed }) => (
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.btnPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            >
              <Text style={styles.btnText}>Devam →</Text>
            </LinearGradient>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  steps: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 22,
  },
  dot: {
    height: 3,
    flex: 1,
    borderRadius: 99,
    backgroundColor: Colors.white10,
  },
  dotDone: {
    backgroundColor: Colors.gold,
  },
  title: {
    ...Typography.screenTitle,
    color: Colors.white,
    marginBottom: 6,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 20,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  photoSlot: {
    width: '31%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    backgroundColor: Colors.white05,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.white12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoFilled: {
    borderStyle: 'solid',
    borderColor: 'transparent',
  },
  tipBox: {
    backgroundColor: Colors.goldBg,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    borderRadius: 12,
    padding: 11,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  tipText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(232,184,109,0.85)',
    lineHeight: 18,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: Colors.goldText,
  },
});
