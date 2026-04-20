import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
// Note: expo-sharing is dynamically imported in downloadReport() to avoid native module crash in Expo Go
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { documentDirectory, writeAsStringAsync, EncodingType } = FileSystem;

// ===== TYPES =====
interface MedicationLog {
    id: string;
    patient_id: string;
    med_id: string;
    schedule_id: string;
    status: 'taken' | 'missed' | 'skipped' | 'not taken';
    scheduled_at: string;
    taken_at: string | null;
    medication?: { name: string };
}

interface DailyStats {
    date: string;
    total: number;
    taken: number;
    missed: number;
    late: number;
    adherenceRate: number;
}

interface TimeSlotStats {
    slot: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
    total: number;
    taken: number;
    adherenceRate: number;
}

interface MissedDose {
    medName: string;
    scheduledAt: string;
    daysSince: number;
}

// ===== HELPER FUNCTIONS =====
const getTimeSlot = (time: string): TimeSlotStats['slot'] => {
    const hour = new Date(time).getHours();
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
};

const isLate = (scheduled: string, taken: string | null): boolean => {
    if (!taken) return false;
    const diffMinutes = (new Date(taken).getTime() - new Date(scheduled).getTime()) / 60000;
    return diffMinutes > 60; // >1 hour = late
};

const getAdherenceColor = (rate: number): string => {
    if (rate >= 80) return '#0a5c28ff'; // Green
    if (rate >= 60) return '#e2ad0eff'; // Yellow
    return '#8d1919ff'; // Red
};

const getAdherenceLabel = (rate: number): string => {
    if (rate >= 80) return 'Adherent';
    if (rate >= 60) return 'Needs Attention';
    return 'Poor';
};

