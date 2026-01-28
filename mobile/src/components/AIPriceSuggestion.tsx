import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getPricePrediction, PricePrediction } from '../services/api';

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
        <ActivityIndicator size="small" color="#2E7D32" />
      </View>
    );
  }

  if (error || !prediction) {
    return null;
  }

  const trendIcon = prediction.trend === 'rising' ? '↑' : prediction.trend === 'falling' ? '↓' : '→';
  const trendColor = prediction.trend === 'rising' ? '#4CAF50' : prediction.trend === 'falling' ? '#F44336' : '#9E9E9E';

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
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  aiBadge: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiIcon: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B5E20',
    flex: 1,
  },
  confidence: {
    fontSize: 12,
    color: '#666',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  currency: {
    fontSize: 16,
    color: '#333',
    marginRight: 4,
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1B5E20',
  },
  unit: {
    fontSize: 16,
    color: '#666',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rangeLabel: {
    fontSize: 13,
    color: '#666',
  },
  rangeValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#C8E6C9',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  reasoningContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#C8E6C9',
  },
  reasoning: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
  },
});
