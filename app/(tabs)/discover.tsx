import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import * as Haptics from 'expo-haptics';
import Svg, { Path, Ellipse, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Typography } from '../../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;

export default function DiscoverScreen() {
  const router = useRouter();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const goToMatch = () => {
    router.push('/screens/match-screen');
  };

  const resetCard = () => {
    translateX.value = withSpring(0, { damping: 15 });
    translateY.value = withSpring(0, { damping: 15 });
  };

  const swipeRight = () => {
    translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 400 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => {
      runOnJS(goToMatch)();
      translateX.value = 0;
      translateY.value = 0;
    }, 450);
  };

  const swipeLeft = () => {
    translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 400 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      translateX.value = 0;
      translateY.value = 0;
    }, 500);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.3;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        runOnJS(swipeRight)();
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        runOnJS(swipeLeft)();
      } else {
        runOnJS(resetCard)();
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${translateX.value * 0.05}deg` },
    ],
  }));

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));

  const nopeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-80, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>Avant</Text>
          <Pressable
            style={styles.agentMatchBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/screens/agent-match');
            }}
          >
            <Animated.View style={styles.ambDot} />
            <Text style={styles.agentMatchText}>Agent Match</Text>
            <View style={styles.ambBadge}>
              <Text style={styles.ambBadgeText}>PRO</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.headerIcons}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push('/screens/filters')}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M3 6h18M7 12h10M11 18h2"
                stroke="rgba(255,255,255,0.65)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>
      </View>

      {/* Card Stack */}
      <View style={styles.cardStack}>
        {/* Back cards */}
        <View style={[styles.profileCard, styles.pcBack2]}>
          <View style={[styles.pcBg, { backgroundColor: '#1a120a' }]} />
        </View>
        <View style={[styles.profileCard, styles.pcBack]}>
          <View style={[styles.pcBg, { backgroundColor: '#0a121a' }]} />
        </View>

        {/* Front card */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.profileCard, styles.pcFront, cardStyle]}>
            <View style={[styles.pcBg, { backgroundColor: '#1a1228' }]}>
              <Svg
                style={styles.cardSvg}
                viewBox="0 0 320 450"
                fill="none"
              >
                <Ellipse cx={160} cy={140} rx={70} ry={80} fill="rgba(210,170,240,0.2)" />
                <Path d="M30 450C30 320 290 320 290 450" fill="rgba(210,170,240,0.15)" />
              </Svg>

              {/* Agent score badge */}
              <View style={styles.agentScoreBadge}>
                <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                  <Circle cx={12} cy={12} r={10} stroke="#C09AFF" strokeWidth={2} />
                  <Path
                    d="M8 12l3 3 5-5"
                    stroke="#C09AFF"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.agentScoreText}>%87 uyumlu</Text>
              </View>
            </View>

            {/* Gradient overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.93)']}
              start={{ x: 0.5, y: 0.35 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.pcGrad}
            />

            {/* Like overlay */}
            <Animated.View style={[styles.swipeOverlay, likeOverlayStyle]}>
              <View style={styles.likeStamp}>
                <Text style={styles.likeText}>LIKE</Text>
              </View>
            </Animated.View>

            {/* Nope overlay */}
            <Animated.View style={[styles.swipeOverlay, nopeOverlayStyle]}>
              <View style={styles.nopeStamp}>
                <Text style={styles.nopeText}>NOPE</Text>
              </View>
            </Animated.View>

            {/* Info */}
            <View style={styles.pcInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.pcName}>Zeynep</Text>
                <Text style={styles.pcAge}>27</Text>
              </View>
              <Text style={styles.pcLoc}>Istanbul - 3 km uzakta</Text>
              <View style={styles.pcTags}>
                <View style={styles.pcTag}><Text style={styles.pcTagText}>Fotografcilik</Text></View>
                <View style={styles.pcTag}><Text style={styles.pcTagText}>Seyahat</Text></View>
                <View style={styles.pcTag}><Text style={styles.pcTagText}>Kahve</Text></View>
              </View>
              <View style={styles.pcQuote}>
                <Text style={styles.pcQuoteText}>
                  "Hafta sonu sabahlari pazar gezmek en buyuk mutlulugum"
                </Text>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, styles.abPass]}
          onPress={() => swipeLeft()}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M18 6L6 18M6 6l12 12"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.abSuper]}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 2l3.1 6.3 6.9.5-5 4.9 1.5 6.9L12 17l-6.5 3.6 1.5-6.9L2 8.8l6.9-.5L12 2z"
              stroke={Colors.blue}
              strokeWidth={1.8}
            />
          </Svg>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.abLike]}
          onPress={() => swipeRight()}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.5l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.6z"
              fill="rgba(26,15,0,0.8)"
            />
          </Svg>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.abBoost]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
              stroke={Colors.purple}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </Svg>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    color: Colors.gold,
  },
  agentMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderWidth: 1,
    borderColor: Colors.purpleBorderStrong,
    borderRadius: 99,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 11,
  },
  ambDot: {
    width: 7,
    height: 7,
    borderRadius: 50,
    backgroundColor: Colors.purple,
  },
  agentMatchText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.purpleMuted,
    letterSpacing: 0.3,
  },
  ambBadge: {
    backgroundColor: 'rgba(160,100,255,0.3)',
    borderRadius: 99,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ambBadgeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 9,
    color: Colors.purpleMuted,
    fontWeight: '700',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.white06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStack: {
    flex: 1,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  profileCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 26,
    overflow: 'hidden',
  },
  pcBack2: {
    transform: [{ scale: 0.90 }, { translateY: 20 }],
    zIndex: 0,
  },
  pcBack: {
    transform: [{ scale: 0.95 }, { translateY: 10 }],
    zIndex: 1,
  },
  pcFront: {
    zIndex: 2,
  },
  pcBg: {
    width: '100%',
    height: '100%',
  },
  cardSvg: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    opacity: 0.35,
  },
  agentScoreBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(124,58,237,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.5)',
    borderRadius: 99,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 10,
  },
  agentScoreText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: '#DEC4FF',
  },
  pcGrad: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
  },
  swipeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
  },
  likeStamp: {
    borderWidth: 3,
    borderColor: Colors.like,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 18,
    transform: [{ rotate: '-15deg' }],
  },
  likeText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.like,
  },
  nopeStamp: {
    borderWidth: 3,
    borderColor: Colors.nope,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 18,
    transform: [{ rotate: '15deg' }],
  },
  nopeText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.nope,
  },
  pcInfo: {
    position: 'absolute',
    bottom: 0,
    padding: 18,
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pcName: {
    ...Typography.cardName,
    color: Colors.white,
  },
  pcAge: {
    fontSize: 22,
    color: Colors.white65,
    fontWeight: '300',
    marginLeft: 8,
  },
  pcLoc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.white45,
    marginTop: 4,
  },
  pcTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  pcTag: {
    backgroundColor: Colors.white10,
    borderWidth: 1,
    borderColor: Colors.white10,
    borderRadius: 99,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  pcTagText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.white80,
  },
  pcQuote: {
    marginTop: 10,
    backgroundColor: Colors.white06,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pcQuoteText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abPass: {
    backgroundColor: Colors.white06,
    borderWidth: 1.5,
    borderColor: Colors.white10,
  },
  abSuper: {
    backgroundColor: 'rgba(100,160,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(100,160,255,0.2)',
  },
  abLike: {
    backgroundColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  abBoost: {
    backgroundColor: 'rgba(160,100,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(160,100,255,0.2)',
  },
});
