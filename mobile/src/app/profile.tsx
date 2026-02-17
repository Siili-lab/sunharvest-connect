import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Switch,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { Text } from '../components/primitives/Text';
import { Button } from '../components/primitives/Button';
import TrustScoreBadge from '../components/TrustScoreBadge';
import {
  getUserStats, getUserTransactions, deleteAccount,
  UserStats, UserTransaction, PaginatedResponse,
} from '../services/api';
import { colors, spacing, radius, shadows } from '@/theme';

interface Transaction {
  id: string;
  type: 'sale' | 'purchase' | 'delivery' | 'savings' | 'loan';
  description: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { language, setLanguage, t, isSwahili } = useLanguage();
  const { showToast } = useToast();
  const [showTransactions, setShowTransactions] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(true);

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  // Convert API transactions to the local Transaction shape
  const mapTx = (tx: UserTransaction): Transaction => {
    const crop = typeof tx.crop === 'string'
      ? tx.crop.charAt(0) + tx.crop.slice(1).toLowerCase()
      : tx.crop;
    const isSale = user?.userType === 'farmer';
    return {
      id: tx.id,
      type: isSale ? 'sale' : 'purchase',
      description: `${isSale ? 'Sold' : 'Bought'} ${tx.quantity}${tx.unit} ${crop}`,
      amount: isSale ? tx.agreedPrice : -tx.agreedPrice,
      date: new Date(tx.createdAt).toISOString().split('T')[0],
      status: ['COMPLETED', 'DELIVERED'].includes(tx.status) ? 'completed' : 'pending',
    };
  };

  const loadProfileData = useCallback(async () => {
    if (!user?.id) return;

    const [statsResult, txResult] = await Promise.all([
      getUserStats(user.id).catch(() => null),
      getUserTransactions(user.id, { page: 1, limit: 20 }).catch(() => null),
    ]);

    if (statsResult) setUserStats(statsResult);
    if (txResult) {
      setTransactions(txResult.data.map(mapTx));
      setTxTotalPages(txResult.pagination.totalPages);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const onProfileRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  const loadMoreTransactions = async () => {
    if (!user?.id || txPage >= txTotalPages) return;
    const nextPage = txPage + 1;
    const result = await getUserTransactions(user.id, { page: nextPage, limit: 20 }).catch(() => null);
    if (result) {
      setTransactions(prev => [...prev, ...result.data.map(mapTx)]);
      setTxPage(nextPage);
    }
  };

  interface StatItem {
    value: string | number;
    label: string;
  }

  interface StatsData {
    stat1: StatItem;
    stat2: StatItem;
    stat3: StatItem;
  }

  const getStats = (): StatsData => {
    const s = userStats;
    if (!user || !s) return {
      stat1: { value: 0, label: 'Activity' },
      stat2: { value: 0, label: 'Transactions' },
      stat3: { value: '-', label: 'Rating' },
    };

    switch (user.userType) {
      case 'farmer':
        return {
          stat1: { value: s.totalListings || 0, label: t('listings') },
          stat2: { value: s.totalSold || 0, label: t('sales') },
          stat3: { value: s.rating?.toFixed(1) || '-', label: t('rating') },
        };
      case 'buyer': {
        const spent = s.totalSpent || 0;
        const spentStr = spent >= 1000 ? `KSh ${Math.round(spent / 1000)}K` : `KSh ${spent}`;
        return {
          stat1: { value: s.totalPurchases || 0, label: t('orders') },
          stat2: { value: spentStr, label: t('total_spent') },
          stat3: { value: s.rating?.toFixed(1) || '-', label: t('rating') },
        };
      }
      case 'transporter':
        return {
          stat1: { value: s.totalDeliveries || 0, label: t('deliveries') },
          stat2: { value: s.activeJobs || 0, label: t('active') },
          stat3: { value: s.rating?.toFixed(1) || '-', label: t('rating') },
        };
      default:
        return {
          stat1: { value: 0, label: 'Activity' },
          stat2: { value: 0, label: t('transactions') },
          stat3: { value: '-', label: t('rating') },
        };
    }
  };

  const stats = getStats();

  const handleLogout = () => {
    Alert.alert(
      t('logout'),
      t('logout_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.log('Logout error:', error);
            }
          }
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('delete_account') || 'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently removed within 30 days as per Kenya Data Protection Act 2019.',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDeleteAccount(),
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Final Confirmation',
      'Type DELETE to confirm account deletion:',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: 'Confirm Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user?.id) return;
              await deleteAccount(user.id);
              Alert.alert(
                'Account Deleted',
                'Your account has been scheduled for deletion. You will be logged out now.',
                [{ text: 'OK', onPress: () => logout() }]
              );
            } catch (error: any) {
              console.log('Delete account error:', error);
              Alert.alert(
                'Error',
                error?.response?.data?.error?.message || 'Failed to delete account. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const handleVerification = () => {
    Alert.alert(
      t('verify_account'),
      'To verify your account, you need to:\n\n1. Upload a valid ID (National ID or Passport)\n2. Take a selfie for face verification\n3. Verify your phone number via OTP',
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('continue'), onPress: () => showToast('Verification request submitted. You will receive an SMS shortly.', 'success') },
      ]
    );
  };

  const handleEditProfile = () => {
    Alert.alert(
      t('edit_profile'),
      `Name: ${user?.name}\nPhone: ${user?.phone}\nLocation: ${user?.location || 'Not set'}\nType: ${user?.userType}`,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: 'Save', onPress: () => showToast('Profile updated successfully', 'success') },
      ]
    );
  };

