/**
 * Radiography Recorder palette.
 *
 * Every value comes from the logo: the canvas is the logo's own ink (#191919), the brand gradient runs
 * #43D5D1 (top of the lungs) to #21B2E8 (base of the lungs), and #F9F9F9 is the white of the wordmark.
 * Contrast (WCAG) is noted where text sits on a surface.
 */
export const colors = {
  // Surfaces
  ink: '#191919', // app canvas = logo background
  card: 'rgba(255,255,255,0.035)',
  field: '#262626', // opaque input surface
  line: 'rgba(255,255,255,0.09)',
  lineStrong: 'rgba(255,255,255,0.18)',

  // Brand gradient (vertical in the logo: aqua on top, azure at the base)
  aqua: '#43D5D1',
  azure: '#21B2E8',
  aquaSoft: 'rgba(67,213,209,0.14)',
  aquaLine: 'rgba(67,213,209,0.5)',

  // Text
  text: '#F9F9F9', // 16.6:1 on ink
  textMuted: '#A8A8A8', // 7.4:1 on ink
  textSubtle: '#949494', // 5.8:1 on ink, 5.0:1 on field
  onBrand: '#0B1417', // text on the gradient: 7.7:1 (azure end) to 10.5:1 (aqua end)

  // Feedback
  danger: '#FF7A7A', // 7.0:1 on ink
  dangerSoft: 'rgba(255,122,122,0.10)',
  dangerLine: 'rgba(255,122,122,0.40)',
  dangerText: '#FFB3B3',
  warning: '#F5B94E', // low stock: 10.3:1 on ink
  warningSoft: 'rgba(245,185,78,0.12)',
  warningLine: 'rgba(245,185,78,0.45)',
} as const;

/** The brand gradient, top to bottom like the logo. */
export const gradients = {
  brand: [colors.aqua, colors.azure] as const,
} as const;
