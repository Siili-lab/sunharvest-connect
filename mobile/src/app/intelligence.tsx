import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { getMarketIntelligence, getMarketTrends, MarketIntelligence, MarketTrend } from '../services/api';

export default function IntelligenceScreen() {
  const [intelligence, setIntelligence] = useState<MarketIntelligence | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [cropTrend, setCropTrend] = useState<MarketTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const data = await getMarketIntelligence();
      setIntelligence(data);
    } catch (err) {
      console.log('Intelligence fetch error:', err);
    }
    setLoading(false);
  };

  const fetchCropTrend = async (crop: string) => {
    try {
      const data = await getMarketTrends(crop);
      setCropTrend(data);
    } catch (err) {
      console.log('Trend fetch error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCrop) {
      fetchCropTrend(selectedCrop);
    }
  }, [selectedCrop]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    if (selectedCrop) {
      await fetchCropTrend(selectedCrop);
    }
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading market intelligence...</Text>
      </View>
    );
  }

  if (!intelligence) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Could not load market data</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sentimentColors = {
    bullish: '#4CAF50',
    bearish: '#F44336',
    neutral: '#FF9800',
  };

  const sentimentLabels = {
    bullish: 'Strong Market',
    bearish: 'Weak Market',
    neutral: 'Stable Market',
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.aiBadge}>
          <Text style={styles.aiText}>AI</Text>
        </View>
        <Text style={styles.headerTitle}>Market Intelligence</Text>
      </View>

      {/* Market Summary */}
      <View style={styles.summaryCard}>
        <View style={[styles.sentimentBadge, { backgroundColor: sentimentColors[intelligence.summary.marketSentiment] }]}>
          <Text style={styles.sentimentText}>
            {sentimentLabels[intelligence.summary.marketSentiment]}
          </Text>
        </View>

        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryNumber, { color: '#4CAF50' }]}>
              {intelligence.summary.risingCrops}
            </Text>
            <Text style={styles.summaryLabel}>Rising</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryNumber, { color: '#9E9E9E' }]}>
              {intelligence.summary.stableCrops}
            </Text>
            <Text style={styles.summaryLabel}>Stable</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryNumber, { color: '#F44336' }]}>
              {intelligence.summary.fallingCrops}
            </Text>
            <Text style={styles.summaryLabel}>Falling</Text>
          </View>
        </View>
      </View>

      {/* Insights */}
      {intelligence.insights.length > 0 && (
        <View style={styles.insightsCard}>
          <Text style={styles.sectionTitle}>AI Insights</Text>
          {intelligence.insights.map((insight, idx) => (
            <View key={idx} style={styles.insightRow}>
              <Text style={styles.insightIcon}>💡</Text>
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Hot Crops */}
      {intelligence.hotCrops.length > 0 && (
        <View style={styles.hotCropsCard}>
          <Text style={styles.sectionTitle}>High Demand</Text>
          <View style={styles.hotCropsList}>
            {intelligence.hotCrops.map((crop, idx) => (
              <View key={idx} style={styles.hotCropBadge}>
                <Text style={styles.hotCropText}>{crop}</Text>
                <Text style={styles.hotCropArrow}>↑</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Crop Prices */}
      <View style={styles.cropsCard}>
        <Text style={styles.sectionTitle}>Today's Prices</Text>
        {intelligence.crops.map((crop, idx) => {
          const trendIcon = crop.trend === 'rising' ? '↑' : crop.trend === 'falling' ? '↓' : '→';
          const trendColor = crop.trend === 'rising' ? '#4CAF50' : crop.trend === 'falling' ? '#F44336' : '#9E9E9E';
          const isSelected = selectedCrop === crop.crop;

          return (
            <TouchableOpacity
              key={idx}
              style={[styles.cropRow, isSelected && styles.cropRowSelected]}
              onPress={() => setSelectedCrop(isSelected ? null : crop.crop)}
            >
              <View style={styles.cropInfo}>
                <Text style={styles.cropName}>
                  {crop.crop.charAt(0).toUpperCase() + crop.crop.slice(1)}
                </Text>
                <Text style={styles.cropDays}>Avg {crop.avgDaysToSell} days to sell</Text>
              </View>
              <View style={styles.cropPriceInfo}>
                <Text style={styles.cropPrice}>KSh {crop.price}</Text>
                <Text style={[styles.cropTrend, { color: trendColor }]}>
                  {trendIcon} {crop.changePercent > 0 ? '+' : ''}{crop.changePercent}%
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Crop Trend Details */}
      {selectedCrop && cropTrend && (
        <View style={styles.trendCard}>
          <Text style={styles.sectionTitle}>
            {selectedCrop.charAt(0).toUpperCase() + selectedCrop.slice(1)} Trend
          </Text>

          <View style={styles.trendStats}>
            <View style={styles.trendStat}>
              <Text style={styles.trendLabel}>Now</Text>
              <Text style={styles.trendValue}>KSh {cropTrend.currentPrice}</Text>
            </View>
            <View style={styles.trendStat}>
              <Text style={styles.trendLabel}>Week Ago</Text>
              <Text style={styles.trendValue}>KSh {cropTrend.weekAgo}</Text>
            </View>
            <View style={styles.trendStat}>
              <Text style={styles.trendLabel}>Month Ago</Text>
              <Text style={styles.trendValue}>KSh {cropTrend.monthAgo}</Text>
            </View>
          </View>

          <View style={styles.forecastSection}>
            <Text style={styles.forecastTitle}>7-Day Forecast</Text>
            <View style={styles.forecastRow}>
              {cropTrend.forecast.slice(0, 7).map((day, idx) => (
                <View key={idx} style={styles.forecastDay}>
                  <Text style={styles.forecastDate}>
                    {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                  </Text>
                  <Text style={styles.forecastPrice}>{day.price}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.recommendationBox}>
            <Text style={styles.recommendationLabel}>Best time to sell:</Text>
            <Text style={styles.recommendationValue}>
              {cropTrend.bestTimeToSell === 'now' ? 'Now - prices may drop' :
               cropTrend.bestTimeToSell === 'wait' ? 'Wait - prices rising' : 'Anytime - stable market'}
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.lastUpdated}>
        Last updated: {new Date(intelligence.lastUpdated).toLocaleTimeString()}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  errorText: {
    color: '#666',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  aiBadge: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B5E20',
  },
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sentimentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  sentimentText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  insightsCard: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  insightIcon: {
    fontSize: 14,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#1565C0',
  },
  hotCropsCard: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  hotCropsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hotCropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  hotCropText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 13,
  },
  hotCropArrow: {
    color: '#fff',
    fontWeight: '700',
  },
  cropsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cropRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cropRowSelected: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cropInfo: {
    flex: 1,
  },
  cropName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  cropDays: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cropPriceInfo: {
    alignItems: 'flex-end',
  },
  cropPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  cropTrend: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  trendCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  trendStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  trendStat: {
    alignItems: 'center',
  },
  trendLabel: {
    fontSize: 12,
    color: '#666',
  },
  trendValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  forecastSection: {
    marginBottom: 16,
  },
  forecastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  forecastDay: {
    alignItems: 'center',
  },
  forecastDate: {
    fontSize: 10,
    color: '#666',
  },
  forecastPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 2,
  },
  recommendationBox: {
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendationLabel: {
    fontSize: 13,
    color: '#666',
  },
  recommendationValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
  },
  lastUpdated: {
    textAlign: 'center',
    fontSize: 11,
    color: '#999',
    marginBottom: 24,
  },
});
