// components/StarterCards.tsx
// Shown in HumanChat when the conversation is empty. Lets the user send
// one of the agent-derived starters in a single tap, or type their own.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';
import type { StarterCard } from '../lib/matchInsights';

interface Props {
  starters: StarterCard[];
  onPick: (text: string) => void;
  onDismiss?: () => void;
}

export default function StarterCards({ starters, onPick, onDismiss }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (starters.length === 0) return null;

  return (
    <View style={s.wrap}>
      <LinearGradient
        colors={colors.accentGradient as any}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={s.headerPill}
      >
        <Text style={s.headerTxt}>✨ {t('starterCards.header')}</Text>
      </LinearGradient>

      <Text style={[s.subTxt, { color: colors.textSecondary }]}>
        {t('starterCards.sub')}
      </Text>

      <View style={s.list}>
        {starters.map((starter, i) => (
          <TouchableOpacity
            key={i}
            style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
            onPress={() => onPick(starter.text)}
            activeOpacity={0.85}
          >
            <Text style={[s.cardText, { color: colors.textPrimary }]}>{starter.text}</Text>
            {!!starter.based_on && (
              <View style={[s.basedOnPill, { backgroundColor: colors.inputBg }]}>
                <Text style={[s.basedOnTxt, { color: colors.textSecondary }]}>
                  {t('starterCards.basedOn', { topic: starter.based_on })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={s.dismissBtn}>
          <Text style={[s.dismissTxt, { color: colors.textSecondary }]}>
            {t('starterCards.dismiss')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 16,
  },
  headerPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 100,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subTxt: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  list: {
    width: '100%',
    gap: 10,
  },
  card: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  basedOnPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  basedOnTxt: {
    fontSize: 11,
    fontWeight: '700',
  },
  dismissBtn: {
    marginTop: 12,
    padding: 6,
  },
  dismissTxt: {
    fontSize: 12,
    fontWeight: '600',
  },
});
