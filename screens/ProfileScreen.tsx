// screens/ProfileScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, Image, ActivityIndicator, Alert, Linking, Platform, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  initConnection, getSubscriptions, requestSubscription,
  finishTransaction, endConnection, purchaseUpdatedListener,
  purchaseErrorListener, type SubscriptionPurchase,
} from 'react-native-iap';
import { useTranslation } from 'react-i18next';
import { cacheProfile, getCachedProfile } from '../lib/offline';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { trackEvent } from '../lib/analytics';
import { captureError } from '../lib/sentry';
import { canPerformAction, getRemainingCooldown } from '../lib/rateLimit';

const PREMIUM_PRODUCT_ID = 'com.avant.dating.premium.monthly.v1';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

interface UserProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  gender: string;
  relationship_type: string;
  photos: string[];
  is_premium?: boolean;
  notifications_enabled?: boolean;
}

export default function ProfileScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const iapListenersRef = useRef<{ update?: any; error?: any }>({});

  useEffect(() => {
    fetchProfile();
    const unsubscribe = navigation.addListener('focus', fetchProfile);
    return () => {
      unsubscribe();
      // IAP listener cleanup
      iapListenersRef.current.update?.remove();
      iapListenersRef.current.error?.remove();
      try { endConnection(); } catch {}
    };
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
      if (data) {
        setProfile(data);
        cacheProfile(user.id, data);
        trackEvent('profile_view');
      }
    } catch (err) {
      captureError(err, { context: 'fetch_profile' });
      // Offline fallback
      const { data: sessionData2 } = await supabase.auth.getSession();
      const uid = sessionData2?.session?.user?.id;
      if (uid) {
        const cached = await getCachedProfile(uid);
        if (cached) setProfile(cached);
      }
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    // Rate limit: 5 yükleme / 5 dakika
    if (!canPerformAction('photo_upload', 5, 300000)) {
      const remaining = getRemainingCooldown('photo_upload', 5, 300000);
      Alert.alert(t('common.error'), t('moderation.rateLimited', { seconds: remaining }));
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.permissionNeeded'), t('common.galleryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) {
        Alert.alert(t('common.photoTooBig'), t('common.photoTooBigDesc'));
        return;
      }
      trackEvent('photo_upload', { screen: 'profile' });
      await uploadPhoto(asset.uri);
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
      Alert.alert(t('common.success'), t('profile.photoUploaded'));
    } catch (err: any) {
      captureError(err, { context: 'upload_photo' });
      Alert.alert(t('common.error'), err?.message || t('profile.photoUploadError'));
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
      const confirmed = window.confirm(t('profile.deleteConfirm'));
      if (confirmed) {
        trackEvent('account_delete');
        confirmDeleteAccount();
      }
    } else {
      Alert.alert(
        t('profile.deleteAccount'),
        t('profile.deleteConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: () => { trackEvent('account_delete'); confirmDeleteAccount(); } },
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
      captureError(err, { context: 'delete_account' });
      Alert.alert(t('common.error'), t('profile.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    trackEvent('premium_tap');
    try {
      await initConnection();

      const subscriptions = await getSubscriptions({ skus: [PREMIUM_PRODUCT_ID] });
      if (!subscriptions || subscriptions.length === 0) {
        Alert.alert(t('common.error'), t('profile.productNotFound'));
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
          trackEvent('premium_purchase');
          Alert.alert(t('common.success'), t('profile.premiumWelcome'));
        }
        setPurchasing(false);
        purchaseUpdate.remove();
        purchaseError.remove();
        try { await endConnection(); } catch {}
      });

      const purchaseError = purchaseErrorListener((error) => {
        if (error.code !== 'E_USER_CANCELLED') {
          Alert.alert(t('common.error'), t('profile.purchaseFailed'));
        }
        setPurchasing(false);
        purchaseUpdate.remove();
        purchaseError.remove();
        iapListenersRef.current = {};
        try { endConnection(); } catch {}
      });

      iapListenersRef.current = { update: purchaseUpdate, error: purchaseError };
      await requestSubscription({ sku: PREMIUM_PRODUCT_ID });
    } catch (err: any) {
      console.error('Purchase error:', err);
      captureError(err, { context: 'purchase' });
      if (Platform.OS === 'ios') {
        Alert.alert(
          t('profile.purchaseTitle'),
          t('profile.purchaseUnavailable'),
        );
      } else {
        Alert.alert(t('common.error'), err?.message || t('profile.purchaseStartError'));
      }
      setPurchasing(false);
      try { await endConnection(); } catch {}
    }
  };

  const relationshipLabel = (type: string) => {
    const map: Record<string, string> = {
      serious: t('profile.relationSerious'),
      casual: t('profile.relationCasual'),
      open: t('profile.relationOpen'),
      life_partner: t('onboarding.intentLifePartner'),
      long_term: t('onboarding.intentLongTerm'),
      long_open_short: t('onboarding.intentLongOpenShort'),
      short_open_long: t('onboarding.intentShortOpenLong'),
      short_term: t('onboarding.intentShortTerm'),
      figuring_out: t('onboarding.intentFiguringOut'),
    };
    return map[type] || type;
  };

  const toggleNotifications = async (value: boolean) => {
    if (!profile) return;
    setProfile({ ...profile, notifications_enabled: value });
    try {
      await supabase.from('users').update({ notifications_enabled: value }).eq('id', profile.id);
      trackEvent('notifications_toggle', { enabled: value });
    } catch (err) {
      captureError(err, { context: 'toggle_notifications' });
      // Revert on error
      setProfile({ ...profile, notifications_enabled: !value });
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
        <SafeAreaView style={s.safeArea}>
          <View style={s.loadingWrap}><ActivityIndicator color={colors.accentPink} size="large" /></View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!profile) {
    return (
      <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
        <SafeAreaView style={s.safeArea}>
          <View style={s.loadingWrap}>
            <Text style={{ color: colors.textSecondary }}>{t('profile.loadFailed')}</Text>
            <TouchableOpacity onPress={fetchProfile} style={{ marginTop: 16 }}>
              <Text style={{ color: colors.accentPink, fontWeight: '700' }}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={colors.bgGradient as any} style={s.bg}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={[s.back, { color: colors.textSecondary }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.textPrimary }]}>{t('profile.title')}</Text>
          <TouchableOpacity onPress={signOut} style={s.signOutBtn}>
            <Text style={[s.signOut, { color: colors.accentPink }]}>{t('profile.signOut')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.avatarSection}>
            <TouchableOpacity style={s.avatarWrap} onPress={pickImage} disabled={uploading}>
              <LinearGradient colors={colors.accentGradient as any} style={s.avatarRing}>
                {profile.photos?.[0] ? (
                  <Image source={{ uri: profile.photos[0] }} style={s.avatarImg} />
                ) : (
                  <View style={[s.avatarPlaceholder, { backgroundColor: colors.card }]}>
                    <Text style={[s.avatarInitial, { color: colors.accentPink }]}>{profile.name?.[0]?.toUpperCase() || 'M'}</Text>
                  </View>
                )}
              </LinearGradient>
              <View style={[s.avatarAddBtn, { backgroundColor: colors.userBubble, borderColor: colors.inputBg }]}>
                {uploading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.avatarAddIcon}>+</Text>
                }
              </View>
            </TouchableOpacity>
            <Text style={[s.avatarName, { color: colors.textPrimary }]}>{profile.name}</Text>
            <Text style={[s.avatarSub, { color: colors.textSecondary }]}>{profile.city} · {profile.age}</Text>
          </View>

          <View style={s.premiumCard}>
            <LinearGradient colors={colors.accentGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.premiumGrad}>
              <Text style={s.premiumIcon}>⚡</Text>
              <Text style={s.premiumTitle}>{t('profile.premiumTitle')}</Text>
              <Text style={s.premiumDesc}>{t('profile.premiumDesc')}</Text>
              {profile.is_premium ? (
                <View style={s.premiumBuyBtn}>
                  <Text style={[s.premiumBuyTxt, { color: '#10B981' }]}>{t('profile.premiumActive')}</Text>
                </View>
              ) : (
                <>
                  <Text style={s.premiumPrice}>{t('profile.premiumPrice')}</Text>
                  <Text style={s.premiumDuration}>{t('profile.premiumDuration')}</Text>
                  <TouchableOpacity
                    style={s.premiumBuyBtn}
                    onPress={handlePurchase}
                    disabled={purchasing}
                    activeOpacity={0.85}
                  >
                    {purchasing
                      ? <ActivityIndicator color="#C084FC" size="small" />
                      : <Text style={s.premiumBuyTxt}>{t('profile.premiumSubscribe')}</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
              <Text style={s.premiumLegal}>
                {t('profile.premiumLegal')}
              </Text>
              <View style={s.premiumLinks}>
                <Text style={s.premiumLink} onPress={() => Linking.openURL('https://melihagraz.github.io/avant-app')}>
                  {t('profile.privacyPolicy')}
                </Text>
                <Text style={s.premiumLinkSep}>·</Text>
                <Text style={s.premiumLink} onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
                  {t('profile.termsOfService')}
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
                    <LinearGradient colors={colors.accentGradientAlt as any} style={s.mainBadge}>
                      <Text style={s.mainBadgeTxt}>{t('profile.main')}</Text>
                    </LinearGradient>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={[s.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <Text style={[s.cardTitle, { color: colors.textSecondary }]}>{t('profile.profileInfo')}</Text>
            {[
              { label: t('profile.labelName'), value: profile.name },
              { label: t('profile.labelAge'), value: String(profile.age) },
              { label: t('profile.labelCity'), value: profile.city },
              { label: t('profile.labelSeeking'), value: relationshipLabel(profile.relationship_type || '') },
            ].map((row, i, arr) => (
              <View key={row.label} style={[s.row, { borderBottomColor: colors.separator }, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={[s.rowLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                <Text style={[s.rowValue, { color: colors.textPrimary }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          <View style={[s.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
            <Text style={[s.cardTitle, { color: colors.textSecondary }]}>{t('profile.notificationsTitle')}</Text>
            <View style={[s.notifRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[s.rowValue, { color: colors.textPrimary }]}>{t('profile.notificationsEnabled')}</Text>
                <Text style={[s.rowLabel, { color: colors.textSecondary, marginTop: 2 }]}>{t('profile.notificationsDesc')}</Text>
              </View>
              <Switch
                value={profile.notifications_enabled !== false}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.border, true: colors.accentPurple }}
                thumbColor={colors.white}
              />
            </View>
          </View>

          <View style={[s.agentCard, { backgroundColor: colors.card }]}>
            <View style={s.agentDotWrap}>
              <View style={s.agentDot} />
            </View>
            <View>
              <Text style={[s.agentTitle, { color: colors.textPrimary }]}>{t('profile.agentActive')}</Text>
              <Text style={[s.agentSub, { color: colors.textSecondary }]}>{t('profile.agentActiveSub')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.supportBtn, { backgroundColor: colors.card, shadowColor: colors.shadow }]}
            onPress={() => Linking.openURL('mailto:melihagraz@gmail.com?subject=Avant%20Destek%20Talebi')}
            activeOpacity={0.7}
          >
            <Text style={s.supportIcon}>💬</Text>
            <Text style={[s.supportTxt, { color: colors.userBubble }]}>{t('profile.support')}</Text>
          </TouchableOpacity>

          <View style={s.dangerZone}>
            <TouchableOpacity style={s.deleteAccountBtn} onPress={deleteAccount} disabled={deleting}>
              {deleting
                ? <ActivityIndicator color="#FF6B9D" size="small" />
                : <Text style={[s.deleteAccountTxt, { color: colors.accentPink }]}>{t('profile.deleteAccount')}</Text>
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
  notifRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
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
