import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

type DeliveryStatus = 'available' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'completed';

interface DeliveryJob {
  id: string;
  cropType: string;
  quantity: number;
  unit: string;
  pickupLocation: string;
  deliveryLocation: string;
  distance: number;
  payment: number;
  status: DeliveryStatus;
  farmerName: string;
  farmerPhone: string;
  buyerName: string;
  buyerPhone: string;
  pickupTime?: string;
  deliveryDeadline: string;
  specialInstructions?: string;
  imageUrl?: string;
}

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; icon: string }> = {
  available: { label: 'Available', color: '#2E7D32', icon: 'radio-button-on' },
  accepted: { label: 'Accepted', color: '#1976D2', icon: 'checkmark-circle' },
  picked_up: { label: 'Picked Up', color: '#7B1FA2', icon: 'cube' },
  in_transit: { label: 'In Transit', color: '#F57C00', icon: 'car' },
  delivered: { label: 'Delivered', color: '#00897B', icon: 'location' },
  completed: { label: 'Completed', color: '#388E3C', icon: 'checkmark-done-circle' },
};

// Mock data
const MOCK_JOBS: DeliveryJob[] = [
  {
    id: '1',
    cropType: 'Tomatoes',
    quantity: 500,
    unit: 'kg',
    pickupLocation: 'Kiambu Farm, Kiambu County',
    deliveryLocation: 'Wakulima Market, Nairobi',
    distance: 28,
    payment: 2500,
    status: 'available',
    farmerName: 'John Kamau',
    farmerPhone: '+254712345678',
    buyerName: 'Fresh Mart Ltd',
    buyerPhone: '+254723456789',
    deliveryDeadline: '2024-01-15 14:00',
    specialInstructions: 'Handle with care, ripe tomatoes',
  },
  {
    id: '2',
    cropType: 'Cabbage',
    quantity: 300,
    unit: 'kg',
    pickupLocation: 'Limuru Farms, Kiambu',
    deliveryLocation: 'Githurai Market',
    distance: 15,
    payment: 1500,
    status: 'available',
    farmerName: 'Mary Wanjiku',
    farmerPhone: '+254734567890',
    buyerName: 'Green Grocers',
    buyerPhone: '+254745678901',
    deliveryDeadline: '2024-01-15 16:00',
  },
  {
    id: '3',
    cropType: 'Potatoes',
    quantity: 1000,
    unit: 'kg',
    pickupLocation: 'Nyandarua Farm',
    deliveryLocation: 'Muthurwa Market, Nairobi',
    distance: 120,
    payment: 8500,
    status: 'accepted',
    farmerName: 'Peter Mwangi',
    farmerPhone: '+254756789012',
    buyerName: 'Nairobi Vegetables Co.',
    buyerPhone: '+254767890123',
    deliveryDeadline: '2024-01-16 10:00',
    pickupTime: '2024-01-16 06:00',
    specialInstructions: 'Early morning pickup required',
  },
  {
    id: '4',
    cropType: 'Onions',
    quantity: 200,
    unit: 'kg',
    pickupLocation: 'Kajiado Farm',
    deliveryLocation: 'City Market, Nairobi',
    distance: 45,
    payment: 3200,
    status: 'in_transit',
    farmerName: 'David Ochieng',
    farmerPhone: '+254778901234',
    buyerName: 'City Traders',
    buyerPhone: '+254789012345',
    deliveryDeadline: '2024-01-15 12:00',
    pickupTime: '2024-01-15 08:00',
  },
];

