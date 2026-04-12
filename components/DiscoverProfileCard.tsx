// components/DiscoverProfileCard.tsx
// Full-screen Muzz-quality profile card for Discover feed
import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.72;

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

// Relationship intention label
const intentionLabels: Record<string, string> = {
  life_partner: 'Life partner',
  long_term: 'Long-term',
  long_open_short: 'Long, open to short',
  short_open_long: 'Short, open to long',
  short_term: 'Short-term',
  figuring_out: 'Figuring out',
  serious: 'Serious',
  casual: 'Casual',
  open: 'Open',
};

export default function DiscoverProfileCard({ profile }: Props) {
  const { colors } = useTheme();
  const hasPhoto = profile.photos?.length > 0;

  // Build tag list (max 4-5 pills)
  const tags: Array<{ icon: string; label: string }> = [];
  if (profile.city) tags.push({ icon: 'location', label: profile.city });
  if (profile.job) tags.push({ icon: 'briefcase', label: profile.job });
  if (profile.education) tags.push({ icon: 'school', label: profile.education });
  if (profile.religion) tags.push({ icon: 'moon', label: profile.religion });
  if (profile.dating_intention && intentionLabels[profile.dating_intention]) {
    tags.push({ icon: 'heart', label: intentionLabels[profile.dating_intention] });
  }

  return (
    <View style={s.card}>
      {/* Full-bleed photo */}
      {hasPhoto ? (
        <Image source={{ uri: profile.photos[0] }} style={s.photo} resizeMode="cover" />
      ) : (
        <LinearGradient colors={colors.accentGradient as any} style={s.photo}>
          <View style={s.silhouette}>
            <Ionicons name="person" size={120} color="rgba(255,255,255,0.4)" />
          </View>
        </LinearGradient>
      )}

      {/* Top "Active today" pill */}
      <View style={s.topPill}>
        <View style={s.greenDot} />
        <Text style={s.topPillText}>Active today</Text>
      </View>

      {/* Photo count indicator top-right */}
      {profile.photos && profile.photos.length > 1 && (
        <View style={s.photoCountBadge}>
          <Ionicons name="images" size={13} color="#fff" />
          <Text style={s.photoCountText}>{profile.photos.length}</Text>
        </View>
      )}

      {/* Strong bottom gradient */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(0,0,0,0.2)',
          'rgba(0,0,0,0.85)',
          'rgba(0,0,0,0.96)',
        ]}
        locations={[0, 0.4, 0.75, 1]}
        style={s.gradientOverlay}
      >
        <View style={s.infoBlock}>
          {/* Name + age + verified */}
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>
              {profile.name}{' '}
              <Text style={s.age}>{profile.age}</Text>
            </Text>
            <Ionicons name="checkmark-circle" size={22} color="#3B82F6" />
          </View>

          {/* Distance / location (uppercase small) */}
          {profile.city ? (
            <View style={s.locRow}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={s.locText}>{profile.city.toUpperCase()}</Text>
            </View>
          ) : null}

          {/* Tag chips */}
          <View style={s.tagsWrap}>
            {tags.slice(0, 5).map((tag, i) => (
              <View key={i} style={s.tagChip}>
                <Ionicons name={tag.icon as any} size={12} color="rgba(255,255,255,0.95)" />
                <Text style={s.tagText} numberOfLines={1}>
                  {tag.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 16,
  },
  photo: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouette: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  topPill: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  topPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },

  photoCountBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
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

  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 80,
  },
  infoBlock: { gap: 10 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
    flexShrink: 1,
  },
  age: {
    fontSize: 32,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  locText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.8,
  },

  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
    maxWidth: 140,
  },
});
