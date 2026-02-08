import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';
import { colors, spacing, radius, layout, fontSize } from '../../theme/tokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
  // Labels
  label?: string;
  helperText?: string;
  errorText?: string;

  // State
  error?: boolean;
  disabled?: boolean;

  // Icons
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;

  // Styling
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      helperText,
      errorText,
      error = false,
      disabled = false,
      leftIcon,
      rightIcon,
      containerStyle,
      inputStyle,
      onFocus,
      onBlur,
      ...textInputProps
    },
    ref
  ) => {
    const { theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);

    const hasError = error || !!errorText;

    // Handle focus
    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    // Get border color based on state
    const getBorderColor = (): string => {
      if (disabled) return colors.border.light;
      if (hasError) return colors.semantic.error;
      if (isFocused) return colors.primary[500];
      return colors.border.medium;
    };

    // Get background color
    const getBackgroundColor = (): string => {
      if (disabled) return colors.neutral[100];
      return colors.neutral[0];
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {/* Label */}
        {label && (
          <Text
            variant="label"
            color={hasError ? 'error' : 'primary'}
            style={styles.label}
          >
            {label}
          </Text>
        )}

        {/* Input Container */}
        <View
          style={[
            styles.inputContainer,
            {
              borderColor: getBorderColor(),
              backgroundColor: getBackgroundColor(),
            },
            isFocused && styles.inputContainerFocused,
          ]}
        >
          {/* Left Icon */}
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

          {/* Text Input */}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              leftIcon ? styles.inputWithLeftIcon : undefined,
              rightIcon ? styles.inputWithRightIcon : undefined,
              disabled ? styles.inputDisabled : undefined,
              inputStyle,
            ]}
            placeholderTextColor={colors.neutral[400]}
            editable={!disabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            {...textInputProps}
          />

          {/* Right Icon */}
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>

        {/* Helper or Error Text */}
        {(helperText || errorText) && (
          <Text
            variant="caption"
            color={hasError ? 'error' : 'secondary'}
            style={styles.helperText}
          >
            {errorText || helperText}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },

  label: {
    marginBottom: spacing[1],
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    minHeight: layout.minTouchTarget,
  },

  inputContainerFocused: {
    borderWidth: 2,
  },

  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text.primary,
    paddingHorizontal: layout.inputPaddingHorizontal,
    paddingVertical: layout.inputPaddingVertical,
    minHeight: layout.minTouchTarget,
  },

  inputWithLeftIcon: {
    paddingLeft: spacing[2],
  },

  inputWithRightIcon: {
    paddingRight: spacing[2],
  },

  inputDisabled: {
    color: colors.text.disabled,
  },

  iconLeft: {
    paddingLeft: spacing[3],
  },

  iconRight: {
    paddingRight: spacing[3],
  },

  helperText: {
    marginTop: spacing[1],
    marginLeft: spacing[1],
  },
});
