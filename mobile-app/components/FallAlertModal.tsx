/**
 * Fall Alert Modal
 * 
 * Full-screen emergency modal with 30-second countdown.
 * Features:
 * - Circular countdown animation
 * - Audio siren (looping alarm)
 * - Haptic vibration pulses
 * - "I'm OK" cancel button
 * - Emergency contact info display
 */

import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View
} from 'react-native';

// === CONSTANTS ===
const COUNTDOWN_DURATION_S = 30;       // 30 seconds countdown
const HAPTIC_INTERVAL_MS = 2000;       // Vibrate every 2 seconds
const ALARM_LOOP = true;               // Loop alarm sound

export interface FallAlertModalProps {
    visible: boolean;
    onCancel: () => void;              // User taps "I'm OK"
    onTimeout: () => void;             // Countdown expires
    userName?: string;
    emergencyContact?: string;
}

export function FallAlertModal({
    visible,
    onCancel,
    onTimeout,
    userName = 'User',
    emergencyContact
}: FallAlertModalProps) {
    const [countdown, setCountdown] = useState(COUNTDOWN_DURATION_S);
    const [isPulsing, setIsPulsing] = useState(false);

    // Audio reference
    const soundRef = useRef<Audio.Sound | null>(null);
    const hapticIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Animation values
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    // === AUDIO MANAGEMENT ===
    const startSiren = useCallback(async () => {
        try {
            // Configure audio mode for alarm
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: false,
            });

            // Load emergency alarm sound
            const { sound } = await Audio.Sound.createAsync(
                require('@/assets/sounds/emergency-alarm-with-reverb-29431.wav'),
                { isLooping: ALARM_LOOP, volume: 1.0 }
            );

            soundRef.current = sound;
            await sound.playAsync();
            console.log('[FallAlert] 🔊 Siren started');
        } catch (error) {
            console.error('[FallAlert] Failed to play siren:', error);
            // Fallback to device vibration pattern
            Vibration.vibrate([500, 500, 500, 500], true);
        }
    }, []);

    const stopSiren = useCallback(async () => {
        const sound = soundRef.current;
        soundRef.current = null;

        if (sound) {
            try { await sound.stopAsync(); } catch (_) { /* already stopped or not loaded */ }
            try { await sound.unloadAsync(); } catch (_) { /* already unloaded */ }
        }

        Vibration.cancel();
        console.log('[FallAlert] 🔇 Siren stopped');
    }, []);

    // === HAPTIC MANAGEMENT ===
    const startHaptics = useCallback(() => {
        // Initial heavy haptic
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        // Periodic haptic pulses
        hapticIntervalRef.current = setInterval(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }, HAPTIC_INTERVAL_MS) as unknown as NodeJS.Timeout;

        console.log('[FallAlert] 📳 Haptics started');
    }, []);

    const stopHaptics = useCallback(() => {
        if (hapticIntervalRef.current) {
            clearInterval(hapticIntervalRef.current);
            hapticIntervalRef.current = null;
        }
        console.log('[FallAlert] Haptics stopped');
    }, []);

    // === ANIMATIONS ===
    const startPulseAnimation = useCallback(() => {
        setIsPulsing(true);
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    const startProgressAnimation = useCallback(() => {
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: COUNTDOWN_DURATION_S * 1000,
            useNativeDriver: false,
        }).start();
    }, [progressAnim]);

    // === COUNTDOWN TIMER ===
    useEffect(() => {
        if (!visible) {
            setCountdown(COUNTDOWN_DURATION_S);
            return;
        }

        // Start all effects when modal becomes visible
        startSiren();
        startHaptics();
        startPulseAnimation();
        startProgressAnimation();
        setCountdown(COUNTDOWN_DURATION_S);

        // Countdown interval
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearInterval(interval);
            stopSiren();
            stopHaptics();
        };
    }, [visible, startSiren, stopSiren, startHaptics, stopHaptics, startPulseAnimation, startProgressAnimation]);

    // === TIMEOUT HANDLER ===
    useEffect(() => {
        if (visible && countdown === 0) {
            console.log('[FallAlert] ⏰ Countdown expired - dispatching emergency!');
            stopSiren();
            stopHaptics();
            onTimeout();
        }
    }, [visible, countdown, onTimeout, stopSiren, stopHaptics]);

    // === CANCEL HANDLER ===
    const handleCancel = useCallback(() => {
        console.log('[FallAlert] ✅ User cancelled - logging near miss');
        stopSiren();
        stopHaptics();
        onCancel();
    }, [onCancel, stopSiren, stopHaptics]);

    // Calculate progress for circular indicator
    const progress = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            statusBarTranslucent
        >
            <View style={styles.container}>
                {/* Emergency Header */}
                <View style={styles.header}>
                    <Text style={styles.emergencyTitle}>🚨 FALL DETECTED</Text>
                    <Text style={styles.subTitle}>
                        Are you okay, {userName}?
                    </Text>
                </View>

                {/* Countdown Circle */}
                <Animated.View
                    style={[
                        styles.countdownContainer,
                        { transform: [{ scale: pulseAnim }] }
                    ]}
                >
                    <View style={styles.countdownCircle}>
                        <Text style={styles.countdownNumber}>{countdown}</Text>
                        <Text style={styles.countdownLabel}>seconds</Text>
                    </View>

                    {/* Progress ring would go here - simplified for now */}
                    <View style={styles.progressRing}>
                        <View style={[
                            styles.progressFill,
                            { width: `${(countdown / COUNTDOWN_DURATION_S) * 100}%` }
                        ]} />
                    </View>
                </Animated.View>

                {/* Warning Message */}
                <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                        Emergency services will be contacted{'\n'}
                        when the timer reaches zero
                    </Text>
                    {emergencyContact && (
                        <Text style={styles.contactText}>
                            Calling: {emergencyContact}
                        </Text>
                    )}
                </View>

                {/* Cancel Button */}
                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancel}
                    activeOpacity={0.8}
                >
                    <Text style={styles.cancelButtonText}>I'M OK</Text>
                    <Text style={styles.cancelSubtext}>Tap to cancel alert</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#DC2626', // Red emergency background
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
    },
    emergencyTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 32,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    subTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 20,
        color: '#FEE2E2',
        marginTop: 8,
        textAlign: 'center',
    },
    countdownContainer: {
        alignItems: 'center',
    },
    countdownCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 6,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    countdownNumber: {
        fontFamily: 'Poppins-Bold',
        fontSize: 80,
        color: '#FFFFFF',
        lineHeight: 90,
    },
    countdownLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 16,
        color: '#FEE2E2',
        marginTop: -8,
    },
    progressRing: {
        width: 220,
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 4,
        marginTop: 20,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
    },
    warningBox: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
    },
    warningText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 16,
        color: '#FFFFFF',
        textAlign: 'center',
        lineHeight: 24,
    },
    contactText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 14,
        color: '#FEE2E2',
        marginTop: 12,
    },
    cancelButton: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    cancelButtonText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 28,
        color: '#16A34A', // Green for safety
    },
    cancelSubtext: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#64748B',
        marginTop: 4,
    },
});
