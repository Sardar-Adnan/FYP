import { Card } from '@/components/ui/Card';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import { getLinkedPatient, getPatientVitals } from '@/services/caregiverService';
import { VitalsRecord } from '@/types';
import { exportCSV } from '@/utils/csvExport';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

type TimeRange = 7 | 30;

export default function CaregiverVitalsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [vitals, setVitals] = useState<VitalsRecord[]>([]);
  const [range, setRange] = useState<TimeRange>(7);
  const [selectedReading, setSelectedReading] = useState<VitalsRecord | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const linked = await getLinkedPatient();
      if (!linked) return;
      setPatientId(linked.patientId);
      const data = await getPatientVitals(linked.patientId, range);
      setVitals(data);
    } catch (error) {
      console.error('[CaregiverVitals] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const getRiskColor = (label?: string) => {
    switch (label) {
      case 'low': return Colors.success;
      case 'moderate': return Colors.warning;
      case 'high': return Colors.danger;
      default: return Colors.textSecondary;
    }
  };

  const handleExport = () => {
    exportCSV(
      vitals.map((v) => ({
        date: new Date(v.recorded_at).toLocaleDateString(),
        time: new Date(v.recorded_at).toLocaleTimeString(),
        heart_rate: v.heart_rate,
        systolic_bp: v.systolic_bp,
        diastolic_bp: v.diastolic_bp,
        risk_label: v.risk_label || 'N/A',
      })),
      `vitals_report_${range}d`,
      [
        { key: 'date', label: 'Date' },
        { key: 'time', label: 'Time' },
        { key: 'heart_rate', label: 'Heart Rate (bpm)' },
        { key: 'systolic_bp', label: 'Systolic BP' },
        { key: 'diastolic_bp', label: 'Diastolic BP' },
        { key: 'risk_label', label: 'Risk Level' },
      ]
    );
  };

  const chartData = vitals.length > 0
    ? {
        labels: vitals.map((v) => {
          const d = new Date(v.recorded_at);
          return `${d.getDate()}/${d.getMonth() + 1}`;
        }),
        datasets: [{ data: vitals.map((v) => v.heart_rate) }],
      }
    : null;

  const bpChartData = vitals.length > 0
    ? {
        labels: vitals.map((v) => {
          const d = new Date(v.recorded_at);
          return `${d.getDate()}/${d.getMonth() + 1}`;
        }),
        datasets: [
          { data: vitals.map((v) => v.systolic_bp), color: () => '#EF4444' },
          { data: vitals.map((v) => v.diastolic_bp), color: () => '#3B82F6' },
        ],
        legend: ['Systolic', 'Diastolic'],
      }
    : null;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}>
          <Text style={styles.title}>Vitals History</Text>

          {/* Range Selector */}
          <View style={styles.rangeRow}>
            {([7, 30] as TimeRange[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
                onPress={() => setRange(r)}
              >
                <Text
                  style={[
                    styles.rangeBtnText,
                    range === r && styles.rangeBtnTextActive,
                  ]}
                >
                  {r}D
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : vitals.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="pulse-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No vitals recorded in this period.</Text>
          </View>
        ) : (
          <>
            {/* Heart Rate Chart */}
            <Text style={styles.sectionTitle}>
              <Ionicons name="heart" size={16} color="#EF4444" /> Heart Rate
            </Text>
            {chartData && (
              <View style={{ alignItems: 'center' }}>
                <LineChart
                  data={chartData}
                  width={width - 56}
                  height={200}
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: '#FFFFFF',
                    backgroundGradientFrom: '#FFFFFF',
                    backgroundGradientTo: '#FFFFFF',
                    decimalPlaces: 0,
                    color: () => '#EF4444',
                    labelColor: () => Colors.textSecondary,
                    propsForDots: { r: '4', strokeWidth: '2', stroke: '#EF4444' },
                  }}
                  bezier
                  style={{ borderRadius: 16, marginBottom: 8 }}
                  onDataPointClick={({ index }) => setSelectedReading(vitals[index])}
                  fromZero={false}
                />
              </View>
            )}

            {/* Blood Pressure Chart */}
            <Text style={styles.sectionTitle}>
              <Ionicons name="water" size={16} color="#3B82F6" /> Blood Pressure
            </Text>
            {bpChartData && (
              <View style={{ alignItems: 'center' }}>
                <LineChart
                  data={bpChartData}
                  width={width - 56}
                  height={200}
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: '#FFFFFF',
                    backgroundGradientFrom: '#FFFFFF',
                    backgroundGradientTo: '#FFFFFF',
                    decimalPlaces: 0,
                    color: () => '#3B82F6',
                    labelColor: () => Colors.textSecondary,
                    propsForDots: { r: '4', strokeWidth: '2', stroke: '#3B82F6' },
                  }}
                  bezier
                  style={{ borderRadius: 16, marginBottom: 8 }}
                  fromZero={false}
                />
              </View>
            )}

            {/* Latest Reading Card */}
            {selectedReading && (
              <Card style={styles.readingCard}>
                <View style={styles.readingHeader}>
                  <Text style={styles.readingTitle}>Reading Details</Text>
                  <TouchableOpacity onPress={() => setSelectedReading(null)}>
                    <Ionicons name="close" size={22} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.readingDate}>
                  {new Date(selectedReading.recorded_at).toLocaleDateString()} at{' '}
                  {new Date(selectedReading.recorded_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <View style={styles.readingRow}>
                  <View style={styles.readingItem}>
                    <Text style={styles.readingLabel}>Heart Rate</Text>
                    <Text style={styles.readingValue}>
                      {selectedReading.heart_rate}{' '}
                      <Text style={styles.readingUnit}>bpm</Text>
                    </Text>
                  </View>
                  <View style={styles.readingDivider} />
                  <View style={styles.readingItem}>
                    <Text style={styles.readingLabel}>Blood Pressure</Text>
                    <Text style={styles.readingValue}>
                      {selectedReading.systolic_bp}/{selectedReading.diastolic_bp}{' '}
                      <Text style={styles.readingUnit}>mmHg</Text>
                    </Text>
                  </View>
                </View>
                {selectedReading.risk_label && (
                  <View
                    style={[
                      styles.riskBadge,
                      { backgroundColor: getRiskColor(selectedReading.risk_label) + '20' },
                    ]}
                  >
                    <Ionicons
                      name={
                        selectedReading.risk_label === 'low'
                          ? 'shield-checkmark'
                          : 'warning'
                      }
                      size={18}
                      color={getRiskColor(selectedReading.risk_label)}
                    />
                    <Text
                      style={[
                        styles.riskText,
                        { color: getRiskColor(selectedReading.risk_label) },
                      ]}
                    >
                      {selectedReading.risk_label.charAt(0).toUpperCase() +
                        selectedReading.risk_label.slice(1)}{' '}
                      Risk
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {/* Export Button */}
            <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
              <Ionicons name="download-outline" size={20} color={Colors.primary} />
              <Text style={styles.exportBtnText}>Download Vitals Report (CSV)</Text>
            </TouchableOpacity>
          </>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginBottom: 20,
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  rangeBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  rangeBtnText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: 'rgba(255,255,255,0.7)',
  },
  rangeBtnTextActive: {
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 12,
    marginTop: 16,
  },
  center: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginTop: 12,
  },
  readingCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  readingTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
  },
  readingDate: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  readingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  readingItem: { flex: 1, alignItems: 'center' },
  readingDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  readingLabel: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  readingValue: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
  },
  readingUnit: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  riskText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    marginBottom: 30,
    gap: 8,
  },
  exportBtnText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: Colors.primary,
  },
});
