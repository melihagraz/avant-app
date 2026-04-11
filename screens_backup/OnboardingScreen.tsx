// screens/OnboardingScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { buildAgentSystemPrompt } from '../lib/agentPrompt';

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
    text: 'Merhaba! Ben senin dating agentınım. Adını öğrenebilir miyim?',
    placeholder: 'Adın...',
  },
  {
    id: 'age', key: 'age', type: 'number',
    text: (a) => `Güzel isim ${a.name}! Kaç yaşındasın?`,
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
    text: 'Kiminle tanışmak istiyorsun? (Birden fazla seçebilirsin)',
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
      { label: 'Ciddi ilişki', value: 'serious' },
      { label: 'Rahat arkadaşlık', value: 'casual' },
      { label: 'Göreceğiz', value: 'open' },
    ],
  },
  {
    id: 'job', key: 'job', type: 'text',
    text: 'Harika! Şimdi seni gerçekten tanımaya başlayalım.\n\nNe iş yapıyorsun?',
    placeholder: 'Yazılımcı, öğrenci, mimar...',
  },
  {
    id: 'personality', key: 'personality', type: 'text',
    text: 'Hayatında en çok ne zaman mutlu hissediyorsun?',
    placeholder: 'İstediğin kadar yaz...',
  },
  {
    id: 'looking_for', key: 'looking_for', type: 'text',
    text: 'Peki bir ilişkide en çok neye değer verirsin?',
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
    text: (a) => `Neredeyse bitti ${a.name}! Bir profil fotoğrafı eklemek ister misin?\n\nFotoğraflı profiller çok daha fazla eşleşme alıyor.`,
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

  const sendText = () => {
    if (busy || !input.trim()) return;
    const v = input.trim();
    if (currentQ.type === 'number') {
      const n = parseInt(v);
      if (isNaN(n) || n < 18 || n > 80) return;
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
      setPhotoUri(result.assets[0].uri);
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
            { role: 'agent', text: `Mükemmel ${newAnswers.name}! Agentın hazır. Uygun kişilerle konuşmaya başlıyor... 🔍` },
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

      // Fotoğraf yükle
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
        seeking: finalAnswers.seeking?.split(',') || [],
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
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.header}>
          <Text style={s.logo}>av<Text style={s.accent}>a</Text>nt</Text>
          <View style={s.progBar}>
            <View style={[s.progFill, { width: `${progress}%` }]} />
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
                  {isAgent && <View style={s.avA}><Text style={s.avTxt}>A</Text></View>}
                  <View style={[s.bbl, isAgent ? s.bblA : s.bblU]}>
                    <Text style={[s.bblTxt, !isAgent && s.bblTxtU]}>
                      {isTyping ? '· · ·' : msg.text}
                    </Text>
                  </View>
                  {!isAgent && <View style={s.avU}><Text style={[s.avTxt, { color: '#0C447C' }]}>S</Text></View>}
                </View>

                {showChips && (
                  <View style={s.chipsWrap}>
                    {msgQ!.chips!.map(chip => (
                      <TouchableOpacity
                        key={chip.value}
                        style={[s.chip, selectedChips.includes(chip.value) && s.chipSel]}
                        onPress={() => onChipPress(chip)}
                      >
                        <Text style={[s.chipTxt, selectedChips.includes(chip.value) && s.chipTxtSel]}>
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {isMulti && (
                      <TouchableOpacity
                        style={[s.devamBtn, selectedChips.length === 0 && s.devamBtnOff]}
                        onPress={sendMulti}
                        disabled={selectedChips.length === 0}
                      >
                        <Text style={s.devamTxt}>Devam →</Text>
                      </TouchableOpacity>
                    )}
                    {isCityStep && showCityInput && (
                      <TextInput
                        ref={inputRef}
                        style={[s.input, { marginTop: 4, flex: undefined, width: '100%' }]}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Şehir adını yaz..."
                        placeholderTextColor="#aaa"
                        returnKeyType="send"
                        onSubmitEditing={sendText}
                      />
                    )}
                  </View>
                )}

                {showPhoto && (
                  <View style={s.photoStep}>
                    {photoUri ? (
                      <View>
                        <TouchableOpacity onPress={pickPhoto}>
                          <Text style={s.changePhotoTxt}>Değiştir</Text>
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
                          <Text style={s.confirmPhotoBtnTxt}>Devam et →</Text>
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
              <View style={s.avA}><Text style={s.avTxt}>A</Text></View>
              <View style={s.bblA}><ActivityIndicator size="small" color="#D85A30" /></View>
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
              placeholderTextColor="#aaa"
              multiline={currentQ.type === 'text'}
              keyboardType={currentQ.type === 'number' ? 'number-pad' : 'default'}
              maxLength={currentQ.type === 'number' ? 3 : 500}
              returnKeyType={currentQ.type === 'text' ? 'default' : 'send'}
              onSubmitEditing={currentQ.type !== 'text' ? sendText : undefined}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || busy) && s.sendBtnOff]}
              onPress={sendText}
              disabled={!input.trim() || busy}
            >
              <Text style={s.sendTxt}>↑</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function isChipQ(q: Question) {
  return q.type === 'chips' || q.type === 'chips_multi';
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5' },
  logo: { fontSize: 18, fontWeight: '500', color: '#1a1a1a', letterSpacing: -0.5 },
  accent: { color: '#D85A30' },
  progBar: { flex: 1, height: 3, backgroundColor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: '#D85A30', borderRadius: 2 },
  stepLbl: { fontSize: 12, color: '#aaa', minWidth: 28, textAlign: 'right' },
  chat: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowRight: { flexDirection: 'row-reverse' },
  avA: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FAECE7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avU: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avTxt: { fontSize: 11, fontWeight: '500', color: '#712B13' },
  bbl: { borderRadius: 16, padding: 10, paddingHorizontal: 14, maxWidth: '78%', borderWidth: 0.5 },
  bblA: { backgroundColor: '#f5f5f4', borderColor: '#e8e8e8', borderBottomLeftRadius: 4 },
  bblU: { backgroundColor: '#D85A30', borderColor: 'transparent', borderBottomRightRadius: 4 },
  bblTxt: { fontSize: 14, lineHeight: 21, color: '#1a1a1a' },
  bblTxtU: { color: '#fff' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 36, marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 0.5, borderColor: '#ddd', backgroundColor: '#fff' },
  chipSel: { backgroundColor: '#D85A30', borderColor: '#D85A30' },
  chipTxt: { fontSize: 14, color: '#555' },
  chipTxtSel: { color: '#fff', fontWeight: '500' },
  devamBtn: { width: '100%', marginTop: 4, padding: 11, borderRadius: 20, backgroundColor: '#D85A30', alignItems: 'center' },
  devamBtnOff: { backgroundColor: '#f0c4b3' },
  devamTxt: { color: '#fff', fontSize: 14, fontWeight: '500' },
  skipBtn: { marginLeft: 36, marginTop: 8, paddingVertical: 6 },
  skipTxt: { fontSize: 13, color: '#aaa' },
  photoStep: { marginLeft: 36, marginTop: 12, gap: 12 },
  changePhotoTxt: { fontSize: 13, color: '#D85A30' },
  pickPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f5f4', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: '#e5e5e5' },
  pickPhotoBtnTxt: { fontSize: 15, color: '#555', fontWeight: '500' },
  photoActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  confirmPhotoBtn: { backgroundColor: '#D85A30', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  confirmPhotoBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  skipPhotoBtn: { paddingVertical: 10, paddingHorizontal: 4 },
  skipPhotoBtnTxt: { fontSize: 13, color: '#aaa' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, paddingHorizontal: 16, borderTopWidth: 0.5, borderTopColor: '#e5e5e5' },
  input: { flex: 1, backgroundColor: '#f5f5f4', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#1a1a1a', maxHeight: 100, borderWidth: 0.5, borderColor: '#e5e5e5' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#D85A30', alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: '#f0c4b3' },
  sendTxt: { color: '#fff', fontSize: 18, fontWeight: '500' },
});
