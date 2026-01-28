import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
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
import { useAuth } from '../context/AuthContext';
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
  buyerPhone?: string;
  farmerPhone?: string;
  location: string;
  createdAt: string;
  escrowStatus: 'pending' | 'held' | 'released';
  grade: string;
  images?: string[];
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
    buyerPhone: isFarmer ? offer.buyerPhone : undefined,
    farmerPhone: !isFarmer ? offer.farmerPhone : undefined,
    location: offer.location || 'Kenya',
    createdAt: createdAtStr,
    escrowStatus,
    grade: 'Grade A', // Default grade
    images: offer.images,
  };
};

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  pending: { label: 'Pending', color: '#F57C00', bgColor: '#FFF3E0', icon: 'time' },
  accepted: { label: 'Accepted', color: '#1976D2', bgColor: '#E3F2FD', icon: 'checkmark-circle' },
  paid: { label: 'Paid', color: '#7B1FA2', bgColor: '#F3E5F5', icon: 'card' },
  in_transit: { label: 'In Transit', color: '#0097A7', bgColor: '#E0F7FA', icon: 'car' },
  delivered: { label: 'Delivered', color: '#388E3C', bgColor: '#E8F5E9', icon: 'checkmark-done' },
  completed: { label: 'Completed', color: '#2E7D32', bgColor: '#E8F5E9', icon: 'checkmark-done-circle' },
  disputed: { label: 'Disputed', color: '#D32F2F', bgColor: '#FFEBEE', icon: 'alert-circle' },
};

