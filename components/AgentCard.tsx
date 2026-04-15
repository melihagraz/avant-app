// components/AgentCard.tsx
// Agent dashboard card shown on the Profile screen
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAgent } from '../lib/useAgent';
import { FONT_HEADING, FONT_BODY_SEMIBOLD, FONT_BODY_MEDIUM } from '../lib/fonts';

interface Props {
  onPress?: () => void;
}

export default function AgentCard({ onPress }: Props) {
  const { agent } = useAgent();

  if (!agent) return null;

  const stats = [
    { label: 'Konusma', value: agent.interactions_count || 0, icon: 'chatbubbles-outline' },
    { label: 'Match', value: agent.matches_found || 0, icon: 'heart-outline' },
    { label: 'Oneri', value: agent.messages_suggested || 0, icon: 'bulb-outline' },
  ];

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s.wrapper}>
      <LinearGradient
        colors={['rgba(124,58,237,0.15)', 'rgba(160,100,255,0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.card}
      >
        {/* Header row */}
        <View style={s.headerRow}>
          <LinearGradient
            colors={['#7c3aed', '#A064FF']}
            style={s.avatar}
          >
            <Text style={s.avatarEmoji}>{agent.avatar_emoji}</Text>
          </LinearGradient>

          <View style={s.headerInfo}>
            <Text style={s.agentName}>{agent.name}</Text>
            <Text style={s.agentLabel}>SENIN AGENT'IN</Text>
          </View>

          <View style={s.proBadge}>
            <Text style={s.proBadgeText}>PRO</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={s.statItem}>
              <Ionicons name={stat.icon as any} size={14} color="#A064FF" />
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Action hint */}
        <View style={s.actionHint}>
          <Text style={s.actionHintText}>
            {agent.name}, seni temsil ediyor ve uygun insanlari ariyor.
          </Text>
          {onPress && (
            <Ionicons name="chevron-forward" size={16} color="rgba(160,100,255,0.6)" />
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.25)',
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  headerInfo: {
    flex: 1,
  },
  agentName: {
    fontFamily: FONT_HEADING,
    fontSize: 24,
    color: '#fff',
  },
  agentLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(160,100,255,0.7)',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  proBadge: {
    backgroundColor: '#A064FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.05,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 18,
    color: '#fff',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: FONT_BODY_MEDIUM,
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionHintText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 17,
  },
});
