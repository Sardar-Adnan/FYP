/**
 * Fall Detection Context
 * 
 * Provides global state for fall detection that persists across screens.
 * Uses BackgroundFallDetection for true background operation.
 * Uses AsyncStorage to remember the enabled state between app launches.
 */

import { FallAlertModal } from '@/components/FallAlertModal';
import { BackgroundFallDetection } from '@/services/BackgroundFallDetection';
import { dispatchEmergency, logFallCancelled } from '@/services/emergencyService';
import { FallDetectionState } from '@/utils/fallDetection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';

// === CONSTANTS ===
const STORAGE_KEY = 'fall_detection_enabled';

// === TYPES ===
interface FallDetectionContextType {
    enabled: boolean;
    isRunning: boolean;
    isAvailable: boolean;
    currentState: FallDetectionState;
    currentG: number;
    nearMissCount: number;
    setEnabled: (enabled: boolean) => Promise<void>;
    reset: () => void;
}

const FallDetectionContext = createContext<FallDetectionContextType | null>(null);

// === PROVIDER ===
export function FallDetectionProvider({ children }: { children: React.ReactNode }) {
    const [enabled, setEnabledState] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [isAvailable, setIsAvailable] = useState(true);
    const [currentState, setCurrentState] = useState<FallDetectionState>(FallDetectionState.MONITORING);
    const [currentG, setCurrentG] = useState(0);
    const [nearMissCount, setNearMissCount] = useState(0);
    const [showFallAlert, setShowFallAlert] = useState(false);

    const appState = useRef(AppState.currentState);
    const isInitialized = useRef(false);

    // === SERVICE MANAGEMENT ===
    const startService = useCallback(async () => {
        console.log('[FallDetectionContext] Starting background service...');

        const success = await BackgroundFallDetection.start({
            onFallDetected: () => {
                console.log('[FallDetectionContext] 🚨 Fall detected - showing alert');
                setShowFallAlert(true);
            },
            onStateChange: (state) => {
                setCurrentState(state);
            }
        });

        if (success) {
            setIsRunning(true);
            setIsAvailable(true);
            console.log('[FallDetectionContext] ✅ Background service started');
        } else {
            setIsRunning(false);
            setIsAvailable(false);
            console.log('[FallDetectionContext] ❌ Failed to start background service');
        }

        return success;
    }, []);

    const stopService = useCallback(async () => {
        console.log('[FallDetectionContext] Stopping background service...');
        await BackgroundFallDetection.stop();
        setIsRunning(false);
        setCurrentState(FallDetectionState.MONITORING);
        setCurrentG(0);
        console.log('[FallDetectionContext] ✅ Background service stopped');
    }, []);

    // === ENABLE/DISABLE ===
    const setEnabled = useCallback(async (value: boolean) => {
        setEnabledState(value);

        // Persist to storage
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        } catch (error) {
            console.error('[FallDetectionContext] Failed to save setting:', error);
        }

        // Start or stop service
        if (value) {
            await startService();
        } else {
            await stopService();
        }
    }, [startService, stopService]);

    // === RESET ===
    const reset = useCallback(() => {
        BackgroundFallDetection.reset();
        setCurrentState(FallDetectionState.MONITORING);
        setShowFallAlert(false);
    }, []);

    // === ALERT HANDLERS ===
    const handleAlertCancel = useCallback(() => {
        console.log('[FallDetectionContext] User OK - near miss logged');
        setNearMissCount(prev => prev + 1);
        setShowFallAlert(false);
        reset();

        // Log the cancellation to Supabase
        logFallCancelled();
    }, [reset]);

    const handleAlertTimeout = useCallback(async () => {
        console.log('[FallDetectionContext] ⏰ Timeout - dispatching emergency!');
        setShowFallAlert(false);

        // Dispatch emergency: GPS + caregiver lookup + n8n webhook
        const result = await dispatchEmergency('fall_timeout');

        if (result.success) {
            const caregiverMsg = result.caregiversFound > 1
                ? `${result.caregiversFound} caregivers have been`
                : 'Your caregiver has been';
            Alert.alert(
                '🚨 Help Is On The Way',
                `${caregiverMsg} notified.\n\n`
                + '• SMS with your location sent to all caregivers\n'
                + '• Automated call placed to your primary caregiver\n'
                + '• Your GPS location has been shared via Google Maps\n\n'
                + 'Stay calm and wait for help.',
                [{ text: 'OK', onPress: reset }]
            );
        } else {
            Alert.alert(
                '⚠️ Emergency Alert',
                'We tried to contact your caregiver but encountered an issue.\n\n'
                + (result.error || 'Please call emergency services manually.'),
                [{ text: 'OK', onPress: reset }]
            );
        }
    }, [reset]);

    // === APP STATE HANDLING ===
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            console.log(`[FallDetectionContext] App state: ${appState.current} → ${nextAppState}`);

            // Update current G when app comes back to foreground
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                BackgroundFallDetection.getStatus().then(status => {
                    if (status.isRunning) {
                        setIsRunning(true);
                        setCurrentState(status.currentState as FallDetectionState || FallDetectionState.MONITORING);
                    }
                });
            }

            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // === LOAD SAVED STATE ON MOUNT ===
    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

        const loadSavedState = async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const wasEnabled = JSON.parse(saved);
                    console.log(`[FallDetectionContext] Loading saved state: enabled=${wasEnabled}`);
                    if (wasEnabled) {
                        setEnabledState(true);
                        await startService();
                    }
                }
            } catch (error) {
                console.error('[FallDetectionContext] Failed to load saved state:', error);
            }
        };

        loadSavedState();
    }, [startService]);

    // === POLL STATUS WHEN RUNNING ===
    useEffect(() => {
        if (!isRunning) return;

        const interval = setInterval(async () => {
            const status = await BackgroundFallDetection.getStatus();
            if (status.currentState) {
                const newState = status.currentState as FallDetectionState;
                setCurrentState(newState);
                
                // 🛑 Fallback trigger: If the NativeEvent gets dropped or missed by the JS thread, 
                // but the background service confirmed a fall, forcefully trigger the modal.
                if (newState === FallDetectionState.FALL_CONFIRMED) {
                    setShowFallAlert(prev => {
                        if (!prev) {
                            console.log('[FallDetectionContext] 🚨 Fall detected via polling fallback!');
                            return true;
                        }
                        return prev;
                    });
                }
            }
            // Update g-force from service
            if (typeof status.currentG === 'number') {
                setCurrentG(status.currentG);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [isRunning]);

    return (
        <FallDetectionContext.Provider
            value={{
                enabled,
                isRunning,
                isAvailable,
                currentState,
                currentG,
                nearMissCount,
                setEnabled,
                reset
            }}
        >
            {children}

            {/* Global Fall Alert Modal */}
            <FallAlertModal
                visible={showFallAlert}
                onCancel={handleAlertCancel}
                onTimeout={handleAlertTimeout}
                userName="User"
            />
        </FallDetectionContext.Provider>
    );
}

// === HOOK ===
export function useFallDetectionContext() {
    const context = useContext(FallDetectionContext);
    if (!context) {
        throw new Error('useFallDetectionContext must be used within FallDetectionProvider');
    }
    return context;
}
