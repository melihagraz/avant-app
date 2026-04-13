// screens/ProfileDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import CompatibilityBars from '../components/CompatibilityBars';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 480;

interface UserProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  photos: string[];
  relationship_type?: string;
  dating_intention?: string;
  family_plans?: string;
  education?: string;
  religion?: string;
  job?: string;
  prompts?: Array<{ key: string; answer: string }>;
}

interface MatchData {
  agent_a_score: number;
  agent_b_score: number;
  agent_a_reasoning: string;
  compatibility_breakdown: { values: number; communication: number; lifestyle: number; humor: number } | null;
}

export default function ProfileDetailScreen({ route, navigation }: any) {
  const { userId, matchId } = route.params;
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trackEvent('profile_detail_view', { user_id: userId, match_id: matchId });
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const [userRes, matchRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase
          .from('matches')
          .select('conversation:conversation_id(agent_a_score, agent_b_score, agent_a_reasoning, compatibility_breakdown)')
          .eq('id', matchId)
          .single(),
      ]);

      if (userRes.data) setUser(userRes.data);
      if (matchRes.data?.conversation) setMatch(matchRes.data.conversation as any);
    } catch (err) {
      captureError(err, { context: 'profile_detail_load', user_id: userId });
    } finally {
      setLoading(false);
    }
  };

  const openChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace('HumanChat', { matchId, otherUser: user });
  };

  const goBack = () => {
    Haptics.selectionAsync();
    navigation.goBack();
  };

  if (loading) {
    return (
      <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
        <SafeAreaView style={s.safeArea}>
          <View style={s.loadingWrap}>
            <ActivityIndicator color={colors.accentPink} size="large" />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
        <SafeAreaView style={s.safeArea}>
          <View style={s.loadingWrap}>
            <Text style={{ color: colors.textSecondary }}>{t('common.error')}</Text>
            <TouchableOpacity onPress={goBack} style={{ marginTop: 16 }}>
              <Text style={{ color: colors.accentPink, fontWeight: '700' }}>{t('profileDetail.back')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const hasPhoto = user.photos?.length > 0;
  const avgScore = match ? Math.round((match.agent_a_score + match.agent_b_score) / 2) : 0;
  const [mainPhoto, ...extraPhotos] = user.photos || [];

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero Photo */}
          <View style={s.heroWrap}>
            {hasPhoto ? (
              <Image source={{ uri: mainPhoto }} style={s.heroPhoto} />
            ) : (
              <LinearGradient colors={colors.accentGradient as any} style={s.heroPhoto}>
                <View style={s.silhouetteCircle}>
                  <Ionicons name="person" size={96} color="rgba(255,255,255,0.5)" />
                </View>
              </LinearGradient>
            )}
            {/* Dark gradient overlay at bottom */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={s.heroGradient}
            >
              <Text style={s.heroName}>
                {user.name}
                <Text style={s.heroAge}>, {user.age}</Text>
              </Text>
              {user.city ? <Text style={s.heroCity}>📍 {user.city}</Text> : null}
            </LinearGradient>

            {/* Back button */}
            <TouchableOpacity onPress={goBack} style={s.backBtn}>
              <View style={s.backBtnInner}>
                <Ionicons name="chevron-back" size={26} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Score badge */}
            {avgScore > 0 && (
              <View style={s.scoreBadge}>
                <LinearGradient
                  colors={colors.accentGradientAlt as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.scoreBadgeInner}
                >
                  <Text style={s.scoreNum}>{avgScore}</Text>
                </LinearGradient>
              </View>
            )}
          </View>

          {/* Compatibility Breakdown */}
          {match?.compatibility_breakdown && (
            <View style={[s.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>
                {t('profileDetail.compatibilityTitle')}
              </Text>
              <CompatibilityBars breakdown={match.compatibility_breakdown} />
            </View>
          )}

          {/* Agent reasoning */}
          {match?.agent_a_reasoning && (
            <View style={[s.agentCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[s.agentLabel, { color: colors.userBubble }]}>
                {t('profileDetail.agentSays')}
              </Text>
              <Text style={[s.agentText, { color: colors.textPrimary }]}>
                "{match.agent_a_reasoning}"
              </Text>
            </View>
          )}

          {/* Prompts */}
          {user.prompts && user.prompts.length > 0 && (
            <View style={[s.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>
                {t('profileDetail.promptsTitle')}
              </Text>
              <View style={s.promptsList}>
                {user.prompts.map((p, i) => (
                  <View key={i} style={[s.promptCard, { backgroundColor: colors.inputBg }]}>
                    <Text style={[s.promptQuestion, { color: colors.textSecondary }]}>
                      {t(`prompts.pool.${p.key}`, { defaultValue: p.key })}
                    </Text>
                    <Text style={[s.promptAnswer, { color: colors.textPrimary }]}>
                      {p.answer}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Extra photos */}
          {extraPhotos.length > 0 && extraPhotos.map((photo, i) => (
            <Image key={i} source={{ uri: photo }} style={s.extraPhoto} />
          ))}

          {/* Info section */}
          <View style={[s.section, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>
              {t('profileDetail.infoTitle')}
            </Text>
            {user.job ? (
              <View style={[s.infoRow, { borderBottomColor: colors.separator }]}>
                <Text style={[s.infoIcon]}>💼</Text>
                <Text style={[s.infoText, { color: colors.textPrimary }]}>{user.job}</Text>
              </View>
            ) : null}
            {user.education ? (
              <View style={[s.infoRow, { borderBottomColor: colors.separator }]}>
                <Text style={[s.infoIcon]}>🎓</Text>
                <Text style={[s.infoText, { color: colors.textPrimary }]}>{user.education}</Text>
              </View>
            ) : null}
            {user.religion ? (
              <View style={[s.infoRow, { borderBottomColor: colors.separator }]}>
                <Text style={[s.infoIcon]}>🙏</Text>
                <Text style={[s.infoText, { color: colors.textPrimary }]}>{user.religion}</Text>
              </View>
            ) : null}
          </View>

          {/* Bottom spacing for sticky action bar */}
          <View style={{ height: 110 }} />
        </ScrollView>

        {/* Sticky bottom action bar */}
        <View style={[s.actionBar, { backgroundColor: colors.card, borderTopColor: colors.separator }]}>
          <TouchableOpacity style={[s.passBtn, { borderColor: colors.border }]} onPress={goBack}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.chatBtn} onPress={openChat}>
            <LinearGradient
              colors={colors.accentGradientAlt as any}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.chatBtnGrad}
            >
              <Text style={s.chatBtnTxt}>{t('profileDetail.sendMessage')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 20 },

  heroWrap: {
    width: SCREEN_WIDTH, height: HERO_HEIGHT, position: 'relative',
  },
  heroPhoto: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  silhouetteCircle: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 200,
    justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 28,
  },
  heroName: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroAge: { fontSize: 28, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  heroCity: { fontSize: 16, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 4 },

  backBtn: { position: 'absolute', top: 16, left: 16 },
  backBtnInner: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  scoreBadge: {
    position: 'absolute', top: 16, right: 16, borderRadius: 28, overflow: 'hidden',
    shadowColor: '#E8B86D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  scoreBadgeInner: {
    paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', borderRadius: 28,
  },
  scoreNum: { fontSize: 24, fontWeight: '900', color: '#fff' },

  section: {
    margin: 20, marginTop: 16, borderRadius: 28, padding: 22,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14, letterSpacing: -0.3 },

  agentCard: {
    marginHorizontal: 20, marginTop: 8, borderRadius: 22, padding: 18,
    borderLeftWidth: 4,
  },
  agentLabel: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  agentText: { fontSize: 15, lineHeight: 22, fontStyle: 'italic' },

  promptsList: { gap: 12 },
  promptCard: { borderRadius: 18, padding: 16 },
  promptQuestion: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  promptAnswer: { fontSize: 16, lineHeight: 22, fontWeight: '500' },

  extraPhoto: {
    width: SCREEN_WIDTH - 40, height: SCREEN_WIDTH - 40,
    marginHorizontal: 20, marginTop: 16, borderRadius: 28,
  },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  infoIcon: { fontSize: 22 },
  infoText: { fontSize: 15, fontWeight: '600', flex: 1 },

  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 14, padding: 20, paddingBottom: 32,
    borderTopWidth: 1,
  },
  passBtn: {
    width: 62, height: 62, borderRadius: 31, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  chatBtn: {
    flex: 1, borderRadius: 31, overflow: 'hidden',
    shadowColor: '#E8B86D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  chatBtnGrad: {
    paddingVertical: 20, alignItems: 'center', borderRadius: 31,
  },
  chatBtnTxt: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
});
