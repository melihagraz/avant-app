// screens/AgentNamingScreen.tsx
// Post-onboarding: user gives their agent a name and avatar emoji
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { FONT_HEADING, FONT_BODY_SEMIBOLD, FONT_BODY_MEDIUM } from '../lib/fonts';

const SUGGESTED_NAMES = ['Aria', 'Luna', 'Nexus', 'Iris', 'Orion', 'Kai', 'Zara', 'Echo'];
const AVATAR_EMOJIS = ['\u{1F916}', '\u2728', '\u{1F31F}', '\u{1F52E}', '\u{1F9E0}', '\u{1F525}', '\u{1F4AB}', '\u{1F308}'];

export default function AgentNamingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('\u{1F916}');
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true }),
    ]).start();
    trackEvent('agent_naming_view');
  }, []);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert('Isim cok kisa', 'Agent\'ina en az 2 karakterli bir isim ver.');
      return;
    }
    if (trimmed.length > 20) {
      Alert.alert('Isim cok uzun', 'En fazla 20 karakter.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('agents')
        .update({ name: trimmed, avatar_emoji: emoji })
        .eq('user_id', user.id);

      if (error) throw error;

      trackEvent('agent_named', { name: trimmed });
      navigation.replace('Main');
    } catch (err) {
      captureError(err, { context: 'save_agent_name' });
      Alert.alert('Hata', 'Isim kaydedilemedi, tekrar dene.');
      setSaving(false);
    }
  };

  return (
    <View style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View
            style={[
              s.content,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Header illustration */}
            <View style={s.heroWrap}>
              <LinearGradient
                colors={['#7c3aed', '#A064FF']}
                style={s.emojiCircle}
              >
                <Text style={s.emojiText}>{emoji}</Text>
              </LinearGradient>
            </View>

            {/* Title */}
            <Text style={s.title}>Agent'ina bir isim ver</Text>
            <Text style={s.subtitle}>
              O senin kisisel AI asistanin.{'\n'}Seni temsil edecek, sana uygun insanlari bulacak.
            </Text>

            {/* Input */}
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Ornek: Aria"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoFocus
                maxLength={20}
              />
            </View>

            {/* Suggested names */}
            <Text style={s.sectionLabel}>ONERILER</Text>
            <View style={s.chipRow}>
              {SUGGESTED_NAMES.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[s.chip, name === n && s.chipActive]}
                  onPress={() => setName(n)}
                >
                  <Text style={[s.chipText, name === n && s.chipTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Avatar emoji picker */}
            <Text style={s.sectionLabel}>AVATAR</Text>
            <View style={s.emojiRow}>
              {AVATAR_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[s.emojiPickBtn, emoji === e && s.emojiPickBtnActive]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={s.emojiPickText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* CTA */}
          <View style={s.ctaWrap}>
            <TouchableOpacity
              onPress={save}
              disabled={saving || name.trim().length < 2}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={
                  name.trim().length < 2
                    ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
                    : (colors.goldGradient as any)
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.ctaBtn}
              >
                {saving ? (
                  <ActivityIndicator color="#1a0f00" />
                ) : (
                  <Text style={[s.ctaText, name.trim().length < 2 && { color: 'rgba(255,255,255,0.3)' }]}>
                    {name.trim().length >= 2 ? `Tanistik, ${name.trim()}! \u2192` : 'Bir isim sec'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0D0D14' },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  emojiCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A064FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 12,
  },
  emojiText: {
    fontSize: 50,
  },
  title: {
    fontFamily: FONT_HEADING,
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  inputWrap: {
    marginBottom: 28,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(232,184,109,0.3)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: '#fff',
    fontFamily: FONT_BODY_MEDIUM,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.1,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99,
  },
  chipActive: {
    backgroundColor: 'rgba(232,184,109,0.15)',
    borderColor: '#E8B86D',
  },
  chipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: FONT_BODY_MEDIUM,
  },
  chipTextActive: {
    color: '#E8B86D',
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emojiPickBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiPickBtnActive: {
    backgroundColor: 'rgba(160,100,255,0.2)',
    borderColor: '#A064FF',
  },
  emojiPickText: {
    fontSize: 24,
  },
  ctaWrap: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  ctaBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a0f00',
    fontFamily: FONT_BODY_SEMIBOLD,
  },
});
