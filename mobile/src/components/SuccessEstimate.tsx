import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getSuccessPrediction, SuccessPrediction } from '../services/api';
import { colors, spacing, radius } from '@/theme';

interface Props {
  crop: string;
  grade: string;
  price: number;
  quantity: number;
  county: string;
  compact?: boolean;
}

export default function SuccessEstimate({ crop, grade, price, quantity, county, compact = false }: Props) {
  const [prediction, setPrediction] = useState<SuccessPrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!crop || !grade || !price || !quantity || !county) {
      setLoading(false);
      return;
    }

    const fetchPrediction = async () => {
      setLoading(true);
      try {
        const result = await getSuccessPrediction({ crop, grade, price, quantity, county });
        setPrediction(result);
      } catch (err) {
        console.log('Success prediction error:', err);
      }
      setLoading(false);
    };

    fetchPrediction();
  }, [crop, grade, price, quantity, county]);

  if (loading) {
    return compact ? null : (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary[800]} />
      </View>
    );
  }

  if (!prediction) return null;

  const categoryColors = {
    fast: colors.semantic.success,
    normal: colors.semantic.warning,
    slow: colors.semantic.error,
    unlikely: colors.neutral[500],
  };

  const categoryLabels = {
    fast: 'Sells Fast',
    normal: 'Normal',
    slow: 'May Take Time',
    unlikely: 'Unlikely',
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.compactBadge, { backgroundColor: categoryColors[prediction.category] }]}>
          <Text style={styles.compactText}>
            ~{prediction.estimatedDays}d
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.aiBadge}>
          <Text style={styles.aiIcon}>AI</Text>
        </View>
        <Text style={styles.title}>Success Estimate</Text>
      </View>

      <View style={styles.mainRow}>
        <View style={styles.daysContainer}>
          <Text style={styles.daysNumber}>{prediction.estimatedDays}</Text>
          <Text style={styles.daysLabel}>days</Text>
        </View>

        <View style={styles.detailsContainer}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColors[prediction.category] }]}>
            <Text style={styles.categoryText}>{categoryLabels[prediction.category]}</Text>
          </View>
          <Text style={styles.probability}>
            {Math.round(prediction.probability * 100)}% likely to sell
          </Text>
          <Text style={styles.range}>
            Range: {prediction.daysRange.min}-{prediction.daysRange.max} days
          </Text>
        </View>
      </View>

      {prediction.factors.length > 0 && (
        <View style={styles.factorsContainer}>
          {prediction.factors.map((factor, idx) => (
            <Text key={idx} style={styles.factor}>• {factor}</Text>
          ))}
        </View>
      )}

      {prediction.suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggestions:</Text>
          {prediction.suggestions.map((suggestion, idx) => (
            <Text key={idx} style={styles.suggestion}>→ {suggestion}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.accent[50],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.accent[200],
  },
  loadingContainer: {
    padding: spacing[4],
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  aiBadge: {
    backgroundColor: colors.semantic.warning,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radius.sm,
  },
  aiIcon: {
    color: colors.neutral[0],
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent[900],
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  daysContainer: {
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    padding: spacing[3],
    borderRadius: radius.lg,
    minWidth: 70,
  },
  daysNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent[900],
  },
  daysLabel: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  detailsContainer: {
    flex: 1,
    gap: spacing[1],
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.lg,
  },
  categoryText: {
    color: colors.neutral[0],
    fontSize: 12,
    fontWeight: '600',
  },
  probability: {
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  range: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  factorsContainer: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.accent[200],
  },
  factor: {
    fontSize: 12,
    color: colors.neutral[600],
    marginBottom: spacing[1],
  },
  suggestionsContainer: {
    marginTop: spacing[2],
    backgroundColor: colors.accent[200],
    padding: spacing[2.5],
    borderRadius: radius.sm,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent[900],
    marginBottom: spacing[1],
  },
  suggestion: {
    fontSize: 12,
    color: colors.semantic.error,
    marginBottom: spacing[0.5],
  },
  // Compact mode
  compactContainer: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
  },
  compactBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  compactText: {
    color: colors.neutral[0],
    fontSize: 11,
    fontWeight: '600',
  },
});
