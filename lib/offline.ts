import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useState, useEffect } from 'react';

const KEYS = {
  profile: (uid: string) => `@avant/profile/${uid}`,
  matches: (uid: string) => `@avant/matches/${uid}`,
  messages: (mid: string) => `@avant/messages/${mid}`,
};

// --- Bağlantı durumu ---

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setOnline(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  return online;
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? true;
}

// --- Profil cache ---

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

// --- Eşleşme cache ---

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

// --- Mesaj cache ---

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
