// screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, Image, ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  initConnection, getSubscriptions, requestSubscription,
  finishTransaction, endConnection, purchaseUpdatedListener,
  purchaseErrorListener, type SubscriptionPurchase,
} from 'react-native-iap';
import { supabase } from '../lib/supabase';

const PREMIUM_PRODUCT_ID = 'com.avant.dating.premium.monthly.v1';

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
  const [purchasing, setPurchasing] = useState(false);

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
      const confirmed = window.confirm('Tüm verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz.');
      if (confirmed) confirmDeleteAccount();
    } else {
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

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      await initConnection();

      const subscriptions = await getSubscriptions({ skus: [PREMIUM_PRODUCT_ID] });
      if (!subscriptions || subscriptions.length === 0) {
        Alert.alert('Hata', 'Ürün bulunamadı. Lütfen daha sonra tekrar dene.');
        setPurchasing(false);
        await endConnection();
        return;
      }

      const purchaseUpdate = purchaseUpdatedListener(async (purchase: SubscriptionPurchase) => {
        if (purchase.transactionReceipt) {
          await finishTransaction({ purchase, isConsumable: false });
          // Update premium status in Supabase
          const { data: sessionData } = await supabase.auth.getSession();
          const user = sessionData?.session?.user;
          if (user) {
            await supabase.from('users').update({ is_premium: true }).eq('id', user.id);
            setProfile(prev => prev ? { ...prev, is_premium: true } as any : null);
          }
          Alert.alert('Başarılı! 🎉', 'Premium hesabına hoş geldin!');
        }
        setPurchasing(false);
        purchaseUpdate.remove();
        purchaseError.remove();
        try { await endConnection(); } catch {}
      });

      const purchaseError = purchaseErrorListener((error) => {
        if (error.code !== 'E_USER_CANCELLED') {
          Alert.alert('Hata', 'Satın alma işlemi başarısız oldu.');
        }
        setPurchasing(false);
        purchaseUpdate.remove();
        purchaseError.remove();
        try { endConnection(); } catch {}
      });

      await requestSubscription({ sku: PREMIUM_PRODUCT_ID });
    } catch (err: any) {
      console.error('Purchase error:', err);
      if (Platform.OS === 'ios') {
        Alert.alert(
          'Satın Alma',
          'Abonelik şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
        );
      } else {
        Alert.alert('Hata', err?.message || 'Satın alma başlatılamadı.');
      }
      setPurchasing(false);
      try { await endConnection(); } catch {}
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
      <LinearGradient colors={['#FFF8FA', '#F8F5FF', '#F5FAFF']} style={s.bg}>
        <SafeAreaView style={s.safeArea}>
          <View style={s.loadingWrap}><ActivityIndicator color="#FF6B9D" size="large" /></View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!profile) {
    return (
      <LinearGradient colors={['#FFF8FA', '#F8F5FF', '#F5FAFF']} style={s.bg}>
        <SafeAreaView style={s.safeArea}>
          <View style={s.loadingWrap}>
            <Text style={{ color: '#9B8AB8' }}>Profil yüklenemedi</Text>
            <TouchableOpacity onPress={fetchProfile} style={{ marginTop: 16 }}>
              <Text style={{ color: '#FF6B9D', fontWeight: '700' }}>Tekrar dene</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FFF8FA', '#F8F5FF', '#F5FAFF']} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.back}>‹</Text>
          </TouchableOpacity>
          <Text style={s.title}>Profilim ✨</Text>
          <TouchableOpacity onPress={signOut} style={s.signOutBtn}>
            <Text style={s.signOut}>Çıkış</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.avatarSection}>
            <TouchableOpacity style={s.avatarWrap} onPress={pickImage} disabled={uploading}>
              <LinearGradient colors={['#FF6B9D', '#C084FC', '#818CF8']} style={s.avatarRing}>
                {profile.photos?.[0] ? (
                  <Image source={{ uri: profile.photos[0] }} style={s.avatarImg} />
                ) : (
                  <View style={s.avatarPlaceholder}>
                    <Text style={s.avatarInitial}>{profile.name?.[0]?.toUpperCase() || 'M'}</Text>
                  </View>
                )}
              </LinearGradient>
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

          <View style={s.premiumCard}>
            <LinearGradient colors={['#FF6B9D', '#C084FC', '#818CF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.premiumGrad}>
              <Text style={s.premiumIcon}>⚡</Text>
              <Text style={s.premiumTitle}>Avant Premium</Text>
              <Text style={s.premiumDesc}>Sınırsız eşleşme ve öncelikli agent</Text>
              <Text style={s.premiumPrice}>$9.99 / ay</Text>
              <Text style={s.premiumDuration}>Aylık otomatik yenilenen abonelik</Text>
              <TouchableOpacity
                style={s.premiumBuyBtn}
                onPress={handlePurchase}
                disabled={purchasing}
                activeOpacity={0.85}
              >
                {purchasing
                  ? <ActivityIndicator color="#C084FC" size="small" />
                  : <Text style={s.premiumBuyTxt}>Abone Ol</Text>
                }
              </TouchableOpacity>
              <Text style={s.premiumLegal}>
                Ödeme Apple ID hesabınızdan alınır. Abonelik, mevcut dönem bitmeden en az 24 saat önce iptal edilmediği sürece otomatik olarak yenilenir.
              </Text>
              <View style={s.premiumLinks}>
                <Text style={s.premiumLink} onPress={() => Linking.openURL('https://melihagraz.github.io/avant-app')}>
                  Gizlilik Politikası
                </Text>
                <Text style={s.premiumLinkSep}>·</Text>
                <Text style={s.premiumLink} onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
                  Kullanım Koşulları
                </Text>
              </View>
            </LinearGradient>
          </View>

          {(profile.photos?.length || 0) > 0 && (
            <View style={s.photoGrid}>
              {profile.photos?.map((photo, i) => (
                <View key={i} style={s.photoThumb}>
                  <Image source={{ uri: photo }} style={s.thumbImg} />
                  <TouchableOpacity style={s.deleteBtn} onPress={() => deletePhoto(photo)} disabled={deleting}>
                    {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.deleteBtnTxt}>×</Text>}
                  </TouchableOpacity>
                  {i === 0 && (
                    <LinearGradient colors={['#FF6B9D', '#C084FC']} style={s.mainBadge}>
                      <Text style={s.mainBadgeTxt}>Ana</Text>
                    </LinearGradient>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={s.card}>
            <Text style={s.cardTitle}>Profil bilgileri</Text>
            {[
              { label: 'Ad', value: profile.name },
              { label: 'Yaş', value: String(profile.age) },
              { label: 'Şehir', value: profile.city },
              { label: 'Arıyor', value: relationshipLabel(profile.relationship_type || '') },
            ].map((row, i, arr) => (
              <View key={row.label} style={[s.row, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={s.rowLabel}>{row.label}</Text>
                <Text style={s.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <View style={s.agentCard}>
            <View style={s.agentDotWrap}>
              <View style={s.agentDot} />
            </View>
            <View>
              <Text style={s.agentTitle}>Agentın aktif 🤖</Text>
              <Text style={s.agentSub}>Seni uygun kişilerle eşleştiriyor</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.supportBtn}
            onPress={() => Linking.openURL('mailto:melihagraz@gmail.com?subject=Avant%20Destek%20Talebi')}
            activeOpacity={0.7}
          >
            <Text style={s.supportIcon}>💬</Text>
            <Text style={s.supportTxt}>Destek & Yardım</Text>
          </TouchableOpacity>

          <View style={s.dangerZone}>
            <TouchableOpacity style={s.deleteAccountBtn} onPress={deleteAccount} disabled={deleting}>
              {deleting
                ? <ActivityIndicator color="#FF6B9D" size="small" />
                : <Text style={s.deleteAccountTxt}>Hesabı sil</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 10 },
  backBtn: { padding: 12 },
  back: { fontSize: 30, color: '#9B8AB8', fontWeight: '300' },
  title: { fontSize: 20, fontWeight: '800', color: '#2D1B4E' },
  signOutBtn: { padding: 12 },
  signOut: { fontSize: 14, color: '#FF6B9D', fontWeight: '700' },
  scroll: { padding: 18, gap: 18, paddingBottom: 48 },
  avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatarWrap: { position: 'relative' },
  avatarRing: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center', padding: 4 },
  avatarImg: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 48, fontWeight: '800', color: '#FF6B9D' },
  avatarAddBtn: { position: 'absolute', bottom: 2, right: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#F8F5FF' },
  avatarAddIcon: { color: '#fff', fontSize: 22, fontWeight: '400', lineHeight: 24 },
  avatarName: { fontSize: 28, fontWeight: '800', color: '#2D1B4E', marginTop: 4 },
  avatarSub: { fontSize: 15, color: '#9B8AB8', fontWeight: '600' },
  premiumCard: { borderRadius: 22, overflow: 'hidden' },
  premiumGrad: { alignItems: 'center', padding: 24, borderRadius: 22 },
  premiumIcon: { fontSize: 36, marginBottom: 8 },
  premiumTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  premiumDesc: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginBottom: 12 },
  premiumPrice: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 2 },
  premiumDuration: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 16 },
  premiumBuyBtn: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 48, marginBottom: 14 },
  premiumBuyTxt: { fontSize: 16, fontWeight: '800', color: '#C084FC' },
  premiumLegal: { fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 16, marginBottom: 10, paddingHorizontal: 8 },
  premiumLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumLink: { fontSize: 12, color: '#fff', fontWeight: '700', textDecorationLine: 'underline' },
  premiumLinkSep: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: { width: '30%', aspectRatio: 0.75, borderRadius: 18, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  deleteBtn: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnTxt: { color: '#fff', fontSize: 16, lineHeight: 20 },
  mainBadge: { position: 'absolute', bottom: 6, left: 6, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  mainBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 18, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#9B8AB8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F0FA' },
  rowLabel: { fontSize: 15, color: '#9B8AB8', fontWeight: '600' },
  rowValue: { fontSize: 15, color: '#2D1B4E', fontWeight: '700' },
  agentCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 22, padding: 18, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  agentDotWrap: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  agentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  agentTitle: { fontSize: 16, fontWeight: '800', color: '#2D1B4E' },
  agentSub: { fontSize: 13, color: '#9B8AB8', marginTop: 2, fontWeight: '500' },
  supportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 22, padding: 16, shadowColor: '#C084FC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  supportIcon: { fontSize: 18 },
  supportTxt: { fontSize: 15, color: '#7C3AED', fontWeight: '700' },
  dangerZone: { alignItems: 'center', paddingTop: 8 },
  deleteAccountBtn: { paddingVertical: 16, paddingHorizontal: 28 },
  deleteAccountTxt: { fontSize: 14, color: '#FF6B9D', fontWeight: '600' },
});
