// components/ContextTags.tsx
// Horizontal chips shown at the top of HumanChat. Each chip is a topic the
// two agents discussed. Tapping a chip drops its starter text into the input.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';
import type { ContextTag } from '../lib/matchInsights';

interface Props {
  tags: ContextTag[];
  onPick?: (tag: ContextTag) => void;
}

export default function ContextTags({ tags, onPick }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (tags.length === 0) return null;

  return (
    <View style={[s.wrap, { backgroundColor: colors.inputBg, borderBottomColor: colors.separator }]}>
      <Text style={[s.caption, { color: colors.textSecondary }]}>
        {t('contextTags.caption')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {tags.map((tag, i) => {
          const content = (
            <View style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={s.emoji}>{tag.emoji}</Text>
              <Text style={[s.label, { color: colors.textPrimary }]}>{tag.label}</Text>
            </View>
          );
          if (onPick) {
            return (
              <TouchableOpacity key={i} onPress={() => onPick(tag)} activeOpacity={0.7}>
                {content}
              </TouchableOpacity>
            );
          }
          return <View key={i}>{content}</View>;
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  caption: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  row: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 8,
  },
  emoji: { fontSize: 14 },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
