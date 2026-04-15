// screens/OnboardingScreen.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, SafeAreaView,
  ActivityIndicator, Image, Alert, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { buildAgentSystemPrompt } from '../lib/agentPrompt';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { moderateText, getModerationMessage } from '../lib/moderation';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

type QuestionType = 'text' | 'number' | 'chips' | 'chips_multi' | 'photo' | 'prompts';

interface Chip { label: string; value: string }
interface Question {
  id: string;
  text: string | ((a: Record<string, string>) => string);
  type: QuestionType;
  key: string;
  chips?: Chip[];
  placeholder?: string;
  optional?: boolean;
}

interface Message {
  role: 'agent' | 'user';
  text: string;
  questionIndex?: number;
}

export default function OnboardingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const QUESTIONS: Question[] = useMemo(() => [
    {
      id: 'name', key: 'name', type: 'text' as QuestionType,
      text: t('onboarding.qName'),
      placeholder: t('onboarding.placeholderName'),
    },
    {
      id: 'age', key: 'age', type: 'number' as QuestionType,
      text: (a: Record<string, string>) => t('onboarding.qAge', { name: a.name }),
      placeholder: t('onboarding.placeholderAge'),
    },
    {
      id: 'gender', key: 'gender', type: 'chips' as QuestionType,
      text: t('onboarding.qGender'),
      chips: [
        { label: t('onboarding.male'), value: 'male' },
        { label: t('onboarding.female'), value: 'female' },
        { label: t('onboarding.other'), value: 'other' },
      ],
    },
    {
      id: 'seeking', key: 'seeking', type: 'chips_multi' as QuestionType,
      text: t('onboarding.qSeeking'),
      chips: [
        { label: t('onboarding.male'), value: 'male' },
        { label: t('onboarding.female'), value: 'female' },
        { label: t('onboarding.dontCare'), value: 'any' },
      ],
    },
    {
      id: 'city', key: 'city', type: 'text' as QuestionType,
      text: t('onboarding.qCity'),
      placeholder: t('onboarding.placeholderCity'),
    },
    {
      id: 'age_range', key: 'age_range', type: 'chips' as QuestionType,
      text: t('onboarding.qAgeRange'),
      chips: [
        { label: '18-25', value: '18-25' },
        { label: '23-30', value: '23-30' },
        { label: '28-38', value: '28-38' },
        { label: '35-50', value: '35-50' },
        { label: t('ageRanges.any'), value: '18-80' },
      ],
    },
    {
      id: 'relationship', key: 'relationship_type', type: 'chips' as QuestionType,
      text: t('onboarding.qRelationship'),
      chips: [
        { label: t('onboarding.intentLifePartner'), value: 'life_partner' },
        { label: t('onboarding.intentLongTerm'), value: 'long_term' },
        { label: t('onboarding.intentLongOpenShort'), value: 'long_open_short' },
        { label: t('onboarding.intentShortOpenLong'), value: 'short_open_long' },
        { label: t('onboarding.intentShortTerm'), value: 'short_term' },
        { label: t('onboarding.intentFiguringOut'), value: 'figuring_out' },
      ],
    },
    {
      id: 'family_plans', key: 'family_plans', type: 'chips' as QuestionType,
      text: t('onboarding.qFamilyPlans'),
      chips: [
        { label: t('onboarding.familyWant'), value: 'want' },
        { label: t('onboarding.familyDontWant'), value: 'dont_want' },
        { label: t('onboarding.familyOpen'), value: 'open' },
        { label: t('onboarding.familyNotSure'), value: 'not_sure' },
      ],
      optional: true,
    },
    {
      id: 'religion', key: 'religion', type: 'chips' as QuestionType,
      text: t('onboarding.qReligion'),
      chips: [
        { label: t('onboarding.relMuslim'), value: 'muslim' },
        { label: t('onboarding.relChristian'), value: 'christian' },
        { label: t('onboarding.relJewish'), value: 'jewish' },
        { label: t('onboarding.relBuddhist'), value: 'buddhist' },
        { label: t('onboarding.relHindu'), value: 'hindu' },
        { label: t('onboarding.relAgnostic'), value: 'agnostic' },
        { label: t('onboarding.relAtheist'), value: 'atheist' },
        { label: t('onboarding.relSpiritual'), value: 'spiritual' },
        { label: t('onboarding.relOther'), value: 'other' },
        { label: t('onboarding.relPreferNotSay'), value: 'prefer_not_say' },
      ],
      optional: true,
    },
    {
      id: 'alcohol', key: 'alcohol', type: 'chips' as QuestionType,
      text: t('onboarding.qAlcohol'),
      chips: [
        { label: t('onboarding.yes'), value: 'yes' },
        { label: t('onboarding.no'), value: 'no' },
        { label: t('onboarding.sometimes'), value: 'sometimes' },
        { label: t('onboarding.preferNotSay'), value: 'prefer_not_say' },
      ],
      optional: true,
    },
    {
      id: 'smoking', key: 'smoking', type: 'chips' as QuestionType,
      text: t('onboarding.qSmoking'),
      chips: [
        { label: t('onboarding.yes'), value: 'yes' },
        { label: t('onboarding.no'), value: 'no' },
        { label: t('onboarding.sometimes'), value: 'sometimes' },
        { label: t('onboarding.preferNotSay'), value: 'prefer_not_say' },
      ],
      optional: true,
    },
    {
      id: 'education', key: 'education', type: 'text' as QuestionType,
      text: t('onboarding.qEducation'),
      placeholder: t('onboarding.placeholderEducation'),
      optional: true,
    },
    {
      id: 'job', key: 'job', type: 'text' as QuestionType,
      text: t('onboarding.qJob'),
      placeholder: t('onboarding.placeholderJob'),
    },
    {
      id: 'personality', key: 'personality', type: 'text' as QuestionType,
      text: t('onboarding.qPersonality'),
      placeholder: t('onboarding.placeholderPersonality'),
    },
    {
      id: 'looking_for', key: 'looking_for', type: 'text' as QuestionType,
      text: t('onboarding.qLookingFor'),
      placeholder: t('onboarding.placeholderLookingFor'),
    },
    {
      id: 'dealbreakers', key: 'dealbreakers', type: 'text' as QuestionType,
      text: t('onboarding.qDealbreakers'),
      placeholder: t('onboarding.placeholderDealbreakers'),
    },
    {
      id: 'extra', key: 'extra', type: 'text' as QuestionType,
      text: t('onboarding.qExtra'),
      placeholder: t('onboarding.placeholderExtra'),
      optional: true,
    },
    {
      id: 'prompts', key: 'prompts', type: 'prompts' as QuestionType,
      text: `${t('prompts.ui.title')}\n\n${t('prompts.ui.subtitle')}`,
    },
    {
      id: 'photo', key: 'photo', type: 'photo' as QuestionType,
      text: (a: Record<string, string>) => t('onboarding.qPhoto', { name: a.name }),
    },
  ], [t]);

  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Prompts state
  const [selectedPrompts, setSelectedPrompts] = useState<Array<{ key: string; answer: string }>>([]);
  const [activePromptKey, setActivePromptKey] = useState<string | null>(null);
  const [promptAnswer, setPromptAnswer] = useState('');

  const PROMPT_KEYS = ['perfectSaturday', 'firstDate', 'passionAbout', 'lastLaughed', 'agentShouldKnow', 'sundayMornings', 'confess', 'biggestQuality'];
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const q = QUESTIONS[0];
    setMessages([{ role: 'agent', text: getQText(q, {}), questionIndex: 0 }]);
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }, [messages]);

  const getQText = (q: Question, ans: Record<string, string>) =>
    typeof q.text === 'function' ? q.text(ans) : q.text;

  const currentQ = QUESTIONS[step];
  const isChip = currentQ.type === 'chips' || currentQ.type === 'chips_multi';
  const isMulti = currentQ.type === 'chips_multi';
  const isPhotoStep = currentQ.type === 'photo';
  const showTextInput = !isChip && !isPhotoStep;

  const onChipPress = (chip: Chip) => {
    if (busy) return;
    if (isMulti) {
      setSelectedChips(prev =>
        prev.includes(chip.value) ? prev.filter(v => v !== chip.value) : [...prev, chip.value]
      );
      return;
    }
    setSelectedChips([chip.value]);
    setTimeout(() => advance(chip.label, chip.value), 150);
  };

  const validateInput = (value: string, question: Question): boolean => {
    if (question.type === 'number') {
      if (!/^\d+$/.test(value)) return false;
      const n = Number(value);
      if (n < 18 || n > 80) return false;
      return true;
    }
    if (question.id === 'name') {
      if (value.length < 2 || value.length > 50) return false;
    }
    if (['personality', 'looking_for', 'dealbreakers', 'extra'].includes(question.id)) {
      if (value.length > 500) return false;
    }
    return true;
  };

  const sendText = () => {
    if (busy || !input.trim()) return;
    const v = input.trim();
    if (!validateInput(v, currentQ)) return;

    // İçerik moderasyonu (sadece serbest metin alanları)
    if (['personality', 'looking_for', 'dealbreakers', 'extra', 'job'].includes(currentQ.id)) {
      const modResult = moderateText(v);
      if (!modResult.clean) {
        Alert.alert(t('common.error'), t(getModerationMessage(modResult.reason || '')));
        return;
      }
    }

    advance(v, v);
  };

  const sendMulti = () => {
    if (busy || selectedChips.length === 0) return;
    const labels = currentQ.chips!
      .filter(c => selectedChips.includes(c.value))
      .map(c => c.label).join(', ');
    advance(labels, selectedChips.join(','));
  };

  const skipOptional = () => {
    if (busy) return;
    advance(t('onboarding.skipped'), '');
  };

  const goBack = () => {
    if (busy || step === 0) return;
    const prevStep = step - 1;
    const prevQ = QUESTIONS[prevStep];

    // Son soru-cevap çiftini mesajlardan kaldır
    // messages yapısı: [...eskiler, userAnswer, currentAgentQuestion]
    // Son 2 mesajı kaldırıp önceki soruyu tekrar göster
    setMessages(prev => {
      const trimmed = prev.slice(0, -2);
      return [...trimmed, { role: 'agent', text: getQText(prevQ, answers), questionIndex: prevStep }];
    });

    // Önceki cevabı answers'dan temizle
    const newAnswers = { ...answers };
    delete newAnswers[prevQ.key];
    setAnswers(newAnswers);

    setInput('');
    setSelectedChips([]);
    setStep(prevStep);
    trackEvent('onboarding_back', { from: step, to: prevStep });
  };

  const openPromptModal = (key: string) => {
    if (busy) return;
    const existing = selectedPrompts.find(p => p.key === key);
    setPromptAnswer(existing?.answer || '');
    setActivePromptKey(key);
  };

  const savePromptAnswer = () => {
    if (!activePromptKey) return;
    const trimmed = promptAnswer.trim();
    if (trimmed.length < 3) return;

    // Moderation check
    const modResult = moderateText(trimmed);
    if (!modResult.clean) {
      Alert.alert(t('common.error'), t(getModerationMessage(modResult.reason || '')));
      return;
    }

    setSelectedPrompts(prev => {
      const others = prev.filter(p => p.key !== activePromptKey);
      // Zaten 3 tane varsa ve bu yeni değilse (rewrite), eskiyi kaldırıp yeni koy
      // 3 tane varsa ve bu yeniyse izin verme
      if (others.length >= 3 && !prev.find(p => p.key === activePromptKey)) {
        return prev;
      }
      return [...others, { key: activePromptKey, answer: trimmed }];
    });
    setActivePromptKey(null);
    setPromptAnswer('');
  };

  const removePrompt = () => {
    if (!activePromptKey) return;
    setSelectedPrompts(prev => prev.filter(p => p.key !== activePromptKey));
    setActivePromptKey(null);
    setPromptAnswer('');
  };

  const detectCity = async () => {
    if (detectingLocation) return;
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.permissionNeeded'), t('onboarding.locationDenied'));
        setDetectingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const places = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const city = places[0]?.city || places[0]?.subregion || places[0]?.region || '';
      if (city) {
        trackEvent('location_detected');
        advance(city, city);
      } else {
        Alert.alert(t('common.error'), t('onboarding.locationError'));
      }
    } catch (err) {
      captureError(err, { context: 'detect_city' });
      Alert.alert(t('common.error'), t('onboarding.locationError'));
    } finally {
      setDetectingLocation(false);
    }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) {
        Alert.alert(t('common.photoTooBig'), t('common.photoTooBigDesc'));
        return;
      }
      setPhotoUri(asset.uri);
      trackEvent('photo_upload', { screen: 'onboarding' });
    }
  };

  const advance = (userLabel: string, value: string) => {
    setBusy(true);
    const newAnswers = { ...answers, [currentQ.key]: value };
    setAnswers(newAnswers);
    trackEvent('onboarding_step', { step: step + 1, question: currentQ.id });
    setInput('');
    setSelectedChips([]);

    if (userLabel !== t('onboarding.skipped')) {
      setMessages(prev => [...prev, { role: 'user', text: userLabel }]);
    }

    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'agent', text: '···' }]);
      setTimeout(() => {
        const nextStep = step + 1;
        if (nextStep < QUESTIONS.length) {
          const nextQ = QUESTIONS[nextStep];
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'agent', text: getQText(nextQ, newAnswers), questionIndex: nextStep },
          ]);
          setStep(nextStep);
          setBusy(false);
          if (nextQ.type === 'text' || nextQ.type === 'number') {
            setTimeout(() => inputRef.current?.focus(), 200);
          }
        } else {
          trackEvent('onboarding_complete');
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'agent', text: t('onboarding.agentReady', { name: newAnswers.name }) },
          ]);
          setBusy(false);
          setTimeout(() => finalize(newAnswers), 1000);
        }
      }, 800);
    }, 200);
  };

  const finalize = async (finalAnswers: Record<string, string>) => {
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { navigation.replace('Main'); return; }

      const [ageMin, ageMax] = (finalAnswers.age_range || '18-80').split('-').map(Number);

      let photoUrl: string | null = null;
      if (finalAnswers.photo && finalAnswers.photo !== '') {
        try {
          const uri = finalAnswers.photo;
          const fileName = `${user.id}/${Date.now()}.jpg`;
          const formData = new FormData();
          formData.append('file', { uri, name: fileName, type: 'image/jpeg' } as any);
          const { error: uploadError } = await supabase.storage
            .from('avatars').upload(fileName, formData, { contentType: 'image/jpeg' });
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            photoUrl = publicUrl;
          }
        } catch (photoErr) {
          captureError(photoErr, { context: 'onboarding_photo_upload' });
        }
      }

      // Prompts JSON parse (onboarding'de stringle kaydettik)
      let userPrompts: Array<{ key: string; answer: string }> = [];
      if (finalAnswers.prompts) {
        try {
          userPrompts = JSON.parse(finalAnswers.prompts);
        } catch {
          userPrompts = [];
        }
      }

      await supabase.from('users').upsert({
        id: user.id,
        email: user.email,
        name: finalAnswers.name,
        age: parseInt(finalAnswers.age),
        gender: finalAnswers.gender,
        seeking: finalAnswers.seeking?.split(',').filter(Boolean) || [],
        city: finalAnswers.city,
        age_min: ageMin,
        age_max: ageMax,
        relationship_type: finalAnswers.relationship_type,
        dating_intention: finalAnswers.relationship_type,
        family_plans: finalAnswers.family_plans || null,
        education: finalAnswers.education || null,
        religion: finalAnswers.religion || null,
        alcohol: finalAnswers.alcohol || null,
        smoking: finalAnswers.smoking || null,
        prompts: userPrompts,
        photos: photoUrl ? [photoUrl] : [],
      });

      const personality = `${finalAnswers.personality} Meslek: ${finalAnswers.job || 'belirtilmedi'}. ${finalAnswers.extra || ''}`.trim();
      const profileContext = {
        dating_intention: finalAnswers.relationship_type,
        family_plans: finalAnswers.family_plans,
        religion: finalAnswers.religion,
        alcohol: finalAnswers.alcohol,
        smoking: finalAnswers.smoking,
        education: finalAnswers.education,
      };
      const systemPrompt = buildAgentSystemPrompt(
        personality,
        finalAnswers.looking_for,
        finalAnswers.dealbreakers,
        undefined,
        profileContext,
        userPrompts,
        'Aria'
      );

      await supabase.from('agents').upsert({
        user_id: user.id,
        personality: finalAnswers.personality,
        looking_for: finalAnswers.looking_for,
        dealbreakers: finalAnswers.dealbreakers,
        system_prompt: systemPrompt,
        tags: [finalAnswers.job, finalAnswers.city].filter(Boolean),
        name: 'Aria',
        avatar_emoji: '\u{1F916}',
      });

      await supabase.functions.invoke('start-match', { body: { user_id: user.id } });
      navigation.replace('AgentNaming');
    } catch (err) {
      captureError(err, { context: 'onboarding_finalize' });
      setSaving(false);
    }
  };

  const progress = (step / QUESTIONS.length) * 100;

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.header}>
            {step > 0 ? (
              <TouchableOpacity onPress={goBack} style={s.backBtn} disabled={busy}>
                <Text style={[s.backBtnTxt, { color: colors.textSecondary }]}>‹</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[s.logo, { color: colors.textPrimary }]}>av<Text style={[s.accent, { color: colors.accentPink }]}>a</Text>nt</Text>
            )}
            <View style={[s.progBar, { backgroundColor: colors.border }]}>
              <LinearGradient
                colors={colors.accentGradient as any}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.progFill, { width: `${progress}%` }]}
              />
            </View>
            <Text style={[s.stepLbl, { color: colors.textSecondary }]}>{step + 1}/{QUESTIONS.length}</Text>
          </View>

          <ScrollView ref={scrollRef} style={s.chat} contentContainerStyle={s.chatContent} keyboardShouldPersistTaps="handled">
            {messages.map((msg, i) => {
              const isAgent = msg.role === 'agent';
              const isTyping = msg.text === '···';
              const msgQ = msg.questionIndex !== undefined ? QUESTIONS[msg.questionIndex] : null;
              const isLastMsg = i === messages.length - 1;
              const showChips = isAgent && msgQ && isChipQ(msgQ) && isLastMsg && !busy;
              const showOptional = isAgent && msgQ?.optional && msgQ.type !== 'photo' && isLastMsg && !busy;
              const showPhoto = isAgent && msgQ?.type === 'photo' && isLastMsg && !busy;
              const showLocationBtn = isAgent && msgQ?.id === 'city' && isLastMsg && !busy;
              const showPromptsUI = isAgent && msgQ?.type === 'prompts' && isLastMsg && !busy;

              return (
                <View key={i}>
                  <View style={[s.row, !isAgent && s.rowRight]}>
                    {isAgent && (
                      <LinearGradient colors={colors.accentGradientAlt as any} style={s.avA}>
                        <Text style={s.avTxt}>A</Text>
                      </LinearGradient>
                    )}
                    <View style={[s.bbl, isAgent ? [s.bblA, { backgroundColor: colors.card, shadowColor: colors.shadow }] : [s.bblU, { backgroundColor: colors.userBubble }]]}>
                      <Text style={[s.bblTxt, { color: colors.textPrimary }, !isAgent && s.bblTxtU]}>
                        {isTyping ? '· · ·' : msg.text}
                      </Text>
                    </View>
                    {!isAgent && (
                      <View style={[s.avU, { backgroundColor: colors.userAvatarBg }]}><Text style={[s.avTxt, { color: colors.userBubble }]}>S</Text></View>
                    )}
                  </View>

                  {showChips && (
                    <View style={s.chipsWrap}>
                      {msgQ!.chips!.map(chip => (
                        <TouchableOpacity
                          key={chip.value}
                          style={[s.chip, { borderColor: colors.border, backgroundColor: colors.card }, selectedChips.includes(chip.value) && s.chipSel]}
                          onPress={() => onChipPress(chip)}
                        >
                          {selectedChips.includes(chip.value) ? (
                            <LinearGradient colors={colors.accentGradientAlt as any} style={s.chipGrad}>
                              <Text style={s.chipTxtSel}>{chip.label}</Text>
                            </LinearGradient>
                          ) : (
                            <Text style={[s.chipTxt, { color: colors.textPrimary }]}>{chip.label}</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                      {isMulti && (
                        <TouchableOpacity
                          style={[s.devamBtn, selectedChips.length === 0 && s.devamBtnOff]}
                          onPress={sendMulti}
                          disabled={selectedChips.length === 0}
                        >
                          <LinearGradient
                            colors={selectedChips.length === 0 ? (colors.disabledGradient as any) : (colors.accentGradientAlt as any)}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={s.devamGrad}
                          >
                            <Text style={s.devamTxt}>{t('onboarding.devamBtn')}</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {showPhoto && (
                    <View style={s.photoStep}>
                      {photoUri ? (
                        <View style={s.photoPreviewWrap}>
                          <Image source={{ uri: photoUri }} style={[s.photoPreview, { backgroundColor: colors.inputBg }]} />
                          <TouchableOpacity style={s.changePhotoBadge} onPress={pickPhoto}>
                            <Text style={s.changePhotoBadgeTxt}>{t('onboarding.changePhoto')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={[s.pickPhotoBtn, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={pickPhoto}>
                          <Text style={[s.pickPhotoBtnTxt, { color: colors.textPrimary }]}>{t('onboarding.selectPhoto')}</Text>
                        </TouchableOpacity>
                      )}
                      <View style={s.photoActions}>
                        {photoUri && (
                          <TouchableOpacity style={s.confirmPhotoBtn} onPress={() => advance(t('onboarding.photoAdded'), photoUri!)}>
                            <LinearGradient colors={colors.accentGradientAlt as any} style={s.confirmGrad}>
                              <Text style={s.confirmPhotoBtnTxt}>{t('common.continue')}</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {showOptional && (
                    <TouchableOpacity style={s.skipBtn} onPress={skipOptional}>
                      <Text style={[s.skipTxt, { color: colors.placeholder }]}>{t('common.skip')} →</Text>
                    </TouchableOpacity>
                  )}

                  {showLocationBtn && (
                    <TouchableOpacity
                      style={[s.locationBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={detectCity}
                      disabled={detectingLocation}
                    >
                      {detectingLocation ? (
                        <ActivityIndicator size="small" color={colors.accentPurple} />
                      ) : (
                        <Text style={[s.locationBtnTxt, { color: colors.userBubble }]}>{t('onboarding.useLocation')}</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {showPromptsUI && (
                    <View style={s.promptsWrap}>
                      {PROMPT_KEYS.map(key => {
                        const selected = selectedPrompts.find(p => p.key === key);
                        const isSelected = !!selected;
                        return (
                          <TouchableOpacity
                            key={key}
                            style={[
                              s.promptChip,
                              { backgroundColor: colors.card, borderColor: colors.border },
                              isSelected && { borderColor: colors.accentPink, backgroundColor: colors.inputBg },
                            ]}
                            onPress={() => openPromptModal(key)}
                          >
                            <Text style={[s.promptChipTitle, { color: colors.textPrimary }]}>
                              {t(`prompts.pool.${key}`)}
                            </Text>
                            {isSelected && selected!.answer ? (
                              <Text style={[s.promptChipAnswer, { color: colors.textSecondary }]} numberOfLines={2}>
                                {selected!.answer}
                              </Text>
                            ) : (
                              <Text style={[s.promptChipHint, { color: colors.placeholder }]}>
                                {t('prompts.ui.answerPlaceholder')}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}

                      <TouchableOpacity
                        style={[
                          s.promptsContinue,
                          selectedPrompts.filter(p => p.answer).length < 3 && s.promptsContinueOff,
                        ]}
                        disabled={selectedPrompts.filter(p => p.answer).length < 3}
                        onPress={() => {
                          const ready = selectedPrompts.filter(p => p.answer);
                          advance(t('prompts.ui.ready'), JSON.stringify(ready));
                        }}
                      >
                        <LinearGradient
                          colors={
                            selectedPrompts.filter(p => p.answer).length < 3
                              ? (colors.disabledGradient as any)
                              : (colors.accentGradientAlt as any)
                          }
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={s.promptsContinueGrad}
                        >
                          <Text style={s.promptsContinueTxt}>
                            {selectedPrompts.filter(p => p.answer).length >= 3
                              ? t('onboarding.devamBtn')
                              : t('prompts.ui.selectMore', { count: 3 - selectedPrompts.filter(p => p.answer).length })
                            }
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}

            {saving && (
              <View style={s.row}>
                <LinearGradient colors={colors.accentGradientAlt as any} style={s.avA}>
                  <Text style={s.avTxt}>A</Text>
                </LinearGradient>
                <View style={[s.bblA, { backgroundColor: colors.card, shadowColor: colors.shadow }]}><ActivityIndicator size="small" color="#E8B86D" /></View>
              </View>
            )}
          </ScrollView>

          {showTextInput && (
            <View style={[s.inputRow, { backgroundColor: colors.card, borderTopColor: colors.separator }]}>
              <TextInput
                ref={inputRef}
                style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                value={input}
                onChangeText={setInput}
                placeholder={currentQ.placeholder || t('onboarding.placeholderDefault')}
                placeholderTextColor={colors.placeholder}
                multiline={currentQ.type === 'text'}
                keyboardType={currentQ.type === 'number' ? 'number-pad' : 'default'}
                maxLength={currentQ.type === 'number' ? 3 : currentQ.id === 'name' ? 50 : 500}
                returnKeyType={currentQ.type === 'text' ? 'default' : 'send'}
                onSubmitEditing={currentQ.type !== 'text' ? sendText : undefined}
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || busy) && s.sendBtnOff]}
                onPress={sendText}
                disabled={!input.trim() || busy}
              >
                <LinearGradient
                  colors={(!input.trim() || busy) ? (colors.disabledGradient as any) : (colors.accentGradientAlt as any)}
                  style={s.sendGrad}
                >
                  <Text style={s.sendTxt}>↑</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Prompt answer modal */}
      <Modal
        visible={!!activePromptKey}
        animationType="slide"
        transparent
        onRequestClose={() => setActivePromptKey(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.promptModalOverlay}
        >
          <View style={[s.promptModal, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <Text style={[s.promptModalTitle, { color: colors.textPrimary }]}>
              {activePromptKey ? t(`prompts.pool.${activePromptKey}`) : ''}
            </Text>
            <TextInput
              style={[s.promptModalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('prompts.ui.answerPlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={promptAnswer}
              onChangeText={setPromptAnswer}
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={s.promptModalActions}>
              {selectedPrompts.find(p => p.key === activePromptKey) && (
                <TouchableOpacity onPress={removePrompt} style={s.promptModalRemove}>
                  <Text style={[s.promptModalRemoveTxt, { color: colors.error }]}>
                    {t('common.delete')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setActivePromptKey(null)}
                style={s.promptModalCancel}
              >
                <Text style={[s.promptModalCancelTxt, { color: colors.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={savePromptAnswer}
                disabled={promptAnswer.trim().length < 3}
                style={[s.promptModalSave, promptAnswer.trim().length < 3 && { opacity: 0.4 }]}
              >
                <LinearGradient
                  colors={colors.accentGradientAlt as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.promptModalSaveGrad}
                >
                  <Text style={s.promptModalSaveTxt}>{t('common.save')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

function isChipQ(q: Question) {
  return q.type === 'chips' || q.type === 'chips_multi';
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 14 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backBtnTxt: { fontSize: 32, fontWeight: '300', lineHeight: 34 },
  logo: { fontSize: 22, fontWeight: '800', color: '#2D1B4E', letterSpacing: -0.5 },
  accent: { color: '#E8B86D' },
  progBar: { flex: 1, height: 6, backgroundColor: '#F0EBF7', borderRadius: 3, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 3 },
  stepLbl: { fontSize: 13, color: '#9B8AB8', minWidth: 28, textAlign: 'right', fontWeight: '700' },
  chat: { flex: 1 },
  chatContent: { padding: 18, paddingBottom: 10, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  rowRight: { flexDirection: 'row-reverse' },
  avA: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avU: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8DEFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  bbl: { borderRadius: 22, padding: 12, paddingHorizontal: 16, maxWidth: '78%' },
  bblA: { backgroundColor: '#fff', borderBottomLeftRadius: 6, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  bblU: { backgroundColor: '#7C3AED', borderBottomRightRadius: 6 },
  bblTxt: { fontSize: 15, lineHeight: 22, color: '#2D1B4E' },
  bblTxtU: { color: '#fff', fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginLeft: 42, marginTop: 10 },
  chip: { borderRadius: 26, borderWidth: 2, borderColor: '#F0EBF7', backgroundColor: '#fff', overflow: 'hidden' },
  chipSel: { borderColor: 'transparent' },
  chipGrad: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 24 },
  chipTxt: { fontSize: 15, color: '#2D1B4E', fontWeight: '600', paddingHorizontal: 18, paddingVertical: 11 },
  chipTxtSel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  devamBtn: { width: '100%', marginTop: 6, borderRadius: 26, overflow: 'hidden' },
  devamBtnOff: { opacity: 0.5 },
  devamGrad: { padding: 14, borderRadius: 26, alignItems: 'center' },
  devamTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  skipBtn: { marginLeft: 42, marginTop: 10, paddingVertical: 8 },
  skipTxt: { fontSize: 14, color: '#C4B5D0', fontWeight: '600' },
  locationBtn: { marginLeft: 42, marginTop: 10, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, borderWidth: 2, alignSelf: 'flex-start', minWidth: 170, alignItems: 'center' },
  locationBtnTxt: { fontSize: 15, fontWeight: '700' },

  // Prompts UI
  promptsWrap: { marginLeft: 42, marginTop: 12, gap: 10 },
  promptChip: {
    borderRadius: 20, borderWidth: 2, padding: 14, paddingVertical: 12,
  },
  promptChipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  promptChipAnswer: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  promptChipHint: { fontSize: 12, fontWeight: '500', fontStyle: 'italic' },
  promptsContinue: { marginTop: 6, borderRadius: 26, overflow: 'hidden' },
  promptsContinueOff: { opacity: 0.6 },
  promptsContinueGrad: { padding: 14, alignItems: 'center', borderRadius: 26 },
  promptsContinueTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Prompt modal
  promptModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  promptModal: {
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 24, paddingBottom: 40,
    shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
  },
  promptModalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  promptModalInput: {
    borderRadius: 18, padding: 16, fontSize: 16, fontWeight: '500',
    minHeight: 100, borderWidth: 2, marginBottom: 16, textAlignVertical: 'top',
  },
  promptModalActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  promptModalRemove: { padding: 10 },
  promptModalRemoveTxt: { fontSize: 14, fontWeight: '700' },
  promptModalCancel: { padding: 10, flex: 1, alignItems: 'flex-end' },
  promptModalCancelTxt: { fontSize: 15, fontWeight: '700' },
  promptModalSave: { borderRadius: 22, overflow: 'hidden' },
  promptModalSaveGrad: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 22 },
  promptModalSaveTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  photoStep: { marginLeft: 42, marginTop: 14, gap: 14 },
  photoPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoPreview: { width: 130, height: 170, borderRadius: 22, backgroundColor: '#F8F5FC' },
  changePhotoBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  changePhotoBadgeTxt: { fontSize: 12, color: '#fff', fontWeight: '700' },
  pickPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 22, paddingVertical: 16, alignSelf: 'flex-start', borderWidth: 2, borderColor: '#F0EBF7', shadowColor: '#C084FC', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  pickPhotoBtnTxt: { fontSize: 16, color: '#2D1B4E', fontWeight: '700' },
  photoActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  confirmPhotoBtn: { borderRadius: 26, overflow: 'hidden' },
  confirmGrad: { paddingHorizontal: 24, paddingVertical: 13, borderRadius: 26 },
  confirmPhotoBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  skipPhotoBtn: { paddingVertical: 12, paddingHorizontal: 4 },
  skipPhotoBtnTxt: { fontSize: 14, color: '#C4B5D0', fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 14, paddingHorizontal: 18, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F5F0FA' },
  input: { flex: 1, backgroundColor: '#F8F5FC', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 13, fontSize: 16, color: '#2D1B4E', maxHeight: 100, borderWidth: 2, borderColor: '#F0EBF7', fontWeight: '500' },
  sendBtn: { borderRadius: 24, overflow: 'hidden' },
  sendBtnOff: { opacity: 0.5 },
  sendGrad: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sendTxt: { color: '#fff', fontSize: 22, fontWeight: '600' },
});
