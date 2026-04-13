import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Colors, Fonts, Typography } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { buildAgentSystemPrompt } from '../../src/lib/agentPrompt';
import { moderateText, getModerationMessage } from '../../src/lib/moderation';
import { trackEvent } from '../../src/lib/analytics';

// ─── Question definitions ───
interface Question {
  key: string;
  agentText: string | ((a: Record<string, string>) => string);
  type: 'text' | 'number' | 'chips' | 'chips_multi' | 'prompts' | 'photo';
  placeholder?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
  maxLength?: number;
}

const QUESTIONS: Question[] = [
  { key: 'name', agentText: 'Merhaba! Ben senin Avant agentin olacagim. Seni tanimak istiyorum. Ismin ne?', type: 'text', placeholder: 'Ismin...' },
  { key: 'age', agentText: (a) => `Tanistigima memnunum ${a.name}! Kac yasindasin?`, type: 'number', placeholder: '25' },
  { key: 'gender', agentText: 'Cinsiyetin nedir?', type: 'chips', options: [
    { value: 'male', label: 'Erkek' }, { value: 'female', label: 'Kadin' }, { value: 'other', label: 'Diger' },
  ]},
  { key: 'seeking', agentText: 'Kimleri gormek istersin?', type: 'chips_multi', options: [
    { value: 'male', label: 'Erkek' }, { value: 'female', label: 'Kadin' }, { value: 'any', label: 'Farketmez' },
  ]},
  { key: 'city', agentText: 'Hangi sehirdesin?', type: 'text', placeholder: 'Istanbul...' },
  { key: 'age_range', agentText: 'Hangi yas araligini tercih edersin?', type: 'chips', options: [
    { value: '18-25', label: '18-25' }, { value: '23-30', label: '23-30' }, { value: '28-38', label: '28-38' },
    { value: '35-50', label: '35-50' }, { value: '18-80', label: 'Farketmez' },
  ]},
  { key: 'relationship', agentText: 'Ne tur bir iliski ariyorsun?', type: 'chips', options: [
    { value: 'life_partner', label: 'Hayat arkadasi' }, { value: 'long_term', label: 'Ciddi iliski' },
    { value: 'short_term', label: 'Kisa iliski' }, { value: 'figuring_out', label: 'Kesfediyorum' },
  ]},
  { key: 'family_plans', agentText: 'Cocuk/aile planlarin nedir?', type: 'chips', optional: true, options: [
    { value: 'want', label: 'Istiyorum' }, { value: 'dont_want', label: 'Istemiyorum' },
    { value: 'open', label: 'Acigim' }, { value: 'not_sure', label: 'Emin degilim' },
  ]},
  { key: 'religion', agentText: 'Din/inanc konusundaki gorusun?', type: 'chips', optional: true, options: [
    { value: 'muslim', label: 'Muslim' }, { value: 'christian', label: 'Hristiyan' },
    { value: 'spiritual', label: 'Spiritüel' }, { value: 'agnostic', label: 'Agnostik' },
    { value: 'atheist', label: 'Ateist' }, { value: 'prefer_not_say', label: 'Belirtmek istemem' },
  ]},
  { key: 'alcohol', agentText: 'Alkol kullaniyor musun?', type: 'chips', optional: true, options: [
    { value: 'yes', label: 'Evet' }, { value: 'no', label: 'Hayir' },
    { value: 'sometimes', label: 'Bazen' }, { value: 'prefer_not_say', label: 'Belirtmek istemem' },
  ]},
  { key: 'smoking', agentText: 'Sigara kullaniyor musun?', type: 'chips', optional: true, options: [
    { value: 'yes', label: 'Evet' }, { value: 'no', label: 'Hayir' },
    { value: 'sometimes', label: 'Bazen' }, { value: 'prefer_not_say', label: 'Belirtmek istemem' },
  ]},
  { key: 'education', agentText: 'Egitim seviyeni paylasir misin?', type: 'text', optional: true, placeholder: 'Universite, Yuksek lisans...' },
  { key: 'job', agentText: 'Ne is yapiyorsun?', type: 'text', placeholder: 'Meslegin...' },
  { key: 'personality', agentText: (a) => `Harika ${a.name}! Simdi seni daha yakindan taniyayim. Kendini nasil tanimlarsin? Kisiligini, hobilerini, ilgi alanlarini yaz.`, type: 'text', placeholder: 'Kendini anlat...', maxLength: 500 },
  { key: 'looking_for', agentText: 'Bir partnerde ne ariyorsun? Sana uygun birini bulmam icin bilmem gereken seyleri yaz.', type: 'text', placeholder: 'Ne ariyorsun...', maxLength: 500 },
  { key: 'dealbreakers', agentText: 'Kesinlikle kabul edemeyecegin seyler neler? Bunlari bilmem onemli.', type: 'text', placeholder: 'Dealbreaker\'larin...', maxLength: 500 },
  { key: 'extra', agentText: 'Bilmem gereken baska bir sey var mi? (Istersen bos birakabilirsin)', type: 'text', optional: true, placeholder: 'Eklemek istediklerin...', maxLength: 500 },
  { key: 'prompts', agentText: (a) => `Neredeyse bitti ${a.name}! Son olarak, kendini ifade edecek 3 prompt sec ve yanitla.`, type: 'prompts' },
  { key: 'photo', agentText: (a) => `Son adim! Profiline bir fotograf yukle ${a.name}. Bu senin ilk izlenimin olacak.`, type: 'photo' },
];

