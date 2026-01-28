import { Tabs } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import AuthScreen from './auth';

function MainLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2E7D32" />
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
        tabBarActiveTintColor: '#2E7D32',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E8F5E9',
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 6,
        },
        headerShown: true,
        headerStyle: { backgroundColor: '#2E7D32' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      {/* Dashboard - All roles */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('dashboard'),
          tabBarLabel: t('home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      {/* Sell - Farmers only */}
      <Tabs.Screen
        name="sell"
        options={{
          title: t('sell_produce'),
          tabBarLabel: t('sell'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size} color={color} />
          ),
          href: isFarmer ? '/sell' : null,
        }}
      />

      {/* Market - Farmers and Buyers */}
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

      {/* Deliveries - Transporters only */}
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

      {/* Orders - Farmers and Buyers */}
      <Tabs.Screen
        name="orders"
        options={{
          title: t('my_orders'),
          tabBarLabel: t('orders'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
          href: (isFarmer || isBuyer) ? '/orders' : null,
        }}
      />

      {/* Intelligence - Hidden from tabs, accessed via dashboard */}
      <Tabs.Screen
        name="intelligence"
        options={{
          title: t('market_intelligence'),
          href: null,
        }}
      />

      {/* SACCO - Hidden from tabs, accessed via Profile */}
      <Tabs.Screen
        name="sacco"
        options={{
          title: t('sacco'),
          href: null,
        }}
      />

      {/* Profile - All roles */}
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

      {/* Hidden screens */}
      <Tabs.Screen name="auth" options={{ href: null }} />
      <Tabs.Screen name="grade" options={{ href: null }} />
    </Tabs>
  );
}

export default function Layout() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
});
