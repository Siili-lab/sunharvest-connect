import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTrustScore, getTrustScoreSummary, TrustScore, TrustScoreSummary } from '../services/api';
import { colors, spacing, radius } from '@/theme';

interface TrustScoreBadgeProps {
  userId: string;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

const LEVEL_COLORS: Record<TrustScore['level'], { bg: string; text: string; icon: string }> = {
  New: { bg: colors.neutral[100], text: colors.neutral[600], icon: 'person-outline' },
  Basic: { bg: colors.accent[50], text: colors.accent[700], icon: 'shield-outline' },
  Trusted: { bg: colors.primary[50], text: colors.primary[700], icon: 'shield-checkmark-outline' },
  Verified: { bg: colors.accent[200], text: colors.accent[900], icon: 'shield-checkmark' },
  Elite: { bg: colors.accent[100], text: colors.accent[500], icon: 'diamond' },
};

const BADGE_ICONS: Record<string, string> = {
  'Century Seller': 'trophy',
  'Experienced Trader': 'ribbon',
  'Active Trader': 'trending-up',
  'Top Rated': 'star',
  'Highly Rated': 'star-half',
  'Veteran Member': 'medal',
  'Established': 'time',
  'Verified': 'checkmark-circle',
  'Zero Disputes': 'happy',
  'Reliable Partner': 'handshake',
};

export default function TrustScoreBadge({ userId, size = 'medium', showDetails = true }: TrustScoreBadgeProps) {
  const [summary, setSummary] = useState<TrustScoreSummary | null>(null);
  const [fullScore, setFullScore] = useState<TrustScore | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [userId]);

