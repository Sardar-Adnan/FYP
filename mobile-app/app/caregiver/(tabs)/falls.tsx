import { Card } from '@/components/ui/Card';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import { getFallEvents, getLinkedPatient } from '@/services/caregiverService';
import { FallEvent } from '@/types';
import { exportCSV } from '@/utils/csvExport';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CaregiverFallsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [falls, setFalls] = useState<FallEvent[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const linked = await getLinkedPatient();
      if (!linked) return;
      const data = await getFallEvents(linked.patientId);
      setFalls(data);
    } catch (error) {
      console.error('[CaregiverFalls] Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const getResponseConfig = (response: string) => {
    switch (response) {
      case 'dispatched':
        return {
          icon: 'alert-circle' as const,
          color: '#EF4444',
          bgColor: '#FEE2E2',
          label: 'Emergency Dispatched',
        };
      case 'cancelled':
        return {
          icon: 'checkmark-circle' as const,
          color: '#22C55E',
          bgColor: '#DCFCE7',
          label: 'False Alarm',
        };
      case 'no_response':
        return {
          icon: 'help-circle' as const,
          color: '#F59E0B',
          bgColor: '#FEF3C7',
          label: 'No Response',
        };
      default:
        return {
          icon: 'help' as const,
          color: Colors.textSecondary,
          bgColor: '#F1F5F9',
          label: response,
        };
    }
  };

  const handleExport = () => {
    exportCSV(
      falls.map((f) => ({
        date: new Date(f.created_at).toLocaleDateString(),
        time: new Date(f.created_at).toLocaleTimeString(),
        response: f.response,
        caregiver_notified: f.caregiver_notified ? 'Yes' : 'No',
        latitude: f.latitude || 'N/A',
        longitude: f.longitude || 'N/A',
        maps_link:
          f.latitude && f.longitude
            ? `https://maps.google.com/?q=${f.latitude},${f.longitude}`
            : 'N/A',
      })),
      'fall_events_log',
      [
        { key: 'date', label: 'Date' },
        { key: 'time', label: 'Time' },
        { key: 'response', label: 'Response' },
        { key: 'caregiver_notified', label: 'Notified' },
        { key: 'latitude', label: 'Latitude' },
        { key: 'longitude', label: 'Longitude' },
        { key: 'maps_link', label: 'Maps Link' },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#F8FAFC' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}>
          <Text style={styles.title}>Fall Events</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{falls.length} total</Text>
          </View>
        </View>

        <View style={styles.content}>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <Card style={[styles.summaryCard, { borderLeftColor: '#EF4444', borderLeftWidth: 3 }]}>
            <Text style={styles.summaryValue}>
              {falls.filter((f) => f.response === 'dispatched').length}
            </Text>
            <Text style={styles.summaryLabel}>Dispatched</Text>
          </Card>
          <Card style={[styles.summaryCard, { borderLeftColor: '#22C55E', borderLeftWidth: 3 }]}>
            <Text style={styles.summaryValue}>
              {falls.filter((f) => f.response === 'cancelled').length}
            </Text>
            <Text style={styles.summaryLabel}>False Alarms</Text>
          </Card>
        </View>

        {/* Fall Events List */}
        {falls.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No fall events recorded.</Text>
            <Text style={styles.emptySubtext}>Great news!</Text>
          </View>
        ) : (
          falls.map((fall) => {
            const config = getResponseConfig(fall.response);
            return (
              <Card key={fall.id} style={styles.fallCard}>
                <View style={styles.fallHeader}>
                  <View style={[styles.fallIcon, { backgroundColor: config.bgColor }]}>
                    <Ionicons name={config.icon} size={20} color={config.color} />
                  </View>
                  <View style={styles.fallInfo}>
                    <Text style={styles.fallDate}>
                      {new Date(fall.created_at).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.fallTime}>
                      {new Date(fall.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: config.bgColor }]}>
                    <Text style={[styles.statusChipText, { color: config.color }]}>
                      {config.label}
                    </Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.fallDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons
                      name="notifications"
                      size={14}
                      color={Colors.textSecondary}
                    />
                    <Text style={styles.detailText}>
                      Caregiver notified: {fall.caregiver_notified ? 'Yes ✅' : 'No ❌'}
                    </Text>
                  </View>

                  {fall.latitude && fall.longitude && (
                    <TouchableOpacity
                      style={styles.mapLink}
                      onPress={() =>
                        Linking.openURL(
                          `https://maps.google.com/?q=${fall.latitude},${fall.longitude}`
                        )
                      }
                    >
                      <Ionicons name="location" size={14} color={Colors.primary} />
                      <Text style={styles.mapLinkText}>
                        View Location on Maps
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          })
        )}

        {/* Export */}
        {falls.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
            <Ionicons name="download-outline" size={20} color={Colors.primary} />
            <Text style={styles.exportBtnText}>Download Fall Log (CSV)</Text>
          </TouchableOpacity>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginBottom: 20,
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  summaryValue: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: Colors.success,
    marginTop: 4,
  },
  fallCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fallIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallInfo: { flex: 1 },
  fallDate: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  },
  fallTime: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
  },
  fallDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#F0FDFA',
    padding: 10,
    borderRadius: 8,
  },
  mapLinkText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: Colors.primary,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    marginBottom: 30,
    gap: 8,
  },
  exportBtnText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: Colors.primary,
  },
});
