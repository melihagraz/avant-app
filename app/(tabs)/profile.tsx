import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Ellipse, Path, Circle as SvgCircle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Typography } from '../../src/theme';

const INTERESTS = [
  { emoji: '🧬', label: 'Arastirma' },
  { emoji: '✈️', label: 'Seyahat' },
  { emoji: '☕', label: 'Kafe' },
  { emoji: '🎵', label: 'Muzik' },
  { emoji: '📚', label: 'Kitap' },
];

const INFO_ITEMS = [
  { label: 'Boy', value: '182 cm' },
  { label: 'Egitim', value: 'Doktora' },
  { label: 'Niyet', value: 'Ciddi iliski' },
  { label: 'Cocuk', value: 'Isteyebilir' },
];

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <LinearGradient
            colors={['#3d2a4a', '#1a1228']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.hero}
          >
            <Svg
              style={styles.heroSvg}
              viewBox="0 0 340 300"
              fill="none"
            >
              <Ellipse cx={170} cy={110} rx={85} ry={95} fill="rgba(200,160,230,0.22)" />
              <Path d="M20 300C20 210 320 210 320 300" fill="rgba(200,160,230,0.18)" />
            </Svg>
          </LinearGradient>

          {/* Overlay gradient */}
          <LinearGradient
            colors={['transparent', Colors.surface]}
            start={{ x: 0.5, y: 0.45 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroOverlay}
          />

          <Pressable style={styles.editBtn}>
            <Text style={styles.editBtnText}>Duzenle</Text>
          </Pressable>

          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>Melih, 34</Text>
            <Text style={styles.heroSub}>Providence, RI - Arastirmaci</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Profile Strength */}
          <View style={styles.strengthCard}>
            <View>
              <Text style={styles.strengthLabel}>PROFIL GUCU</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.strengthVal}>%72 </Text>
                <Text style={styles.strengthSub}>Guclu</Text>
              </View>
            </View>
            <Svg width={50} height={50} viewBox="0 0 50 50">
              <SvgCircle cx={25} cy={25} r={20} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
              <SvgCircle
                cx={25}
                cy={25}
                r={20}
                fill="none"
                stroke={Colors.gold}
                strokeWidth={4}
                strokeDasharray="90 126"
                strokeDashoffset={31.5}
                strokeLinecap="round"
                rotation={-90}
                origin="25,25"
              />
            </Svg>
          </View>

          {/* About */}
          <Text style={styles.secTitle}>Hakkimda</Text>
          <Text style={styles.bioText}>
            Tip + veri bilimi karisimi bir arastirmaci. Seyahat etmeyi, yeni kafe kesfetmeyi ve uzun yuruyusleri severim. Ciddi iliski ariyorum.
          </Text>

          {/* Interests */}
          <Text style={styles.secTitle}>Ilgi Alanlari</Text>
          <View style={styles.tags}>
            {INTERESTS.map((i) => (
              <View key={i.label} style={styles.tag}>
                <Text style={styles.tagText}>{i.emoji} {i.label}</Text>
              </View>
            ))}
          </View>

          {/* Info Grid */}
          <Text style={styles.secTitle}>Temel Bilgiler</Text>
          <View style={styles.infoGrid}>
            {INFO_ITEMS.map((item) => (
              <View key={item.label} style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>{item.label}</Text>
                <Text style={styles.infoCellVal}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  scroll: {
    flex: 1,
  },
  heroContainer: {
    height: 300,
    position: 'relative',
  },
  hero: {
    flex: 1,
    position: 'relative',
  },
  heroSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.35,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  editBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: Colors.white15,
    borderRadius: 99,
    paddingVertical: 5,
    paddingHorizontal: 14,
    zIndex: 2,
  },
  editBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.white80,
  },
  heroInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    zIndex: 1,
  },
  heroName: {
    fontFamily: Fonts.heading,
    fontSize: 30,
    color: Colors.white,
  },
  heroSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  body: {
    padding: 20,
    paddingBottom: 90,
  },
  strengthCard: {
    backgroundColor: 'rgba(232,184,109,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(232,184,109,0.15)',
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 18,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strengthLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.goldMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  strengthVal: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.gold,
  },
  strengthSub: {
    fontSize: 13,
    color: Colors.white35,
    fontWeight: '400',
  },
  secTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.white30,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bioText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.68)',
    lineHeight: 23,
    marginBottom: 20,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  tag: {
    backgroundColor: Colors.white05,
    borderWidth: 1,
    borderColor: Colors.white10,
    borderRadius: 99,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  tagText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.white65,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoCell: {
    backgroundColor: Colors.white04,
    borderRadius: 12,
    padding: 11,
    paddingHorizontal: 14,
    width: '48%',
  },
  infoCellLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.white30,
    marginBottom: 3,
  },
  infoCellVal: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.white80,
  },
});
