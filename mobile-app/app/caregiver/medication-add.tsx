import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { addMedicationForPatient, getLinkedPatient } from '@/services/caregiverService';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CaregiverAddMedicationScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');

  // Schedule State
  const [reminderTimes, setReminderTimes] = useState<Date[]>([]);
  const [tempTime, setTempTime] = useState(new Date());
  const [days, setDays] = useState<number[]>([]);

  const toggleDay = (dayIndex: number) => {
    if (days.includes(dayIndex)) {
      setDays(days.filter((d) => d !== dayIndex));
    } else {
      setDays([...days, dayIndex]);
    }
  };

  const addTime = () => {
    const exists = reminderTimes.some(
      (t) =>
        t.getHours() === tempTime.getHours() &&
        t.getMinutes() === tempTime.getMinutes()
    );
    if (!exists) {
      setReminderTimes([...reminderTimes, tempTime]);
    }
  };

  const removeTime = (index: number) => {
    const newTimes = [...reminderTimes];
    newTimes.splice(index, 1);
    setReminderTimes(newTimes);
  };

  const handleSave = async () => {
    if (!name.trim() || !dosage.trim()) {
      Alert.alert('Missing Info', 'Please enter medication name and dosage.');
      return;
    }
    if (reminderTimes.length === 0) {
      Alert.alert('Schedule', 'Please add at least one reminder time.');
      return;
    }
    if (days.length === 0) {
      Alert.alert('Schedule', 'Please select at least one day.');
      return;
    }

    try {
      setLoading(true);

      const linked = await getLinkedPatient();
      if (!linked) {
        Alert.alert('Error', 'No linked patient found.');
        setLoading(false);
        return;
      }

      const times = reminderTimes.map((t) => {
        const h = t.getHours().toString().padStart(2, '0');
        const m = t.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
      });

      const result = await addMedicationForPatient(
        linked.patientId,
        name,
        dosage,
        instructions,
        null, // No image from caregiver side
        times,
        days
      );

      if (result.success) {
        Alert.alert(
          'Success',
          'Medication added for the patient. They and other caregivers have been notified.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to add medication.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && (!name.trim() || !dosage.trim())) {
      Alert.alert('Required', 'Please enter both name and dosage.');
      return;
    }
    setStep(step + 1);
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.label}>Medication Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Aspirin"
        value={name}
        onChangeText={setName}
        placeholderTextColor="#94A3B8"
      />

      <Text style={styles.label}>Dosage</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 100mg, 1 tablet"
        value={dosage}
        onChangeText={setDosage}
        placeholderTextColor="#94A3B8"
      />

      <Text style={styles.label}>Instructions (Optional)</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
        placeholder="e.g. Take with food"
        value={instructions}
        onChangeText={setInstructions}
        multiline
        placeholderTextColor="#94A3B8"
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.label}>Reminder Times</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {reminderTimes.map((time, index) => (
          <View key={index} style={styles.timeChip}>
            <Text style={styles.timeChipText}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <TouchableOpacity onPress={() => removeTime(index)}>
              <Ionicons name="close-circle" size={20} color="#0D9488" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <Text style={styles.label}>Add a Time</Text>

      {Platform.OS === 'android' && (
        <View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.input, { flex: 1 }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 16, color: '#0F172A' }}>
                {tempTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={addTime}>
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {showTimePicker && (
            <DateTimePicker
              value={tempTime}
              mode="time"
              display="default"
              onChange={(event, selectedDate) => {
                setShowTimePicker(false);
                if (selectedDate) setTempTime(selectedDate);
              }}
            />
          )}
        </View>
      )}

      {Platform.OS === 'ios' && (
        <View>
          <View style={styles.timePickerContainer}>
            <DateTimePicker
              value={tempTime}
              mode="time"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) setTempTime(selectedDate);
              }}
              textColor="black"
            />
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={addTime}>
            <Text style={styles.primaryButtonText}>Add Time</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 20 }} />

      <Text style={styles.label}>Days of Week</Text>
      <View style={styles.daysContainer}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.dayButton, days.includes(index) && styles.dayButtonActive]}
            onPress={() => toggleDay(index)}
          >
            <Text style={[styles.dayText, days.includes(index) && styles.dayTextActive]}>
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Medication</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${(step / 2) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setStep(step - 1)}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        {step < 2 ? (
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1 }]}
            onPress={handleNext}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1 }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Save Medication</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
    color: '#0F172A',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E2E8F0',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#0D9488',
  },
  content: { padding: 20 },
  stepContainer: { gap: 20 },
  label: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#1E293B',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#0F172A',
  },
  timePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  dayButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  dayButtonActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  dayText: {
    fontFamily: 'Poppins-Medium',
    color: '#64748B',
  },
  dayTextActive: { color: '#FFFFFF' },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    gap: 16,
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#0D9488',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#64748B',
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  timeChipText: {
    color: '#0D9488',
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#0D9488',
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
