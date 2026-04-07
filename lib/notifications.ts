// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications sadece fiziksel cihazda çalışır');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Bildirim izni verilmedi');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    return token;
  } catch (err) {
    console.error('Push notification kayıt hatası:', err);
    return null;
  }
}

export async function savePushToken(userId: string, token: string) {
  try {
    const { error } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
    if (error) console.error('Push token kayıt hatası:', error);
  } catch (err) {
    console.error('Push token kayıt hatası:', err);
  }
}

export async function sendMatchNotification(
  pushToken: string,
  matchedUserName: string,
  score: number
) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title: 'Yeni eşleşme! 🎉',
        body: `Agentın ${matchedUserName} ile eşleşti — ${score} uyum puanı`,
        data: { type: 'new_match' },
        sound: 'default',
      }),
    });
    if (!response.ok) {
      console.error('Bildirim gönderme hatası:', response.status);
    }
  } catch (err) {
    console.error('Bildirim gönderme hatası:', err);
  }
}
