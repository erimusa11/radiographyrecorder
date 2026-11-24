/**
 * The logo is set in Poppins (geometric sans): Bold for the wordmark, Light with wide tracking for "BY ERI".
 * The app uses the same family so every screen reads as part of the logo.
 */
export const fonts = {
  light: 'Poppins_300Light',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 38 },
  title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 32 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
  button: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, letterSpacing: 0.3 },
  /** Small uppercase annotations, like the overlay text of a radiograph viewer. */
  hud: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 15, letterSpacing: 1.8, textTransform: 'uppercase' },
} as const;

export type TypeVariant = keyof typeof typography;
