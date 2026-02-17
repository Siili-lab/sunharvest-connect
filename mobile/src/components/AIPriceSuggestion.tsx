import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPricePrediction, PricePrediction } from '../services/api';
import { colors, spacing, radius } from '@/theme';

interface Props {
  crop: string;
  grade: string;
  quantity: number;
  county: string;
  onPriceSelect?: (price: number) => void;
}

export default function AIPriceSuggestion({ crop, grade, quantity, county, onPriceSelect }: Props) {
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!crop || !grade || !quantity || !county) {
      setLoading(false);
      return;
    }

    const fetchPrediction = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getPricePrediction({ crop, grade, quantity, county });
        setPrediction(result);
      } catch (err) {
        console.log('Price prediction error:', err);
        setError('Could not get AI suggestion');
      }
      setLoading(false);
    };

    fetchPrediction();
  }, [crop, grade, quantity, county]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.aiIcon}>AI</Text>
          <Text style={styles.title}>Getting price suggestion...</Text>
        </View>
        <ActivityIndicator size="small" color={colors.primary[800]} />
      </View>
    );
  }

  if (error || !prediction) {
    return null;
  }

  const trendIcon = prediction.trend === 'rising' ? '↑' : prediction.trend === 'falling' ? '↓' : '→';
  const trendColor = prediction.trend === 'rising' ? colors.semantic.success : prediction.trend === 'falling' ? colors.semantic.error : colors.neutral[500];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.aiBadge}>
          <Text style={styles.aiIcon}>AI</Text>
        </View>
        <Text style={styles.title}>Price Suggestion</Text>
        <Text style={[styles.confidence, { opacity: prediction.confidence }]}>
          {Math.round(prediction.confidence * 100)}% confident
        </Text>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.currency}>KSh</Text>
        <Text style={styles.price}>{prediction.recommendedPrice}</Text>
        <Text style={styles.unit}>/{prediction.unit}</Text>
      </View>

      {onPriceSelect && (
        <TouchableOpacity
          style={styles.usePriceBtn}
          onPress={() => onPriceSelect(prediction.recommendedPrice)}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.background.primary} />
          <Text style={styles.usePriceText}>Use this price</Text>
        </TouchableOpacity>
      )}

      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>Fair range:</Text>
        <Text style={styles.rangeValue}>
          KSh {prediction.priceRangeMin} - {prediction.priceRangeMax}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Market avg</Text>
          <Text style={styles.statValue}>KSh {prediction.marketAverage}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Trend</Text>
          <Text style={[styles.statValue, { color: trendColor }]}>
            {trendIcon} {prediction.trend}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Demand</Text>
          <Text style={styles.statValue}>{prediction.demandLevel}</Text>
        </View>
      </View>

      {prediction.reasoning.length > 0 && (
        <View style={styles.reasoningContainer}>
          {prediction.reasoning.map((reason, idx) => (
            <Text key={idx} style={styles.reasoning}>• {reason}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  aiBadge: {
    backgroundColor: colors.primary[800],
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
    color: colors.primary[900],
    flex: 1,
  },
  confidence: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing[2],
  },
  currency: {
    fontSize: 16,
    color: colors.neutral[800],
    marginRight: spacing[1],
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary[900],
  },
  unit: {
    fontSize: 16,
    color: colors.neutral[600],
  },
  usePriceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[800],
    borderRadius: radius.md,
    paddingVertical: spacing[2.5],
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  usePriceText: {
    color: colors.background.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  rangeLabel: {
    fontSize: 13,
    color: colors.neutral[600],
  },
  rangeValue: {
    fontSize: 13,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.primary[100],
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: colors.neutral[600],
    marginBottom: spacing[0.5],
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  reasoningContainer: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.primary[100],
  },
  reasoning: {
    fontSize: 12,
    color: colors.neutral[600],
    marginBottom: spacing[1],
  },
});
