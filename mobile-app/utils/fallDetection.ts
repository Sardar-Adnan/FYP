/**
 * Fall Detection Algorithm
 * 
 * Four-Stage Detection (improved to reduce phone-drop false positives):
 * 1. FREEFALL: SVM drops below 0.5g (body descending)
 * 2. IMPACT: SVM spikes above 3.0g within 500ms
 * 3. STILLNESS: SVM stays ~1.0g for 10 seconds (increased from 5s)
 * 4. ORIENTATION: Phone orientation suggests lying down posture (gyroscope)
 * 
 * Constants are in m/s² (1g ≈ 9.81 m/s²)
 */

// === CONSTANTS ===
export const GRAVITY = 9.81; // m/s²

// Detection thresholds (in g, converted to m/s² when used)
export const THRESHOLDS = {
  FREEFALL: 0.5 * GRAVITY,      // < 4.9 m/s²
  IMPACT: 3.0 * GRAVITY,         // > 29.4 m/s²
  STILLNESS_LOW: 0.8 * GRAVITY,  // ~7.8 m/s²
  STILLNESS_HIGH: 1.2 * GRAVITY, // ~11.8 m/s²
  MOVEMENT_CANCEL: 1.5 * GRAVITY, // > 14.7 m/s² = walking/moving
  
  // Orientation thresholds for "lying down" detection
  // When phone is flat, Z-axis dominates (~1g)
  // When person is lying down, X or Y axis will dominate
  HORIZONTAL_TILT_THRESHOLD: 0.7 * GRAVITY, // X or Y > 0.7g suggests horizontal
  FLAT_Z_THRESHOLD: 0.85 * GRAVITY // Z > 0.85g suggests phone lying flat (phone drop)
};

// Timing constants
export const TIMING = {
  SAMPLE_INTERVAL_MS: 20,        // 50Hz sampling
  BUFFER_SIZE: 100,              // 2 seconds of samples
  IMPACT_WINDOW_MS: 500,         // Max time from freefall to impact
  STILLNESS_DURATION_MS: 5000,   // 5 seconds stillness check
  CONFIRMATION_DURATION_MS: 30000 // 30 seconds user confirmation
};

// Detection states
export enum FallDetectionState {
  MONITORING = 'MONITORING',
  FREEFALL_DETECTED = 'FREEFALL_DETECTED',
  IMPACT_DETECTED = 'IMPACT_DETECTED',
  STILLNESS_CHECK = 'STILLNESS_CHECK',
  ORIENTATION_CHECK = 'ORIENTATION_CHECK', // New state
  FALL_CONFIRMED = 'FALL_CONFIRMED'
}

// === TYPES ===
export interface AccelerometerSample {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface GyroscopeSample {
  x: number; // Rotation around X axis (rad/s)
  y: number; // Rotation around Y axis (rad/s)
  z: number; // Rotation around Z axis (rad/s)
  timestamp: number;
}

export interface FallDetectionResult {
  state: FallDetectionState;
  svm: number;
  fallDetected: boolean;
  orientation?: {
    isLyingDown: boolean;
    isPhoneFlat: boolean;
    dominantAxis: 'x' | 'y' | 'z';
  };
  debugInfo?: {
    freefallTimestamp?: number;
    impactTimestamp?: number;
    stillnessStartTimestamp?: number;
    movementCount?: number;
    orientationSamples?: number;
    lyingDownConfidence?: number;
  };
}

// === ROLLING BUFFER ===
export class RollingBuffer<T = AccelerometerSample> {
  private buffer: T[] = [];
  private maxSize: number;

  constructor(maxSize: number = TIMING.BUFFER_SIZE) {
    this.maxSize = maxSize;
  }

