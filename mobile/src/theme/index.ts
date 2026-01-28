/**
 * Theme - Central Export
 *
 * All theme-related exports from single location.
 *
 * Usage:
 *   import { ThemeProvider, useTheme, colors, spacing } from '@/theme';
 */

// Theme provider and hook
export { ThemeProvider, useTheme, lightTheme, darkTheme } from './ThemeProvider';
export type { Theme, ThemeContextType } from './ThemeProvider';

// Design tokens
export {
  colors,
  spacing,
  layout,
  radius,
  typography,
  fontSize,
  fontWeight,
  lineHeight,
  fontFamily,
  shadows,
  coloredShadows,
} from './tokens';

// Token types
export type {
  ColorToken,
  SpacingToken,
  LayoutToken,
  RadiusToken,
  TypographyToken,
  ShadowToken,
} from './tokens';
