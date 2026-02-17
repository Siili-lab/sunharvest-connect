import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/primitives/Text';
import { Input } from '../components/primitives/Input';
import { Button } from '../components/primitives/Button';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { colors, spacing, radius, shadows } from '@/theme';
import {
  getAvailableDeliveries, getMyDeliveries, acceptDelivery, completeDelivery,
  AvailableDelivery, MyDelivery,
} from '../services/api';

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
  available: { label: 'Available', color: colors.primary[800], icon: 'radio-button-on' },
  accepted: { label: 'Accepted', color: colors.semantic.info, icon: 'checkmark-circle' },
  picked_up: { label: 'Picked Up', color: '#7B1FA2', icon: 'cube' },
  in_transit: { label: 'In Transit', color: '#F57C00', icon: 'car' },
  delivered: { label: 'Delivered', color: '#00897B', icon: 'location' },
  completed: { label: 'Completed', color: colors.primary[700], icon: 'checkmark-done-circle' },
};

// Helper to map API data to the UI DeliveryJob shape
function mapAvailableToJob(d: AvailableDelivery): DeliveryJob {
  const crop = typeof d.crop === 'string'
    ? d.crop.charAt(0) + d.crop.slice(1).toLowerCase()
    : d.crop;
  return {
    id: d.transactionId,
    cropType: crop,
    quantity: d.quantity,
    unit: d.unit,
    pickupLocation: d.pickup.county,
    deliveryLocation: d.delivery.county || 'TBD',
    distance: 0,
    payment: d.agreedPrice,
    status: 'available',
    farmerName: d.pickup.farmerName,
    farmerPhone: d.pickup.farmerPhone,
    buyerName: d.delivery.buyerName,
    buyerPhone: d.delivery.buyerPhone,
    deliveryDeadline: new Date(d.createdAt).toLocaleDateString(),
  };
}

function mapMyDeliveryToJob(d: MyDelivery): DeliveryJob {
  const crop = typeof d.crop === 'string'
    ? d.crop.charAt(0) + d.crop.slice(1).toLowerCase()
    : d.crop;
  // Map backend statuses to local UI statuses
  const statusMap: Record<string, DeliveryStatus> = {
    IN_TRANSIT: 'in_transit',
    DELIVERED: 'delivered',
    COMPLETED: 'completed',
    PAID: 'accepted',
  };
  return {
    id: d.transactionId,
    cropType: crop,
    quantity: d.quantity,
    unit: d.unit,
    pickupLocation: d.pickup.county,
    deliveryLocation: d.delivery.county || 'TBD',
    distance: 0,
    payment: d.agreedPrice,
    status: statusMap[d.status] || 'accepted',
    farmerName: d.pickup.farmerName,
    farmerPhone: d.pickup.farmerPhone,
    buyerName: d.delivery.buyerName,
    buyerPhone: d.delivery.buyerPhone,
    pickupTime: d.pickupDate || undefined,
    deliveryDeadline: d.deliveredAt || new Date(d.createdAt).toLocaleDateString(),
  };
}

