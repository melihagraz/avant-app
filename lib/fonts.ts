import {
  useFonts,
  DMSerifDisplay_400Regular,
} from '@expo-google-fonts/dm-serif-display';
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

export const FONT_HEADING = 'DMSerifDisplay_400Regular';
export const FONT_BODY = 'DMSans_400Regular';
export const FONT_BODY_LIGHT = 'DMSans_300Light';
export const FONT_BODY_MEDIUM = 'DMSans_500Medium';
export const FONT_BODY_SEMIBOLD = 'DMSans_600SemiBold';
export const FONT_BODY_BOLD = 'DMSans_700Bold';

export function useAvantFonts() {
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  return fontsLoaded;
}
