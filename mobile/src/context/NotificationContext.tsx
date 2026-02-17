import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { getUnreadCount, type NotificationItem } from '../services/api';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  addNotification: (notification: NotificationItem) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Build WebSocket URL from API URL pattern
const getWsUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'web') {
      return 'ws://localhost:3000/ws';
    }
    return Platform.OS === 'android'
      ? 'ws://10.0.2.2:3000/ws'
      : 'ws://localhost:3000/ws';
  }
  return 'wss://api.sunharvest.com/ws';
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently fail
    }
  }, []);

  const addNotification = useCallback((notification: NotificationItem) => {
    setNotifications((prev) => [notification, ...prev.slice(0, 49)]);
    if (!notification.isRead) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  const connectWebSocket = useCallback(async () => {
    if (!isAuthenticated) return;

    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const wsUrl = `${getWsUrl()}?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WS] Connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);

          if (data.type === 'notification') {
            addNotification(data.notification);

            // Show toast for important notification types
            const importantTypes = [
              'payment_confirmed',
              'offer_received',
              'offer_accepted',
              'delivery_completed',
              'transaction_complete',
              'loan_approved',
            ];
            if (importantTypes.includes(data.notification.type)) {
              showToast(data.notification.title, 'success');
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        wsRef.current = null;

        // Auto-reconnect after 5 seconds
        if (isAuthenticated) {
          reconnectTimer.current = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        }
      };

      ws.onerror = () => {
        // Will trigger onclose
      };

      wsRef.current = ws;
    } catch {
      // Connection failed, will retry
    }
  }, [isAuthenticated, addNotification, showToast]);

  // Connect on auth, disconnect on logout
  useEffect(() => {
    if (isAuthenticated) {
      refreshUnreadCount();
      connectWebSocket();
    } else {
      // Disconnect
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [isAuthenticated, connectWebSocket, refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        refreshUnreadCount,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
