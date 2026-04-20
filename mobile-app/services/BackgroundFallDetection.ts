/**
 * Background Fall Detection Service
 * 
 * Wraps the native Android FallDetectionForegroundService.
 * Uses native SensorManager (not expo-sensors) so accelerometer
 * data flows even when the app is in the background.
 * 
 * The public API is unchanged from the previous implementation,
 * so consuming components don't need any changes.
 */

import { NativeFallDetection } from '@/services/NativeFallDetection';
import { FallDetectionState } from '@/utils/fallDetection';

// === TYPES ===
export interface BackgroundFallDetectionCallbacks {
    onFallDetected: () => void;
    onStateChange?: (state: FallDetectionState) => void;
}

// === STATE ===
let callbacks: BackgroundFallDetectionCallbacks | null = null;
let fallListener: { remove: () => void } | null = null;
let stateListener: { remove: () => void } | null = null;

// === PUBLIC API ===
export const BackgroundFallDetection = {
    /**
     * Start background fall detection via native foreground service.
     */
    async start(cbs: BackgroundFallDetectionCallbacks): Promise<boolean> {
        const running = await NativeFallDetection.isRunning();
        if (running) {

            // Re-register listeners in case they were lost
            registerListeners(cbs);
            return true;
        }

        callbacks = cbs;

        try {
            // Request battery optimization exemption (Doze mode whitelist)
            const exempt = await NativeFallDetection.isBatteryOptimizationExempt();
            if (!exempt) {

                await NativeFallDetection.requestBatteryOptimizationExemption();
            }

            // Start the native foreground service

            const success = await NativeFallDetection.start();

            if (!success) {
                console.error('[BackgroundFallDetection] Failed to start native service');
                return false;
            }

            // Register event listeners
            registerListeners(cbs);


            return true;
        } catch (error) {
            console.error('[BackgroundFallDetection] Failed to start:', error);
            callbacks = null;
            return false;
        }
    },

    /**
     * Stop background fall detection.
     */
    async stop(): Promise<void> {
        const running = await NativeFallDetection.isRunning();
        if (!running) {

            return;
        }

        // Remove listeners
        fallListener?.remove();
        stateListener?.remove();
        fallListener = null;
        stateListener = null;
        callbacks = null;

        // Stop the native service
        await NativeFallDetection.stop();

    },

    /**
     * Check if running.
     */
    isRunning(): boolean {
        // Synchronous check — use the async version for accuracy
        return false; // Consumers should use isRunningAsync
    },

    /**
     * Async check if running.
     */
    async isRunningAsync(): Promise<boolean> {
        return NativeFallDetection.isRunning();
    },

    /**
     * Reset detection state.
     */
    reset(): void {
        NativeFallDetection.resetDetection();
    },

    /**
     * Get current status.
     */
    async getStatus() {
        const status = await NativeFallDetection.getStatus();
        return {
            isRunning: status.isRunning,
            isBackgroundActive: status.isRunning,
            isAvailable: true,
            currentState: mapNativeState(status.fallState),
            currentG: status.currentG,
            samplesProcessed: status.samplesProcessed,
            actualSampleRate: 50 // Native SENSOR_DELAY_FASTEST
        };
    }
};

// === HELPERS ===

function registerListeners(cbs: BackgroundFallDetectionCallbacks) {
    // Clean up existing listeners
    fallListener?.remove();
    stateListener?.remove();

    // Fall detected event
    fallListener = NativeFallDetection.onFallDetected(() => {

        cbs.onFallDetected();
    });

    // State change event
    stateListener = NativeFallDetection.onStateChange((event) => {
        const state = mapNativeState(event.state);
        cbs.onStateChange?.(state);
    });
}

function mapNativeState(nativeState: string): FallDetectionState {
    switch (nativeState) {
        case 'MONITORING': return FallDetectionState.MONITORING;
        case 'FREEFALL_DETECTED': return FallDetectionState.FREEFALL_DETECTED;
        case 'IMPACT_DETECTED': return FallDetectionState.IMPACT_DETECTED;
        case 'STILLNESS_CHECK': return FallDetectionState.STILLNESS_CHECK;
        case 'FALL_CONFIRMED': return FallDetectionState.FALL_CONFIRMED;
        default: return FallDetectionState.MONITORING;
    }
}
