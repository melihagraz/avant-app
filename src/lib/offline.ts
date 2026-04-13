import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { AppState } from 'react-native';

const KEYS = {
  profile: (uid: string) => `@avant2/profile/${uid}`,
  matches: (uid: string) => `@avant2/matches/${uid}`,
  messages: (mid: string) => `@avant2/messages/${mid}`,
};

// Simple online status without NetInfo dependency
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // For now assume online; can add NetInfo later
    const sub = AppState.addEventListener('change', () => {
      setOnline(true);
    });
    return () => sub.remove();
  }, []);

  return online;
}

export async function cacheProfile(userId: string, profile: any): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.profile(userId), JSON.stringify(profile));
  } catch {}
}

export async function getCachedProfile(userId: string): Promise<any | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.profile(userId));
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function cacheMatches(userId: string, matches: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.matches(userId), JSON.stringify(matches));
  } catch {}
}

export async function getCachedMatches(userId: string): Promise<any[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.matches(userId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function cacheMessages(matchId: string, messages: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.messages(matchId), JSON.stringify(messages));
  } catch {}
}

export async function getCachedMessages(matchId: string): Promise<any[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.messages(matchId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
