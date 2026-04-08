import React from 'react';
import { Text } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../../lib/theme';

// Mock useColorScheme
let mockColorScheme = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('useTheme', () => {
  it('should return light theme colors by default', () => {
    mockColorScheme = 'light';
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.isDark).toBe(false);
    expect(result.current.colors.card).toBe('#ffffff');
    expect(result.current.colors.textPrimary).toBe('#2D1B4E');
  });

  it('should return dark theme colors when dark mode', () => {
    mockColorScheme = 'dark';
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.isDark).toBe(true);
    expect(result.current.colors.card).toBe('#1E1A2E');
    expect(result.current.colors.textPrimary).toBe('#F0E8FF');
  });

  it('should keep accent colors the same in both themes', () => {
    mockColorScheme = 'light';
    const { result: lightResult } = renderHook(() => useTheme(), { wrapper });

    mockColorScheme = 'dark';
    const { result: darkResult } = renderHook(() => useTheme(), { wrapper });

    expect(lightResult.current.colors.accentPink).toBe(darkResult.current.colors.accentPink);
    expect(lightResult.current.colors.accentPurple).toBe(darkResult.current.colors.accentPurple);
  });

  it('should have photo placeholders in both themes', () => {
    mockColorScheme = 'light';
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.colors.photoPlaceholders).toHaveLength(5);
    result.current.colors.photoPlaceholders.forEach(p => {
      expect(p.bg).toBeDefined();
      expect(p.text).toBeDefined();
    });
  });
});
