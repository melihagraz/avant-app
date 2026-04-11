// components/SuperLikeModal.tsx
// Bottom sheet for writing a super like comment.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';
import { moderateText, getModerationMessage } from '../lib/moderation';
import type { DiscoverProfile } from './DiscoverProfileCard';

interface Props {
  profile: DiscoverProfile | null;
  visible: boolean;
  onClose: () => void;
  onSubmit: (comment: string, targetPromptKey: string | null) => void;
}

export default function SuperLikeModal({ profile, visible, onClose, onSubmit }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [selectedPromptKey, setSelectedPromptKey] = useState<string | null>(null);

  const reset = () => {
    setComment('');
    setSelectedPromptKey(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    const trimmed = comment.trim();
    if (trimmed.length < 5) return;

    // Moderation
    const modResult = moderateText(trimmed);
    if (!modResult.clean) {
      Alert.alert(t('common.error'), t(getModerationMessage(modResult.reason || '')));
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(trimmed, selectedPromptKey);
    reset();
  };

  if (!profile) return null;

  const canSubmit = comment.trim().length >= 5;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.overlay}
      >
        <TouchableOpacity style={s.backdrop} onPress={handleClose} activeOpacity={1} />

        <View style={[s.sheet, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
          <View style={s.handle} />

          <View style={s.titleRow}>
            <Text style={s.titleEmoji}>✨</Text>
            <Text style={[s.title, { color: colors.textPrimary }]}>{t('superLike.title')}</Text>
          </View>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            {t('superLike.subtitle')}
          </Text>

          {/* Profile prompts (selectable target) */}
          {profile.prompts && profile.prompts.length > 0 && (
            <View style={s.promptsList}>
              {profile.prompts.slice(0, 3).map((p) => {
                const isSelected = selectedPromptKey === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[
                      s.promptChip,
                      { backgroundColor: colors.inputBg, borderColor: colors.border },
                      isSelected && { borderColor: colors.accentPink },
                    ]}
                    onPress={() => setSelectedPromptKey(isSelected ? null : p.key)}
                  >
                    <Text style={[s.promptChipKey, { color: colors.textSecondary }]} numberOfLines={1}>
                      {t(`prompts.pool.${p.key}`, { defaultValue: p.key })}
                    </Text>
                    <Text style={[s.promptChipAnswer, { color: colors.textPrimary }]} numberOfLines={2}>
                      {p.answer}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TextInput
            style={[
              s.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder={t('superLike.commentPlaceholder')}
            placeholderTextColor={colors.placeholder}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={200}
            autoFocus
          />

          <Text style={[s.charCount, { color: colors.placeholder }]}>{comment.length}/200</Text>

          <View style={s.actions}>
            <TouchableOpacity onPress={handleClose} style={s.cancelBtn}>
              <Text style={[s.cancelTxt, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={[s.submitBtn, !canSubmit && { opacity: 0.4 }]}
            >
              <LinearGradient
                colors={colors.accentGradientAlt as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.submitGrad}
              >
                <Text style={s.submitTxt}>{t('superLike.submit')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 36,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  titleEmoji: {
    fontSize: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 18,
  },
  promptsList: {
    gap: 8,
    marginBottom: 16,
  },
  promptChip: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
  },
  promptChipKey: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  promptChipAnswer: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  input: {
    minHeight: 90,
    borderRadius: 18,
    borderWidth: 2,
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 14,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelTxt: {
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtn: {
    flex: 2,
    borderRadius: 26,
    overflow: 'hidden',
  },
  submitGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 26,
  },
  submitTxt: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
