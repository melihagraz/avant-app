// components/DiscoverProfileCard.tsx
// Profile card rendered inside SwipeDeck for Discover feed.
// Shows photo, name, age, city + one highlighted prompt.
import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = 560;

export interface DiscoverProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  photos: string[];
  prompts?: Array<{ key: string; answer: string }>;
  dating_intention?: string;
  family_plans?: string;
  education?: string;
  religion?: string;
  job?: string;
}

interface Props {
  profile: DiscoverProfile;
}

export default function DiscoverProfileCard({ profile }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const hasPhoto = profile.photos?.length > 0;
  const firstPrompt = profile.prompts?.[0];

  return (
    <View style={[s.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      <View style={s.photoWrap}>
        {hasPhoto ? (
          <Image source={{ uri: profile.photos[0] }} style={s.photo} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={colors.accentGradient as any}
            style={s.photoPlaceholder}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={s.silhouette}>
              <Ionicons name="person" size={88} color="rgba(255,255,255,0.5)" />
            </View>
          </LinearGradient>
        )}

        {/* Dark gradient overlay at bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(5,6,15,0.92)']}
          style={s.overlay}
        >
          <View style={s.overlayContent}>
            <Text style={s.name}>
              {profile.name}
              <Text style={s.age}>, {profile.age}</Text>
            </Text>
            {profile.city ? (
              <View style={s.cityRow}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={s.city}>{profile.city}</Text>
              </View>
            ) : null}
            {profile.job ? (
              <View style={s.cityRow}>
                <Text style={s.jobIcon}>💼</Text>
                <Text style={s.city}>{profile.job}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        {/* Photo count indicator */}
        {profile.photos && profile.photos.length > 1 && (
          <View style={s.photoCountBadge}>
            <Ionicons name="images-outline" size={14} color="#fff" />
            <Text style={s.photoCountText}>{profile.photos.length}</Text>
          </View>
        )}
      </View>

      {/* Prompt preview below photo (if available) */}
      {firstPrompt && (
        <View style={[s.promptCard, { backgroundColor: colors.inputBg }]}>
          <Text style={[s.promptKey, { color: colors.userBubble }]} numberOfLines={1}>
            {t(`prompts.pool.${firstPrompt.key}`, { defaultValue: firstPrompt.key })}
          </Text>
          <Text style={[s.promptAnswer, { color: colors.textPrimary }]} numberOfLines={2}>
            {firstPrompt.answer}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 32,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 36,
    elevation: 14,
  },
  photoWrap: {
    flex: 1,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouette: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  overlayContent: { gap: 6 },
  name: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.8,
  },
  age: {
    fontSize: 28,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  city: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  jobIcon: {
    fontSize: 13,
  },
  photoCountBadge: {
    position: 'absolute',
    top: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  promptCard: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    padding: 14,
    borderRadius: 20,
  },
  promptKey: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  promptAnswer: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
});
