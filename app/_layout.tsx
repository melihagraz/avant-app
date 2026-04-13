import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import {
  DMSerifDisplay_400Regular,
} from '@expo-google-fonts/dm-serif-display';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { Colors } from '../src/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useFiltersStore } from '../src/stores/filtersStore';
import { processSyncQueue } from '../src/lib/syncQueue';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSerifDisplay_400Regular,
  });

  const initialize = useAuthStore((s) => s.initialize);
  const isReady = useAuthStore((s) => s.isReady);
  const loadFilters = useFiltersStore((s) => s.load);

  useEffect(() => {
    initialize();
    loadFilters();
    // Process any queued messages from previous offline session
    processSyncQueue().catch(() => {});
  }, []);

  useEffect(() => {
    if (fontsLoaded && isReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isReady]);

  if (!fontsLoaded || !isReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.surface },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="screens/auth" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/profile-setup" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/agent-match" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="screens/match-screen" options={{ animation: 'fade' }} />
        <Stack.Screen name="screens/chat" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="screens/filters" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
});
