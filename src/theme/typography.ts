import { TextStyle } from 'react-native';

export const Fonts = {
  heading: 'DMSerifDisplay_400Regular',
  headingItalic: 'DMSerifDisplay_400Regular_Italic',
  body: 'DMSans_400Regular',
  bodyLight: 'DMSans_300Light',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
} as const;

export const Typography = {
  appTitle: {
    fontFamily: Fonts.heading,
    fontSize: 38,
    letterSpacing: -1,
  } as TextStyle,
  screenTitle: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    lineHeight: 34,
  } as TextStyle,
  sectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: 22,
  } as TextStyle,
  cardName: {
    fontFamily: Fonts.heading,
    fontSize: 28,
  } as TextStyle,
  bodyLarge: {
    fontFamily: Fonts.body,
    fontSize: 15,
  } as TextStyle,
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
  } as TextStyle,
  bodySmall: {
    fontFamily: Fonts.body,
    fontSize: 13,
  } as TextStyle,
  caption: {
    fontFamily: Fonts.body,
    fontSize: 12,
  } as TextStyle,
  tiny: {
    fontFamily: Fonts.body,
    fontSize: 11,
  } as TextStyle,
  micro: {
    fontFamily: Fonts.body,
    fontSize: 10,
  } as TextStyle,
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } as TextStyle,
} as const;
