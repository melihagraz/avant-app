// screens/WelcomeScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated,
} from 'react-native';

export default function WelcomeScreen({ navigation }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={s.container}>
      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* Logo */}
        <View style={s.logoWrap}>
          <Text style={s.logo}>av<Text style={s.accent}>a</Text>nt</Text>
          <View style={s.agentPill}>
            <View style={s.pillDot} />
            <Text style={s.pillTxt}>AI Agent Dating</Text>
          </View>
        </View>

        {/* Ana mesaj */}
        <View style={s.messageWrap}>
          <Text style={s.title}>Önce agentın{'\n'}tanışır</Text>
          <Text style={s.sub}>
            Seni temsil eden bir AI agent oluşturuyorum. Agentin arka planda çalışır, uyumlu kişileri bulur ve eşleşince seni haberdar eder.
          </Text>
        </View>

        {/* Adımlar */}
        <View style={s.steps}>
          {[
            { icon: '🎯', title: 'Seni tanıyorum', desc: 'Birkaç soru soruyorum, agentını oluşturuyorum' },
            { icon: '🤖', title: 'Agentin çalışır', desc: 'Uyumlu kişilerin agentlarıyla konuşur' },
            { icon: '💬', title: 'Top sende', desc: 'Eşleşince karar senin — devam et ya da geç' },
          ].map((step, i) => (
            <View key={i} style={s.step}>
              <View style={s.stepIcon}><Text style={s.stepIconTxt}>{step.icon}</Text></View>
              <View style={s.stepText}>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Not */}
        <Text style={s.note}>
          Sorulardan sıkılırsan istediğin zaman "Yeter" diyebilirsin — agentin hemen devreye girer.
        </Text>

        {/* Buton */}
        <TouchableOpacity
          style={s.btn}
          onPress={() => navigation.replace('Onboarding')}
        >
          <Text style={s.btnTxt}>Başlayalım →</Text>
        </TouchableOpacity>

      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 28, paddingTop: 20, justifyContent: 'space-between' },
  logoWrap: { alignItems: 'flex-start', gap: 8 },
  logo: { fontSize: 36, fontWeight: '500', color: '#1a1a1a', letterSpacing: -1 },
  accent: { color: '#D85A30' },
  agentPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f5f5f4', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D85A30' },
  pillTxt: { fontSize: 12, color: '#666', fontWeight: '500' },
  messageWrap: { gap: 12 },
  title: { fontSize: 38, fontWeight: '700', color: '#1a1a1a', lineHeight: 46, letterSpacing: -1 },
  sub: { fontSize: 16, color: '#666', lineHeight: 24 },
  steps: { gap: 16 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f9f9f8', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepIconTxt: { fontSize: 20 },
  stepText: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  stepDesc: { fontSize: 13, color: '#888', marginTop: 2, lineHeight: 18 },
  note: { fontSize: 13, color: '#aaa', textAlign: 'center', lineHeight: 19, backgroundColor: '#f9f9f8', borderRadius: 12, padding: 14 },
  btn: { backgroundColor: '#D85A30', borderRadius: 18, padding: 17, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
