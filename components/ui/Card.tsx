import React from 'react';
import { View, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native'; // Added StyleProp
import { Colors } from '@/constants/Colors';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'flat';
  style?: StyleProp<ViewStyle>; // <--- CHANGED THIS: Allows arrays [style1, style2]
}

export function Card({ children, variant = 'elevated', style }: CardProps) {
  return (
    <View style={[
      styles.card, 
      variant === 'elevated' && styles.shadow, 
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  }
});