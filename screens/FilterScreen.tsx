// screens/FilterScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';
import { FONT_HEADING, FONT_BODY_SEMIBOLD, FONT_BODY_MEDIUM } from '../lib/fonts';

const FILTER_KEY = '@avant_filters';

interface Filters {
  location: string;
  distance: number;
  ageMin: number;
  ageMax: number;
  gender: string;
  intent: string;
  verifiedOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  location: 'Providence, RI',
  distance: 25,
  ageMin: 24,
  ageMax: 35,
  gender: 'female',
  intent: 'serious',
  verifiedOnly: true,
};

export default function FilterScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    try {
      const stored = await AsyncStorage.getItem(FILTER_KEY);
      if (stored) setFilters(JSON.parse(stored));
    } catch {}
  };

  const saveAndApply = async () => {
    try {
      await AsyncStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    } catch {}
    navigation.goBack();
  };

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const genderLabel = (g: string) => {
    const map: Record<string, string> = { male: 'Erkek', female: 'Kadin', any: 'Herkes' };
    return map[g] || g;
  };

  const intentLabel = (i: string) => {
    const map: Record<string, string> = {
      serious: 'Ciddi iliski', casual: 'Rahat', life_partner: 'Hayat arkadasi',
      long_term: 'Uzun vadeli', figuring_out: 'Kesfediyorum',
    };
    return map[i] || i;
  };

  return (
    <View style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={s.title}>Filtreler</Text>
          <TouchableOpacity onPress={reset}>
            <Text style={s.reset}>Sifirla</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {/* Discovery settings */}
          <View style={s.group}>
            <Text style={s.groupTitle}>KESIF AYARLARI</Text>

            <View style={s.item}>
              <View style={s.itemCol}>
                <Text style={s.itemLabel}>Konum</Text>
                <Text style={s.itemSub}>{filters.location}</Text>
              </View>
              <Text style={s.arrow}>{'\u203A'}</Text>
            </View>

            {/* Distance */}
            <View style={[s.item, s.itemColumn]}>
              <View style={s.rangeHeader}>
                <Text style={s.itemLabel}>Mesafe</Text>
                <Text style={s.rangeVal}>{filters.distance} km</Text>
              </View>
              <View style={s.track}>
                <View style={[s.trackFill, { width: `${(filters.distance / 100) * 100}%` }]} />
              </View>
              <View style={s.rangeLabels}>
                <Text style={s.rangeLabelText}>1 km</Text>
                <Text style={s.rangeLabelText}>100 km</Text>
              </View>
            </View>

            {/* Age range */}
            <View style={[s.item, s.itemColumn]}>
              <View style={s.rangeHeader}>
                <Text style={s.itemLabel}>Yas Araligi</Text>
                <Text style={s.rangeVal}>{filters.ageMin}–{filters.ageMax}</Text>
              </View>
              <View style={s.track}>
                <View
                  style={[
                    s.trackFillRange,
                    {
                      left: `${((filters.ageMin - 18) / 42) * 100}%`,
                      width: `${((filters.ageMax - filters.ageMin) / 42) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={s.rangeLabels}>
                <Text style={s.rangeLabelText}>18</Text>
                <Text style={s.rangeLabelText}>60+</Text>
              </View>
            </View>
          </View>

          {/* Preferences */}
          <View style={s.group}>
            <Text style={s.groupTitle}>TERCIHLER</Text>

            <View style={s.item}>
              <View style={s.itemCol}>
                <Text style={s.itemLabel}>Cinsiyet</Text>
                <Text style={s.itemSub}>{genderLabel(filters.gender)}</Text>
              </View>
              <Text style={s.arrow}>{'\u203A'}</Text>
            </View>

            <View style={s.item}>
              <View style={s.itemCol}>
                <Text style={s.itemLabel}>Iliski niyeti</Text>
                <Text style={s.itemSub}>{intentLabel(filters.intent)}</Text>
              </View>
              <Text style={s.arrow}>{'\u203A'}</Text>
            </View>
          </View>

          {/* Advanced - Premium */}
          <View style={s.group}>
            <Text style={s.groupTitle}>GELISMIS — PREMIUM</Text>

            <View style={s.item}>
              <View style={s.itemCol}>
                <Text style={s.itemLabel}>Egitim seviyesi</Text>
                <Text style={[s.itemSub, s.goldText]}>Premium gerekli</Text>
              </View>
              <Text style={s.lockIcon}>{'\u{1F512}'}</Text>
            </View>

            <View style={s.item}>
              <View style={s.itemCol}>
                <Text style={s.itemLabel}>Cocuk tercihi</Text>
                <Text style={[s.itemSub, s.goldText]}>Premium gerekli</Text>
              </View>
              <Text style={s.lockIcon}>{'\u{1F512}'}</Text>
            </View>

            <View style={s.item}>
              <View style={s.itemCol}>
                <Text style={s.itemLabel}>Dogrulanmis profiller</Text>
                <Text style={s.itemSub}>Sadece dogrulanmislar</Text>
              </View>
              <Switch
                value={filters.verifiedOnly}
                onValueChange={(v) => setFilters({ ...filters, verifiedOnly: v })}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#E8B86D' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Apply button */}
          <TouchableOpacity onPress={saveAndApply} activeOpacity={0.85} style={{ marginTop: 8 }}>
            <LinearGradient
              colors={colors.goldGradient as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.applyBtn}
            >
              <Text style={s.applyBtnText}>Uygula {'\u2192'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0D0D14' },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    fontFamily: FONT_HEADING,
    fontSize: 26,
    color: '#fff',
  },
  reset: {
    fontSize: 13,
    color: '#E8B86D',
    fontWeight: '500',
    fontFamily: FONT_BODY_MEDIUM,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  group: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 0.08,
    marginBottom: 10,
  },

  item: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
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
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    fontFamily: FONT_BODY_MEDIUM,
  },
  itemSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
  },
  goldText: {
    color: '#E8B86D',
  },
  arrow: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.25)',
  },
  lockIcon: {
    fontSize: 18,
  },

  // Range controls
  rangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeVal: {
    fontSize: 13,
    color: '#E8B86D',
    fontWeight: '500',
  },
  track: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99,
    position: 'relative',
  },
  trackFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#E8B86D',
  },
  trackFillRange: {
    position: 'absolute',
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#E8B86D',
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabelText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },

  // Apply
  applyBtn: {
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a0f00',
    fontFamily: FONT_BODY_SEMIBOLD,
  },
});
