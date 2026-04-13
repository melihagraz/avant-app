import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Typography } from '../../src/theme';
import { useFiltersStore } from '../../src/stores/filtersStore';
import { useDiscoverStore } from '../../src/stores/discoverStore';

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Pressable
      style={[styles.toggle, on && styles.toggleOn]}
      onPress={onToggle}
    >
      <View style={[styles.toggleKnob, on && styles.toggleKnobOn]} />
    </Pressable>
  );
}

export default function FiltersScreen() {
  const router = useRouter();
  const filters = useFiltersStore();
  const { fetchFeed } = useDiscoverStore();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Filtreler</Text>
        <Pressable onPress={() => filters.reset()}>
          <Text style={styles.reset}>Sifirla</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Discovery Settings */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Kesfet Ayarlari</Text>

          <View style={styles.item}>
            <View style={styles.itemCol}>
              <Text style={styles.itemLabel}>Konum</Text>
              <Text style={styles.itemSub}>Providence, RI</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>

          {/* Distance Range */}
          <View style={[styles.item, styles.itemColumn]}>
            <View style={styles.rangeRow}>
              <Text style={styles.itemLabel}>Mesafe</Text>
              <Text style={styles.rangeVal}>25 km</Text>
            </View>
            <View style={styles.rangeTrack}>
              <View style={[styles.rangeFill, { width: '38%' }]} />
            </View>
            <View style={styles.rangeLabels}>
              <Text style={styles.rangeLabel}>1 km</Text>
              <Text style={styles.rangeLabel}>100 km</Text>
            </View>
          </View>

          {/* Age Range */}
          <View style={[styles.item, styles.itemColumn]}>
            <View style={styles.rangeRow}>
              <Text style={styles.itemLabel}>Yas Araligi</Text>
              <Text style={styles.rangeVal}>24-35</Text>
            </View>
            <View style={styles.rangeTrack}>
              <View style={styles.rangeMulti}>
                <View style={[styles.rangeFillAbsolute, { left: '15%', width: '44%' }]} />
              </View>
            </View>
            <View style={styles.rangeLabels}>
              <Text style={styles.rangeLabel}>18</Text>
              <Text style={styles.rangeLabel}>60+</Text>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Tercihler</Text>

          <View style={styles.item}>
            <View style={styles.itemCol}>
              <Text style={styles.itemLabel}>Cinsiyet</Text>
              <Text style={styles.itemSub}>Kadin</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>

          <View style={styles.item}>
            <View style={styles.itemCol}>
              <Text style={styles.itemLabel}>Iliski niyeti</Text>
              <Text style={styles.itemSub}>Ciddi iliski</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>
        </View>

        {/* Premium */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Gelismis — Premium</Text>

          <View style={styles.item}>
            <View style={styles.itemCol}>
              <Text style={styles.itemLabel}>Egitim seviyesi</Text>
              <Text style={[styles.itemSub, { color: Colors.gold }]}>Premium gerekli</Text>
            </View>
            <Text style={{ fontSize: 18 }}>🔒</Text>
          </View>

          <View style={styles.item}>
            <View style={styles.itemCol}>
              <Text style={styles.itemLabel}>Cocuk tercihi</Text>
              <Text style={[styles.itemSub, { color: Colors.gold }]}>Premium gerekli</Text>
            </View>
            <Text style={{ fontSize: 18 }}>🔒</Text>
          </View>

          <View style={styles.item}>
            <View style={styles.itemCol}>
              <Text style={styles.itemLabel}>Dogrulanmis profiller</Text>
              <Text style={styles.itemSub}>Sadece dogrulanmislar</Text>
            </View>
            <Toggle on={filters.verifiedOnly} onToggle={() => filters.setFilter('verifiedOnly', !filters.verifiedOnly)} />
          </View>
        </View>

        {/* Apply button */}
        <Pressable onPress={async () => { await filters.persist(); fetchFeed(); router.back(); }} style={{ marginTop: 8, marginBottom: 24 }}>
          {({ pressed }) => (
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.btnPrimary, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.btnText}>Uygula →</Text>
            </LinearGradient>
          )}
        </Pressable>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 26,
    color: Colors.white,
  },
  reset: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.gold,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  group: {
    marginBottom: 24,
  },
  groupTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.white28,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  item: {
    backgroundColor: Colors.white04,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  itemCol: {
    gap: 2,
  },
  itemLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.white85,
  },
  itemSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.white35,
  },
  arrow: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.25)',
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeVal: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.gold,
  },
  rangeTrack: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.white10,
    borderRadius: 99,
    overflow: 'hidden',
  },
  rangeFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: Colors.gold,
  },
  rangeMulti: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  rangeFillAbsolute: {
    position: 'absolute',
    height: '100%',
    borderRadius: 99,
    backgroundColor: Colors.gold,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.white30,
  },
  toggle: {
    width: 46,
    height: 27,
    borderRadius: 14,
    backgroundColor: Colors.white10,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: Colors.gold,
  },
  toggleKnob: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    backgroundColor: Colors.white,
  },
  toggleKnobOn: {
    transform: [{ translateX: 19 }],
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
