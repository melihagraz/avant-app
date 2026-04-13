import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../lib/theme';
import { FONT_BODY_SEMIBOLD } from '../lib/fonts';

const TAB_CONFIG = [
  { name: 'Discover', icon: 'heart', label: 'Kesfet' },
  { name: 'Chat', icon: 'chatbubble', label: 'Sohbet' },
  { name: 'Profile', icon: 'person', label: 'Profil' },
] as const;

export default function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <BlurView intensity={80} tint="dark" style={styles.blur}>
        <View style={[styles.container, { borderColor: colors.borderLight }]}>
          {TAB_CONFIG.map((tab, index) => {
            const isFocused = state.index === index;
            const route = state.routes[index];
            const badge = route.params && (route.params as any).badge;

            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tab}
                activeOpacity={0.7}
                onPress={() => {
                  if (!isFocused) {
                    navigation.navigate(tab.name);
                  }
                }}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={isFocused ? tab.icon : (`${tab.icon}-outline` as any)}
                    size={22}
                    color={isFocused ? colors.accentGold : colors.tabInactive}
                  />
                  {badge > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.accentGold }]}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.label,
                    {
                      color: isFocused ? colors.accentGold : colors.tabInactive,
                      fontFamily: FONT_BODY_SEMIBOLD,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
                {isFocused && (
                  <View style={[styles.dot, { backgroundColor: colors.accentGold }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  blur: {
    borderRadius: 32,
    overflow: 'hidden',
  },
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 32,
    borderWidth: 1,
    backgroundColor: 'rgba(13, 13, 20, 0.85)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  iconWrap: {
    position: 'relative',
  },
  label: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.04,
  },
  dot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1a0f00',
  },
});