const PROMPT_OPTIONS = [
  { key: 'perfectSaturday', title: 'Mukemmel bir cumartesim...' },
  { key: 'firstDate', title: 'Ilk randevuda...' },
  { key: 'passionAbout', title: 'Tutkum...' },
  { key: 'lastLaughed', title: 'En son guldugum sey...' },
  { key: 'agentShouldKnow', title: 'Agentim sunu bilmeli...' },
  { key: 'sundayMornings', title: 'Pazar sabahlari...' },
  { key: 'confess', title: 'Itiraf...' },
  { key: 'biggestQuality', title: 'En deger verdigim ozelligim...' },
];

interface ChatMessage {
  role: 'agent' | 'user';
  text: string;
}

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, checkAgent } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputText, setInputText] = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Prompts
  const [selectedPrompts, setSelectedPrompts] = useState<{ key: string; answer: string }[]>([]);
  const [activePromptKey, setActivePromptKey] = useState<string | null>(null);
  const [promptAnswer, setPromptAnswer] = useState('');

  // Photo
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Initialize first question
  useEffect(() => {
    showAgentMessage(0);
  }, []);

  const getQuestionText = (q: Question): string => {
    if (typeof q.agentText === 'function') return q.agentText(answers);
    return q.agentText;
  };

  const showAgentMessage = (questionIndex: number) => {
    setTyping(true);
    setTimeout(() => {
      const q = QUESTIONS[questionIndex];
      setMessages((prev) => [...prev, { role: 'agent', text: getQuestionText(q) }]);
      setTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 800);
  };

  const advanceToNext = (answer: string) => {
    const q = QUESTIONS[step];

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', text: answer }]);
    setAnswers((prev) => ({ ...prev, [q.key]: answer }));
    setInputText('');
    setSelectedChips([]);

    const nextStep = step + 1;
    if (nextStep >= QUESTIONS.length) {
      // Finalize
      finalize({ ...answers, [q.key]: answer });
      return;
    }

    setStep(nextStep);
    showAgentMessage(nextStep);
  };

  const handleTextSubmit = () => {
    const q = QUESTIONS[step];
    const text = inputText.trim();

    if (!text && !q.optional) return;
    if (!text && q.optional) {
      advanceToNext('-');
      return;
    }

    // Validation
    if (q.type === 'number') {
      const n = parseInt(text);
      if (isNaN(n) || n < 18 || n > 80) {
        Alert.alert('Hata', 'Gecerli bir yas gir (18-80).');
        return;
      }
    }
    if (q.key === 'name' && text.length < 2) {
      Alert.alert('Hata', 'Isim en az 2 karakter olmali.');
      return;
    }

    // Moderation for text fields
    if (['personality', 'looking_for', 'dealbreakers', 'extra', 'job'].includes(q.key)) {
      const mod = moderateText(text);
      if (!mod.clean) {
        Alert.alert('Uyari', getModerationMessage(mod.reason || ''));
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    advanceToNext(text);
  };

  const handleChipSelect = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const q = QUESTIONS[step];

    if (q.type === 'chips') {
      const label = q.options?.find(o => o.value === value)?.label || value;
      advanceToNext(label);
    } else {
      // chips_multi
      setSelectedChips((prev) =>
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
    }
  };

  const handleMultiChipContinue = () => {
    if (selectedChips.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advanceToNext(selectedChips.join(', '));
  };

  const handleSkip = () => {
    advanceToNext('-');
  };

  // Photo
  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const confirmPhoto = () => {
    if (!photoUri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advanceToNext('Fotograf yuklendi');
  };

  // Location
  const detectLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin gerekli', 'Konum izni verilmedi.');
        setDetectingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync(loc.coords);
      if (place) {
        const city = place.city || place.region || place.country || '';
        setInputText(city);
        trackEvent('location_detected', { city });
      }
    } catch {
      Alert.alert('Hata', 'Konum algilanamadi.');
    }
    setDetectingLocation(false);
  };

  // Prompts
  const openPrompt = (key: string) => {
    setActivePromptKey(key);
    const existing = selectedPrompts.find(p => p.key === key);
    setPromptAnswer(existing?.answer || '');
  };

  const savePrompt = () => {
    if (!activePromptKey || promptAnswer.trim().length < 3) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPrompts((prev) => {
      const filtered = prev.filter(p => p.key !== activePromptKey);
      return [...filtered, { key: activePromptKey, answer: promptAnswer.trim() }];
    });
    setActivePromptKey(null);
    setPromptAnswer('');
  };

  const deletePrompt = () => {
    if (!activePromptKey) return;
    setSelectedPrompts((prev) => prev.filter(p => p.key !== activePromptKey));
    setActivePromptKey(null);
    setPromptAnswer('');
  };

  const confirmPrompts = () => {
    if (selectedPrompts.length < 3) {
      Alert.alert('Eksik', 'En az 3 prompt yanitlamalisin.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advanceToNext(`${selectedPrompts.length} prompt yanitlandi`);
  };

  // Finalize
  const finalize = async (allAnswers: Record<string, string>) => {
    setSaving(true);
    setMessages((prev) => [...prev, { role: 'agent', text: `Harika ${allAnswers.name || ''}! Agentin hazirlaniyor...` }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Oturum bulunamadi');

      const userId = session.user.id;
      const email = session.user.email || '';

      // Upload photo
      let photoUrl = '';
      if (photoUri) {
        const ext = photoUri.split('.').pop() || 'jpg';
        const fileName = `${userId}/${Date.now()}.${ext}`;
        const response = await fetch(photoUri);
        const blob = await response.blob();
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, { contentType: `image/${ext}` });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      }

      // Parse age range
      const [ageMin, ageMax] = (allAnswers.age_range || '18-80').split('-').map(Number);

      // Parse prompts
      const promptsData = selectedPrompts.map(p => ({ key: p.key, answer: p.answer }));

      // Upsert user profile
      const { error: profileErr } = await supabase.from('users').upsert({
        id: userId,
        email,
        name: allAnswers.name,
        age: parseInt(allAnswers.age) || 25,
        gender: allAnswers.gender?.toLowerCase() || 'other',
        seeking: (allAnswers.seeking || 'any').split(', ').map(s => s.toLowerCase()),
        city: allAnswers.city,
        age_min: ageMin || 18,
        age_max: ageMax || 80,
        relationship_type: allAnswers.relationship?.toLowerCase() || 'figuring_out',
        dating_intention: allAnswers.relationship?.toLowerCase() || 'figuring_out',
        family_plans: allAnswers.family_plans !== '-' ? allAnswers.family_plans?.toLowerCase() : null,
        religion: allAnswers.religion !== '-' ? allAnswers.religion?.toLowerCase() : null,
        alcohol: allAnswers.alcohol !== '-' ? allAnswers.alcohol?.toLowerCase() : null,
        smoking: allAnswers.smoking !== '-' ? allAnswers.smoking?.toLowerCase() : null,
        education: allAnswers.education !== '-' ? allAnswers.education : null,
        job: allAnswers.job,
        prompts: promptsData,
        photos: photoUrl ? [photoUrl] : [],
        is_discoverable: true,
        last_active_at: new Date().toISOString(),
      });

      if (profileErr) {
        console.error('Profile save error:', profileErr);
        throw profileErr;
      }

      // Build agent system prompt
      const systemPrompt = buildAgentSystemPrompt(
        allAnswers.personality || '',
        allAnswers.looking_for || '',
        allAnswers.dealbreakers || '',
        undefined,
        {
          dating_intention: allAnswers.relationship,
          family_plans: allAnswers.family_plans !== '-' ? allAnswers.family_plans : undefined,
          religion: allAnswers.religion !== '-' ? allAnswers.religion : undefined,
          alcohol: allAnswers.alcohol !== '-' ? allAnswers.alcohol : undefined,
          smoking: allAnswers.smoking !== '-' ? allAnswers.smoking : undefined,
          education: allAnswers.education !== '-' ? allAnswers.education : undefined,
        },
        promptsData,
      );

      // Create agent
      const { error: agentErr } = await supabase.from('agents').upsert({
        user_id: userId,
        personality: allAnswers.personality || '',
        looking_for: allAnswers.looking_for || '',
        dealbreakers: allAnswers.dealbreakers || '',
        system_prompt: systemPrompt,
        tags: [allAnswers.job, allAnswers.city].filter(Boolean),
      });

      if (agentErr) {
        console.error('Agent create error:', agentErr);
        throw agentErr;
      }

      // Start matching
      try {
        await supabase.functions.invoke('start-match', { body: {} });
      } catch {}

      await checkAgent(userId);
      trackEvent('onboarding_complete');

      setMessages((prev) => [...prev, { role: 'agent', text: `Agentin hazir! Simdi sana en uygun kisileri bulacagim. Basarilar! 🎉` }]);

      setTimeout(() => {
        router.replace('/(tabs)/discover');
      }, 1500);
    } catch (err) {
      console.error('Finalize error:', err);
      Alert.alert('Hata', 'Profil kaydedilemedi. Tekrar deneyin.');
      setSaving(false);
    }
  };

  const currentQ = QUESTIONS[step];
  const progress = (step + 1) / QUESTIONS.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.stepRow}>
        <Pressable onPress={() => { if (step > 0) { setStep(step - 1); setMessages(msgs => msgs.slice(0, -2)); } }}>
          <Text style={styles.backText}>{step > 0 ? '← Geri' : ''}</Text>
        </Pressable>
        <Text style={styles.stepText}>{step + 1} / {QUESTIONS.length}</Text>
        {currentQ?.optional && (
          <Pressable onPress={handleSkip}><Text style={styles.skipText}>Atla</Text></Pressable>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.duration(400)}
              style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}
            >
              {msg.role === 'agent' && (
                <LinearGradient colors={[Colors.purpleDark, Colors.purple]} style={styles.avatar}>
                  <Text style={styles.avatarText}>A</Text>
                </LinearGradient>
              )}
              <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAgent]}>
                <Text style={[styles.bubbleText, msg.role === 'user' && { color: Colors.goldText }]}>{msg.text}</Text>
              </View>
              {msg.role === 'user' && (
                <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.avatar}>
                  <Text style={[styles.avatarText, { color: Colors.goldText }]}>S</Text>
                </LinearGradient>
              )}
            </Animated.View>
          ))}

          {typing && (
            <View style={[styles.msgRow]}>
              <LinearGradient colors={[Colors.purpleDark, Colors.purple]} style={styles.avatar}>
                <Text style={styles.avatarText}>A</Text>
              </LinearGradient>
              <View style={[styles.bubble, styles.bubbleAgent]}>
                <Text style={styles.typingDots}>...</Text>
              </View>
            </View>
          )}

          {/* Chips */}
          {!typing && currentQ?.type === 'chips' && (
            <View style={styles.chipsWrap}>
              {currentQ.options?.map((opt) => (
                <Pressable key={opt.value} onPress={() => handleChipSelect(opt.value)}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{opt.label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {!typing && currentQ?.type === 'chips_multi' && (
            <View style={styles.chipsWrap}>
              {currentQ.options?.map((opt) => (
                <Pressable key={opt.value} onPress={() => handleChipSelect(opt.value)}>
                  <View style={[styles.chip, selectedChips.includes(opt.value) && styles.chipSelected]}>
                    <Text style={[styles.chipText, selectedChips.includes(opt.value) && { color: Colors.goldText }]}>{opt.label}</Text>
                  </View>
                </Pressable>
              ))}
              {selectedChips.length > 0 && (
                <Pressable onPress={handleMultiChipContinue}>
                  <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.continueBtn}>
                    <Text style={styles.continueBtnText}>Devam →</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          )}

          {/* Photo */}
          {!typing && currentQ?.type === 'photo' && (
            <View style={styles.photoSection}>
              {photoUri ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photoUri }} style={styles.photoImg} />
                  <Pressable onPress={pickPhoto} style={styles.changePhoto}>
                    <Text style={styles.changePhotoText}>Degistir</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={pickPhoto} style={styles.pickPhotoBtn}>
                  <Text style={{ fontSize: 32 }}>📷</Text>
                  <Text style={styles.pickPhotoText}>Fotograf Sec</Text>
                </Pressable>
              )}
              {photoUri && (
                <Pressable onPress={confirmPhoto}>
                  <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.continueBtn}>
                    <Text style={styles.continueBtnText}>Tamamla →</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          )}

          {/* Prompts */}
          {!typing && currentQ?.type === 'prompts' && (
            <View style={styles.promptsSection}>
              {PROMPT_OPTIONS.map((p) => {
                const answered = selectedPrompts.find(sp => sp.key === p.key);
                return (
                  <Pressable key={p.key} onPress={() => openPrompt(p.key)} style={[styles.promptChip, answered && styles.promptChipAnswered]}>
                    <Text style={styles.promptChipTitle}>{p.title}</Text>
                    {answered && <Text style={styles.promptChipAnswer} numberOfLines={1}>{answered.answer}</Text>}
                  </Pressable>
                );
              })}
              <Text style={styles.promptHint}>{selectedPrompts.length}/3 yanitlandi</Text>
              {selectedPrompts.length >= 3 && (
                <Pressable onPress={confirmPrompts}>
                  <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.continueBtn}>
                    <Text style={styles.continueBtnText}>Devam →</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>

        {/* Text Input */}
        {!typing && (currentQ?.type === 'text' || currentQ?.type === 'number') && !saving && (
          <View style={styles.inputBar}>
            {currentQ.key === 'city' && (
              <Pressable onPress={detectLocation} style={styles.locationBtn} disabled={detectingLocation}>
                {detectingLocation ? <ActivityIndicator size="small" color={Colors.gold} /> : <Text style={{ fontSize: 14 }}>📍</Text>}
              </Pressable>
            )}
            <TextInput
              style={styles.input}
              placeholder={currentQ.placeholder || 'Yaz...'}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleTextSubmit}
              keyboardType={currentQ.type === 'number' ? 'number-pad' : 'default'}
              maxLength={currentQ.maxLength || (currentQ.type === 'number' ? 3 : currentQ.key === 'name' ? 50 : 500)}
              multiline={!!currentQ.maxLength && currentQ.maxLength > 100}
              editable={!saving}
            />
            <Pressable onPress={handleTextSubmit} disabled={!inputText.trim() && !currentQ.optional}>
              <LinearGradient
                colors={inputText.trim() || currentQ.optional ? [Colors.gold, Colors.goldDark] : ['#333', '#222']}
                style={styles.sendBtn}
              >
                <Text style={styles.sendBtnText}>→</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {saving && (
          <View style={styles.savingBar}>
            <ActivityIndicator color={Colors.gold} />
            <Text style={styles.savingText}>Agentin hazirlaniyor...</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Prompt Modal */}
      <Modal visible={!!activePromptKey} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {PROMPT_OPTIONS.find(p => p.key === activePromptKey)?.title}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Yanitini yaz..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={promptAnswer}
              onChangeText={setPromptAnswer}
              maxLength={200}
              multiline
            />
            <Text style={styles.modalCharCount}>{promptAnswer.length}/200</Text>
            <View style={styles.modalBtns}>
              {selectedPrompts.find(p => p.key === activePromptKey) && (
                <Pressable onPress={deletePrompt} style={styles.modalDeleteBtn}>
                  <Text style={styles.modalDeleteText}>Sil</Text>
                </Pressable>
              )}
              <Pressable onPress={() => { setActivePromptKey(null); setPromptAnswer(''); }} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Iptal</Text>
              </Pressable>
              <Pressable onPress={savePrompt} disabled={promptAnswer.trim().length < 3}>
                <LinearGradient
                  colors={promptAnswer.trim().length >= 3 ? [Colors.gold, Colors.goldDark] : ['#333', '#222']}
                  style={styles.modalSaveBtn}
                >
                  <Text style={styles.modalSaveText}>Kaydet</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  progressBar: { height: 3, backgroundColor: Colors.white10, marginHorizontal: 16, marginTop: 8, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 99 },
  stepRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  backText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.white45 },
  stepText: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.white30 },
  skipText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.gold },
  chatArea: { flex: 1, paddingHorizontal: 16 },
  chatContent: { paddingVertical: 12, gap: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.bodySemiBold, fontSize: 13, color: Colors.white },
  bubble: { maxWidth: '78%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  bubbleAgent: { backgroundColor: Colors.white07, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: Colors.gold, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: Fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.88)', lineHeight: 21 },
  typingDots: { fontFamily: Fonts.body, fontSize: 20, color: Colors.white45, letterSpacing: 2 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 40, paddingTop: 4 },
  chip: { backgroundColor: Colors.white06, borderWidth: 1.5, borderColor: Colors.white12, borderRadius: 26, paddingVertical: 8, paddingHorizontal: 16 },
  chipSelected: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.white80 },
  continueBtn: { height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 24 },
  continueBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.goldText },
  photoSection: { paddingLeft: 40, gap: 12 },
  photoPreview: { width: 160, height: 213, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  changePhoto: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  changePhotoText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.white80 },
  pickPhotoBtn: { width: 160, height: 213, borderRadius: 16, backgroundColor: Colors.white05, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.white12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  pickPhotoText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.white45 },
  promptsSection: { paddingLeft: 40, gap: 8 },
  promptChip: { backgroundColor: Colors.white05, borderWidth: 1, borderColor: Colors.white10, borderRadius: 14, padding: 12 },
  promptChipAnswered: { borderColor: Colors.purpleBorder, backgroundColor: Colors.purpleBg },
  promptChipTitle: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.white65 },
  promptChipAnswer: { fontFamily: Fonts.body, fontSize: 12, color: Colors.white45, marginTop: 4 },
  promptHint: { fontFamily: Fonts.body, fontSize: 12, color: Colors.white30, textAlign: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.white05 },
  locationBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.white06, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: Colors.white05, borderWidth: 1, borderColor: Colors.white08, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 16, fontFamily: Fonts.body, fontSize: 14, color: Colors.white, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { fontSize: 18, fontWeight: '700', color: Colors.goldText },
  savingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  savingText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.gold },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontFamily: Fonts.heading, fontSize: 20, color: Colors.white, marginBottom: 16 },
  modalInput: { backgroundColor: Colors.white05, borderWidth: 1, borderColor: Colors.white10, borderRadius: 16, padding: 14, fontFamily: Fonts.body, fontSize: 14, color: Colors.white, minHeight: 80, textAlignVertical: 'top' },
  modalCharCount: { fontFamily: Fonts.body, fontSize: 11, color: Colors.white30, textAlign: 'right', marginTop: 4 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'flex-end' },
  modalDeleteBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,100,100,0.3)' },
  modalDeleteText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: '#ff6b6b' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.white15 },
  modalCancelText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.white45 },
  modalSaveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  modalSaveText: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.goldText },
});
