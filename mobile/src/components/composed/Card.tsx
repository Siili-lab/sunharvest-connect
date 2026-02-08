import React, { ReactNode } from 'react';
import { TouchableOpacity, ViewStyle, StyleSheet } from 'react-native';
import { Box } from '../primitives/Box';
import { useTheme } from '../../theme/ThemeProvider';
import { shadows, radius, spacing } from '../../theme/tokens';

interface CardProps {
  children: ReactNode;

  // Variants
  variant?: 'elevated' | 'outlined' | 'filled';

  // Interaction
  onPress?: () => void;
  disabled?: boolean;

  // Sizing
  padding?: keyof typeof spacing;
  fullWidth?: boolean;

  // Style override
  style?: ViewStyle;
}

export function Card({
  children,
  variant = 'elevated',
  onPress,
  disabled = false,
  padding = 4,
  fullWidth = true,
  style,
}: CardProps): React.JSX.Element {
  const { theme } = useTheme();

  // Get variant styles
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: theme.colors.background.elevated,
          ...shadows.sm,
        };

      case 'outlined':
        return {
          backgroundColor: theme.colors.background.primary,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
        };

      case 'filled':
        return {
          backgroundColor: theme.colors.background.secondary,
        };

      default:
        return {};
    }
  };

  const cardStyle: ViewStyle = {
    borderRadius: radius.lg,
    ...getVariantStyles(),
    ...(fullWidth && { width: '100%' }),
    ...style,
  };

  // If interactive, wrap in TouchableOpacity
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        style={cardStyle}
        accessibilityRole="button"
      >
        <Box padding={padding}>
          {children}
        </Box>
      </TouchableOpacity>
    );
  }

  return (
    <Box style={cardStyle} padding={padding}>
      {children}
    </Box>
  );
}
