/** 4-point spacing scale, corner radii and the minimum touch target. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 16, xl: 24, pill: 999 } as const;

/** Minimum touch target (Android guideline 48dp, Apple 44pt). */
export const MIN_TARGET = 48;
