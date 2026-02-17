import { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { login as apiLogin, register as apiRegister } from '../services/api';
import { colors, spacing, fontSize, radius, shadows } from '@/theme';
import { Text } from '../components/primitives/Text';
import { Input } from '../components/primitives/Input';
import { Button } from '../components/primitives/Button';

// Demo account credentials - these are REAL accounts in the database
// All use PIN: 1234
const DEMO_CREDENTIALS = {
  farmer: { phone: '+254712345678', pin: '1234' },
  buyer: { phone: '+254723456789', pin: '1234' },
  transporter: { phone: '+254734567890', pin: '1234' },
};

type AuthMode = 'welcome' | 'login' | 'register';

export default function AuthScreen() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [location, setLocation] = useState('');
  const [userType, setUserType] = useState<'farmer' | 'buyer' | 'transporter'>('farmer');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [pinTouched, setPinTouched] = useState(false);
  const [confirmPinTouched, setConfirmPinTouched] = useState(false);

  // Quick demo login - uses REAL API with seeded test accounts
  const handleDemoLogin = async (type: 'farmer' | 'buyer' | 'transporter') => {
    setDemoLoading(type);
    try {
      const creds = DEMO_CREDENTIALS[type];
      const response = await apiLogin(creds.phone, creds.pin);
      await login(response.user, response.token);
    } catch (error: any) {
      console.log('Demo login error:', error);
      Alert.alert(
        t('demo_login_failed'),
        t('demo_login_failed_message')
      );
    }
    setDemoLoading(null);
  };

  const handleLogin = async () => {
    if (!phone || !pin) {
      Alert.alert(t('missing_fields'), t('missing_fields_login'));
      return;
    }

    if (pin.length !== 4) {
      Alert.alert(t('invalid_pin'), t('invalid_pin_message'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiLogin(phone, pin);
      await login(response.user, response.token);
    } catch (error: any) {
      console.log('Login error:', error);
      const message = error?.response?.data?.error?.message || t('login_failed_default');
      Alert.alert(t('login_failed'), message);
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!name || !phone || !pin || !location) {
      Alert.alert(t('missing_fields'), t('missing_fields_register'));
      return;
    }

    if (pin.length !== 4) {
      Alert.alert(t('invalid_pin'), t('invalid_pin_message'));
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert(t('pin_mismatch'), t('pin_mismatch_message'));
      return;
    }

    if (!privacyConsent) {
      Alert.alert(
        t('consent_required'),
        t('consent_required_message')
      );
      return;
    }

    setLoading(true);
    try {
      const response = await apiRegister({ name, phone, pin, location, userType });
      await login(response.user, response.token);
    } catch (error: any) {
      console.log('Register error:', error);
      const message = error?.response?.data?.error?.message || t('registration_failed_default');
      Alert.alert(t('registration_failed'), message);
    }
    setLoading(false);
  };

  if (mode === 'welcome') {
    return (
      <ScrollView style={styles.welcomeContainer} contentContainerStyle={styles.welcomeScrollContent}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroPattern}>
            <View style={styles.heroCircle1} />
            <View style={styles.heroCircle2} />
          </View>
          <View style={styles.logoContainer}>
            <View style={styles.logoInner}>
              <Ionicons name="leaf" size={32} color={colors.background.primary} />
            </View>
          </View>
          <Text style={styles.heroTitle}>{t('app_name')}</Text>
          <Text style={styles.heroSubtitle}>{t('app_subtitle')}</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <View style={styles.featureCard}>
            <View style={[styles.featureIconWrap, { backgroundColor: colors.primary[50] }]}>
              <Ionicons name="camera-outline" size={22} color={colors.primary[700]} />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>{t('ai_quality_grading')}</Text>
              <Text style={styles.featureDesc}>Snap a photo, get an instant grade</Text>
            </View>
          </View>
          <View style={styles.featureCard}>
            <View style={[styles.featureIconWrap, { backgroundColor: colors.accent[50] }]}>
              <Ionicons name="trending-up-outline" size={22} color={colors.accent[700]} />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>{t('real_time_market_prices')}</Text>
              <Text style={styles.featureDesc}>AI-powered price intelligence</Text>
            </View>
          </View>
          <View style={styles.featureCard}>
            <View style={[styles.featureIconWrap, { backgroundColor: colors.semantic.infoLight }]}>
              <Ionicons name="people-outline" size={22} color={colors.semantic.info} />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>{t('direct_buyer_connections')}</Text>
              <Text style={styles.featureDesc}>No middlemen, better prices</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.welcomeActions}>
          <TouchableOpacity
            style={styles.getStartedBtn}
            onPress={() => setMode('register')}
            activeOpacity={0.85}
            accessibilityLabel={t('get_started')}
            accessibilityRole="button"
          >
            <Text style={styles.getStartedText}>{t('get_started')}</Text>
            <View style={styles.getStartedArrow}>
              <Ionicons name="arrow-forward" size={18} color={colors.primary[800]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => setMode('login')}
            activeOpacity={0.7}
            accessibilityLabel={t('have_account')}
            accessibilityRole="button"
          >
            <Text style={styles.loginLinkText}>
              {t('have_account')}{' '}
              <Text style={styles.loginLinkBold}>{t('login')}</Text>
            </Text>
          </TouchableOpacity>

          {/* Demo Login Section */}
          <View style={styles.demoSection}>
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('quick_demo')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.demoButtons}>
              {([
                { type: 'farmer' as const, icon: 'leaf' as const, color: colors.primary[700], bg: colors.primary[50] },
                { type: 'buyer' as const, icon: 'cart' as const, color: colors.accent[700], bg: colors.accent[50] },
                { type: 'transporter' as const, icon: 'car' as const, color: colors.semantic.info, bg: colors.semantic.infoLight },
              ]).map(({ type, icon, color, bg }) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.demoButton, demoLoading === type && styles.demoButtonLoading]}
                  onPress={() => handleDemoLogin(type)}
                  activeOpacity={0.8}
                  disabled={!!demoLoading}
                  accessibilityLabel={`${t('demo_login_as').replace('%1', t(type))}`}
                  accessibilityRole="button"
                >
                  <View style={[styles.demoIconWrap, { backgroundColor: bg }]}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>
                  <Text style={styles.demoButtonText}>
                    {demoLoading === type ? '...' : t(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.authContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setMode('welcome')}
          accessibilityLabel={t('back')}
          accessibilityRole="button"
        >
          <View style={styles.backButtonInner}>
            <Ionicons name="arrow-back" size={20} color={colors.primary[800]} />
            <Text variant="label" style={styles.backButtonText}>{t('back')}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.authHeader}>
          <Text variant="heading1" style={styles.authTitle}>
            {mode === 'login' ? t('welcome') : t('register')}
          </Text>
          <Text variant="bodySmall" color="secondary" style={styles.authSubtitle}>
            {mode === 'login'
              ? t('sign_in_subtitle')
              : t('register_subtitle')}
          </Text>
        </View>

        <View style={styles.form}>
          {mode === 'register' && (
            <Input
              label={t('name')}
              value={name}
              onChangeText={setName}
              placeholder={t('enter_name')}
              autoCapitalize="words"
            />
          )}

          <Input
            label={t('phone_number')}
            value={phone}
            onChangeText={setPhone}
            placeholder="+254 7XX XXX XXX"
            keyboardType="phone-pad"
          />

          <Input
            label={t('pin')}
            value={pin}
            onChangeText={(text) => { setPin(text.replace(/[^0-9]/g, '').slice(0, 4)); setPinTouched(true); }}
            placeholder={t('enter_pin')}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            error={pinTouched && pin.length > 0 && pin.length < 4}
            errorText={pinTouched && pin.length > 0 && pin.length < 4 ? t('invalid_pin_message') : undefined}
          />

          {mode === 'register' && (
            <>
              <Input
                label={t('confirm_pin')}
                value={confirmPin}
                onChangeText={(text) => { setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, 4)); setConfirmPinTouched(true); }}
                placeholder={t('confirm_pin')}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                error={confirmPinTouched && confirmPin.length === 4 && confirmPin !== pin}
                errorText={confirmPinTouched && confirmPin.length === 4 && confirmPin !== pin ? t('pin_mismatch_message') : undefined}
              />

              <Input
                label={t('location')}
                value={location}
                onChangeText={setLocation}
                placeholder={t('select_county')}
              />

              <View style={styles.inputGroup}>
                <Text variant="label" style={styles.inputLabel}>{t('user_type')}</Text>
                <View style={styles.userTypeSelector}>
                  {(['farmer', 'buyer', 'transporter'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.userTypeOption,
                        userType === type && styles.userTypeOptionActive,
                      ]}
                      onPress={() => setUserType(type)}
                      accessibilityLabel={t(type)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: userType === type }}
                    >
                      <Text
                        variant="label"
                        color={userType === type ? 'primary' : 'secondary'}
                        style={userType === type ? styles.userTypeOptionTextActive : undefined}
                      >
                        {t(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Privacy Consent Checkbox - Kenya DPA 2019 Compliance */}
              <TouchableOpacity
                style={styles.consentContainer}
                onPress={() => setPrivacyConsent(!privacyConsent)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: privacyConsent }}
                accessibilityLabel={`${t('consent_agree')} ${t('consent_privacy_policy')} ${t('consent_and')} ${t('consent_terms')}`}
              >
                <View style={[styles.checkbox, privacyConsent && styles.checkboxChecked]}>
                  {privacyConsent && (
                    <Ionicons name="checkmark" size={16} color={colors.background.primary} />
                  )}
                </View>
                <Text variant="caption" color="secondary" style={styles.consentText}>
                  {t('consent_agree')}{' '}
                  <Text
                    variant="caption"
                    color="link"
                    underline
                    onPress={() => router.push('/privacy')}
                  >
                    {t('consent_privacy_policy')}
                  </Text>
                  {' '}{t('consent_and')}{' '}
                  <Text
                    variant="caption"
                    color="link"
                    underline
                    onPress={() => router.push('/privacy')}
                  >
                    {t('consent_terms')}
                  </Text>
                  {' '}{t('consent_dpa')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <Button
            variant="primary"
            size="large"
            fullWidth
            onPress={mode === 'login' ? handleLogin : handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.submitButton}
          >
            {mode === 'login' ? t('login') : t('register')}
          </Button>

          <Button
            variant="ghost"
            onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
            style={styles.switchMode}
          >
            {mode === 'login'
              ? `${t('no_account')} ${t('register')}`
              : `${t('have_account')} ${t('login')}`}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  welcomeContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  welcomeScrollContent: {
    flexGrow: 1,
  },
  // ── Hero ──
  heroSection: {
    backgroundColor: colors.primary[800],
    paddingTop: spacing[14],
    paddingBottom: spacing[10],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -40,
    right: -60,
  },
  heroCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -20,
    left: -30,
  },
  logoContainer: {
    marginBottom: spacing[5],
  },
  logoInner: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.background.primary,
    letterSpacing: -0.5,
    marginBottom: spacing[2],
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.primary[200],
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing[4],
  },
  // ── Features ──
  featuresSection: {
    paddingHorizontal: spacing[5],
    marginTop: -spacing[6],
    gap: spacing[2.5],
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing[4],
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  featureIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3.5],
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  featureDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  // ── Actions ──
  welcomeActions: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
  },
  getStartedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[800],
    borderRadius: radius.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    ...shadows.md,
  },
  getStartedText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.background.primary,
    flex: 1,
    textAlign: 'center',
  },
  getStartedArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginLink: {
    alignSelf: 'center',
    marginTop: spacing[4],
    paddingVertical: spacing[2],
  },
  loginLinkText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  loginLinkBold: {
    color: colors.primary[800],
    fontWeight: '700',
  },
  // ── Demo ──
  demoSection: {
    marginTop: spacing[6],
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[200],
  },
  dividerText: {
    paddingHorizontal: spacing[3],
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  demoButtons: {
    flexDirection: 'row',
    gap: spacing[2.5],
  },
  demoButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    paddingVertical: spacing[3.5],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    gap: spacing[2],
    ...shadows.xs,
  },
  demoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  demoButtonLoading: {
    opacity: 0.5,
  },
  authContent: {
    flexGrow: 1,
    padding: spacing[6],
    backgroundColor: colors.background.primary,
  },
  backButton: {
    marginBottom: spacing[4],
  },
  backButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    backgroundColor: colors.neutral[100],
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  backButtonText: {
    color: colors.primary[800],
    fontWeight: '600',
    fontSize: 13,
  },
  authHeader: {
    marginBottom: spacing[6],
  },
  authTitle: {
    color: colors.primary[900],
    marginBottom: spacing[2],
  },
  authSubtitle: {
    lineHeight: 22,
  },
  form: {
    gap: spacing[4],
  },
  inputGroup: {
    gap: spacing[1.5],
  },
  inputLabel: {
    marginBottom: spacing[1],
  },
  userTypeSelector: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  userTypeOption: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.background.primary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    alignItems: 'center',
  },
  userTypeOptionActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[800],
  },
  userTypeOptionTextActive: {
    color: colors.primary[800],
  },
  submitButton: {
    borderRadius: radius.xl,
    marginTop: spacing[2],
    elevation: 4,
  },
  switchMode: {
    marginTop: spacing[2],
  },
  // Privacy consent checkbox styles
  consentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing[2],
    paddingVertical: spacing[2],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.neutral[500],
    marginRight: spacing[3],
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary[800],
    borderColor: colors.primary[800],
  },
  consentText: {
    flex: 1,
    lineHeight: 20,
  },
});