export default function DeliveriesScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'my_jobs'>('available');
  const [selectedJob, setSelectedJob] = useState<DeliveryJob | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');

  const loadJobs = useCallback(async () => {
    try {
      const [available, mine] = await Promise.all([
        getAvailableDeliveries().catch(() => []),
        user?.id ? getMyDeliveries(user.id).catch(() => []) : Promise.resolve([]),
      ]);

      const allJobs: DeliveryJob[] = [
        ...available.map(mapAvailableToJob),
        ...mine.map(mapMyDeliveryToJob),
      ];
      setJobs(allJobs);
    } catch {
      // Keep whatever jobs we have
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  const availableJobs = jobs.filter(j => j.status === 'available');
  const myJobs = jobs.filter(j => j.status !== 'available' && j.status !== 'completed');
  const completedJobs = jobs.filter(j => j.status === 'completed');

  const todayEarnings = completedJobs.reduce((sum, j) => sum + j.payment, 0);
  const activeDeliveries = myJobs.length;
  const completedToday = completedJobs.length;

  const acceptJob = (job: DeliveryJob) => {
    Alert.alert(
      t('accept_job'),
      `Accept delivery of ${job.quantity}${job.unit} ${job.cropType} for KSh ${job.payment.toLocaleString()}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('accept_job'),
          onPress: async () => {
            try {
              await acceptDelivery(job.id, user?.id || '');
              setJobs(prev => prev.map(j =>
                j.id === job.id ? { ...j, status: 'accepted' as DeliveryStatus } : j
              ));
              setShowJobModal(false);
              showToast(`${t('job_accepted')} ${t('contact_farmer_pickup')}`, 'success');
            } catch (err: any) {
              const msg = err?.response?.data?.error?.message || 'Failed to accept job';
              showToast(msg, 'error');
            }
          },
        },
      ]
    );
  };

  const updateJobStatus = async (job: DeliveryJob, newStatus: DeliveryStatus) => {
    const statusMessages: Record<DeliveryStatus, string> = {
      available: '',
      accepted: t('job_accepted'),
      picked_up: 'Cargo picked up from farmer',
      in_transit: 'Delivery in progress',
      delivered: 'Cargo delivered to buyer',
      completed: 'Delivery completed and payment received',
    };

    // For the "delivered" transition, call the backend complete endpoint
    if (newStatus === 'delivered' || newStatus === 'completed') {
      try {
        await completeDelivery(job.id);
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || 'Failed to update status';
        showToast(msg, 'error');
        return;
      }
    }

    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, status: newStatus } : j
    ));
    setShowUpdateModal(false);
    setSelectedJob(null);
    showToast(statusMessages[newStatus], 'success');
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
      available: t('accept_job'),
      accepted: t('mark_picked_up'),
      picked_up: t('start_delivery'),
      in_transit: t('delivered'),
      delivered: t('complete_get_paid'),
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
        accessibilityLabel={`${job.cropType} ${t('delivery')} - ${job.quantity} ${job.unit}`}
        accessibilityHint={`Tap to view details for ${job.cropType} delivery`}
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
            <View style={[styles.routeDot, { backgroundColor: colors.primary[800] }]} />
            <View style={styles.routeTextContainer}>
              <Text style={styles.routeLabel}>{t('pickup')}</Text>
              <Text style={styles.routeLocation} numberOfLines={1}>{job.pickupLocation}</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: colors.semantic.error }]} />
            <View style={styles.routeTextContainer}>
              <Text style={styles.routeLabel}>{t('delivery')}</Text>
              <Text style={styles.routeLocation} numberOfLines={1}>{job.deliveryLocation}</Text>
            </View>
          </View>
        </View>

        <View style={styles.jobFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="navigate" size={spacing[4]} color={colors.neutral[600]} />
            <Text style={styles.footerText}>{job.distance} km</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="time" size={spacing[4]} color={colors.neutral[600]} />
            <Text style={styles.footerText}>{t('deadline')} {job.deliveryDeadline.split(' ')[1]}</Text>
          </View>
          <View style={styles.paymentBadge}>
            <Text style={styles.paymentText}>KSh {job.payment.toLocaleString()}</Text>
          </View>
        </View>

        {showActions && job.status !== 'available' && job.status !== 'completed' && (
          <Button
            variant="primary"
            size="medium"
            fullWidth
            onPress={() => {
              setSelectedJob(job);
              setShowUpdateModal(true);
            }}
            accessibilityLabel={getNextStatusLabel(job.status)}
            rightIcon={<Ionicons name="arrow-forward" size={spacing[4]} color={colors.neutral[0]} />}
            style={styles.updateButton}
          >
            {getNextStatusLabel(job.status)}
          </Button>
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
          <Text style={styles.statLabel}>{t('todays_earnings')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{activeDeliveries}</Text>
          <Text style={styles.statLabel}>{t('active_jobs')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{completedToday}</Text>
          <Text style={styles.statLabel}>{t('completed')}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.activeTab]}
          onPress={() => setActiveTab('available')}
          accessibilityLabel={`${t('available_jobs')} (${availableJobs.length})`}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'available' }}
        >
          <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>
            {t('available_jobs')} ({availableJobs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my_jobs' && styles.activeTab]}
          onPress={() => setActiveTab('my_jobs')}
          accessibilityLabel={`${t('my_jobs')} (${myJobs.length})`}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'my_jobs' }}
        >
          <Text style={[styles.tabText, activeTab === 'my_jobs' && styles.activeTabText]}>
            {t('my_jobs')} ({myJobs.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary[800]} />
            <Text style={styles.emptyText}>{t('loading')}</Text>
          </View>
        ) : activeTab === 'available' ? (
          availableJobs.length > 0 ? (
            availableJobs.map(job => renderJobCard(job, false))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={64} color={colors.neutral[300]} />
              <Text style={styles.emptyTitle}>{t('no_available_jobs')}</Text>
              <Text style={styles.emptyText}>
                {t('pull_to_refresh')}
              </Text>
            </View>
          )
        ) : (
          myJobs.length > 0 ? (
            myJobs.map(job => renderJobCard(job, true))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={64} color={colors.neutral[300]} />
              <Text style={styles.emptyTitle}>{t('no_active_jobs')}</Text>
              <Text style={styles.emptyText}>
                {t('no_active_jobs')}
              </Text>
            </View>
          )
        )}

        {/* AI Route Optimization Tip */}
        {myJobs.length > 1 && (
          <View style={styles.aiTipCard}>
            <View style={styles.aiTipHeader}>
              <Ionicons name="bulb" size={spacing[5]} color={colors.semantic.warning} />
              <Text style={styles.aiTipTitle}>{t('ai_route_suggestion')}</Text>
            </View>
            <Text style={styles.aiTipText}>
              Optimize your route: Deliver to Githurai first, then Muthurwa Market.
              This saves 12km and 25 minutes of travel time.
            </Text>
            <TouchableOpacity
              style={styles.aiTipButton}
              accessibilityLabel={t('optimized_route')}
              accessibilityRole="button"
            >
              <Text style={styles.aiTipButtonText}>{t('optimized_route')}</Text>
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
              <Text style={styles.modalTitle}>{t('cargo_info')}</Text>
              <TouchableOpacity
                onPress={() => setShowJobModal(false)}
                accessibilityLabel={t('close')}
                accessibilityRole="button"
              >
                <Ionicons name="close" size={spacing[6]} color={colors.neutral[900]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Cargo Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>{t('cargo_information')}</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('crop_type_label')}</Text>
                  <Text style={styles.infoValue}>{selectedJob.cropType}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('quantity')}</Text>
                  <Text style={styles.infoValue}>{selectedJob.quantity} {selectedJob.unit}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('distance')}</Text>
                  <Text style={styles.infoValue}>{selectedJob.distance} km</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('payment')}</Text>
                  <Text style={[styles.infoValue, styles.paymentValue]}>
                    KSh {selectedJob.payment.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Route Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>{t('route')}</Text>
                <View style={styles.fullRouteContainer}>
                  <View style={styles.fullRoutePoint}>
                    <View style={[styles.fullRouteDot, { backgroundColor: colors.primary[800] }]}>
                      <Ionicons name="arrow-up" size={14} color={colors.neutral[0]} />
                    </View>
                    <View style={styles.fullRouteInfo}>
                      <Text style={styles.fullRouteLabel}>{t('pickup')}</Text>
                      <Text style={styles.fullRouteAddress}>{selectedJob.pickupLocation}</Text>
                      {selectedJob.pickupTime && (
                        <Text style={styles.fullRouteTime}>{t('pickup')}: {selectedJob.pickupTime}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.fullRouteLine} />
                  <View style={styles.fullRoutePoint}>
                    <View style={[styles.fullRouteDot, { backgroundColor: colors.semantic.error }]}>
                      <Ionicons name="arrow-down" size={14} color={colors.neutral[0]} />
                    </View>
                    <View style={styles.fullRouteInfo}>
                      <Text style={styles.fullRouteLabel}>{t('delivery')}</Text>
                      <Text style={styles.fullRouteAddress}>{selectedJob.deliveryLocation}</Text>
                      <Text style={styles.fullRouteTime}>{t('deadline')}: {selectedJob.deliveryDeadline}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Contact Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>{t('contacts')}</Text>
                <View style={styles.contactCard}>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactRole}>{t('farmer')}</Text>
                    <Text style={styles.contactName}>{selectedJob.farmerName}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.callButton}
                    accessibilityLabel={`${t('call')} ${selectedJob.farmerName}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="call" size={spacing[5]} color={colors.primary[800]} />
                  </TouchableOpacity>
                </View>
                <View style={styles.contactCard}>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactRole}>{t('buyer')}</Text>
                    <Text style={styles.contactName}>{selectedJob.buyerName}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.callButton}
                    accessibilityLabel={`${t('call')} ${selectedJob.buyerName}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="call" size={spacing[5]} color={colors.primary[800]} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Special Instructions */}
              {selectedJob.specialInstructions && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>{t('special_instructions')}</Text>
                  <View style={styles.instructionsBox}>
                    <Ionicons name="warning" size={spacing[5]} color={colors.semantic.warning} />
                    <Text style={styles.instructionsText}>{selectedJob.specialInstructions}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Action Button */}
            {selectedJob.status === 'available' && (
              <View style={styles.modalFooter}>
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  onPress={() => acceptJob(selectedJob)}
                  accessibilityLabel={t('accept_job')}
                  leftIcon={<Ionicons name="checkmark-circle" size={spacing[6]} color={colors.neutral[0]} />}
                  style={styles.acceptButton}
                >
                  {t('accept_job')}
                </Button>
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
            <Text style={styles.updateModalTitle}>{t('update_status')}</Text>

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
                          { backgroundColor: isPast ? colors.primary[800] : isActive ? config.color : colors.border.light }
                        ]}>
                          {isPast && <Ionicons name="checkmark" size={spacing[3]} color={colors.neutral[0]} />}
                        </View>
                        <Text style={[
                          styles.statusFlowLabel,
                          { color: isActive ? config.color : isPast ? colors.primary[800] : colors.neutral[500] }
                        ]}>
                          {config.label}
                        </Text>
                        {index < 4 && <View style={[
                          styles.statusFlowLine,
                          { backgroundColor: isPast ? colors.primary[800] : colors.border.light }
                        ]} />}
                      </View>
                    );
                  })}
                </View>

                {selectedJob.status === 'delivered' && (
                  <View style={styles.noteInput}>
                    <Input
                      label={t('delivery_note')}
                      placeholder={t('enter_delivery_note')}
                      value={deliveryNote}
                      onChangeText={setDeliveryNote}
                      multiline
                      inputStyle={styles.noteTextInput}
                      accessibilityLabel={t('delivery_note')}
                    />
                  </View>
                )}

                <View style={styles.updateModalActions}>
                  <Button
                    variant="outline"
                    size="medium"
                    onPress={() => setShowUpdateModal(false)}
                    accessibilityLabel={t('cancel')}
                    style={styles.cancelButton}
                  >
                    {t('cancel')}
                  </Button>
                  {getNextStatus(selectedJob.status) && (
                    <Button
                      variant="primary"
                      size="medium"
                      onPress={() => {
                        const nextStatus = getNextStatus(selectedJob.status);
                        if (nextStatus) {
                          updateJobStatus(selectedJob, nextStatus);
                        }
                      }}
                      accessibilityLabel={getNextStatusLabel(selectedJob.status)}
                      style={styles.confirmButton}
                    >
                      {getNextStatusLabel(selectedJob.status)}
                    </Button>
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
    backgroundColor: colors.neutral[100],
  },
  statsHeader: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[50],
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary[800],
  },
  statLabel: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: spacing[0.5],
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing[1],
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    padding: spacing[2],
    gap: spacing[2],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[2.5],
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
  activeTab: {
    backgroundColor: colors.primary[50],
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  activeTabText: {
    color: colors.primary[800],
  },
  scrollView: {
    flex: 1,
    padding: spacing[4],
  },
  jobCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  cropInfo: {
    flex: 1,
  },
  cropType: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  quantity: {
    fontSize: 14,
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
  routeContainer: {
    marginBottom: spacing[3],
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
  },
  routeDot: {
    width: spacing[2.5],
    height: spacing[2.5],
    borderRadius: radius.full,
  },
  routeTextContainer: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  routeLocation: {
    fontSize: 14,
    color: colors.neutral[900],
    fontWeight: '500',
  },
  routeLine: {
    width: 2,
    height: spacing[5],
    backgroundColor: colors.border.light,
    marginLeft: spacing[1],
    marginVertical: spacing[0.5],
  },
  jobFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    gap: spacing[4],
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  footerText: {
    fontSize: 13,
    color: colors.neutral[600],
  },
  paymentBadge: {
    marginLeft: 'auto',
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.xl,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[800],
  },
  updateButton: {
    marginTop: spacing[3],
    borderRadius: radius.md,
  },
  updateButtonText: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral[900],
    marginTop: spacing[4],
  },
  emptyText: {
    fontSize: 14,
    color: colors.neutral[600],
    textAlign: 'center',
    marginTop: spacing[2],
    paddingHorizontal: spacing[10],
  },
  aiTipCard: {
    backgroundColor: colors.accent[50],
    borderRadius: radius.lg,
    padding: spacing[4],
    marginTop: spacing[2],
    borderLeftWidth: 4,
    borderLeftColor: colors.semantic.warning,
  },
  aiTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  aiTipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent[900],
  },
  aiTipText: {
    fontSize: 13,
    color: colors.neutral[600],
    lineHeight: 18,
  },
  aiTipButton: {
    marginTop: spacing[3],
  },
  aiTipButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.semantic.warning,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  modalContent: {
    flex: 1,
    padding: spacing[4],
  },
  modalSection: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
    textTransform: 'uppercase',
    marginBottom: spacing[3],
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  infoLabel: {
    fontSize: 14,
    color: colors.neutral[600],
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  paymentValue: {
    color: colors.primary[800],
    fontSize: 16,
  },
  fullRouteContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  fullRoutePoint: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  fullRouteDot: {
    width: spacing[7],
    height: spacing[7],
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullRouteInfo: {
    flex: 1,
  },
  fullRouteLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  fullRouteAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
    marginTop: spacing[0.5],
  },
  fullRouteTime: {
    fontSize: 12,
    color: colors.neutral[600],
    marginTop: spacing[1],
  },
  fullRouteLine: {
    width: 2,
    height: spacing[6],
    backgroundColor: colors.border.light,
    marginLeft: 13,
    marginVertical: spacing[1],
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    padding: spacing[3],
    borderRadius: radius.md,
    marginBottom: spacing[2],
  },
  contactInfo: {
    flex: 1,
  },
  contactRole: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  callButton: {
    width: spacing[10],
    height: spacing[10],
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionsBox: {
    flexDirection: 'row',
    backgroundColor: colors.accent[50],
    padding: spacing[3],
    borderRadius: radius.md,
    gap: spacing[2.5],
    alignItems: 'flex-start',
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral[600],
    lineHeight: 20,
  },
  modalFooter: {
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  acceptButton: {
    borderRadius: radius.lg,
  },
  acceptButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '700',
  },
  // Update Modal
  updateModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
    justifyContent: 'center',
    padding: spacing[5],
  },
  updateModalContent: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[5],
  },
  updateModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[900],
    textAlign: 'center',
  },
  updateModalSubtitle: {
    fontSize: 14,
    color: colors.neutral[600],
    textAlign: 'center',
    marginTop: spacing[1],
    marginBottom: spacing[5],
  },
  statusFlow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[5],
  },
  statusFlowItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusFlowDot: {
    width: spacing[6],
    height: spacing[6],
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusFlowLabel: {
    fontSize: 10,
    marginTop: spacing[1],
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
    marginBottom: spacing[4],
  },
  noteTextInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  updateModalActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 2,
  },
});
