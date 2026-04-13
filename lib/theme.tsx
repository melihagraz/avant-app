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

  // Accents
  accentGold: string;
  accentGoldDark: string;
  accentPurple: string;
  accentPink: string;       // alias for accentGold (backward compat)
  accentIndigo: string;
  accentGradient: string[];
  accentGradientAlt: string[];
  goldGradient: string[];
  purpleGradient: string[];

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
  bgGradient: ['#0D0D14', '#0D0D14', '#0D0D14'],
  authGradient: ['#0D0D14', '#0D0D14', '#0D0D14', '#0D0D14'],
  card: 'rgba(255, 255, 255, 0.05)',
  inputBg: 'rgba(255, 255, 255, 0.06)',
  loadingBg: '#0D0D14',

  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textHint: 'rgba(255, 255, 255, 0.4)',
  placeholder: 'rgba(255, 255, 255, 0.35)',

  border: 'rgba(255, 255, 255, 0.12)',
  borderLight: 'rgba(255, 255, 255, 0.07)',

  accentGold: '#E8B86D',
  accentGoldDark: '#D4914A',
  accentPurple: '#A064FF',
  accentPink: '#E8B86D',
  accentIndigo: '#A064FF',
  accentGradient: ['#E8B86D', '#D4914A'],
  accentGradientAlt: ['#E8B86D', '#D4914A'],
  goldGradient: ['#E8B86D', '#D4914A'],
  purpleGradient: ['#7c3aed', '#A064FF'],

  userBubble: '#E8B86D',
  userBubbleText: '#1a0f00',
  otherBubbleText: 'rgba(255, 255, 255, 0.88)',
  userAvatarBg: '#3A2A1A',

  success: '#4cd964',
  successGradient: ['#4cd964', '#69F0AE'],
  error: '#ff4444',
  online: '#4cd964',

  shadow: '#E8B86D',

  overlayDark: 'rgba(13, 13, 20, 0.92)',
  overlayLight: 'rgba(255, 255, 255, 0.06)',

  disabledGradient: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'],

  photoPlaceholders: [
    { bg: '#3d2a4a', text: '#C09AFF' },
    { bg: '#2a3d4a', text: '#64A0FF' },
    { bg: '#2a4a3d', text: '#4cd964' },
    { bg: '#4a3d2a', text: '#E8B86D' },
    { bg: '#4a2a3d', text: '#FF6B9D' },
  ],

  agentBGradient: ['#7c3aed', '#A064FF'],

  chevron: 'rgba(255, 255, 255, 0.25)',
  badge: 'rgba(0, 0, 0, 0.7)',
  tabInactive: 'rgba(255, 255, 255, 0.4)',
  white: '#ffffff',
  black: '#000000',
  separator: 'rgba(255, 255, 255, 0.05)',
};

const darkColors: ThemeColors = {
  bgGradient: ['#0D0D14', '#0D0D14', '#0D0D14'],
  authGradient: ['#0D0D14', '#0D0D14', '#0D0D14', '#0D0D14'],
  card: 'rgba(255, 255, 255, 0.05)',
  inputBg: 'rgba(255, 255, 255, 0.06)',
  loadingBg: '#0D0D14',

  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textHint: 'rgba(255, 255, 255, 0.4)',
  placeholder: 'rgba(255, 255, 255, 0.35)',

  border: 'rgba(255, 255, 255, 0.12)',
  borderLight: 'rgba(255, 255, 255, 0.07)',

  accentGold: '#E8B86D',
  accentGoldDark: '#D4914A',
  accentPurple: '#A064FF',
  accentPink: '#E8B86D',
  accentIndigo: '#A064FF',
  accentGradient: ['#E8B86D', '#D4914A'],
  accentGradientAlt: ['#E8B86D', '#D4914A'],
  goldGradient: ['#E8B86D', '#D4914A'],
  purpleGradient: ['#7c3aed', '#A064FF'],

  userBubble: '#E8B86D',
  userBubbleText: '#1a0f00',
  otherBubbleText: 'rgba(255, 255, 255, 0.88)',
  userAvatarBg: '#3A2A1A',

  success: '#4cd964',
  successGradient: ['#4cd964', '#69F0AE'],
  error: '#ff4444',
  online: '#4cd964',

  shadow: '#E8B86D',

  overlayDark: 'rgba(13, 13, 20, 0.92)',
  overlayLight: 'rgba(255, 255, 255, 0.06)',

  disabledGradient: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'],

  photoPlaceholders: [
    { bg: '#3d2a4a', text: '#C09AFF' },
    { bg: '#2a3d4a', text: '#64A0FF' },
    { bg: '#2a4a3d', text: '#4cd964' },
    { bg: '#4a3d2a', text: '#E8B86D' },
    { bg: '#4a2a3d', text: '#FF6B9D' },
  ],

  agentBGradient: ['#7c3aed', '#A064FF'],

  chevron: 'rgba(255, 255, 255, 0.25)',
  badge: 'rgba(0, 0, 0, 0.7)',
  tabInactive: 'rgba(255, 255, 255, 0.4)',
  white: '#ffffff',
  black: '#000000',
  separator: 'rgba(255, 255, 255, 0.05)',
};

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: darkColors,
  isDark: true,
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
