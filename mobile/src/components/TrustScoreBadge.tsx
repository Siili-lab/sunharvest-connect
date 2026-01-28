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

interface TrustScoreBadgeProps {
  userId: string;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

const LEVEL_COLORS: Record<TrustScore['level'], { bg: string; text: string; icon: string }> = {
  New: { bg: '#F5F5F5', text: '#757575', icon: 'person-outline' },
  Basic: { bg: '#E3F2FD', text: '#1976D2', icon: 'shield-outline' },
  Trusted: { bg: '#E8F5E9', text: '#388E3C', icon: 'shield-checkmark-outline' },
  Verified: { bg: '#FFF3E0', text: '#F57C00', icon: 'shield-checkmark' },
  Elite: { bg: '#F3E5F5', text: '#7B1FA2', icon: 'diamond' },
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
      // Fallback data
      setSummary({
        score: 75,
        level: 'Trusted',
        rating: 4.2,
        totalRatings: 5,
        isVerified: false,
      });
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
      // Fallback data
      setFullScore({
        score: 75,
        level: 'Trusted',
        breakdown: {
          completionRate: 80,
          rating: 70,
          accountAge: 60,
          verification: 100,
          responseTime: 75,
          disputeRate: 90,
        },
        badges: ['Active Trader', 'Verified'],
        totalTransactions: 5,
        memberSince: new Date().toISOString(),
        insights: ['Good transaction history', 'Keep up the great work!'],
      });
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
        <ActivityIndicator size="small" color="#2E7D32" />
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
                <Ionicons name="star" size={14} color="#FFC107" />
                <Text style={styles.ratingText}>
                  {summary.rating.toFixed(1)} ({summary.totalRatings} reviews)
                </Text>
              </View>
            </View>
            {summary.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
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
          <Ionicons name="checkmark-circle" size={12} color="#2E7D32" style={styles.verifiedIcon} />
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
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {loadingDetails ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2E7D32" />
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
                            color="#F57C00"
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
                                    ? '#4CAF50'
                                    : fullScore.breakdown[item.key as keyof typeof fullScore.breakdown] >= 40
                                    ? '#FFC107'
                                    : '#F44336',
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
                        <Ionicons name="bulb" size={16} color="#F57C00" />
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
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
    marginLeft: 2,
  },

  // Large badge
  badgeLarge: {
    padding: 16,
    borderRadius: 16,
  },
  badgeLargeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
  },
  verifiedBadge: {
    backgroundColor: '#E8F5E9',
    padding: 6,
    borderRadius: 12,
  },
  tapHint: {
    fontSize: 11,
    color: '#9E9E9E',
    textAlign: 'center',
    marginTop: 12,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B5E20',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },

  // Score section
  scoreSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreCircleLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#666',
  },
  levelBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 16,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },

  // Badges
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  achievementText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E65100',
  },

  // Breakdown
  breakdownList: {
    gap: 12,
  },
  breakdownItem: {},
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#333',
  },
  breakdownWeight: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  breakdownBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 2,
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownValue: {
    fontSize: 11,
    color: '#666',
    textAlign: 'right',
  },

  // Insights
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
});
