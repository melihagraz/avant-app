import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors, Fonts, Typography } from '../../src/theme';

const COMPAT_BARS = [
  { label: 'Degerler', value: 92 },
  { label: 'Ilgi alani', value: 85 },
  { label: 'Yasam tarzi', value: 78 },
  { label: 'Iletisim', value: 90 },
];

const AGENT_MSGS = [
  { side: 'a' as const, header: "SENIN AGENT'IN", text: 'Merhaba! Zeynep haftasonu acik hava etkinliklerini ve fotografciligi seviyor musun?' },
  { side: 'b' as const, header: "ZEYNEP'IN AGENT'I", text: 'Kesinlikle! Ozellikle pazar sabahlari. Senin icin de onemli mi dogayla vakit gecirmek?' },
  { side: 'a' as const, header: "SENIN AGENT'IN", text: 'Evet, uzun yuruyusler ve kafe kesifleri onun icin cok onemli. Ikisi de seyahat tutkunu.' },
  { side: 'b' as const, header: "ZEYNEP'IN AGENT'I", text: 'Ciddi iliski ariyor ve degerleri ortususyor. Iyi bir baslangic olabilir' },
];

const INSIGHTS = [
  { icon: '✅', text: 'Ikisi de ciddi iliski ariyor, niyet uyusuyor.' },
  { icon: '✅', text: 'Fotografcilik ve seyahat ortak tutkulari — ilk bulusma icin guclu konu.' },
  { icon: '⚡', text: 'Zeynep sabah tipiyken sen gece kususun — uyum saglanabilir.' },
  { icon: '💡', text: 'Oneri: Pazar sabahi pazar gezisi veya fotograf turu mukemmel ilk bulusma.' },
];

export default function AgentMatchScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke="#C09AFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Agent Match</Text>
          <Text style={styles.headerSub}>Zeynep ile uyumluluk analizi</Text>
        </View>
        <LinearGradient
          colors={[Colors.purpleDark, Colors.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.premiumBadge}
        >
          <Text style={styles.premiumText}>PREMIUM</Text>
        </LinearGradient>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
        {/* Profile Pair */}
        <View style={styles.pairSection}>
          <View style={styles.pairRow}>
            <View style={styles.avatar}>
              <Text style={{ fontSize: 26 }}>🧔</Text>
            </View>
            <View style={styles.vsContainer}>
              <LinearGradient
                colors={[Colors.purpleDark, Colors.purple]}
                style={styles.vsIcon}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 2C8 2 5 5 5 8.5C5 12 8 15 12 20C16 15 19 12 19 8.5C19 5 16 2 12 2Z" fill="white" opacity={0.9} />
                </Svg>
              </LinearGradient>
            </View>
            <View style={[styles.avatar, { backgroundColor: '#1e1530' }]}>
              <Text style={{ fontSize: 26 }}>👩</Text>
            </View>
          </View>
          <Text style={styles.pairNames}>Senin Agent'in - Zeynep'in Agent'i</Text>
        </View>

        {/* Compat Score Card */}
        <View style={styles.compatCard}>
          <Text style={styles.compatScore}>87%</Text>
          <Text style={styles.compatLabel}>UYUMLULUK SKORU</Text>
          <View style={styles.compatBars}>
            {COMPAT_BARS.map((bar) => (
              <View key={bar.label} style={styles.compatRow}>
                <Text style={styles.compatRowLabel}>{bar.label}</Text>
                <View style={styles.compatBar}>
                  <LinearGradient
                    colors={[Colors.purpleDark, Colors.purple]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.compatFill, { width: `${bar.value}%` }]}
                  />
                </View>
                <Text style={styles.compatVal}>{bar.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Agent Conversation */}
        <View>
          <Text style={styles.convTitle}>Agent konusmasi</Text>
          <View style={styles.msgs}>
            {AGENT_MSGS.map((msg, i) => (
              <View key={i} style={[styles.agentMsg, msg.side === 'b' && styles.agentMsgB]}>
                <Text style={[styles.agentMsgHeader, msg.side === 'b' && { textAlign: 'right' }]}>
                  {msg.header}
                </Text>
                <View style={[styles.agentBubble, msg.side === 'b' ? styles.bubbleB : styles.bubbleA]}>
                  <Text style={styles.agentBubbleText}>{msg.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Insights */}
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>Agent Icgoruleri</Text>
          {INSIGHTS.map((ins, i) => (
            <View key={i} style={styles.insightItem}>
              <Text style={styles.insightIcon}>{ins.icon}</Text>
              <Text style={styles.insightText}>{ins.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.cta}>
        <Pressable onPress={() => router.push('/screens/chat')}>
          {({ pressed }) => (
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.btnPrimary, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.btnPrimaryText}>Mesaj Baslat →</Text>
            </LinearGradient>
          )}
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.btnGhost}>
          <Text style={styles.btnGhostText}>Geri Don</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0812',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(160,100,255,0.12)',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(160,100,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: Colors.purpleMuted,
  },
  headerSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(160,100,255,0.55)',
    marginTop: 1,
  },
  premiumBadge: {
    marginLeft: 'auto',
    borderRadius: 99,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  premiumText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pairSection: {
    alignItems: 'center',
    marginBottom: 4,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3d2a4a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(160,100,255,0.4)',
  },
  vsContainer: {
    marginHorizontal: -8,
    zIndex: 2,
  },
  vsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  pairNames: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.white55,
    marginTop: 8,
    textAlign: 'center',
  },
  compatCard: {
    backgroundColor: Colors.purpleBg,
    borderWidth: 1,
    borderColor: Colors.purpleBorder,
    borderRadius: 16,
    padding: 16,
  },
  compatScore: {
    fontFamily: Fonts.heading,
    fontSize: 48,
    color: Colors.purple,
    textAlign: 'center',
    lineHeight: 48,
  },
  compatLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: 'rgba(160,100,255,0.6)',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.6,
  },
  compatBars: {
    marginTop: 14,
    gap: 8,
  },
  compatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compatRowLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.white45,
    width: 80,
  },
  compatBar: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.white08,
    borderRadius: 99,
    overflow: 'hidden',
  },
  compatFill: {
    height: '100%',
    borderRadius: 99,
  },
  compatVal: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: 'rgba(160,100,255,0.8)',
    width: 28,
    textAlign: 'right',
  },
  convTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.white28,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  msgs: {
    gap: 8,
  },
  agentMsg: {
    maxWidth: '82%',
    alignSelf: 'flex-start',
  },
  agentMsgB: {
    alignSelf: 'flex-end',
  },
  agentMsgHeader: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 10,
    color: 'rgba(160,100,255,0.6)',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  agentBubble: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 14,
  },
  bubbleA: {
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1,
    borderColor: Colors.purpleBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleB: {
    backgroundColor: 'rgba(124,58,237,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.3)',
    borderBottomRightRadius: 4,
  },
  agentBubbleText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 18.5,
    color: 'rgba(255,255,255,0.82)',
  },
  insightCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: Colors.white07,
    borderRadius: 14,
    padding: 14,
  },
  insightTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.white28,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  insightItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 9,
    alignItems: 'flex-start',
  },
  insightIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  insightText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 18,
    flex: 1,
  },
  cta: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: Colors.goldText,
  },
  btnGhost: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.white15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
});
