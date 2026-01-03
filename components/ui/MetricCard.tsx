import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: 'Normal' | 'Warning' | 'Critical';
  trend?: 'up' | 'down' | 'stable';
}

export function MetricCard({ label, value, unit, icon, status, trend }: MetricCardProps) {
  
  // Determine color based on status
  const getStatusColor = () => {
    switch(status) {
      case 'Normal': return Colors.secondary; // Green
      case 'Warning': return Colors.accent;   // Yellow
      case 'Critical': return Colors.danger;  // Red
      default: return Colors.textSecondary;
    }
  };

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={24} color={Colors.primary} />
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>{status}</Text>
        </View>
      </View>

      <Text style={styles.label}>{label}</Text>
      
      <View style={styles.valueContainer}>
        <Text style={styles.value}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: '45%', // Allows 2 cards side-by-side
    marginRight: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  unit: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
});