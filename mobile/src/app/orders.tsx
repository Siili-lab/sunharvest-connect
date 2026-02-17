import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/primitives/Text';
import { Button } from '../components/primitives/Button';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { colors, spacing, radius, shadows } from '@/theme';
import {
  getBuyerOffers,
  getFarmerOffers,
  acceptOffer,
  declineOffer,
  payOffer,
  markDelivered,
  completeTransaction,
  Offer,
} from '../services/api';

type OrderStatus = 'pending' | 'accepted' | 'paid' | 'in_transit' | 'delivered' | 'completed' | 'disputed';

type Order = {
  id: string;
  crop: string;
  quantity: number;
  pricePerKg: number;
  totalAmount: number;
  status: OrderStatus;
  buyerName?: string;
  farmerName?: string;
  buyerId?: string;
  farmerId?: string;
  buyerPhone?: string;
  farmerPhone?: string;
  location: string;
  createdAt: string;
  escrowStatus: 'pending' | 'held' | 'released';
  grade: string;
  images?: string[];
  hasRated?: boolean;
};

// Helper to convert API offer to local Order type
const offerToOrder = (offer: Offer, isFarmer: boolean): Order => {
  const status = offer.status.toLowerCase() as OrderStatus;
  const escrowStatus = ['PAID', 'IN_TRANSIT', 'DELIVERED'].includes(offer.status)
    ? 'held'
    : offer.status === 'COMPLETED'
    ? 'released'
    : 'pending';

  // Format createdAt
  const created = new Date(offer.createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  let createdAtStr = '';
  if (diffHours < 1) createdAtStr = 'Just now';
  else if (diffHours < 24) createdAtStr = `${diffHours} hours ago`;
  else if (diffDays === 1) createdAtStr = '1 day ago';
  else if (diffDays < 7) createdAtStr = `${diffDays} days ago`;
  else createdAtStr = `${Math.floor(diffDays / 7)} week(s) ago`;

  return {
    id: offer.id,
    crop: offer.crop,
    quantity: offer.quantity,
    pricePerKg: offer.price,
    totalAmount: offer.total,
    status,
    buyerName: isFarmer ? offer.buyer : undefined,
    farmerName: !isFarmer ? offer.farmer : undefined,
    buyerId: offer.buyerId,
    farmerId: offer.farmerId,
    buyerPhone: isFarmer ? offer.buyerPhone : undefined,
    farmerPhone: !isFarmer ? offer.farmerPhone : undefined,
    location: offer.location || 'Kenya',
    createdAt: createdAtStr,
    escrowStatus,
    grade: 'Grade A', // Default grade
    images: offer.images,
  };
};

const STATUS_CONFIG: Record<OrderStatus, { labelKey: string; color: string; bgColor: string; icon: string }> = {
  pending: { labelKey: 'pending', color: colors.semantic.warning, bgColor: colors.semantic.warningLight, icon: 'time' },
  accepted: { labelKey: 'accepted', color: colors.semantic.info, bgColor: colors.semantic.infoLight, icon: 'checkmark-circle' },
  paid: { labelKey: 'paid', color: '#7B1FA2', bgColor: '#F3E5F5', icon: 'card' },
  in_transit: { labelKey: 'in_transit', color: '#0097A7', bgColor: '#E0F7FA', icon: 'car' },
  delivered: { labelKey: 'delivered', color: colors.primary[700], bgColor: colors.primary[50], icon: 'checkmark-done' },
  completed: { labelKey: 'completed', color: colors.primary[800], bgColor: colors.primary[50], icon: 'checkmark-done-circle' },
  disputed: { labelKey: 'disputed', color: colors.semantic.error, bgColor: colors.semantic.errorLight, icon: 'alert-circle' },
};

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selectedTab, setSelectedTab] = useState<'active' | 'completed'>('active');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratedOrders, setRatedOrders] = useState<Set<string>>(new Set());

  const isFarmer = user?.userType === 'farmer';

  // Fetch orders from API
  const fetchOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Use user ID or fallback for demo
      const userId = user?.id || '1';
      const response = isFarmer
        ? await getFarmerOffers(userId)
        : await getBuyerOffers(userId);

      const mappedOrders = response.map((offer: Offer) => offerToOrder(offer, isFarmer));
      setOrders(mappedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      // Show demo data if API fails
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isFarmer]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => fetchOrders(true);

  const activeOrders = orders.filter(o => !['completed', 'disputed', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => ['completed', 'disputed', 'cancelled'].includes(o.status));
  const displayOrders = selectedTab === 'active' ? activeOrders : completedOrders;

  const handleAcceptOffer = (order: Order) => {
    Alert.alert(
      'Accept Offer',
      `Accept offer of KSh ${order.totalAmount.toLocaleString()} from ${order.buyerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActionLoading(true);
            try {
              await acceptOffer(order.id);
              Alert.alert('Offer Accepted', 'Buyer will be notified to make payment.');
              setSelectedOrder(null);
              fetchOrders();
            } catch (error) {
              Alert.alert('Error', 'Failed to accept offer. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeclineOffer = (order: Order) => {
    Alert.alert(
      'Decline Offer',
      'Are you sure you want to decline this offer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await declineOffer(order.id);
              Alert.alert('Offer Declined');
              setSelectedOrder(null);
              fetchOrders();
            } catch (error) {
              Alert.alert('Error', 'Failed to decline offer. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMakePayment = (order: Order) => {
    Alert.alert(
      'M-Pesa Payment',
      `Pay KSh ${order.totalAmount.toLocaleString()} via M-Pesa?\n\nFunds will be held in escrow until delivery is confirmed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: async () => {
            setActionLoading(true);
            try {
              // Generate a mock M-Pesa reference for now
              const paymentRef = `MPESA${Date.now()}`;
              await payOffer(order.id, paymentRef);
              Alert.alert('Payment Confirmed', 'Funds are now held in escrow. Awaiting delivery.');
              setSelectedOrder(null);
              fetchOrders();
            } catch (error) {
              Alert.alert('Error', 'Payment failed. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkDelivered = (order: Order) => {
    Alert.alert(
      'Mark as Delivered',
      'Confirm that you have delivered the produce?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Delivery',
          onPress: async () => {
            setActionLoading(true);
            try {
              await markDelivered(order.id);
              Alert.alert('Delivery Marked', 'Waiting for buyer to confirm receipt.');
              setSelectedOrder(null);
              fetchOrders();
            } catch (error) {
              Alert.alert('Error', 'Failed to mark delivery. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmDelivery = (order: Order) => {
    Alert.alert(
      'Confirm Delivery',
      'Confirm that you have received the produce in good condition?\n\nThis will release payment to the farmer.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report Issue', style: 'destructive', onPress: () => Alert.alert('Dispute', 'Contact support at support@sunharvest.com') },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(true);
            try {
              await completeTransaction(order.id);
              Alert.alert('Transaction Complete', 'Payment has been released to the farmer. Thank you!');
              setSelectedOrder(null);
              fetchOrders();
            } catch (error) {
              Alert.alert('Error', 'Failed to complete transaction. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmitRating = async (order: Order, rating: number) => {
    setActionLoading(true);
    try {
      await completeTransaction(order.id, rating);
      setRatedOrders((prev) => new Set(prev).add(order.id));
      setRatingOrderId(null);
      setSelectedRating(0);
      Alert.alert(t('thanks_for_rating'), '');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit rating');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'active' && styles.tabActive]}
          onPress={() => setSelectedTab('active')}
          accessibilityLabel={`${t('active')} (${activeOrders.length})`}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTab === 'active' }}
        >
          <Text
            style={[styles.tabText, selectedTab === 'active' && styles.tabTextActive]}
          >
            {t('active')} ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'completed' && styles.tabActive]}
          onPress={() => setSelectedTab('completed')}
          accessibilityLabel={`${t('history')} (${completedOrders.length})`}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTab === 'completed' }}
        >
          <Text
            style={[styles.tabText, selectedTab === 'completed' && styles.tabTextActive]}
          >
            {t('history')} ({completedOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary[800]]} />
        }
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary[800]} />
            <Text style={styles.emptyText}>{t('loading_orders')}</Text>
          </View>
        ) : displayOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={colors.border.light} />
            <Text style={styles.emptyText}>{t('no_orders')}</Text>
            <Text style={styles.emptySubtext}>
              {isFarmer
                ? 'Orders will appear when buyers make offers on your listings'
                : 'Start by browsing the marketplace and making offers'}
            </Text>
          </View>
        ) : (
          displayOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => setSelectedOrder(order)}
              activeOpacity={0.7}
              accessibilityLabel={`${order.crop} - ${t(STATUS_CONFIG[order.status].labelKey as any)} - KSh ${order.totalAmount.toLocaleString()}`}
              accessibilityRole="button"
              accessibilityHint={t('order_details')}
            >
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderCrop}>{order.crop}</Text>
                  <Text style={styles.orderQuantity}>{order.quantity} kg @ KSh {order.pricePerKg}/kg</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_CONFIG[order.status].bgColor }]}>
                  <Ionicons
                    name={STATUS_CONFIG[order.status].icon as any}
                    size={14}
                    color={STATUS_CONFIG[order.status].color}
                  />
                  <Text style={[styles.statusText, { color: STATUS_CONFIG[order.status].color }]}>
                    {t(STATUS_CONFIG[order.status].labelKey as any)}
                  </Text>
                </View>
              </View>

              <View style={styles.orderBody}>
                <View style={styles.orderDetail}>
                  <Ionicons name="person" size={14} color={colors.neutral[600]} />
                  <Text style={styles.orderDetailText}>
                    {isFarmer ? order.buyerName : order.farmerName}
                  </Text>
                </View>
                <View style={styles.orderDetail}>
                  <Ionicons name="location" size={14} color={colors.neutral[600]} />
                  <Text style={styles.orderDetailText}>{order.location}</Text>
                </View>
                <View style={styles.orderDetail}>
                  <Ionicons name="time" size={14} color={colors.neutral[600]} />
                  <Text style={styles.orderDetailText}>{order.createdAt}</Text>
                </View>
              </View>

              <View style={styles.orderFooter}>
                <View>
                  <Text style={styles.orderAmountLabel}>{t('total_amount')}</Text>
                  <Text style={styles.orderAmount}>KSh {order.totalAmount.toLocaleString()}</Text>
                </View>
                {order.escrowStatus === 'held' && (
                  <View style={styles.escrowBadge}>
                    <Ionicons name="shield-checkmark" size={14} color={colors.semantic.info} />
                    <Text style={styles.escrowText}>{t('escrow_protected')}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Order Detail Modal */}
      <Modal
        visible={selectedOrder !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOrder && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('order_details')}</Text>
                  <TouchableOpacity
                    onPress={() => setSelectedOrder(null)}
                    accessibilityLabel={t('close')}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={24} color={colors.neutral[600]} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.statusBadgeLarge, { backgroundColor: STATUS_CONFIG[selectedOrder.status].bgColor }]}>
                  <Ionicons
                    name={STATUS_CONFIG[selectedOrder.status].icon as any}
                    size={20}
                    color={STATUS_CONFIG[selectedOrder.status].color}
                  />
                  <Text style={[styles.statusTextLarge, { color: STATUS_CONFIG[selectedOrder.status].color }]}>
                    {t(STATUS_CONFIG[selectedOrder.status].labelKey as any)}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Product</Text>
                  <Text style={styles.detailValue}>{selectedOrder.crop} - {selectedOrder.grade}</Text>
                </View>

                <TouchableOpacity
                  style={styles.detailSection}
                  onPress={() => {
                    const profileId = isFarmer ? selectedOrder.buyerId : selectedOrder.farmerId;
                    if (profileId) {
                      setSelectedOrder(null);
                      router.push({ pathname: '/user-profile', params: { userId: profileId } });
                    }
                  }}
                  disabled={!(isFarmer ? selectedOrder.buyerId : selectedOrder.farmerId)}
                >
                  <Text style={styles.detailLabel}>{isFarmer ? t('buyer') : t('farmer')}</Text>
                  <Text style={[styles.detailValue, (isFarmer ? selectedOrder.buyerId : selectedOrder.farmerId) && { color: colors.text.link }]}>
                    {isFarmer ? selectedOrder.buyerName : selectedOrder.farmerName}
                    {(isFarmer ? selectedOrder.buyerId : selectedOrder.farmerId) ? ' >' : ''}
                  </Text>
                </TouchableOpacity>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{t('location')}</Text>
                  <Text style={styles.detailValue}>{selectedOrder.location}</Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>{t('quantity')}</Text>
                    <Text style={styles.detailValue}>{selectedOrder.quantity} kg</Text>
                  </View>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>{t('price_per_kg')}</Text>
                    <Text style={styles.detailValue}>KSh {selectedOrder.pricePerKg}</Text>
                  </View>
                </View>

                <View style={styles.totalSection}>
                  <Text style={styles.totalLabel}>{t('total_amount')}</Text>
                  <Text style={styles.totalValue}>KSh {selectedOrder.totalAmount.toLocaleString()}</Text>
                </View>

                {selectedOrder.escrowStatus === 'held' && (
                  <View style={styles.escrowInfo}>
                    <Ionicons name="shield-checkmark" size={20} color={colors.semantic.info} />
                    <View style={styles.escrowInfoText}>
                      <Text style={styles.escrowTitle}>{t('escrow_protected')}</Text>
                      <Text style={styles.escrowDesc}>
                        {t('escrow_held')}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Rating Prompt for completed/delivered orders */}
                {(selectedOrder.status === 'completed' || selectedOrder.status === 'delivered') &&
                  !ratedOrders.has(selectedOrder.id) && (
                  <View style={styles.ratingCard}>
                    {ratingOrderId === selectedOrder.id ? (
                      <>
                        <Text style={styles.ratingTitle}>{t('tap_to_rate')}</Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                              key={star}
                              onPress={() => setSelectedRating(star)}
                              accessibilityLabel={`${star} stars`}
                            >
                              <Ionicons
                                name={star <= selectedRating ? 'star' : 'star-outline'}
                                size={32}
                                color={star <= selectedRating ? colors.accent[500] : colors.neutral[400]}
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                        {selectedRating > 0 && (
                          <Button
                            variant="primary"
                            size="medium"
                            onPress={() => handleSubmitRating(selectedOrder, selectedRating)}
                            loading={actionLoading}
                            disabled={actionLoading}
                            fullWidth
                            style={{ marginTop: spacing[3] }}
                          >
                            {t('submit')} ({selectedRating}/5)
                          </Button>
                        )}
                      </>
                    ) : (
                      <TouchableOpacity
                        style={styles.ratingPrompt}
                        onPress={() => { setRatingOrderId(selectedOrder.id); setSelectedRating(0); }}
                      >
                        <Ionicons name="star-outline" size={20} color={colors.accent[500]} />
                        <Text style={styles.ratingPromptText}>{t('rate_transaction')}</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.neutral[500]} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                  {isFarmer && selectedOrder.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        onPress={() => handleDeclineOffer(selectedOrder)}
                        disabled={actionLoading}
                        accessibilityLabel={t('decline_offer')}
                        style={styles.declineBtn}
                      >
                        {t('decline_offer')}
                      </Button>
                      <Button
                        variant="primary"
                        onPress={() => handleAcceptOffer(selectedOrder)}
                        disabled={actionLoading}
                        loading={actionLoading}
                        accessibilityLabel={t('accept_offer')}
                        style={styles.acceptBtn}
                      >
                        {t('accept_offer')}
                      </Button>
                    </>
                  )}

                  {!isFarmer && selectedOrder.status === 'accepted' && (
                    <Button
                      variant="primary"
                      onPress={() => handleMakePayment(selectedOrder)}
                      disabled={actionLoading}
                      loading={actionLoading}
                      leftIcon={!actionLoading ? <Ionicons name="card" size={20} color={colors.neutral[0]} /> : undefined}
                      accessibilityLabel={t('pay_mpesa')}
                      fullWidth
                      style={styles.payBtn}
                    >
                      {t('pay_mpesa')}
                    </Button>
                  )}

                  {isFarmer && selectedOrder.status === 'paid' && (
                    <Button
                      variant="primary"
                      onPress={() => handleMarkDelivered(selectedOrder)}
                      disabled={actionLoading}
                      loading={actionLoading}
                      leftIcon={!actionLoading ? <Ionicons name="car" size={20} color={colors.neutral[0]} /> : undefined}
                      accessibilityLabel={t('mark_delivered')}
                      fullWidth
                      style={styles.confirmBtn}
                    >
                      {t('mark_delivered')}
                    </Button>
                  )}

                  {!isFarmer && selectedOrder.status === 'delivered' && (
                    <Button
                      variant="primary"
                      onPress={() => handleConfirmDelivery(selectedOrder)}
                      disabled={actionLoading}
                      loading={actionLoading}
                      leftIcon={!actionLoading ? <Ionicons name="checkmark-circle" size={20} color={colors.neutral[0]} /> : undefined}
                      accessibilityLabel={t('confirm_receipt')}
                      fullWidth
                      style={styles.confirmBtn}
                    >
                      {t('confirm_receipt')}
                    </Button>
                  )}

                  {selectedOrder.status === 'in_transit' && (
                    <Button
                      variant="primary"
                      onPress={() => {}}
                      leftIcon={<Ionicons name="location" size={20} color={colors.neutral[0]} />}
                      accessibilityLabel={t('in_transit')}
                      fullWidth
                      style={styles.trackBtn}
                    >
                      Track Delivery
                    </Button>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => {
                    const phone = isFarmer ? selectedOrder.buyerPhone : selectedOrder.farmerPhone;
                    if (phone) {
                      Linking.openURL(`tel:${phone}`);
                    } else {
                      Alert.alert('Contact', 'Phone number not available');
                    }
                  }}
                  accessibilityLabel={`${t('call')} ${isFarmer ? t('buyer') : t('farmer')}`}
                  accessibilityRole="button"
                >
                  <Ionicons name="call" size={18} color={colors.primary[800]} />
                  <Text style={styles.contactBtnText}>
                    {t('call')} {isFarmer ? t('buyer') : t('farmer')}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  tabs: {
    flexDirection: 'row',
    padding: spacing[4],
    gap: spacing[3],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  tabActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[800],
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  tabTextActive: {
    color: colors.primary[800],
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[4],
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing[20],
  },
  emptyText: {
    fontSize: 16,
    color: colors.neutral[500],
    marginTop: spacing[4],
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.neutral[400],
    marginTop: spacing[2],
    textAlign: 'center',
    paddingHorizontal: spacing[8],
  },
  orderCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.primary[50],
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  orderCrop: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary[900],
  },
  orderQuantity: {
    fontSize: 13,
    color: colors.neutral[600],
    marginTop: spacing[0.5],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.lg,
    gap: spacing[1],
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  orderDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  orderDetailText: {
    fontSize: 13,
    color: colors.neutral[600],
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingTop: spacing[3],
  },
  orderAmountLabel: {
    fontSize: 11,
    color: colors.neutral[600],
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary[900],
  },
  escrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.semantic.infoLight,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.lg,
    gap: spacing[1],
  },
  escrowText: {
    fontSize: 11,
    color: colors.semantic.info,
    fontWeight: '600',
  },
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
    marginBottom: spacing[5],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary[900],
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    gap: spacing[1.5],
    marginBottom: spacing[5],
  },
  statusTextLarge: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailSection: {
    marginBottom: spacing[4],
  },
  detailLabel: {
    fontSize: 12,
    color: colors.neutral[600],
    marginBottom: spacing[1],
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing[6],
  },
  totalSection: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  totalLabel: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary[900],
  },
  escrowInfo: {
    flexDirection: 'row',
    backgroundColor: colors.semantic.infoLight,
    borderRadius: radius.lg,
    padding: spacing[3.5],
    marginBottom: spacing[5],
    gap: spacing[3],
  },
  escrowInfoText: {
    flex: 1,
  },
  escrowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.semantic.info,
  },
  escrowDesc: {
    fontSize: 12,
    color: colors.neutral[600],
    marginTop: spacing[0.5],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  declineBtn: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  acceptBtn: {
    flex: 2,
    backgroundColor: colors.primary[800],
  },
  payBtn: {
    backgroundColor: colors.primary[800],
  },
  confirmBtn: {
    backgroundColor: colors.primary[800],
  },
  trackBtn: {
    backgroundColor: '#0097A7',
  },
  contactBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[3.5],
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    gap: spacing[2],
  },
  contactBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[800],
  },
  btnDisabled: {
    opacity: 0.6,
  },
  ratingCard: {
    backgroundColor: colors.accent[50],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  ratingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
  },
  ratingPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  ratingPromptText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent[700],
    flex: 1,
  },
});
