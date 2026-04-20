/**
 * Native Fall Detection Service Bridge
 * 
 * TypeScript wrapper around the NativeFallDetectionModule native module.
 * Provides type-safe access to the native Android foreground service for
 * fall detection and medication reminders.
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const { NativeFallDetectionModule } = NativeModules;

// Create event emitter only on Android (native module is Android-only)
const eventEmitter = Platform.OS === 'android' && NativeFallDetectionModule
    ? new NativeEventEmitter(NativeFallDetectionModule)
    : null;

export interface NativeServiceStatus {
    isRunning: boolean;
    fallState: string;
    currentG: number;
    samplesProcessed: number;
}

export interface MedicationDueEvent {
    key: string;
    body: string;
    timeMs: number;
}

export interface FallStateChangeEvent {
    state: string;
    svmG: number;
    samplesProcessed: number;
}

export const NativeFallDetection = {
    /**
     * Start the native foreground service (accelerometer + medication checker).
     */
    start: async (): Promise<boolean> => {
        if (Platform.OS !== 'android' || !NativeFallDetectionModule) {
            console.warn('[NativeFallDetection] Only available on Android');
            return false;
        }
        return NativeFallDetectionModule.startService();
    },

    /**
     * Stop the native foreground service.
     */
    stop: async (): Promise<boolean> => {
        if (Platform.OS !== 'android' || !NativeFallDetectionModule) return false;
        return NativeFallDetectionModule.stopService();
    },

    /**
     * Check if the native service is running.
     */
    isRunning: async (): Promise<boolean> => {
        if (Platform.OS !== 'android' || !NativeFallDetectionModule) return false;
        return NativeFallDetectionModule.isRunning();
    },

    /**
     * Get current service status.
     */
    getStatus: async (): Promise<NativeServiceStatus> => {
        if (Platform.OS !== 'android' || !NativeFallDetectionModule) {
            return { isRunning: false, fallState: 'MONITORING', currentG: 0, samplesProcessed: 0 };
        }
        return NativeFallDetectionModule.getStatus();
    },

    /**
     * Reset fall detection state (e.g., after user dismisses alert).
     */
    resetDetection: (): void => {
        if (Platform.OS !== 'android' || !NativeFallDetectionModule) return;
        NativeFallDetectionModule.resetDetection();
    },

    /**
     * Sync medication events to the native service via SharedPreferences.
     * Call this after resyncNotifications() to update the native service.
     */
    setMedicationEvents: (eventsJson: string): void => {
        if (Platform.OS !== 'android' || !NativeFallDetectionModule) return;
        NativeFallDetectionModule.setMedicationEvents(eventsJson);
    },

    /**
     * Request battery optimization exemption (Doze mode whitelist).
     * Returns true if already exempt, false if dialog was shown.
     */
    requestBatteryOptimizationExemption: async (): Promise<boolean> => {
        if (Platform.OS !== 'android' || !NativeFallDetectionModule) return true;
        return NativeFallDetectionModule.requestBatteryOptimizationExemption();
    },

    /**
     * Check if app is exempt from battery optimization.
     */
    isBatteryOptimizationExempt: async (): Promise<boolean> => {
        if (Platform.OS !== 'android' || !NativeFallDetectionModule) return true;
        return NativeFallDetectionModule.isBatteryOptimizationExempt();
    },

    // ── Event Listeners ──

    /**
     * Listen for native fall detection events.
     */
    onFallDetected: (callback: () => void) => {
        if (!eventEmitter) return { remove: () => {} };
        return eventEmitter.addListener('onNativeFallDetected', callback);
    },

    /**
     * Listen for fall detection state changes.
     */
    onStateChange: (callback: (event: FallStateChangeEvent) => void) => {
        if (!eventEmitter) return { remove: () => {} };
        return eventEmitter.addListener('onFallDetectionStateChange', callback);
    },

    /**
     * Listen for medication due events from the native service.
     */
    onMedicationDue: (callback: (event: MedicationDueEvent) => void) => {
        if (!eventEmitter) return { remove: () => {} };
        return eventEmitter.addListener('onMedicationDue', callback);
    },
};
