import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import TrustScoreBadge from '../components/TrustScoreBadge';

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
  const [showTransactions, setShowTransactions] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(true);

  interface StatItem {
    value: string | number;
    label: string;
  }

  interface StatsData {
    stat1: StatItem;
    stat2: StatItem;
    stat3: StatItem;
  }

  // Mock stats based on user type
  const getStats = (): StatsData => {
    if (!user) return {
      stat1: { value: 0, label: 'Activity' },
      stat2: { value: 0, label: 'Transactions' },
      stat3: { value: '-', label: 'Rating' },
    };

    switch (user.userType) {
      case 'farmer':
        return {
          stat1: { value: 23, label: 'Listings' },
          stat2: { value: 156, label: 'Sales' },
          stat3: { value: 4.8, label: 'Rating' },
        };
      case 'buyer':
        return {
          stat1: { value: 89, label: 'Orders' },
          stat2: { value: 'KSh 450K', label: 'Spent' },
          stat3: { value: 4.9, label: 'Rating' },
        };
      case 'transporter':
        return {
          stat1: { value: 234, label: 'Deliveries' },
          stat2: { value: 'KSh 180K', label: 'Earned' },
          stat3: { value: 4.7, label: 'Rating' },
        };
      default:
        return {
          stat1: { value: 0, label: 'Activity' },
          stat2: { value: 0, label: 'Transactions' },
          stat3: { value: '-', label: 'Rating' },
        };
    }
  };

  const MOCK_TRANSACTIONS: Transaction[] = [
    { id: '1', type: 'sale', description: 'Sold 500kg Tomatoes', amount: 50000, date: '2024-01-14', status: 'completed' },
    { id: '2', type: 'savings', description: 'SACCO Deposit', amount: -5000, date: '2024-01-13', status: 'completed' },
    { id: '3', type: 'sale', description: 'Sold 200kg Onions', amount: 12000, date: '2024-01-12', status: 'completed' },
    { id: '4', type: 'loan', description: 'Loan Repayment', amount: -3500, date: '2024-01-10', status: 'completed' },
    { id: '5', type: 'sale', description: 'Sold 1000kg Potatoes', amount: 80000, date: '2024-01-08', status: 'pending' },
  ];

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

  const handleVerification = () => {
    Alert.alert(
      t('verify_account'),
      'To verify your account, you need to:\n\n1. Upload a valid ID (National ID or Passport)\n2. Take a selfie for face verification\n3. Verify your phone number via OTP',
      [{ text: t('continue'), onPress: () => Alert.alert('Coming Soon', 'Verification feature will be available soon.') }]
    );
  };

  if (!user) {
    return null;
  }

  const isVerified = true; // Mock verification status

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#1976D2" />
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
              color="#2E7D32"
            />
            <Text style={styles.userTypeText}>{t(user.userType)}</Text>
          </View>

          {!isVerified && (
            <TouchableOpacity style={styles.verifyButton} onPress={handleVerification}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#1976D2" />
              <Text style={styles.verifyButtonText}>{t('verify_account')}</Text>
            </TouchableOpacity>
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
              <Ionicons name="star" size={16} color="#FFC107" />
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
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="call-outline" size={20} color="#2E7D32" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('phone_number')}</Text>
                <Text style={styles.infoValue}>{user.phone}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={20} color="#2E7D32" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{t('location')}</Text>
                <Text style={styles.infoValue}>{user.location}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
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
            <TouchableOpacity onPress={() => setShowTransactions(true)}>
              <Text style={styles.viewAllText}>{t('view_all')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.transactionsCard}>
            {MOCK_TRANSACTIONS.slice(0, 3).map((tx, index) => (
              <View key={tx.id}>
                <View style={styles.transactionRow}>
                  <View style={[
                    styles.txIcon,
                    { backgroundColor: tx.amount > 0 ? '#E8F5E9' : '#FFF3E0' }
                  ]}>
                    <Ionicons
                      name={tx.amount > 0 ? 'arrow-down' : 'arrow-up'}
                      size={16}
                      color={tx.amount > 0 ? '#2E7D32' : '#F57C00'}
                    />
                  </View>
                  <View style={styles.txContent}>
                    <Text style={styles.txDescription}>{tx.description}</Text>
                    <Text style={styles.txDate}>{tx.date}</Text>
                  </View>
                  <Text style={[
                    styles.txAmount,
                    { color: tx.amount > 0 ? '#2E7D32' : '#F57C00' }
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
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="notifications-outline" size={22} color="#666" />
                <Text style={styles.settingText}>{t('push_notifications')}</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
                thumbColor={notificationsEnabled ? '#2E7D32' : '#fff'}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="chatbubble-outline" size={22} color="#666" />
                <Text style={styles.settingText}>{t('sms_alerts')}</Text>
              </View>
              <Switch
                value={smsAlertsEnabled}
                onValueChange={setSmsAlertsEnabled}
                trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
                thumbColor={smsAlertsEnabled ? '#2E7D32' : '#fff'}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={22} color="#666" />
              <Text style={styles.menuItemText}>{t('edit_profile')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="lock-closed-outline" size={22} color="#666" />
              <Text style={styles.menuItemText}>{t('change_pin')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => setShowLanguageModal(true)}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="language-outline" size={22} color="#666" />
              <Text style={styles.menuItemText}>{t('language')}</Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>{isSwahili ? 'Kiswahili' : 'English'}</Text>
              <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
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
          >
            <View style={styles.saccoIconContainer}>
              <Ionicons name="wallet" size={28} color="#fff" />
            </View>
            <View style={styles.saccoContent}>
              <Text style={styles.saccoTitle}>SACCO & Savings</Text>
              <Text style={styles.saccoSubtitle}>Manage your savings, loans & payments</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#2E7D32" />
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('support')}</Text>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={22} color="#666" />
              <Text style={styles.menuItemText}>{t('help_center')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="chatbubbles-outline" size={22} color="#666" />
              <Text style={styles.menuItemText}>{t('contact_support')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={22} color="#666" />
              <Text style={styles.menuItemText}>{t('terms_privacy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="information-circle-outline" size={22} color="#666" />
              <Text style={styles.menuItemText}>{t('about')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#C62828" />
          <Text style={styles.logoutButtonText}>{t('logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>SunHarvest Connect v1.0.0</Text>
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
            <TouchableOpacity onPress={() => setShowTransactions(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {MOCK_TRANSACTIONS.map((tx) => (
              <View key={tx.id} style={styles.txCard}>
                <View style={[
                  styles.txIconLarge,
                  { backgroundColor: tx.amount > 0 ? '#E8F5E9' : '#FFF3E0' }
                ]}>
                  <Ionicons
                    name={
                      tx.type === 'sale' ? 'cash' :
                      tx.type === 'savings' ? 'wallet' :
                      tx.type === 'loan' ? 'card' : 'swap-horizontal'
                    }
                    size={24}
                    color={tx.amount > 0 ? '#2E7D32' : '#F57C00'}
                  />
                </View>
                <View style={styles.txCardContent}>
                  <Text style={styles.txCardDescription}>{tx.description}</Text>
                  <Text style={styles.txCardDate}>{tx.date}</Text>
                  <View style={[
                    styles.txStatusBadge,
                    { backgroundColor: tx.status === 'completed' ? '#E8F5E9' : '#FFF3E0' }
                  ]}>
                    <Text style={[
                      styles.txStatusText,
                      { color: tx.status === 'completed' ? '#2E7D32' : '#F57C00' }
                    ]}>
                      {tx.status}
                    </Text>
                  </View>
                </View>
                <Text style={[
                  styles.txCardAmount,
                  { color: tx.amount > 0 ? '#2E7D32' : '#F57C00' }
                ]}>
                  {tx.amount > 0 ? '+' : ''}KSh {Math.abs(tx.amount).toLocaleString()}
                </Text>
              </View>
            ))}
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
            <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
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
            >
              <View style={styles.languageInfo}>
                <Text style={styles.languageFlag}>🇬🇧</Text>
                <View>
                  <Text style={[
                    styles.languageName,
                    language === 'en' && styles.languageNameSelected,
                  ]}>
                    English
                  </Text>
                  <Text style={styles.languageNative}>English</Text>
                </View>
              </View>
              {language === 'en' && (
                <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
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
            >
              <View style={styles.languageInfo}>
                <Text style={styles.languageFlag}>🇰🇪</Text>
                <View>
                  <Text style={[
                    styles.languageName,
                    language === 'sw' && styles.languageNameSelected,
                  ]}>
                    Swahili
                  </Text>
                  <Text style={styles.languageNative}>Kiswahili</Text>
                </View>
              </View>
              {language === 'sw' && (
                <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
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
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarLargeText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#2E7D32',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 8,
  },
  userTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  userTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    textTransform: 'capitalize',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1976D2',
    gap: 6,
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1976D2',
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F0F0F0',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginHorizontal: 14,
  },
  transactionsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txContent: {
    flex: 1,
  },
  txDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  txDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 15,
    color: '#333',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: '#333',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemValue: {
    fontSize: 14,
    color: '#999',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
    marginTop: 8,
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
  },
  version: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 12,
    color: '#999',
  },
  tagline: {
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 40,
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  // SACCO Card styles
  saccoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#C8E6C9',
  },
  saccoIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  saccoContent: {
    flex: 1,
  },
  saccoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B5E20',
  },
  saccoSubtitle: {
    fontSize: 13,
    color: '#558B2F',
    marginTop: 2,
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
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  txIconLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txCardContent: {
    flex: 1,
  },
  txCardDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  txCardDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  txStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
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
    padding: 16,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageFlag: {
    fontSize: 32,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  languageNameSelected: {
    color: '#2E7D32',
  },
  languageNative: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
});
