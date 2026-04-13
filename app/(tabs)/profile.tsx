import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Ellipse, Path, Circle as SvgCircle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Typography } from '../../src/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useProfileStore } from '../../src/stores/profileStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile: authProfile, signOut } = useAuthStore();
  const { profile, fetchProfile, getProfileStrength } = useProfileStore();

  useEffect(() => {
    if (user?.id) fetchProfile(user.id);
  }, [user?.id]);

  const p = profile || authProfile;
  const strength = getProfileStrength();

  const handleLogout = () => {
    Alert.alert('Cikis Yap', 'Hesabindan cikmak istediginize emin misiniz?', [
      { text: 'Iptal', style: 'cancel' },
      { text: 'Cikis Yap', style: 'destructive', onPress: async () => {
        await signOut();
        router.replace('/');
      }},
    ]);
  };

  const infoItems = [
    { label: 'Egitim', value: p?.education || '-' },
    { label: 'Niyet', value: p?.dating_intention || '-' },
    { label: 'Sehir', value: p?.city || '-' },
    { label: 'Yas', value: p?.age ? String(p.age) : '-' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroContainer}>
          {p?.photos?.[0] ? (
            <Image source={{ uri: p.photos[0] }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#3d2a4a', '#1a1228']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.hero}>
              <Svg style={styles.heroSvg} viewBox="0 0 340 300" fill="none">
                <Ellipse cx={170} cy={110} rx={85} ry={95} fill="rgba(200,160,230,0.22)" />
                <Path d="M20 300C20 210 320 210 320 300" fill="rgba(200,160,230,0.18)" />
              </Svg>
            </LinearGradient>
          )}

          <LinearGradient colors={['transparent', Colors.surface]} start={{ x: 0.5, y: 0.45 }} end={{ x: 0.5, y: 1 }} style={styles.heroOverlay} />

          <Pressable style={styles.editBtn}>
            <Text style={styles.editBtnText}>Duzenle</Text>
          </Pressable>

          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{p?.name || 'Profil'}{p?.age ? `, ${p.age}` : ''}</Text>
            <Text style={styles.heroSub}>{p?.city || ''}{p?.job ? ` - ${p.job}` : ''}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Strength */}
          <View style={styles.strengthCard}>
            <View>
              <Text style={styles.strengthLabel}>PROFIL GUCU</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.strengthVal}>%{strength} </Text>
                <Text style={styles.strengthSub}>{strength >= 70 ? 'Guclu' : strength >= 40 ? 'Orta' : 'Zayif'}</Text>
              </View>
            </View>
            <Svg width={50} height={50} viewBox="0 0 50 50">
              <SvgCircle cx={25} cy={25} r={20} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
              <SvgCircle cx={25} cy={25} r={20} fill="none" stroke={Colors.gold} strokeWidth={4} strokeDasharray={`${strength * 1.26} 126`} strokeDashoffset={31.5} strokeLinecap="round" rotation={-90} origin="25,25" />
            </Svg>
          </View>

          {/* Bio */}
          {p?.prompts && p.prompts.length > 0 && (
            <>
              <Text style={styles.secTitle}>Hakkimda</Text>
              {p.prompts.map((prompt, i) => (
                <Text key={i} style={styles.bioText}>{prompt.answer}</Text>
              ))}
            </>
          )}

          {/* Info Grid */}
          <Text style={styles.secTitle}>Temel Bilgiler</Text>
          <View style={styles.infoGrid}>
            {infoItems.map((item) => (
              <View key={item.label} style={styles.infoCell}>
                <Text style={styles.infoCellLabel}>{item.label}</Text>
                <Text style={styles.infoCellVal}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Logout */}
          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Cikis Yap</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scroll: { flex: 1 },
  heroContainer: { height: 300, position: 'relative' },
  hero: { flex: 1 },
  heroImage: { width: '100%', height: '100%' },
  heroSvg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.35 },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  editBtn: { position: 'absolute', top: 52, right: 16, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: Colors.white15, borderRadius: 99, paddingVertical: 5, paddingHorizontal: 14, zIndex: 2 },
  editBtnText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.white80 },
  heroInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, zIndex: 1 },
  heroName: { fontFamily: Fonts.heading, fontSize: 30, color: Colors.white },
  heroSub: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  body: { padding: 20, paddingBottom: 90 },
  strengthCard: { backgroundColor: 'rgba(232,184,109,0.07)', borderWidth: 1, borderColor: 'rgba(232,184,109,0.15)', borderRadius: 14, padding: 14, paddingHorizontal: 18, marginBottom: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  strengthLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: Colors.goldMuted, letterSpacing: 0.6, marginBottom: 4 },
  strengthVal: { fontSize: 24, fontWeight: '600', color: Colors.gold },
  strengthSub: { fontSize: 13, color: Colors.white35, fontWeight: '400' },
  secTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: Colors.white30, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  bioText: { fontFamily: Fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.68)', lineHeight: 23, marginBottom: 20 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoCell: { backgroundColor: Colors.white04, borderRadius: 12, padding: 11, paddingHorizontal: 14, width: '48%' },
  infoCellLabel: { fontFamily: Fonts.body, fontSize: 11, color: Colors.white30, marginBottom: 3 },
  infoCellVal: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.white80 },
  logoutBtn: { marginTop: 32, borderWidth: 1, borderColor: 'rgba(255,100,100,0.3)', borderRadius: 14, height: 48, alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: '#ff6b6b' },
});
