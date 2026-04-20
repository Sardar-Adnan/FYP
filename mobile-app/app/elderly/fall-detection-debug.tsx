/**
 * Fall Detection Debug Screen
 * 
 * Test screen for visualizing and debugging the fall detection algorithm.
 * Uses global FallDetectionContext for persistent state.
 */

import { Colors } from '@/constants/Colors';
import { useFallDetectionContext } from '@/context/FallDetectionContext';
import { FallDetectionService } from '@/services/FallDetectionService';
import { FallDetectionState, svmToG, THRESHOLDS } from '@/utils/fallDetection';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// State color mapping
const STATE_COLORS: Record<FallDetectionState, string> = {
    [FallDetectionState.MONITORING]: '#22C55E',
    [FallDetectionState.FREEFALL_DETECTED]: '#EAB308',
    [FallDetectionState.IMPACT_DETECTED]: '#F97316',
    [FallDetectionState.STILLNESS_CHECK]: '#F97316',
    [FallDetectionState.ORIENTATION_CHECK]: '#8B5CF6',
    [FallDetectionState.FALL_CONFIRMED]: '#EF4444'
};

const STATE_LABELS: Record<FallDetectionState, string> = {
    [FallDetectionState.MONITORING]: 'Monitoring',
    [FallDetectionState.FREEFALL_DETECTED]: 'Freefall!',
    [FallDetectionState.IMPACT_DETECTED]: 'Impact!',
    [FallDetectionState.STILLNESS_CHECK]: 'Stillness Check (5s)',
    [FallDetectionState.ORIENTATION_CHECK]: 'Checking Orientation...',
    [FallDetectionState.FALL_CONFIRMED]: '🚨 FALL DETECTED'
};

