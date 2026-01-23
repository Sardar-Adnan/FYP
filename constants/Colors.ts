/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#3B82F6';
const tintColorDark = '#fff';

export const Colors = {
  // Brand Colors
  primary: '#3B82F6', // Blue-500 (Lighter)
  secondary: '#60A5FA', // Blue-400
  accent: '#F59E0B', // Amber-500 (Used for Warning/Trend)
  success: '#22C55E', // Green-500
  danger: '#EF4444', // Red-500
  warning: '#F59E0B', // Amber-500

  // Backgrounds
  background: '#F8FAFC',
  card: '#FFFFFF',
  inputBackground: '#FFFFFF',

  // Text
  text: '#0F172A',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textInverse: '#FFFFFF',
  textLight: '#64748B',

  // Borders & Shadows
  border: '#E2E8F0',
  shadow: '#000000',

  // Gray Scale
  gray: {
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  // Theme specific (Required by useThemeColor hook)
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    tint: tintColorLight,
    icon: '#64748B',
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};