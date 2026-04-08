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
  bgGradient: ['#0F0A1A', '#151025', '#0A0F1A'],
  authGradient: ['#1A0F15', '#1A1025', '#150F1A', '#0F151A'],
  card: '#1E1A2E',
  inputBg: '#251E3A',
  loadingBg: '#0F0A1A',

  textPrimary: '#F0E8FF',
  textSecondary: '#8B7AA0',
  textMuted: '#7A6B92',
  textHint: '#6B5A80',
  placeholder: '#6B5A80',

  border: '#3A2E55',
  borderLight: '#2E2445',

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

  shadow: '#000000',

  overlayDark: 'rgba(15,10,26,0.9)',
  overlayLight: 'rgba(30,26,46,0.85)',

  disabledGradient: ['#3A2E55', '#2E2445'],

  photoPlaceholders: [
    { bg: '#3A1A2A', text: '#FF6B9D' },
    { bg: '#2E1E4A', text: '#C084FC' },
    { bg: '#1A3A2A', text: '#10B981' },
    { bg: '#3A2A1A', text: '#F97316' },
    { bg: '#1A2A3A', text: '#3B82F6' },
  ],

  agentBGradient: ['#818CF8', '#3B82F6'],

  chevron: '#4A3E65',
  badge: 'rgba(0,0,0,0.7)',
  tabInactive: '#6B5A80',
  white: '#ffffff',
  black: '#000000',
  separator: '#2E2445',
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
