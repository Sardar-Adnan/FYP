import { MedicationCard } from '@/components/MedicationCard';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Medication, MedicationLog, MedicationSchedule } from '@/types';
import { cancelRemindersForDose } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Combined type for the UI
interface ReminderItem {
  scheduleId: string;
  medication: Medication;
  schedule: MedicationSchedule;
  log?: MedicationLog;
  computedStatus: 'upcoming' | 'taken' | 'skipped' | 'missed' | 'not taken';
}


export default function MedicationDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  const fetchDailyMedications = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const dayOfWeek = today.getDay(); // 0-6
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

      // 1. Get active medications for the user
      const { data: meds, error: medsError } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', user.id)
        .eq('is_active', true);

      if (medsError) throw medsError;

      if (!meds || meds.length === 0) {
        setReminders([]);
        return;
      }

      const medIds = meds.map(m => m.id);

      // 2. Get schedules for these meds
      const { data: schedules, error: schedError } = await supabase
        .from('medication_schedules')
        .select('*')
        .in('med_id', medIds);

      if (schedError) throw schedError;

      // Filter for today's schedules
      const todaySchedules = (schedules || []).filter((s: MedicationSchedule) => {
        // Handle potential string/number mismatch
        const scheduleDays = s.days_of_week.map((d: any) => Number(d));
        return scheduleDays.includes(dayOfWeek);
      });

      // 3. Get logs for today
      // Check logs where scheduled_at starts with today's date
      // Or cleaner: store scheduled_at as ISO string, so we can query range or just filter
      const { data: logs, error: logsError } = await supabase
        .from('medication_logs')
        .select('*')
        .gte('scheduled_at', `${dateStr}T00:00:00`)
        .lte('scheduled_at', `${dateStr}T23:59:59`);

      if (logsError) throw logsError;

      // 4. Combine
      const items: ReminderItem[] = todaySchedules.map((sched: MedicationSchedule) => {
        const med = meds.find(m => m.id === sched.med_id)!;

        // Find if there is a log for this specific schedule today
        // We assume one schedule instance per day for simplicity in this schema
        // (If multiple times per day were separate rows in 'medication_schedules', this works.
        // If 'reminder_time' was an array, we'd need to flatten.)
        // Based on schema: "reminder_time" is string (single time). So one row per time. Correct.

        const log = logs?.find((l: MedicationLog) => l.schedule_id === sched.id);

        let status: 'upcoming' | 'taken' | 'skipped' | 'missed' | 'not taken' = 'upcoming';

        if (log) {
          status = log.status as any;
        } else {
          // Calculate if missed
          // Parse reminder_time "HH:MM"
          const [hours, minutes] = sched.reminder_time.split(':').map(Number);
          const scheduleDate = new Date();
          scheduleDate.setHours(hours, minutes, 0, 0);

          const now = new Date();
          if (now > scheduleDate) {
            // If more than 2 hours passed? Or just passed?
            // Let's use strict "missed" if 30 mins passed for demo
            // Or simple: "Upcoming" includes overdues in gray, but "Missed" helps urgency.
            // User requested Red for Missed.
            if (now.getTime() - scheduleDate.getTime() > 60 * 60 * 1000) { // 1 hour buffer
              status = 'not taken';
            }
          }
        }

        return {
          scheduleId: sched.id,
          medication: med,
          schedule: sched,
          log,
          computedStatus: status,
        };
      });

      // Sort by time
      items.sort((a, b) => a.schedule.reminder_time.localeCompare(b.schedule.reminder_time));

      setReminders(items);

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load medications');
    } finally {
      setLoading(false);
    }
  };

  // Reload when screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchDailyMedications();
    }, [])
  );

  const handleStatusUpdate = async (item: ReminderItem, newStatus: 'taken' | 'skipped') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStr = new Date().toISOString().split('T')[0];
      // Safely handle "HH:MM" or "HH:MM:SS" from DB
      const [hours, minutes] = item.schedule.reminder_time.split(':');
      const scheduledAt = `${todayStr}T${hours}:${minutes}:00`;

      const logEntry = {
        patient_id: user.id,
        med_id: item.medication.id,
        schedule_id: item.schedule.id,
        status: newStatus,
        scheduled_at: scheduledAt,
        taken_at: newStatus === 'taken' ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('medication_logs')
        .upsert(logEntry);

      if (error) throw error;

      // Cancel future reminders (e.g. the +30m warning) if user took it
      if (newStatus === 'taken') {
        try {
          // We pass the exact scheduled time for this slot
          await cancelRemindersForDose(item.medication.id, scheduledAt);
        } catch (cancelErr) {
          console.error('Failed to cancel notifications:', cancelErr);
        }
      }

      fetchDailyMedications();

    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update status');
    }
  };


  const handleDelete = async (item: ReminderItem) => {
    Alert.alert(
      'Delete Medication',
      `Are you sure you want to remove ${item.medication.name}? This will stop all future reminders.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              // Deactivate the medication
              const { error } = await supabase
                .from('medications')
                .update({ is_active: false })
                .eq('id', item.medication.id);

              if (error) throw error;

              // Reload list
              fetchDailyMedications();

            } catch (err: any) {
              console.error('Delete failed:', err);
              Alert.alert('Error', 'Failed to delete medication.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: ReminderItem }) => (
    <MedicationCard
      name={item.medication.name}
      dosage={item.medication.dosage}
      imageUrl={item.medication.image_url || undefined}
      status={item.computedStatus}
      scheduledTime={formatTime(item.schedule.reminder_time)}
      onTake={() => handleStatusUpdate(item, 'taken')}
      onSkip={() => handleStatusUpdate(item, 'skipped')}
    />
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today's Meds</Text>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <TouchableOpacity
            onPress={() => router.push('/elderly/medication-history' as any)}
            style={styles.actionPill}
          >
            <Ionicons name="bar-chart-outline" size={16} color={Colors.primary} />
            <Text style={styles.actionPillText}>Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/elderly/medication-manage')}
            style={styles.actionPill}
          >
            <Ionicons name="options-outline" size={16} color={Colors.primary} />
            <Text style={styles.actionPillText}>Manage</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : reminders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="medical-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No medications scheduled for today.</Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          renderItem={renderItem}
          keyExtractor={(item) => item.scheduleId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB to Add Medication */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/elderly/medication-add')}
        accessibilityRole="button"
        accessibilityLabel="Add new medication"
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

// Utility to format HH:MM to 12h format
function formatTime(time: string) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 60, // Safe area
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: '#0F172A',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  actionPillText: {
    fontSize: 13,
    color: Colors.primary,
    fontFamily: 'Poppins-SemiBold',
  },
  dateText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#64748B',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100, // Space for FAB
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 180, // Moved up significantly to clear custom tab bar
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  }
});