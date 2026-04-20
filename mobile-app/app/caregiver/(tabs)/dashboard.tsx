import { Card } from '@/components/ui/Card';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import {
  generateNotifications,
  getLinkedPatient,
  getMedicationLogs,
  getPatientVitals,
  getUnreadCount,
} from '@/services/caregiverService';
import { UserProfile, VitalsRecord } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CaregiverDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<UserProfile | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [latestVitals, setLatestVitals] = useState<VitalsRecord | null>(null);
  const [adherenceRate, setAdherenceRate] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastVitalsTime, setLastVitalsTime] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const linkedPatient = await getLinkedPatient();

      if (!linkedPatient) {
        router.replace('/caregiver/pending');
        return;
      }

      setPatient(linkedPatient.patient);
      setPatientId(linkedPatient.patientId);

      // Generate notifications (awaited so errors are visible and count is accurate)
      await generateNotifications(linkedPatient.patientId);

      // Fetch latest vitals
      const vitals = await getPatientVitals(linkedPatient.patientId, 1);
      if (vitals.length > 0) {
        const latest = vitals[vitals.length - 1];
        setLatestVitals(latest);
        setLastVitalsTime(
          new Date(latest.recorded_at).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      }

      // Calculate today's medication adherence
      const todayStr = new Date().toISOString().split('T')[0];
      const logs = await getMedicationLogs(
        linkedPatient.patientId,
        `${todayStr}T00:00:00`,
        `${todayStr}T23:59:59`
      );
      if (logs.length > 0) {
        const taken = logs.filter((l) => l.status === 'taken').length;
        setAdherenceRate(Math.round((taken / logs.length) * 100));
      }

      // Unread notifications
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('[CaregiverDashboard] Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const getRiskColor = (label?: string) => {
    switch (label) {
      case 'low':
        return Colors.success;
      case 'moderate':
        return Colors.warning;
      case 'high':
        return Colors.danger;
      default:
        return Colors.textSecondary;
    }
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchData} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Monitoring</Text>
              <Text style={styles.patientName}>
                {patient?.full_name || 'Patient'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={async () => {
                await supabase.auth.signOut();
                router.replace('/auth/welcome');
              }}
            >
              <Ionicons name="log-out-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Last update */}
          <View style={styles.lastUpdateRow}>
            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.lastUpdateText}>
              Last vitals: {lastVitalsTime || 'No readings yet'}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          {/* Heart Rate */}
          <Card style={[styles.statCard, { borderLeftColor: '#EF4444', borderLeftWidth: 4 }]}>
            <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="heart" size={20} color="#EF4444" />
            </View>
            <Text style={styles.statValue}>
              {latestVitals ? `${latestVitals.heart_rate}` : '--'}
            </Text>
            <Text style={styles.statLabel}>Heart Rate</Text>
            <Text style={styles.statUnit}>bpm</Text>
          </Card>

          {/* Blood Pressure */}
          <Card style={[styles.statCard, { borderLeftColor: '#3B82F6', borderLeftWidth: 4 }]}>
            <View style={[styles.statIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="water" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>
              {latestVitals
                ? `${latestVitals.systolic_bp}/${latestVitals.diastolic_bp}`
                : '--/--'}
            </Text>
            <Text style={styles.statLabel}>Blood Pressure</Text>
            <Text style={styles.statUnit}>mmHg</Text>
          </Card>
        </View>

        <View style={styles.statsGrid}>
          {/* Adherence */}
          <Card style={[styles.statCard, { borderLeftColor: '#22C55E', borderLeftWidth: 4 }]}>
            <View style={[styles.statIcon, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            </View>
            <Text style={styles.statValue}>
              {adherenceRate !== null ? `${adherenceRate}%` : '--'}
            </Text>
            <Text style={styles.statLabel}>Adherence</Text>
            <Text style={styles.statUnit}>today</Text>
          </Card>

          {/* Health Risk */}
          <Card
            style={[
              styles.statCard,
              {
                borderLeftColor: getRiskColor(latestVitals?.risk_label),
                borderLeftWidth: 4,
              },
            ]}
          >
            <View
              style={[
                styles.statIcon,
                { backgroundColor: getRiskColor(latestVitals?.risk_label) + '20' },
              ]}
            >
              <Ionicons
                name={
                  latestVitals?.risk_label === 'high'
                    ? 'warning'
                    : 'shield-checkmark'
                }
                size={20}
                color={getRiskColor(latestVitals?.risk_label)}
              />
            </View>
            <Text
              style={[
                styles.statValue,
                { color: getRiskColor(latestVitals?.risk_label) },
              ]}
            >
              {latestVitals?.risk_label
                ? latestVitals.risk_label.charAt(0).toUpperCase() +
                  latestVitals.risk_label.slice(1)
                : '--'}
            </Text>
            <Text style={styles.statLabel}>Health Risk</Text>
            <Text style={styles.statUnit}>AI prediction</Text>
          </Card>
        </View>

        {/* Notifications Alert */}
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push('/caregiver/notifications' as any)}
          >
            <Ionicons name="notifications" size={20} color="#F59E0B" />
            <Text style={styles.alertBannerText}>
              {unreadCount} unread alert{unreadCount > 1 ? 's' : ''}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {/* Quick Call */}
        {patient?.phone && (
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => Linking.openURL(`tel:${patient.phone}`)}
          >
            <Ionicons name="call" size={20} color="#FFF" />
            <Text style={styles.callButtonText}>
              Call {patient.full_name?.split(' ')[0] || 'Patient'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    marginBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Poppins-Regular',
    letterSpacing: 0.5,
  },
  patientName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Poppins-Bold',
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  lastUpdateText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Poppins-Regular',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statUnit: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginHorizontal: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertBannerText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Poppins-Medium',
    color: '#92400E',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 10,
    elevation: 4,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  callButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#FFF',
  },
});
