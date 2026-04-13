import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FILTERS_KEY = '@avant2/filters';

interface FiltersState {
  distance: number;
  ageMin: number;
  ageMax: number;
  gender: string;
  datingIntention: string;
  verifiedOnly: boolean;

  setFilter: <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => void;
  reset: () => void;
  persist: () => Promise<void>;
  load: () => Promise<void>;
}

const DEFAULTS = {
  distance: 25,
  ageMin: 24,
  ageMax: 35,
  gender: 'female',
  datingIntention: 'serious',
  verifiedOnly: true,
};

export const useFiltersStore = create<FiltersState>((set, get) => ({
  ...DEFAULTS,

  setFilter: (key, value) => {
    set({ [key]: value } as any);
  },

  reset: () => {
    set(DEFAULTS);
    get().persist();
  },

  persist: async () => {
    try {
      const { distance, ageMin, ageMax, gender, datingIntention, verifiedOnly } = get();
      await AsyncStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ distance, ageMin, ageMax, gender, datingIntention, verifiedOnly })
      );
    } catch {}
  },

  load: async () => {
    try {
      const data = await AsyncStorage.getItem(FILTERS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        set(parsed);
      }
    } catch {}
  },
}));