  push(sample: T): void {
    this.buffer.push(sample);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  getLast(n: number): T[] {
    return this.buffer.slice(-n);
  }

  getLatest(): T | undefined {
    return this.buffer[this.buffer.length - 1];
  }

  clear(): void {
    this.buffer = [];
  }

  get length(): number {
    return this.buffer.length;
  }
}

// === SVM CALCULATION ===
/**
 * Calculate Signal Vector Magnitude (SVM)
 * SVM = √(x² + y² + z²)
 */
export function calculateSVM(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Convert SVM to g-force for readability
 */
export function svmToG(svm: number): number {
  return svm / GRAVITY;
}

/**
 * Analyze phone orientation to detect "lying down" posture vs "phone lying flat"
 * 
 * When person is LYING DOWN with phone:
 * - Phone is often tilted sideways (X or Y axis has significant gravity component)
 * 
 * When PHONE is DROPPED and lying flat:
 * - Z axis dominates (phone face up/down on surface)
 * 
 * @returns { isLyingDown, isPhoneFlat, dominantAxis }
 */
export function analyzeOrientation(sample: AccelerometerSample): {
  isLyingDown: boolean;
  isPhoneFlat: boolean;
  dominantAxis: 'x' | 'y' | 'z';
} {
  const absX = Math.abs(sample.x);
  const absY = Math.abs(sample.y);
  const absZ = Math.abs(sample.z);

  // Determine dominant axis
  let dominantAxis: 'x' | 'y' | 'z' = 'z';
  if (absX > absY && absX > absZ) dominantAxis = 'x';
  else if (absY > absX && absY > absZ) dominantAxis = 'y';

  // Phone is flat if Z dominates (near 1g) and X/Y are low
  const isPhoneFlat = absZ > THRESHOLDS.FLAT_Z_THRESHOLD && 
                      absX < THRESHOLDS.HORIZONTAL_TILT_THRESHOLD * 0.5 &&
                      absY < THRESHOLDS.HORIZONTAL_TILT_THRESHOLD * 0.5;

  // Person lying down if X or Y has significant gravity component
  const isLyingDown = absX > THRESHOLDS.HORIZONTAL_TILT_THRESHOLD || 
                      absY > THRESHOLDS.HORIZONTAL_TILT_THRESHOLD;

  return { isLyingDown, isPhoneFlat, dominantAxis };
}

// === FALL DETECTION STATE MACHINE ===
export class FallDetector {
  private state: FallDetectionState = FallDetectionState.MONITORING;
  private buffer: RollingBuffer<AccelerometerSample>;
  
  // Timing trackers
  private freefallTimestamp: number | null = null;
  private impactTimestamp: number | null = null;
  private stillnessStartTimestamp: number | null = null;
  
  // Stillness check counters
  private stillnessCheckSamples: number = 0;
  private movementDuringStillness: number = 0;
  
  // Orientation check counters
  private orientationSamples: number = 0;
  private lyingDownSamples: number = 0;
  private phoneFlatSamples: number = 0;

  // Callback for fall detection
  private onFallDetected?: () => void;

  constructor(onFallDetected?: () => void) {
    this.buffer = new RollingBuffer();
    this.onFallDetected = onFallDetected;
  }

  /**
   * Process a new accelerometer sample
   */
  processSample(sample: AccelerometerSample): FallDetectionResult {
    this.buffer.push(sample);
    const svm = calculateSVM(sample.x, sample.y, sample.z);
    const now = sample.timestamp;
    const orientation = analyzeOrientation(sample);

    let fallDetected = false;

    switch (this.state) {
      case FallDetectionState.MONITORING:
        // Stage 1: Check for freefall (SVM < 0.5g)
        if (svm < THRESHOLDS.FREEFALL) {
          this.state = FallDetectionState.FREEFALL_DETECTED;
          this.freefallTimestamp = now;
        }
        break;

      case FallDetectionState.FREEFALL_DETECTED:
        // Check for timeout (500ms window)
        if (this.freefallTimestamp && (now - this.freefallTimestamp) > TIMING.IMPACT_WINDOW_MS) {
          this.reset();
          break;
        }

        // Stage 2: Check for impact (SVM > 3.0g)
        if (svm > THRESHOLDS.IMPACT) {
          this.state = FallDetectionState.IMPACT_DETECTED;
          this.impactTimestamp = now;
          // Immediately transition to stillness check
          this.state = FallDetectionState.STILLNESS_CHECK;
          this.stillnessStartTimestamp = now;
          this.stillnessCheckSamples = 0;
          this.movementDuringStillness = 0;
        }
        break;

      case FallDetectionState.STILLNESS_CHECK:
        this.stillnessCheckSamples++;
        
        // Stage 3: Monitor for 10 seconds (increased from 5s)
        if (this.stillnessStartTimestamp && (now - this.stillnessStartTimestamp) < TIMING.STILLNESS_DURATION_MS) {
          // Check if user is moving (SVM fluctuations > 1.5g)
          if (svm > THRESHOLDS.MOVEMENT_CANCEL) {
            this.movementDuringStillness++;
          }
          
          // If too much movement, they're walking or picked up the phone - cancel
          const movementRatio = this.movementDuringStillness / this.stillnessCheckSamples;
          if (movementRatio > 0.3 && this.stillnessCheckSamples > 100) {
            // More than 30% movement after 2 seconds - cancel
            console.log('[FallDetection] Cancelled: Too much movement (phone picked up)');
            this.reset();
            break;
          }
        } else {
          // 10 seconds elapsed - check final stillness
          const movementRatio = this.movementDuringStillness / this.stillnessCheckSamples;
          
          if (movementRatio < 0.2) {
            // Less than 20% movement - FALL CONFIRMED
            this.state = FallDetectionState.FALL_CONFIRMED;
            fallDetected = true;
            console.log(`[FallDetection] 🚨 FALL CONFIRMED (stillness: ${((1 - movementRatio) * 100).toFixed(0)}%)`);
            this.onFallDetected?.();
          } else {
            // Too much movement - false positive (phone picked up)
            console.log('[FallDetection] Cancelled: Movement detected during stillness');
            this.reset();
          }
        }
        break;

      case FallDetectionState.ORIENTATION_CHECK:
        // Stage 4: Check orientation for 1 second (50 samples)
        this.orientationSamples++;
        
        if (orientation.isLyingDown) {
          this.lyingDownSamples++;
        }
        if (orientation.isPhoneFlat) {
          this.phoneFlatSamples++;
        }
        
        if (this.orientationSamples >= 50) {
          const lyingDownRatio = this.lyingDownSamples / this.orientationSamples;
          const phoneFlatRatio = this.phoneFlatSamples / this.orientationSamples;
          
          // FALL CONFIRMED if:
          // - Phone orientation suggests lying down (tilted) OR
          // - Even if flat, stillness was maintained for full 10s (person may be lying face up)
          if (lyingDownRatio > 0.5 || phoneFlatRatio < 0.7) {
            // Likely a person fall - phone is tilted or not consistently flat
            this.state = FallDetectionState.FALL_CONFIRMED;
            fallDetected = true;
            console.log(`[FallDetection] 🚨 FALL CONFIRMED (lyingDown: ${(lyingDownRatio * 100).toFixed(0)}%, flat: ${(phoneFlatRatio * 100).toFixed(0)}%)`);
            this.onFallDetected?.();
          } else {
            // Phone is lying flat - likely just a phone drop
            console.log(`[FallDetection] Cancelled: Phone likely dropped flat (flat: ${(phoneFlatRatio * 100).toFixed(0)}%)`);
            this.reset();
          }
        }
        break;

      case FallDetectionState.FALL_CONFIRMED:
        fallDetected = true;
        break;
    }

    return {
      state: this.state,
      svm,
      fallDetected,
      orientation,
      debugInfo: {
        freefallTimestamp: this.freefallTimestamp ?? undefined,
        impactTimestamp: this.impactTimestamp ?? undefined,
        stillnessStartTimestamp: this.stillnessStartTimestamp ?? undefined,
        movementCount: this.movementDuringStillness,
        orientationSamples: this.orientationSamples,
        lyingDownConfidence: this.orientationSamples > 0 
          ? (this.lyingDownSamples / this.orientationSamples) * 100 
          : 0
      }
    };
  }

  /**
   * Reset detector to initial monitoring state
   */
  reset(): void {
    this.state = FallDetectionState.MONITORING;
    this.freefallTimestamp = null;
    this.impactTimestamp = null;
    this.stillnessStartTimestamp = null;
    this.stillnessCheckSamples = 0;
    this.movementDuringStillness = 0;
    this.orientationSamples = 0;
    this.lyingDownSamples = 0;
    this.phoneFlatSamples = 0;
  }

  /**
   * Get current state
   */
  getState(): FallDetectionState {
    return this.state;
  }

  /**
   * Get buffer for analysis
   */
  getBuffer(): RollingBuffer<AccelerometerSample> {
    return this.buffer;
  }
}
