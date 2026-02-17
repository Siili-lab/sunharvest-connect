import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/primitives/Text';
import { Button } from '../components/primitives/Button';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationItem,
} from '../services/api';
import { colors, spacing, radius, shadows } from '@/theme';

const NOTIFICATION_ICONS: Record<string, string> = {
  offer_received: 'pricetag',
  offer_accepted: 'checkmark-circle',
  offer_declined: 'close-circle',
  payment_confirmed: 'card',
  delivery_completed: 'car',
  delivery_started: 'car',
  transaction_complete: 'checkmark-done-circle',
  loan_approved: 'wallet',
  price_alert: 'trending-up',
};

function getRelativeTime(dateStr: string, t: (key: any) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return t('just_now');
  if (diffMinutes < 60) return t('minutes_ago').replace('%1', String(diffMinutes));
  if (diffHours < 24) return t('hours_ago').replace('%1', String(diffHours));
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const result = await getNotifications();
      setNotifications(result.notifications);
    } catch (error) {
      console.log('Failed to fetch notifications:', error);
      setNotifications([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleTap = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        refreshUnreadCount();
      } catch {}
    }

    // Navigate based on notification data
    if (notification.data?.transactionId) {
      router.push('/orders');
    } else if (notification.data?.listingId) {
      router.push('/market');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshUnreadCount();
    } catch {}
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const iconName = NOTIFICATION_ICONS[item.type] || 'notifications';

    return (
      <TouchableOpacity
        style={[styles.notificationItem, !item.isRead && styles.notificationUnread]}
        onPress={() => handleTap(item)}
        activeOpacity={0.7}
        accessibilityLabel={`${item.title}: ${item.message}`}
      >
        <View style={[styles.iconWrap, !item.isRead && styles.iconWrapUnread]}>
          <Ionicons
            name={iconName as any}
            size={20}
            color={!item.isRead ? colors.primary[800] : colors.neutral[500]}
          />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, !item.isRead && styles.notificationTitleUnread]}>
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.notificationTime}>
            {getRelativeTime(item.createdAt, t)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[800]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {hasUnread && (
        <TouchableOpacity style={styles.markAllReadBtn} onPress={handleMarkAllRead}>
          <Ionicons name="checkmark-done" size={18} color={colors.primary[800]} />
          <Text style={styles.markAllReadText}>{t('mark_all_read')}</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary[800]]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.neutral[400]} />
            <Text style={styles.emptyTitle}>{t('no_notifications_yet')}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  markAllReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[1],
  },
  markAllReadText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[800],
  },
  notificationItem: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  notificationUnread: {
    backgroundColor: colors.primary[50],
  },
  iconWrap: {
    width: spacing[10],
    height: spacing[10],
    borderRadius: spacing[5],
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  iconWrapUnread: {
    backgroundColor: colors.primary[100],
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    flex: 1,
  },
  notificationTitleUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[800],
    marginLeft: spacing[2],
  },
  notificationMessage: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  notificationTime: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing[20],
  },
  emptyTitle: {
    fontSize: 16,
    color: colors.neutral[500],
    marginTop: spacing[4],
  },
});