export default function OrdersScreen() {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState<'active' | 'completed'>('active');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'active' && styles.tabActive]}
          onPress={() => setSelectedTab('active')}
        >
          <Text style={[styles.tabText, selectedTab === 'active' && styles.tabTextActive]}>
            Active ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'completed' && styles.tabActive]}
          onPress={() => setSelectedTab('completed')}
        >
          <Text style={[styles.tabText, selectedTab === 'completed' && styles.tabTextActive]}>
            History ({completedOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
        }
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.emptyText}>Loading orders...</Text>
          </View>
        ) : displayOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#E0E0E0" />
            <Text style={styles.emptyText}>No {selectedTab} orders</Text>
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
                    {STATUS_CONFIG[order.status].label}
                  </Text>
                </View>
              </View>

              <View style={styles.orderBody}>
                <View style={styles.orderDetail}>
                  <Ionicons name="person" size={14} color="#666" />
                  <Text style={styles.orderDetailText}>
                    {isFarmer ? order.buyerName : order.farmerName}
                  </Text>
                </View>
                <View style={styles.orderDetail}>
                  <Ionicons name="location" size={14} color="#666" />
                  <Text style={styles.orderDetailText}>{order.location}</Text>
                </View>
                <View style={styles.orderDetail}>
                  <Ionicons name="time" size={14} color="#666" />
                  <Text style={styles.orderDetailText}>{order.createdAt}</Text>
                </View>
              </View>

              <View style={styles.orderFooter}>
                <View>
                  <Text style={styles.orderAmountLabel}>Total Amount</Text>
                  <Text style={styles.orderAmount}>KSh {order.totalAmount.toLocaleString()}</Text>
                </View>
                {order.escrowStatus === 'held' && (
                  <View style={styles.escrowBadge}>
                    <Ionicons name="shield-checkmark" size={14} color="#1976D2" />
                    <Text style={styles.escrowText}>Escrow Protected</Text>
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
                  <Text style={styles.modalTitle}>Order Details</Text>
                  <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.statusBadgeLarge, { backgroundColor: STATUS_CONFIG[selectedOrder.status].bgColor }]}>
                  <Ionicons
                    name={STATUS_CONFIG[selectedOrder.status].icon as any}
                    size={20}
                    color={STATUS_CONFIG[selectedOrder.status].color}
                  />
                  <Text style={[styles.statusTextLarge, { color: STATUS_CONFIG[selectedOrder.status].color }]}>
                    {STATUS_CONFIG[selectedOrder.status].label}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Product</Text>
                  <Text style={styles.detailValue}>{selectedOrder.crop} - {selectedOrder.grade}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>{isFarmer ? 'Buyer' : 'Farmer'}</Text>
                  <Text style={styles.detailValue}>
                    {isFarmer ? selectedOrder.buyerName : selectedOrder.farmerName}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{selectedOrder.location}</Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Quantity</Text>
                    <Text style={styles.detailValue}>{selectedOrder.quantity} kg</Text>
                  </View>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Price/kg</Text>
                    <Text style={styles.detailValue}>KSh {selectedOrder.pricePerKg}</Text>
                  </View>
                </View>

                <View style={styles.totalSection}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue}>KSh {selectedOrder.totalAmount.toLocaleString()}</Text>
                </View>

                {selectedOrder.escrowStatus === 'held' && (
                  <View style={styles.escrowInfo}>
                    <Ionicons name="shield-checkmark" size={20} color="#1976D2" />
                    <View style={styles.escrowInfoText}>
                      <Text style={styles.escrowTitle}>Escrow Protected</Text>
                      <Text style={styles.escrowDesc}>
                        Funds are held securely until delivery is confirmed
                      </Text>
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                  {isFarmer && selectedOrder.status === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={[styles.declineBtn, actionLoading && styles.btnDisabled]}
                        onPress={() => handleDeclineOffer(selectedOrder)}
                        disabled={actionLoading}
                      >
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.acceptBtn, actionLoading && styles.btnDisabled]}
                        onPress={() => handleAcceptOffer(selectedOrder)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.acceptBtnText}>Accept Offer</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {!isFarmer && selectedOrder.status === 'accepted' && (
                    <TouchableOpacity
                      style={[styles.payBtn, actionLoading && styles.btnDisabled]}
                      onPress={() => handleMakePayment(selectedOrder)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="card" size={20} color="#fff" />
                          <Text style={styles.payBtnText}>Pay with M-Pesa</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {isFarmer && selectedOrder.status === 'paid' && (
                    <TouchableOpacity
                      style={[styles.confirmBtn, actionLoading && styles.btnDisabled]}
                      onPress={() => handleMarkDelivered(selectedOrder)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="car" size={20} color="#fff" />
                          <Text style={styles.confirmBtnText}>Mark as Delivered</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {!isFarmer && selectedOrder.status === 'delivered' && (
                    <TouchableOpacity
                      style={[styles.confirmBtn, actionLoading && styles.btnDisabled]}
                      onPress={() => handleConfirmDelivery(selectedOrder)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#fff" />
                          <Text style={styles.confirmBtnText}>Confirm Receipt</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {selectedOrder.status === 'in_transit' && (
                    <TouchableOpacity style={styles.trackBtn}>
                      <Ionicons name="location" size={20} color="#fff" />
                      <Text style={styles.trackBtnText}>Track Delivery</Text>
                    </TouchableOpacity>
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
                >
                  <Ionicons name="call" size={18} color="#2E7D32" />
                  <Text style={styles.contactBtnText}>
                    Call {isFarmer ? 'Buyer' : 'Farmer'}
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
    backgroundColor: '#FAFAFA',
  },
  tabs: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tabActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#2E7D32',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#9E9E9E',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#BDBDBD',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderCrop: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B5E20',
  },
  orderQuantity: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  orderDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderDetailText: {
    fontSize: 13,
    color: '#666',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 12,
  },
  orderAmountLabel: {
    fontSize: 11,
    color: '#666',
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B5E20',
  },
  escrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  escrowText: {
    fontSize: 11,
    color: '#1976D2',
    fontWeight: '600',
  },
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B5E20',
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    marginBottom: 20,
  },
  statusTextLarge: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    gap: 24,
  },
  totalSection: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 12,
    color: '#666',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
  },
  escrowInfo: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  escrowInfoText: {
    flex: 1,
  },
  escrowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  escrowDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  acceptBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  payBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    gap: 8,
  },
  payBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    gap: 8,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  trackBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#0097A7',
    gap: 8,
  },
  trackBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  contactBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    gap: 8,
  },
  contactBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E7D32',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
