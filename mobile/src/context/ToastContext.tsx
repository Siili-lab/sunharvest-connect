import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/primitives/Text';
import { colors, spacing, radius, shadows } from '@/theme';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

const TOAST_CONFIG: Record<ToastType, { icon: string; bg: string; border: string; iconColor: string }> = {
  success: {
    icon: 'checkmark-circle',
    bg: colors.semantic.successLight,
    border: colors.semantic.success,
    iconColor: colors.primary[800],
  },
  error: {
    icon: 'alert-circle',
    bg: colors.semantic.errorLight,
    border: colors.semantic.error,
    iconColor: colors.semantic.error,
  },
  info: {
    icon: 'information-circle',
    bg: colors.semantic.infoLight,
    border: colors.semantic.info,
    iconColor: colors.semantic.info,
  },
  warning: {
    icon: 'warning',
    bg: colors.semantic.warningLight,
    border: colors.semantic.warning,
    iconColor: colors.semantic.warning,
  },
};

function Toast({ message, type, onDismiss }: { message: string; type: ToastType; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = TOAST_CONFIG[type];

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  }, [onDismiss]);

  // Expose dismiss for timer
  React.useEffect(() => {
    (dismiss as any).__dismiss = dismiss;
  }, [dismiss]);

  // Store dismiss ref for parent
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          top: insets.top + spacing[2],
          backgroundColor: config.bg,
          borderLeftColor: config.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Ionicons name={config.icon as any} size={22} color={config.iconColor} />
      <Text variant="bodySmall" style={styles.toastText} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const counterRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const id = ++counterRef.current;
    setToast({ id, message, type, duration });

    timerRef.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, duration);
  }, []);

  const handleDismiss = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <View style={styles.container} pointerEvents="none">
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={handleDismiss}
          />
        </View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    gap: spacing[3],
    ...shadows['2xl'],
    // Ensure it's above everything
    ...Platform.select({
      android: { elevation: 24 },
    }),
  },
  toastText: {
    flex: 1,
    color: colors.text.primary,
    fontWeight: '500',
  },
});
