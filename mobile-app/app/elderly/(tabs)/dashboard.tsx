import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SOSButton } from '@/components/ui/SOSButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { dispatchEmergency } from '@/services/emergencyService';

export default function ElderlyDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('Friend');
  const [loading, setLoading] = useState(false);

  const [requests, setRequests] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [latestHR, setLatestHR] = useState<string>('--');
  const [latestBP, setLatestBP] = useState<string>('--/--');
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const [sosLoading, setSosLoading] = useState(false);
  const [nextMedication, setNextMedication] = useState<any>(null);

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.full_name) {
      setUserName(user.user_metadata.full_name.split(' ')[0]);
    }
  }, []);

  const checkPendingRequests = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return;

    const { data, error } = await supabase
      .from('caregiver_patient_links')
      .select(`id, caregiver_id, caregiver:users!caregiver_patient_links_caregiver_id_fkey (full_name, email, phone)`)
      .eq('patient_email', user.email)
      .eq('status', 'pending');

    if (!error) {
      setRequests(data || []);
    }
  }, []);

  const fetchLatestVitals = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('vitals')
      .select('heart_rate, systolic_bp, diastolic_bp, recorded_at')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setLatestHR(`${data.heart_rate}`);
      setLatestBP(`${data.systolic_bp}/${data.diastolic_bp}`);
      setLastCheckTime(
        new Date(data.recorded_at).toLocaleString([], {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      );
    }
  }, []);

  const fetchNextMedication = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const dayOfWeek = today.getDay();
      const dateStr = today.toISOString().split('T')[0];

      // 1. Get active medications
      const { data: meds } = await supabase.from('medications').select('*').eq('patient_id', user.id).eq('is_active', true);
      if (!meds || meds.length === 0) {
        setNextMedication(null);
        return;
      }

      // 2. Get today's schedules
      const { data: schedules } = await supabase.from('medication_schedules').select('*').in('med_id', meds.map(m => m.id));
      const todaySchedules = (schedules || []).filter((s:any) => s.days_of_week.map(Number).includes(dayOfWeek));

      // 3. Get logs for today
      const { data: logs } = await supabase.from('medication_logs').select('*')
        .gte('scheduled_at', `${dateStr}T00:00:00`)
        .lte('scheduled_at', `${dateStr}T23:59:59`);

      // 4. Find the first schedule that does NOT have a log yet
      todaySchedules.sort((a:any, b:any) => a.reminder_time.localeCompare(b.reminder_time));
      
      const nextSched = todaySchedules.find((sched:any) => {
        const hasLog = logs?.some((l:any) => l.schedule_id === sched.id);
        return !hasLog;
      });

      if (nextSched) {
        const med = meds.find(m => m.id === nextSched.med_id);
        setNextMedication({
          name: med?.name || 'Unknown Medicine',
          time: nextSched.reminder_time,
          dosage: med?.dosage || ''
        });
      } else {
        setNextMedication('ALL_DONE');
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await fetchProfile();
    await checkPendingRequests();
    await fetchLatestVitals();
    await fetchNextMedication();
    setLoading(false);
  }, [fetchProfile, checkPendingRequests, fetchLatestVitals, fetchNextMedication]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleApprove(requestId: string) {
    setApprovingId(requestId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setApprovingId(null); return; }

    const { error } = await supabase
      .from('caregiver_patient_links')
      .update({ status: 'active', patient_id: user.id })
      .eq('id', requestId);

    setApprovingId(null);

    if (!error) {
      Alert.alert('Success', 'Linked with caregiver!');
      checkPendingRequests();
    } else {
      Alert.alert('Error', error.message);
    }
  }

  async function handleIgnore(requestId: string) {
    Alert.alert("Ignored", "Request hidden for now.");
    setRequests(current => current.filter(r => r.id !== requestId));
  }

  async function handleSOS() {
    Alert.alert(
      '🚨 Emergency SOS',
      'This will immediately alert ALL your caregivers with your GPS location.\n\nYour primary caregiver will receive a phone call.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSosLoading(true);
            try {
              const result = await dispatchEmergency('sos_manual');
              if (result.success) {
                Alert.alert('SOS Sent ✅', `Emergency alert sent to ${result.caregiversFound} caregiver(s).\n\nHelp is on the way.`);
              } else {
                Alert.alert('SOS Alert', result.caregiversFound === 0 ? 'No caregivers are linked.' : `Issue: ${result.error || 'Please try again.'}`);
              }
            } catch (error: any) {
              Alert.alert('Error', 'Failed to send SOS. Please call emergency services directly.');
            } finally {
              setSosLoading(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.headerBackground}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.date}>{new Date().toDateString()}</Text>
            <Text style={styles.greeting}>Hello, {userName}!</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/elderly/settings' as any)} style={styles.profileBtn}>
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.sosContainer}>
          <SOSButton onPress={handleSOS} disabled={sosLoading} />
        </View>
      </View>

      <View style={styles.bodyCard}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
        >
          {requests.length > 0 && requests.map((req, index) => (
            <Card key={index} style={styles.alertCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="notifications" size={24} color={Colors.primary} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.alertTitle}>New Request</Text>
                  <Text style={styles.alertText}>
                    <Text style={{ fontFamily: 'Poppins-Bold' }}>
                      {req.caregiver?.full_name || req.caregiver?.email || 'A Caregiver'}
                    </Text> wants to link.
                  </Text>
                </View>
              </View>
              <View style={styles.alertActions}>
                <Button title="Accept" onPress={() => handleApprove(req.id)} size="default" isLoading={approvingId === req.id} style={{ flex: 1, marginRight: 8 }} />
                <Button title="Ignore" variant="outline" onPress={() => handleIgnore(req.id)} style={{ flex: 1 }} />
              </View>
            </Card>
          ))}

          <SectionHeader title="Today's Health" />
          {lastCheckTime && (
            <View style={styles.lastCheckRow}>
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.lastCheckText}>Last check: {lastCheckTime}</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#FEF2F2' }]}>
              <View style={[styles.iconCircle, { backgroundColor: '#FECACA' }]}>
                <Ionicons name="heart" size={24} color={Colors.danger} />
              </View>
              <Text style={styles.statValue}>{latestHR}</Text>
              <Text style={styles.statLabel}>Heart Rate</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
              <View style={[styles.iconCircle, { backgroundColor: '#BFDBFE' }]}>
                <Ionicons name="water" size={24} color={Colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: Colors.primary }]}>{latestBP}</Text>
              <Text style={styles.statLabel}>Blood Pressure</Text>
            </View>
          </View>

          <SectionHeader title="Dashboard" />
          
          {/* Next Medication Card */}
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/elderly/medication' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.actionCardHeader}>
              <View style={[styles.smallIconCircle, {backgroundColor: '#FEF3C7'}]}>
                <Ionicons name="medkit" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.actionCardTitle}>Next Medication</Text>
            </View>
            
            <View style={styles.actionCardBody}>
              {nextMedication === null ? (
                <Text style={styles.medsDetailText}>No active medications.</Text>
              ) : nextMedication === 'ALL_DONE' ? (
                <Text style={styles.medsReadyText}>All done for today! ✅</Text>
              ) : (
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <View>
                        <Text style={styles.medsTime}>{formatTime(nextMedication.time)}</Text>
                        <Text style={styles.medsName}>{nextMedication.name} • {nextMedication.dosage}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Fall Detection Live Status Card */}
          <TouchableOpacity 
            style={styles.actionCard} 
            onPress={() => router.push('/elderly/fall-detection-debug' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.actionCardHeader}>
              <View style={[styles.smallIconCircle, {backgroundColor: '#FEE2E2'}]}>
                <Ionicons name="body" size={20} color="#EF4444" />
              </View>
              <Text style={styles.actionCardTitle}>Fall Detection</Text>
            </View>
            <View style={styles.actionCardBody}>
              <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <View style={styles.pulseDot} />
                      <Text style={styles.fallStatusText}>Actively Monitoring</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
              </View>
            </View>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </View>
  );
}

