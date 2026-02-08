import React, { ReactNode } from 'react';
import { Text as RNText, TextStyle, StyleProp, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { typography, TypographyToken } from '../../theme/tokens';

interface TextProps {
  children: ReactNode;

  // Typography variant
  variant?: TypographyToken;

  // Color
  color?: 'primary' | 'secondary' | 'disabled' | 'inverse' | 'link' | 'error' | 'success';

  // Alignment
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';

  // Transforms
  uppercase?: boolean;
  lowercase?: boolean;
  capitalize?: boolean;

  // Decoration
  underline?: boolean;
  strikethrough?: boolean;

  // Truncation
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';

  // Other
  selectable?: boolean;
  style?: StyleProp<TextStyle>;

  // Accessibility
  accessibilityRole?: 'none' | 'text' | 'header' | 'link';
  accessibilityLabel?: string;

  // Events
  onPress?: () => void;
}

export function Text({
  children,
  variant = 'body',
  color = 'primary',
  align,
  uppercase,
  lowercase,
  capitalize,
  underline,
  strikethrough,
  numberOfLines,
  ellipsizeMode,
  selectable,
  style,
  accessibilityRole,
  accessibilityLabel,
  onPress,
}: TextProps): React.JSX.Element {
  const { theme } = useTheme();

  // Get color value
  const getColor = (): string => {
    switch (color) {
      case 'primary':
        return theme.colors.text.primary;
      case 'secondary':
        return theme.colors.text.secondary;
      case 'disabled':
        return theme.colors.text.disabled;
      case 'inverse':
        return theme.colors.text.inverse;
      case 'link':
        return theme.colors.text.link;
      case 'error':
        return theme.colors.semantic.error;
      case 'success':
        return theme.colors.semantic.success;
      default:
        return theme.colors.text.primary;
    }
  };

  // Build text transform
  const getTextTransform = (): TextStyle['textTransform'] => {
    if (uppercase) return 'uppercase';
    if (lowercase) return 'lowercase';
    if (capitalize) return 'capitalize';
    return 'none';
  };

  // Build text decoration
  const getTextDecoration = (): TextStyle['textDecorationLine'] => {
    if (underline && strikethrough) return 'underline line-through';
    if (underline) return 'underline';
    if (strikethrough) return 'line-through';
    return 'none';
  };

  const computedStyle: TextStyle = {
    ...typography[variant],
    color: getColor(),
    ...(align && { textAlign: align }),
    textTransform: getTextTransform(),
    textDecorationLine: getTextDecoration(),
  };

  return (
    <RNText
      style={[computedStyle, style]}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      selectable={selectable}
      accessibilityRole={accessibilityRole || (onPress ? 'link' : 'text')}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    >
      {children}
    </RNText>
  );
}

export function Heading1({ children, ...props }: Omit<TextProps, 'variant'>): React.JSX.Element {
  return <Text variant="heading1" accessibilityRole="header" {...props}>{children}</Text>;
}

export function Heading2({ children, ...props }: Omit<TextProps, 'variant'>): React.JSX.Element {
  return <Text variant="heading2" accessibilityRole="header" {...props}>{children}</Text>;
}

export function Heading3({ children, ...props }: Omit<TextProps, 'variant'>): React.JSX.Element {
  return <Text variant="heading3" accessibilityRole="header" {...props}>{children}</Text>;
}

export function Body({ children, ...props }: Omit<TextProps, 'variant'>): React.JSX.Element {
  return <Text variant="body" {...props}>{children}</Text>;
}

export function Caption({ children, ...props }: Omit<TextProps, 'variant'>): React.JSX.Element {
  return <Text variant="caption" color="secondary" {...props}>{children}</Text>;
}
