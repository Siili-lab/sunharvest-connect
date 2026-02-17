import { Tabs } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Polyfill Alert.alert for web — uses window.confirm/alert instead
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const originalAlert = Alert.alert;
  Alert.alert = (title: string, message?: string, buttons?: any[]) => {
    // Find destructive/default action button
    const cancelBtn = buttons?.find(b => b.style === 'cancel');
    const actionBtn = buttons?.find(b => b.style !== 'cancel') || buttons?.[0];

    if (buttons && buttons.length > 1 && cancelBtn) {
      // Confirmation dialog
      if (window.confirm(`${title}\n${message || ''}`)) {
        actionBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
    } else if (buttons && buttons.length === 1) {
      // Simple alert with one button
      window.alert(`${title}\n${message || ''}`);
      buttons[0]?.onPress?.();
    } else {
      // No buttons — just show alert
      window.alert(`${title}\n${message || ''}`);
    }
  };
}
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { ToastProvider } from '../context/ToastContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { ThemeProvider, colors, fontSize } from '@/theme';
import AuthScreen from './auth';

function MainLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useLanguage();
  const { unreadCount } = useNotifications();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary[800]} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const isFarmer = user?.userType === 'farmer';
  const isBuyer = user?.userType === 'buyer';
  const isTransporter = user?.userType === 'transporter';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary[800],
        tabBarInactiveTintColor: colors.neutral[500],
        tabBarStyle: {
          backgroundColor: colors.background.primary,
          borderTopColor: colors.primary[50],
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: '600',
          marginBottom: 6,
        },
        headerShown: true,
        headerStyle: { backgroundColor: colors.primary[800] },
        headerTintColor: colors.text.inverse,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      {/* === 4 VISIBLE TABS === */}

      {/* Tab 1: Home - All roles */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard'),
          tabBarLabel: t('home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />

      {/* Tab 2: Market (farmers/buyers) or Jobs (transporters) */}
      <Tabs.Screen
        name="market"
        options={{
          title: t('marketplace'),
          tabBarLabel: t('market'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront" size={size} color={color} />
          ),
          href: (isFarmer || isBuyer) ? '/market' : null,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: t('deliveries'),
          tabBarLabel: t('jobs'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car" size={size} color={color} />
          ),
          href: isTransporter ? '/deliveries' : null,
        }}
      />

      {/* Tab 3: Orders - All roles */}
      <Tabs.Screen
        name="orders"
        options={{
          title: t('my_orders'),
          tabBarLabel: t('orders'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 4: Profile - All roles */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarLabel: t('profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />

      {/* === HIDDEN SCREENS (accessed via navigation, not tabs) === */}
      <Tabs.Screen name="sell" options={{ title: t('sell_produce'), href: null }} />
      <Tabs.Screen name="grade" options={{ title: t('grade'), href: null }} />
      <Tabs.Screen name="intelligence" options={{ title: t('market_intelligence'), href: null }} />
      <Tabs.Screen name="sacco" options={{ title: t('sacco'), href: null }} />
      <Tabs.Screen name="notifications" options={{ title: t('notifications'), href: null }} />
      <Tabs.Screen name="user-profile" options={{ title: t('view_profile'), href: null }} />
      <Tabs.Screen name="privacy" options={{ title: t('privacy_policy') || 'Privacy Policy', href: null }} />
      <Tabs.Screen name="auth" options={{ href: null }} />
    </Tabs>
  );
}

export default function Layout() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <MainLayout />
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
});
