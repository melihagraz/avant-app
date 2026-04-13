import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Circle, Path, Ellipse } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Colors, Fonts, Typography } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { buildAgentSystemPrompt } from '../../src/lib/agentPrompt';
import { moderateText, getModerationMessage } from '../../src/lib/moderation';
import { trackEvent } from '../../src/lib/analytics';

// ─── Phase type ───
type Phase = 'photos' | 'chatbot';

// ─── Question definitions for chatbot phase ───
interface Question {
  key: string;
  agentText: string | ((a: Record<string, string>) => string);
  type: 'text' | 'number' | 'chips' | 'chips_multi' | 'prompts';
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
    { value: 'spiritual', label: 'Spirituel' }, { value: 'agnostic', label: 'Agnostik' },
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
  { key: 'interests', agentText: (a) => `Guzel ${a.name}! Ilgi alanlarini ve hobilerini sec. Birden fazla secebilirsin.`, type: 'chips_multi', options: [
    { value: 'Seyahat', label: '✈️ Seyahat' }, { value: 'Fotograf', label: '📸 Fotograf' },
    { value: 'Muzik', label: '🎵 Muzik' }, { value: 'Spor', label: '⚽ Spor' },
    { value: 'Yemek', label: '🍳 Yemek/Mutfak' }, { value: 'Kahve', label: '☕ Kahve' },
    { value: 'Kitap', label: '📚 Kitap' }, { value: 'Sanat', label: '🎨 Sanat' },
    { value: 'Film', label: '🎬 Film/Dizi' }, { value: 'Doga', label: '🌿 Doga' },
    { value: 'Yoga', label: '🧘 Yoga' }, { value: 'Dans', label: '💃 Dans' },
    { value: 'Oyun', label: '🎮 Oyun' }, { value: 'Teknoloji', label: '💻 Teknoloji' },
    { value: 'Bilim', label: '🧬 Bilim' }, { value: 'Kamp', label: '⛺ Kamp' },
  ]},
  { key: 'personality', agentText: (a) => `Harika ${a.name}! Simdi seni daha yakindan taniyayim. Kendini nasil tanimlarsin?`, type: 'text', placeholder: 'Kendini anlat...', maxLength: 500 },
  { key: 'looking_for', agentText: 'Bir partnerde ne ariyorsun? Sana uygun birini bulmam icin bilmem gereken seyleri yaz.', type: 'text', placeholder: 'Ne ariyorsun...', maxLength: 500 },
  { key: 'dealbreakers', agentText: 'Kesinlikle kabul edemeyecegin seyler neler? Bunlari bilmem onemli.', type: 'text', placeholder: 'Dealbreaker\'larin...', maxLength: 500 },
  { key: 'extra', agentText: 'Bilmem gereken baska bir sey var mi? (Istersen bos birakabilirsin)', type: 'text', optional: true, placeholder: 'Eklemek istediklerin...', maxLength: 500 },
  { key: 'prompts', agentText: (a) => `Neredeyse bitti ${a.name}! Son olarak, kendini ifade edecek 3 prompt sec ve yanitla.`, type: 'prompts' },
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

const TOTAL_SLOTS = 6;

interface ChatMessage {
  role: 'agent' | 'user';
  text: string;
}

// ═══════════════════════════════════════════
//  PHOTO PHASE COMPONENT
// ═══════════════════════════════════════════
function PhotoPhase({ photos, onPhotosChange, onContinue, saving }: {
  photos: string[];
  onPhotosChange: (p: string[]) => void;
  onContinue: () => void;
  saving?: boolean;
}) {
  const pickPhoto = async (index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPhotos = [...photos];
      if (index < newPhotos.length) {
        newPhotos[index] = result.assets[0].uri;
      } else {
        newPhotos.push(result.assets[0].uri);
      }
      onPhotosChange(newPhotos);
    }
  };

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => photos[i] || null);

  return (
    <SafeAreaView style={ps.container}>
      {/* Progress dots */}
      <View style={ps.steps}>
        <View style={[ps.dot, ps.dotDone]} />
        <View style={[ps.dot, ps.dotDone]} />
        <View style={ps.dot} />
        <View style={ps.dot} />
        <View style={ps.dot} />
      </View>

      <Animated.Text entering={FadeInUp.duration(600)} style={ps.title}>
        Fotograflarini{'\n'}ekle
      </Animated.Text>
      <Text style={ps.sub}>Ilk 3 fotograf eslemeyi dogrudan etkiler</Text>

      {/* Photo Grid */}
      <Animated.View entering={FadeInDown.duration(600).delay(200)} style={ps.photoGrid}>
        {slots.map((uri, i) => (
          <Pressable key={i} style={[ps.photoSlot, uri && ps.photoFilled]} onPress={() => pickPhoto(i)}>
            {uri ? (
              <Image source={{ uri }} style={ps.slotImage} />
            ) : (
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={10} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
                <Path d="M12 8v8M8 12h8" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            )}
          </Pressable>
        ))}
      </Animated.View>

      {/* Tip */}
      <View style={ps.tipBox}>
        <Text style={ps.tipText}>
          💡 <Text style={{ fontWeight: '700' }}>Ipucu:</Text> Gercek gulumseme iceren fotograflar %40 daha fazla eslisme saglar.
        </Text>
      </View>

      {/* Continue */}
      <Pressable onPress={onContinue} disabled={photos.length === 0 || saving}>
        {({ pressed }) => (
          <LinearGradient
            colors={photos.length > 0 ? [Colors.gold, Colors.goldDark] : ['#333', '#222']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[ps.btnPrimary, (pressed && photos.length > 0) && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            {saving ? (
              <ActivityIndicator color={Colors.goldText} />
            ) : (
              <Text style={[ps.btnText, photos.length === 0 && { color: 'rgba(255,255,255,0.3)' }]}>Devam →</Text>
            )}
          </LinearGradient>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, paddingHorizontal: 22, paddingTop: 12 },
  steps: { flexDirection: 'row', gap: 5, marginBottom: 22 },
  dot: { height: 3, flex: 1, borderRadius: 99, backgroundColor: Colors.white10 },
  dotDone: { backgroundColor: Colors.gold },
  title: { fontFamily: Fonts.heading, fontSize: 28, color: Colors.white, lineHeight: 34, marginBottom: 6 },
  sub: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  photoSlot: {
    width: '31%', aspectRatio: 3 / 4, borderRadius: 14,
    backgroundColor: Colors.white05, borderWidth: 1.5,
    borderStyle: 'dashed', borderColor: Colors.white12,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  photoFilled: { borderStyle: 'solid', borderColor: 'transparent' },
  slotImage: { width: '100%', height: '100%', borderRadius: 14 },
  tipBox: {
    backgroundColor: Colors.goldBg, borderWidth: 1, borderColor: Colors.goldBorder,
    borderRadius: 12, padding: 11, paddingHorizontal: 14, marginBottom: 18,
  },
  tipText: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(232,184,109,0.85)', lineHeight: 18 },
  btnPrimary: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.goldText },
});

// ═══════════════════════════════════════════
//  CHATBOT PHASE COMPONENT
// ═══════════════════════════════════════════
function ChatbotPhase({ onFinished }: { onFinished: (answers: Record<string, string>, prompts: { key: string; answer: string }[]) => void }) {
  const { user, checkAgent } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputText, setInputText] = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Prompts
  const [selectedPrompts, setSelectedPrompts] = useState<{ key: string; answer: string }[]>([]);
  const [activePromptKey, setActivePromptKey] = useState<string | null>(null);
  const [promptAnswer, setPromptAnswer] = useState('');

  useEffect(() => { showAgentMessage(0); }, []);

  const getQuestionText = (q: Question): string => {
    if (typeof q.agentText === 'function') return q.agentText(answers);
    return q.agentText;
  };

  const showAgentMessage = (qi: number) => {
    setTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'agent', text: getQuestionText(QUESTIONS[qi]) }]);
      setTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 800);
  };

  const advanceToNext = (answer: string) => {
    const q = QUESTIONS[step];
    setMessages((prev) => [...prev, { role: 'user', text: answer }]);
    const newAnswers = { ...answers, [q.key]: answer };
    setAnswers(newAnswers);
    setInputText('');
    setSelectedChips([]);

    const nextStep = step + 1;
    if (nextStep >= QUESTIONS.length) {
      finalize(newAnswers);
      return;
    }
    setStep(nextStep);
    showAgentMessage(nextStep);
  };

  const handleTextSubmit = () => {
    const q = QUESTIONS[step];
    const text = inputText.trim();
    if (!text && !q.optional) return;
    if (!text && q.optional) { advanceToNext('-'); return; }

    if (q.type === 'number') {
      const n = parseInt(text);
      if (isNaN(n) || n < 18 || n > 80) { Alert.alert('Hata', 'Gecerli bir yas gir (18-80).'); return; }
    }
    if (q.key === 'name' && text.length < 2) { Alert.alert('Hata', 'Isim en az 2 karakter olmali.'); return; }

    if (['personality', 'looking_for', 'dealbreakers', 'extra', 'job'].includes(q.key)) {
      const mod = moderateText(text);
      if (!mod.clean) { Alert.alert('Uyari', getModerationMessage(mod.reason || '')); return; }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    advanceToNext(text);
  };

  const handleChipSelect = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const q = QUESTIONS[step];
    if (q.type === 'chips') {
      advanceToNext(q.options?.find(o => o.value === value)?.label || value);
    } else {
      setSelectedChips((prev) => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    }
  };

  const handleMultiChipContinue = () => {
    if (selectedChips.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advanceToNext(selectedChips.join(', '));
  };

  const detectLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Izin gerekli', 'Konum izni verilmedi.'); setDetectingLocation(false); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync(loc.coords);
      if (place) setInputText(place.city || place.region || place.country || '');
    } catch { Alert.alert('Hata', 'Konum algilanamadi.'); }
    setDetectingLocation(false);
  };

  const openPrompt = (key: string) => {
    setActivePromptKey(key);
    setPromptAnswer(selectedPrompts.find(p => p.key === key)?.answer || '');
  };
  const savePrompt = () => {
    if (!activePromptKey || promptAnswer.trim().length < 3) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPrompts((prev) => [...prev.filter(p => p.key !== activePromptKey), { key: activePromptKey, answer: promptAnswer.trim() }]);
    setActivePromptKey(null); setPromptAnswer('');
  };
  const deletePrompt = () => {
    if (!activePromptKey) return;
    setSelectedPrompts((prev) => prev.filter(p => p.key !== activePromptKey));
    setActivePromptKey(null); setPromptAnswer('');
  };
  const confirmPrompts = () => {
    if (selectedPrompts.length < 3) { Alert.alert('Eksik', 'En az 3 prompt yanitlamalisin.'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    advanceToNext(`${selectedPrompts.length} prompt yanitlandi`);
  };

  // ── CHATBOT DONE — pass data to parent ──
  const finalize = (allAnswers: Record<string, string>) => {
    setMessages((prev) => [...prev, { role: 'agent', text: `Harika ${allAnswers.name || ''}! Simdi fotograflarini ekleyelim.` }]);
    setTimeout(() => onFinished(allAnswers, selectedPrompts), 1200);
  };

  const currentQ = QUESTIONS[step];
  const progress = (step + 1) / QUESTIONS.length;

  return (
    <SafeAreaView style={cs.container}>
      {/* Progress */}
      <View style={cs.progressBar}><View style={[cs.progressFill, { width: `${progress * 100}%` }]} /></View>
      <View style={cs.stepRow}>
        <Pressable onPress={() => { if (step > 0) { setStep(step - 1); setMessages(m => m.slice(0, -2)); } }}>
          <Text style={cs.backText}>{step > 0 ? '← Geri' : ''}</Text>
        </Pressable>
        <Text style={cs.stepText}>{step + 1} / {QUESTIONS.length}</Text>
        {currentQ?.optional && <Pressable onPress={() => advanceToNext('-')}><Text style={cs.skipText}>Atla</Text></Pressable>}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={cs.chatArea} contentContainerStyle={cs.chatContent} showsVerticalScrollIndicator={false}>
          {messages.map((msg, i) => (
            <Animated.View key={i} entering={FadeInDown.duration(400)} style={[cs.msgRow, msg.role === 'user' && cs.msgRowUser]}>
              {msg.role === 'agent' && (
                <LinearGradient colors={[Colors.purpleDark, Colors.purple]} style={cs.avatar}><Text style={cs.avatarText}>A</Text></LinearGradient>
              )}
              <View style={[cs.bubble, msg.role === 'user' ? cs.bubbleUser : cs.bubbleAgent]}>
                <Text style={[cs.bubbleText, msg.role === 'user' && { color: Colors.goldText }]}>{msg.text}</Text>
              </View>
              {msg.role === 'user' && (
                <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={cs.avatar}><Text style={[cs.avatarText, { color: Colors.goldText }]}>S</Text></LinearGradient>
              )}
            </Animated.View>
          ))}

          {typing && (
            <View style={cs.msgRow}>
              <LinearGradient colors={[Colors.purpleDark, Colors.purple]} style={cs.avatar}><Text style={cs.avatarText}>A</Text></LinearGradient>
              <View style={[cs.bubble, cs.bubbleAgent]}><Text style={cs.typingDots}>...</Text></View>
            </View>
          )}

          {/* Chips */}
          {!typing && currentQ?.type === 'chips' && (
            <View style={cs.chipsWrap}>
              {currentQ.options?.map((opt) => (
                <Pressable key={opt.value} onPress={() => handleChipSelect(opt.value)}>
                  <View style={cs.chip}><Text style={cs.chipText}>{opt.label}</Text></View>
                </Pressable>
              ))}
            </View>
          )}
          {!typing && currentQ?.type === 'chips_multi' && (
            <View style={cs.chipsWrap}>
              {currentQ.options?.map((opt) => (
                <Pressable key={opt.value} onPress={() => handleChipSelect(opt.value)}>
                  <View style={[cs.chip, selectedChips.includes(opt.value) && cs.chipSelected]}>
                    <Text style={[cs.chipText, selectedChips.includes(opt.value) && { color: Colors.goldText }]}>{opt.label}</Text>
                  </View>
                </Pressable>
              ))}
              {selectedChips.length > 0 && (
                <Pressable onPress={handleMultiChipContinue}>
                  <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={cs.continueBtn}><Text style={cs.continueBtnText}>Devam →</Text></LinearGradient>
                </Pressable>
              )}
            </View>
          )}

          {/* Prompts */}
          {!typing && currentQ?.type === 'prompts' && (
            <View style={cs.promptsSection}>
              {PROMPT_OPTIONS.map((p) => {
                const answered = selectedPrompts.find(sp => sp.key === p.key);
                return (
                  <Pressable key={p.key} onPress={() => openPrompt(p.key)} style={[cs.promptChip, answered && cs.promptChipAnswered]}>
                    <Text style={cs.promptChipTitle}>{p.title}</Text>
                    {answered && <Text style={cs.promptChipAnswer} numberOfLines={1}>{answered.answer}</Text>}
                  </Pressable>
                );
              })}
              <Text style={cs.promptHint}>{selectedPrompts.length}/3 yanitlandi</Text>
              {selectedPrompts.length >= 3 && (
                <Pressable onPress={confirmPrompts}>
                  <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={cs.continueBtn}><Text style={cs.continueBtnText}>Devam →</Text></LinearGradient>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>

        {/* Text input */}
        {!typing && (currentQ?.type === 'text' || currentQ?.type === 'number') && (
          <View style={cs.inputBar}>
            {currentQ.key === 'city' && (
              <Pressable onPress={detectLocation} style={cs.locationBtn} disabled={detectingLocation}>
                {detectingLocation ? <ActivityIndicator size="small" color={Colors.gold} /> : <Text style={{ fontSize: 14 }}>📍</Text>}
              </Pressable>
            )}
            <TextInput
              style={cs.input} placeholder={currentQ.placeholder || 'Yaz...'} placeholderTextColor="rgba(255,255,255,0.3)"
              value={inputText} onChangeText={setInputText} onSubmitEditing={handleTextSubmit}
              keyboardType={currentQ.type === 'number' ? 'number-pad' : 'default'}
              maxLength={currentQ.maxLength || (currentQ.type === 'number' ? 3 : currentQ.key === 'name' ? 50 : 500)}
              multiline={!!currentQ.maxLength && currentQ.maxLength > 100} editable={true}
            />
            <Pressable onPress={handleTextSubmit} disabled={!inputText.trim() && !currentQ.optional}>
              <LinearGradient colors={inputText.trim() || currentQ.optional ? [Colors.gold, Colors.goldDark] : ['#333', '#222']} style={cs.sendBtn}>
                <Text style={cs.sendBtnText}>→</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Prompt Modal */}
      <Modal visible={!!activePromptKey} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={cs.modalOverlay} onPress={() => { setActivePromptKey(null); setPromptAnswer(''); }}>
            <Pressable style={cs.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={cs.modalHandle} />
              <Text style={cs.modalTitle}>{PROMPT_OPTIONS.find(p => p.key === activePromptKey)?.title}</Text>
              <TextInput
                style={cs.modalInput}
                placeholder="Yanitini yaz..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={promptAnswer}
                onChangeText={setPromptAnswer}
                maxLength={200}
                multiline
                autoFocus
              />
              <View style={cs.modalFooter}>
                <Text style={cs.modalCharCount}>{promptAnswer.length}/200</Text>
                <View style={cs.modalBtns}>
                  {selectedPrompts.find(p => p.key === activePromptKey) && (
                    <Pressable onPress={deletePrompt} style={cs.modalDeleteBtn}><Text style={cs.modalDeleteText}>Sil</Text></Pressable>
                  )}
                  <Pressable onPress={() => { setActivePromptKey(null); setPromptAnswer(''); }} style={cs.modalCancelBtn}><Text style={cs.modalCancelText}>Iptal</Text></Pressable>
                  <Pressable onPress={savePrompt} disabled={promptAnswer.trim().length < 3}>
                    <LinearGradient colors={promptAnswer.trim().length >= 3 ? [Colors.gold, Colors.goldDark] : ['#333', '#222']} style={cs.modalSaveBtn}><Text style={cs.modalSaveText}>Kaydet</Text></LinearGradient>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
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
  modalContent: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12 },
  modalHandle: { width: 36, height: 4, borderRadius: 99, backgroundColor: Colors.white15, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: Fonts.heading, fontSize: 20, color: Colors.white, marginBottom: 12 },
  modalInput: { backgroundColor: Colors.white05, borderWidth: 1, borderColor: Colors.white10, borderRadius: 16, padding: 14, fontFamily: Fonts.body, fontSize: 14, color: Colors.white, minHeight: 70, maxHeight: 120, textAlignVertical: 'top' },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  modalCharCount: { fontFamily: Fonts.body, fontSize: 11, color: Colors.white30 },
  modalBtns: { flexDirection: 'row', gap: 8 },
  modalDeleteBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,100,100,0.3)' },
  modalDeleteText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: '#ff6b6b' },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.white15 },
  modalCancelText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.white45 },
  modalSaveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  modalSaveText: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.goldText },
});

// ═══════════════════════════════════════════
//  MAIN PROFILE SETUP SCREEN
//  Flow: Chatbot (steps 1-6) → Photos (step 7) → Discover (step 8)
// ═══════════════════════════════════════════
export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, checkAgent } = useAuthStore();
  const [phase, setPhase] = useState<Phase>('chatbot');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [chatAnswers, setChatAnswers] = useState<Record<string, string>>({});
  const [chatPrompts, setChatPrompts] = useState<{ key: string; answer: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const handleChatbotDone = (answers: Record<string, string>, prompts: { key: string; answer: string }[]) => {
    setChatAnswers(answers);
    setChatPrompts(prompts);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('photos');
  };

  const handlePhotoContinue = async () => {
    if (photoUris.length === 0) {
      Alert.alert('Fotograf gerekli', 'En az 1 fotograf yukle.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Oturum bulunamadi');
      const userId = session.user.id;
      const email = session.user.email || '';

      // Upload photos using base64 (more reliable on iOS than blob)
      const uploadedUrls: string[] = [];
      for (const uri of photoUris) {
        try {
          const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
          const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

          // Read as arraybuffer for reliable upload on iOS
          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();

          const { error: uploadErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, arrayBuffer, {
              contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
              upsert: true,
            });

          if (uploadErr) {
            console.warn('[Photo] Upload failed:', uploadErr.message);
          } else {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            uploadedUrls.push(urlData.publicUrl);
          }
        } catch (photoErr) {
          console.warn('[Photo] Upload exception:', photoErr);
        }
      }

      console.log('[Onboarding] Photos uploaded:', uploadedUrls.length, '/', photoUris.length);

      const a = chatAnswers;
      const ageRangeParts = (a.age_range || '18-80').match(/(\d+)/g);
      const ageMin = ageRangeParts ? parseInt(ageRangeParts[0]) : 18;
      const ageMax = ageRangeParts && ageRangeParts[1] ? parseInt(ageRangeParts[1]) : 80;
      const promptsData = chatPrompts;

      // Map chip labels back to DB values for seeking
      const seekingMap: Record<string, string> = { 'Erkek': 'male', 'Kadin': 'female', 'Farketmez': 'any' };
      const seekingRaw = (a.seeking || 'Farketmez').split(', ');
      const seekingValues = seekingRaw.map(s => seekingMap[s] || s.toLowerCase());

      // Map relationship labels
      const relMap: Record<string, string> = {
        'Hayat arkadasi': 'life_partner', 'Ciddi iliski': 'long_term',
        'Kisa iliski': 'short_term', 'Kesfediyorum': 'figuring_out',
      };
      const relValue = relMap[a.relationship] || a.relationship?.toLowerCase() || 'figuring_out';

      // Map gender labels
      const genderMap: Record<string, string> = { 'Erkek': 'male', 'Kadin': 'female', 'Diger': 'other' };
      const genderValue = genderMap[a.gender] || a.gender?.toLowerCase() || 'other';

      // Map optional chip labels
      const optMap: Record<string, string> = {
        'Istiyorum': 'want', 'Istemiyorum': 'dont_want', 'Acigim': 'open', 'Emin degilim': 'not_sure',
        'Evet': 'yes', 'Hayir': 'no', 'Bazen': 'sometimes', 'Belirtmek istemem': 'prefer_not_say',
        'Muslim': 'muslim', 'Hristiyan': 'christian', 'Spirituel': 'spiritual',
        'Agnostik': 'agnostic', 'Ateist': 'atheist',
      };
      const mapOpt = (v?: string) => !v || v === '-' ? null : (optMap[v] || v.toLowerCase());

      const profileData = {
        id: userId, email,
        name: a.name, age: parseInt(a.age) || 25,
        gender: genderValue,
        seeking: seekingValues,
        city: a.city, age_min: ageMin, age_max: ageMax,
        relationship_type: relValue,
        dating_intention: relValue,
        family_plans: mapOpt(a.family_plans),
        religion: mapOpt(a.religion),
        alcohol: mapOpt(a.alcohol),
        smoking: mapOpt(a.smoking),
        education: a.education && a.education !== '-' ? a.education : null,
        job: a.job || null,
        interests: a.interests ? a.interests.split(', ') : [],
        prompts: promptsData,
        photos: uploadedUrls,
        is_discoverable: true,
        last_active_at: new Date().toISOString(),
      };

      console.log('[Onboarding] Saving profile for:', userId);
      const { error: profileErr } = await supabase.from('users').upsert(profileData);
      if (profileErr) {
        console.error('[Onboarding] Profile error:', JSON.stringify(profileErr));
        Alert.alert('Hata', `Profil: ${profileErr.message}`);
        setSaving(false);
        return;
      }

      console.log('[Onboarding] Profile saved. Creating agent...');
      const systemPrompt = buildAgentSystemPrompt(
        a.personality || '', a.looking_for || '', a.dealbreakers || '', undefined,
        { dating_intention: relValue, family_plans: mapOpt(a.family_plans) || undefined,
          religion: mapOpt(a.religion) || undefined, alcohol: mapOpt(a.alcohol) || undefined,
          smoking: mapOpt(a.smoking) || undefined, education: a.education !== '-' ? a.education : undefined },
        promptsData,
      );

      const { error: agentErr } = await supabase.from('agents').upsert({
        user_id: userId, personality: a.personality || '',
        looking_for: a.looking_for || '', dealbreakers: a.dealbreakers || '',
        system_prompt: systemPrompt, tags: [a.job, a.city].filter(Boolean),
      });
      if (agentErr) {
        console.error('[Onboarding] Agent error:', JSON.stringify(agentErr));
        Alert.alert('Hata', `Agent: ${agentErr.message}`);
        setSaving(false);
        return;
      }

      console.log('[Onboarding] Agent created. Starting match...');
      try { await supabase.functions.invoke('start-match', { body: {} }); } catch {}
      await checkAgent(userId);
      trackEvent('onboarding_complete');

      router.replace('/(tabs)/discover');
    } catch (err: any) {
      console.error('[Onboarding] Finalize error:', err?.message || err);
      Alert.alert('Hata', err?.message || 'Profil kaydedilemedi. Tekrar deneyin.');
      setSaving(false);
    }
  };

  if (phase === 'chatbot') {
    return <ChatbotPhase onFinished={handleChatbotDone} />;
  }

  return <PhotoPhase photos={photoUris} onPhotosChange={setPhotoUris} onContinue={handlePhotoContinue} saving={saving} />;
}