export default function DeliveriesScreen() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<DeliveryJob[]>(MOCK_JOBS);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'my_jobs'>('available');
  const [selectedJob, setSelectedJob] = useState<DeliveryJob | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const availableJobs = jobs.filter(j => j.status === 'available');
  const myJobs = jobs.filter(j => j.status !== 'available' && j.status !== 'completed');
  const completedJobs = jobs.filter(j => j.status === 'completed');

  const todayEarnings = completedJobs.reduce((sum, j) => sum + j.payment, 0);
  const activeDeliveries = myJobs.length;
  const completedToday = completedJobs.length;

  const acceptJob = (job: DeliveryJob) => {
    Alert.alert(
      'Accept Job',
      `Accept delivery of ${job.quantity}${job.unit} ${job.cropType} for KSh ${job.payment.toLocaleString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => {
            setJobs(prev => prev.map(j =>
              j.id === job.id ? { ...j, status: 'accepted' as DeliveryStatus } : j
            ));
            setShowJobModal(false);
            Alert.alert('Success', 'Job accepted! Contact the farmer to arrange pickup.');
          },
        },
      ]
    );
  };

  const updateJobStatus = (job: DeliveryJob, newStatus: DeliveryStatus) => {
    const statusMessages: Record<DeliveryStatus, string> = {
      available: '',
      accepted: 'Job accepted',
      picked_up: 'Cargo picked up from farmer',
      in_transit: 'Delivery in progress',
      delivered: 'Cargo delivered to buyer',
      completed: 'Delivery completed and payment received',
    };

    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, status: newStatus } : j
    ));
    setShowUpdateModal(false);
    setSelectedJob(null);
    Alert.alert('Status Updated', statusMessages[newStatus]);
  };

  const getNextStatus = (currentStatus: DeliveryStatus): DeliveryStatus | null => {
    const flow: Record<DeliveryStatus, DeliveryStatus | null> = {
      available: 'accepted',
      accepted: 'picked_up',
      picked_up: 'in_transit',
      in_transit: 'delivered',
      delivered: 'completed',
      completed: null,
    };
    return flow[currentStatus];
  };

  const getNextStatusLabel = (currentStatus: DeliveryStatus): string => {
    const labels: Record<DeliveryStatus, string> = {
      available: 'Accept Job',
      accepted: 'Mark as Picked Up',
      picked_up: 'Start Delivery',
      in_transit: 'Mark as Delivered',
      delivered: 'Complete & Get Paid',
      completed: '',
    };
    return labels[currentStatus];
  };

  const renderJobCard = (job: DeliveryJob, showActions: boolean = true) => {
    const statusConfig = STATUS_CONFIG[job.status];

    return (
      <TouchableOpacity
        key={job.id}
        style={styles.jobCard}
        onPress={() => {
          setSelectedJob(job);
          setShowJobModal(true);
        }}
      >
        <View style={styles.jobHeader}>
          <View style={styles.cropInfo}>
            <Text style={styles.cropType}>{job.cropType}</Text>
            <Text style={styles.quantity}>{job.quantity} {job.unit}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Ionicons name={statusConfig.icon as any} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: '#2E7D32' }]} />
            <View style={styles.routeTextContainer}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeLocation} numberOfLines={1}>{job.pickupLocation}</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: '#D32F2F' }]} />
            <View style={styles.routeTextContainer}>
              <Text style={styles.routeLabel}>Delivery</Text>
              <Text style={styles.routeLocation} numberOfLines={1}>{job.deliveryLocation}</Text>
            </View>
          </View>
        </View>

        <View style={styles.jobFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="navigate" size={16} color="#666" />
            <Text style={styles.footerText}>{job.distance} km</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.footerText}>By {job.deliveryDeadline.split(' ')[1]}</Text>
          </View>
          <View style={styles.paymentBadge}>
            <Text style={styles.paymentText}>KSh {job.payment.toLocaleString()}</Text>
          </View>
        </View>

        {showActions && job.status !== 'available' && job.status !== 'completed' && (
          <TouchableOpacity
            style={styles.updateButton}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedJob(job);
              setShowUpdateModal(true);
            }}
          >
            <Text style={styles.updateButtonText}>{getNextStatusLabel(job.status)}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <View style={styles.statsHeader}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>KSh {todayEarnings.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Today's Earnings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{activeDeliveries}</Text>
          <Text style={styles.statLabel}>Active Jobs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{completedToday}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.activeTab]}
          onPress={() => setActiveTab('available')}
        >
          <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>
            Available ({availableJobs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my_jobs' && styles.activeTab]}
          onPress={() => setActiveTab('my_jobs')}
        >
          <Text style={[styles.tabText, activeTab === 'my_jobs' && styles.activeTabText]}>
            My Jobs ({myJobs.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'available' ? (
          availableJobs.length > 0 ? (
            availableJobs.map(job => renderJobCard(job, false))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No Available Jobs</Text>
              <Text style={styles.emptyText}>
                New delivery jobs will appear here. Pull down to refresh.
              </Text>
            </View>
          )
        ) : (
          myJobs.length > 0 ? (
            myJobs.map(job => renderJobCard(job, true))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No Active Jobs</Text>
              <Text style={styles.emptyText}>
                Accept a job from the Available tab to get started.
              </Text>
            </View>
          )
        )}

        {/* AI Route Optimization Tip */}
        {myJobs.length > 1 && (
          <View style={styles.aiTipCard}>
            <View style={styles.aiTipHeader}>
              <Ionicons name="bulb" size={20} color="#F57C00" />
              <Text style={styles.aiTipTitle}>AI Route Suggestion</Text>
            </View>
            <Text style={styles.aiTipText}>
              Optimize your route: Deliver to Githurai first, then Muthurwa Market.
              This saves 12km and 25 minutes of travel time.
            </Text>
            <TouchableOpacity style={styles.aiTipButton}>
              <Text style={styles.aiTipButtonText}>View Optimized Route</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Job Detail Modal */}
      <Modal
        visible={showJobModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJobModal(false)}
      >
        {selectedJob && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Job Details</Text>
              <TouchableOpacity onPress={() => setShowJobModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Cargo Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Cargo Information</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Crop Type</Text>
                  <Text style={styles.infoValue}>{selectedJob.cropType}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Quantity</Text>
                  <Text style={styles.infoValue}>{selectedJob.quantity} {selectedJob.unit}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Distance</Text>
                  <Text style={styles.infoValue}>{selectedJob.distance} km</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Payment</Text>
                  <Text style={[styles.infoValue, styles.paymentValue]}>
                    KSh {selectedJob.payment.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Route Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Route</Text>
                <View style={styles.fullRouteContainer}>
                  <View style={styles.fullRoutePoint}>
                    <View style={[styles.fullRouteDot, { backgroundColor: '#2E7D32' }]}>
                      <Ionicons name="arrow-up" size={14} color="#fff" />
                    </View>
                    <View style={styles.fullRouteInfo}>
                      <Text style={styles.fullRouteLabel}>Pickup Location</Text>
                      <Text style={styles.fullRouteAddress}>{selectedJob.pickupLocation}</Text>
                      {selectedJob.pickupTime && (
                        <Text style={styles.fullRouteTime}>Pickup: {selectedJob.pickupTime}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.fullRouteLine} />
                  <View style={styles.fullRoutePoint}>
                    <View style={[styles.fullRouteDot, { backgroundColor: '#D32F2F' }]}>
                      <Ionicons name="arrow-down" size={14} color="#fff" />
                    </View>
                    <View style={styles.fullRouteInfo}>
                      <Text style={styles.fullRouteLabel}>Delivery Location</Text>
                      <Text style={styles.fullRouteAddress}>{selectedJob.deliveryLocation}</Text>
                      <Text style={styles.fullRouteTime}>Deadline: {selectedJob.deliveryDeadline}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Contact Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Contacts</Text>
                <View style={styles.contactCard}>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactRole}>Farmer</Text>
                    <Text style={styles.contactName}>{selectedJob.farmerName}</Text>
                  </View>
                  <TouchableOpacity style={styles.callButton}>
                    <Ionicons name="call" size={20} color="#2E7D32" />
                  </TouchableOpacity>
                </View>
                <View style={styles.contactCard}>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactRole}>Buyer</Text>
                    <Text style={styles.contactName}>{selectedJob.buyerName}</Text>
                  </View>
                  <TouchableOpacity style={styles.callButton}>
                    <Ionicons name="call" size={20} color="#2E7D32" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Special Instructions */}
              {selectedJob.specialInstructions && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Special Instructions</Text>
                  <View style={styles.instructionsBox}>
                    <Ionicons name="warning" size={20} color="#F57C00" />
                    <Text style={styles.instructionsText}>{selectedJob.specialInstructions}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Action Button */}
            {selectedJob.status === 'available' && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => acceptJob(selectedJob)}
                >
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.acceptButtonText}>Accept Job</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </Modal>

      {/* Status Update Modal */}
      <Modal
        visible={showUpdateModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowUpdateModal(false)}
      >
        <View style={styles.updateModalOverlay}>
          <View style={styles.updateModalContent}>
            <Text style={styles.updateModalTitle}>Update Delivery Status</Text>

            {selectedJob && (
              <>
                <Text style={styles.updateModalSubtitle}>
                  {selectedJob.cropType} - {selectedJob.quantity} {selectedJob.unit}
                </Text>

                <View style={styles.statusFlow}>
                  {(['accepted', 'picked_up', 'in_transit', 'delivered', 'completed'] as DeliveryStatus[]).map((status, index) => {
                    const config = STATUS_CONFIG[status];
                    const isActive = status === selectedJob.status;
                    const isPast = ['available', 'accepted', 'picked_up', 'in_transit', 'delivered', 'completed']
                      .indexOf(selectedJob.status) > ['available', 'accepted', 'picked_up', 'in_transit', 'delivered', 'completed'].indexOf(status);

                    return (
                      <View key={status} style={styles.statusFlowItem}>
                        <View style={[
                          styles.statusFlowDot,
                          { backgroundColor: isPast ? '#2E7D32' : isActive ? config.color : '#E0E0E0' }
                        ]}>
                          {isPast && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        <Text style={[
                          styles.statusFlowLabel,
                          { color: isActive ? config.color : isPast ? '#2E7D32' : '#999' }
                        ]}>
                          {config.label}
                        </Text>
                        {index < 4 && <View style={[
                          styles.statusFlowLine,
                          { backgroundColor: isPast ? '#2E7D32' : '#E0E0E0' }
                        ]} />}
                      </View>
                    );
                  })}
                </View>

                {selectedJob.status === 'delivered' && (
                  <View style={styles.noteInput}>
                    <Text style={styles.noteLabel}>Delivery Note (Optional)</Text>
                    <TextInput
                      style={styles.noteTextInput}
                      placeholder="Add any notes about the delivery..."
                      value={deliveryNote}
                      onChangeText={setDeliveryNote}
                      multiline
                    />
                  </View>
                )}

                <View style={styles.updateModalActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowUpdateModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  {getNextStatus(selectedJob.status) && (
                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={() => {
                        const nextStatus = getNextStatus(selectedJob.status);
                        if (nextStatus) {
                          updateJobStatus(selectedJob, nextStatus);
                        }
                      }}
                    >
                      <Text style={styles.confirmButtonText}>
                        {getNextStatusLabel(selectedJob.status)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
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
    backgroundColor: '#F5F5F5',
  },
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E9',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  activeTab: {
    backgroundColor: '#E8F5E9',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#2E7D32',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cropInfo: {
    flex: 1,
  },
  cropType: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  quantity: {
    fontSize: 14,
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
  routeContainer: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeTextContainer: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
  },
  routeLocation: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E0E0E0',
    marginLeft: 4,
    marginVertical: 2,
  },
  jobFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 13,
    color: '#666',
  },
  paymentBadge: {
    marginLeft: 'auto',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  aiTipCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F57C00',
  },
  aiTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiTipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  aiTipText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  aiTipButton: {
    marginTop: 12,
  },
  aiTipButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F57C00',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentValue: {
    color: '#2E7D32',
    fontSize: 16,
  },
  fullRouteContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  fullRoutePoint: {
    flexDirection: 'row',
    gap: 12,
  },
  fullRouteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullRouteInfo: {
    flex: 1,
  },
  fullRouteLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
  },
  fullRouteAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  fullRouteTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  fullRouteLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E0E0E0',
    marginLeft: 13,
    marginVertical: 4,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
  },
  contactRole: {
    fontSize: 12,
    color: '#999',
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionsBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    gap: 10,
    alignItems: 'flex-start',
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Update Modal
  updateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  updateModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  updateModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  updateModalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  statusFlow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statusFlowItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusFlowDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusFlowLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  statusFlowLine: {
    position: 'absolute',
    height: 2,
    width: '100%',
    top: 11,
    left: '50%',
    zIndex: -1,
  },
  noteInput: {
    marginBottom: 16,
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  noteTextInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  updateModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#2E7D32',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
