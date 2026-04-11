import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export interface ThemeColors {
  // Backgrounds
  bgGradient: string[];
  authGradient: string[];
  card: string;
  inputBg: string;
  loadingBg: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textHint: string;
  placeholder: string;

  // Borders
  border: string;
  borderLight: string;

  // Accents (same in both themes)
  accentPink: string;
  accentPurple: string;
  accentIndigo: string;
  accentGradient: string[];
  accentGradientAlt: string[];

  // Chat
  userBubble: string;
  userBubbleText: string;
  otherBubbleText: string;
  userAvatarBg: string;

  // Status
  success: string;
  successGradient: string[];
  error: string;
  online: string;

  // Shadow
  shadow: string;

  // Overlay
  overlayDark: string;
  overlayLight: string;

  // Disabled
  disabledGradient: string[];

  // Photo placeholders
  photoPlaceholders: { bg: string; text: string }[];

  // Agent B colors
  agentBGradient: string[];

  // Misc
  chevron: string;
  badge: string;
  tabInactive: string;
  white: string;
  black: string;
  separator: string;
}

const lightColors: ThemeColors = {
  bgGradient: ['#FFF8FA', '#F8F5FF', '#F5FAFF'],
  authGradient: ['#FFF0F5', '#FDE8EF', '#F0E6FF', '#E8F4FD'],
  card: '#ffffff',
  inputBg: '#F8F5FC',
  loadingBg: '#FFF0F5',

  textPrimary: '#2D1B4E',
  textSecondary: '#9B8AB8',
  textMuted: '#8B7AA0',
  textHint: '#B8A8CC',
  placeholder: '#C4B5D0',

  border: '#F0EBF7',
  borderLight: '#F0EBF7',

  accentPink: '#FF6B9D',
  accentPurple: '#C084FC',
  accentIndigo: '#818CF8',
  accentGradient: ['#FF6B9D', '#C084FC', '#818CF8'],
  accentGradientAlt: ['#FF6B9D', '#C084FC'],

  userBubble: '#7C3AED',
  userBubbleText: '#ffffff',
  otherBubbleText: '#2D1B4E',
  userAvatarBg: '#E8DEFF',

  success: '#00C853',
  successGradient: ['#00C853', '#69F0AE'],
  error: '#FF6B9D',
  online: '#10B981',

  shadow: '#C084FC',

  overlayDark: 'rgba(45,27,78,0.85)',
  overlayLight: 'rgba(255,255,255,0.85)',

  disabledGradient: ['#E0D0E8', '#D8C8E0'],

  photoPlaceholders: [
    { bg: '#FFE0EB', text: '#FF6B9D' },
    { bg: '#E8DEFF', text: '#7C3AED' },
    { bg: '#D6F5E8', text: '#10B981' },
    { bg: '#FFE4D6', text: '#F97316' },
    { bg: '#DBEAFE', text: '#3B82F6' },
  ],

  agentBGradient: ['#818CF8', '#3B82F6'],

  chevron: '#D4C8E0',
  badge: 'rgba(0,0,0,0.5)',
  tabInactive: '#C4B5D0',
  white: '#ffffff',
  black: '#000000',
  separator: '#F0EBF7',
};

const darkColors: ThemeColors = {
  // Deep Midnight palette - sofistike koyu lacivert/siyah
  bgGradient: ['#05060F', '#0A0B1A', '#06070F'],
  authGradient: ['#05060F', '#0D0718', '#0A0B1A', '#05060F'],
  card: 'rgba(28, 22, 45, 0.6)',      // Yarı şeffaf cam efekti için
  inputBg: 'rgba(36, 28, 56, 0.55)',
  loadingBg: '#05060F',

  textPrimary: '#F5F0FF',
  textSecondary: 'rgba(245, 240, 255, 0.65)',  // 65% opacity - apple HIG
  textMuted: 'rgba(245, 240, 255, 0.5)',
  textHint: 'rgba(245, 240, 255, 0.4)',
  placeholder: 'rgba(245, 240, 255, 0.35)',

  border: 'rgba(192, 132, 252, 0.15)',  // İnce mor glow
  borderLight: 'rgba(192, 132, 252, 0.08)',

  accentPink: '#FF6B9D',
  accentPurple: '#C084FC',
  accentIndigo: '#818CF8',
  accentGradient: ['#FF6B9D', '#C084FC', '#818CF8'],
  accentGradientAlt: ['#FF6B9D', '#C084FC'],

  userBubble: '#7C3AED',
  userBubbleText: '#ffffff',
  otherBubbleText: '#F0E8FF',
  userAvatarBg: '#3A2E55',

  success: '#00C853',
  successGradient: ['#00C853', '#69F0AE'],
  error: '#FF6B9D',
  online: '#10B981',

  shadow: '#C084FC',  // Glow shadow - koyu arka planda görünmez olmasın

  overlayDark: 'rgba(5,6,15,0.92)',
  overlayLight: 'rgba(28,22,45,0.75)',

  disabledGradient: ['rgba(58,46,85,0.5)', 'rgba(46,36,69,0.5)'],

  photoPlaceholders: [
    { bg: '#3A1A2A', text: '#FF6B9D' },
    { bg: '#2E1E4A', text: '#C084FC' },
    { bg: '#1A3A2A', text: '#10B981' },
    { bg: '#3A2A1A', text: '#F97316' },
    { bg: '#1A2A3A', text: '#3B82F6' },
  ],

  agentBGradient: ['#818CF8', '#3B82F6'],

  chevron: 'rgba(245,240,255,0.25)',
  badge: 'rgba(0,0,0,0.7)',
  tabInactive: 'rgba(245,240,255,0.4)',
  white: '#ffffff',
  black: '#000000',
  separator: 'rgba(192,132,252,0.1)',
};

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: lightColors,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const value = useMemo(
    () => ({
      colors: isDark ? darkColors : lightColors,
      isDark,
    }),
    [isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
