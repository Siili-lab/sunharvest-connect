import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getMarketPrices, getMarketIntelligence, MarketPrice, MarketIntelligence } from '../services/api';

// Mock data for dashboard stats
const MOCK_FARMER_STATS = {
  revenue: 125000,
  revenueChange: 15.7,
  activeListings: 8,
  listingViews: 234,
  pendingOffers: 5,
  rating: 4.8,
  totalSales: 34,
};

const MOCK_BUYER_STATS = {
  totalSpent: 89000,
  spentChange: 8.2,
  activeOrders: 3,
  completedOrders: 12,
  savedSuppliers: 7,
  rating: 4.9,
};

const MOCK_TRANSPORTER_STATS = {
  earnings: 45000,
  earningsChange: 12.3,
  completedDeliveries: 28,
  activeDeliveries: 2,
  availableJobs: 15,
  rating: 4.7,
  onTimeRate: 96,
};

const AI_INSIGHTS = {
  farmer: [
    { type: 'price_alert', icon: 'trending-up', color: '#2E7D32', title: 'Peak Season Alert', message: 'Tomato prices up 18% this week. List more inventory now!', action: 'Create Listing' },
    { type: 'tip', icon: 'bulb', color: '#F57C00', title: 'Quality Tip', message: 'Grade A tomatoes selling 40% faster than Grade B', action: null },
  ],
  buyer: [
    { type: 'deal', icon: 'pricetag', color: '#2E7D32', title: 'Best Deals', message: '15 new Premium grade listings in your area', action: 'View Market' },
    { type: 'restock', icon: 'alert-circle', color: '#F57C00', title: 'Restock Reminder', message: 'Your usual tomato order is due in 3 days', action: 'Reorder' },
  ],
  transporter: [
    { type: 'jobs', icon: 'car', color: '#2E7D32', title: 'High Demand', message: '15 delivery jobs available in Kiambu today', action: 'View Jobs' },
    { type: 'bonus', icon: 'star', color: '#F57C00', title: 'Bonus Opportunity', message: 'Complete 5 more deliveries for KSh 500 bonus', action: null },
  ],
};

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [intelligence, setIntelligence] = useState<MarketIntelligence | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isFarmer = user?.userType === 'farmer';
  const isBuyer = user?.userType === 'buyer';
  const isTransporter = user?.userType === 'transporter';

  // Build dynamic insights from REAL AI market data
  const buildInsights = () => {
    if (!intelligence) return AI_INSIGHTS[user?.userType || 'farmer'];

    const dynamicInsights = [];

    // Find the best performing crop (highest positive change)
    const risingCrops = intelligence.crops
      .filter(c => c.trend === 'rising')
      .sort((a, b) => b.changePercent - a.changePercent);

    // Find crops with high demand (hot crops)
    const hotCrop = intelligence.hotCrops[0];

    if (isFarmer) {
      // FARMER INSIGHT 1: Peak season alert for best rising crop
      if (risingCrops.length > 0) {
        const best = risingCrops[0];
        dynamicInsights.push({
          type: 'peak',
          icon: 'trending-up',
          color: '#4CAF50',
          title: 'Peak Season Alert',
          message: `${best.crop.charAt(0).toUpperCase() + best.crop.slice(1)} prices up ${best.changePercent}% this week. List now at KSh ${best.price}/kg!`,
          action: 'Create Listing',
          actionData: { crop: best.crop, price: best.price },
        });
      }

      // FARMER INSIGHT 2: High demand opportunity
      if (hotCrop) {
        const hotCropData = intelligence.crops.find(c => c.crop.toLowerCase() === hotCrop.toLowerCase());
        dynamicInsights.push({
          type: 'demand',
          icon: 'flame',
          color: '#F44336',
          title: 'High Demand',
          message: `${hotCrop} selling fast - avg ${hotCropData?.avgDaysToSell || 3} days to sell. Buyers are actively searching!`,
          action: 'Create Listing',
          actionData: { crop: hotCrop.toLowerCase() },
        });
      }

      // FARMER INSIGHT 3: Price tip based on market average
      if (intelligence.crops.length > 0) {
        const topCrop = intelligence.crops[0];
        dynamicInsights.push({
          type: 'tip',
          icon: 'bulb',
          color: '#FF9800',
          title: 'Pricing Tip',
          message: `Grade A ${topCrop.crop} averages KSh ${topCrop.price}/kg. Premium grade can fetch 25% more.`,
          action: 'See Prices',
          actionData: null,
        });
      }
    } else if (isBuyer) {
      // BUYER INSIGHT 1: Best deals (falling prices)
      const fallingCrops = intelligence.crops
        .filter(c => c.trend === 'falling')
        .sort((a, b) => a.changePercent - b.changePercent);

      if (fallingCrops.length > 0) {
        const deal = fallingCrops[0];
        dynamicInsights.push({
          type: 'deal',
          icon: 'pricetag',
          color: '#4CAF50',
          title: 'Best Deal',
          message: `${deal.crop.charAt(0).toUpperCase() + deal.crop.slice(1)} prices down ${Math.abs(deal.changePercent)}% - good time to buy at KSh ${deal.price}/kg`,
          action: 'View Market',
          actionData: null,
        });
      }

      // BUYER INSIGHT 2: Stock up warning for rising prices
      if (risingCrops.length > 0) {
        const rising = risingCrops[0];
        dynamicInsights.push({
          type: 'alert',
          icon: 'alert-circle',
          color: '#F44336',
          title: 'Price Rising',
          message: `${rising.crop.charAt(0).toUpperCase() + rising.crop.slice(1)} up ${rising.changePercent}% - stock up before prices increase more`,
          action: 'View Market',
          actionData: null,
        });
      }
    } else {
      // TRANSPORTER insights
      dynamicInsights.push(...AI_INSIGHTS.transporter);
    }

    return dynamicInsights.slice(0, 2); // Show max 2 insights
  };

  const insights = buildInsights();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pricesData, intelligenceData] = await Promise.all([
        getMarketPrices(),
        getMarketIntelligence(user?.location),
      ]);
      setPrices(pricesData.slice(0, 4));
      setIntelligence(intelligenceData);
    } catch {
      setPrices([
        { crop: 'tomato', wholesale: 100, retail: 150, unit: 'kg', currency: 'KSh' },
        { crop: 'potato', wholesale: 80, retail: 120, unit: 'kg', currency: 'KSh' },
        { crop: 'onion', wholesale: 90, retail: 130, unit: 'kg', currency: 'KSh' },
        { crop: 'cabbage', wholesale: 60, retail: 90, unit: 'kg', currency: 'KSh' },
      ]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('good_morning');
    if (hour < 17) return t('good_afternoon');
    return t('good_evening');
  };

  const handleInsightAction = (action: string | null, actionData?: { crop?: string; price?: number } | null) => {
    if (!action) return;
    if (action === 'Create Listing') {
      // Navigate to sell with pre-selected crop if available
      if (actionData?.crop) {
        router.push({ pathname: '/sell', params: { crop: actionData.crop, suggestedPrice: actionData.price?.toString() } });
      } else {
        router.push('/sell');
      }
    }
    else if (action === 'View Market') router.push('/market');
    else if (action === 'View Jobs') router.push('/deliveries');
    else if (action === 'Reorder') router.push('/market');
    else if (action === 'View Details' || action === 'View Trends' || action === 'See Prices') router.push('/intelligence');
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'User'}</Text>
        </View>
        <TouchableOpacity style={styles.notificationBtn}>
          <Ionicons name="notifications-outline" size={24} color="#333" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        {isFarmer && (
          <>
            <View style={styles.statCardPrimary}>
              <Text style={styles.statLabel}>Total Revenue</Text>
              <Text style={styles.statValueLarge}>KSh {MOCK_FARMER_STATS.revenue.toLocaleString()}</Text>
              <View style={styles.statChange}>
                <Ionicons name="trending-up" size={14} color="#4CAF50" />
                <Text style={styles.statChangeText}>+{MOCK_FARMER_STATS.revenueChange}% this month</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{MOCK_FARMER_STATS.activeListings}</Text>
                <Text style={styles.statLabel}>Listings</Text>
                <Text style={styles.statSub}>{MOCK_FARMER_STATS.listingViews} views</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{MOCK_FARMER_STATS.pendingOffers}</Text>
                <Text style={styles.statLabel}>Offers</Text>
                <Text style={styles.statSubHighlight}>pending</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{MOCK_FARMER_STATS.rating}</Text>
                <Text style={styles.statLabel}>Rating</Text>
                <Text style={styles.statSub}>{MOCK_FARMER_STATS.totalSales} sales</Text>
              </View>
            </View>
          </>
        )}

        {isBuyer && (
          <>
            <View style={styles.statCardPrimary}>
              <Text style={styles.statLabel}>Total Spent</Text>
              <Text style={styles.statValueLarge}>KSh {MOCK_BUYER_STATS.totalSpent.toLocaleString()}</Text>
              <View style={styles.statChange}>
                <Ionicons name="trending-up" size={14} color="#4CAF50" />
                <Text style={styles.statChangeText}>+{MOCK_BUYER_STATS.spentChange}% this month</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{MOCK_BUYER_STATS.activeOrders}</Text>
                <Text style={styles.statLabel}>Active</Text>
                <Text style={styles.statSubHighlight}>orders</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{MOCK_BUYER_STATS.completedOrders}</Text>
                <Text style={styles.statLabel}>Completed</Text>
                <Text style={styles.statSub}>orders</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{MOCK_BUYER_STATS.savedSuppliers}</Text>
                <Text style={styles.statLabel}>Suppliers</Text>
                <Text style={styles.statSub}>saved</Text>
              </View>
            </View>
          </>
        )}

        {isTransporter && (
          <>
            <View style={styles.statCardPrimary}>
              <Text style={styles.statLabel}>Total Earnings</Text>
              <Text style={styles.statValueLarge}>KSh {MOCK_TRANSPORTER_STATS.earnings.toLocaleString()}</Text>
              <View style={styles.statChange}>
                <Ionicons name="trending-up" size={14} color="#4CAF50" />
                <Text style={styles.statChangeText}>+{MOCK_TRANSPORTER_STATS.earningsChange}% this month</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{MOCK_TRANSPORTER_STATS.availableJobs}</Text>
                <Text style={styles.statLabel}>Available</Text>
                <Text style={styles.statSubHighlight}>jobs</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{MOCK_TRANSPORTER_STATS.activeDeliveries}</Text>
                <Text style={styles.statLabel}>Active</Text>
                <Text style={styles.statSub}>deliveries</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{MOCK_TRANSPORTER_STATS.onTimeRate}%</Text>
                <Text style={styles.statLabel}>On-Time</Text>
                <Text style={styles.statSub}>rate</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* AI Insights */}
      {(isFarmer || isBuyer) && (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.aiTitleRow}>
            <View style={styles.aiBadgeSmall}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
            <Text style={styles.sectionTitleNoMargin}>{t('ai_insights')}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/intelligence')} style={styles.seeAllBtn}>
            <Text style={styles.seeAll}>See all</Text>
            <Ionicons name="chevron-forward" size={14} color="#2E7D32" />
          </TouchableOpacity>
        </View>
        {insights.map((insight: any, index) => (
          <TouchableOpacity
            key={index}
            style={styles.insightCard}
            onPress={() => handleInsightAction(insight.action, insight.actionData)}
            activeOpacity={insight.action ? 0.7 : 1}
          >
            <View style={[styles.insightIcon, { backgroundColor: insight.color + '20' }]}>
              <Ionicons name={insight.icon as any} size={20} color={insight.color} />
            </View>
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightMessage}>{insight.message}</Text>
            </View>
            {insight.action && (
              <View style={styles.insightAction}>
                <Text style={styles.insightActionText}>{insight.action}</Text>
                <Ionicons name="chevron-forward" size={16} color="#2E7D32" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('quick_actions')}</Text>
        <View style={styles.quickActions}>
          {isFarmer && (
            <>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/sell')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="add-circle" size={24} color="#2E7D32" />
                </View>
                <Text style={styles.quickActionText}>{t('sell')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/grade')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="camera" size={24} color="#1976D2" />
                </View>
                <Text style={styles.quickActionText}>AI Grade</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/intelligence')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="analytics" size={24} color="#9C27B0" />
                </View>
                <Text style={styles.quickActionText}>{t('ai_prices')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/orders')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="receipt" size={24} color="#F57C00" />
                </View>
                <Text style={styles.quickActionText}>{t('orders')}</Text>
              </TouchableOpacity>
            </>
          )}
          {isBuyer && (
            <>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/market')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="search" size={24} color="#2E7D32" />
                </View>
                <Text style={styles.quickActionText}>{t('browse_market')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/intelligence')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="analytics" size={24} color="#9C27B0" />
                </View>
                <Text style={styles.quickActionText}>{t('ai_prices')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/orders')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="receipt" size={24} color="#F57C00" />
                </View>
                <Text style={styles.quickActionText}>{t('orders')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/sacco')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="wallet" size={24} color="#1976D2" />
                </View>
                <Text style={styles.quickActionText}>{t('sacco')}</Text>
              </TouchableOpacity>
            </>
          )}
          {isTransporter && (
            <>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/deliveries')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="car" size={24} color="#2E7D32" />
                </View>
                <Text style={styles.quickActionText}>{t('available_jobs')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/orders')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="map" size={24} color="#F57C00" />
                </View>
                <Text style={styles.quickActionText}>{t('active')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/sacco')}>
                <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="wallet" size={24} color="#1976D2" />
                </View>
                <Text style={styles.quickActionText}>{t('sacco')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Market Prices - with real trend data */}
      {(isFarmer || isBuyer) && intelligence && intelligence.crops.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleNoMargin}>{t('market_prices')}</Text>
            <TouchableOpacity onPress={() => router.push('/intelligence')} style={styles.seeAllBtn}>
              <Text style={styles.seeAll}>{t('view_trends')}</Text>
              <Ionicons name="chevron-forward" size={14} color="#2E7D32" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {intelligence.crops.slice(0, 5).map((crop, index) => {
              const trendIcon = crop.trend === 'rising' ? 'trending-up' : crop.trend === 'falling' ? 'trending-down' : 'remove';
              const trendColor = crop.trend === 'rising' ? '#4CAF50' : crop.trend === 'falling' ? '#F44336' : '#9E9E9E';
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.priceCard}
                  onPress={() => router.push('/intelligence')}
                >
                  <Text style={styles.priceCrop}>{crop.crop}</Text>
                  <Text style={styles.priceValue}>KSh {crop.price}</Text>
                  <Text style={styles.priceUnit}>{t('per_kg')}</Text>
                  <View style={styles.priceChange}>
                    <Ionicons name={trendIcon} size={12} color={trendColor} />
                    <Text style={[styles.priceChangeText, { color: trendColor }]}>
                      {crop.changePercent > 0 ? '+' : ''}{crop.changePercent}%
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
  },
  notificationBtn: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCardPrimary: {
    backgroundColor: '#2E7D32',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  statValueLarge: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginVertical: 4,
  },
  statChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statChangeText: {
    fontSize: 13,
    color: '#A5D6A7',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statSub: {
    fontSize: 10,
    color: '#9E9E9E',
    marginTop: 2,
  },
  statSubHighlight: {
    fontSize: 10,
    color: '#F57C00',
    fontWeight: '600',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionTitleNoMargin: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiBadgeSmall: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  insightMessage: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  insightAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginRight: 10,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  priceCrop: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B5E20',
    marginTop: 4,
  },
  priceUnit: {
    fontSize: 10,
    color: '#9E9E9E',
  },
  priceChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  priceChangeText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
});
