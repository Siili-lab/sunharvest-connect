import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { Text } from '../components/primitives/Text';
import { Button } from '../components/primitives/Button';
import { getMarketIntelligence, getMarketTrends, MarketIntelligence, MarketTrend } from '../services/api';
import { colors, spacing, radius, shadows } from '@/theme';

export default function IntelligenceScreen() {
  const { t } = useLanguage();
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
        <ActivityIndicator size="large" color={colors.primary[800]} />
        <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
          {t('loading_intelligence')}
        </Text>
      </View>
    );
  }

  if (!intelligence) {
    return (
      <View style={styles.errorContainer}>
        <Text variant="body" color="secondary" style={{ marginBottom: spacing[4] }}>
          {t('network_error')}
        </Text>
        <Button variant="primary" onPress={fetchData} accessibilityLabel={t('retry')}>
          {t('retry')}
        </Button>
      </View>
    );
  }

  const sentimentColors: Record<string, string> = {
    bullish: colors.semantic.success,
    bearish: colors.semantic.error,
    neutral: colors.semantic.warning,
  };

  const sentimentLabels: Record<string, string> = {
    bullish: t('strong_market'),
    bearish: t('weak_market'),
    neutral: t('stable_market'),
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.aiBadge}>
          <Text variant="label" style={{ color: colors.neutral[0], fontWeight: '700' }}>AI</Text>
        </View>
        <Text variant="heading3" style={{ color: colors.primary[900] }}>
          {t('market_intelligence')}
        </Text>
      </View>

      {/* Market Summary */}
      <View style={styles.summaryCard}>
        <View style={[styles.sentimentBadge, { backgroundColor: sentimentColors[intelligence.summary.marketSentiment] }]}>
          <Text variant="bodySmall" style={{ color: colors.neutral[0], fontWeight: '600' }}>
            {sentimentLabels[intelligence.summary.marketSentiment]}
          </Text>
        </View>

        <View style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text variant="heading1" style={{ color: colors.semantic.success }}>
              {intelligence.summary.risingCrops}
            </Text>
            <Text variant="caption" color="secondary">{t('rising')}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text variant="heading1" style={{ color: colors.neutral[500] }}>
              {intelligence.summary.stableCrops}
            </Text>
            <Text variant="caption" color="secondary">{t('stable')}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text variant="heading1" style={{ color: colors.semantic.error }}>
              {intelligence.summary.fallingCrops}
            </Text>
            <Text variant="caption" color="secondary">{t('falling')}</Text>
          </View>
        </View>
      </View>

      {/* Insights */}
      {intelligence.insights.length > 0 && (
        <View style={styles.insightsCard}>
          <Text variant="heading4" style={{ marginBottom: spacing[3] }}>{t('ai_insights_label')}</Text>
          {intelligence.insights.map((insight, idx) => (
            <View key={idx} style={styles.insightRow}>
              <Text variant="bodySmall">💡</Text>
              <Text variant="bodySmall" style={{ flex: 1, color: colors.semantic.info }}>
                {insight}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Hot Crops */}
      {intelligence.hotCrops.length > 0 && (
        <View style={styles.hotCropsCard}>
          <Text variant="heading4" style={{ marginBottom: spacing[3] }}>{t('high_demand')}</Text>
          <View style={styles.hotCropsList}>
            {intelligence.hotCrops.map((crop, idx) => (
              <View key={idx} style={styles.hotCropBadge} accessibilityLabel={`${crop} ${t('high_demand')}`}>
                <Text variant="caption" style={{ color: colors.neutral[0], fontWeight: '500' }}>{crop}</Text>
                <Text variant="caption" style={{ color: colors.neutral[0], fontWeight: '700' }}>↑</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Crop Prices */}
      <View style={styles.cropsCard}>
        <Text variant="heading4" style={{ marginBottom: spacing[3] }}>{t('todays_prices')}</Text>
        {intelligence.crops.map((crop, idx) => {
          const trendIcon = crop.trend === 'rising' ? '↑' : crop.trend === 'falling' ? '↓' : '→';
          const trendColor = crop.trend === 'rising' ? colors.semantic.success : crop.trend === 'falling' ? colors.semantic.error : colors.neutral[500];
          const isSelected = selectedCrop === crop.crop;

          return (
            <TouchableOpacity
              key={idx}
              style={[styles.cropRow, isSelected && styles.cropRowSelected]}
              onPress={() => setSelectedCrop(isSelected ? null : crop.crop)}
              accessibilityLabel={`${crop.crop} KSh ${crop.price} ${crop.trend}`}
              accessibilityRole="button"
            >
              <View style={styles.cropInfo}>
                <Text variant="body" style={{ fontWeight: '600' }}>
                  {crop.crop.charAt(0).toUpperCase() + crop.crop.slice(1)}
                </Text>
                <Text variant="caption" color="secondary">
                  Avg {crop.avgDaysToSell} days to sell
                </Text>
              </View>
              <View style={styles.cropPriceInfo}>
                <Text variant="heading4">KSh {crop.price}</Text>
                <Text variant="caption" style={{ color: trendColor, fontWeight: '500', marginTop: spacing[0.5] }}>
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
          <Text variant="heading4" style={{ marginBottom: spacing[3] }}>
            {selectedCrop.charAt(0).toUpperCase() + selectedCrop.slice(1)} {t('price_trends')}
          </Text>

          <View style={styles.trendStats}>
            <View style={styles.trendStat}>
              <Text variant="caption" color="secondary">{t('now')}</Text>
              <Text variant="heading4" style={{ marginTop: spacing[1] }}>KSh {cropTrend.currentPrice}</Text>
            </View>
            <View style={styles.trendStat}>
              <Text variant="caption" color="secondary">{t('week_ago')}</Text>
              <Text variant="heading4" style={{ marginTop: spacing[1] }}>KSh {cropTrend.weekAgo}</Text>
            </View>
            <View style={styles.trendStat}>
              <Text variant="caption" color="secondary">{t('month_ago')}</Text>
              <Text variant="heading4" style={{ marginTop: spacing[1] }}>KSh {cropTrend.monthAgo}</Text>
            </View>
          </View>

          <View style={styles.forecastSection}>
            <Text variant="label" style={{ marginBottom: spacing[2] }}>{t('seven_day_forecast')}</Text>
            <View style={styles.forecastRow}>
              {cropTrend.forecast.slice(0, 7).map((day, idx) => (
                <View key={idx} style={styles.forecastDay}>
                  <Text variant="caption" color="secondary" style={{ fontSize: 10 }}>
                    {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                  </Text>
                  <Text variant="caption" style={{ color: colors.primary[800], fontWeight: '600', marginTop: spacing[0.5] }}>
                    {day.price}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.recommendationBox}>
            <Text variant="caption" color="secondary">{t('best_time_sell')}:</Text>
            <Text variant="caption" style={{ fontWeight: '600', color: colors.accent[900] }}>
              {cropTrend.bestTimeToSell === 'now' ? 'Now - prices may drop' :
               cropTrend.bestTimeToSell === 'wait' ? 'Wait - prices rising' : 'Anytime - stable market'}
            </Text>
          </View>
        </View>
      )}

      <Text variant="caption" color="secondary" style={styles.lastUpdated}>
        {t('last_updated')}: {new Date(intelligence.lastUpdated).toLocaleTimeString()}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[2.5],
  },
  aiBadge: {
    backgroundColor: colors.primary[800],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  summaryCard: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing[4],
    borderRadius: radius.xl,
    padding: spacing[5],
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  sentimentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    marginBottom: spacing[4],
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    alignItems: 'center',
  },
  insightsCard: {
    backgroundColor: colors.semantic.infoLight,
    marginHorizontal: spacing[4],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  hotCropsCard: {
    backgroundColor: colors.primary[50],
    marginHorizontal: spacing[4],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  hotCropsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  hotCropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.xl,
    gap: spacing[1],
  },
  cropsCard: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing[4],
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  cropRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  cropRowSelected: {
    backgroundColor: colors.primary[50],
    marginHorizontal: -spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
  },
  cropInfo: {
    flex: 1,
  },
  cropPriceInfo: {
    alignItems: 'flex-end',
  },
  trendCard: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing[4],
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  trendStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  trendStat: {
    alignItems: 'center',
  },
  forecastSection: {
    marginBottom: spacing[4],
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  forecastDay: {
    alignItems: 'center',
  },
  recommendationBox: {
    backgroundColor: colors.accent[50],
    padding: spacing[3],
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  lastUpdated: {
    textAlign: 'center',
    marginBottom: spacing[6],
  },
});