  const fetchSummary = async () => {
    try {
      const data = await getTrustScoreSummary(userId);
      setSummary(data);
    } catch (error) {
      // No fallback — show nothing rather than fake data
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchFullScore = async () => {
    if (fullScore) return;
    setLoadingDetails(true);
    try {
      const data = await getTrustScore(userId);
      setFullScore(data);
    } catch (error) {
      // No fallback — show nothing rather than fake data
      setFullScore(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openDetails = () => {
    if (!showDetails) return;
    fetchFullScore();
    setShowModal(true);
  };

  if (loading) {
    return (
      <View style={[styles.badge, styles[`badge_${size}`]]}>
        <ActivityIndicator size="small" color={colors.primary[800]} />
      </View>
    );
  }

  if (!summary) return null;

  const levelStyle = LEVEL_COLORS[summary.level];

  // Render different sizes
  if (size === 'small') {
    return (
      <TouchableOpacity
        style={[styles.badgeSmall, { backgroundColor: levelStyle.bg }]}
        onPress={openDetails}
        disabled={!showDetails}
      >
        <Ionicons name={levelStyle.icon as any} size={12} color={levelStyle.text} />
        <Text style={[styles.scoreSmall, { color: levelStyle.text }]}>{summary.score}</Text>
      </TouchableOpacity>
    );
  }

  if (size === 'large') {
    return (
      <>
        <TouchableOpacity
          style={[styles.badgeLarge, { backgroundColor: levelStyle.bg }]}
          onPress={openDetails}
          disabled={!showDetails}
        >
          <View style={styles.badgeLargeHeader}>
            <View style={[styles.scoreCircle, { borderColor: levelStyle.text }]}>
              <Text style={[styles.scoreLarge, { color: levelStyle.text }]}>{summary.score}</Text>
            </View>
            <View style={styles.badgeLargeInfo}>
              <Text style={[styles.levelLarge, { color: levelStyle.text }]}>{summary.level}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color={colors.semantic.warning} />
                <Text style={styles.ratingText}>
                  {summary.rating.toFixed(1)} ({summary.totalRatings} reviews)
                </Text>
              </View>
            </View>
            {summary.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary[800]} />
              </View>
            )}
          </View>
          {showDetails && (
            <Text style={styles.tapHint}>Tap to see full trust profile</Text>
          )}
        </TouchableOpacity>
        {renderModal()}
      </>
    );
  }

  // Medium (default)
  return (
    <>
      <TouchableOpacity
        style={[styles.badge, { backgroundColor: levelStyle.bg }]}
        onPress={openDetails}
        disabled={!showDetails}
      >
        <Ionicons name={levelStyle.icon as any} size={14} color={levelStyle.text} />
        <Text style={[styles.score, { color: levelStyle.text }]}>{summary.score}</Text>
        <Text style={[styles.level, { color: levelStyle.text }]}>{summary.level}</Text>
        {summary.isVerified && (
          <Ionicons name="checkmark-circle" size={12} color={colors.primary[800]} style={styles.verifiedIcon} />
        )}
      </TouchableOpacity>
      {renderModal()}
    </>
  );

  function renderModal() {
    return (
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trust Score</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.neutral[600]} />
              </TouchableOpacity>
            </View>

            {loadingDetails ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary[800]} />
                <Text style={styles.loadingText}>Loading trust profile...</Text>
              </View>
            ) : fullScore ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Score Circle */}
                <View style={styles.scoreSection}>
                  <View style={[styles.scoreCircleLarge, { borderColor: levelStyle.text }]}>
                    <Text style={[styles.scoreValue, { color: levelStyle.text }]}>
                      {fullScore.score}
                    </Text>
                    <Text style={styles.scoreLabel}>Trust Score</Text>
                  </View>
                  <View style={[styles.levelBadgeLarge, { backgroundColor: levelStyle.bg }]}>
                    <Ionicons name={levelStyle.icon as any} size={16} color={levelStyle.text} />
                    <Text style={[styles.levelText, { color: levelStyle.text }]}>
                      {fullScore.level}
                    </Text>
                  </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{fullScore.totalTransactions}</Text>
                    <Text style={styles.statLabel}>Transactions</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>
                      {new Date(fullScore.memberSince).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.statLabel}>Member Since</Text>
                  </View>
                </View>

                {/* Badges */}
                {fullScore.badges.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Achievements</Text>
                    <View style={styles.badgesGrid}>
                      {fullScore.badges.map((badge, index) => (
                        <View key={index} style={styles.achievementBadge}>
                          <Ionicons
                            name={(BADGE_ICONS[badge] || 'ribbon') as any}
                            size={16}
                            color={colors.accent[900]}
                          />
                          <Text style={styles.achievementText}>{badge}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Score Breakdown */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Score Breakdown</Text>
                  <View style={styles.breakdownList}>
                    {[
                      { key: 'completionRate', label: 'Completion Rate', weight: '40%' },
                      { key: 'rating', label: 'Partner Rating', weight: '25%' },
                      { key: 'accountAge', label: 'Account Age', weight: '10%' },
                      { key: 'verification', label: 'Verification', weight: '10%' },
                      { key: 'responseTime', label: 'Response Time', weight: '10%' },
                      { key: 'disputeRate', label: 'Dispute History', weight: '5%' },
                    ].map((item) => (
                      <View key={item.key} style={styles.breakdownItem}>
                        <View style={styles.breakdownHeader}>
                          <Text style={styles.breakdownLabel}>{item.label}</Text>
                          <Text style={styles.breakdownWeight}>{item.weight}</Text>
                        </View>
                        <View style={styles.breakdownBar}>
                          <View
                            style={[
                              styles.breakdownFill,
                              {
                                width: `${fullScore.breakdown[item.key as keyof typeof fullScore.breakdown]}%`,
                                backgroundColor:
                                  fullScore.breakdown[item.key as keyof typeof fullScore.breakdown] >= 70
                                    ? colors.semantic.success
                                    : fullScore.breakdown[item.key as keyof typeof fullScore.breakdown] >= 40
                                    ? colors.semantic.warning
                                    : colors.semantic.error,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.breakdownValue}>
                          {fullScore.breakdown[item.key as keyof typeof fullScore.breakdown]}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Insights */}
                {fullScore.insights.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>AI Insights</Text>
                    {fullScore.insights.map((insight, index) => (
                      <View key={index} style={styles.insightItem}>
                        <Ionicons name="bulb" size={16} color={colors.accent[900]} />
                        <Text style={styles.insightText}>{insight}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  // Small badge
  badgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[0.5],
    borderRadius: radius.sm,
    gap: 3,
  },
  scoreSmall: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Medium badge (default)
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.md,
    gap: spacing[1],
  },
  badge_small: {},
  badge_medium: {},
  badge_large: {},
  score: {
    fontSize: 13,
    fontWeight: '700',
  },
  level: {
    fontSize: 11,
    fontWeight: '500',
  },
  verifiedIcon: {
    marginLeft: spacing[0.5],
  },

  // Large badge
  badgeLarge: {
    padding: spacing[4],
    borderRadius: radius.lg,
  },
  badgeLargeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.xxl,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
  },
  scoreLarge: {
    fontSize: 18,
    fontWeight: '700',
  },
  badgeLargeInfo: {
    flex: 1,
  },
  levelLarge: {
    fontSize: 16,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[0.5],
  },
  ratingText: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  verifiedBadge: {
    backgroundColor: colors.primary[50],
    padding: spacing[1.5],
    borderRadius: radius.md,
  },
  tapHint: {
    fontSize: 11,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing[3],
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing[6],
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary[900],
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing[10],
  },
  loadingText: {
    marginTop: spacing[3],
    color: colors.neutral[600],
  },

  // Score section
  scoreSection: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  scoreCircleLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    marginBottom: spacing[3],
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 11,
    color: colors.neutral[600],
  },
  levelBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    gap: spacing[1.5],
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    padding: spacing[4],
    marginBottom: spacing[6],
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.neutral[300],
    marginHorizontal: spacing[4],
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  statLabel: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: spacing[1],
  },

  // Sections
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },

  // Badges
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.lg,
    gap: spacing[1.5],
  },
  achievementText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.accent[900],
  },

  // Breakdown
  breakdownList: {
    gap: spacing[3],
  },
  breakdownItem: {},
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.neutral[800],
  },
  breakdownWeight: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  breakdownBar: {
    height: 6,
    backgroundColor: colors.neutral[300],
    borderRadius: 3,
    marginBottom: spacing[0.5],
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownValue: {
    fontSize: 11,
    color: colors.neutral[600],
    textAlign: 'right',
  },

  // Insights
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accent[50],
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[2],
    gap: spacing[2.5],
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: colors.neutral[800],
    lineHeight: 18,
  },
});
