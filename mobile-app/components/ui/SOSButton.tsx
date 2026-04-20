import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface SOSButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function SOSButton({ onPress, disabled }: SOSButtonProps) {
  return (
    <TouchableOpacity 
      style={[styles.container, disabled && { opacity: 0.6 }]} 
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="alert" size={32} color={Colors.danger} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>SOS Emergency</Text>
          <Text style={styles.subtitle}>
            {disabled ? 'Sending SOS...' : 'Press to call help immediately'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.danger,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    // Strong shadow for importance
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#FFE5E5',
    marginTop: 2,
  },
});