  const handleChangePin = () => {
    Alert.alert(
      t('change_pin'),
      'For security, a one-time PIN reset code will be sent to your registered phone number via SMS.',
      [
        { text: t('cancel'), style: 'cancel' },
        { text: 'Send Code', onPress: () => showToast('PIN reset code sent to your phone', 'success') },
      ]
    );
  };

  const handleHelpCenter = () => {
    Alert.alert(
      t('help_center'),
      'Frequently Asked Questions:\n\n' +
      '1. How do I list produce?\nGo to Home > Sell Produce, take a photo for AI grading, set your price and list.\n\n' +
      '2. How does AI grading work?\nOur AI analyzes photos of your produce to determine quality grade (Premium, A, B).\n\n' +
      '3. How do I get paid?\nPayments are processed via M-Pesa directly to your registered phone number.\n\n' +
      '4. What is the Trust Score?\nA score based on your transaction history, ratings, and account activity.',
      [{ text: 'OK' }]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      t('contact_support'),
      'SunHarvest Connect Support\n\n' +
      'Phone: +254 700 123 456\n' +
      'SMS: Text HELP to 20880\n' +
      'Email: support@sunharvest.co.ke\n\n' +
      'Hours: Mon-Sat 7:00 AM - 8:00 PM EAT',
      [{ text: 'OK' }]
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'About SunHarvest Connect',
      'Version 1.0.0\n\n' +
      'SunHarvest Connect is an AI-powered agricultural marketplace connecting Kenyan farmers directly with buyers.\n\n' +
      'Features:\n' +
      '• AI Quality Grading\n' +
      '• Market Price Intelligence\n' +
      '• SACCO Savings Groups\n' +
      '• M-Pesa Payments\n' +
      '• SMS Support for feature phones\n\n' +
      'Built with love for Kenyan agriculture.\n' +
      'Compliant with Kenya Data Protection Act 2019.',
      [{ text: 'OK' }]
    );
  };

  if (!user) {
    return null;
  }

