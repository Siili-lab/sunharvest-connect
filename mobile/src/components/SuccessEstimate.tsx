import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getSuccessPrediction, SuccessPrediction } from '../services/api';

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
        <ActivityIndicator size="small" color="#2E7D32" />
      </View>
    );
  }

  if (!prediction) return null;

  const categoryColors = {
    fast: '#4CAF50',
    normal: '#FF9800',
    slow: '#F44336',
    unlikely: '#9E9E9E',
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
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  aiBadge: {
    backgroundColor: '#FF9800',
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
    color: '#E65100',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  daysContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    minWidth: 70,
  },
  daysNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E65100',
  },
  daysLabel: {
    fontSize: 12,
    color: '#666',
  },
  detailsContainer: {
    flex: 1,
    gap: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  probability: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  range: {
    fontSize: 12,
    color: '#666',
  },
  factorsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFE082',
  },
  factor: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  suggestion: {
    fontSize: 12,
    color: '#BF360C',
    marginBottom: 2,
  },
  // Compact mode
  compactContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  compactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  compactText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
