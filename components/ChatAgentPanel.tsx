// components/ChatAgentPanel.tsx
// Slide-up panel with AI-generated message suggestions
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated as RNAnimated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { captureError } from '../lib/sentry';
import { FONT_BODY_SEMIBOLD } from '../lib/fonts';

interface Suggestion {
  emoji: string;
  text: string;
}

interface Props {
  visible: boolean;
  matchId: string;
  matchScore?: number | null;
  onClose: () => void;
  onSelectSuggestion: (text: string) => void;
}

export default function ChatAgentPanel({
  visible,
  matchId,
  matchScore,
  onClose,
  onSelectSuggestion,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const slideAnim = React.useRef(new RNAnimated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      RNAnimated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
      if (suggestions.length === 0) fetchSuggestions();
    } else {
      RNAnimated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('chat-suggest', {
        body: { match_id: matchId },
      });

      if (fnError || !data?.suggestions) {
        // Fallback suggestions
        setSuggestions([
          { emoji: '\u{1F5FA}\uFE0F', text: 'Bu hafta sonu bulusma yapalim mi? Bildigim harika bir yer var.' },
          { emoji: '\u{1F4F8}', text: 'En cok hangi anlari cekmekten hoslaniyorsun?' },
          { emoji: '\u2615', text: 'Bir kahve icerken seni daha iyi tanimak isterim.' },
        ]);
      } else {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      captureError(err, { context: 'chat_suggest' });
      // Fallback
      setSuggestions([
        { emoji: '\u{1F44B}', text: 'Merhaba! Profilini cok begendim, tanismak isterim.' },
        { emoji: '\u2615', text: 'Bir kahve icmeye ne dersin?' },
        { emoji: '\u{1F30D}', text: 'En son nereye seyahat ettin?' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <RNAnimated.View
      style={[
        s.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <BlurView intensity={90} tint="dark" style={s.blur}>
        <View style={s.inner}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerDot} />
            <Text style={s.headerTitle}>AGENT ASISTAN — PREMIUM</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={16} color="rgba(160,100,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Suggestions */}
          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color="#A064FF" size="small" />
              <Text style={s.loadingText}>Oneriler hazirlaniyor...</Text>
            </View>
          ) : (
            <View style={s.suggestions}>
              {suggestions.map((sug, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.chip}
                  onPress={() => onSelectSuggestion(sug.text)}
                  activeOpacity={0.7}
                >
                  <Text style={s.chipIcon}>{sug.emoji}</Text>
                  <Text style={s.chipText}>{sug.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Tip */}
          {matchScore && (
            <Text style={s.tip}>
              %{matchScore} uyumluluk
            </Text>
          )}
        </View>
      </BlurView>
    </RNAnimated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 58,
    zIndex: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  blur: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  inner: {
    backgroundColor: 'rgba(10,8,18,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(160,100,255,0.25)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(160,100,255,0.3)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  headerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#A064FF',
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(160,100,255,0.7)',
    letterSpacing: 0.08,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 12,
    color: 'rgba(160,100,255,0.5)',
  },
  suggestions: {
    gap: 7,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.22)',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 17,
    flex: 1,
  },
  tip: {
    fontSize: 11,
    color: 'rgba(160,100,255,0.5)',
    textAlign: 'center',
  },
});
