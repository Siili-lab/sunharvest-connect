import React, { ReactNode } from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';
import { colors, spacing, radius, layout, shadows } from '../../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;

  // Appearance
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;

  // State
  disabled?: boolean;
  loading?: boolean;

  // Icons
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;

  // Style override
  style?: ViewStyle;

  // Accessibility
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps): JSX.Element {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;

  // Get button styles based on variant
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    const baseContainer: ViewStyle = {
      borderRadius: radius.md,
      ...shadows.sm,
    };

    switch (variant) {
      case 'primary':
        return {
          container: {
            ...baseContainer,
            backgroundColor: isDisabled
              ? colors.neutral[300]
              : colors.primary[500],
          },
          text: {
            color: isDisabled
              ? colors.neutral[500]
              : colors.neutral[900],
          },
        };

      case 'secondary':
        return {
          container: {
            ...baseContainer,
            backgroundColor: isDisabled
              ? colors.neutral[200]
              : colors.secondary[500],
          },
          text: {
            color: isDisabled
              ? colors.neutral[500]
              : colors.neutral[0],
          },
        };

      case 'outline':
        return {
          container: {
            ...baseContainer,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderColor: isDisabled
              ? colors.neutral[300]
              : colors.primary[500],
            ...shadows.none,
          },
          text: {
            color: isDisabled
              ? colors.neutral[400]
              : colors.primary[600],
          },
        };

      case 'ghost':
        return {
          container: {
            ...baseContainer,
            backgroundColor: 'transparent',
            ...shadows.none,
          },
          text: {
            color: isDisabled
              ? colors.neutral[400]
              : colors.primary[600],
          },
        };

      case 'danger':
        return {
          container: {
            ...baseContainer,
            backgroundColor: isDisabled
              ? colors.neutral[300]
              : colors.semantic.error,
          },
          text: {
            color: isDisabled
              ? colors.neutral[500]
              : colors.neutral[0],
          },
        };

      default:
        return {
          container: baseContainer,
          text: {},
        };
    }
  };

  // Get size styles
  const getSizeStyles = (): { container: ViewStyle; text: 'button' | 'buttonSmall' } => {
    switch (size) {
      case 'small':
        return {
          container: {
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
            minHeight: 36,
          },
          text: 'buttonSmall',
        };

      case 'medium':
        return {
          container: {
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            minHeight: layout.minTouchTarget, // 48px - accessibility requirement
          },
          text: 'button',
        };

      case 'large':
        return {
          container: {
            paddingHorizontal: spacing[8],
            paddingVertical: spacing[4],
            minHeight: 56,
          },
          text: 'button',
        };

      default:
        return {
          container: {
            minHeight: layout.minTouchTarget,
          },
          text: 'button',
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        variantStyles.container,
        sizeStyles.container,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.text.color}
        />
      ) : (
        <>
          {leftIcon && <>{leftIcon}</>}
          <Text
            variant={sizeStyles.text}
            style={[
              variantStyles.text,
              leftIcon ? { marginLeft: spacing[2] } : undefined,
              rightIcon ? { marginRight: spacing[2] } : undefined,
            ]}
          >
            {children}
          </Text>
          {rightIcon && <>{rightIcon}</>}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
});
