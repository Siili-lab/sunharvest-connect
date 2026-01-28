import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

type Transaction = {
  id: string;
  type: 'contribution' | 'withdrawal' | 'loan' | 'repayment' | 'interest';
  amount: number;
  date: string;
  description: string;
};

const MOCK_BALANCE = {
  savings: 45000,
  loanBalance: 15000,
  availableLoan: 120000,
  interestEarned: 2250,
  creditScore: 720,
};

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', type: 'contribution', amount: 5000, date: 'Jan 20, 2024', description: 'Monthly contribution' },
  { id: '2', type: 'interest', amount: 450, date: 'Jan 15, 2024', description: 'Monthly interest (1.5%)' },
  { id: '3', type: 'repayment', amount: -2500, date: 'Jan 10, 2024', description: 'Loan repayment' },
  { id: '4', type: 'contribution', amount: 5000, date: 'Dec 20, 2023', description: 'Monthly contribution' },
  { id: '5', type: 'loan', amount: -20000, date: 'Dec 1, 2023', description: 'Loan disbursement' },
];

const MOCK_GROUPS = [
  { id: '1', name: 'Kiambu Farmers Group', members: 24, contribution: 2000, frequency: 'Monthly', balance: 450000 },
  { id: '2', name: 'Limuru Agri-Coop', members: 18, contribution: 5000, frequency: 'Monthly', balance: 820000 },
];

