import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tr from '../locales/tr.json';
import en from '../locales/en.json';

const LANGUAGE_KEY = '@avant/language';

const deviceLang = getLocales()[0]?.languageCode || 'tr';

i18next.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
  },
  lng: deviceLang.startsWith('tr') ? 'tr' : 'en',
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Kaydedilmiş dil tercihini yükle
AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
  if (saved && saved !== i18next.language) {
    i18next.changeLanguage(saved);
  }
});

export async function setLanguage(lang: string) {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18next.changeLanguage(lang);
}

export default i18next;
