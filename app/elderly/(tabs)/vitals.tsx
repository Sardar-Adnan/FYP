import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Modal, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit'; // Re-added import

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase'; // Ensure supabase is imported

const { width, height } = Dimensions.get('window');

export default function VitalsScreen() {
  const router = useRouter();

  // State
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [step, setStep] = useState<'intro' | 'camera' | 'result'>('intro');
  const [timeLeft, setTimeLeft] = useState(60);
  const [result, setResult] = useState<{ hr: number, sys: number, dia: number } | null>(null);

  // History / Graph State
  const [historyData, setHistoryData] = useState<any>(null);
  const [selectedReading, setSelectedReading] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const date = new Date();
      date.setDate(date.getDate() - 7);
      const sevenDaysAgo = date.toISOString();

      // Fetch readings from the last 7 days
      const { data } = await supabase
        .from('vitals')
        .select('*')
        .eq('user_id', user.id)
        .gte('recorded_at', sevenDaysAgo)
        .order('recorded_at', { ascending: true }); // Get them in order directly

      if (data && data.length > 0) {
        const labels = data.map(d => {
          const date = new Date(d.recorded_at);
          return `${date.getDate()}/${date.getMonth() + 1}`;
        });
        const dataPoints = data.map(d => d.heart_rate);

        setHistoryData({
          labels,
          datasets: [{ data: dataPoints }],
          fullData: data
        });
      }
    } catch (e) {
      console.log('Error fetching history:', e);
    }
  }

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isRecording, setIsRecording] = useState(false);
  const timerRef = useRef<any>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startMeasurementFlow = () => {
    setIsMeasuring(true);
    setStep('intro');
    setResult(null);
  };

  const cancelMeasurement = () => {
    stopRecordingLogic();
    setIsMeasuring(false);
    setStep('intro');
  };

  const proceedToCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to measure vitals.');
        return;
      }
    }
    setStep('camera');
    setTimeout(() => {
      startRecording();
    }, 1000);
  };

  const startRecording = async () => {
    if (cameraRef.current && !isRecording) {
      setIsRecording(true);
      setTimeLeft(60);

      // Start Timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecordingLogic();
            finishMeasurement();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      try {
        // We just record to keep the camera active and flashlight on
        await cameraRef.current.recordAsync({ maxDuration: 60 });
      } catch (e) {
        console.log('Recording error (expected if stopped manually):', e);
      }
    }
  };

  const stopRecordingLogic = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (isRecording && cameraRef.current) {
      cameraRef.current.stopRecording();
    }
    setIsRecording(false);
  };

  const finishMeasurement = () => {
    // Generate Mock Data
    const mockHR = Math.floor(Math.random() * (100 - 60) + 60);
    const mockSys = Math.floor(Math.random() * (130 - 110) + 110);
    const mockDia = Math.floor(Math.random() * (85 - 70) + 70);

    setResult({ hr: mockHR, sys: mockSys, dia: mockDia });
    setStep('result');
  };

  const closeResult = () => {
    setIsMeasuring(false);
    setStep('intro');
    setResult(null);
  };

  // --- Render Steps ---

  const renderIntro = () => (
    <View style={styles.overlayContainer}>
      <View style={styles.modalContent}>
        <Ionicons name="information-circle" size={48} color={Colors.primary} style={{ alignSelf: 'center', marginBottom: 16 }} />
        <Text style={styles.modalTitle}>Instructions</Text>
        <Text style={styles.modalText}>For maximum efficiency:</Text>

        <View style={styles.instructionRow}>
          <Ionicons name="sunny" size={20} color="#FDB813" />
          <Text style={styles.instructionText}>Record in direct sunlight</Text>
        </View>
        <View style={styles.instructionRow}>
          <Ionicons name="hand-left" size={20} color={Colors.primary} />
          <Text style={styles.instructionText}>Keep your finger steady</Text>
        </View>

        <Button title="Proceed" onPress={proceedToCamera} size="large" style={{ marginTop: 24 }} />
        <Button title="Cancel" onPress={cancelMeasurement} variant="outline" style={{ marginTop: 12 }} />
      </View>
    </View>
  );

  const renderCamera = () => (
    <View style={styles.fullScreen}>
      {/* Background Blur */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={true} // keep torch on for effect, though we are blurring
      />
      <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

      {/* Focused Camera Area */}
      <View style={styles.cameraContainer}>
        <Text style={styles.timerText}>{timeLeft}s</Text>
        <View style={styles.cameraFrame}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            enableTorch={true}
            mode="video"
            ref={cameraRef}
          />
        </View>
        <Text style={styles.recordingText}>Analyzing...</Text>
        <Button title="Stop" onPress={cancelMeasurement} variant="outline" style={{ marginTop: 20, borderColor: 'white' }} />
      </View>
    </View>
  );

  const renderResult = () => (
    <View style={styles.overlayContainer}>
      <View style={styles.modalContent}>
        <Ionicons name="checkmark-circle" size={56} color={Colors.secondary} style={{ alignSelf: 'center', marginBottom: 16 }} />
        <Text style={styles.modalTitle}>Measurement Complete</Text>

        <View style={styles.resultRow}>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Heart Rate</Text>
            <Text style={styles.resultValue}>{result?.hr} <Text style={styles.unit}>bpm</Text></Text>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Blood Pressure</Text>
            <Text style={styles.resultValue}>{result?.sys}/{result?.dia} <Text style={styles.unit}>mmHg</Text></Text>
          </View>
        </View>

        <Button title="Done" onPress={closeResult} size="large" style={{ marginTop: 24 }} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Simple Header */}
      <View style={styles.header}>
        <Ionicons
          name="arrow-back"
          size={28}
          color="#FFF"
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>Vitals</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionTitle}>Weekly Trends</Text>
          {historyData ? (
            <View style={{ alignItems: 'center' }}>
              <LineChart
                data={historyData}
                width={width - 56}
                height={200}
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: "#F8FAFC",
                  backgroundGradientFrom: "#F8FAFC",
                  backgroundGradientTo: "#F8FAFC",
                  decimalPlaces: 0,
                  color: (opacity = 1) => Colors.primary,
                  labelColor: (opacity = 1) => Colors.textSecondary,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "5", strokeWidth: "2", stroke: Colors.secondary }
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
                onDataPointClick={({ index }: { index: number }) => {
                  const pointData = historyData.fullData[index];
                  setSelectedReading(pointData);
                }}
                fromZero={false}
              />
              <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4 }}>Tap points for details</Text>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={{ color: Colors.textSecondary, fontFamily: 'Poppins-Regular' }}>No history data available.</Text>
            </View>
          )}
        </View>

        <View style={styles.placeholderContainer}>
          <Button
            title="Measure Vitals"
            onPress={startMeasurementFlow}
            size="large"
            style={{ width: '100%', maxWidth: 300, marginTop: 10 }}
          />
        </View>
      </View>

      {/* Overlays */}
      <Modal visible={isMeasuring} transparent animationType="fade">
        {step === 'intro' && renderIntro()}
        {step === 'camera' && renderCamera()}
        {step === 'result' && renderResult()}
      </Modal>

      {/* History Detail Modal */}
      <Modal visible={!!selectedReading} transparent animationType="fade">
        <View style={styles.overlayContainer}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Reading Details</Text>
              <Ionicons name="close" size={24} color={Colors.textSecondary} onPress={() => setSelectedReading(null)} />
            </View>

            {selectedReading && (
              <View>
                <Text style={[styles.modalText, { textAlign: 'center', marginBottom: 20, fontSize: 18, fontFamily: 'Poppins-SemiBold' }]}>
                  {new Date(selectedReading.recorded_at).toLocaleDateString()} at {new Date(selectedReading.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>

                <View style={styles.resultRow}>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Heart Rate</Text>
                    <Text style={styles.resultValue}>{selectedReading.heart_rate} <Text style={styles.unit}>bpm</Text></Text>
                  </View>
                  <View style={styles.resultDivider} />
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Blood Pressure</Text>
                    <Text style={styles.resultValue}>{selectedReading.systolic_bp}/{selectedReading.diastolic_bp} <Text style={styles.unit}>mmHg</Text></Text>
                  </View>
                </View>

                <Button title="Close" onPress={() => setSelectedReading(null)} size="default" style={{ marginTop: 20 }} />
              </View>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: Colors.primary,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    justifyContent: 'center',
  },
  placeholderContainer: {
    alignItems: 'center',
    padding: 24,
  },
  heartIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 4,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  placeholderTitle: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  placeholderSubtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },

  // Overlays
  fullScreen: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)', // Darker for better contrast
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'stretch',
    elevation: 24, // High elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, // Stronger shadow
    shadowRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0', // Border to separate from background
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  instructionText: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginLeft: 12,
  },

  // Camera
  cameraContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cameraFrame: {
    width: 250,
    height: 250,
    borderRadius: 125, // Circular
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'white',
    marginVertical: 24,
    elevation: 10,
  },
  timerText: {
    fontSize: 48,
    fontFamily: 'Poppins-Bold',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  recordingText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
  },

  // Results
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
  },
  resultItem: {
    flex: 1,
    alignItems: 'center',
  },
  resultDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  resultLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  resultValue: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: Colors.primary,
  },
  unit: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  emptyChart: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    marginVertical: 8,
    width: '100%',
  },
});