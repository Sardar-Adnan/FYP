import React from 'react';
import { 
  Text, 
  Pressable, 
  StyleSheet, 
  ViewStyle, 
  ActivityIndicator,
  Platform
} from 'react-native';
import { Colors } from '@/constants/Colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'default' | 'large';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'default',
  isLoading = false,
  disabled = false,
  style 
}: ButtonProps) {
  
  const getBackgroundColor = () => {
    if (disabled) return '#CBD5E1';
    switch (variant) {
      case 'primary': return Colors.primary;
      case 'secondary': return Colors.secondary;
      case 'danger': return Colors.danger;
      case 'outline': return 'transparent';
      default: return Colors.primary;
    }
  };

  const getTextColor = () => {
    if (variant === 'outline') return Colors.primary;
    return Colors.textInverse;
  };

  const getBorder = () => {
    if (variant === 'outline') return { borderWidth: 2, borderColor: Colors.primary };
    return {};
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.container,
        { 
          backgroundColor: getBackgroundColor(),
          opacity: pressed ? 0.9 : 1,
          paddingVertical: size === 'large' ? 18 : 14,
          ...getBorder(),
        },
        (variant !== 'outline' && !disabled) && styles.shadow,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor(), fontSize: size === 'large' ? 18 : 16 }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 30, // PILL SHAPE
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});