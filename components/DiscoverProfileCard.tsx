// components/DiscoverProfileCard.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { FONT_HEADING, FONT_BODY_MEDIUM } from '../lib/fonts';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 28;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.62;

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
  agent_score?: number;
}

interface Props {
  profile: DiscoverProfile;
}

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

  const tags: string[] = [];
  if (profile.job) tags.push(profile.job);
  if (profile.education) tags.push(profile.education);
  if (profile.dating_intention && intentionLabels[profile.dating_intention]) {
    tags.push(intentionLabels[profile.dating_intention]);
  }

  const firstPrompt = profile.prompts?.[0];

  return (
    <View style={s.card}>
      {hasPhoto ? (
        <Image source={{ uri: profile.photos[0] }} style={s.photo} resizeMode="cover" />
      ) : (
        <View style={s.placeholderBg}>
          <View style={s.silhouette}>
            <Ionicons name="person" size={100} color="rgba(255,255,255,0.3)" />
          </View>
        </View>
      )}

      {/* Agent compat score badge */}
      {profile.agent_score && profile.agent_score > 0 && (
        <View style={s.agentScoreBadge}>
          <Ionicons name="checkmark-circle" size={12} color="#C09AFF" />
          <Text style={s.agentScoreText}>%{profile.agent_score} uyumlu</Text>
        </View>
      )}

      {/* Photo count */}
      {profile.photos && profile.photos.length > 1 && (
        <View style={s.photoCount}>
          <Ionicons name="images" size={12} color="#fff" />
          <Text style={s.photoCountText}>{profile.photos.length}</Text>
        </View>
      )}

      {/* Bottom gradient + info */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.93)']}
        locations={[0, 0.35, 1]}
        style={s.gradient}
      >
        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={s.name}>{profile.name}</Text>
            <Text style={s.age}>{profile.age}</Text>
          </View>

          {profile.city && (
            <Text style={s.location}>
              {'\u{1F4CD}'} {profile.city}
            </Text>
          )}

          {tags.length > 0 && (
            <View style={s.tagsRow}>
              {tags.slice(0, 3).map((tag, i) => (
                <View key={i} style={s.tag}>
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {firstPrompt && (
            <View style={s.quote}>
              <Text style={s.quoteText} numberOfLines={2}>
                "{firstPrompt.answer}"
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1a1228',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placeholderBg: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2d1f3d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouette: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentScoreBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(124, 58, 237, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(160, 100, 255, 0.5)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 10,
  },
  agentScoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DEC4FF',
  },
  photoCount: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  photoCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 80,
  },
  info: {
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  name: {
    fontFamily: FONT_HEADING,
    fontSize: 28,
    color: '#fff',
  },
  age: {
    fontSize: 22,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.65)',
  },
  location: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: FONT_BODY_MEDIUM,
  },
  quote: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quoteText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
});
