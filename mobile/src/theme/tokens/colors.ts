export const colors = {
  // Primary - Growth Green (main brand color used across the app)
  primary: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#4CAF50', // Main - Use for primary buttons, highlights
    600: '#43A047',
    700: '#388E3C',
    800: '#2E7D32',
    900: '#1B5E20',
  },

  // Accent - Harvest Gold
  accent: {
    50: '#FFF8E1',
    100: '#FFECB3',
    200: '#FFE082',
    300: '#FFD54F',
    400: '#FFCA28',
    500: '#FFC107', // Main - Use for accent highlights
    600: '#FFB300',
    700: '#FFA000',
    800: '#FF8F00',
    900: '#FF6F00',
  },

  // Secondary - Earth Brown (used for secondary actions and price labels)
  secondary: {
    50: '#EFEBE9',
    100: '#D7CCC8',
    200: '#BCAAA4',
    300: '#A1887F',
    400: '#8D6E63',
    500: '#795548',
    600: '#6D4C41',
    700: '#5D4037',
    800: '#4E342E',
    900: '#3E2723',
  },

  // Neutral
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    1000: '#000000',
  },

  semantic: {
    success: '#4CAF50',
    successLight: '#E8F5E9',
    warning: '#FF9800',
    warningLight: '#FFF3E0',
    error: '#F44336',
    errorLight: '#FFEBEE',
    info: '#2196F3',
    infoLight: '#E3F2FD',
  },

  // Quality grades
  grade: {
    premium: {
      main: '#4CAF50',
      light: '#E8F5E9',
      text: '#1B5E20',
    },
    gradeA: {
      main: '#8BC34A',
      light: '#F1F8E9',
      text: '#33691E',
    },
    gradeB: {
      main: '#FFC107',
      light: '#FFF8E1',
      text: '#FF6F00',
    },
    reject: {
      main: '#F44336',
      light: '#FFEBEE',
      text: '#B71C1C',
    },
  },

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

  border: {
    light: '#E0E0E0',
    medium: '#BDBDBD',
    dark: '#757575',
    focus: '#2E7D32',
  },

  overlay: {
    light: 'rgba(255, 255, 255, 0.8)',
    dark: 'rgba(0, 0, 0, 0.5)',
    scrim: 'rgba(0, 0, 0, 0.32)',
  },
} as const;

export type ColorToken = typeof colors;
