/**
 * Theme Provider
 *
 * Provides theme context to entire app.
 * Supports light/dark mode switching.
 *
 * Usage:
 *   const { theme, toggleTheme } = useTheme();
 */

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, spacing, layout, radius, typography, shadows } from './tokens';

// ===== Theme Type Definitions =====

interface Theme {
  colors: typeof colors;
  spacing: typeof spacing;
  layout: typeof layout;
  radius: typeof radius;
  typography: typeof typography;
  shadows: typeof shadows;
  isDark: boolean;
}

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: 'light' | 'dark' | 'system') => void;
}

// ===== Light Theme =====

const lightTheme: Theme = {
  colors: {
    ...colors,
    background: {
      primary: '#FFFFFF',
      secondary: '#F5F5F5',
      tertiary: '#EEEEEE',
      elevated: '#FFFFFF',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
      disabled: '#BDBDBD',
      inverse: '#FFFFFF',
      link: '#1976D2',
    },
  },
  spacing,
  layout,
  radius,
  typography,
  shadows,
  isDark: false,
};

// ===== Dark Theme =====

const darkTheme: Theme = {
  colors: {
    ...colors,
    background: {
      primary: '#121212',
      secondary: '#1E1E1E',
      tertiary: '#2C2C2C',
      elevated: '#1E1E1E',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      disabled: '#666666',
      inverse: '#121212',
      link: '#64B5F6',
    },
  },
  spacing,
  layout,
  radius,
  typography,
  shadows,
  isDark: true,
};

// ===== Context =====

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ===== Provider Component =====

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  const theme = useMemo(() => {
    return isDark ? darkTheme : lightTheme;
  }, [isDark]);

  const toggleTheme = () => {
    setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
  };

  const value = useMemo(
    () => ({
      theme,
      isDark,
      toggleTheme,
      setTheme,
    }),
    [theme, isDark]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ===== Hook =====

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// ===== Direct Theme Access (for StyleSheet) =====

export { lightTheme, darkTheme };
export type { Theme, ThemeContextType };
