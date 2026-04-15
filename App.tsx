// App.tsx
import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Linking, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from './lib/supabase';
import { registerForPushNotifications, savePushToken } from './lib/notifications';
import { ThemeProvider, useTheme } from './lib/theme';
import { useAvantFonts } from './lib/fonts';
import { initSentry, setSentryUser, Sentry } from './lib/sentry';
import { setAnalyticsUser, trackEvent, trackScreen } from './lib/analytics';
import './lib/i18n';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from './lib/offline';
import { processSyncQueue } from './lib/syncQueue';
import BottomTabBar from './components/BottomTabBar';

import AuthScreen from './screens/AuthScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import HumanChatScreen from './screens/HumanChatScreen';
import AgentLogScreen from './screens/AgentLogScreen';
import ProfileScreen from './screens/ProfileScreen';
import ProfileDetailScreen from './screens/ProfileDetailScreen';
import MatchRevealScreen from './screens/MatchRevealScreen';
import DiscoverScreen from './screens/DiscoverScreen';
import AgentMatchesScreen from './screens/AgentMatchesScreen';
import ExploreScreen from './screens/ExploreScreen';
import AgentMatchScreen from './screens/AgentMatchScreen';
import FilterScreen from './screens/FilterScreen';
import AgentNamingScreen from './screens/AgentNamingScreen';

initSentry();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Chat" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const [session, setSession] = useState<any>(null);
  const [hasAgent, setHasAgent] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const navigationRef = useRef<any>(null);
  const routeNameRef = useRef<string | undefined>(undefined);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const fontsLoaded = useAvantFonts();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (isOnline && wasOffline.current) {
      processSyncQueue();
    }
    wasOffline.current = !isOnline;
  }, [isOnline]);

  useEffect(() => {
    trackEvent('app_open');

    const handleDeepLink = async (url: string) => {
      if (url && url.includes('access_token')) {
        const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    const timeout = setTimeout(() => setLoading(false), 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      if (session) {
        const userId = session.user.id;
        setAnalyticsUser(userId);
        setSentryUser(userId);
        checkAgent(userId);
        setupPushToken(userId);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        const userId = session.user.id;
        setAnalyticsUser(userId);
        setSentryUser(userId);
        checkAgent(userId);
        setupPushToken(userId);
      } else {
        setAnalyticsUser(null);
        setSentryUser(null);
        setHasAgent(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.remove();
      authSub.unsubscribe();
    };
  }, []);

  const checkAgent = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', userId)
        .single();
      setHasAgent(!!data);

      if (data) {
        supabase.functions.invoke('start-match', {
          body: { user_id: userId },
        }).catch(console.error);
      }
    } catch {
      setHasAgent(false);
    } finally {
      setLoading(false);
    }
  };

  const setupPushToken = async (userId: string) => {
    try {
      const token = await registerForPushNotifications();
      if (token) await savePushToken(userId, token);
    } catch (err) {
      console.log('Push token hatasi:', err);
    }
  };

  if (loading || !fontsLoaded) {
    return (
      <View style={[loadingStyles.container, { backgroundColor: colors.loadingBg }]}>
        <ActivityIndicator size="large" color={colors.accentGold} />
      </View>
    );
  }

  const initialRoute = !session ? 'Auth' : hasAgent ? 'Main' : 'Welcome';

  return (
    <View style={{ flex: 1 }}>
      {!isOnline && (
        <View style={[loadingStyles.offlineBanner, { backgroundColor: colors.accentGold }]}>
          <Text style={loadingStyles.offlineText}>{t('common.offline')}</Text>
        </View>
      )}
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
      }}
      onStateChange={() => {
        const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;
        if (currentRouteName && currentRouteName !== routeNameRef.current) {
          trackScreen(currentRouteName);
          routeNameRef.current = currentRouteName;
        }
      }}
    >
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="AgentNaming" component={AgentNamingScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Explore" component={ExploreScreen} />
        <Stack.Screen name="AgentMatches" component={AgentMatchesScreen} />
        <Stack.Screen name="AgentMatchDetail" component={AgentMatchScreen} />
        <Stack.Screen
          name="Filter"
          component={FilterScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="HumanChat" component={HumanChatScreen} />
        <Stack.Screen name="AgentLog" component={AgentLogScreen} />
        <Stack.Screen
          name="ProfileDetail"
          component={ProfileDetailScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="MatchReveal"
          component={MatchRevealScreen}
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    </View>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBanner: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  offlineText: {
    color: '#1a0f00',
    fontSize: 13,
    fontWeight: '700',
  },
});