export default function SaccoScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'loans'>('overview');
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [contributeAmount, setContributeAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');

  const handleContribute = () => {
    if (!contributeAmount) {
      Alert.alert('Enter Amount', 'Please enter contribution amount');
      return;
    }
    Alert.alert(
      'M-Pesa Payment',
      `Contribute KSh ${parseInt(contributeAmount).toLocaleString()} to your SACCO savings?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay', onPress: () => {
          Alert.alert('Payment Initiated', 'Check your phone for M-Pesa prompt.');
          setShowContributeModal(false);
          setContributeAmount('');
        }},
      ]
    );
  };

  const handleLoanApplication = () => {
    if (!loanAmount || !loanPurpose) {
      Alert.alert('Missing Info', 'Please fill in all fields');
      return;
    }
    const amount = parseInt(loanAmount);
    if (amount > MOCK_BALANCE.availableLoan) {
      Alert.alert('Exceeds Limit', `Maximum loan amount is KSh ${MOCK_BALANCE.availableLoan.toLocaleString()}`);
      return;
    }
    Alert.alert(
      'Loan Application',
      `Apply for KSh ${amount.toLocaleString()} loan?\n\nInterest: 2% monthly\nRepayment: 12 months\nMonthly: KSh ${Math.round(amount * 1.02 / 12).toLocaleString()}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply', onPress: () => {
          Alert.alert('Application Submitted', 'Your loan application is being reviewed. You will be notified within 24 hours.');
          setShowLoanModal(false);
          setLoanAmount('');
          setLoanPurpose('');
        }},
      ]
    );
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 700) return '#2E7D32';
    if (score >= 600) return '#F57C00';
    return '#D32F2F';
  };

  const getCreditScoreLabel = (score: number) => {
    if (score >= 700) return 'Excellent';
    if (score >= 600) return 'Good';
    return 'Fair';
  };

  return (
    <View style={styles.container}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerLabel}>Total Savings</Text>
            <Text style={styles.headerValue}>KSh {MOCK_BALANCE.savings.toLocaleString()}</Text>
          </View>
          <TouchableOpacity style={styles.contributeBtn} onPress={() => setShowContributeModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.contributeBtnText}>Contribute</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.statLabel}>Interest Earned</Text>
            <Text style={styles.statValue}>+KSh {MOCK_BALANCE.interestEarned.toLocaleString()}</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={styles.statLabel}>Loan Balance</Text>
            <Text style={[styles.statValue, { color: '#F57C00' }]}>
              KSh {MOCK_BALANCE.loanBalance.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Credit Score Card */}
      <View style={styles.creditCard}>
        <View style={styles.creditHeader}>
          <View>
            <Text style={styles.creditLabel}>Credit Score</Text>
            <View style={styles.creditScoreRow}>
              <Text style={[styles.creditScore, { color: getCreditScoreColor(MOCK_BALANCE.creditScore) }]}>
                {MOCK_BALANCE.creditScore}
              </Text>
              <View style={[styles.creditBadge, { backgroundColor: getCreditScoreColor(MOCK_BALANCE.creditScore) + '20' }]}>
                <Text style={[styles.creditBadgeText, { color: getCreditScoreColor(MOCK_BALANCE.creditScore) }]}>
                  {getCreditScoreLabel(MOCK_BALANCE.creditScore)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.loanEligibility}>
            <Text style={styles.eligibilityLabel}>Eligible for</Text>
            <Text style={styles.eligibilityValue}>KSh {MOCK_BALANCE.availableLoan.toLocaleString()}</Text>
            <TouchableOpacity style={styles.applyLoanBtn} onPress={() => setShowLoanModal(true)}>
              <Text style={styles.applyLoanText}>Apply for Loan</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.creditBar}>
          <View style={[styles.creditBarFill, { width: `${(MOCK_BALANCE.creditScore / 850) * 100}%` }]} />
        </View>
        <Text style={styles.creditNote}>Score based on transaction history and repayment record</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['overview', 'groups', 'loans'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && (
          <>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            {MOCK_TRANSACTIONS.map((tx) => (
              <View key={tx.id} style={styles.transactionCard}>
                <View style={[
                  styles.txIcon,
                  { backgroundColor: tx.amount > 0 ? '#E8F5E9' : '#FFF3E0' }
                ]}>
                  <Ionicons
                    name={tx.type === 'contribution' ? 'arrow-up' : tx.type === 'interest' ? 'trending-up' : 'arrow-down'}
                    size={18}
                    color={tx.amount > 0 ? '#2E7D32' : '#F57C00'}
                  />
                </View>
                <View style={styles.txDetails}>
                  <Text style={styles.txDescription}>{tx.description}</Text>
                  <Text style={styles.txDate}>{tx.date}</Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.amount > 0 ? '#2E7D32' : '#F57C00' }]}>
                  {tx.amount > 0 ? '+' : ''}KSh {Math.abs(tx.amount).toLocaleString()}
                </Text>
              </View>
            ))}
          </>
        )}

        {activeTab === 'groups' && (
          <>
            <Text style={styles.sectionTitle}>My SACCO Groups</Text>
            {MOCK_GROUPS.map((group) => (
              <TouchableOpacity key={group.id} style={styles.groupCard} activeOpacity={0.7}>
                <View style={styles.groupHeader}>
                  <View style={styles.groupIcon}>
                    <Ionicons name="people" size={24} color="#2E7D32" />
                  </View>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupMembers}>{group.members} members</Text>
                  </View>
                </View>
                <View style={styles.groupStats}>
                  <View style={styles.groupStat}>
                    <Text style={styles.groupStatLabel}>Contribution</Text>
                    <Text style={styles.groupStatValue}>KSh {group.contribution.toLocaleString()}/{group.frequency}</Text>
                  </View>
                  <View style={styles.groupStat}>
                    <Text style={styles.groupStatLabel}>Group Balance</Text>
                    <Text style={styles.groupStatValue}>KSh {group.balance.toLocaleString()}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.joinGroupBtn}>
              <Ionicons name="add-circle-outline" size={20} color="#2E7D32" />
              <Text style={styles.joinGroupText}>Join a SACCO Group</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'loans' && (
          <>
            <Text style={styles.sectionTitle}>Active Loans</Text>
            <View style={styles.loanCard}>
              <View style={styles.loanHeader}>
                <Text style={styles.loanTitle}>Working Capital Loan</Text>
                <View style={styles.loanStatusBadge}>
                  <Text style={styles.loanStatusText}>Active</Text>
                </View>
              </View>
              <View style={styles.loanProgress}>
                <View style={styles.loanProgressBar}>
                  <View style={[styles.loanProgressFill, { width: '25%' }]} />
                </View>
                <Text style={styles.loanProgressText}>KSh 5,000 / 20,000 repaid</Text>
              </View>
              <View style={styles.loanDetails}>
                <View style={styles.loanDetail}>
                  <Text style={styles.loanDetailLabel}>Remaining</Text>
                  <Text style={styles.loanDetailValue}>KSh 15,000</Text>
                </View>
                <View style={styles.loanDetail}>
                  <Text style={styles.loanDetailLabel}>Monthly</Text>
                  <Text style={styles.loanDetailValue}>KSh 2,500</Text>
                </View>
                <View style={styles.loanDetail}>
                  <Text style={styles.loanDetailLabel}>Due Date</Text>
                  <Text style={styles.loanDetailValue}>Feb 10</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.repayBtn}>
                <Text style={styles.repayBtnText}>Make Repayment</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Loan Products</Text>
            {[
              { name: 'Emergency Loan', rate: '1.5%', max: 'Up to 1x savings', term: '3 months' },
              { name: 'Working Capital', rate: '2%', max: 'Up to 3x savings', term: '12 months' },
              { name: 'Asset Finance', rate: '2.5%', max: 'Up to 5x savings', term: '24 months' },
            ].map((product, index) => (
              <View key={index} style={styles.productCard}>
                <Text style={styles.productName}>{product.name}</Text>
                <View style={styles.productDetails}>
                  <Text style={styles.productDetail}>Interest: {product.rate}/month</Text>
                  <Text style={styles.productDetail}>{product.max}</Text>
                  <Text style={styles.productDetail}>Term: {product.term}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Contribute Modal */}
      <Modal visible={showContributeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Make Contribution</Text>
            <Text style={styles.modalSubtitle}>Add to your SACCO savings</Text>

            <Text style={styles.inputLabel}>Amount (KSh)</Text>
            <TextInput
              style={styles.input}
              value={contributeAmount}
              onChangeText={setContributeAmount}
              placeholder="e.g. 5000"
              keyboardType="numeric"
              placeholderTextColor="#9E9E9E"
            />

            <View style={styles.quickAmounts}>
              {[1000, 2000, 5000, 10000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmount}
                  onPress={() => setContributeAmount(amount.toString())}
                >
                  <Text style={styles.quickAmountText}>{amount.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowContributeModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleContribute}>
                <Text style={styles.submitBtnText}>Pay with M-Pesa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Loan Modal */}
      <Modal visible={showLoanModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Apply for Loan</Text>
            <Text style={styles.modalSubtitle}>
              Eligible for up to KSh {MOCK_BALANCE.availableLoan.toLocaleString()}
            </Text>

            <Text style={styles.inputLabel}>Loan Amount (KSh)</Text>
            <TextInput
              style={styles.input}
              value={loanAmount}
              onChangeText={setLoanAmount}
              placeholder="e.g. 50000"
              keyboardType="numeric"
              placeholderTextColor="#9E9E9E"
            />

            <Text style={styles.inputLabel}>Purpose</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={loanPurpose}
              onChangeText={setLoanPurpose}
              placeholder="e.g. Purchase farming inputs"
              multiline
              placeholderTextColor="#9E9E9E"
            />

            <View style={styles.loanTerms}>
              <Text style={styles.termsTitle}>Loan Terms</Text>
              <Text style={styles.termsText}>• Interest rate: 2% per month</Text>
              <Text style={styles.termsText}>• Repayment period: Up to 12 months</Text>
              <Text style={styles.termsText}>• Processing fee: 1% of loan amount</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLoanModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleLoanApplication}>
                <Text style={styles.submitBtnText}>Submit Application</Text>
              </TouchableOpacity>
            </View>
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
  headerCard: {
    backgroundColor: '#2E7D32',
    margin: 16,
    borderRadius: 20,
    padding: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  headerValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  contributeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  contributeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  headerStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
  },
  headerStat: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#A5D6A7',
    marginTop: 2,
  },
  creditCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  creditLabel: {
    fontSize: 12,
    color: '#666',
  },
  creditScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creditScore: {
    fontSize: 28,
    fontWeight: '700',
  },
  creditBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  creditBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loanEligibility: {
    alignItems: 'flex-end',
  },
  eligibilityLabel: {
    fontSize: 11,
    color: '#666',
  },
  eligibilityValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B5E20',
  },
  applyLoanBtn: {
    marginTop: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  applyLoanText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
  creditBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 8,
  },
  creditBarFill: {
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 3,
  },
  creditNote: {
    fontSize: 10,
    color: '#9E9E9E',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#E8F5E9',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txDetails: {
    flex: 1,
  },
  txDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  txDate: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B5E20',
  },
  groupMembers: {
    fontSize: 13,
    color: '#666',
  },
  groupStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 14,
  },
  groupStat: {
    flex: 1,
  },
  groupStatLabel: {
    fontSize: 11,
    color: '#666',
  },
  groupStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  joinGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    borderStyle: 'dashed',
    gap: 8,
  },
  joinGroupText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E7D32',
  },
  loanCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  loanTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  loanStatusBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  loanStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
  loanProgress: {
    marginBottom: 14,
  },
  loanProgressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 6,
  },
  loanProgressFill: {
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 4,
  },
  loanProgressText: {
    fontSize: 12,
    color: '#666',
  },
  loanDetails: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  loanDetail: {
    flex: 1,
  },
  loanDetailLabel: {
    fontSize: 11,
    color: '#666',
  },
  loanDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  repayBtn: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  repayBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  productDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  productDetail: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bottomPadding: {
    height: 20,
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
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickAmount: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  loanTerms: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  termsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57C00',
    marginBottom: 8,
  },
  termsText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
