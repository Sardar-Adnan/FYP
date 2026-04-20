/**
 * useFallDetection Hook
 * 
 * React hook for integrating fall detection into components.
 * Manages service lifecycle with component mount/unmount.
 */

import { FallDetectionService } from '@/services/FallDetectionService';
import { FallDetectionResult, FallDetectionState } from '@/utils/fallDetection';
import { useCallback, useEffect, useRef, useState } from 'react';

// === TYPES ===
export interface UseFallDetectionOptions {
  enabled?: boolean;
  onFallDetected?: () => void;
  onStateChange?: (state: FallDetectionState) => void;
  debugMode?: boolean; // Enables sample-by-sample callbacks
}

export interface UseFallDetectionReturn {
  // State
  isRunning: boolean;
  isAvailable: boolean;
  currentState: FallDetectionState;
  currentSVM: number;
  currentG: number;
  samplesProcessed: number;
  actualSampleRate: number;
  
  // Latest result (for debug UI)
  latestResult: FallDetectionResult | null;
  
  // Actions
  start: () => Promise<boolean>;
  stop: () => void;
  reset: () => void;
}

// === HOOK ===
export function useFallDetection(options: UseFallDetectionOptions = {}): UseFallDetectionReturn {
  const { enabled = false, onFallDetected, onStateChange, debugMode = false } = options;
  
  // State
  const [isRunning, setIsRunning] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [currentState, setCurrentState] = useState<FallDetectionState>(FallDetectionState.MONITORING);
  const [currentSVM, setCurrentSVM] = useState(0);
  const [samplesProcessed, setSamplesProcessed] = useState(0);
  const [actualSampleRate, setActualSampleRate] = useState(50);
  const [latestResult, setLatestResult] = useState<FallDetectionResult | null>(null);
  
  // Refs for callbacks (avoid stale closures)
  const onFallDetectedRef = useRef(onFallDetected);
  const onStateChangeRef = useRef(onStateChange);
  
  useEffect(() => {
    onFallDetectedRef.current = onFallDetected;
  }, [onFallDetected]);
  
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  // Sample update counter (throttle UI updates)
  const sampleCounterRef = useRef(0);

  // Start service
  const start = useCallback(async (): Promise<boolean> => {
    const available = await FallDetectionService.isAvailable();
    setIsAvailable(available);
    
    if (!available) {
      console.warn('[useFallDetection] Accelerometer not available');
      return false;
    }

    const success = await FallDetectionService.start({
      onFallDetected: () => {
        onFallDetectedRef.current?.();
      },
      onStateChange: (state) => {
        setCurrentState(state);
        onStateChangeRef.current?.(state);
      },
      onSample: (result) => {
        sampleCounterRef.current++;
        
        // Update UI every 10 samples (5 times per second) to reduce overhead
        if (debugMode || sampleCounterRef.current % 10 === 0) {
          setCurrentSVM(result.svm);
          setLatestResult(result);
          
          const status = FallDetectionService.getStatus();
          setSamplesProcessed(status.samplesProcessed);
          setActualSampleRate(status.actualSampleRate);
        }
      }
    });

    setIsRunning(success);
    return success;
  }, [debugMode]);

  // Stop service
  const stop = useCallback(() => {
    FallDetectionService.stop();
    setIsRunning(false);
    setCurrentState(FallDetectionState.MONITORING);
  }, []);

  // Reset detection (after false positive cancel)
  const reset = useCallback(() => {
    FallDetectionService.resetDetection();
    setCurrentState(FallDetectionState.MONITORING);
  }, []);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }

    return () => {
      stop();
    };
  }, [enabled, start, stop]);

  // Calculate current G
  const currentG = currentSVM / 9.81;

  return {
    isRunning,
    isAvailable,
    currentState,
    currentSVM,
    currentG,
    samplesProcessed,
    actualSampleRate,
    latestResult,
    start,
    stop,
    reset
  };
}
