
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MedicationSchedule {
    id: string;
    reminder_time: string;
    days_of_week: number[];
}

export default function EditMedicationScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();

    const [name, setName] = useState('');
    const [dosage, setDosage] = useState('');
    const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editing Schedule State
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [tempTime, setTempTime] = useState(new Date());
    const [tempDays, setTempDays] = useState<number[]>([]);

    useEffect(() => {
        if (id) fetchMedicationDetails();
    }, [id]);

    const fetchMedicationDetails = async () => {
        try {
            // Get Med Info
            const { data: med, error: medError } = await supabase
                .from('medications')
                .select('*')
                .eq('id', id)
                .single();

            if (medError) throw medError;
            setName(med.name);
            setDosage(med.dosage);

            // Get Schedules
            const { data: scheds, error: schedError } = await supabase
                .from('medication_schedules')
                .select('*')
                .eq('med_id', id);

            if (schedError) throw schedError;
            setSchedules(scheds || []);

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load medication details.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDetails = async () => {
        if (!name || !dosage) {
            Alert.alert('Error', 'Please fill in name and dosage.');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('medications')
                .update({ name, dosage })
                .eq('id', id);

            if (error) throw error;

            // Name changed? Resync notifications to show new name
            await resyncNotifications();

            Alert.alert('Success', 'Medication details updated.');
        } catch (error) {
            Alert.alert('Error', 'Failed to update details.');
        } finally {
            setSaving(false);
        }
    };

    // Helper to resync all notifications for this med
    const resyncNotifications = async () => {
        const { resyncNotifications } = require('@/utils/notifications');
        await resyncNotifications();
    };

    const handleDeleteSchedule = async (schedId: string) => {
        Alert.alert('Delete Schedule', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { error } = await supabase
                            .from('medication_schedules')
                            .delete()
                            .eq('id', schedId);
                        if (error) throw error;
                        if (error) throw error;

                        // Update local state first
                        const newSchedules = schedules.filter(s => s.id !== schedId);
                        setSchedules(newSchedules);

                        // Resync (Need to use the NEW list, closure issue)
                        // Note: state update is async, so we can't just call resyncNotifications() relying on 'schedules' state immediately.
                        // We must pass the new list or wait.
                        // Better: refactor resync to accept list.
                        // Resync
                        const { resyncNotifications } = require('@/utils/notifications');
                        await resyncNotifications();

                    } catch (e) {
                        Alert.alert('Error', 'Failed to delete schedule.');
                    }
                }
            }
        ]);
    };

    const startEditSchedule = (schedule: MedicationSchedule) => {
        setEditingScheduleId(schedule.id);
        const [hours, minutes] = schedule.reminder_time.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        setTempTime(date);
        setTempDays(schedule.days_of_week.map(Number)); // Ensure numbers
        setShowTimePicker(false); // Reset picker state
    };

    const toggleDay = (dayIndex: number) => {
        if (tempDays.includes(dayIndex)) {
            setTempDays(tempDays.filter(d => d !== dayIndex));
        } else {
            setTempDays([...tempDays, dayIndex].sort());
        }
    };

    const saveScheduleEdit = async () => {
        if (!editingScheduleId) return;
        if (tempDays.length === 0) {
            Alert.alert('Error', 'Please select at least one day.');
            return;
        }

        const hours = tempTime.getHours().toString().padStart(2, '0');
        const minutes = tempTime.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        try {
            const { error } = await supabase
                .from('medication_schedules')
                .update({
                    reminder_time: timeString,
                    days_of_week: tempDays
                })
                .eq('id', editingScheduleId);

            if (error) throw error;


            // Update local state
            const updatedSchedules = schedules.map(s =>
                s.id === editingScheduleId
                    ? { ...s, reminder_time: timeString, days_of_week: tempDays }
                    : s
            );
            setSchedules(updatedSchedules);
            setEditingScheduleId(null);

            // Resync Notifications
            const { resyncNotifications } = require('@/utils/notifications');
            await resyncNotifications();

            Alert.alert('Success', 'Schedule updated.');

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to update schedule.');
        }
    };

    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Medication</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Details</Text>
                <InputField
                    label="Name"
                    value={name}
                    onChangeText={setName}
                    placeholder="Medication Name"
                    icon="medkit-outline"
                />
                <InputField
                    label="Dosage"
                    value={dosage}
                    onChangeText={setDosage}
                    placeholder="e.g. 500mg"
                    icon="flask-outline"
                />
                <Button
                    title="Update Details"
                    onPress={handleSaveDetails}
                    isLoading={saving}
                    style={{ marginTop: 8 }}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Schedules</Text>
                {schedules.map((schedule, index) => {
                    const isEditing = editingScheduleId === schedule.id;

                    if (isEditing) {
                        return (
                            <View key={schedule.id} style={styles.editCard}>
                                <Text style={styles.label}>Time</Text>
                                <TouchableOpacity
                                    style={styles.timeButton}
                                    onPress={() => setShowTimePicker(true)}
                                >
                                    <Text style={styles.timeButtonText}>
                                        {tempTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </TouchableOpacity>

                                {showTimePicker && (
                                    <DateTimePicker
                                        value={tempTime}
                                        mode="time"
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            setShowTimePicker(Platform.OS === 'ios');
                                            if (selectedDate) setTempTime(selectedDate);
                                        }}
                                    />
                                )}

                                <Text style={[styles.label, { marginTop: 12 }]}>Days</Text>
                                <View style={styles.daysContainer}>
                                    {DAYS.map((day, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={[
                                                styles.dayButton,
                                                tempDays.includes(i) && styles.dayButtonActive
                                            ]}
                                            onPress={() => toggleDay(i)}
                                        >
                                            <Text style={[
                                                styles.dayText,
                                                tempDays.includes(i) && styles.dayTextActive
                                            ]}>
                                                {day[0]}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.editActions}>
                                    <Button
                                        title="Cancel"
                                        variant="secondary"
                                        onPress={() => setEditingScheduleId(null)}
                                        style={{ flex: 1, marginRight: 8 }}
                                    />
                                    <Button
                                        title="Save"
                                        onPress={saveScheduleEdit}
                                        style={{ flex: 1 }}
                                    />
                                </View>
                            </View>
                        );
                    }

                    return (
                        <View key={schedule.id} style={styles.scheduleCard}>
                            <View>
                                <Text style={styles.scheduleTime}>
                                    {new Date(`2000-01-01T${schedule.reminder_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                <Text style={styles.scheduleDays}>
                                    {schedule.days_of_week.map(d => DAYS[d]).join(', ')}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <TouchableOpacity onPress={() => startEditSchedule(schedule)}>
                                    <Ionicons name="pencil" size={20} color={Colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDeleteSchedule(schedule.id)}>
                                    <Ionicons name="trash" size={20} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 20,
        color: '#0F172A',
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
        color: '#1E293B',
        marginBottom: 12,
    },
    scheduleCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 1,
    },
    scheduleTime: {
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
        color: '#1E293B',
    },
    scheduleDays: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#64748B',
    },
    editCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    label: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        color: '#64748B',
        marginBottom: 8,
    },
    timeButton: {
        backgroundColor: '#F1F5F9',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    timeButtonText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        color: '#1E293B',
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    dayButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayButtonActive: {
        backgroundColor: Colors.primary,
    },
    dayText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
        color: '#64748B',
    },
    dayTextActive: {
        color: '#FFFFFF',
    },
    editActions: {
        flexDirection: 'row',
        marginTop: 16,
    }
});
