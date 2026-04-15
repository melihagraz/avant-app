// screens/ProfileScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, Image, ActivityIndicator, Alert, Linking, Platform, Switch, Animated, Pressable,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
import { FONT_HEADING, FONT_BODY_SEMIBOLD } from '../lib/fonts';
import AgentCard from '../components/AgentCard';

const PREMIUM_PRODUCT_ID = 'com.avant.dating.premium.monthly.v1';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 300;

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
  job?: string;
  education?: string;
  religion?: string;
  personality?: string;
  tags?: string[];
  smoking?: string;
  dating_intention?: string;
  family_plans?: string;
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
  const premiumBtnScale = useRef(new Animated.Value(1)).current;

  const onPremiumPressIn = () => {
    Animated.spring(premiumBtnScale, { toValue: 0.94, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const onPremiumPressOut = () => {
    Animated.spring(premiumBtnScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

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

  // ---------- Profile strength calculation ----------
  const computeProfileStrength = (): number => {
    if (!profile) return 0;
    let filled = 0;
    const total = 8;
    if (profile.photos?.length) filled++;
    if (profile.name) filled++;
    if (profile.city) filled++;
    if (profile.job) filled++;
    if (profile.education) filled++;
    if (profile.personality) filled++;
    if (profile.relationship_type) filled++;
    if (profile.tags?.length) filled++;
    return Math.round((filled / total) * 100);
  };

  // ---------- Loading state ----------
  if (loading) {
    return (
      <View style={s.bg}>
        <SafeAreaView style={s.safeArea}>
          <View style={s.loadingWrap}>
            <ActivityIndicator color={colors.accentGold} size="large" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ---------- Error / no profile state ----------
  if (!profile) {
    return (
      <View style={s.bg}>
        <SafeAreaView style={s.safeArea}>
          <View style={s.loadingWrap}>
            <Text style={{ color: colors.textSecondary }}>{t('profile.loadFailed')}</Text>
            <TouchableOpacity onPress={fetchProfile} style={{ marginTop: 16 }}>
              <Text style={{ color: colors.accentGold, fontWeight: '700' }}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const profileStrength = computeProfileStrength();
  const circumference = 2 * Math.PI * 28; // r=28
  const strokeDashoffset = circumference - (circumference * profileStrength) / 100;

  const interests = profile.tags?.length ? profile.tags : (profile.job ? [profile.job] : []);

  const basicInfo: { label: string; value: string }[] = [
    { label: t('profile.labelAge'), value: String(profile.age) },
    { label: t('profile.labelCity'), value: profile.city },
    ...(profile.job ? [{ label: t('profile.labelJob') || 'Meslek', value: profile.job }] : []),
    ...(profile.education ? [{ label: t('profile.labelEducation') || 'Egitim', value: profile.education }] : []),
    ...(profile.relationship_type ? [{ label: t('profile.labelSeeking'), value: relationshipLabel(profile.relationship_type) }] : []),
    ...(profile.religion ? [{ label: t('profile.labelReligion') || 'Din', value: profile.religion }] : []),
  ];

  // ---------- RENDER ----------
  return (
    <View style={s.bg}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HERO SECTION ===== */}
        <View style={s.heroContainer}>
          <LinearGradient
            colors={['#3d2a4a', '#1a1228'] as any}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={s.heroGradient}
          />

          {/* Bottom fade overlay */}
          <LinearGradient
            colors={['transparent', '#0D0D14'] as any}
            style={s.heroFade}
          />

          {/* Edit button (top right) */}
          <SafeAreaView style={s.heroTopBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={s.editPill}
              onPress={pickImage}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color="#fff" />
              <Text style={s.editPillText}>Duzenle</Text>
            </TouchableOpacity>
          </SafeAreaView>

          {/* Profile photo */}
          <TouchableOpacity
            style={s.heroAvatarWrap}
            onPress={pickImage}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {profile.photos?.[0] ? (
              <Image source={{ uri: profile.photos[0] }} style={s.heroAvatar} />
            ) : (
              <View style={s.heroAvatarPlaceholder}>
                <Ionicons name="person" size={54} color="rgba(255,255,255,0.25)" />
              </View>
            )}
            {uploading && (
              <View style={s.heroAvatarUploading}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
          </TouchableOpacity>

          {/* Name + age */}
          <View style={s.heroNameWrap}>
            <Text style={s.heroName}>
              {profile.name}, {profile.age}
            </Text>
            {profile.is_premium && (
              <View style={s.premiumBadgeInline}>
                <Ionicons name="star" size={11} color="#fff" />
              </View>
            )}
          </View>

          {/* City + job subtitle */}
          {(profile.city || profile.job) && (
            <Text style={s.heroSubtitle}>
              {[profile.city, profile.job].filter(Boolean).join(' \u2022 ')}
            </Text>
          )}
        </View>

        {/* ===== CONTENT AREA ===== */}
        <View style={s.content}>

          {/* ===== AGENT CARD ===== */}
          <AgentCard />

          {/* ===== PROFILE STRENGTH CARD ===== */}
          <View style={s.strengthCard}>
            <View style={s.strengthLeft}>
              <Text style={s.strengthLabel}>PROFIL GUCU</Text>
              <Text style={s.strengthValue}>{profileStrength}%</Text>
            </View>
            <View style={s.strengthRight}>
              {/* SVG-like circular progress using nested Views */}
              <View style={s.ringOuter}>
                <View style={s.ringTrack} />
                {/* We simulate the arc with a conic approach using a bordered view */}
                <View style={[s.ringCenter]}>
                  <Text style={s.ringText}>{profileStrength}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ===== HAKKIMDA ===== */}
          {profile.personality ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>HAKKIMDA</Text>
              <Text style={s.bioText}>{profile.personality}</Text>
            </View>
          ) : null}

          {/* ===== ILGI ALANLARI ===== */}
          {interests.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>ILGI ALANLARI</Text>
              <View style={s.tagsWrap}>
                {interests.map((tag, i) => (
                  <View key={i} style={s.tag}>
                    <Text style={s.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ===== TEMEL BILGILER ===== */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>TEMEL BILGILER</Text>
            <View style={s.infoGrid}>
              {basicInfo.map((item, i) => (
                <View key={i} style={s.infoCell}>
                  <Text style={s.infoCellLabel}>{item.label}</Text>
                  <Text style={s.infoCellValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ===== PREMIUM CARD (non-premium users) ===== */}
          {!profile.is_premium && (
            <View style={s.premiumCard}>
              <LinearGradient
                colors={colors.goldGradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.premiumGrad}
              >
                <View style={s.premiumHeader}>
                  <Ionicons name="diamond-outline" size={28} color="#fff" />
                  <Text style={s.premiumTitle}>{t('profile.premiumTitle')}</Text>
                </View>
                <Text style={s.premiumDesc}>{t('profile.premiumDesc')}</Text>

                <Animated.View style={{ transform: [{ scale: premiumBtnScale }], width: '100%', marginTop: 16 }}>
                  <Pressable
                    style={s.premiumBtn}
                    onPress={handlePurchase}
                    onPressIn={onPremiumPressIn}
                    onPressOut={onPremiumPressOut}
                    disabled={purchasing}
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#E8B86D" size="small" />
                    ) : (
                      <Text style={s.premiumBtnText}>{t('profile.premiumSubscribe')}</Text>
                    )}
                  </Pressable>
                </Animated.View>

                <Text style={s.premiumPrice}>{t('profile.premiumPrice')}</Text>
                <Text style={s.premiumLegal} numberOfLines={3}>
                  {t('profile.premiumLegal')}
                </Text>
                <View style={s.premiumLinks}>
                  <Text style={s.premiumLink} onPress={() => Linking.openURL('https://melihagraz.github.io/avant-app')}>
                    {t('profile.privacyPolicy')}
                  </Text>
                  <Text style={s.premiumLinkSep}>{'\u00B7'}</Text>
                  <Text style={s.premiumLink} onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
                    {t('profile.termsOfService')}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* ===== SETTINGS GROUP ===== */}
          <View style={s.settingsGroup}>
            {/* Notifications toggle */}
            <View style={s.settingsRow}>
              <View style={s.settingsRowLeft}>
                <View style={[s.settingsIcon, { backgroundColor: 'rgba(160,100,255,0.12)' }]}>
                  <Ionicons name="notifications-outline" size={18} color={colors.accentPurple} />
                </View>
                <Text style={s.settingsRowText}>{t('profile.notificationsEnabled')}</Text>
              </View>
              <Switch
                value={profile.notifications_enabled !== false}
                onValueChange={toggleNotifications}
                trackColor={{ false: colors.border, true: colors.accentPurple }}
                thumbColor={colors.white}
              />
            </View>

            <View style={s.settingsSep} />

            {/* Support */}
            <TouchableOpacity
              style={s.settingsRow}
              onPress={() => Linking.openURL('mailto:melihagraz@gmail.com?subject=Avant%20Destek%20Talebi')}
              activeOpacity={0.6}
            >
              <View style={s.settingsRowLeft}>
                <View style={[s.settingsIcon, { backgroundColor: 'rgba(232,184,109,0.12)' }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.accentGold} />
                </View>
                <Text style={s.settingsRowText}>{t('profile.support')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
            </TouchableOpacity>

            <View style={s.settingsSep} />

            {/* Sign out */}
            <TouchableOpacity
              style={s.settingsRow}
              onPress={signOut}
              activeOpacity={0.6}
            >
              <View style={s.settingsRowLeft}>
                <View style={[s.settingsIcon, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                  <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
                </View>
                <Text style={s.settingsRowText}>{t('profile.signOut')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
            </TouchableOpacity>

            <View style={s.settingsSep} />

            {/* Delete account */}
            <TouchableOpacity
              style={s.settingsRow}
              onPress={deleteAccount}
              disabled={deleting}
              activeOpacity={0.6}
            >
              <View style={s.settingsRowLeft}>
                <View style={[s.settingsIcon, { backgroundColor: 'rgba(255,68,68,0.1)' }]}>
                  {deleting ? (
                    <ActivityIndicator color="#ff4444" size="small" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#ff4444" />
                  )}
                </View>
                <Text style={[s.settingsRowText, { color: '#ff4444' }]}>{t('profile.deleteAccount')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // ---------- Base ----------
  bg: {
    flex: 1,
    backgroundColor: '#0D0D14',
  },
  safeArea: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---------- Hero ----------
  heroContainer: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  heroTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    // backdrop-blur simulated with bg opacity
  },
  editPillText: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 13,
    color: '#fff',
    letterSpacing: 0.2,
  },
  heroAvatarWrap: {
    position: 'relative',
    marginBottom: 14,
    zIndex: 5,
  },
  heroAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroAvatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroAvatarUploading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 55,
  },
  heroNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  heroName: {
    fontFamily: FONT_HEADING,
    fontSize: 30,
    color: '#fff',
    letterSpacing: -0.3,
  },
  premiumBadgeInline: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E8B86D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSubtitle: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
    zIndex: 5,
  },

  // ---------- Content area ----------
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },

  // ---------- Profile Strength Card ----------
  strengthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(232,184,109,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(232,184,109,0.2)',
    borderRadius: 18,
    padding: 20,
  },
  strengthLeft: {
    flex: 1,
  },
  strengthLabel: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 11,
    color: 'rgba(232,184,109,0.7)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  strengthValue: {
    fontFamily: FONT_HEADING,
    fontSize: 32,
    color: '#E8B86D',
    letterSpacing: -0.5,
  },
  strengthRight: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 4,
    borderColor: 'rgba(232,184,109,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringTrack: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 16,
    color: '#E8B86D',
  },

  // ---------- Section ----------
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  bioText: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
  },

  // ---------- Tags ----------
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagText: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },

  // ---------- Info Grid ----------
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoCell: {
    width: (SCREEN_WIDTH - 40 - 10) / 2, // 2 columns with gap
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  infoCellLabel: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  infoCellValue: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 14,
    color: '#fff',
  },

  // ---------- Premium Card ----------
  premiumCard: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#E8B86D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  premiumGrad: {
    padding: 24,
    borderRadius: 22,
    alignItems: 'center',
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  premiumTitle: {
    fontFamily: FONT_HEADING,
    fontSize: 22,
    color: '#fff',
    letterSpacing: -0.3,
  },
  premiumDesc: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  premiumBtn: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBtnText: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 15,
    color: '#B8860B',
    letterSpacing: 0.3,
  },
  premiumPrice: {
    fontFamily: FONT_HEADING,
    fontSize: 26,
    color: '#fff',
    marginTop: 12,
    letterSpacing: -0.5,
  },
  premiumLegal: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  premiumLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  premiumLink: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  premiumLinkSep: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },

  // ---------- Settings Group ----------
  settingsGroup: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowText: {
    fontFamily: FONT_BODY_SEMIBOLD,
    fontSize: 14,
    color: '#fff',
  },
  settingsSep: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
  },
});
