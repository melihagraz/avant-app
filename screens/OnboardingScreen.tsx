// screens/OnboardingScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, SafeAreaView,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { buildAgentSystemPrompt } from '../lib/agentPrompt';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

type QuestionType = 'text' | 'number' | 'chips' | 'chips_multi' | 'photo';

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

const QUESTIONS: Question[] = [
  {
    id: 'name', key: 'name', type: 'text',
    text: 'Merhaba! Ben senin dating agentınım 🤖 Adını öğrenebilir miyim?',
    placeholder: 'Adın...',
  },
  {
    id: 'age', key: 'age', type: 'number',
    text: (a) => `Güzel isim ${a.name}! ✨ Kaç yaşındasın?`,
    placeholder: 'Yaşın...',
  },
  {
    id: 'gender', key: 'gender', type: 'chips',
    text: 'Kendini nasıl tanımlıyorsun?',
    chips: [
      { label: 'Erkek', value: 'male' },
      { label: 'Kadın', value: 'female' },
      { label: 'Diğer', value: 'other' },
    ],
  },
  {
    id: 'seeking', key: 'seeking', type: 'chips_multi',
    text: 'Kiminle tanışmak istiyorsun? 💜 (Birden fazla seçebilirsin)',
    chips: [
      { label: 'Erkek', value: 'male' },
      { label: 'Kadın', value: 'female' },
      { label: 'Fark etmez', value: 'any' },
    ],
  },
  {
    id: 'city', key: 'city', type: 'chips',
    text: 'Hangi şehirdesin?',
    chips: [
      { label: 'İstanbul', value: 'Istanbul' },
      { label: 'Ankara', value: 'Ankara' },
      { label: 'İzmir', value: 'Izmir' },
      { label: 'Antalya', value: 'Antalya' },
      { label: 'Trabzon', value: 'Trabzon' },
      { label: 'Samsun', value: 'Samsun' },
      { label: 'Gaziantep', value: 'Gaziantep' },
      { label: 'Van', value: 'Van' },
      { label: 'Diğer', value: 'other' },
    ],
    placeholder: 'Şehir adını yaz...',
  },
  {
    id: 'age_range', key: 'age_range', type: 'chips',
    text: 'Kaç yaş aralığında biri arıyorsun?',
    chips: [
      { label: '18-25', value: '18-25' },
      { label: '23-30', value: '23-30' },
      { label: '28-38', value: '28-38' },
      { label: '35-50', value: '35-50' },
      { label: 'Fark etmez', value: '18-80' },
    ],
  },
  {
    id: 'relationship', key: 'relationship_type', type: 'chips',
    text: 'Ne tür bir ilişki arıyorsun?',
    chips: [
      { label: 'Ciddi ilişki 💍', value: 'serious' },
      { label: 'Rahat arkadaşlık', value: 'casual' },
      { label: 'Göreceğiz 🤷', value: 'open' },
    ],
  },
  {
    id: 'job', key: 'job', type: 'text',
    text: 'Harika! Şimdi seni gerçekten tanımaya başlayalım 🎯\n\nNe iş yapıyorsun?',
    placeholder: 'Yazılımcı, öğrenci, mimar...',
  },
  {
    id: 'personality', key: 'personality', type: 'text',
    text: 'Hayatında en çok ne zaman mutlu hissediyorsun? 😊',
    placeholder: 'İstediğin kadar yaz...',
  },
  {
    id: 'looking_for', key: 'looking_for', type: 'text',
    text: 'Peki bir ilişkide en çok neye değer verirsin? 💜',
    placeholder: 'Güven, dürüstlük, eğlence...',
  },
  {
    id: 'dealbreakers', key: 'dealbreakers', type: 'text',
    text: 'Kesinlikle istemediğin, tolere edemediğin bir özellik var mı?',
    placeholder: 'Sigara, sorumsuzluk...',
  },
  {
    id: 'extra', key: 'extra', type: 'text',
    text: 'Son olarak — agentına eklemek istediğin bir şey var mı?\n\nSeni daha iyi tanımlayan, önemli gördüğün herhangi bir şey...',
    placeholder: 'Vegan yaşam tarzım var, annem hasta bakıyorum...',
    optional: true,
  },
  {
    id: 'photo', key: 'photo', type: 'photo',
    text: (a) => `Neredeyse bitti ${a.name}! 🎉 Bir profil fotoğrafı eklemek ister misin?\n\nFotoğraflı profiller çok daha fazla eşleşme alıyor.`,
    optional: true,
  },
];