// ===== MAIN COMPONENT =====
export default function MedicationHistoryScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<MedicationLog[]>([]);

    // Calculated metrics
    const [adherenceRate, setAdherenceRate] = useState(0);
    const [promptnessScore, setPromptnessScore] = useState(0);
    const [lateDoses, setLateDoses] = useState(0);
    const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
    const [timeSlotStats, setTimeSlotStats] = useState<TimeSlotStats[]>([]);
    const [missedDoses, setMissedDoses] = useState<MissedDose[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Calculate 30 days range
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);

            // Fetch logs with medication names
            const { data: logData, error } = await supabase
                .from('medication_logs')
                .select(`
                    *,
                    medication:med_id(name)
                `)
                .eq('patient_id', user.id)
                .gte('scheduled_at', startDate.toISOString())
                .lte('scheduled_at', endDate.toISOString())
                .order('scheduled_at', { ascending: false });

            if (error) throw error;

            const fetchedLogs = (logData || []) as MedicationLog[];
            setLogs(fetchedLogs);

            // Calculate all metrics
            calculateMetrics(fetchedLogs, startDate, endDate);

        } catch (error) {
            console.error('Error fetching adherence data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateMetrics = (logs: MedicationLog[], startDate: Date, endDate: Date) => {
        const total = logs.length;
        const taken = logs.filter(l => l.status === 'taken').length;
        const missed = logs.filter(l => l.status === 'missed' || l.status === 'not taken').length;
        const late = logs.filter(l => l.status === 'taken' && isLate(l.scheduled_at, l.taken_at)).length;

        // 1. Adherence Rate
        const rate = total > 0 ? (taken / total) * 100 : 0;
        setAdherenceRate(Math.round(rate));

        // 2. Promptness Score (average minutes difference)
        const takenLogs = logs.filter(l => l.status === 'taken' && l.taken_at);
        let totalDiff = 0;
        takenLogs.forEach(log => {
            if (log.taken_at) {
                const diff = (new Date(log.taken_at).getTime() - new Date(log.scheduled_at).getTime()) / 60000;
                totalDiff += diff;
            }
        });
        const avgPromptness = takenLogs.length > 0 ? Math.round(totalDiff / takenLogs.length) : 0;
        setPromptnessScore(avgPromptness);

        // 3. Late Doses Count
        setLateDoses(late);

        // 4. Daily Stats (for trend chart)
        const daily: DailyStats[] = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dayLogs = logs.filter(l => l.scheduled_at.startsWith(dateStr));
            const dayTaken = dayLogs.filter(l => l.status === 'taken').length;
            const dayMissed = dayLogs.filter(l => l.status === 'missed' || l.status === 'not taken').length;
            const dayLate = dayLogs.filter(l => l.status === 'taken' && isLate(l.scheduled_at, l.taken_at)).length;

            daily.push({
                date: dateStr,
                total: dayLogs.length,
                taken: dayTaken,
                missed: dayMissed,
                late: dayLate,
                adherenceRate: dayLogs.length > 0 ? Math.round((dayTaken / dayLogs.length) * 100) : 0
            });
        }
        setDailyStats(daily);

        // 5. Time-of-Day Stats
        const slots: TimeSlotStats['slot'][] = ['Morning', 'Afternoon', 'Evening', 'Night'];
        const timeStats = slots.map(slot => {
            const slotLogs = logs.filter(l => getTimeSlot(l.scheduled_at) === slot);
            const slotTaken = slotLogs.filter(l => l.status === 'taken').length;
            return {
                slot,
                total: slotLogs.length,
                taken: slotTaken,
                adherenceRate: slotLogs.length > 0 ? Math.round((slotTaken / slotLogs.length) * 100) : 0
            };
        });
        setTimeSlotStats(timeStats);

        // 6. Missed Doses Log
        const missedList = logs
            .filter(l => l.status === 'missed' || l.status === 'not taken')
            .map(l => ({
                medName: l.medication?.name || 'Unknown',
                scheduledAt: l.scheduled_at,
                daysSince: Math.floor((Date.now() - new Date(l.scheduled_at).getTime()) / (1000 * 60 * 60 * 24))
            }))
            .slice(0, 10); // Limit to 10 most recent
        setMissedDoses(missedList);
    };

    // ===== DOWNLOAD CSV =====
    const downloadReport = async () => {
        try {
            // Generate CSV content
            const headers = 'Medication,Date,Time,Scheduled Time,Status,Minutes Late/Early\n';
            const rows = logs.map(log => {
                const medName = log.medication?.name || 'Unknown';
                const scheduledDate = new Date(log.scheduled_at);
                const date = scheduledDate.toLocaleDateString();
                const scheduledTime = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const takenTime = log.taken_at
                    ? new Date(log.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'N/A';
                const status = log.status.charAt(0).toUpperCase() + log.status.slice(1);
                const diff = log.taken_at
                    ? Math.round((new Date(log.taken_at).getTime() - scheduledDate.getTime()) / 60000)
                    : 'N/A';

                return `"${medName}","${date}","${takenTime}","${scheduledTime}","${status}","${diff}"`;
            }).join('\n');

            const csvContent = headers + rows;

            // Save to file
            const fileName = `MedicationReport_${new Date().toISOString().split('T')[0]}.csv`;
            const filePath = documentDirectory + fileName;

            await writeAsStringAsync(filePath, csvContent, {
                encoding: EncodingType.UTF8
            });

            // Dynamically import expo-sharing to avoid native module crash in Expo Go
            try {
                const Sharing = await import('expo-sharing');
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(filePath, {
                        mimeType: 'text/csv',
                        dialogTitle: 'Download Medication Report'
                    });
                } else {
                    Alert.alert('Success', `Report saved to: ${fileName}`);
                }
            } catch (sharingError) {
                // expo-sharing not available (e.g., Expo Go)
                Alert.alert(
                    'Report Generated',
                    `Report saved to: ${fileName}\n\nNote: Sharing requires a development build. The file has been saved locally.`
                );
            }
        } catch (error) {
            console.error('Failed to generate report:', error);
            Alert.alert('Error', 'Failed to generate report. Please try again.');
        }
    };

    // ===== RENDER =====
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Adherence Report</Text>
                <TouchableOpacity onPress={downloadReport} disabled={loading}>
                    <Ionicons name="download-outline" size={24} color={loading ? '#94A3B8' : '#0F172A'} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>

                    {/* ===== EXECUTIVE SUMMARY ===== */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>30-Day Summary</Text>
                        <View style={styles.metricsRow}>
                            {/* Adherence Rate Card */}
                            <View style={[styles.metricCard, { borderLeftColor: getAdherenceColor(adherenceRate) }]}>
                                <Text style={styles.metricValue}>{adherenceRate}%</Text>
                                <Text style={styles.metricLabel}>Adherence</Text>
                                <Text style={[styles.metricBadge, { color: getAdherenceColor(adherenceRate) }]}>
                                    {getAdherenceLabel(adherenceRate)}
                                </Text>
                            </View>

                            {/* Promptness Card */}
                            <View style={[styles.metricCard, { borderLeftColor: promptnessScore <= 30 ? '#22C55E' : '#EAB308' }]}>
                                <Text style={styles.metricValue}>
                                    {promptnessScore > 0 ? '+' : ''}{promptnessScore}
                                </Text>
                                <Text style={styles.metricLabel}>Avg Minutes</Text>
                                <Text style={styles.metricBadge}>
                                    {promptnessScore <= 0 ? 'Early' : promptnessScore <= 30 ? 'On Time' : 'Late'}
                                </Text>
                            </View>

                            {/* Late Doses Card */}
                            <View style={[styles.metricCard, { borderLeftColor: lateDoses === 0 ? '#22C55E' : '#EF4444' }]}>
                                <Text style={styles.metricValue}>{lateDoses}</Text>
                                <Text style={styles.metricLabel}>Late Doses</Text>
                                <Text style={styles.metricBadge}>
                                    {lateDoses === 0 ? 'Perfect' : '>1hr Late'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* ===== 30-DAY TREND ===== */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Your Progress Over 14 Days</Text>
                        <View style={styles.trendContainer}>
                            {dailyStats.slice(-14).map((day, i) => (
                                <View key={day.date} style={styles.trendBar}>
                                    <View
                                        style={[
                                            styles.trendFill,
                                            {
                                                height: `${Math.max(day.adherenceRate, 5)}%`,
                                                backgroundColor: getAdherenceColor(day.adherenceRate)
                                            }
                                        ]}
                                    />
                                    <Text style={styles.trendLabel}>
                                        {new Date(day.date).getDate()}
                                    </Text>
                                </View>
                            ))}
                        </View>
                        <View style={styles.legendRow}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                                <Text style={styles.legendText}>≥80%</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#EAB308' }]} />
                                <Text style={styles.legendText}>60-79%</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                                <Text style={styles.legendText}>&lt;60%</Text>
                            </View>
                        </View>
                    </View>

                    {/* ===== TIME-OF-DAY MATRIX ===== */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>When Do You Miss Doses?</Text>
                        {timeSlotStats.map(slot => (
                            <View key={slot.slot} style={styles.timeSlotRow}>
                                <View style={styles.timeSlotInfo}>
                                    <Ionicons
                                        name={
                                            slot.slot === 'Morning' ? 'sunny' :
                                                slot.slot === 'Afternoon' ? 'partly-sunny' :
                                                    slot.slot === 'Evening' ? 'moon' : 'cloudy-night'
                                        }
                                        size={20}
                                        color="#64748B"
                                    />
                                    <Text style={styles.timeSlotName}>{slot.slot}</Text>
                                </View>
                                <View style={styles.progressBarContainer}>
                                    <View
                                        style={[
                                            styles.progressBar,
                                            {
                                                width: `${slot.adherenceRate}%`,
                                                backgroundColor: getAdherenceColor(slot.adherenceRate)
                                            }
                                        ]}
                                    />
                                </View>
                                <Text style={[styles.timeSlotRate, { color: getAdherenceColor(slot.adherenceRate) }]}>
                                    {slot.adherenceRate}%
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* ===== MISSED DOSE LOG ===== */}
                    {missedDoses.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Missed Doses</Text>
                            {missedDoses.map((dose, i) => (
                                <View key={i} style={styles.missedRow}>
                                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                                    <View style={styles.missedInfo}>
                                        <Text style={styles.missedMed}>{dose.medName}</Text>
                                        <Text style={styles.missedDate}>
                                            {new Date(dose.scheduledAt).toLocaleDateString()} • {dose.daysSince} days ago
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* ===== DETAILED ACTIVITY LOG ===== */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Detailed Activity Log</Text>
                        {logs.slice(0, 20).map((log, i) => (
                            <View key={log.id || i} style={styles.logRow}>
                                <View style={[styles.logIndicator, { backgroundColor: log.status === 'taken' ? '#22C55E' : log.status === 'skipped' ? '#EAB308' : '#EF4444' }]} />
                                <View style={styles.logContent}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={styles.logMedName}>{log.medication?.name || 'Unknown'}</Text>
                                        <Text style={[styles.logStatus, { color: log.status === 'taken' ? '#22C55E' : log.status === 'skipped' ? '#EAB308' : '#EF4444' }]}>
                                            {log.status.toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={styles.logTime}>
                                        Scheduled: {new Date(log.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                    {log.status === 'taken' && log.taken_at && (
                                        <Text style={styles.logTimeDone}>
                                            Taken at: {new Date(log.taken_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    )}
                                     {log.status === 'skipped' && log.taken_at && (
                                        <Text style={styles.logTimeDone}>
                                            Skipped at: {new Date(log.taken_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>

                </ScrollView>
            )}
        </View>
    );
}

// ===== STYLES =====
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },

    // Sections
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
        color: '#1E293B',
        marginBottom: 16,
    },

    // Metrics Row
    metricsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metricCard: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        borderLeftWidth: 4,
        alignItems: 'center',
    },
    metricValue: {
        fontFamily: 'Poppins-Bold',
        fontSize: 28,
        color: '#1E293B',
    },
    metricLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    metricBadge: {
        fontFamily: 'Poppins-Medium',
        fontSize: 10,
        marginTop: 4,
    },

    // Trend Chart
    trendContainer: {
        flexDirection: 'row',
        height: 120,
        alignItems: 'flex-end',
        gap: 4,
    },
    trendBar: {
        flex: 1,
        height: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    trendFill: {
        width: '100%',
        borderRadius: 4,
        minHeight: 4,
    },
    trendLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 4,
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginTop: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#64748B',
    },

    // Time Slot
    timeSlotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    timeSlotInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 100,
        gap: 8,
    },
    timeSlotName: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        color: '#334155',
    },
    progressBarContainer: {
        flex: 1,
        height: 8,
        backgroundColor: '#E2E8F0',
        borderRadius: 4,
        marginHorizontal: 12,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
    },
    timeSlotRate: {
        fontFamily: 'Poppins-Bold',
        fontSize: 14,
        width: 45,
        textAlign: 'right',
    },

    // Missed Doses
    missedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        gap: 12,
    },
    missedInfo: {
        flex: 1,
    },
    missedMed: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        color: '#1E293B',
    },
    missedDate: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#94A3B8',
    },

    // Detailed Log
    logRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        gap: 12,
    },
    logIndicator: {
        width: 4,
        borderRadius: 2,
        backgroundColor: '#CBD5E1',
    },
    logContent: {
        flex: 1,
    },
    logMedName: {
        fontFamily: 'Poppins-Bold',
        fontSize: 14,
        color: '#1E293B',
    },
    logStatus: {
        fontFamily: 'Poppins-Bold',
        fontSize: 12,
    },
    logTime: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#64748B',
        marginTop: 4,
    },
    logTimeDone: {
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
        color: '#475569',
        marginTop: 2,
    },
});
