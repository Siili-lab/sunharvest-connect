import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { Text } from '../components/primitives/Text';
import { Input } from '../components/primitives/Input';
import { Button } from '../components/primitives/Button';
import { colors, spacing, radius, shadows } from '@/theme';
import {
  getSaccoBalance,
  getSaccoTransactions,
  getSaccoGroups,
  getSaccoLoans,
  joinSaccoGroup,
  makeSaccoContribution,
  applySaccoLoan,
  repaySaccoLoan,
  type SaccoBalance,
  type SaccoTransaction,
  type SaccoGroupInfo,
  type SaccoLoanInfo,
} from '../services/api';

type Transaction = {
  id: string;
  type: 'contribution' | 'withdrawal' | 'loan' | 'repayment' | 'interest';
  amount: number;
  date: string;
  description: string;
};

export default function SaccoScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'loans'>('overview');
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [contributeAmount, setContributeAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');

  // Real data state
  const [balance, setBalance] = useState<SaccoBalance>({
    savings: 0, loanBalance: 0, availableLoan: 0, interestEarned: 0, creditScore: 600,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<SaccoGroupInfo[]>([]);
  const [loans, setLoans] = useState<SaccoLoanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [balanceData, txData, groupsData, loansData] = await Promise.all([
        getSaccoBalance().catch(() => balance),
        getSaccoTransactions().catch(() => []),
        getSaccoGroups().catch(() => []),
        getSaccoLoans().catch(() => []),
      ]);
      setBalance(balanceData);
      setTransactions(txData.map((tx: SaccoTransaction) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        date: new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        description: tx.description,
      })));
      setGroups(groupsData);
      setLoans(loansData);
      // Set default selected group for contribution
      const memberGroup = groupsData.find((g: SaccoGroupInfo) => g.isMember);
      if (memberGroup) setSelectedGroupId(memberGroup.id);
      else if (groupsData.length > 0) setSelectedGroupId(groupsData[0].id);
    } catch (error) {
      console.error('Error loading SACCO data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleContribute = () => {
    if (!contributeAmount) {
      showToast(t('enter_amount'), 'warning');
      return;
    }
    if (!selectedGroupId) {
      showToast('Please join a SACCO group first', 'warning');
      return;
    }
    Alert.alert(
      t('pay_mpesa'),
      `${t('contribute')} KSh ${parseInt(contributeAmount).toLocaleString()} ${t('sacco_savings')}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('confirm'), onPress: async () => {
          try {
            await makeSaccoContribution(selectedGroupId, parseInt(contributeAmount));
            showToast(t('payment_initiated_check_phone'), 'success');
            setShowContributeModal(false);
            setContributeAmount('');
            loadData();
          } catch (error) {
            showToast(t('network_error'), 'error');
          }
        }},
      ]
    );
  };

  const handleLoanApplication = () => {
    if (!loanAmount || !loanPurpose) {
      showToast(t('enter_amount'), 'warning');
      return;
    }
    const amount = parseInt(loanAmount);
    if (amount > balance.availableLoan) {
      showToast(`${t('exceeds_limit')}: KSh ${balance.availableLoan.toLocaleString()}`, 'error');
      return;
    }
    if (!selectedGroupId) {
      showToast('Please join a SACCO group first', 'warning');
      return;
    }
    Alert.alert(
      t('apply_loan'),
      `KSh ${amount.toLocaleString()}\n\n${t('monthly_interest')}: 2%\n${t('repayment_period')}: 12 ${t('months')}\nKSh ${Math.round(amount * 1.02 / 12).toLocaleString()}`,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('submit_application'), onPress: async () => {
          try {
            await applySaccoLoan({
              groupId: selectedGroupId,
              amount,
              purpose: loanPurpose,
              termMonths: 12,
            });
            showToast(t('payment_initiated_check_phone'), 'success');
            setShowLoanModal(false);
            setLoanAmount('');
            setLoanPurpose('');
            loadData();
          } catch (error) {
            showToast(t('network_error'), 'error');
          }
        }},
      ]
    );
  };

  const handleRepay = (loan: SaccoLoanInfo) => {
    const monthlyPayment = Math.round(loan.balance / Math.max(1, loan.termMonths));
    Alert.alert(
      t('make_repayment'),
      `Repay KSh ${monthlyPayment.toLocaleString()} for ${loan.group}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('confirm'), onPress: async () => {
          try {
            await repaySaccoLoan(loan.id, monthlyPayment);
            showToast(t('payment_initiated_check_phone'), 'success');
            loadData();
          } catch (error) {
            showToast(t('network_error'), 'error');
          }
        }},
      ]
    );
  };

  const handleJoinGroup = async (groupId: string) => {
    try {
      await joinSaccoGroup(groupId);
      showToast('Joined group successfully!', 'success');
      loadData();
    } catch (error) {
      showToast(t('network_error'), 'error');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary[800]} />
      </View>
    );
  }

  const getCreditScoreColor = (score: number) => {
    if (score >= 700) return colors.primary[800];
    if (score >= 600) return colors.semantic.warning;
    return colors.semantic.error;
  };

  const getCreditScoreLabel = (score: number) => {
    if (score >= 700) return 'Excellent';
    if (score >= 600) return 'Good';
    return 'Fair';
  };

  const tabLabelMap: Record<string, string> = {
    overview: t('sacco_savings'),
    groups: t('sacco_groups'),
    loans: t('sacco_loans'),
  };

  return (
    <View style={styles.container}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text
              variant="caption"
              style={styles.headerLabel}
              accessibilityLabel={t('total_savings')}
            >
              {t('total_savings')}
            </Text>
            <Text variant="heading1" style={styles.headerValue}>
              KSh {balance.savings.toLocaleString()}
            </Text>
          </View>
          <Button
            variant="ghost"
            size="small"
            onPress={() => setShowContributeModal(true)}
            style={styles.contributeBtn}
            accessibilityLabel={t('contribute')}
            accessibilityHint={t('make_contribution')}
            leftIcon={<Ionicons name="add" size={20} color={colors.neutral[0]} />}
          >
            <Text variant="buttonSmall" style={styles.contributeBtnText}>{t('contribute')}</Text>
          </Button>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text variant="caption" style={styles.statLabel}>{t('interest_earned')}</Text>
            <Text variant="body" style={styles.statValue}>+KSh {balance.interestEarned.toLocaleString()}</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text variant="caption" style={styles.statLabel}>{t('loan_balance')}</Text>
            <Text variant="body" style={[styles.statValue, { color: colors.semantic.warning }]}>
              KSh {balance.loanBalance.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Credit Score Card */}
      <View style={styles.creditCard}>
        <View style={styles.creditHeader}>
          <View>
            <Text variant="caption" style={styles.creditLabel}>{t('credit_score')}</Text>
            <View style={styles.creditScoreRow}>
              <Text
                variant="heading2"
                style={[styles.creditScore, { color: getCreditScoreColor(balance.creditScore) }]}
                accessibilityLabel={`${t('credit_score')}: ${balance.creditScore}`}
              >
                {balance.creditScore}
              </Text>
              <View style={[styles.creditBadge, { backgroundColor: getCreditScoreColor(balance.creditScore) + '20' }]}>
                <Text variant="caption" style={[styles.creditBadgeText, { color: getCreditScoreColor(balance.creditScore) }]}>
                  {getCreditScoreLabel(balance.creditScore)}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.loanEligibility}>
            <Text variant="caption" style={styles.eligibilityLabel}>{t('max_loan')}</Text>
            <Text variant="body" style={styles.eligibilityValue}>
              KSh {balance.availableLoan.toLocaleString()}
            </Text>
            <TouchableOpacity
              style={styles.applyLoanBtn}
              onPress={() => setShowLoanModal(true)}
              accessibilityLabel={t('apply_loan')}
              accessibilityRole="button"
            >
              <Text variant="caption" style={styles.applyLoanText}>{t('apply_loan')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.creditBar}>
          <View style={[styles.creditBarFill, { width: `${(balance.creditScore / 850) * 100}%` }]} />
        </View>
        <Text variant="caption" style={styles.creditNote}>
          Score based on transaction history and repayment record
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['overview', 'groups', 'loans'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityLabel={tabLabelMap[tab]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text
              variant="buttonSmall"
              style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
            >
              {tabLabelMap[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && (
          <>
            <Text variant="heading4" style={styles.sectionTitle}>{t('recent_transactions')}</Text>
            {transactions.map((tx) => (
              <View key={tx.id} style={styles.transactionCard} accessibilityLabel={`${tx.description}, KSh ${Math.abs(tx.amount)}`}>
                <View style={[
                  styles.txIcon,
                  { backgroundColor: tx.amount > 0 ? colors.primary[50] : colors.semantic.warningLight }
                ]}>
                  <Ionicons
                    name={tx.type === 'contribution' ? 'arrow-up' : tx.type === 'interest' ? 'trending-up' : 'arrow-down'}
                    size={18}
                    color={tx.amount > 0 ? colors.primary[800] : colors.semantic.warning}
                  />
                </View>
                <View style={styles.txDetails}>
                  <Text variant="bodySmall" style={styles.txDescription}>{tx.description}</Text>
                  <Text variant="caption" style={styles.txDate}>{tx.date}</Text>
                </View>
                <Text variant="bodySmall" style={[styles.txAmount, { color: tx.amount > 0 ? colors.primary[800] : colors.semantic.warning }]}>
                  {tx.amount > 0 ? '+' : ''}KSh {Math.abs(tx.amount).toLocaleString()}
                </Text>
              </View>
            ))}
          </>
        )}

        {activeTab === 'groups' && (
          <>
            <Text variant="heading4" style={styles.sectionTitle}>{t('my_sacco_groups')}</Text>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.groupCard}
                activeOpacity={0.7}
                onPress={() => !group.isMember ? handleJoinGroup(group.id) : undefined}
                accessibilityLabel={`${group.name}, ${group.members} ${t('members')}`}
                accessibilityRole="button"
              >
                <View style={styles.groupHeader}>
                  <View style={styles.groupIcon}>
                    <Ionicons name="people" size={24} color={colors.primary[800]} />
                  </View>
                  <View style={styles.groupInfo}>
                    <Text variant="body" style={styles.groupName}>{group.name}</Text>
                    <Text variant="caption" style={styles.groupMembers}>
                      {group.members} {t('members')}
                    </Text>
                  </View>
                </View>
                <View style={styles.groupStats}>
                  <View style={styles.groupStat}>
                    <Text variant="caption" style={styles.groupStatLabel}>{t('your_contribution')}</Text>
                    <Text variant="bodySmall" style={styles.groupStatValue}>
                      KSh {group.contribution.toLocaleString()}/{group.frequency}
                    </Text>
                  </View>
                  <View style={styles.groupStat}>
                    <Text variant="caption" style={styles.groupStatLabel}>{t('group_savings')}</Text>
                    <Text variant="bodySmall" style={styles.groupStatValue}>
                      KSh {group.balance.toLocaleString()}
                    </Text>
                  </View>
                </View>
                {!group.isMember && (
                  <Button
                    variant="primary"
                    size="small"
                    fullWidth
                    onPress={() => handleJoinGroup(group.id)}
                    accessibilityLabel={t('join_sacco')}
                  >
                    {t('join_sacco')}
                  </Button>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        {activeTab === 'loans' && (
          <>
            <Text variant="heading4" style={styles.sectionTitle}>{t('active_loans')}</Text>
            {loans.filter((l) => l.status === 'ACTIVE' || l.status === 'APPROVED').map((loan) => {
              const repaidPercent = loan.amount > 0 ? Math.round((loan.amountRepaid / loan.amount) * 100) : 0;
              const monthlyPayment = Math.round(loan.balance * loan.interestRate / 100);
              return (
                <View key={loan.id} style={styles.loanCard}>
                  <View style={styles.loanHeader}>
                    <Text variant="body" style={styles.loanTitle}>{loan.purpose || loan.group}</Text>
                    <View style={styles.loanStatusBadge}>
                      <Text variant="caption" style={styles.loanStatusText}>{loan.status}</Text>
                    </View>
                  </View>
                  <View style={styles.loanProgress}>
                    <View style={styles.loanProgressBar}>
                      <View style={[styles.loanProgressFill, { width: `${repaidPercent}%` }]} />
                    </View>
                    <Text variant="caption" style={styles.loanProgressText}>
                      KSh {loan.amountRepaid.toLocaleString()} / {loan.amount.toLocaleString()} repaid
                    </Text>
                  </View>
                  <View style={styles.loanDetails}>
                    <View style={styles.loanDetail}>
                      <Text variant="caption" style={styles.loanDetailLabel}>{t('loan_balance')}</Text>
                      <Text variant="bodySmall" style={styles.loanDetailValue}>KSh {loan.balance.toLocaleString()}</Text>
                    </View>
                    <View style={styles.loanDetail}>
                      <Text variant="caption" style={styles.loanDetailLabel}>{t('monthly_interest')}</Text>
                      <Text variant="bodySmall" style={styles.loanDetailValue}>KSh {monthlyPayment.toLocaleString()}</Text>
                    </View>
                    <View style={styles.loanDetail}>
                      <Text variant="caption" style={styles.loanDetailLabel}>{t('due_date')}</Text>
                      <Text variant="bodySmall" style={styles.loanDetailValue}>
                        {loan.dueDate ? new Date(loan.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                      </Text>
                    </View>
                  </View>
                  <Button
                    variant="primary"
                    size="medium"
                    fullWidth
                    onPress={() => handleRepay(loan)}
                    style={styles.repayBtn}
                    accessibilityLabel={t('make_repayment')}
                  >
                    {t('make_repayment')}
                  </Button>
                </View>
              );
            })}
            {loans.filter((l) => l.status === 'ACTIVE' || l.status === 'APPROVED').length === 0 && (
              <Text variant="bodySmall" style={{ color: colors.neutral[600], textAlign: 'center', marginBottom: spacing[4] }}>
                {t('no_active_loans')}
              </Text>
            )}

            <Text variant="heading4" style={styles.sectionTitle}>{t('loan_products')}</Text>
            {[
              { name: 'Emergency Loan', rate: '1.5%', max: 'Up to 1x savings', term: `3 ${t('months')}` },
              { name: 'Working Capital', rate: '2%', max: 'Up to 3x savings', term: `12 ${t('months')}` },
              { name: 'Asset Finance', rate: '2.5%', max: 'Up to 5x savings', term: `24 ${t('months')}` },
            ].map((product, index) => (
              <View key={index} style={styles.productCard} accessibilityLabel={`${product.name}, ${t('monthly_interest')}: ${product.rate}`}>
                <Text variant="bodySmall" style={styles.productName}>{product.name}</Text>
                <View style={styles.productDetails}>
                  <Text variant="caption" style={styles.productDetail}>
                    {t('monthly_interest')}: {product.rate}
                  </Text>
                  <Text variant="caption" style={styles.productDetail}>{product.max}</Text>
                  <Text variant="caption" style={styles.productDetail}>
                    {t('repayment_period')}: {product.term}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Contribute Modal */}
      <Modal visible={showContributeModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text variant="heading3" style={styles.modalTitle}>{t('make_contribution')}</Text>
            <Text variant="bodySmall" style={styles.modalSubtitle}>{t('sacco_savings')}</Text>

            <Input
              label={`${t('contribution_amount')} (KSh)`}
              value={contributeAmount}
              onChangeText={setContributeAmount}
              placeholder={t('enter_amount')}
              keyboardType="numeric"
              accessibilityLabel={t('contribution_amount')}
            />

            <View style={styles.quickAmounts}>
              {[1000, 2000, 5000, 10000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmount}
                  onPress={() => setContributeAmount(amount.toString())}
                  accessibilityLabel={`KSh ${amount.toLocaleString()}`}
                  accessibilityRole="button"
                >
                  <Text variant="buttonSmall" style={styles.quickAmountText}>{amount.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button
                variant="ghost"
                size="medium"
                onPress={() => setShowContributeModal(false)}
                style={styles.cancelBtn}
                accessibilityLabel={t('cancel')}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                size="medium"
                onPress={handleContribute}
                style={styles.submitBtn}
                accessibilityLabel={t('pay_mpesa')}
              >
                {t('pay_mpesa')}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Loan Modal */}
      <Modal visible={showLoanModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text variant="heading3" style={styles.modalTitle}>{t('apply_loan')}</Text>
            <Text variant="bodySmall" style={styles.modalSubtitle}>
              {t('max_loan')}: KSh {balance.availableLoan.toLocaleString()}
            </Text>

            <Input
              label={`${t('loan_amount')} (KSh)`}
              value={loanAmount}
              onChangeText={setLoanAmount}
              placeholder={t('enter_amount')}
              keyboardType="numeric"
              accessibilityLabel={t('loan_amount')}
            />

            <Input
              label={t('loan_purpose')}
              value={loanPurpose}
              onChangeText={setLoanPurpose}
              placeholder={t('enter_purpose')}
              multiline
              inputStyle={styles.textArea}
              accessibilityLabel={t('loan_purpose')}
            />

            <View style={styles.loanTerms}>
              <Text variant="bodySmall" style={styles.termsTitle}>{t('loan_terms')}</Text>
              <Text variant="caption" style={styles.termsText}>
                {'\u2022'} {t('monthly_interest')}: 2%
              </Text>
              <Text variant="caption" style={styles.termsText}>
                {'\u2022'} {t('repayment_period')}: 12 {t('months')}
              </Text>
              <Text variant="caption" style={styles.termsText}>
                {'\u2022'} Processing fee: 1%
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Button
                variant="ghost"
                size="medium"
                onPress={() => setShowLoanModal(false)}
                style={styles.cancelBtn}
                accessibilityLabel={t('cancel')}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                size="medium"
                onPress={handleLoanApplication}
                style={styles.submitBtn}
                accessibilityLabel={t('submit_application')}
              >
                {t('submit_application')}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  headerCard: {
    backgroundColor: colors.primary[800],
    margin: spacing[4],
    borderRadius: radius.xl,
    padding: spacing[5],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[5],
  },
  headerLabel: {
    fontSize: 13,
    color: colors.overlay.light,
  },
  headerValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  contributeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radius.xl,
    gap: spacing[1.5],
  },
  contributeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  headerStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    padding: spacing[3.5],
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
    color: colors.primary[200],
    marginTop: spacing[0.5],
  },
  creditCard: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing[4],
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.primary[50],
  },
  creditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  creditLabel: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  creditScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  creditScore: {
    fontSize: 28,
    fontWeight: '700',
  },
  creditBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: radius.md,
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
    color: colors.neutral[600],
  },
  eligibilityValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[900],
  },
  applyLoanBtn: {
    marginTop: spacing[1.5],
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.lg,
  },
  applyLoanText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[800],
  },
  creditBar: {
    height: 6,
    backgroundColor: colors.border.light,
    borderRadius: radius.xs,
    marginBottom: spacing[2],
  },
  creditBarFill: {
    height: '100%',
    backgroundColor: colors.primary[800],
    borderRadius: radius.xs,
  },
  creditNote: {
    fontSize: 10,
    color: colors.neutral[500],
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing[1],
  },
  tab: {
    flex: 1,
    paddingVertical: spacing[2.5],
    alignItems: 'center',
    borderRadius: radius.lg,
  },
  tabActive: {
    backgroundColor: colors.primary[50],
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
    marginBottom: spacing[3],
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing[3.5],
    marginBottom: spacing[2.5],
  },
  txIcon: {
    width: spacing[10],
    height: spacing[10],
    borderRadius: spacing[5],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  txDetails: {
    flex: 1,
  },
  txDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral[900],
  },
  txDate: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  groupCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3.5],
  },
  groupIcon: {
    width: spacing[12],
    height: spacing[12],
    borderRadius: spacing[6],
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[900],
  },
  groupMembers: {
    fontSize: 13,
    color: colors.neutral[600],
  },
  groupStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingTop: spacing[3.5],
  },
  groupStat: {
    flex: 1,
  },
  groupStatLabel: {
    fontSize: 11,
    color: colors.neutral[600],
  },
  groupStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
    marginTop: spacing[0.5],
  },
  joinGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.primary[800],
    borderStyle: 'dashed',
    gap: spacing[2],
  },
  joinGroupText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[800],
  },
  loanCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[5],
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3.5],
  },
  loanTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  loanStatusBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.lg,
  },
  loanStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[800],
  },
  loanProgress: {
    marginBottom: spacing[3.5],
  },
  loanProgressBar: {
    height: spacing[2],
    backgroundColor: colors.border.light,
    borderRadius: radius.sm,
    marginBottom: spacing[1.5],
  },
  loanProgressFill: {
    height: '100%',
    backgroundColor: colors.primary[800],
    borderRadius: radius.sm,
  },
  loanProgressText: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  loanDetails: {
    flexDirection: 'row',
    marginBottom: spacing[3.5],
  },
  loanDetail: {
    flex: 1,
  },
  loanDetailLabel: {
    fontSize: 11,
    color: colors.neutral[600],
  },
  loanDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  repayBtn: {
    backgroundColor: colors.primary[800],
    borderRadius: radius.lg,
  },
  productCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing[3.5],
    marginBottom: spacing[2.5],
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[900],
    marginBottom: spacing[2],
  },
  productDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  productDetail: {
    fontSize: 12,
    color: colors.neutral[600],
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  bottomPadding: {
    height: spacing[5],
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
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary[900],
    marginBottom: spacing[1],
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.neutral[600],
    marginBottom: spacing[5],
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: spacing[2.5],
    marginBottom: spacing[5],
  },
  quickAmount: {
    flex: 1,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing[2.5],
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[800],
  },
  loanTerms: {
    backgroundColor: colors.accent[50],
    borderRadius: radius.lg,
    padding: spacing[3.5],
    marginBottom: spacing[5],
  },
  termsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.semantic.warning,
    marginBottom: spacing[2],
  },
  termsText: {
    fontSize: 13,
    color: colors.neutral[600],
    marginBottom: spacing[1],
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
  },
  submitBtn: {
    flex: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[800],
  },
});