interface Message {
  role: 'agent' | 'user';
  text: string;
  questionIndex?: number;
}

export default function OnboardingScreen({ navigation }: any) {
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCityInput, setShowCityInput] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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
  const isCityStep = currentQ.id === 'city';
  const isPhotoStep = currentQ.type === 'photo';
  const showTextInput = (!isChip && !isPhotoStep) || (isCityStep && showCityInput);

  const onChipPress = (chip: Chip) => {
    if (busy) return;
    if (isMulti) {
      setSelectedChips(prev =>
        prev.includes(chip.value) ? prev.filter(v => v !== chip.value) : [...prev, chip.value]
      );
      return;
    }
    if (isCityStep && chip.value === 'other') {
      setSelectedChips(['other']);
      setShowCityInput(true);
      setTimeout(() => inputRef.current?.focus(), 100);
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
    advance('Geçtim', '');
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
        Alert.alert('Dosya çok büyük', 'Fotoğraf en fazla 5MB olabilir.');
        return;
      }
      setPhotoUri(asset.uri);
    }
  };

  const advance = (userLabel: string, value: string) => {
    setBusy(true);
    const newAnswers = { ...answers, [currentQ.key]: value };
    setAnswers(newAnswers);
    setInput('');
    setSelectedChips([]);
    setShowCityInput(false);

    if (userLabel !== 'Geçtim') {
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
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'agent', text: `Mükemmel ${newAnswers.name}! 🎉 Agentın hazır. Uygun kişilerle konuşmaya başlıyor... 🔍` },
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
      if (!user) { navigation.replace('Home'); return; }

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
          console.error('Photo upload error:', photoErr);
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
        photos: photoUrl ? [photoUrl] : [],
      });

      const personality = `${finalAnswers.personality} Meslek: ${finalAnswers.job || 'belirtilmedi'}. ${finalAnswers.extra || ''}`.trim();
      const systemPrompt = buildAgentSystemPrompt(personality, finalAnswers.looking_for, finalAnswers.dealbreakers);

      await supabase.from('agents').upsert({
        user_id: user.id,
        personality: finalAnswers.personality,
        looking_for: finalAnswers.looking_for,
        dealbreakers: finalAnswers.dealbreakers,
        system_prompt: systemPrompt,
        tags: [finalAnswers.job, finalAnswers.city].filter(Boolean),
      });

      await supabase.functions.invoke('start-match', { body: { user_id: user.id } });
      navigation.replace('Home');
    } catch (err) {
      console.error('Kayit hatasi:', err);
      setSaving(false);
    }
  };

  const progress = (step / QUESTIONS.length) * 100;

  return (
    <LinearGradient colors={['#FFF8FA', '#F8F5FF', '#F5FAFF']} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.header}>
            <Text style={s.logo}>av<Text style={s.accent}>a</Text>nt</Text>
            <View style={s.progBar}>
              <LinearGradient
                colors={['#FF6B9D', '#C084FC', '#818CF8']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.progFill, { width: `${progress}%` }]}
              />
            </View>
            <Text style={s.stepLbl}>{step + 1}/{QUESTIONS.length}</Text>
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

              return (
                <View key={i}>
                  <View style={[s.row, !isAgent && s.rowRight]}>
                    {isAgent && (
                      <LinearGradient colors={['#FF6B9D', '#C084FC']} style={s.avA}>
                        <Text style={s.avTxt}>A</Text>
                      </LinearGradient>
                    )}
                    <View style={[s.bbl, isAgent ? s.bblA : s.bblU]}>
                      <Text style={[s.bblTxt, !isAgent && s.bblTxtU]}>
                        {isTyping ? '· · ·' : msg.text}
                      </Text>
                    </View>
                    {!isAgent && (
                      <View style={s.avU}><Text style={[s.avTxt, { color: '#7C3AED' }]}>S</Text></View>
                    )}
                  </View>

                  {showChips && (
                    <View style={s.chipsWrap}>
                      {msgQ!.chips!.map(chip => (
                        <TouchableOpacity
                          key={chip.value}
                          style={[s.chip, selectedChips.includes(chip.value) && s.chipSel]}
                          onPress={() => onChipPress(chip)}
                        >
                          {selectedChips.includes(chip.value) ? (
                            <LinearGradient colors={['#FF6B9D', '#C084FC']} style={s.chipGrad}>
                              <Text style={s.chipTxtSel}>{chip.label}</Text>
                            </LinearGradient>
                          ) : (
                            <Text style={s.chipTxt}>{chip.label}</Text>
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
                            colors={selectedChips.length === 0 ? ['#E0D0E8', '#D8C8E0'] : ['#FF6B9D', '#C084FC']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={s.devamGrad}
                          >
                            <Text style={s.devamTxt}>Devam →</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                      {isCityStep && showCityInput && (
                        <TextInput
                          ref={inputRef}
                          style={[s.input, { marginTop: 4, flex: undefined, width: '100%' }]}
                          value={input}
                          onChangeText={setInput}
                          placeholder="Şehir adını yaz..."
                          placeholderTextColor="#C4B5D0"
                          returnKeyType="send"
                          onSubmitEditing={sendText}
                        />
                      )}
                    </View>
                  )}

                  {showPhoto && (
                    <View style={s.photoStep}>
                      {photoUri ? (
                        <View style={s.photoPreviewWrap}>
                          <Image source={{ uri: photoUri }} style={s.photoPreview} />
                          <TouchableOpacity style={s.changePhotoBadge} onPress={pickPhoto}>
                            <Text style={s.changePhotoBadgeTxt}>Değiştir</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={s.pickPhotoBtn} onPress={pickPhoto}>
                          <Text style={s.pickPhotoBtnTxt}>📷 Fotoğraf seç</Text>
                        </TouchableOpacity>
                      )}
                      <View style={s.photoActions}>
                        {photoUri && (
                          <TouchableOpacity style={s.confirmPhotoBtn} onPress={() => advance('Fotoğraf eklendi ✓', photoUri!)}>
                            <LinearGradient colors={['#FF6B9D', '#C084FC']} style={s.confirmGrad}>
                              <Text style={s.confirmPhotoBtnTxt}>Devam et →</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={s.skipPhotoBtn} onPress={skipOptional}>
                          <Text style={s.skipPhotoBtnTxt}>Şimdilik geç</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {showOptional && (
                    <TouchableOpacity style={s.skipBtn} onPress={skipOptional}>
                      <Text style={s.skipTxt}>Geç →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {saving && (
              <View style={s.row}>
                <LinearGradient colors={['#FF6B9D', '#C084FC']} style={s.avA}>
                  <Text style={s.avTxt}>A</Text>
                </LinearGradient>
                <View style={s.bblA}><ActivityIndicator size="small" color="#FF6B9D" /></View>
              </View>
            )}
          </ScrollView>

          {showTextInput && !isCityStep && (
            <View style={s.inputRow}>
              <TextInput
                ref={inputRef}
                style={s.input}
                value={input}
                onChangeText={setInput}
                placeholder={currentQ.placeholder || 'Cevabını yaz...'}
                placeholderTextColor="#C4B5D0"
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
                  colors={(!input.trim() || busy) ? ['#E0D0E8', '#D8C8E0'] : ['#FF6B9D', '#C084FC']}
                  style={s.sendGrad}
                >
                  <Text style={s.sendTxt}>↑</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  logo: { fontSize: 22, fontWeight: '800', color: '#2D1B4E', letterSpacing: -0.5 },
  accent: { color: '#FF6B9D' },
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
