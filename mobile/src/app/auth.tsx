import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { login as apiLogin, register as apiRegister } from '../services/api';

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
        'Demo Login Failed',
        'Make sure the backend is running and database is seeded.\n\nRun: npx ts-node scripts/seedListings.ts'
      );
    }
    setDemoLoading(null);
  };

  const handleLogin = async () => {
    if (!phone || !pin) {
      Alert.alert('Missing Fields', 'Please enter phone and PIN');
      return;
    }

    if (pin.length !== 4) {
      Alert.alert('Invalid PIN', 'PIN must be 4 digits');
      return;
    }

    setLoading(true);
    try {
      const response = await apiLogin(phone, pin);
      await login(response.user, response.token);
    } catch (error: any) {
      console.log('Login error:', error);
      const message = error?.response?.data?.error?.message || 'Login failed. Please check your credentials.';
      Alert.alert('Login Failed', message);
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!name || !phone || !pin || !location) {
      Alert.alert('Missing Fields', 'Please fill all fields');
      return;
    }

    if (pin.length !== 4) {
      Alert.alert('Invalid PIN', 'PIN must be 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'PINs do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRegister({ name, phone, pin, location, userType });
      await login(response.user, response.token);
    } catch (error: any) {
      console.log('Register error:', error);
      const message = error?.response?.data?.error?.message || 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', message);
    }
    setLoading(false);
  };

  if (mode === 'welcome') {
    return (
      <ScrollView style={styles.welcomeContainer} contentContainerStyle={styles.welcomeScrollContent}>
        <View style={styles.welcomeContent}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🌱</Text>
          </View>
          <Text style={styles.welcomeTitle}>{t('app_name')}</Text>
          <Text style={styles.welcomeSubtitle}>
            AI-powered marketplace for Kenyan farmers. Get fair prices for your produce.
          </Text>

          <View style={styles.features}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
              <Text style={styles.featureText}>AI quality grading</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
              <Text style={styles.featureText}>Real-time market prices</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
              <Text style={styles.featureText}>Direct buyer connections</Text>
            </View>
          </View>
        </View>

        <View style={styles.welcomeActions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setMode('register')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.textButton}
            onPress={() => setMode('login')}
            activeOpacity={0.8}
          >
            <Text style={styles.textButtonText}>
              Already have an account? <Text style={styles.textButtonLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>

          {/* Demo Login Section */}
          <View style={styles.demoSection}>
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Quick Demo</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.demoHint}>Try the app instantly as:</Text>

            <View style={styles.demoButtons}>
              <TouchableOpacity
                style={[styles.demoButton, demoLoading === 'farmer' && styles.demoButtonLoading]}
                onPress={() => handleDemoLogin('farmer')}
                activeOpacity={0.8}
                disabled={!!demoLoading}
              >
                <Ionicons name="leaf" size={20} color="#2E7D32" />
                <Text style={styles.demoButtonText}>
                  {demoLoading === 'farmer' ? '...' : t('farmer')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoButton, demoLoading === 'buyer' && styles.demoButtonLoading]}
                onPress={() => handleDemoLogin('buyer')}
                activeOpacity={0.8}
                disabled={!!demoLoading}
              >
                <Ionicons name="cart" size={20} color="#1976D2" />
                <Text style={styles.demoButtonText}>
                  {demoLoading === 'buyer' ? '...' : t('buyer')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.demoButton, demoLoading === 'transporter' && styles.demoButtonLoading]}
                onPress={() => handleDemoLogin('transporter')}
                activeOpacity={0.8}
                disabled={!!demoLoading}
              >
                <Ionicons name="car" size={20} color="#F57C00" />
                <Text style={styles.demoButtonText}>
                  {demoLoading === 'transporter' ? '...' : t('transporter')}
                </Text>
              </TouchableOpacity>
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
        <TouchableOpacity style={styles.backButton} onPress={() => setMode('welcome')}>
          <Text style={styles.backButtonText}>{'<'} Back</Text>
        </TouchableOpacity>

        <View style={styles.authHeader}>
          <Text style={styles.authTitle}>
            {mode === 'login' ? t('welcome') : t('register')}
          </Text>
          <Text style={styles.authSubtitle}>
            {mode === 'login'
              ? 'Sign in to access your account'
              : 'Join thousands of farmers getting fair prices'}
          </Text>
        </View>

        <View style={styles.form}>
          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('name')}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('enter_name')}
                placeholderTextColor="#9E9E9E"
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('phone_number')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+254 7XX XXX XXX"
              placeholderTextColor="#9E9E9E"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('pin')}</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={(text) => setPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder={t('enter_pin')}
              placeholderTextColor="#9E9E9E"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
          </View>

          {mode === 'register' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('confirm_pin')}</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPin}
                  onChangeText={(text) => setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder={t('confirm_pin')}
                  placeholderTextColor="#9E9E9E"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('location')}</Text>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder={t('select_county')}
                  placeholderTextColor="#9E9E9E"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('user_type')}</Text>
                <View style={styles.userTypeSelector}>
                  {(['farmer', 'buyer', 'transporter'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.userTypeOption,
                        userType === type && styles.userTypeOptionActive,
                      ]}
                      onPress={() => setUserType(type)}
                    >
                      <Text
                        style={[
                          styles.userTypeOptionText,
                          userType === type && styles.userTypeOptionTextActive,
                        ]}
                      >
                        {t(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={mode === 'login' ? handleLogin : handleRegister}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? t('loading') : mode === 'login' ? t('login') : t('register')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            <Text style={styles.switchModeText}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.switchModeLink}>
                {mode === 'login' ? t('register') : t('login')}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  welcomeScrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  welcomeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoIcon: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2E7D32',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  features: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '700',
    fontSize: 14,
  },
  featureText: {
    fontSize: 15,
    color: '#333',
  },
  welcomeActions: {
    gap: 16,
    paddingBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  textButtonText: {
    fontSize: 14,
    color: '#666',
  },
  textButtonLink: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  authContent: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 15,
    color: '#2E7D32',
    fontWeight: '600',
  },
  authHeader: {
    marginBottom: 32,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  userTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  userTypeOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  userTypeOptionActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  userTypeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  userTypeOptionTextActive: {
    color: '#2E7D32',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  switchMode: {
    alignItems: 'center',
    marginTop: 8,
  },
  switchModeText: {
    fontSize: 14,
    color: '#666',
  },
  switchModeLink: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  // Demo section styles
  demoSection: {
    marginTop: 24,
    paddingTop: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoHint: {
    textAlign: 'center',
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  demoButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  demoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  demoButtonLoading: {
    opacity: 0.6,
  },
  demoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
});
