import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const typography: Record<string, TextStyle> = {
  heading1: {
    fontSize: fontSize['3xl'],      // 28px
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['3xl'] * lineHeight.tight,
    letterSpacing: -0.5,
  },

  heading2: {
    fontSize: fontSize['2xl'],      // 24px
    fontWeight: fontWeight.semiBold,
    lineHeight: fontSize['2xl'] * lineHeight.tight,
    letterSpacing: -0.25,
  },

  heading3: {
    fontSize: fontSize.xl,          // 20px
    fontWeight: fontWeight.semiBold,
    lineHeight: fontSize.xl * lineHeight.tight,
  },

  heading4: {
    fontSize: fontSize.lg,          // 18px
    fontWeight: fontWeight.semiBold,
    lineHeight: fontSize.lg * lineHeight.normal,
  },

  bodyLarge: {
    fontSize: fontSize.lg,          // 18px
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.lg * lineHeight.relaxed,
  },

  body: {
    fontSize: fontSize.base,        // 16px
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.base * lineHeight.normal,
  },

  bodySmall: {
    fontSize: fontSize.sm,          // 14px
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.sm * lineHeight.normal,
  },

  button: {
    fontSize: fontSize.base,        // 16px
    fontWeight: fontWeight.semiBold,
    lineHeight: fontSize.base * lineHeight.tight,
    letterSpacing: 0.5,
  },

  buttonSmall: {
    fontSize: fontSize.sm,          // 14px
    fontWeight: fontWeight.semiBold,
    lineHeight: fontSize.sm * lineHeight.tight,
    letterSpacing: 0.25,
  },

  label: {
    fontSize: fontSize.sm,          // 14px
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.sm * lineHeight.tight,
  },

  caption: {
    fontSize: fontSize.xs,          // 12px
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.xs * lineHeight.normal,
  },

  price: {
    fontSize: fontSize['2xl'],      // 24px
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['2xl'] * lineHeight.tight,
  },

  grade: {
    fontSize: fontSize.xl,          // 20px
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.xl * lineHeight.tight,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
} as const;

export type TypographyToken = keyof typeof typography;