// Utility to format HH:MM to 12h format
function formatTime(time: string) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  headerBackground: { height: '38%', paddingTop: 60, paddingHorizontal: 24, backgroundColor: Colors.primary },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  date: { color: '#E0F2FE', fontFamily: 'Poppins-Regular', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
  greeting: { color: '#FFFFFF', fontFamily: 'Poppins-Bold', fontSize: 26 },
  profileBtn: { width: 45, height: 45, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  sosContainer: { marginTop: 10 },
  bodyCard: { flex: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 30, marginTop: -20 },
  scrollContent: { paddingBottom: 110 },
  alertCard: { marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', elevation: 2 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontFamily: 'Poppins-Bold', fontSize: 16, color: Colors.textPrimary },
  alertText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textSecondary, flexWrap: 'wrap' },
  alertActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  statCard: { flex: 1, borderRadius: 24, padding: 16, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 22, fontFamily: 'Poppins-Bold', color: Colors.textPrimary },
  statLabel: { fontSize: 12, fontFamily: 'Poppins-Regular', color: Colors.textSecondary },
  lastCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  lastCheckText: { fontSize: 13, fontFamily: 'Poppins-Regular', color: Colors.textSecondary },
  
  actionCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.05, shadowRadius: 8 },
  actionCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  smallIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionCardTitle: { fontFamily: 'Poppins-Bold', fontSize: 16, color: Colors.textPrimary },
  actionCardBody: { paddingLeft: 48 },
  
  medsTime: { fontFamily: 'Poppins-Bold', fontSize: 20, color: Colors.textPrimary, marginBottom: 4 },
  medsName: { fontFamily: 'Poppins-Regular', fontSize: 14, color: Colors.textSecondary },
  medsDetailText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#94A3B8' },
  medsReadyText: { fontFamily: 'Poppins-Bold', fontSize: 16, color: '#22C55E' },
  
  pulseDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', marginRight: 8 },
  fallStatusText: { fontFamily: 'Poppins-Bold', fontSize: 15, color: '#22C55E' },
});