export default function FallDetectionDebugScreen() {
    const router = useRouter();
    const [eventLog, setEventLog] = useState<string[]>([]);

    // Use global context
    const {
        enabled,
        isRunning,
        isAvailable,
        currentState,
        currentG,
        nearMissCount,
        setEnabled,
        reset
    } = useFallDetectionContext();

    // Log state changes
    useEffect(() => {
        if (currentState !== FallDetectionState.MONITORING) {
            const timestamp = new Date().toLocaleTimeString();
            setEventLog(prev => [`[${timestamp}] State: ${currentState}`, ...prev.slice(0, 19)]);
        }
    }, [currentState]);

    // Get service stats
    const status = FallDetectionService.getStatus();

    // Visual gauge for SVM
    const svmBarWidth = Math.min((currentG / 4) * 100, 100);
    const svmColor = currentG > 3 ? '#EF4444' : currentG > 1.5 ? '#EAB308' : '#22C55E';

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Fall Detection</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Enable Toggle */}
                <View style={styles.card}>
                    <View style={styles.toggleRow}>
                        <View>
                            <Text style={styles.cardTitle}>Fall Detection</Text>
                            <Text style={styles.cardSubtitle}>
                                {isRunning ? '🟢 Active - Runs in background' : '⚪ Disabled'}
                            </Text>
                        </View>
                        <Switch
                            value={enabled}
                            onValueChange={setEnabled}
                            trackColor={{ false: '#E2E8F0', true: Colors.primary }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                </View>

                {/* Availability Warning */}
                {!isAvailable && enabled && (
                    <View style={[styles.card, styles.warningCard]}>
                        <Ionicons name="build" size={24} color="#EAB308" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.warningTitle}>Development Build Required</Text>
                            <Text style={styles.warningText}>
                                Accelerometer sensors require a development build.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Persistent Info */}
                {enabled && (
                    <View style={[styles.card, styles.infoCard]}>
                        <Ionicons name="shield-checkmark" size={24} color="#22C55E" />
                        <Text style={styles.infoText}>
                            Fall detection will continue running when you leave this screen or minimize the app.
                        </Text>
                    </View>
                )}

                {/* Current State */}
                <View style={[styles.card, { borderLeftColor: STATE_COLORS[currentState], borderLeftWidth: 4 }]}>
                    <Text style={styles.stateLabel}>Current State</Text>
                    <Text style={[styles.stateValue, { color: STATE_COLORS[currentState] }]}>
                        {STATE_LABELS[currentState]}
                    </Text>
                </View>

                {/* Live SVM Gauge */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Signal Vector Magnitude (SVM)</Text>
                    <View style={styles.svmDisplay}>
                        <Text style={[styles.svmValue, { color: svmColor }]}>
                            {currentG.toFixed(2)}g
                        </Text>
                        <Text style={styles.svmRaw}>
                            ({(currentG * 9.81).toFixed(1)} m/s²)
                        </Text>
                    </View>

                    {/* SVM Bar */}
                    <View style={styles.svmBarContainer}>
                        <View style={[styles.svmBar, { width: `${svmBarWidth}%`, backgroundColor: svmColor }]} />
                    </View>

                    {/* Threshold markers */}
                    <View style={styles.thresholdRow}>
                        <View style={styles.thresholdItem}>
                            <View style={[styles.thresholdDot, { backgroundColor: '#EAB308' }]} />
                            <Text style={styles.thresholdText}>Freefall &lt;{svmToG(THRESHOLDS.FREEFALL).toFixed(1)}g</Text>
                        </View>
                        <View style={styles.thresholdItem}>
                            <View style={[styles.thresholdDot, { backgroundColor: '#EF4444' }]} />
                            <Text style={styles.thresholdText}>Impact &gt;{svmToG(THRESHOLDS.IMPACT).toFixed(1)}g</Text>
                        </View>
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Stats</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{status.samplesProcessed}</Text>
                            <Text style={styles.statLabel}>Samples</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{status.actualSampleRate}Hz</Text>
                            <Text style={styles.statLabel}>Sample Rate</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{nearMissCount}</Text>
                            <Text style={styles.statLabel}>Near Misses</Text>
                        </View>
                    </View>
                </View>

                {/* Event Log */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Event Log</Text>
                    {eventLog.length === 0 ? (
                        <Text style={styles.emptyLog}>No events yet. Enable detection to start.</Text>
                    ) : (
                        eventLog.map((event, i) => (
                            <Text key={i} style={styles.logEntry}>{event}</Text>
                        ))
                    )}
                </View>

                {/* Reset Button */}
                {currentState === FallDetectionState.FALL_CONFIRMED && (
                    <TouchableOpacity style={styles.resetButton} onPress={reset}>
                        <Ionicons name="refresh" size={20} color="#FFFFFF" />
                        <Text style={styles.resetButtonText}>Reset Detection</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
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
        borderBottomColor: '#E2E8F0'
    },
    headerTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 18,
        color: '#0F172A'
    },
    content: {
        padding: 16,
        paddingBottom: 40
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    cardTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        color: '#1E293B',
        marginBottom: 4
    },
    cardSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#64748B'
    },
    warningCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        gap: 12
    },
    warningTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 14,
        color: '#92400E',
        marginBottom: 2
    },
    warningText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#92400E',
        flex: 1
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        gap: 12
    },
    infoText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#166534',
        flex: 1
    },
    stateLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4
    },
    stateValue: {
        fontFamily: 'Poppins-Bold',
        fontSize: 24
    },
    svmDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginVertical: 8
    },
    svmValue: {
        fontFamily: 'Poppins-Bold',
        fontSize: 48
    },
    svmRaw: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#94A3B8',
        marginLeft: 8
    },
    svmBarContainer: {
        height: 12,
        backgroundColor: '#E2E8F0',
        borderRadius: 6,
        overflow: 'hidden',
        marginVertical: 12
    },
    svmBar: {
        height: '100%',
        borderRadius: 6
    },
    thresholdRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 8
    },
    thresholdItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    thresholdDot: {
        width: 10,
        height: 10,
        borderRadius: 5
    },
    thresholdText: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#64748B'
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 12
    },
    statItem: {
        alignItems: 'center'
    },
    statValue: {
        fontFamily: 'Poppins-Bold',
        fontSize: 20,
        color: '#1E293B'
    },
    statLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#64748B'
    },
    emptyLog: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#94A3B8',
        fontStyle: 'italic',
        marginTop: 8
    },
    logEntry: {
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#475569',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    resetButton: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8
    },
    resetButtonText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        color: '#FFFFFF'
    }
});
