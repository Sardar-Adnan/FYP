import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { VitalsConfig } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { VitalsService, VitalsResult } from '@/services/vitalsService';

const { width, height } = Dimensions.get('window');

export default function VitalsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // State
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [step, setStep] = useState<'intro' | 'camera' | 'processing' | 'result' | 'error'>('intro');
  const [timeLeft, setTimeLeft] = useState(VitalsConfig.MEASUREMENT_DURATION);
  const [result, setResult] = useState<VitalsResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [videoUri, setVideoUri] = useState<string | null>(null);

  // History / Graph State
  const [historyData, setHistoryData] = useState<any>(null);
  const [bpChartData, setBpChartData] = useState<any>(null);
  const [selectedReading, setSelectedReading] = useState<any>(null);
  const [activeChartTab, setActiveChartTab] = useState(0);
  const chartScrollRef = useRef<ScrollView>(null);

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
        const hrPoints = data.map(d => d.heart_rate);
        const sysPoints = data.map(d => d.systolic_bp);
        const diaPoints = data.map(d => d.diastolic_bp);

        // HR Chart Data
        setHistoryData({
          labels,
          datasets: [
            { data: hrPoints, color: (opacity = 1) => Colors.danger, strokeWidth: 2 },
            {
              data: [40, 140],
              withDots: false,
              strokeWidth: 0,
              color: () => 'transparent',
            },
          ],
          fullData: data
        });

        // BP Chart Data (systolic + diastolic)
        setBpChartData({
          labels,
          datasets: [
            { data: sysPoints, color: (opacity = 1) => '#EF4444', strokeWidth: 2 },
            { data: diaPoints, color: (opacity = 1) => '#3B82F6', strokeWidth: 2 },
            {
              data: [50, 200],
              withDots: false,
              strokeWidth: 0,
              color: () => 'transparent',
            },
          ],
          legend: ['Systolic', 'Diastolic'],
        });
      }
    } catch (e) {

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
    setErrorMessage('');
    setVideoUri(null);
  };

  const cancelMeasurement = () => {
    stopRecordingLogic();
    setIsMeasuring(false);
    setStep('intro');
  };

  const proceedToCamera = async () => {
    // Request camera permission
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to measure vitals.');
        return;
      }
    }

    // Request audio permission (required for video recording)
    const { status: audioStatus } = await Audio.requestPermissionsAsync();
    if (audioStatus !== 'granted') {
      Alert.alert('Permission Required', 'Microphone permission is needed for video recording.');
      return;
    }

    setStep('camera');
    setTimeout(() => {
      startRecording();
    }, 1000);
  };

  const startRecording = async () => {
    if (cameraRef.current && !isRecording) {
      setIsRecording(true);
      setTimeLeft(VitalsConfig.MEASUREMENT_DURATION);

      // Start Timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecordingLogic();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      try {
        // Record video and get the URI
        const video = await cameraRef.current.recordAsync({
          maxDuration: VitalsConfig.MEASUREMENT_DURATION
        });
        if (video?.uri) {

          setVideoUri(video.uri);
          finishMeasurement(video.uri);
        }
      } catch (e) {

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

  const finishMeasurement = async (recordedVideoUri?: string) => {
    const uri = recordedVideoUri || videoUri;

    if (!uri) {
      setErrorMessage('No video recorded. Please try again.');
      setStep('error');
      return;
    }

    setStep('processing');

    try {
      // Send video to Django backend for analysis

      const vitalsResult = await VitalsService.analyzeVideo(uri, user);

      setResult(vitalsResult);
      setStep('result');

      // Save to Supabase
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await VitalsService.saveToSupabase(authUser.id, vitalsResult);
        // Refresh history
        fetchHistory();
      }
    } catch (error: any) {
      console.error('[Vitals] Analysis failed:', error);
      setErrorMessage(error.message || 'Failed to analyze video. Please try again.');
      setStep('error');
    }
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

  const getRiskColor = (label?: string) => {
    switch (label) {
      case 'low': return Colors.success;
      case 'moderate': return Colors.warning;
      case 'high': return Colors.danger;
      default: return Colors.textSecondary;
    }
  };

  const renderResult = () => (
    <View style={styles.overlayContainer}>
      <View style={styles.modalContent}>
        <Ionicons name="checkmark-circle" size={56} color={Colors.secondary} style={{ alignSelf: 'center', marginBottom: 16 }} />
        <Text style={styles.modalTitle}>Measurement Complete</Text>

        <View style={styles.resultRow}>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Heart Rate</Text>
            <Text style={styles.resultValue}>{Math.round(result?.heart_rate || 0)} <Text style={styles.unit}>bpm</Text></Text>
          </View>
          <View style={styles.resultDivider} />
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Blood Pressure</Text>
            <Text style={styles.resultValue}>{Math.round(result?.systolic || 0)}/{Math.round(result?.diastolic || 0)} <Text style={styles.unit}>mmHg</Text></Text>
          </View>
        </View>

        {/* Health Risk Indicator */}
        {result?.risk_label && (
          <View style={[styles.riskBadge, { backgroundColor: getRiskColor(result.risk_label) + '20' }]}>
            <Ionicons
              name={result.risk_label === 'low' ? 'shield-checkmark' : result.risk_label === 'high' ? 'warning' : 'alert-circle'}
              size={24}
              color={getRiskColor(result.risk_label)}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[styles.riskTitle, { color: getRiskColor(result.risk_label) }]}>
                {result.risk_label === 'low' ? 'Low Risk' : result.risk_label === 'high' ? 'High Risk' : 'Moderate Risk'}
              </Text>
              <Text style={styles.riskSubtitle}>
                {result.risk_label === 'low'
                  ? 'Your vitals look healthy!'
                  : result.risk_label === 'high'
                    ? 'Consider consulting a doctor'
                    : 'Monitor your health regularly'}
              </Text>
            </View>
          </View>
        )}

        <Button title="Done" onPress={closeResult} size="large" style={{ marginTop: 24 }} />
      </View>
    </View>
  );

  const renderProcessing = () => (
    <View style={styles.overlayContainer}>
      <View style={styles.modalContent}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 24 }} />
        <Text style={styles.modalTitle}>Analyzing Video</Text>
        <Text style={[styles.modalText, { textAlign: 'center' }]}>
          Please wait while we process your vitals measurement...
        </Text>
      </View>
    </View>
  );

  const renderError = () => (
    <View style={styles.overlayContainer}>
      <View style={styles.modalContent}>
        <Ionicons name="alert-circle" size={56} color={Colors.danger} style={{ alignSelf: 'center', marginBottom: 16 }} />
        <Text style={styles.modalTitle}>Measurement Failed</Text>
        <Text style={[styles.modalText, { textAlign: 'center' }]}>
          {errorMessage}
        </Text>
        <Button title="Try Again" onPress={startMeasurementFlow} size="large" style={{ marginTop: 24 }} />
        <Button title="Cancel" onPress={cancelMeasurement} variant="outline" style={{ marginTop: 12 }} />
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
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionTitle}>Weekly Trends</Text>

          {/* Chart Tab Buttons */}
          <View style={styles.chartTabs}>
            <TouchableOpacity
              style={[styles.chartTab, activeChartTab === 0 && styles.chartTabActive]}
              onPress={() => {
                setActiveChartTab(0);
                chartScrollRef.current?.scrollTo({ x: 0, animated: true });
              }}
            >
              <Ionicons name="heart" size={16} color={activeChartTab === 0 ? '#FFF' : Colors.textSecondary} />
              <Text style={[styles.chartTabText, activeChartTab === 0 && styles.chartTabTextActive]}>Heart Rate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chartTab, activeChartTab === 1 && styles.chartTabActive]}
              onPress={() => {
                setActiveChartTab(1);
                chartScrollRef.current?.scrollTo({ x: width - 48, animated: true });
              }}
            >
              <Ionicons name="pulse" size={16} color={activeChartTab === 1 ? '#FFF' : Colors.textSecondary} />
              <Text style={[styles.chartTabText, activeChartTab === 1 && styles.chartTabTextActive]}>Blood Pressure</Text>
            </TouchableOpacity>
          </View>

          {/* Swipeable Charts */}
          {historyData ? (
            <ScrollView
              ref={chartScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const page = Math.round(e.nativeEvent.contentOffset.x / (width - 48));
                setActiveChartTab(page);
              }}
              style={{ marginTop: 8 }}
            >
              {/* HR Chart */}
              <View style={{ width: width - 48, alignItems: 'center' }}>
                <LineChart
                  data={historyData}
                  width={width - 56}
                  height={200}
                  yAxisSuffix=" bpm"
                  chartConfig={{
                    backgroundColor: '#F8FAFC',
                    backgroundGradientFrom: '#F8FAFC',
                    backgroundGradientTo: '#F8FAFC',
                    decimalPlaces: 0,
                    color: (opacity = 1) => Colors.danger,
                    labelColor: (opacity = 1) => Colors.textSecondary,
                    style: { borderRadius: 16 },
                    propsForDots: { r: '6', strokeWidth: '2', stroke: Colors.danger },
                  }}
                  bezier
                  style={{ borderRadius: 16 }}
                  fromZero={false}
                />
              </View>

              {/* BP Chart */}
              <View style={{ width: width - 48, alignItems: 'center' }}>
                {bpChartData ? (
                  <LineChart
                    data={bpChartData}
                    width={width - 56}
                    height={200}
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundColor: '#F8FAFC',
                      backgroundGradientFrom: '#F8FAFC',
                      backgroundGradientTo: '#F8FAFC',
                      decimalPlaces: 0,
                      color: (opacity = 1) => '#3B82F6',
                      labelColor: (opacity = 1) => Colors.textSecondary,
                      style: { borderRadius: 16 },
                      propsForDots: { r: '6', strokeWidth: '2', stroke: '#3B82F6' },
                    }}
                    bezier
                    style={{ borderRadius: 16 }}
                    fromZero={false}
                  />
                ) : (
                  <View style={styles.emptyChart}>
                    <Text style={{ color: Colors.textSecondary, fontFamily: 'Poppins-Regular' }}>No BP data available.</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={{ color: Colors.textSecondary, fontFamily: 'Poppins-Regular' }}>No history data available.</Text>
            </View>
          )}

          {/* Swipe Dots */}
          <View style={styles.chartDots}>
            <View style={[styles.chartDot, activeChartTab === 0 && styles.chartDotActive]} />
            <View style={[styles.chartDot, activeChartTab === 1 && styles.chartDotActive]} />
          </View>
        </View>

        {/* Vitals History Log */}
        {historyData?.fullData && historyData.fullData.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>History Log</Text>
            {[...historyData.fullData].reverse().map((reading: any, idx: number) => (
              <TouchableOpacity
                key={reading.id || idx}
                style={styles.historyCard}
                onPress={() => setSelectedReading(reading)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyDate}>
                      {new Date(reading.recorded_at).toLocaleDateString()} at {new Date(reading.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <Ionicons name="heart" size={16} color={Colors.danger} />
                      <Text style={styles.historyValue}> {reading.heart_rate} bpm</Text>
                      <Text style={styles.historyDivider}>  |  </Text>
                      <Ionicons name="pulse" size={16} color={Colors.primary} />
                      <Text style={styles.historyValue}> {reading.systolic_bp}/{reading.diastolic_bp} mmHg</Text>
                    </View>
                  </View>
                  {reading.risk_label && (
                    <View style={[styles.historyRiskBadge, { backgroundColor: getRiskColor(reading.risk_label) + '20' }]}>
                      <Text style={[styles.historyRiskText, { color: getRiskColor(reading.risk_label) }]}>
                        {reading.risk_label === 'low' ? 'Low' : reading.risk_label === 'high' ? 'High' : 'Mod'}
                      </Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} style={{ marginLeft: 8 }} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.placeholderContainer}>
          <Button
            title="Measure Vitals"
            onPress={startMeasurementFlow}
            size="large"
            style={{ width: '100%', maxWidth: 300, marginTop: 10 }}
          />
        </View>
      </ScrollView>

      {/* Overlays */}
      <Modal visible={isMeasuring} transparent animationType="fade">
        {step === 'intro' && renderIntro()}
        {step === 'camera' && renderCamera()}
        {step === 'processing' && renderProcessing()}
        {step === 'result' && renderResult()}
        {step === 'error' && renderError()}
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

                {selectedReading.risk_label && (
                  <View style={[styles.riskBadge, { backgroundColor: getRiskColor(selectedReading.risk_label) + '20' }]}>
                    <Ionicons
                      name={selectedReading.risk_label === 'low' ? 'shield-checkmark' : selectedReading.risk_label === 'high' ? 'warning' : 'alert-circle'}
                      size={20}
                      color={getRiskColor(selectedReading.risk_label)}
                    />
                    <Text style={[styles.riskTitle, { color: getRiskColor(selectedReading.risk_label), marginLeft: 8 }]}>
                      {selectedReading.risk_label === 'low' ? 'Low Risk' : selectedReading.risk_label === 'high' ? 'High Risk' : 'Moderate Risk'}
                    </Text>
                  </View>
                )}

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
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  riskTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
  },
  riskSubtitle: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  historyDate: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  },
  historyValue: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  historyDivider: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  historyRiskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  historyRiskText: {
    fontSize: 12,
    fontFamily: 'Poppins-Bold',
  },
  chartTabs: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  chartTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  chartTabActive: {
    backgroundColor: Colors.primary,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  chartTabText: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textSecondary,
  },
  chartTabTextActive: {
    color: '#FFF',
  },
  chartDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  chartDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  chartDotActive: {
    backgroundColor: Colors.primary,
    width: 20,
    borderRadius: 4,
  },
});