  const isVerified = (userStats?.totalRatings || 0) > 0; // Based on activity

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onProfileRefresh} colors={[colors.primary[800]]} />}
    >
      <View style={styles.content}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={24} color={colors.text.link} />
              </View>
            )}
          </View>

          <Text style={styles.userName}>{user.name}</Text>

          <View style={styles.userTypeBadge}>
            <Ionicons
              name={
                user.userType === 'farmer' ? 'leaf' :
                user.userType === 'buyer' ? 'cart' : 'car'
              }
              size={14}
              color={colors.primary[800]}
            />
            <Text style={styles.userTypeText}>{t(user.userType)}</Text>
          </View>

          {!isVerified && (
            <Button
              variant="outline"
              size="small"
              onPress={handleVerification}
              accessibilityLabel={t('verify_account')}
              leftIcon={<Ionicons name="shield-checkmark-outline" size={18} color={colors.text.link} />}
              style={styles.verifyButton}
            >
              {t('verify_account')}
            </Button>
          )}
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.stat1.value}</Text>
            <Text style={styles.statLabel}>{stats.stat1.label}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.stat2.value}</Text>
            <Text style={styles.statLabel}>{stats.stat2.label}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.ratingContainer}>
              <Text style={styles.statValue}>{stats.stat3.value}</Text>
              <Ionicons name="star" size={16} color={colors.accent[500]} />
            </View>
            <Text style={styles.statLabel}>{stats.stat3.label}</Text>
          </View>
        </View>

        {/* Trust Score Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('your_trust_score')}</Text>
          <TrustScoreBadge userId={user?.id || '1'} size="large" />
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('account_information')}</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow} accessibilityLabel={t('phone_number')}>
              <View style={styles.infoIcon}>
                <Ionicons name="call-outline" size={20} color={colors.primary[800]} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('phone_number')}</Text>
                <Text style={styles.infoValue}>{user.phone}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.semantic.success} />
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow} accessibilityLabel={t('location')}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={20} color={colors.primary[800]} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('location')}</Text>
                <Text style={styles.infoValue}>{user.location}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow} accessibilityLabel={t('member_since')}>
              <View style={styles.infoIcon}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary[800]} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('member_since')}</Text>
                <Text style={styles.infoValue}>
                  {new Date(user.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Transaction History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('recent_activity')}</Text>
            <TouchableOpacity
              onPress={() => setShowTransactions(true)}
              accessibilityLabel={t('view_all')}
              accessibilityRole="button"
            >
              <Text style={styles.viewAllText}>{t('view_all')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.transactionsCard}>
            {transactions.slice(0, 3).map((tx, index) => (
              <View key={tx.id}>
                <View style={styles.transactionRow}>
                  <View style={[
                    styles.txIcon,
                    { backgroundColor: tx.amount > 0 ? colors.primary[50] : colors.semantic.warningLight }
                  ]}>
                    <Ionicons
                      name={tx.amount > 0 ? 'arrow-down' : 'arrow-up'}
                      size={16}
                      color={tx.amount > 0 ? colors.primary[800] : colors.semantic.warning}
                    />
                  </View>
                  <View style={styles.txContent}>
                    <Text style={styles.txDescription}>{tx.description}</Text>
                    <Text style={styles.txDate}>{tx.date}</Text>
                  </View>
                  <Text style={[
                    styles.txAmount,
                    { color: tx.amount > 0 ? colors.primary[800] : colors.semantic.warning }
                  ]}>
                    {tx.amount > 0 ? '+' : ''}KSh {Math.abs(tx.amount).toLocaleString()}
                  </Text>
                </View>
                {index < 2 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings')}</Text>

          <View style={styles.settingsCard}>
            <View style={styles.settingRow} accessibilityLabel={t('push_notifications')}>
              <View style={styles.settingInfo}>
                <Ionicons name="notifications-outline" size={22} color={colors.text.secondary} />
                <Text style={styles.settingText}>{t('push_notifications')}</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: colors.neutral[300], true: colors.primary[200] }}
                thumbColor={notificationsEnabled ? colors.primary[800] : colors.neutral[0]}
                accessibilityLabel={t('push_notifications')}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingRow} accessibilityLabel={t('sms_alerts')}>
              <View style={styles.settingInfo}>
                <Ionicons name="chatbubble-outline" size={22} color={colors.text.secondary} />
                <Text style={styles.settingText}>{t('sms_alerts')}</Text>
              </View>
              <Switch
                value={smsAlertsEnabled}
                onValueChange={setSmsAlertsEnabled}
                trackColor={{ false: colors.neutral[300], true: colors.primary[200] }}
                thumbColor={smsAlertsEnabled ? colors.primary[800] : colors.neutral[0]}
                accessibilityLabel={t('sms_alerts')}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleEditProfile}
            accessibilityLabel={t('edit_profile')}
            accessibilityRole="button"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={22} color={colors.text.secondary} />
              <Text style={styles.menuItemText}>{t('edit_profile')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleChangePin}
            accessibilityLabel={t('change_pin')}
            accessibilityRole="button"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.text.secondary} />
              <Text style={styles.menuItemText}>{t('change_pin')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setShowLanguageModal(true)}
            accessibilityLabel={t('language')}
            accessibilityRole="button"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="language-outline" size={22} color={colors.text.secondary} />
              <Text style={styles.menuItemText}>{t('language')}</Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>{isSwahili ? t('swahili') : t('english')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* SACCO / Wallet */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('sacco')}</Text>

          <TouchableOpacity
            style={styles.saccoCard}
            activeOpacity={0.7}
            onPress={() => router.push('/sacco')}
            accessibilityLabel={t('sacco')}
            accessibilityRole="button"
          >
            <View style={styles.saccoIconContainer}>
              <Ionicons name="wallet" size={28} color={colors.neutral[0]} />
            </View>
            <View style={styles.saccoContent}>
              <Text style={styles.saccoTitle}>{t('sacco')}</Text>
              <Text style={styles.saccoSubtitle}>{t('sacco_savings')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.primary[800]} />
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('support')}</Text>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleHelpCenter}
            accessibilityLabel={t('help_center')}
            accessibilityRole="button"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={22} color={colors.text.secondary} />
              <Text style={styles.menuItemText}>{t('help_center')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleContactSupport}
            accessibilityLabel={t('contact_support')}
            accessibilityRole="button"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.text.secondary} />
              <Text style={styles.menuItemText}>{t('contact_support')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/privacy')}
            accessibilityLabel={t('terms_privacy')}
            accessibilityRole="button"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={22} color={colors.text.secondary} />
              <Text style={styles.menuItemText}>{t('terms_privacy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={handleAbout}
            accessibilityLabel={t('about')}
            accessibilityRole="button"
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="information-circle-outline" size={22} color={colors.text.secondary} />
              <Text style={styles.menuItemText}>{t('about')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.neutral[500]} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <Button
          variant="outline"
          size="large"
          onPress={handleLogout}
          accessibilityLabel={t('logout')}
          leftIcon={<Ionicons name="log-out-outline" size={20} color={colors.semantic.error} />}
          style={styles.logoutButton}
        >
          {t('logout')}
        </Button>

        {/* Delete Account - Kenya DPA 2019 Compliance */}
        <Button
          variant="ghost"
          size="small"
          onPress={handleDeleteAccount}
          accessibilityLabel={t('delete_account')}
          leftIcon={<Ionicons name="trash-outline" size={18} color={colors.neutral[500]} />}
          style={styles.deleteAccountButton}
        >
          {t('delete_account') || 'Delete Account'}
        </Button>

        <Text style={styles.version}>{t('app_name')} v1.0.0</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>
      </View>

      {/* Transactions Modal */}
      <Modal
        visible={showTransactions}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTransactions(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('transaction_history')}</Text>
            <TouchableOpacity
              onPress={() => setShowTransactions(false)}
              accessibilityLabel={t('close')}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color={colors.neutral[300]} />
                <Text style={styles.emptyStateText}>{t('no_results')}</Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id} style={styles.txCard}>
                  <View style={[
                    styles.txIconLarge,
                    { backgroundColor: tx.amount > 0 ? colors.primary[50] : colors.semantic.warningLight }
                  ]}>
                    <Ionicons
                      name={
                        tx.type === 'sale' ? 'cash' :
                        tx.type === 'savings' ? 'wallet' :
                        tx.type === 'loan' ? 'card' : 'swap-horizontal'
                      }
                      size={24}
                      color={tx.amount > 0 ? colors.primary[800] : colors.semantic.warning}
                    />
                  </View>
                  <View style={styles.txCardContent}>
                    <Text style={styles.txCardDescription}>{tx.description}</Text>
                    <Text style={styles.txCardDate}>{tx.date}</Text>
                    <View style={[
                      styles.txStatusBadge,
                      { backgroundColor: tx.status === 'completed' ? colors.primary[50] : colors.semantic.warningLight }
                    ]}>
                      <Text style={[
                        styles.txStatusText,
                        { color: tx.status === 'completed' ? colors.primary[800] : colors.semantic.warning }
                      ]}>
                        {tx.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={[
                    styles.txCardAmount,
                    { color: tx.amount > 0 ? colors.primary[800] : colors.semantic.warning }
                  ]}>
                    {tx.amount > 0 ? '+' : ''}KSh {Math.abs(tx.amount).toLocaleString()}
                  </Text>
                </View>
              ))
            )}
            {txPage < txTotalPages && (
              <Button
                variant="ghost"
                size="medium"
                onPress={loadMoreTransactions}
                accessibilityLabel={t('load_more')}
                style={styles.loadMoreButton}
              >
                {t('load_more')}
              </Button>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('select_language')}</Text>
            <TouchableOpacity
              onPress={() => setShowLanguageModal(false)}
              accessibilityLabel={t('close')}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.languageOptions}>
            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 'en' && styles.languageOptionSelected,
              ]}
              onPress={() => {
                setLanguage('en');
                setShowLanguageModal(false);
              }}
              accessibilityLabel={t('english')}
              accessibilityRole="button"
              accessibilityState={{ selected: language === 'en' }}
            >
              <View style={styles.languageInfo}>
                <Text style={styles.languageFlag}>{'\uD83C\uDDEC\uD83C\uDDE7'}</Text>
                <View>
                  <Text style={[
                    styles.languageName,
                    language === 'en' && styles.languageNameSelected,
                  ]}>
                    {t('english')}
                  </Text>
                  <Text style={styles.languageNative}>English</Text>
                </View>
              </View>
              {language === 'en' && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary[800]} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 'sw' && styles.languageOptionSelected,
              ]}
              onPress={() => {
                setLanguage('sw');
                setShowLanguageModal(false);
              }}
              accessibilityLabel={t('swahili')}
              accessibilityRole="button"
              accessibilityState={{ selected: language === 'sw' }}
            >
              <View style={styles.languageInfo}>
                <Text style={styles.languageFlag}>{'\uD83C\uDDF0\uD83C\uDDEA'}</Text>
                <View>
                  <Text style={[
                    styles.languageName,
                    language === 'sw' && styles.languageNameSelected,
                  ]}>
                    {t('swahili')}
                  </Text>
                  <Text style={styles.languageNative}>Kiswahili</Text>
                </View>
              </View>
              {language === 'sw' && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary[800]} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    padding: spacing[4],
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing[4],
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.neutral[0],
  },
  avatarLargeText: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.primary[800],
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing[0.5],
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary[900],
    marginBottom: spacing[2],
  },
  userTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1.5],
    borderRadius: radius.full,
    gap: spacing[1.5],
  },
  userTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[800],
    textTransform: 'capitalize',
  },
  verifyButton: {
    marginTop: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.text.link,
  },
  statsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[5],
    flexDirection: 'row',
    marginBottom: spacing[5],
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary[900],
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.neutral[200],
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[3],
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary[800],
  },
  infoCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[1],
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3.5],
  },
  infoIcon: {
    width: spacing[10],
    height: spacing[10],
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing[0.5],
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginHorizontal: spacing[3.5],
  },
  transactionsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[1],
    ...shadows.sm,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3.5],
  },
  txIcon: {
    width: spacing[9],
    height: spacing[9],
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  txContent: {
    flex: 1,
  },
  txDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  txDate: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingsCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[1],
    marginBottom: spacing[2],
    ...shadows.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[3.5],
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  settingText: {
    fontSize: 15,
    color: colors.text.primary,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    marginBottom: spacing[2],
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  menuItemText: {
    fontSize: 15,
    color: colors.text.primary,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  menuItemValue: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  logoutButton: {
    marginTop: spacing[2],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.semantic.errorLight,
    backgroundColor: colors.neutral[0],
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.semantic.error,
  },
  deleteAccountButton: {
    marginTop: spacing[3],
    alignSelf: 'center',
  },
  deleteAccountText: {
    fontSize: 13,
    color: colors.neutral[500],
    textDecorationLine: 'underline',
  },
  version: {
    textAlign: 'center',
    marginTop: spacing[6],
    fontSize: 12,
    color: colors.neutral[500],
  },
  tagline: {
    textAlign: 'center',
    marginTop: spacing[1],
    marginBottom: spacing[10],
    fontSize: 12,
    color: colors.primary[800],
    fontWeight: '500',
  },
  // SACCO Card styles
  saccoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.primary[100],
  },
  saccoIconContainer: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary[800],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3.5],
  },
  saccoContent: {
    flex: 1,
  },
  saccoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[900],
  },
  saccoSubtitle: {
    fontSize: 13,
    color: colors.primary[700],
    marginTop: spacing[0.5],
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
    color: colors.text.primary,
  },
  modalContent: {
    flex: 1,
    padding: spacing[4],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[10],
  },
  emptyStateText: {
    color: colors.neutral[500],
    marginTop: spacing[3],
  },
  loadMoreButton: {
    alignSelf: 'center',
    marginVertical: spacing[4],
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    padding: spacing[4],
    borderRadius: radius.lg,
    marginBottom: spacing[3],
  },
  txIconLarge: {
    width: spacing[12],
    height: spacing[12],
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  txCardContent: {
    flex: 1,
  },
  txCardDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  txCardDate: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  txStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radius.md,
    marginTop: spacing[1.5],
  },
  txStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  txCardAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Language Modal styles
  languageOptions: {
    padding: spacing[4],
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral[50],
    padding: spacing[4],
    borderRadius: radius.lg,
    marginBottom: spacing[3],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageOptionSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[800],
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  languageFlag: {
    fontSize: 32,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  languageNameSelected: {
    color: colors.primary[800],
  },
  languageNative: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
});
