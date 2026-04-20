/**
 * Fall Detection Service
 * 
 * Manages accelerometer subscription and fall detection processing.
 * Runs at 50Hz (20ms intervals) for high-frequency sampling.
 * 
 * Note: This service requires a development build (not Expo Go)
 * because expo-sensors uses native modules.
 */

import {
    AccelerometerSample,
    FallDetectionResult,
    FallDetectionState,
    FallDetector,
    TIMING,
    calculateSVM,
    svmToG
} from '@/utils/fallDetection';
import { Accelerometer } from 'expo-sensors';

// Define AccelerometerMeasurement type
interface AccelerometerMeasurement {
  x: number;
  y: number;
  z: number;
}

// Subscription type
interface SensorSubscription {
  remove: () => void;
}

// === TYPES ===
export interface FallDetectionServiceConfig {
  onFallDetected?: () => void;
  onStateChange?: (state: FallDetectionState) => void;
  onSample?: (result: FallDetectionResult) => void;
  enabled?: boolean;
}

export interface FallDetectionServiceStatus {
  isRunning: boolean;
  isAvailable: boolean;
  currentState: FallDetectionState;
  samplesProcessed: number;
  actualSampleRate: number; // Actual Hz achieved
}

// === SERVICE CLASS ===
class FallDetectionServiceClass {
  private detector: FallDetector | null = null;
  private subscription: SensorSubscription | null = null;
  private isRunning: boolean = false;
  
  // Callbacks
  private onFallDetected?: () => void;
  private onStateChange?: (state: FallDetectionState) => void;
  private onSample?: (result: FallDetectionResult) => void;
  
  // Stats
  private samplesProcessed: number = 0;
  private lastSampleTime: number = 0;
  private sampleRateBuffer: number[] = [];

  /**
   * Check if accelerometer is available on this device
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await Accelerometer.isAvailableAsync();
      return result;
    } catch (error) {
      console.error('[FallDetection] Error checking availability:', error);
      return false;
    }
  }

  /**
   * Start the fall detection service
   */
  async start(config: FallDetectionServiceConfig = {}): Promise<boolean> {
    if (this.isRunning) {
      console.warn('[FallDetection] Service already running');
      return true;
    }

    // Check availability
    const available = await this.isAvailable();
    if (!available) {
      console.error('[FallDetection] Accelerometer not available on this device');
      return false;
    }

    // Store callbacks
    this.onFallDetected = config.onFallDetected;
    this.onStateChange = config.onStateChange;
    this.onSample = config.onSample;

    // Create detector with callback
    this.detector = new FallDetector(() => {

      this.onFallDetected?.();
    });

    // Set update interval (request 20ms = 50Hz)
    Accelerometer.setUpdateInterval(TIMING.SAMPLE_INTERVAL_MS);

    // Subscribe to accelerometer
    this.subscription = Accelerometer.addListener(this.handleAccelerometerData);
    
    this.isRunning = true;
    this.samplesProcessed = 0;
    this.lastSampleTime = Date.now();
    this.sampleRateBuffer = [];


    return true;
  }

  /**
   * Stop the fall detection service
   */
  stop(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    if (this.detector) {
      this.detector.reset();
      this.detector = null;
    }

    this.isRunning = false;

  }

  /**
   * Reset detection state (e.g., after user cancels alert)
   */
  resetDetection(): void {
    if (this.detector) {
      this.detector.reset();
      this.onStateChange?.(FallDetectionState.MONITORING);
    }
  }

  /**
   * Handle incoming accelerometer data
   */
  private handleAccelerometerData = (data: AccelerometerMeasurement): void => {
    if (!this.detector) return;

    const now = Date.now();
    
    // Track sample rate
    if (this.lastSampleTime > 0) {
      const delta = now - this.lastSampleTime;
      this.sampleRateBuffer.push(delta);
      if (this.sampleRateBuffer.length > 50) {
        this.sampleRateBuffer.shift();
      }
    }
    this.lastSampleTime = now;

    // expo-sensors returns values in g-force, convert to m/s²
    const sample: AccelerometerSample = {
      x: data.x * 9.81,
      y: data.y * 9.81,
      z: data.z * 9.81,
      timestamp: now
    };

    // Process sample
    const previousState = this.detector.getState();
    const result = this.detector.processSample(sample);
    
    this.samplesProcessed++;

    // Notify state change
    if (result.state !== previousState) {

      this.onStateChange?.(result.state);
    }

    // Notify sample (for debug UI)
    this.onSample?.(result);
  };

  /**
   * Get current service status
   */
  getStatus(): FallDetectionServiceStatus {
    const avgDelta = this.sampleRateBuffer.length > 0 
      ? this.sampleRateBuffer.reduce((a, b) => a + b, 0) / this.sampleRateBuffer.length
      : TIMING.SAMPLE_INTERVAL_MS;
    
    return {
      isRunning: this.isRunning,
      isAvailable: true,
      currentState: this.detector?.getState() ?? FallDetectionState.MONITORING,
      samplesProcessed: this.samplesProcessed,
      actualSampleRate: Math.round(1000 / avgDelta)
    };
  }

  /**
   * Get current SVM for UI display
   */
  getCurrentSVM(): number {
    if (!this.detector) return 0;
    const latest = this.detector.getBuffer().getLatest();
    if (!latest) return 0;
    return calculateSVM(latest.x, latest.y, latest.z);
  }

  /**
   * Get current SVM in g-force
   */
  getCurrentG(): number {
    return svmToG(this.getCurrentSVM());
  }
}

// Export singleton instance
export const FallDetectionService = new FallDetectionServiceClass();
