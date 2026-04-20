import { Platform, StyleSheet } from 'react-native';
import { Colors } from './Colors';

/**
 * Global Styles & Layout Constants
 * Use these to ensure consistency across all screens.
 */
export const Styles = StyleSheet.create({
  // standard shadow for cards and floating buttons
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  // Stronger shadow for the SOS button or Modals
  shadowStrong: {
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },

 
  containerPadding: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },

  
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});