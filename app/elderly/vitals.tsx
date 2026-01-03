import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

export default function VitalsScreen() {
  const router = useRouter();
  const [heartRate, setHeartRate] = useState('');
  const [sysBP, setSysBP] = useState('');
  const [diaBP, setDiaBP] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    fetchVitalsHistory();
  }, []);

  async function fetchVitalsHistory() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('vitals')
        .select('heart_rate, recorded_at')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: true })
        .limit(7);

      if (data && data.length > 0) {
        const rates = data.map(d => d.heart_rate);
        // Simple date formatting
        const dates = data.map(d => new Date(d.recorded_at).getDate().toString()); 

        setChartData({
          labels: dates,
          datasets: [{ data: rates }]
        });
      }
    } catch (e) {
      console.log(e);
    }
  }

  async function handleLogVitals() {
    if (!heartRate || !sysBP || !diaBP) {
      Alert.alert('Missing Data', 'Please fill in all fields.');
      return;
    }
    
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('vitals').insert({
      user_id: user.id,
      heart_rate: parseInt(heartRate),
      systolic_bp: parseInt(sysBP),
      diastolic_bp: parseInt(diaBP)
    });
    
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Vitals logged successfully!');
      setHeartRate('');
      setSysBP('');
      setDiaBP('');
      fetchVitalsHistory(); // Refresh chart
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header with Chart */}
      <View style={styles.headerBackground}>
        <View style={styles.headerContent}>
          <Ionicons 
            name="arrow-back" 
            size={28} 
            color="#FFF" 
            onPress={() => router.back()} 
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.headerTitle}>Heart Health</Text>
          <Text style={styles.headerSubtitle}>Weekly Trends</Text>
          
          {chartData ? (
            <LineChart
              data={chartData}
              width={width - 48}
              height={180}
              yAxisSuffix=" bpm"
              chartConfig={{
                backgroundColor: Colors.primary,
                backgroundGradientFrom: Colors.primary,
                backgroundGradientTo: Colors.primary,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: "5", strokeWidth: "2", stroke: "#ffa726" }
              }}
              style={{ marginVertical: 8, borderRadius: 16 }}
              bezier
            />
          ) : (
            <View style={styles.emptyChart}>
              <Text style={{ color: 'white', fontFamily: 'Poppins-Regular' }}>No data yet. Log your first reading!</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content Card */}
      <View style={styles.contentCard}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          
          <Text style={styles.sectionTitle}>Log New Reading</Text>
          
          <Card style={styles.inputCard}>
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="heart" size={24} color={Colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Heart Rate</Text>
                <InputField 
                  placeholder="e.g. 72" 
                  value={heartRate}
                  onChangeText={setHeartRate}
                  keyboardType="numeric"
                  icon="pulse"
                />
              </View>
            </View>
          </Card>

          <Card style={styles.inputCard}>
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="water" size={24} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Blood Pressure</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <InputField 
                      placeholder="Sys (120)" 
                      value={sysBP}
                      onChangeText={setSysBP}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <InputField 
                      placeholder="Dia (80)" 
                      value={diaBP}
                      onChangeText={setDiaBP}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            </View>
          </Card>

          <Button 
            title="Save Record" 
            onPress={handleLogVitals} 
            isLoading={loading} 
            size="large"
            style={{ marginTop: 10 }}
          />

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  headerBackground: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    backgroundColor: Colors.primary,
  },
  headerContent: {},
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#E0F2FE',
    marginBottom: 16,
  },
  emptyChart: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 16,
    marginVertical: 8,
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  inputCard: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 24,
    borderWidth: 0,
    backgroundColor: '#FFF',
    elevation: 2,
    shadowOpacity: 0.05,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
});