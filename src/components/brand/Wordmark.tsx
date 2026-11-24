import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { colors, fonts } from '@/theme';

/** "RADIOGRAPH RECORDER / BY ERI" set like the logo: Poppins Bold with a hint of tracking, then Poppins Light spaced wide. */
export function Wordmark({ screenWidth }: { screenWidth: number }) {
  // The title is about 13.4em wide at this tracking, so size it to leave a margin on small phones.
  const size = Math.round(Math.max(17, Math.min(24, (screenWidth - 56) / 13.4)) * 10) / 10;

  return (
    <View style={styles.wrap} accessible accessibilityRole="header" accessibilityLabel={`${strings.brand.name} ${strings.brand.byline.replace(/\s+/g, ' ').toLowerCase()}`}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.15}
        style={[styles.title, { fontSize: size, lineHeight: Math.round(size * 1.4), letterSpacing: size * 0.035 }]}>
        {strings.brand.wordmark}
      </Text>
      <Text maxFontSizeMultiplier={1.15} style={styles.byline}>
        {strings.brand.byline}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 4 },
  title: { fontFamily: fonts.bold, color: colors.text, textAlign: 'center', includeFontPadding: false },
  byline: {
    fontFamily: fonts.light,
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 7,
    // Tracking also trails the last letter; this keeps the text optically centred.
    paddingLeft: 7,
    marginTop: 4,
    color: colors.text,
    opacity: 0.9,
    includeFontPadding: false,
  },
});
