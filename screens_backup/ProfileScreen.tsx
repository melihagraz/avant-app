// screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, Image, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  gender: string;
  relationship_type: string;
  photos: string[];
}

export default function ProfileScreen({ navigation }: any) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProfile();
    const unsubscribe = navigation.addListener('focus', fetchProfile);
    return unsubscribe;
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('users').select('*').eq('id', user.id).single();
      if (error) console.error('Profile fetch error:', error);
      if (data) setProfile(data);
    } catch (err) {
      console.error('fetchProfile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Fotoğraf seçmek için galeri iznine ihtiyaç var.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setUploading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;

      const fileName = `${user.id}/${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('file', { uri, name: fileName, type: 'image/jpeg' } as any);

      const { error: uploadError } = await supabase.storage
        .from('avatars').upload(fileName, formData, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const currentPhotos = profile?.photos || [];
      const newPhotos = [publicUrl, ...currentPhotos].slice(0, 6);

      await supabase.from('users').update({ photos: newPhotos }).eq('id', user.id);
      setProfile(prev => prev ? { ...prev, photos: newPhotos } : null);
      Alert.alert('Başarılı', 'Fotoğrafın yüklendi!');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Fotoğraf yüklenirken sorun oluştu.');
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoUrl: string) => {
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;
      const newPhotos = profile?.photos?.filter(p => p !== photoUrl) || [];
      await supabase.from('users').update({ photos: newPhotos }).eq('id', user.id);
      setProfile(prev => prev ? { ...prev, photos: newPhotos } : null);
    } catch (err) {
      console.error('Delete photo error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigation.replace('Auth');
  };

  const deleteAccount = () => {
    if (typeof window !== 'undefined' && window.confirm) {
      // Web
      const confirmed = window.confirm('Tüm verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz.');
      if (confirmed) confirmDeleteAccount();
    } else {
      // Native (iOS/Android)
      Alert.alert(
        'Hesabı Sil',
        'Tüm verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Sil', style: 'destructive', onPress: confirmDeleteAccount },
        ]
      );
    }
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;

      const { error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: user.id },
      });

      if (error) throw error;

      await supabase.auth.signOut();
      navigation.replace('Auth');
    } catch (err: any) {
      console.error('Delete account error:', err);
      Alert.alert('Hata', 'Hesap silinirken sorun oluştu. Tekrar dene.');
    } finally {
      setDeleting(false);
    }
  };

  const relationshipLabel = (type: string) => {
    const map: Record<string, string> = {
      serious: 'Ciddi ilişki', casual: 'Rahat arkadaşlık', open: 'Göreceğiz',
    };
    return map[type] || type;
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingWrap}><ActivityIndicator color="#D85A30" size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingWrap}>
          <Text style={{ color: '#888' }}>Profil yüklenemedi</Text>
          <TouchableOpacity onPress={fetchProfile} style={{ marginTop: 16 }}>
            <Text style={{ color: '#D85A30' }}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Profilim</Text>
        <TouchableOpacity onPress={signOut} style={s.signOutBtn}>
          <Text style={s.signOut}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Daire avatar */}
        <View style={s.avatarSection}>
          <TouchableOpacity style={s.avatarWrap} onPress={pickImage} disabled={uploading}>
            {profile.photos?.[0] ? (
              <Image source={{ uri: profile.photos[0] }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitial}>{profile.name?.[0]?.toUpperCase() || 'M'}</Text>
              </View>
            )}
            <View style={s.avatarAddBtn}>
              {uploading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.avatarAddIcon}>+</Text>
              }
            </View>
          </TouchableOpacity>
          <Text style={s.avatarName}>{profile.name}</Text>
          <Text style={s.avatarSub}>{profile.city} · {profile.age}</Text>
        </View>

        {/* Premium butonu */}
        <TouchableOpacity
          style={s.premiumBtn}
          onPress={() => Alert.alert('Yakında!', 'Premium özellikler çok yakında geliyor.')}
        >
          <View style={s.premiumBtnLeft}>
            <Text style={s.premiumBtnIcon}>⚡</Text>
            <View>
              <Text style={s.premiumBtnTitle}>Premium'a geç</Text>
              <Text style={s.premiumBtnSub}>Sınırsız eşleşme · $9.99/ay</Text>
            </View>
          </View>
          <Text style={s.premiumBtnArrow}>›</Text>
        </TouchableOpacity>

        {/* Fotoğraf grid */}
        {(profile.photos?.length || 0) > 0 && (
          <View style={s.photoGrid}>
            {profile.photos?.map((photo, i) => (
              <View key={i} style={s.photoThumb}>
                <Image source={{ uri: photo }} style={s.thumbImg} />
                <TouchableOpacity style={s.deleteBtn} onPress={() => deletePhoto(photo)} disabled={deleting}>
                  {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.deleteBtnTxt}>×</Text>}
                </TouchableOpacity>
                {i === 0 && <View style={s.mainBadge}><Text style={s.mainBadgeTxt}>Ana</Text></View>}
              </View>
            ))}
          </View>
        )}

        {/* Profil bilgileri */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Profil bilgileri</Text>
          {[
            { label: 'Ad', value: profile.name },
            { label: 'Yaş', value: String(profile.age) },
            { label: 'Şehir', value: profile.city },
            { label: 'Arıyor', value: relationshipLabel(profile.relationship_type || '') },
          ].map(row => (
            <View key={row.label} style={s.row}>
              <Text style={s.rowLabel}>{row.label}</Text>
              <Text style={s.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Agent */}
        <View style={s.agentCard}>
          <Text style={s.agentTitle}>Agentın aktif</Text>
          <Text style={s.agentSub}>Seni uygun kişilerle eşleştiriyor</Text>
        </View>

        {/* Hesabı sil */}
        <View style={s.dangerZone}>
          <TouchableOpacity style={s.deleteAccountBtn} onPress={deleteAccount} disabled={deleting}>
            {deleting
              ? <ActivityIndicator color="#E24B4A" size="small" />
              : <Text style={s.deleteAccountTxt}>Hesabı sil</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5' },
  backBtn: { padding: 12 },
  back: { fontSize: 28, color: '#555' },
  title: { fontSize: 16, fontWeight: '500', color: '#1a1a1a' },
  signOutBtn: { padding: 12 },
  signOut: { fontSize: 14, color: '#E24B4A' },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 110, height: 110, borderRadius: 55 },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#FAECE7', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 44, fontWeight: '500', color: '#D85A30' },
  avatarAddBtn: { position: 'absolute', bottom: 2, right: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: '#D85A30', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#fff' },
  avatarAddIcon: { color: '#fff', fontSize: 20, fontWeight: '300', lineHeight: 24 },
  avatarName: { fontSize: 22, fontWeight: '600', color: '#1a1a1a', marginTop: 4 },
  avatarSub: { fontSize: 14, color: '#888' },
  premiumBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16 },
  premiumBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  premiumBtnIcon: { fontSize: 22 },
  premiumBtnTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  premiumBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  premiumBtnArrow: { fontSize: 22, color: 'rgba(255,255,255,0.5)' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: '30%', aspectRatio: 0.75, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  deleteBtn: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnTxt: { color: '#fff', fontSize: 15, lineHeight: 20 },
  mainBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#D85A30', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  mainBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '500' },
  card: { backgroundColor: '#f9f9f8', borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '500', color: '#1a1a1a', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  rowLabel: { fontSize: 14, color: '#888' },
  rowValue: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  agentCard: { backgroundColor: '#FAECE7', borderRadius: 16, padding: 16, alignItems: 'center', gap: 4 },
  agentTitle: { fontSize: 15, fontWeight: '500', color: '#712B13' },
  agentSub: { fontSize: 13, color: '#993C1D' },
  dangerZone: { alignItems: 'center', paddingTop: 8 },
  deleteAccountBtn: { paddingVertical: 14, paddingHorizontal: 28 },
  deleteAccountTxt: { fontSize: 14, color: '#E24B4A' },
});
