/**
 * Grade Badge Component
 *
 * Displays quality grade with appropriate color coding.
 * Used throughout the app to show produce quality.
 *
 * Usage:
 *   <GradeBadge grade="PREMIUM" />
 *   <GradeBadge grade="GRADE_A" size="large" showLabel />
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text } from '../primitives/Text';
import { Box } from '../primitives/Box';
import { colors, spacing, radius } from '../../theme/tokens';
import { useTranslation } from 'react-i18next';

// ===== Types =====

type QualityGrade = 'PREMIUM' | 'GRADE_A' | 'GRADE_B' | 'REJECT';
type BadgeSize = 'small' | 'medium' | 'large';

interface GradeBadgeProps {
  grade: QualityGrade;
  size?: BadgeSize;
  showLabel?: boolean;
  showConfidence?: boolean;
  confidence?: number;
  style?: ViewStyle;
}

// ===== Grade Configuration =====

const gradeConfig: Record<QualityGrade, {
  label: { en: string; sw: string };
  colors: { main: string; light: string; text: string };
  icon: string;
}> = {
  PREMIUM: {
    label: { en: 'Premium', sw: 'Ubora wa Juu' },
    colors: colors.grade.premium,
    icon: '★',
  },
  GRADE_A: {
    label: { en: 'Grade A', sw: 'Daraja A' },
    colors: colors.grade.gradeA,
    icon: 'A',
  },
  GRADE_B: {
    label: { en: 'Grade B', sw: 'Daraja B' },
    colors: colors.grade.gradeB,
    icon: 'B',
  },
  REJECT: {
    label: { en: 'Reject', sw: 'Imekataliwa' },
    colors: colors.grade.reject,
    icon: '✕',
  },
};

// ===== Component =====

export function GradeBadge({
  grade,
  size = 'medium',
  showLabel = true,
  showConfidence = false,
  confidence,
  style,
}: GradeBadgeProps): JSX.Element {
  const { i18n } = useTranslation();
  const config = gradeConfig[grade];
  const lang = i18n.language === 'sw' ? 'sw' : 'en';

  // Size configurations
  const sizeConfig = {
    small: {
      paddingH: spacing[2],
      paddingV: spacing[1],
      iconSize: 12,
      textVariant: 'caption' as const,
    },
    medium: {
      paddingH: spacing[3],
      paddingV: spacing[1.5],
      iconSize: 16,
      textVariant: 'label' as const,
    },
    large: {
      paddingH: spacing[4],
      paddingV: spacing[2],
      iconSize: 20,
      textVariant: 'button' as const,
    },
  };

  const { paddingH, paddingV, iconSize, textVariant } = sizeConfig[size];

  return (
    <View style={style}>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: config.colors.light,
            paddingHorizontal: paddingH,
            paddingVertical: paddingV,
          },
        ]}
      >
        {/* Icon */}
        <Text
          style={[
            styles.icon,
            {
              color: config.colors.main,
              fontSize: iconSize,
            },
          ]}
        >
          {config.icon}
        </Text>

        {/* Label */}
        {showLabel && (
          <Text
            variant={textVariant}
            style={[
              styles.label,
              { color: config.colors.text },
            ]}
          >
            {config.label[lang]}
          </Text>
        )}
      </View>

      {/* Confidence indicator */}
      {showConfidence && confidence !== undefined && (
        <Text
          variant="caption"
          color="secondary"
          align="center"
          style={styles.confidence}
        >
          {Math.round(confidence * 100)}% confident
        </Text>
      )}
    </View>
  );
}

// ===== Compact Grade Display =====

interface GradeIndicatorProps {
  grade: QualityGrade;
}

export function GradeIndicator({ grade }: GradeIndicatorProps): JSX.Element {
  const config = gradeConfig[grade];

  return (
    <View
      style={[
        styles.indicator,
        { backgroundColor: config.colors.main },
      ]}
    />
  );
}

// ===== Styles =====

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },

  icon: {
    fontWeight: '700',
  },

  label: {
    marginLeft: spacing[1],
    fontWeight: '600',
  },

  confidence: {
    marginTop: spacing[1],
  },

  indicator: {
    width: 12,
    height: 12,
    borderRadius: radius.full,
  },
});
