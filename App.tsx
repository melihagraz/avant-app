// App.tsx
import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Linking, View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from './lib/supabase';
import { registerForPushNotifications, savePushToken } from './lib/notifications';

import AuthScreen from './screens/AuthScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import HumanChatScreen from './screens/HumanChatScreen';
import AgentLogScreen from './screens/AgentLogScreen';
import ProfileScreen from './screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [hasAgent, setHasAgent] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    // Timeout: Supabase yanıt vermezse 5 saniyede auth ekranına düş
    const timeout = setTimeout(() => setLoading(false), 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      if (session) {
        checkAgent(session.user.id);
        setupPushToken(session.user.id);
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
        checkAgent(session.user.id);
        setupPushToken(session.user.id);
      } else {
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

      // Agent varsa start-match sessizce çalıştır — yeni kullanıcıları bulsun
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
      console.log('Push token hatası:', err);
    }
  };

  if (loading) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color="#C084FC" />
      </View>
    );
  }

  const initialRoute = !session ? 'Auth' : hasAgent ? 'Home' : 'Welcome';

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="HumanChat" component={HumanChatScreen} />
        <Stack.Screen name="AgentLog" component={AgentLogScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
  },
});
