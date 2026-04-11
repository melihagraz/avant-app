// screens/AuthScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const codeRef = useRef<TextInput>(null);

  const sendOTP = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Geçerli bir email gir');
      return;
    }
    setLoading(true);
    setError('');

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });

    setLoading(false);
    if (err) {
      setError('Bir hata oluştu, tekrar dene');
    } else {
      setSent(true);
      setTimeout(() => codeRef.current?.focus(), 300);
    }
  };

  const verifyOTP = async () => {
    if (code.length !== 8) {
      setError('8 haneli kodu gir');
      return;
    }
    setVerifying(true);
    setError('');

    const { data, error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'email',
    });

    setVerifying(false);

    if (err || !data.session) {
      setError('Kod hatalı veya süresi dolmuş');
      return;
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', data.session.user.id)
      .single();

    navigation.replace(agent ? 'Home' : 'Onboarding');
  };

  if (sent) {
    return (
      <SafeAreaView style={s.container}>
        <KeyboardAvoidingView
          style={s.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.top}>
            <Text style={s.logo}>av<Text style={s.accent}>a</Text>nt</Text>
          </View>

          <View style={s.form}>
            <Text style={s.sentTitle}>Kodu gir</Text>
            <Text style={s.sentSub}>
              <Text style={s.bold}>{email}</Text> adresine 8 haneli doğrulama kodu gönderdik.
            </Text>

            <TextInput
              ref={codeRef}
              style={[s.codeInput, error ? s.inputErr : null]}
              value={code}
              onChangeText={v => { setCode(v.replace(/\D/g, '')); setError(''); }}
              placeholder="00000000"
              placeholderTextColor="#ccc"
              keyboardType="number-pad"
              maxLength={8}
              textAlign="center"
            />
            {error ? <Text style={s.errTxt}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.btn, (code.length !== 8 || verifying) && s.btnOff]}
              onPress={verifyOTP}
              disabled={code.length !== 8 || verifying}
            >
              {verifying
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.btnTxt}>Giriş yap →</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.retryBtn} onPress={() => { setSent(false); setCode(''); setError(''); }}>
              <Text style={s.retryTxt}>Farklı email dene</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.retryBtn} onPress={sendOTP}>
              <Text style={s.retryTxt}>Kodu tekrar gönder</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.top}>
          <Text style={s.logo}>av<Text style={s.accent}>a</Text>nt</Text>
          <Text style={s.tagline}>agentin önce buluşur</Text>
        </View>

        <View style={s.form}>
          <Text style={s.label}>Email adresin</Text>
          <TextInput
            style={[s.input, error ? s.inputErr : null]}
            value={email}
            onChangeText={v => { setEmail(v); setError(''); }}
            placeholder="ornek@email.com"
            placeholderTextColor="#bbb"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={sendOTP}
          />
          {error ? <Text style={s.errTxt}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.btn, (!email.trim() || loading) && s.btnOff]}
            onPress={sendOTP}
            disabled={!email.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnTxt}>Kod gönder</Text>
            }
          </TouchableOpacity>

          <Text style={s.hint}>
            Emailine 8 haneli doğrulama kodu göndereceğiz.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  kav: { flex: 1, justifyContent: 'center', padding: 28 },
  top: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 40, fontWeight: '500', color: '#1a1a1a', letterSpacing: -1 },
  accent: { color: '#D85A30' },
  tagline: { fontSize: 14, color: '#aaa', marginTop: 6 },
  form: { gap: 12 },
  label: { fontSize: 14, color: '#555' },
  sentTitle: { fontSize: 22, fontWeight: '500', color: '#1a1a1a' },
  sentSub: { fontSize: 15, color: '#666', lineHeight: 22 },
  bold: { fontWeight: '500', color: '#1a1a1a' },
  input: {
    backgroundColor: '#f5f5f4', borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 16, color: '#1a1a1a',
    borderWidth: 0.5, borderColor: '#e5e5e5',
  },
  codeInput: {
    backgroundColor: '#f5f5f4', borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 18, fontSize: 32, color: '#1a1a1a',
    borderWidth: 0.5, borderColor: '#e5e5e5',
    letterSpacing: 12,
  },
  inputErr: { borderColor: '#E24B4A' },
  errTxt: { fontSize: 12, color: '#E24B4A', textAlign: 'center' },
  btn: {
    backgroundColor: '#D85A30', borderRadius: 14, padding: 15,
    alignItems: 'center', marginTop: 4,
  },
  btnOff: { backgroundColor: '#f0c4b3' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '500' },
  hint: { fontSize: 12, color: '#bbb', textAlign: 'center', lineHeight: 18 },
  retryBtn: { alignItems: 'center', padding: 8 },
  retryTxt: { fontSize: 14, color: '#aaa' },
});
