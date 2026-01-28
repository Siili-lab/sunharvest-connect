// 4px grid spacing scale
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
} as const;

export const layout = {
  // Screen padding
  screenPaddingHorizontal: spacing[4],  // 16px
  screenPaddingVertical: spacing[4],    // 16px

  // Card spacing
  cardPadding: spacing[4],              // 16px
  cardGap: spacing[3],                  // 12px

  // Section spacing
  sectionGap: spacing[6],               // 24px

  // Component spacing
  buttonPaddingHorizontal: spacing[6],  // 24px
  buttonPaddingVertical: spacing[3],    // 12px
  inputPaddingHorizontal: spacing[4],   // 16px
  inputPaddingVertical: spacing[3],     // 12px

  // Touch targets (accessibility)
  minTouchTarget: spacing[12],          // 48px - WCAG minimum
} as const;

export const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

export type SpacingToken = typeof spacing;
export type LayoutToken = typeof layout;
export type RadiusToken = typeof radius;
