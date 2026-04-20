import { Card } from '@/components/ui/Card';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import {
  getLinkedPatient,
  getMedicationLogs,
  getMedicationSchedules,
  getPatientMedications,
} from '@/services/caregiverService';
import { Medication, MedicationLog } from '@/types';
import { exportCSV } from '@/utils/csvExport';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface DailyAdherence {
  medication: Medication;
  scheduleTime: string;
  status: string;
}

export default function CaregiverMedicationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todayLogs, setTodayLogs] = useState<MedicationLog[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<{ date: string; rate: number }[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [dailyItems, setDailyItems] = useState<DailyAdherence[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const linked = await getLinkedPatient();
      if (!linked) return;
      setPatientId(linked.patientId);

      // Get medications
      const meds = await getPatientMedications(linked.patientId);
      setMedications(meds);

      // Get schedules
      const medIds = meds.map((m) => m.id);
      const schedules = await getMedicationSchedules(medIds);

      // Get today's logs
      const todayStr = new Date().toISOString().split('T')[0];
      const logs = await getMedicationLogs(
        linked.patientId,
        `${todayStr}T00:00:00`,
        `${todayStr}T23:59:59`
      );
      setTodayLogs(logs);

      // Build daily adherence items
      const today = new Date();
      const dayOfWeek = today.getDay();
      const todaySchedules = schedules.filter((s) => {
        const numericDays = s.days_of_week.map((d: any) => Number(d));
        return numericDays.includes(dayOfWeek);
      });

      const items: DailyAdherence[] = todaySchedules.map((sched) => {
        const med = meds.find((m) => m.id === sched.med_id);
        const log = logs.find((l) => l.schedule_id === sched.id);
        return {
          medication: med!,
          scheduleTime: sched.reminder_time,
          status: log?.status || 'pending',
        };
      });

      items.sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime));
      setDailyItems(items);

      // Weekly adherence stats
      const stats: { date: string; rate: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLogs = await getMedicationLogs(
          linked.patientId,
          `${dateStr}T00:00:00`,
          `${dateStr}T23:59:59`
        );
        if (dayLogs.length > 0) {
          const taken = dayLogs.filter((l) => l.status === 'taken').length;
          stats.push({
            date: d.toLocaleDateString([], { weekday: 'short' }),
            rate: Math.round((taken / dayLogs.length) * 100),
          });
        } else {
          stats.push({
            date: d.toLocaleDateString([], { weekday: 'short' }),
            rate: 0,
          });
        }
      }
      setWeeklyStats(stats);
    } catch (error) {
      console.error('[CaregiverMeds] Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'taken':
        return { name: 'checkmark-circle' as const, color: Colors.success };
      case 'skipped':
        return { name: 'play-skip-forward' as const, color: Colors.warning };
      case 'missed':
      case 'not taken':
        return { name: 'close-circle' as const, color: Colors.danger };
      default:
        return { name: 'time' as const, color: Colors.textSecondary };
    }
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const handleExport = () => {
    const exportData = todayLogs.map((log) => {
      const med = medications.find((m) => m.id === log.med_id);
      return {
        medication: med?.name || 'Unknown',
        dosage: med?.dosage || '',
        status: log.status,
        scheduled_at: new Date(log.scheduled_at).toLocaleString(),
        taken_at: log.taken_at ? new Date(log.taken_at).toLocaleString() : '',
      };
    });

    exportCSV(exportData, 'medication_adherence', [
      { key: 'medication', label: 'Medication' },
      { key: 'dosage', label: 'Dosage' },
      { key: 'status', label: 'Status' },
      { key: 'scheduled_at', label: 'Scheduled At' },
      { key: 'taken_at', label: 'Taken At' },
    ]);
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={[styles.center, { backgroundColor: '#F8FAFC' }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}>
          <Text style={styles.title}>Medication Report</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/caregiver/medication-add' as any)}
          >
            <Ionicons name="add-circle" size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
        {/* Weekly Adherence Bar Chart */}
        <Text style={styles.sectionTitle}>Weekly Adherence</Text>
        <Card style={styles.chartCard}>
          <View style={styles.barChart}>
            {weeklyStats.map((stat, index) => (
              <View key={index} style={styles.barColumn}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(stat.rate, 5)}%`,
                        backgroundColor:
                          stat.rate >= 80
                            ? Colors.success
                            : stat.rate >= 50
                            ? Colors.warning
                            : stat.rate > 0
                            ? Colors.danger
                            : '#E2E8F0',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{stat.date}</Text>
                <Text style={styles.barValue}>{stat.rate}%</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Today's Schedule */}
        <Text style={styles.sectionTitle}>Today's Medications</Text>
        {dailyItems.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', padding: 20 }}>
              <Ionicons name="medical-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No medications scheduled today.</Text>
            </View>
          </Card>
        ) : (
          dailyItems.map((item, index) => {
            const { name, color } = getStatusIcon(item.status);
            return (
              <Card key={index} style={styles.medCard}>
                <View style={styles.medRow}>
                  <Ionicons name={name} size={24} color={color} />
                  <View style={styles.medInfo}>
                    <Text style={styles.medName}>
                      {item.medication?.name || 'Unknown'}
                    </Text>
                    <Text style={styles.medDosage}>
                      {item.medication?.dosage} • {formatTime(item.scheduleTime)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: color + '20' },
                    ]}
                  >
                    <Text style={[styles.statusText, { color }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}

        {/* Active Medications List */}
        <Text style={styles.sectionTitle}>Active Medications</Text>
        {medications.map((med) => (
          <Card key={med.id} style={styles.activeMedCard}>
            <Text style={styles.activeMedName}>{med.name}</Text>
            <Text style={styles.activeMedDosage}>{med.dosage}</Text>
            {med.instructions ? (
              <Text style={styles.activeMedInstructions}>
                📋 {med.instructions}
              </Text>
            ) : null}
          </Card>
        ))}

        {/* Export */}
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="download-outline" size={20} color={Colors.primary} />
          <Text style={styles.exportBtnText}>Download Adherence Report (CSV)</Text>
        </TouchableOpacity>
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
  addBtn: { padding: 4 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 12,
    marginTop: 20,
  },
  chartCard: { padding: 16 },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
  },
  barColumn: { alignItems: 'center', flex: 1 },
  barContainer: {
    height: 100,
    width: 24,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: 12 },
  barLabel: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
    color: Colors.textSecondary,
    marginTop: 6,
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  medCard: { marginBottom: 8 },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  medInfo: { flex: 1 },
  medName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  },
  medDosage: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  activeMedCard: { marginBottom: 8 },
  activeMedName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  },
  activeMedDosage: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activeMedInstructions: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginTop: 8,
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
