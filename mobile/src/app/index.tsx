import { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { Text } from '../components/primitives/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../context/NotificationContext';
import { colors, spacing, fontSize, typography, radius, shadows } from '@/theme';
import {
  getMarketPrices, getMarketIntelligence, getUserStats,
  MarketPrice, MarketIntelligence, UserStats,
} from '../services/api';

// Fallback stats when API is unavailable
const FALLBACK_FARMER_STATS: UserStats = {
  role: 'FARMER', name: '', rating: null, totalRatings: 0,
  totalListings: 0, activeListings: 0, totalSold: 0, totalRevenue: 0,
};
const FALLBACK_BUYER_STATS: UserStats = {
  role: 'BUYER', name: '', rating: null, totalRatings: 0,
  totalPurchases: 0, totalSpent: 0, activeOffers: 0,
};
const FALLBACK_TRANSPORTER_STATS: UserStats = {
  role: 'TRANSPORTER', name: '', rating: null, totalRatings: 0,
  totalDeliveries: 0, activeJobs: 0,
};

const AI_INSIGHTS = {
  farmer: [
    { type: 'price_alert', icon: 'trending-up', color: colors.primary[800], title: 'Peak Season Alert', message: 'Tomato prices up 18% this week. List more inventory now!', action: 'Create Listing' },
    { type: 'tip', icon: 'bulb', color: colors.accent[900], title: 'Quality Tip', message: 'Grade A tomatoes selling 40% faster than Grade B', action: null },
  ],
  buyer: [
    { type: 'deal', icon: 'pricetag', color: colors.primary[800], title: 'Best Deals', message: '15 new Premium grade listings in your area', action: 'View Market' },
    { type: 'restock', icon: 'alert-circle', color: colors.accent[900], title: 'Restock Reminder', message: 'Your usual tomato order is due in 3 days', action: 'Reorder' },
  ],
  transporter: [
    { type: 'jobs', icon: 'car', color: colors.primary[800], title: 'High Demand', message: '15 delivery jobs available in Kiambu today', action: 'View Jobs' },
    { type: 'bonus', icon: 'star', color: colors.accent[900], title: 'Bonus Opportunity', message: 'Complete 5 more deliveries for KSh 500 bonus', action: null },
  ],
};

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { unreadCount } = useNotifications();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [intelligence, setIntelligence] = useState<MarketIntelligence | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
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
          color: colors.semantic.success,
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
          color: colors.semantic.error,
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
          color: colors.semantic.warning,
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
          color: colors.semantic.success,
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
          color: colors.semantic.error,
          title: 'Price Rising',
          message: `${rising.crop.charAt(0).toUpperCase() + rising.crop.slice(1)} up ${rising.changePercent}% - stock up before prices increase more`,
          action: 'View Market',
          actionData: null,
        });
      }
    } else if (isTransporter) {
      // TRANSPORTER insights — use real stats when available
      const s = stats;
      const activeJobs = s?.activeJobs || 0;
      const totalDeliveries = s?.totalDeliveries || 0;
      dynamicInsights.push({
        type: 'jobs',
        icon: 'car',
        color: colors.primary[800],
        title: 'Delivery Jobs',
        message: activeJobs > 0
          ? `You have ${activeJobs} active delivery job${activeJobs > 1 ? 's' : ''} right now.`
          : 'Check available delivery jobs in your area.',
        action: 'View Jobs',
        actionData: null,
      });
      if (totalDeliveries > 0) {
        dynamicInsights.push({
          type: 'stats',
          icon: 'trophy',
          color: colors.accent[900],
          title: 'Your Progress',
          message: `${totalDeliveries} deliveries completed. Keep building your reputation!`,
          action: null,
          actionData: null,
        });
      }
    }

    return dynamicInsights.slice(0, 2); // Show max 2 insights
  };

  const insights = buildInsights();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Fetch stats and market data in parallel
    const statsPromise = user?.id
      ? getUserStats(user.id).catch(() => null)
      : Promise.resolve(null);

    try {
      const [pricesData, intelligenceData, userStats] = await Promise.all([
        getMarketPrices(),
        getMarketIntelligence(user?.location),
        statsPromise,
      ]);
      setPrices(pricesData.slice(0, 4));
      setIntelligence(intelligenceData);
      if (userStats) setStats(userStats);
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary[800]]} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'User'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={() => router.push('/notifications')}
          accessibilityLabel={t('notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        {isFarmer && (() => {
          const s = stats || FALLBACK_FARMER_STATS;
          const revenue = s.totalRevenue || 0;
          const sold = s.totalSold || 0;
          return (
            <>
              <View style={styles.statCardPrimary}>
                <View style={styles.revenueHeader}>
                  <View>
                    <Text style={styles.revenueLabel}>{t('total_revenue')}</Text>
                    <Text style={styles.revenueValue}>
                      KSh {revenue.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.revenueIconWrap}>
                    <Ionicons name="wallet" size={22} color={colors.primary[800]} />
                  </View>
                </View>
                <View style={styles.revenueDivider} />
                <View style={styles.revenueFooter}>
                  <View style={styles.revenueFooterItem}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.primary[300]} />
                    <Text style={styles.revenueFooterText}>{sold} {t('sold')}</Text>
                  </View>
                  <View style={styles.revenueFooterDot} />
                  <View style={styles.revenueFooterItem}>
                    <Ionicons name="leaf" size={14} color={colors.primary[300]} />
                    <Text style={styles.revenueFooterText}>{s.activeListings || 0} {t('active')}</Text>
                  </View>
                  {(s.rating ?? 0) > 0 && (
                    <>
                      <View style={styles.revenueFooterDot} />
                      <View style={styles.revenueFooterItem}>
                        <Ionicons name="star" size={14} color={colors.accent[400]} />
                        <Text style={styles.revenueFooterText}>{s.rating?.toFixed(1)}</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.primary[50] }]}>
                    <Ionicons name="storefront-outline" size={18} color={colors.primary[700]} />
                  </View>
                  <Text style={styles.statValue}>{s.activeListings || 0}</Text>
                  <Text style={styles.statLabel}>{t('active')}</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.semantic.successLight }]}>
                    <Ionicons name="bag-check-outline" size={18} color={colors.semantic.success} />
                  </View>
                  <Text style={styles.statValue}>{sold}</Text>
                  <Text style={styles.statLabel}>{t('sold')}</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.accent[50] }]}>
                    <Ionicons name="star" size={18} color={colors.accent[600]} />
                  </View>
                  <Text style={styles.statValue}>{s.rating?.toFixed(1) || '-'}</Text>
                  <Text style={styles.statLabel}>{s.totalRatings} {t('reviews')}</Text>
                </View>
              </View>
            </>
          );
        })()}

        {isBuyer && (() => {
          const s = stats || FALLBACK_BUYER_STATS;
          const spent = s.totalSpent || 0;
          return (
            <>
              <View style={styles.statCardPrimary}>
                <View style={styles.revenueHeader}>
                  <View>
                    <Text style={styles.revenueLabel}>{t('total_spent')}</Text>
                    <Text style={styles.revenueValue}>
                      KSh {spent.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.revenueIconWrap}>
                    <Ionicons name="cart" size={22} color={colors.primary[800]} />
                  </View>
                </View>
                <View style={styles.revenueDivider} />
                <View style={styles.revenueFooter}>
                  <View style={styles.revenueFooterItem}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.primary[300]} />
                    <Text style={styles.revenueFooterText}>{s.totalPurchases || 0} {t('purchases')}</Text>
                  </View>
                  <View style={styles.revenueFooterDot} />
                  <View style={styles.revenueFooterItem}>
                    <Ionicons name="time-outline" size={14} color={colors.primary[300]} />
                    <Text style={styles.revenueFooterText}>{s.activeOffers || 0} {t('pending')}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.semantic.warningLight }]}>
                    <Ionicons name="hourglass-outline" size={18} color={colors.semantic.warning} />
                  </View>
                  <Text style={styles.statValue}>{s.activeOffers || 0}</Text>
                  <Text style={styles.statLabel}>{t('offers')}</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.semantic.successLight }]}>
                    <Ionicons name="bag-check-outline" size={18} color={colors.semantic.success} />
                  </View>
                  <Text style={styles.statValue}>{s.totalPurchases || 0}</Text>
                  <Text style={styles.statLabel}>{t('orders')}</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.accent[50] }]}>
                    <Ionicons name="star" size={18} color={colors.accent[600]} />
                  </View>
                  <Text style={styles.statValue}>{s.rating?.toFixed(1) || '-'}</Text>
                  <Text style={styles.statLabel}>{s.totalRatings} {t('reviews')}</Text>
                </View>
              </View>
            </>
          );
        })()}

        {isTransporter && (() => {
          const s = stats || FALLBACK_TRANSPORTER_STATS;
          return (
            <>
              <View style={styles.statCardPrimary}>
                <View style={styles.revenueHeader}>
                  <View>
                    <Text style={styles.revenueLabel}>{t('deliveries')}</Text>
                    <Text style={styles.revenueValue}>{s.totalDeliveries || 0}</Text>
                  </View>
                  <View style={styles.revenueIconWrap}>
                    <Ionicons name="car" size={22} color={colors.primary[800]} />
                  </View>
                </View>
                <View style={styles.revenueDivider} />
                <View style={styles.revenueFooter}>
                  <View style={styles.revenueFooterItem}>
                    <Ionicons name="flash" size={14} color={colors.primary[300]} />
                    <Text style={styles.revenueFooterText}>{s.activeJobs || 0} {t('active_now')}</Text>
                  </View>
                  {(s.rating ?? 0) > 0 && (
                    <>
                      <View style={styles.revenueFooterDot} />
                      <View style={styles.revenueFooterItem}>
                        <Ionicons name="star" size={14} color={colors.accent[400]} />
                        <Text style={styles.revenueFooterText}>{s.rating?.toFixed(1)}</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.semantic.warningLight }]}>
                    <Ionicons name="navigate-outline" size={18} color={colors.semantic.warning} />
                  </View>
                  <Text style={styles.statValue}>{s.activeJobs || 0}</Text>
                  <Text style={styles.statLabel}>{t('active')}</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.semantic.successLight }]}>
                    <Ionicons name="checkmark-done-outline" size={18} color={colors.semantic.success} />
                  </View>
                  <Text style={styles.statValue}>{s.totalDeliveries || 0}</Text>
                  <Text style={styles.statLabel}>{t('done')}</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.accent[50] }]}>
                    <Ionicons name="star" size={18} color={colors.accent[600]} />
                  </View>
                  <Text style={styles.statValue}>{s.rating?.toFixed(1) || '-'}</Text>
                  <Text style={styles.statLabel}>{s.totalRatings} {t('reviews')}</Text>
                </View>
              </View>
            </>
          );
        })()}
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
          <TouchableOpacity
            onPress={() => router.push('/intelligence')}
            style={styles.seeAllBtn}
            accessibilityLabel={`${t('see_all')} ${t('ai_insights')}`}
          >
            <Text style={styles.seeAll}>{t('see_all')}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary[800]} />
          </TouchableOpacity>
        </View>
        {insights.map((insight: any, index) => (
          <TouchableOpacity
            key={index}
            style={styles.insightCard}
            onPress={() => handleInsightAction(insight.action, insight.actionData)}
            activeOpacity={insight.action ? 0.7 : 1}
            accessibilityLabel={`${insight.title}: ${insight.message}`}
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
                <Ionicons name="chevron-forward" size={16} color={colors.primary[800]} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('quick_actions')}</Text>

        {isFarmer && (
          <>
            {/* Primary CTA: Sell — with Grade built in */}
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => router.push('/sell')}
              activeOpacity={0.8}
              accessibilityLabel={t('sell_produce')}
            >
              <View style={styles.primaryActionLeft}>
                <View style={styles.primaryActionIconWrap}>
                  <Ionicons name="add-circle" size={28} color={colors.background.primary} />
                </View>
                <View>
                  <Text style={styles.primaryActionTitle}>{t('sell_produce')}</Text>
                  <Text style={styles.primaryActionSub}>{t('grade_and_list')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.background.primary} />
            </TouchableOpacity>

            {/* Secondary row */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/grade')}
                accessibilityLabel={t('ai_grade')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.accent[50] }]}>
                  <Ionicons name="camera" size={24} color={colors.accent[700]} />
                </View>
                <Text style={styles.quickActionText}>{t('ai_grade')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/intelligence')}
                accessibilityLabel={t('ai_prices')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.accent[100] }]}>
                  <Ionicons name="analytics" size={24} color={colors.accent[500]} />
                </View>
                <Text style={styles.quickActionText}>{t('ai_prices')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/sacco')}
                accessibilityLabel={t('sacco')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.accent[50] }]}>
                  <Ionicons name="wallet" size={24} color={colors.accent[700]} />
                </View>
                <Text style={styles.quickActionText}>{t('sacco')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {isBuyer && (
          <>
            {/* Primary CTA: Browse Market */}
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => router.push('/market')}
              activeOpacity={0.8}
              accessibilityLabel={t('browse_market')}
            >
              <View style={styles.primaryActionLeft}>
                <View style={styles.primaryActionIconWrap}>
                  <Ionicons name="search" size={28} color={colors.background.primary} />
                </View>
                <View>
                  <Text style={styles.primaryActionTitle}>{t('browse_market')}</Text>
                  <Text style={styles.primaryActionSub}>{t('find_fresh_produce')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.background.primary} />
            </TouchableOpacity>

            {/* Secondary row */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/intelligence')}
                accessibilityLabel={t('ai_prices')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.accent[100] }]}>
                  <Ionicons name="analytics" size={24} color={colors.accent[500]} />
                </View>
                <Text style={styles.quickActionText}>{t('ai_prices')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/orders')}
                accessibilityLabel={t('orders')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.accent[200] }]}>
                  <Ionicons name="receipt" size={24} color={colors.semantic.warning} />
                </View>
                <Text style={styles.quickActionText}>{t('orders')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/sacco')}
                accessibilityLabel={t('sacco')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.accent[50] }]}>
                  <Ionicons name="wallet" size={24} color={colors.accent[700]} />
                </View>
                <Text style={styles.quickActionText}>{t('sacco')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {isTransporter && (
          <>
            {/* Primary CTA: Find Jobs */}
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => router.push('/deliveries')}
              activeOpacity={0.8}
              accessibilityLabel={t('available_jobs')}
            >
              <View style={styles.primaryActionLeft}>
                <View style={styles.primaryActionIconWrap}>
                  <Ionicons name="car" size={28} color={colors.background.primary} />
                </View>
                <View>
                  <Text style={styles.primaryActionTitle}>{t('available_jobs')}</Text>
                  <Text style={styles.primaryActionSub}>{t('find_deliveries')}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.background.primary} />
            </TouchableOpacity>

            {/* Secondary row */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/orders')}
                accessibilityLabel={t('active')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.accent[200] }]}>
                  <Ionicons name="map" size={24} color={colors.semantic.warning} />
                </View>
                <Text style={styles.quickActionText}>{t('active')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/sacco')}
                accessibilityLabel={t('sacco')}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: colors.accent[50] }]}>
                  <Ionicons name="wallet" size={24} color={colors.accent[700]} />
                </View>
                <Text style={styles.quickActionText}>{t('sacco')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Market Prices - with real trend data */}
      {(isFarmer || isBuyer) && intelligence && intelligence.crops.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleNoMargin}>{t('market_prices')}</Text>
            <TouchableOpacity
              onPress={() => router.push('/intelligence')}
              style={styles.seeAllBtn}
              accessibilityLabel={`${t('see_all')} ${t('market_prices')}`}
            >
              <Text style={styles.seeAll}>{t('view_trends')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary[800]} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {intelligence.crops.slice(0, 5).map((crop, index) => {
              const trendIcon = crop.trend === 'rising' ? 'trending-up' : crop.trend === 'falling' ? 'trending-down' : 'remove';
              const trendColor = crop.trend === 'rising' ? colors.semantic.success : crop.trend === 'falling' ? colors.semantic.error : colors.neutral[500];
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.priceCard}
                  onPress={() => router.push('/intelligence')}
                  accessibilityLabel={`${crop.crop} KSh ${crop.price} ${t('per_kg')} ${crop.changePercent > 0 ? '+' : ''}${crop.changePercent}%`}
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
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
  },
  greeting: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.primary[900],
  },
  notificationBtn: {
    position: 'relative',
    padding: spacing[2],
  },
  notificationBadge: {
    position: 'absolute',
    top: spacing[1],
    right: spacing[1],
    backgroundColor: colors.semantic.error,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: colors.background.primary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  statsContainer: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[5],
  },
  statCardPrimary: {
    backgroundColor: colors.primary[800],
    borderRadius: radius.xl,
    padding: spacing[5],
    marginBottom: spacing[3],
    ...shadows.md,
    overflow: 'hidden',
  },
  revenueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  revenueLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary[200],
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  revenueValue: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.background.primary,
    marginTop: spacing[1],
    letterSpacing: -0.5,
  },
  revenueIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  revenueDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: spacing[3.5],
  },
  revenueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revenueFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  revenueFooterText: {
    fontSize: 13,
    color: colors.primary[100],
    fontWeight: '500',
  },
  revenueFooterDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: spacing[2],
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing[2.5],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.primary[900],
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  sectionTitle: {
    ...typography.heading4,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  sectionTitleNoMargin: {
    ...typography.heading4,
    color: colors.text.primary,
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  aiBadgeSmall: {
    backgroundColor: colors.accent[500],
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.md,
  },
  aiBadgeText: {
    color: colors.background.primary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[0.5],
  },
  seeAll: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary[800],
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing[3.5],
    marginBottom: spacing[2.5],
    borderWidth: 1,
    borderColor: colors.primary[50],
    ...shadows.xs,
  },
  insightIcon: {
    width: spacing[10],
    height: spacing[10],
    borderRadius: spacing[5],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  insightMessage: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  insightAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightActionText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary[800],
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary[800],
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...shadows.md,
  },
  primaryActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  primaryActionIconWrap: {
    width: spacing[12],
    height: spacing[12],
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.background.primary,
  },
  primaryActionSub: {
    fontSize: fontSize.xs,
    color: colors.primary[200],
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[2],
  },
  quickActionIcon: {
    width: spacing[14],
    height: spacing[14],
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.primary,
  },
  priceCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing[3.5],
    marginRight: spacing[2.5],
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary[50],
    ...shadows.xs,
  },
  priceCrop: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  priceValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.primary[900],
    marginTop: spacing[1],
  },
  priceUnit: {
    fontSize: fontSize.xs,
    color: colors.neutral[500],
  },
  priceChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[0.5],
    marginTop: spacing[1],
  },
  priceChangeText: {
    fontSize: fontSize.xs,
    color: colors.primary[500],
    fontWeight: '600',
  },
  bottomPadding: {
    height: spacing[5],
  },
});
