import React, { ReactNode } from 'react';
import { View, ViewStyle, DimensionValue, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing, radius } from '../../theme/tokens';

interface BoxProps {
  children?: ReactNode;

  // Spacing (using token keys)
  padding?: keyof typeof spacing;
  paddingHorizontal?: keyof typeof spacing;
  paddingVertical?: keyof typeof spacing;
  paddingTop?: keyof typeof spacing;
  paddingBottom?: keyof typeof spacing;
  paddingLeft?: keyof typeof spacing;
  paddingRight?: keyof typeof spacing;

  margin?: keyof typeof spacing;
  marginHorizontal?: keyof typeof spacing;
  marginVertical?: keyof typeof spacing;
  marginTop?: keyof typeof spacing;
  marginBottom?: keyof typeof spacing;
  marginLeft?: keyof typeof spacing;
  marginRight?: keyof typeof spacing;

  gap?: keyof typeof spacing;

  // Layout
  flex?: number;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';

  // Sizing
  width?: number | string;
  height?: number | string;
  minHeight?: number;
  maxWidth?: number | string;

  // Appearance
  backgroundColor?: string;
  borderRadius?: keyof typeof radius;
  borderWidth?: number;
  borderColor?: string;

  // Position
  position?: 'absolute' | 'relative';
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  zIndex?: number;

  // Other
  overflow?: 'visible' | 'hidden' | 'scroll';
  opacity?: number;
  style?: ViewStyle;

  // Accessibility
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'none' | 'button' | 'link' | 'header' | 'search' | 'image' | 'text';
}

export function Box({
  children,
  padding,
  paddingHorizontal,
  paddingVertical,
  paddingTop,
  paddingBottom,
  paddingLeft,
  paddingRight,
  margin,
  marginHorizontal,
  marginVertical,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  gap,
  flex,
  flexDirection,
  justifyContent,
  alignItems,
  alignSelf,
  flexWrap,
  width,
  height,
  minHeight,
  maxWidth,
  backgroundColor,
  borderRadius: borderRadiusKey,
  borderWidth,
  borderColor,
  position,
  top,
  right,
  bottom,
  left,
  zIndex,
  overflow,
  opacity,
  style,
  accessible,
  accessibilityLabel,
  accessibilityRole,
}: BoxProps): React.JSX.Element {
  const { theme } = useTheme();

  const computedStyle: ViewStyle = {
    // Padding
    ...(padding !== undefined && { padding: spacing[padding] }),
    ...(paddingHorizontal !== undefined && { paddingHorizontal: spacing[paddingHorizontal] }),
    ...(paddingVertical !== undefined && { paddingVertical: spacing[paddingVertical] }),
    ...(paddingTop !== undefined && { paddingTop: spacing[paddingTop] }),
    ...(paddingBottom !== undefined && { paddingBottom: spacing[paddingBottom] }),
    ...(paddingLeft !== undefined && { paddingLeft: spacing[paddingLeft] }),
    ...(paddingRight !== undefined && { paddingRight: spacing[paddingRight] }),

    // Margin
    ...(margin !== undefined && { margin: spacing[margin] }),
    ...(marginHorizontal !== undefined && { marginHorizontal: spacing[marginHorizontal] }),
    ...(marginVertical !== undefined && { marginVertical: spacing[marginVertical] }),
    ...(marginTop !== undefined && { marginTop: spacing[marginTop] }),
    ...(marginBottom !== undefined && { marginBottom: spacing[marginBottom] }),
    ...(marginLeft !== undefined && { marginLeft: spacing[marginLeft] }),
    ...(marginRight !== undefined && { marginRight: spacing[marginRight] }),

    // Gap
    ...(gap !== undefined && { gap: spacing[gap] }),

    // Layout
    ...(flex !== undefined && { flex }),
    ...(flexDirection !== undefined && { flexDirection }),
    ...(justifyContent !== undefined && { justifyContent }),
    ...(alignItems !== undefined && { alignItems }),
    ...(alignSelf !== undefined && { alignSelf }),
    ...(flexWrap !== undefined && { flexWrap }),

    // Sizing
    ...(width !== undefined && { width: width as DimensionValue }),
    ...(height !== undefined && { height: height as DimensionValue }),
    ...(minHeight !== undefined && { minHeight }),
    ...(maxWidth !== undefined && { maxWidth: maxWidth as DimensionValue }),

    // Appearance
    ...(backgroundColor !== undefined && { backgroundColor }),
    ...(borderRadiusKey !== undefined && { borderRadius: radius[borderRadiusKey] }),
    ...(borderWidth !== undefined && { borderWidth }),
    ...(borderColor !== undefined && { borderColor }),

    // Position
    ...(position !== undefined && { position }),
    ...(top !== undefined && { top }),
    ...(right !== undefined && { right }),
    ...(bottom !== undefined && { bottom }),
    ...(left !== undefined && { left }),
    ...(zIndex !== undefined && { zIndex }),

    // Other
    ...(overflow !== undefined && { overflow }),
    ...(opacity !== undefined && { opacity }),
  };

  return (
    <View
      style={[computedStyle, style]}
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      {children}
    </View>
  );
}
